/**
 * SuperRouter — 双层架构的全局协调层（文章 2.1 / 2.2 节）
 *
 * 职责边界（与常见 Agent Team 的区别）：
 * - Router 只承接人类交互与任务分派，不亲自执行具体任务
 * - Worker 上下文隔离、挂完整工具，只向 Router 汇报，不直接对外输出
 * - Router 忙时的 Trigger 自动积压，下一轮合并处理（Batching，文章 2.1）
 *
 * Worker 的具体执行通过注入的 WorkerExecutor 完成（可包装 ExecutionSubAgent、
 * 独立子进程或云端沙箱），本模块不关心执行细节，只管调度与状态。
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import {
  SuperRouterConfig,
  TriggerEvent,
  WorkerTask,
  WorkerTaskResult,
  ProgressRecord,
} from './types';
import { TriggerRouter } from './trigger-router';
import { ConfirmationQueue, ConfirmationPolicy } from './confirmation-queue';
import { AsyncTaskRunner, AsyncTaskEvent } from './async-task-runner';
import { Watchdog, WatchdogOptions } from './watchdog';

// ============================================================================
// Types
// ============================================================================

/** Worker 执行器：把任务交给真正的执行体（子进程 / SubAgent / 远程沙箱） */
export type WorkerExecutor = (
  task: WorkerTask,
  hooks: WorkerHooks
) => Promise<WorkerTaskResult>;

/** Worker 执行期间可用的汇报钩子 */
export interface WorkerHooks {
  /** 汇报进展（Watchdog 依据 + 进度事件） */
  reportProgress: (note: string, substantive?: boolean) => void;
  /** 请求用户确认（按 Router 的 confirmationPolicy 走 ConfirmationQueue） */
  requestConfirmation: (title: string, detail?: string) => Promise<boolean>;
  /** 任务被终止时为 true，长任务应轮询以支持取消 */
  signal: AbortSignal;
}

export interface SuperRouterEvents {
  /** 新任务进入队列 */
  'task-created': (task: WorkerTask) => void;
  /** 任务状态变化 */
  'task-updated': (task: WorkerTask) => void;
  /** Worker 向用户的汇报（Router 统一对外输出的唯一出口） */
  'worker-report': (payload: { taskId: string; summary: string; detail?: string; success: boolean }) => void;
  /** 需要用户确认 */
  'confirmation-requested': (payload: { id: string; title: string; detail?: string }) => void;
  /** Trigger 批量处理（调试/观测用） */
  'trigger-batch': (payload: { size: number; acted: number }) => void;
}

// ============================================================================
// Router
// ============================================================================

export class SuperRouter extends EventEmitter {
  private tasks = new Map<string, WorkerTask>();
  private pendingTriggers: TriggerEvent[] = [];
  private draining = false;
  private runningCount = 0;
  private seq = 0;

  private readonly maxBatchSize: number;
  private readonly maxConcurrentWorkers: number;
  private readonly confirmationPolicy: ConfirmationPolicy;
  private readonly actOnTriggers: boolean;

  readonly confirmations: ConfirmationQueue;
  readonly asyncTasks: AsyncTaskRunner;

  constructor(
    private readonly triggerRouter: TriggerRouter,
    private readonly executeWorker: WorkerExecutor,
    config: SuperRouterConfig = {}
  ) {
    super();
    this.maxBatchSize = config.maxBatchSize ?? 16;
    this.maxConcurrentWorkers = config.maxConcurrentWorkers ?? 4;
    this.confirmationPolicy = config.confirmationPolicy ?? 'wait';
    this.actOnTriggers = config.actOnTriggers ?? true;

    this.confirmations = new ConfirmationQueue();
    this.asyncTasks = new AsyncTaskRunner({ allowDuplicateLabels: true });

    // TriggerRouter 判定 act → 进 Router 的待处理队列（Batching）
    this.triggerRouter.on('act', ({ trigger }: { trigger: TriggerEvent }) => {
      if (this.actOnTriggers) this.pendingTriggers.push(trigger);
    });

    // 后台任务事件转发（异步 ReAct Loop 的 Started/Completed 投递回会话）
    this.asyncTasks.on('task-event', (ev: AsyncTaskEvent) => {
      this.emit('task-updated', ev);
    });
  }

