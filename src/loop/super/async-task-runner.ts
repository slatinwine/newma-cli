/**
 * AsyncTaskRunner — 异步任务运行器（文章 4.1：异步 ReAct Loop）
 *
 * 问题：经典 ReAct Loop 中同步 run() 会阻塞整个会话，长耗时命令
 * （构建、测试、Ultrathink 推理 30-90s）执行期间无法响应新输入。
 *
 * 方案：全双工交互。
 * - start()  立即返回 Started 通知，后台执行，不阻塞调用方
 * - stop()   主动终止执行过久的后台任务（通过 AbortController）
 * - 完成后结果作为事件投递回会话（onEvent 回调 / EventEmitter）
 *
 * 用法：
 *   const runner = new AsyncTaskRunner();
 *   runner.onEvent(ev => renderToUI(ev));
 *   const { taskId } = runner.start('build', () => runBuild(signal));
 *   // ...会话继续响应其他输入...
 *   runner.stop(taskId);           // 可选：提前终止
 */

import { EventEmitter } from 'events';
import { WorkerTaskResult } from './types';

// ============================================================================
// Types
// ============================================================================

export type AsyncTaskState = 'running' | 'done' | 'failed' | 'cancelled';

/** 后台任务投递回会话的事件（由前端/REPL 渲染给用户） */
export type AsyncTaskEvent =
  | { type: 'started'; taskId: string; label: string; at: number }
  | { type: 'progress'; taskId: string; note: string; at: number }
  | { type: 'completed'; taskId: string; label: string; at: number; result: WorkerTaskResult; durationMs: number }
  | { type: 'failed'; taskId: string; label: string; at: number; error: string; durationMs: number }
  | { type: 'cancelled'; taskId: string; label: string; at: number; durationMs: number };

export interface AsyncTaskHandle {
  taskId: string;
  label: string;
  startedAt: number;
}

export interface AsyncTaskEntry {
  taskId: string;
  label: string;
  state: AsyncTaskState;
  startedAt: number;
  finishedAt?: number;
  abort: AbortController;
}

export interface AsyncTaskRunnerOptions {
  /** 同一标签是否允许并发跑多个实例（默认 false：重复 start 同名任务会复用/拒绝） */
  allowDuplicateLabels?: boolean;
  /** 任务级超时（毫秒），超时自动 cancel；0 表示不限制 */
  defaultTimeoutMs?: number;
}

// ============================================================================
// Runner
// ============================================================================

export class AsyncTaskRunner extends EventEmitter {
  private tasks = new Map<string, AsyncTaskEntry>();
  private seq = 0;
  private readonly allowDuplicateLabels: boolean;
  private readonly defaultTimeoutMs: number;

  constructor(options: AsyncTaskRunnerOptions = {}) {
    super();
    this.allowDuplicateLabels = options.allowDuplicateLabels ?? false;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 0;
  }

  /**
   * 启动后台任务，立即返回句柄（Started 通知）。
   *
   * @param label    任务标签（用于展示与去重）
   * @param fn       任务体。收到的 AbortSignal 与 stop() 联动；长耗时工具
   *                 应在内部轮询 signal 以支持真正的取消。
   * @param timeoutMs 任务级超时，覆盖 defaultTimeoutMs
   */
  start(
    label: string,
    fn: (signal: AbortSignal) => Promise<WorkerTaskResult>,
    timeoutMs?: number
  ): AsyncTaskHandle {
    if (!this.allowDuplicateLabels && this.findByLabel(label, 'running')) {
      throw new Error(`Task "${label}" is already running`);
    }

    const taskId = `task-${++this.seq}-${Date.now().toString(36)}`;
    const entry: AsyncTaskEntry = {
      taskId,
      label,
      state: 'running',
      startedAt: Date.now(),
      abort: new AbortController(),
    };
    this.tasks.set(taskId, entry);

    this.emitEvent({ type: 'started', taskId, label, at: entry.startedAt });

    // Fire-and-forget：失败绝不逃逸出 runner
    void this.execute(entry, fn, timeoutMs ?? this.defaultTimeoutMs);

    return { taskId, label, startedAt: entry.startedAt };
  }

