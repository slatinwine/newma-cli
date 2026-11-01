/**
 * EventSourceBridge — 事件源 → Trigger 桥（文章 3.2 的最后一块拼图）
 *
 * EventSourceManager 的事件此前只驱动 UI（终端重绘/按键）；
 * 本桥把 file-watcher / http / websocket 的环境事件包装成 TriggerEvent
 * 喂给 TriggerRouter，事件驱动从「能用」变成「在用」：
 *
 *   EventSourceManager.pollNext() ──(后台泵)──> 转换/去重/限流
 *     ──> triggerRouter.route() ──> Fast Path / Slow Path ──> SuperRouter 建任务
 *
 * 降噪三件套（在进入 LLM 语义层之前，零成本）：
 * - 按键/绘制/信号等 UI 内部事件直接丢弃
 * - 同 (source, origin, kind) 在 debounce 窗口内的事件合并（编辑器保存风暴）
 * - 每分钟路由上限（超限丢弃计数，防止事件风暴打爆 Router）
 */

import type { UIEvent } from '../../loop/event/types';
import type { TriggerRouter } from './trigger-router';
import type { TriggerEvent, TriggerSourceKind } from './types';

// ============================================================================
// Types
// ============================================================================

/** 事件源管理器的最小接口（避免与 EventSourceManager 具体类型耦合，便于单测） */
export interface PollableEventSourceManager {
  pollNext(timeoutMs?: number): Promise<UIEvent | null>;
}

export interface EventSourceBridgeOptions {
  /** 泵轮询间隔毫秒（默认 500ms；pollNext 自带等待） */
  pollIntervalMs?: number;
  /** 同 (source, origin, kind) 的去重窗口毫秒（默认 800ms） */
  debounceMs?: number;
  /** 每分钟最多路由的事件数（默认 60，超出丢弃计数） */
  maxPerMinute?: number;
  /** 每条事件路由出错后的静默继续（默认 true） */
  swallowErrors?: boolean;
}

export interface EventSourceBridgeStats {
  routed: number;
  deduped: number;
  droppedByRate: number;
  ignoredUiEvents: number;
}

/** 带来源标注的 FocusEvent（EventSourceManager pollNext 的产物形态） */
interface AnnotatedFocusEvent {
  source?: string;
  data?: unknown;
  timestamp?: number;
}

// ============================================================================
// Bridge
// ============================================================================

export class EventSourceBridge {
  private readonly triggerRouter: TriggerRouter;
  private readonly manager: PollableEventSourceManager;
  private readonly pollIntervalMs: number;
  private readonly debounceMs: number;
  private readonly maxPerMinute: number;
  private readonly swallowErrors: boolean;

  private running = false;
  private pumpTimer?: NodeJS.Timeout;
  private lastSeen = new Map<string, number>();
  private minuteWindowStart = Date.now();
  private routedThisMinute = 0;
  private stats: EventSourceBridgeStats = {
    routed: 0,
    deduped: 0,
    droppedByRate: 0,
    ignoredUiEvents: 0,
  };

  constructor(manager: PollableEventSourceManager, triggerRouter: TriggerRouter, options: EventSourceBridgeOptions = {}) {
    this.manager = manager;
    this.triggerRouter = triggerRouter;
    this.pollIntervalMs = options.pollIntervalMs ?? 500;
    this.debounceMs = options.debounceMs ?? 800;
    this.maxPerMinute = options.maxPerMinute ?? 60;
    this.swallowErrors = options.swallowErrors ?? true;
  }

  get isRunning(): boolean {
    return this.running;
  }

  getStats(): Readonly<EventSourceBridgeStats> {
    return this.stats;
  }