  // ------------------------------------------------------------------
  // 人类入口：直接下达任务（用户指令）
  // ------------------------------------------------------------------

  /** 用户下达任务。立即入队并返回任务 ID，不阻塞调用方。 */
  submitUserTask(requirement: string, opts?: { threadKey?: string }): WorkerTask {
    const task = this.createTask(requirement, 'user', opts?.threadKey);
    void this.schedule();
    return task;
  }

  // ------------------------------------------------------------------
  // 事件入口：Trigger 批量处理（文章 2.1 的 Batching）
  // ------------------------------------------------------------------

  /**
   * 尝试处理积压的 Trigger。
   * 事件密集到达时无需逐条调用：积压的 Trigger 会在下一轮合并处理，
   * 单个决定分摊的调度开销随批量增大而下降。
   */
  async drainTriggers(): Promise<{ batched: number; acted: number }> {
    if (this.draining) return { batched: 0, acted: 0 };
    this.draining = true;
    try {
      let acted = 0;
      while (this.pendingTriggers.length > 0) {
        const batch = this.pendingTriggers.splice(0, this.maxBatchSize);
        for (const trigger of batch) {
          // 订阅直通的 Trigger：直接投给订阅 Worker 的任务上下文（此处简化为创建关联任务）
          const thread = this.triggerRouter.getThread(trigger.threadKey ?? TriggerRouter.defaultThreadKey(trigger));
          const direct = thread && thread.subscriberWorkerIds.size > 0;

          if (direct) {
            // 直通：不做新任务分派决策，只把事件转给已订阅的 Worker 任务
            const workerId = [...thread!.subscriberWorkerIds][0];
            const task = [...this.tasks.values()].find((t) => (t as any).workerId === workerId);
            if (task) {
              task.lastProgress = {
                at: Date.now(),
                note: `新事件直通: ${trigger.summary.slice(0, 80)}`,
                substantive: false,
              };
            }
            continue;
          }

          // 非直通：由 Trigger 创建新任务（文章 3.4「静默复现并修复」的入口）
          const requirement = `环境事件触发任务 [${trigger.source}:${trigger.origin}] ${trigger.summary}`;
          this.createTask(requirement, 'trigger', trigger.threadKey, trigger.id);
          acted++;
        }
        this.emit('trigger-batch', { size: batch.length, acted });
      }
      return { batched: this.pendingTriggers.length, acted };
    } finally {
      this.draining = false;
    }
  }

  // ------------------------------------------------------------------
  // 任务管理
  // ------------------------------------------------------------------

  getTask(id: string): Readonly<WorkerTask> | undefined {
    const t = this.tasks.get(id);
    return t ? { ...t } : undefined;
  }

  /**
   * 从持久化快照恢复任务（文章 5.1：计算与状态分离）。
   * - 中断时 running 的任务 → 标记 failed（执行体无法凭空续跑，如实标记）
   * - 尚未开始的 queued 任务 → 保留 queued，会被重新调度执行
   * 只应在 Router 刚创建、尚无活跃任务时调用。
   */
  adoptPersistedTasks(tasks: WorkerTask[]): number {
    let adopted = 0;
    for (const t of tasks) {
      if (this.tasks.has(t.id)) continue;
      const task: WorkerTask = { ...t };
      if (task.state === 'running' || task.state === 'awaiting-confirmation') {
        task.state = 'failed';
        task.error = '进程中断（由持久化状态恢复时标记）';
        task.finishedAt = task.finishedAt ?? Date.now();
      }
      this.tasks.set(task.id, task);
      adopted++;
      this.emit('task-updated', { ...task });
    }
    if (adopted > 0) void this.schedule();
    return adopted;
  }

  listTasks(state?: WorkerTask['state']): Readonly<WorkerTask>[] {
    const all = [...this.tasks.values()];
    return all.filter((t) => !state || t.state === state).map((t) => ({ ...t }));
  }