  /** 主动终止任务（stop() 语义）。返回是否确实终止了一个 running 任务。 */
  stop(taskId: string): boolean {
    const entry = this.tasks.get(taskId);
    if (!entry || entry.state !== 'running') return false;
    entry.abort.abort(new Error('stopped by user'));
    return true;
  }

  /** 按标签终止（方便 REPL 里 `stop build` 这种用法）。 */
  stopByLabel(label: string): boolean {
    const entry = this.findByLabel(label, 'running');
    return entry ? this.stop(entry.taskId) : false;
  }

  /** 向后台任务投递一条进展事件（Worker 在长任务中随时调用）。 */
  progress(taskId: string, note: string): void {
    const entry = this.tasks.get(taskId);
    if (!entry || entry.state !== 'running') return;
    this.emitEvent({ type: 'progress', taskId, note, at: Date.now() });
  }

  /** 查询任务状态（/status 用）。 */
  get(taskId: string): Readonly<AsyncTaskEntry> | undefined {
    const entry = this.tasks.get(taskId);
    return entry ? { ...entry } : undefined;
  }

  findByLabel(label: string, state?: AsyncTaskState): AsyncTaskEntry | undefined {
    for (const entry of this.tasks.values()) {
      if (entry.label !== label) continue;
      if (state && entry.state !== state) continue;
      return entry;
    }
    return undefined;
  }

  /** 列出任务（可按状态过滤），按启动时间倒序。 */
  list(state?: AsyncTaskState): Readonly<AsyncTaskEntry>[] {
    const entries = [...this.tasks.values()];
    entries.sort((a, b) => b.startedAt - a.startedAt);
    return entries.filter((e) => !state || e.state === state).map((e) => ({ ...e }));
  }

  /** 终止全部 running 任务并清空记录（会话退出时调用）。 */
  async dispose(): Promise<void> {
    for (const entry of this.tasks.values()) {
      if (entry.state === 'running') {
        entry.abort.abort(new Error('runner disposed'));
      }
    }
    this.tasks.clear();
  }

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------

  private async execute(
    entry: AsyncTaskEntry,
    fn: (signal: AbortSignal) => Promise<WorkerTaskResult>,
    timeoutMs: number
  ): Promise<void> {
    let timeoutTimer: NodeJS.Timeout | undefined;

    if (timeoutMs > 0) {
      timeoutTimer = setTimeout(() => {
        if (entry.state === 'running') {
          entry.abort.abort(new Error(`timeout after ${timeoutMs}ms`));
        }
      }, timeoutMs);
      // 不让 timer 阻止进程退出
      timeoutTimer.unref?.();
    }

    try {
      const result = await fn(entry.abort.signal);
      if (entry.state !== 'running') return; // 已被 cancel：丢弃结果（投机语义）
      entry.state = 'done';
      entry.finishedAt = Date.now();
      this.emitEvent({
        type: 'completed',
        taskId: entry.taskId,
        label: entry.label,
        at: entry.finishedAt,
        result,
        durationMs: entry.finishedAt - entry.startedAt,
      });
    } catch (err: any) {
      if (entry.state !== 'running') return;
      entry.finishedAt = Date.now();
      const aborted = entry.abort.signal.aborted;
      const reason = aborted ? String(err?.message || err) : String(err?.message || err);
      entry.state = aborted && /stopped by user/.test(reason) ? 'cancelled' : 'failed';
      if (entry.state === 'cancelled') {
        this.emitEvent({
          type: 'cancelled',
          taskId: entry.taskId,
          label: entry.label,
          at: entry.finishedAt,
          durationMs: entry.finishedAt - entry.startedAt,
        });
      } else {
        entry.state = 'failed';
        this.emitEvent({
          type: 'failed',
          taskId: entry.taskId,
          label: entry.label,
          at: entry.finishedAt,
          error: reason,
          durationMs: entry.finishedAt - entry.startedAt,
        });
      }
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
    }
  }

  private emitEvent(event: AsyncTaskEvent): void {
    this.emit('task-event', event);
  }
}
