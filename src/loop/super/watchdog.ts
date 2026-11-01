/**
 * Watchdog — 外部控制回路（文章第 6 节）
 *
 * 问题：长期运行的 Agent 不只面临进程崩溃，更多是「模型陷入无效循环或
 * 偏离目标」这类业务级异常——传统存活探测发现不了。
 *
 * 方案：在主系统之外放一个独立的定时驱动 Watchdog，构成外部 Control Loop：
 * - 程序层启发式（零成本）：超过 N 分钟无【实质性】进展记录 → stalled
 * - LLM 判断（可选）：结合任务描述与进展历史判断是否 off-track
 * - 判定动作：notify（通知用户）/ terminate（终止任务）
 * - 判定历史落盘到 .kode/watchdog/，供事后自然语言追问
 */

import { EventEmitter } from 'events';
import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { WatchdogVerdict, WorkerTask } from './types';

// ============================================================================
// Types
// ============================================================================

/** Watchdog 观察的任务快照（由宿主提供，避免与 Router 强耦合） */
export interface WatchdogTaskSnapshot {
  id: string;
  requirement: string;
  state: WorkerTask['state'];
  createdAt: number;
  lastProgress?: { at: number; note: string; substantive: boolean };
}

/** LLM 判定器：输入任务与进展，输出 off-track / failed 判断 */
export type WatchdogLLMJudge = (
  task: WatchdogTaskSnapshot,
  recentNotes: string[]
) => Promise<{ status: 'stalled' | 'off-track' | 'failed' | 'healthy'; reason: string }>;

export interface WatchdogOptions {
  /** 检查间隔（毫秒），默认 10 分钟 */
  intervalMs?: number;
  /** 无实质进展多久判定 stalled（毫秒），默认 15 分钟 */
  stalledAfterMs?: number;
  /** 任务最长运行时间（毫秒），超时直接 terminate；0 = 不限制 */
  maxTaskDurationMs?: number;
  /** 是否启用 LLM 精判（对启发式判定为 stalled 的任务做二次确认） */
  llmJudge?: WatchdogLLMJudge;
  /** 判定历史目录（默认 <projectRoot>/.kode/watchdog） */
  logDir?: string;
  /** 观察哪些状态的任务（默认 running + awaiting-confirmation） */
  watchedStates?: WorkerTask['state'][];
}

// ============================================================================
// Watchdog
// ============================================================================

export class Watchdog extends EventEmitter {
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly intervalMs: number;
  private readonly stalledAfterMs: number;
  private readonly maxTaskDurationMs: number;
  private readonly llmJudge?: WatchdogLLMJudge;
  private readonly logDir?: string;
  private readonly watchedStates: Set<WorkerTask['state']>;
  private verdictCounts = new Map<WatchdogVerdict['status'], number>();

  constructor(
    private readonly getTasks: () => WatchdogTaskSnapshot[],
    private readonly actions: {
      /** 发通知给用户（Router 统一转发到交互信道） */
      notify: (message: string, taskId: string) => void;
      /** 终止任务 */
      terminate: (taskId: string, reason: string) => void;
    },
    options: WatchdogOptions = {}
  ) {
    super();
    this.intervalMs = options.intervalMs ?? 10 * 60 * 1000;
    this.stalledAfterMs = options.stalledAfterMs ?? 15 * 60 * 1000;
    this.maxTaskDurationMs = options.maxTaskDurationMs ?? 0;
    this.llmJudge = options.llmJudge;
    this.logDir = options.logDir;
    this.watchedStates = new Set(options.watchedStates ?? ['running', 'awaiting-confirmation']);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    if (this.logDir) {
      try {
        mkdirSync(this.logDir, { recursive: true });
      } catch {
        // 日志目录创建失败不阻塞 Watchdog 运行
      }
    }
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref?.(); // 不阻止进程退出
    this.emit('started', { intervalMs: this.intervalMs });
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.running = false;
    this.emit('stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  getStats(): Record<string, number> {
    return Object.fromEntries(this.verdictCounts);
  }

  /** 执行一轮检查（也可手动触发，供测试与 /status 使用）。 */
  async tick(): Promise<WatchdogVerdict[]> {
    if (!this.running) return [];
    const now = Date.now();
    const verdicts: WatchdogVerdict[] = [];

    for (const task of this.getTasks()) {
      if (!this.watchedStates.has(task.state)) continue;

      // 启发式 1：任务超长
      if (this.maxTaskDurationMs > 0 && now - task.createdAt > this.maxTaskDurationMs) {
        verdicts.push(this.judge(task, 'failed', `运行超过上限 ${Math.round(this.maxTaskDurationMs / 60000)} 分钟`, 'terminate'));
        continue;
      }

      // 启发式 2：无实质性进展
      const lastAt = task.lastProgress?.at ?? task.createdAt;
      const silenceMs = now - lastAt;
      const noSubstantive = !task.lastProgress?.substantive;

      if (silenceMs > this.stalledAfterMs) {
        if (this.llmJudge) {
          // LLM 二次确认：区分「正常长任务」与「真的卡死/跑偏」
          try {
            const recent = task.lastProgress ? [task.lastProgress.note] : [];
            const judged = await this.llmJudge(task, recent);
            verdicts.push(this.judge(task, judged.status, judged.reason, judged.status === 'healthy' ? 'none' : 'notify'));
          } catch {
            // LLM 不可用时退回启发式结论
            verdicts.push(this.judge(task, 'stalled', `超过 ${Math.round(silenceMs / 60000)} 分钟无实质进展（LLM 精判不可用）`, 'notify'));
          }
        } else {
          const status: WatchdogVerdict['status'] = noSubstantive && silenceMs > this.stalledAfterMs * 2 ? 'stalled' : 'stalled';
          verdicts.push(this.judge(task, status, `超过 ${Math.round(silenceMs / 60000)} 分钟无实质进展`, 'notify'));
        }
      }
    }

    for (const v of verdicts) {
      this.verdictCounts.set(v.status, (this.verdictCounts.get(v.status) ?? 0) + 1);
      this.emit('verdict', v);

      if (v.action === 'notify') {
        this.actions.notify(`Watchdog: 任务 ${v.taskId} 判定为 ${v.status} — ${v.reason}`, v.taskId);
      } else if (v.action === 'terminate') {
        this.actions.terminate(v.taskId, v.reason);
      }
      this.logVerdict(v);
    }

    return verdicts;
  }

  private judge(task: WatchdogTaskSnapshot, status: WatchdogVerdict['status'], reason: string, action: WatchdogVerdict['action']): WatchdogVerdict {
    return { taskId: task.id, status, reason, action };
  }

  private logVerdict(v: WatchdogVerdict): void {
    if (!this.logDir) return;
    try {
      const line = JSON.stringify({ ...v, at: new Date().toISOString() }) + '\n';
      appendFileSync(join(this.logDir, 'verdicts.jsonl'), line, 'utf8');
    } catch {
      // 日志失败不影响主流程
    }
  }
}
