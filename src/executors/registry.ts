/**
 * Newma Executor Registry
 *
 * 执行器注册中心 - 管理所有执行器
 */

import { CoreEvent, CoreEventType } from '../core/types';
import { Executor, ExecutorContext, ExecutorMiddleware, ExecutorResult } from './types';

// ============================================================================
// 执行器注册项
// ============================================================================

/**
 * 执行器注册项
 */
interface ExecutorEntry {
  executor: Executor;
  priority: number;
}

// ============================================================================
// 执行器注册中心
// ============================================================================

/**
 * 执行器注册中心
 */
export class ExecutorRegistry {
  private executors: Map<CoreEventType, ExecutorEntry[]> = new Map();
  private middlewares: ExecutorMiddleware[] = [];
  private globalMiddlewares: ExecutorMiddleware[] = [];

  // ============================================================================
  // 注册
  // ============================================================================

  /**
   * 注册执行器
   */
  register(executor: Executor): () => void {
    const eventTypes = executor.eventTypes || [executor.eventType];

    for (const eventType of eventTypes) {
      const key = eventType as CoreEventType;
      if (!this.executors.has(key)) {
        this.executors.set(key, []);
      }

      const entries = this.executors.get(key)!;
      const entry: ExecutorEntry = {
        executor,
        priority: executor.priority ?? 100,
      };

      entries.push(entry);
      entries.sort((a, b) => a.priority - b.priority);
    }

    // 返回注销函数
    return () => this.unregister(executor);
  }

  /**
   * 批量注册执行器
   */
  registerAll(executors: Executor[]): () => void {
    const unregisters = executors.map((e) => this.register(e));
    return () => unregisters.forEach((u) => u());
  }

  /**
   * 注销执行器
   */
  unregister(executor: Executor): void {
    const eventTypes = executor.eventTypes || [executor.eventType];

    for (const eventType of eventTypes) {
      const key = eventType as CoreEventType;
      const entries = this.executors.get(key);
      if (entries) {
        const index = entries.findIndex((e) => e.executor === executor);
        if (index !== -1) {
          entries.splice(index, 1);
        }
      }
    }
  }

  /**
   * 注销所有执行器
   */
  clear(): void {
    this.executors.clear();
  }

  // ============================================================================
  // 中间件
  // ============================================================================

  /**
   * 添加执行器中间件（针对特定执行器）
   */
  use(middleware: ExecutorMiddleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * 添加全局中间件（所有执行器）
   */
  useGlobal(middleware: ExecutorMiddleware): void {
    this.globalMiddlewares.push(middleware);
  }

  // ============================================================================
  // 执行
  // ============================================================================

  /**
   * 执行事件
   */
  async execute(
    event: CoreEvent,
    context: ExecutorContext
  ): Promise<ExecutorResult> {
    const entries = this.executors.get(event.type) || [];

    if (entries.length === 0) {
      // 没有注册的执行器
      return { success: true };
    }

    let lastResult: ExecutorResult = { success: true };

    for (const { executor } of entries) {
      if (executor.enabled === false) {
        continue;
      }

      // 应用中间件
      lastResult = await this.executeWithMiddleware(executor, event, context);
    }

    return lastResult;
  }

  /**
   * 使用中间件执行
   */
  private async executeWithMiddleware(
    executor: Executor,
    event: CoreEvent,
    context: ExecutorContext
  ): Promise<ExecutorResult> {
    // 构建中间件链
    const middlewares = [...this.globalMiddlewares, ...this.middlewares];
    let index = 0;

    const next = async (evt: CoreEvent): Promise<ExecutorResult> => {
      if (index < middlewares.length) {
        const middleware = middlewares[index++];
        return middleware(executor, evt, context, next);
      }
      return executor.execute(evt, context);
    };

    return next(event);
  }

  // ============================================================================
  // 查询
  // ============================================================================

  /**
   * 获取事件类型对应的所有执行器
   */
  getExecutors(eventType: CoreEventType): Executor[] {
    const entries = this.executors.get(eventType) || [];
    return entries.map((e) => e.executor);
  }

  /**
   * 检查是否有执行器
   */
  hasExecutor(eventType: CoreEventType): boolean {
    const entries = this.executors.get(eventType);
    return entries !== undefined && entries.length > 0;
  }

  /**
   * 获取所有已注册的事件类型
   */
  getRegisteredEventTypes(): CoreEventType[] {
    return Array.from(this.executors.keys());
  }
}

// ============================================================================
// 全局注册中心
// ============================================================================

/**
 * 全局执行器注册中心
 */
export const globalExecutorRegistry = new ExecutorRegistry();

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建执行器注册中心
 */
export function createExecutorRegistry(): ExecutorRegistry {
  return new ExecutorRegistry();
}

/**
 * 注册执行器到全局注册中心
 */
export function registerExecutor(executor: Executor): () => void {
  return globalExecutorRegistry.register(executor);
}

/**
 * 执行事件（使用全局注册中心）
 */
export async function executeEvent(
  event: CoreEvent,
  context: ExecutorContext
): Promise<ExecutorResult> {
  return globalExecutorRegistry.execute(event, context);
}
