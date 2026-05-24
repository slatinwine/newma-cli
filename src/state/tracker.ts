/**
 * State Tracker
 *
 * 状态追踪器 - 在旧系统中追踪执行状态
 * 提供与新状态机兼容的状态接口
 */

import { EventEmitter } from 'events';
import { LoopPhase } from './types';

// ============================================================================
// 执行阶段（旧系统）
// ============================================================================

/**
 * 执行阶段枚举（旧系统）
 */
export enum ExecutionStage {
  /** 空闲 */
  IDLE = 'idle',
  /** 规划中 */
  PLANNING = 'planning',
  /** 执行中 */
  EXECUTING = 'executing',
  /** 验证中 */
  VERIFYING = 'verifying',
  /** 已完成 */
  COMPLETED = 'completed',
  /** 错误 */
  ERROR = 'error',
}

// ============================================================================
// 状态转换记录
// ============================================================================

/**
 * 状态转换记录
 */
export interface StateTransitionRecord {
  /** 从状态 */
  from: ExecutionStage | LoopPhase;
  /** 到状态 */
  to: ExecutionStage | LoopPhase;
  /** 时间戳 */
  timestamp: number;
  /** 原因 */
  reason?: string;
  /** 额外数据 */
  extra?: Record<string, unknown>;
}

// ============================================================================
// 状态追踪器配置
// ============================================================================

/**
 * 状态追踪器配置
 */
export interface StateTrackerConfig {
  /** 是否启用详细日志 */
  debug?: boolean;
  /** 是否启用状态可视化 */
  enableVisualization?: boolean;
  /** 最大历史记录数 */
  maxHistory?: number;
}

// ============================================================================
// 状态追踪器
// ============================================================================

/**
 * 状态追踪器
 *
 * 追踪执行过程中的状态转换
 */
export class StateTracker extends EventEmitter {
  private currentStage: ExecutionStage;
  private previousStage?: ExecutionStage;
  private history: StateTransitionRecord[] = [];
  private startTime: number;
  private config: StateTrackerConfig;

  constructor(config: StateTrackerConfig = {}) {
    super();
    this.currentStage = ExecutionStage.IDLE;
    this.startTime = Date.now();
    this.config = {
      debug: false,
      enableVisualization: true,
      maxHistory: 100,
      ...config,
    };
  }

  // ============================================================================
  // 状态查询
  // ============================================================================

  /**
   * 获取当前阶段
   */
  getCurrentStage(): ExecutionStage {
    return this.currentStage;
  }

  /**
   * 获取前一个阶段
   */
  getPreviousStage(): ExecutionStage | undefined {
    return this.previousStage;
  }

  /**
   * 转换到 LoopPhase（兼容新系统）
   */
  getCurrentPhase(): LoopPhase {
    return this.mapStageToPhase(this.currentStage);
  }

  /**
   * 是否处于终态
   */
  isTerminal(): boolean {
    return (
      this.currentStage === ExecutionStage.COMPLETED ||
      this.currentStage === ExecutionStage.ERROR
    );
  }

  /**
   * 是否处于活动状态
   */
  isActive(): boolean {
    return !this.isTerminal() && this.currentStage !== ExecutionStage.IDLE;
  }

  // ============================================================================
  // 状态转换
  // ============================================================================

  /**
   * 转换到新状态
   */
  transition(
    to: ExecutionStage,
    reason?: string,
    extra?: Record<string, unknown>
  ): void {
    const previous = this.currentStage;

    // 记录转换
    const record: StateTransitionRecord = {
      from: previous,
      to,
      timestamp: Date.now(),
      reason,
      extra,
    };

    // 添加到历史
    this.history.push(record);
    if (this.history.length > (this.config.maxHistory || 100)) {
      this.history.shift();
    }

    // 更新状态
    this.previousStage = previous;
    this.currentStage = to;

    // 记录日志
    this.log(`State transition: ${previous} → ${to}${reason ? ` (${reason})` : ''}`);

    // 触发事件
    this.emit('state-change', record);
    this.emit(`state:${to}`, record);
  }

  /**
   * 重置到初始状态
   */
  reset(): void {
    this.transition(ExecutionStage.IDLE, 'reset');
    this.history = [];
    this.startTime = Date.now();
  }

  // ============================================================================
  // 便捷方法
  // ============================================================================

  /**
   * 进入规划状态
   */
  enterPlanning(reason?: string): void {
    this.transition(ExecutionStage.PLANNING, reason);
  }

