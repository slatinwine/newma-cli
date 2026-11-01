/**
 * SuperStateStore — 任务/Thread 状态持久化（文章 5.1：计算与状态分离）
 *
 * 问题：会话状态跟着进程同生共死，进程重启任务全丢——
 * 这是本地 Agent 无法「持久在线」的第一道墙。
 *
 * 方案（第一步）：把需要持久保存的状态（任务表、Thread 表）外置到
 * .kode/super/state.json；推进任务的计算（Router 进程）随时可重启替换，
 * 重启后 adoptPersistedTasks 恢复任务簿。
 *
 * 后续演进方向（本模块接口已预留）：状态入库（SQLite/云端），计算容器无状态化。
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { WorkerTask, Thread } from './types';
import type { SuperRouter } from './router-worker';
import type { TriggerRouter } from './trigger-router';

// ============================================================================
// Types
// ============================================================================

export interface SuperStateSnapshot {
  version: 1;
  savedAt: string;
  tasks: WorkerTask[];
  threads: Array<{ key: string; createdAt: number; subscriberWorkerIds: string[]; triggerIds: string[] }>;
}

export interface SuperStateStoreOptions {
  /** 状态文件目录（默认 <projectRoot>/.kode/super） */
  dir?: string;
  /** 变更后延迟落盘毫秒数（默认 2s，合并高频 task-updated） */
  debounceMs?: number;
}

// ============================================================================
// Store
// ============================================================================

export class SuperStateStore {
  private readonly dir: string;
  private readonly debounceMs: number;
  private saveTimer?: NodeJS.Timeout;
  private detachFns: Array<() => void> = [];

  constructor(dir: string, options: SuperStateStoreOptions = {}) {
    this.dir = dir;
    this.debounceMs = options.debounceMs ?? 2000;
  }

  get stateFile(): string {
    return join(this.dir, 'state.json');
  }

  // ------------------------------------------------------------------
  // 持久化（挂到 Router 上，task-updated 防抖落盘）
  // ------------------------------------------------------------------

  /** 挂载持久化：监听 Router 的 task-updated 事件，防抖后写入磁盘。 */
  attachTo(router: SuperRouter, triggerRouter?: TriggerRouter): void {
    const onUpdated = (): void => this.saveLater(router, triggerRouter);
    router.on('task-updated', onUpdated);
    router.on('task-created', onUpdated);
    this.detachFns.push(() => {
      router.off('task-updated', onUpdated);
      router.off('task-created', onUpdated);
    });
  }

  /** 立即保存当前快照。 */
  saveLater(router: SuperRouter, triggerRouter?: TriggerRouter): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined;
      try {
        this.saveNow(router, triggerRouter);
      } catch {
        // 落盘失败不阻塞主流程（下次变更会重试）
      }
    }, this.debounceMs);
    this.saveTimer.unref?.();
  }

  saveNow(router: SuperRouter, triggerRouter?: TriggerRouter): void {
    const snapshot = this.buildSnapshot(router, triggerRouter);
    this.writeAtomic(snapshot);
  }

  // ------------------------------------------------------------------
  // 恢复
  // ------------------------------------------------------------------

  /** 读取上次快照。文件不存在或损坏返回 null。 */
  load(): SuperStateSnapshot | null {
    if (!existsSync(this.stateFile)) return null;
    try {
      const raw = readFileSync(this.stateFile, 'utf8');
      const parsed = JSON.parse(raw) as SuperStateSnapshot;
      if (parsed.version !== 1) return null;
      return parsed;
    } catch {
      return null; // 损坏文件宁可当没有，不阻塞启动
    }
  }

  /** 便捷方法：load + router.adoptPersistedTasks。返回采纳的任务数。 */
  restoreInto(router: SuperRouter, triggerRouter?: TriggerRouter): number {
    const snapshot = this.load();
    if (!snapshot) return 0;
    const adopted = router.adoptPersistedTasks(snapshot.tasks);
    if (triggerRouter) {
      for (const t of snapshot.threads) {
        for (const workerId of t.subscriberWorkerIds) {
          triggerRouter.subscribe(t.key, workerId);
        }
      }
    }
    return adopted;
  }

  /** 会话退出时同步落盘并解除监听。 */
  async dispose(router?: SuperRouter, triggerRouter?: TriggerRouter): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = undefined;
    }
    if (router) {
      try {
        this.saveNow(router, triggerRouter);
      } catch {
        // 尽力而为
      }
    }
    for (const fn of this.detachFns) fn();
    this.detachFns = [];
  }

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------

  private buildSnapshot(router: SuperRouter, triggerRouter?: TriggerRouter): SuperStateSnapshot {
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      tasks: router.listTasks() as WorkerTask[],
      threads: triggerRouter
        ? [...triggerRouterListThreads(triggerRouter)].map(([key, thread]) => ({
            key,
            createdAt: thread.createdAt,
            subscriberWorkerIds: [...thread.subscriberWorkerIds],
            triggerIds: [...thread.triggerIds],
          }))
        : [],
    };
  }

  /** 原子写：先写 tmp 再 rename，避免写一半崩溃留下损坏文件。 */
  private writeAtomic(snapshot: SuperStateSnapshot): void {
    mkdirSync(this.dir, { recursive: true });
    const tmp = join(this.dir, `state.json.tmp-${process.pid}`);
    writeFileSync(tmp, JSON.stringify(snapshot, null, 2), 'utf8');
    renameSync(tmp, this.stateFile);
  }
}

/** TriggerRouter 未暴露线程迭代器，这里做类型安全的访问（threads 为私有 Map）。 */
function triggerRouterListThreads(router: TriggerRouter): Map<string, Thread> {
  return (router as unknown as { threads: Map<string, Thread> }).threads;
}

/** 目录便捷构造。 */
export function createStateStore(projectRoot: string, options?: SuperStateStoreOptions): SuperStateStore {
  const dir = options?.dir ?? join(projectRoot, '.kode', 'super');
  return new SuperStateStore(dir, options);
}