  /** 启动后台泵（幂等）。 */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.schedule();
  }

  /** 停止后台泵。已进入 Router 的事件不受影响。 */
  stop(): void {
    this.running = false;
    if (this.pumpTimer) {
      clearTimeout(this.pumpTimer);
      this.pumpTimer = undefined;
    }
  }

  /** 手动喂一条 UIEvent（测试与外部注入入口），返回是否被路由。 */
  async ingest(event: UIEvent): Promise<boolean> {
    const trigger = toTriggerEvent(event);
    if (!trigger) {
      this.stats.ignoredUiEvents++;
      return false;
    }
    if (this.isDuplicate(trigger)) {
      this.stats.deduped++;
      return false;
    }
    if (!this.consumeRateBudget()) {
      this.stats.droppedByRate++;
      return false;
    }
    try {
      await this.triggerRouter.route(trigger);
      this.stats.routed++;
      return true;
    } catch (err) {
      if (!this.swallowErrors) throw err;
      return false;
    }
  }

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------

  private schedule(): void {
    if (!this.running) return;
    this.pumpTimer = setTimeout(async () => {
      try {
        // pollNext(timeout) 自带等待；单条处理，下一轮继续
        const event = await this.manager.pollNext(200);
        if (event) await this.ingest(event);
      } catch {
        // 源错误不终止泵
      }
      this.schedule();
    }, this.pollIntervalMs);
    this.pumpTimer.unref?.();
  }

  private isDuplicate(trigger: TriggerEvent): boolean {
    const key = `${trigger.source}:${trigger.origin}:${trigger.kind}`;
    const now = Date.now();
    const last = this.lastSeen.get(key);
    this.lastSeen.set(key, now);
    if (last !== undefined && now - last < this.debounceMs) return true;
    // 防内存增长：粗略清理过期键
    if (this.lastSeen.size > 500) {
      for (const [k, t] of this.lastSeen) {
        if (now - t > this.debounceMs * 10) this.lastSeen.delete(k);
      }
    }
    return false;
  }

  private consumeRateBudget(): boolean {
    const now = Date.now();
    if (now - this.minuteWindowStart >= 60_000) {
      this.minuteWindowStart = now;
      this.routedThisMinute = 0;
    }
    if (this.routedThisMinute >= this.maxPerMinute) return false;
    this.routedThisMinute++;
    return true;
  }
}

// ============================================================================
// 转换：UIEvent → TriggerEvent（无来源标注或 UI 内部事件返回 null）
// ============================================================================

/** FocusEvent 的 source 字段 → TriggerSourceKind 的白名单映射 */
const SOURCE_WHITELIST: ReadonlySet<string> = new Set(['file-watcher', 'http', 'websocket']);

export function toTriggerEvent(event: UIEvent): TriggerEvent | null {
  // 只处理带来源标注的 Focus 事件（三个环境事件源都包装成这种形态）
  if (event.type !== 'focus') return null;
  const focus = event as unknown as AnnotatedFocusEvent;
  if (!focus.source || !SOURCE_WHITELIST.has(focus.source)) return null;

  const source = focus.source as TriggerSourceKind;
  const data = focus.data as Record<string, unknown> | undefined;
  if (!data) return null;

  const timestamp = typeof data.timestamp === 'number' ? data.timestamp : Date.now();

  switch (source) {
    case 'file-watcher': {
      const filePath = String(data.path ?? '');
      if (!filePath) return null;
      const kind = String(data.type ?? 'change');
      return {
        id: `trg-${timestamp}-${rand()}`,
        source,
        origin: filePath,
        kind,
        summary: `文件${kind === 'rename' ? '重命名/增删' : '变更'}: ${filePath}`,
        payload: event,
        threadKey: `file:${filePath}`,
        timestamp,
      };
    }
    case 'websocket': {
      const origin = String(data.origin ?? 'unknown');
      const kind = String(data.type ?? 'message');
      const payload = typeof data.data === 'string' ? data.data.slice(0, 300) : '';
      return {
        id: `trg-${timestamp}-${rand()}`,
        source,
        origin,
        kind,
        summary: `WebSocket ${kind}: ${payload}`,
        payload: event,
        threadKey: `ws:${origin}`,
        timestamp,
      };
    }
    case 'http': {
      const method = String(data.method ?? 'GET');
      const path = String(data.path ?? '/');
      const query = data.query as Record<string, string> | undefined;
      const qs = query && Object.keys(query).length > 0 ? `?${new URLSearchParams(query).toString().slice(0, 120)}` : '';
      return {
        id: `trg-${timestamp}-${rand()}`,
        source,
        origin: `${method} ${path}`,
        kind: 'request',
        summary: `HTTP ${method} ${path}${qs}`,
        payload: event,
        threadKey: `http:${path}`,
        timestamp,
      };
    }
    default:
      return null;
  }
}

function rand(): string {
  return Math.random().toString(36).slice(2, 8);
}
