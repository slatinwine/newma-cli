/**
 * Newma State Machine Types
 *
 * 状态机类型定义
 */

import { CoreEvent, CoreEventType } from '../core/types';

// ============================================================================
// 循环状态
// ============================================================================

/**
 * 循环状态枚举
 */
export enum LoopPhase {
  /** 空闲 */
  IDLE = 'idle',
  /** 推理中 */
  REASONING = 'reasoning',
  /** 执行中 */
  EXECUTING = 'executing',
  /** 观测中 */
  OBSERVING = 'observing',
  /** 修复中 */
  REPAIRING = 'repairing',
  /** 已完成 */
  COMPLETED = 'completed',
  /** 已中断 */
  ABORTED = 'aborted',
  /** 错误 */
  ERROR = 'error',
}

// ============================================================================
// 状态转换
// ============================================================================

/**
 * 状态转换结果
 */
export interface StateTransition {
  /** 是否允许转换 */
  allowed: boolean;
  /** 目标状态 */
  toState: LoopPhase;
  /** 转换原因 */
  reason?: string;
  /** 触发的事件 */
  triggerEvent?: CoreEventType;
}

/**
 * 状态转换规则
 */
export interface StateTransitionRule {
  /** 目标状态 */
  toState: LoopPhase;
  /** 允许的事件类型 */
  allowedEvents: CoreEventType[];
  /** 条件检查（可选） */
  condition?: (state: LoopPhase, event: CoreEvent) => boolean;
}

// ============================================================================
// 状态机配置
// ============================================================================

/**
 * 状态机配置
 */
export interface StateMachineConfig {
  /** 初始状态 */
  initialState: LoopPhase;
  /** 最大迭代次数 */
  maxIterations: number;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 是否允许从错误恢复 */
  allowRecovery?: boolean;
  /** 状态转换规则 */
  transitions?: Map<LoopPhase, StateTransitionRule[]>;
}

// ============================================================================
// 状态快照
// ============================================================================

/**
 * 状态快照（用于持久化和恢复）
 */
export interface StateSnapshot {
  /** 当前阶段 */
  phase: LoopPhase;
  /** 迭代次数 */
  iteration: number;
  /** 时间戳 */
  timestamp: number;
  /** 事件历史 */
  eventHistory: CoreEvent[];
  /** 用户数据 */
  userData?: Record<string, unknown>;
}

// ============================================================================
// 状态机事件
// ============================================================================

/**
 * 状态机事件类型
 */
export enum StateMachineEventType {
  /** 状态变化 */
  STATE_CHANGE = 'state_change',
  /** 迭代开始 */
  ITERATION_START = 'iteration_start',
  /** 迭代结束 */
  ITERATION_END = 'iteration_end',
  /** 循环完成 */
  LOOP_COMPLETE = 'loop_complete',
  /** 循环中断 */
  LOOP_ABORT = 'loop_abort',
  /** 错误 */
  ERROR = 'error',
}

/**
 * 状态机事件
 */
export interface StateMachineEvent {
  type: StateMachineEventType;
  payload: {
    previousState?: LoopPhase;
    currentState: LoopPhase;
    iteration?: number;
    reason?: string;
    error?: Error;
  };
  timestamp: number;
}