  /**
   * 进入执行状态
   */
  enterExecuting(reason?: string): void {
    this.transition(ExecutionStage.EXECUTING, reason);
  }

  /**
   * 进入验证状态
   */
  enterVerifying(reason?: string): void {
    this.transition(ExecutionStage.VERIFYING, reason);
  }

  /**
   * 标记完成
   */
  complete(reason?: string): void {
    this.transition(ExecutionStage.COMPLETED, reason);
  }

  /**
   * 标记错误
   */
  error(error: Error | string, extra?: Record<string, unknown>): void {
    const errorMsg = typeof error === 'string' ? error : error.message;
    this.transition(ExecutionStage.ERROR, errorMsg, extra);
  }

  // ============================================================================
  // 历史和统计
  // ============================================================================

  /**
   * 获取转换历史
   */
  getHistory(): StateTransitionRecord[] {
    return [...this.history];
  }

  /**
   * 获取状态持续时间
   */
  getDuration(): number {
    return Date.now() - this.startTime;
  }

  /**
   * 获取当前状态的持续时间
   */
  getCurrentStateDuration(): number {
    if (this.history.length === 0) {
      return this.getDuration();
    }
    const lastRecord = this.history[this.history.length - 1];
    return Date.now() - lastRecord.timestamp;
  }

  /**
   * 统计各状态的访问次数
   */
  getStateStats(): Map<ExecutionStage, number> {
    const stats = new Map<ExecutionStage, number>();

    // 初始化计数
    for (const stage of Object.values(ExecutionStage)) {
      stats.set(stage, 0);
    }

    // 计算初始状态
    stats.set(ExecutionStage.IDLE, 1);

    // 统计历史记录
    for (const record of this.history) {
      const count = stats.get(record.to as ExecutionStage) || 0;
      stats.set(record.to as ExecutionStage, count + 1);
    }

    return stats;
  }

  // ============================================================================
  // 可视化
  // ============================================================================

  /**
   * 格式化状态信息
   */
  format(): string {
    const duration = this.getDuration();
    const stage = this.currentStage.toUpperCase();
    const stats = this.getStateStats();

    let output = `📊 State: ${stage}`;
    output += `\n   Duration: ${Math.floor(duration / 1000)}s`;
    output += `\n   Transitions: ${this.history.length}`;

    if (stats.size > 0) {
      output += '\n   Stats:';
      for (const [state, count] of stats.entries()) {
        if (count > 0) {
          output += `\n     - ${state}: ${count}`;
        }
      }
    }

    return output;
  }

  /**
   * 可视化状态转换历史
   */
  visualizeHistory(): string {
    if (this.history.length === 0) {
      return '📭 No state transitions yet';
    }

    let output = '📈 State Transition History:\n';
    output += '─'.repeat(50) + '\n';

    for (let i = 0; i < this.history.length; i++) {
      const record = this.history[i];
      const duration = i > 0
        ? record.timestamp - this.history[i - 1].timestamp
        : record.timestamp - this.startTime;

      output += `${i + 1}. ${record.from} → ${record.to}`;
      output += ` (${Math.floor(duration / 1000)}s)`;
      if (record.reason) {
        output += `\n   Reason: ${record.reason}`;
      }
      output += '\n';
    }

    output += '─'.repeat(50);
    return output;
  }

  // ============================================================================
  // 类型映射
  // ============================================================================

  /**
   * 将 ExecutionStage 映射到 LoopPhase
   */
  private mapStageToPhase(stage: ExecutionStage): LoopPhase {
    switch (stage) {
      case ExecutionStage.IDLE:
        return LoopPhase.IDLE;
      case ExecutionStage.PLANNING:
        return LoopPhase.REASONING;
      case ExecutionStage.EXECUTING:
        return LoopPhase.EXECUTING;
      case ExecutionStage.VERIFYING:
        return LoopPhase.OBSERVING;
      case ExecutionStage.COMPLETED:
        return LoopPhase.COMPLETED;
      case ExecutionStage.ERROR:
        return LoopPhase.ERROR;
      default:
        return LoopPhase.IDLE;
    }
  }

  // ============================================================================
  // 日志
  // ============================================================================

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[StateTracker]', ...args);
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建状态追踪器
 */
export function createStateTracker(config?: StateTrackerConfig): StateTracker {
  return new StateTracker(config);
}
