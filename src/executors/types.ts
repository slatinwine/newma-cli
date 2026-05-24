/**
 * Newma Executor Types
 *
 * 执行器类型定义
 */

import { CoreEvent, LoopState, AgentContext, ExecutorResult } from '../core/types';

// ============================================================================
// 执行器接口
// ============================================================================

/**
 * 执行器接口
 *
 * 执行器只做一件事：
 * - 接收事件
 * - 操作状态
 * - 返回结果
 */
export interface Executor<TEvent extends CoreEvent = CoreEvent, TData = unknown> {
  /** 执行器名称 */
  readonly name: string;

  /** 处理的事件类型 */
  readonly eventType: TEvent['type'];

  /** 事件类型列表（支持多种事件） */
  readonly eventTypes?: string[];

  /** 优先级（数字越小越优先） */
  readonly priority?: number;

  /** 是否启用 */
  enabled?: boolean;

  /**
   * 执行函数
   */
  execute(
    event: TEvent,
    context: ExecutorContext
  ): Promise<ExecutorResult<TData>>;
}

/**
 * 执行器上下文
 */
export interface ExecutorContext {
  /** 当前循环状态 */
  state: LoopState;

  /** Agent 上下文 */
  agentContext: AgentContext;

  /** 信号（用于中断） */
  signal?: AbortSignal;

  /** 额外参数 */
  extra?: Record<string, unknown>;
}

// ============================================================================
// 执行器结果
// ============================================================================

/**
 * 执行器成功结果
 */
export interface ExecutorSuccessResult<T = unknown> {
  success: true;
  data?: T;
  /** 触发的后续事件 */
  nextEvents?: CoreEvent[];
  /** 日志/消息 */
  message?: string;
}

/**
 * 执行器失败结果
 */
export interface ExecutorErrorResult {
  success: false;
  error: Error;
  /** 触发的后续事件 */
  nextEvents?: CoreEvent[];
  /** 是否可恢复 */
  recoverable?: boolean;
}

/**
 * 执行器结果（联合类型）
 */
export type ExecutorResultTyped<T = unknown> =
  | ExecutorSuccessResult<T>
  | ExecutorErrorResult;

// 从 core/types 导出 ExecutorResult
export type { ExecutorResult } from '../core/types';

// ============================================================================
// 执行器工厂
// ============================================================================

/**
 * 执行器工厂函数
 */
export type ExecutorFactory<TEvent extends CoreEvent = CoreEvent, TData = unknown> = (
  context: ExecutorContext
) => Executor<TEvent, TData>;

// ============================================================================
// 执行器中间件
// ============================================================================

/**
 * 执行器中间件
 */
export type ExecutorMiddleware = (
  executor: Executor,
  event: CoreEvent,
  context: ExecutorContext,
  next: (event: CoreEvent) => Promise<ExecutorResult>
) => Promise<ExecutorResult>;

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 创建成功结果
 */
export function success<T = unknown>(
  data?: T,
  options?: { nextEvents?: CoreEvent[]; message?: string }
): ExecutorSuccessResult<T> {
  return {
    success: true,
    data,
    ...options,
  };
}

/**
 * 创建失败结果
 */
export function failure(
  error: Error | string,
  options?: { recoverable?: boolean; nextEvents?: CoreEvent[] }
): ExecutorErrorResult {
  return {
    success: false,
    error: typeof error === 'string' ? new Error(error) : error,
    ...options,
  };
}