  /** 终止任务（同时终止其后台执行）。 */
  cancelTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task || (task.state !== 'queued' && task.state !== 'running' && task.state !== 'awaiting-confirmation')) {
      return false;
    }
    this.asyncTasks.stopByLabel(`worker:${id}`);
    task.state = 'cancelled';
    task.finishedAt = Date.now();
    this.emit('task-updated', { ...task });
    return true;
  }

  /** 用户对某个待确认项作出决定。 */
  resolveConfirmation(id: string, approved: boolean): boolean {
    return this.confirmations.resolve(id, approved);
  }

  listPendingConfirmations() {
    return this.confirmations.listPending();
  }

  /**
   * 给本 Router 挂载一个 Watchdog（文章第 6 节的外部 Control Loop）。
   * 通知经 worker-report 事件转发给用户；terminate 直接取消任务。
   * 返回 Watchdog 实例（已 start），调用方持有引用以便 stop()。
   */
  attachWatchdog(options: Omit<WatchdogOptions, 'logDir'> & { logDir?: string } = {}): Watchdog {
    const watchdog = new Watchdog(
      () => [...this.tasks.values()].map((t) => ({
        id: t.id,
        requirement: t.requirement,
        state: t.state,
        createdAt: t.createdAt,
        lastProgress: t.lastProgress,
      })),
      {
        notify: (message, taskId) => {
          this.emit('worker-report', { taskId, summary: message, success: false });
        },
        terminate: (taskId, reason) => {
          this.cancelTask(taskId);
          void reason;
        },
      },
      options
    );
    watchdog.start();
    return watchdog;
  }

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------

  private createTask(
    requirement: string,
    origin: 'user' | 'trigger',
    threadKey?: string,
    triggerId?: string
  ): WorkerTask {
    const task: WorkerTask = {
      id: `task-${++this.seq}-${randomUUID().slice(0, 6)}`,
      requirement,
      origin,
      threadKey,
      triggerId,
      state: 'queued',
      createdAt: Date.now(),
    };
    this.tasks.set(task.id, task);
    this.emit('task-created', { ...task });
    return task;
  }

  /** 调度循环：把 queued 任务交给空闲的 Worker 槽位。 */
  private async schedule(): Promise<void> {
    while (true) {
      const queued = [...this.tasks.values()].find((t) => t.state === 'queued');
      if (!queued || this.runningCount >= this.maxConcurrentWorkers) return;

      queued.state = 'running';
      queued.startedAt = Date.now();
      this.runningCount++;
      this.emit('task-updated', { ...queued });

      void this.runWorker(queued);
    }
  }

  private async runWorker(task: WorkerTask): Promise<void> {
    const workerId = `worker-${task.id}`;

    // 若任务来自 Trigger，自动让 Worker 订阅对应 Thread（订阅直通）
    if (task.threadKey) {
      this.triggerRouter.subscribe(task.threadKey, workerId);
    }

    const hooks: WorkerHooks = {
      reportProgress: (note, substantive = true) => {
        task.lastProgress = { at: Date.now(), note, substantive } satisfies ProgressRecord;
      },
      requestConfirmation: async (title, detail) => {
        if (this.confirmationPolicy === 'auto-approve') return true;
        if (this.confirmationPolicy === 'deny') return false;
        task.state = 'awaiting-confirmation';
        this.emit('task-updated', { ...task });
        const { id, promise } = this.confirmations.request(title, detail);
        this.emit('confirmation-requested', { id, title, detail });
        const approved = await promise;
        task.state = 'running';
        this.emit('task-updated', { ...task });
        return approved;
      },
      signal: new AbortController().signal, // 占位：真正的取消经 asyncTasks.stop 传播
    };

    try {
      const result = await this.executeWorker(task, hooks);

      task.state = result.success ? 'done' : 'failed';
      task.finishedAt = Date.now();
      task.result = result;
      if (!result.success) task.error = result.summary;

      // Router 统一对外输出：Worker 的结论只经这里出去（多信道规范在此定制）
      this.emit('worker-report', {
        taskId: task.id,
        summary: result.summary,
        detail: result.detail,
        success: result.success,
      });
    } catch (err: any) {
      task.state = 'failed';
      task.finishedAt = Date.now();
      task.error = String(err?.message || err);
      this.emit('worker-report', {
        taskId: task.id,
        summary: task.error,
        success: false,
      });
    } finally {
      this.runningCount--;
      if (task.threadKey) {
        this.triggerRouter.unsubscribe(task.threadKey, workerId);
      }
      this.emit('task-updated', { ...task });
      void this.schedule(); // 槽位释放，继续调度
    }
  }
}
