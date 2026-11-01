/**
 * SpeculativeRunner — 投机执行（文章 3.4：Speculative Execution）
 *
 * 问题：等结果确定再动手，人类的等待与介入成本高。
 *
 * 方案：还不确定结果是否会被采用时，根据环境信号在后台提前尝试。
 * 「静默复现并修复」策略：
 * - 后台尝试复现问题并生成修复 → 确认问题存在且修复干净 → 才交付
 * - 否则全程保持安静（丢弃结果，只记录日志）
 *
 * 与 AsyncTaskRunner 的关系：本模块提供「是否交付」的判定语义，
 * 执行与取消复用 AsyncTaskRunner（文章 4.1 的异步底座）。
 */

import { EventEmitter } from 'events';
import type { AsyncTaskRunner } from './async-task-runner';

// ============================================================================
// Types
// ============================================================================

/** 投机尝试的结果。clean=true 才会交付——半成品修复宁可丢弃。 */
export interface SpeculativeAttempt {
  success: boolean;
  /** 给用户的结论（仅在交付时展示） */
  summary: string;
  detail?: string;
  /**
   * 结果是否干净可交付：修复是否通过验证、diff 是否可控、
   * 是否存在无法自证的副作用。由尝试逻辑自评。
   */
  clean: boolean;
}

export type SpeculativeOutcome =
  | { type: 'delivered'; label: string; attempt: SpeculativeAttempt; durationMs: number }
  | { type: 'discarded'; label: string; reason: string; durationMs: number };

export interface SpeculativeRunnerOptions {
  /** 交付前的最终把关（可选）：默认要求 attempt.success && attempt.clean */
  deliverGate?: (attempt: SpeculativeAttempt) => boolean;
}

// ============================================================================
// Runner
// ============================================================================

export class SpeculativeRunner extends EventEmitter {
  private readonly deliverGate: (attempt: SpeculativeAttempt) => boolean;

  constructor(private readonly tasks: AsyncTaskRunner, options: SpeculativeRunnerOptions = {}) {
    super();
    this.deliverGate = options.deliverGate ?? ((a) => a.success && a.clean);
  }

  /**
   * 发起一次投机尝试。立即返回，不阻塞调用方。
   *
   * @param label  任务标签（同时也是「保持安静」的日志标识）
   * @param attemptFn 后台尝试体。signal aborted（用户介入/过期）时尽快返回。
   */
  speculate(
    label: string,
    attemptFn: (signal: AbortSignal) => Promise<SpeculativeAttempt>
  ): { taskId: string } {
    const startedAt = Date.now();
    const handle = this.tasks.start(
      label,
      async (signal) => {
        const attempt = await attemptFn(signal);

        if (signal.aborted) {
          this.emitOutcome({ type: 'discarded', label, reason: '尝试期间被终止', durationMs: Date.now() - startedAt });
          return { success: false, summary: 'discarded (aborted)' };
        }

        if (this.deliverGate(attempt)) {
          this.emitOutcome({ type: 'delivered', label, attempt, durationMs: Date.now() - startedAt });
          return { success: true, summary: attempt.summary, detail: attempt.detail };
        }

        // 结果不干净：保持安静，丢弃
        this.emitOutcome({
          type: 'discarded',
          label,
          reason: attempt.success ? '结果未通过干净度检查' : '尝试失败',
          durationMs: Date.now() - startedAt,
        });
        return { success: false, summary: 'discarded' };
      },
      10 * 60 * 1000 // 投机尝试默认 10 分钟上限：过了就不再值得交付
    );

    return { taskId: handle.taskId };
  }

  private emitOutcome(outcome: SpeculativeOutcome): void {
    this.emit('outcome', outcome);
    // delivered 与 discarded 都发给宿主，但宿主侧约定：只有 delivered 才对用户可见
  }
}
