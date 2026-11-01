/**
 * ConfirmationQueue — 非阻塞确认队列
 *
 * 问题：SubAgentCoordinator 里 inquirer.prompt 是同步阻塞的，
 * Worker 等用户确认期间整个会话停摆——半双工的最大堵点。
 *
 * 方案（文章 4.1 全双工交互）：
 * - request() 立即返回一个 Promise + confirmationId，不阻塞调用方
 * - REPL / Router 随时通过 resolve() 决定批准或拒绝（如 `/confirm t1 yes`）
 * - 可选超时策略：超时后按 policy 自动批准或拒绝
 * - listPending() 供 /status 展示待确认项
 */

import { randomUUID } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface ConfirmationRequest {
  id: string;
  /** 需要确认的内容摘要（展示给用户） */
  title: string;
  /** 详细信息（diff、计划等，可选） */
  detail?: string;
  createdAt: number;
}

export type ConfirmationPolicy = 'wait' | 'auto-approve' | 'deny';

export interface ConfirmationQueueOptions {
  /** 超时毫秒数；0 = 永不超时 */
  timeoutMs?: number;
  /** 超时后的默认动作 */
  onTimeout?: ConfirmationPolicy;
}

// ============================================================================
// Queue
// ============================================================================

export class ConfirmationQueue {
  private pending = new Map<string, {
    request: ConfirmationRequest;
    resolve: (approved: boolean) => void;
    timer?: NodeJS.Timeout;
  }>();

  private readonly timeoutMs: number;
  private readonly onTimeout: ConfirmationPolicy;

  constructor(options: ConfirmationQueueOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 0;
    this.onTimeout = options.onTimeout ?? 'deny';
  }

  /**
   * 发起一次非阻塞确认。立即返回 Promise，调用方（Worker）在此等待，
   * 但会话主循环不被阻塞——其他输入照常处理。
   */
  request(title: string, detail?: string): { id: string; promise: Promise<boolean> } {
    const id = `conf-${randomUUID().slice(0, 8)}`;

    const promise = new Promise<boolean>((resolve) => {
      const entry: {
        request: ConfirmationRequest;
        resolve: (approved: boolean) => void;
        timer?: NodeJS.Timeout;
      } = {
        request: { id, title, detail, createdAt: Date.now() },
        resolve,
      };

      if (this.timeoutMs > 0) {
        entry.timer = setTimeout(() => {
          if (!this.pending.has(id)) return;
          this.pending.delete(id);
          resolve(this.onTimeout === 'auto-approve');
        }, this.timeoutMs);
        entry.timer.unref?.();
      }

      this.pending.set(id, entry);
    });

    return { id, promise };
  }

  /** 用户/上层作出决定。返回是否成功匹配到一个待确认项。 */
  resolve(id: string, approved: boolean): boolean {
    const entry = this.pending.get(id);
    if (!entry) return false;
    if (entry.timer) clearTimeout(entry.timer);
    this.pending.delete(id);
    entry.resolve(approved);
    return true;
  }

  /** 列出待确认项（REPL 展示「⚠️ 有 N 个确认等待处理」）。 */
  listPending(): ConfirmationRequest[] {
    return [...this.pending.values()].map((e) => ({ ...e.request }));
  }

  /** 会话退出时调用：按默认策略清空全部待确认项。 */
  dispose(): void {
    for (const [id, entry] of [...this.pending.entries()]) {
      if (entry.timer) clearTimeout(entry.timer);
      this.pending.delete(id);
      entry.resolve(this.onTimeout === 'auto-approve');
    }
  }
}

/**
 * 把队列适配成 SubAgentCoordinator 可用的确认回调签名。
 * REPL/Router 侧同时拿到 queue 引用，用 listPending()/resolve() 与用户交互。
 */
export function queueBasedConfirmation(queue: ConfirmationQueue) {
  return async (title: string, detail?: string): Promise<boolean> => {
    const { promise } = queue.request(title, detail);
    return promise;
  };
}
