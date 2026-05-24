/**
 * Newma State Machine
 *
 * 状态机 - 管理循环状态转换
 */

import { EventEmitter } from 'events';
import { CoreEvent, CoreEventType } from '../core/types';
import {
  LoopPhase,
  StateMachineConfig,
  StateTransition,
  StateTransitionRule,
  StateSnapshot,
  StateMachineEvent,
  StateMachineEventType,
} from './types';

// ============================================================================
// 默认状态转换规则
// ============================================================================

/**
 * 创建默认的状态转换规则
 */
function createDefaultTransitions(): Map<LoopPhase, StateTransitionRule[]> {
  const map = new Map<LoopPhase, StateTransitionRule[]>();

  // IDLE 状态
  map.set(LoopPhase.IDLE, [
    {
      toState: LoopPhase.REASONING,
      allowedEvents: [CoreEventType.LOOP_START, CoreEventType.USER_INPUT],
    },
    {
      toState: LoopPhase.COMPLETED,
      allowedEvents: [CoreEventType.LOOP_END],
    },
  ]);

  // REASONING 状态
  map.set(LoopPhase.REASONING, [
    {
      toState: LoopPhase.EXECUTING,
      allowedEvents: [CoreEventType.AI_RESPONSE, CoreEventType.EXECUTION_START],
    },
    {
      toState: LoopPhase.ERROR,
      allowedEvents: [CoreEventType.ERROR, CoreEventType.AI_ERROR],
    },
    {
      toState: LoopPhase.ABORTED,
      allowedEvents: [CoreEventType.LOOP_ABORT, CoreEventType.STEER],
    },
  ]);

  // EXECUTING 状态
  map.set(LoopPhase.EXECUTING, [
    {
      toState: LoopPhase.OBSERVING,
      allowedEvents: [CoreEventType.EXECUTION_END, CoreEventType.TOOL_RESULT],
    },
    {
      toState: LoopPhase.ERROR,
      allowedEvents: [CoreEventType.ERROR, CoreEventType.TOOL_ERROR],
    },
    {
      toState: LoopPhase.ABORTED,
      allowedEvents: [CoreEventType.LOOP_ABORT, CoreEventType.STEER],
    },
  ]);

  // OBSERVING 状态
  map.set(LoopPhase.OBSERVING, [
    {
      toState: LoopPhase.REPAIRING,
      allowedEvents: [CoreEventType.OBSERVATION_END],
      condition: (state, event) => {
        const payload = event.payload as any;
        return payload?.needsRepair === true;
      },
    },
    {
      toState: LoopPhase.REASONING,
      allowedEvents: [CoreEventType.OBSERVATION_END],
      condition: (state, event) => {
        const payload = event.payload as any;
        return payload?.recommendation === 'continue';
      },
    },
    {
      toState: LoopPhase.COMPLETED,
      allowedEvents: [CoreEventType.OBSERVATION_END],
      condition: (state, event) => {
        const payload = event.payload as any;
        return payload?.satisfied === true || payload?.recommendation === 'complete';
      },
    },
    {
      toState: LoopPhase.ERROR,
      allowedEvents: [CoreEventType.ERROR],
    },
    {
      toState: LoopPhase.ABORTED,
      allowedEvents: [CoreEventType.LOOP_ABORT, CoreEventType.STEER],
    },
  ]);

  // REPAIRING 状态
  map.set(LoopPhase.REPAIRING, [
    {
      toState: LoopPhase.REASONING,
      allowedEvents: [CoreEventType.REPAIR_END],
      condition: (state, event) => {
        const payload = event.payload as any;
        return !payload?.shouldReplan;
      },
    },
    {
      toState: LoopPhase.IDLE,
      allowedEvents: [CoreEventType.REPAIR_END],
      condition: (state, event) => {
        const payload = event.payload as any;
        return payload?.shouldReplan === true;
      },
    },
    {
      toState: LoopPhase.COMPLETED,
      allowedEvents: [CoreEventType.REPAIR_END],
      condition: (state, event) => {
        const payload = event.payload as any;
        return payload?.type === 'complete';
      },
    },
    {
      toState: LoopPhase.ERROR,
      allowedEvents: [CoreEventType.ERROR],
    },
    {
      toState: LoopPhase.ABORTED,
      allowedEvents: [CoreEventType.LOOP_ABORT, CoreEventType.STEER],
    },
  ]);

  // ERROR 状态
  map.set(LoopPhase.ERROR, [
    {
      toState: LoopPhase.REASONING,
      allowedEvents: [CoreEventType.USER_INPUT],
    },
    {
      toState: LoopPhase.ABORTED,
      allowedEvents: [CoreEventType.LOOP_ABORT],
    },
    {
      toState: LoopPhase.COMPLETED,
      allowedEvents: [CoreEventType.LOOP_END],
    },
  ]);

  // 终态
  map.set(LoopPhase.COMPLETED, []);
  map.set(LoopPhase.ABORTED, []);

  return map;
}

const DEFAULT_TRANSITIONS = createDefaultTransitions();

// ============================================================================
// 状态机类
// ============================================================================

/**
 * 状态机
 */
export class StateMachine {
  private currentPhase: LoopPhase;
  private previousPhase?: LoopPhase;
  private iteration: number = 0;
  private maxIterations: number;
  private timeout?: number;
  private allowRecovery: boolean;
  private transitions: Map<LoopPhase, StateTransitionRule[]>;
  private eventHistory: CoreEvent[] = [];
  private emitter = new EventEmitter();
  private startTime?: number;

  constructor(config: StateMachineConfig) {
    this.currentPhase = config.initialState;
    this.maxIterations = config.maxIterations;
    this.timeout = config.timeout;
    this.allowRecovery = config.allowRecovery ?? true;
    this.transitions = config.transitions ?? DEFAULT_TRANSITIONS;
  }

  // ============================================================================
  // 状态查询
  // ============================================================================

  /**
   * 获取当前状态
   */
  getCurrentPhase(): LoopPhase {
    return this.currentPhase;
  }

  /**
   * 获取前一个状态
   */
  getPreviousPhase(): LoopPhase | undefined {
    return this.previousPhase;
  }

  /**
   * 获取迭代次数
   */
  getIteration(): number {
    return this.iteration;
  }

  /**
   * 是否处于终态
   */
  isTerminal(): boolean {
    return (
      this.currentPhase === LoopPhase.COMPLETED ||
      this.currentPhase === LoopPhase.ABORTED
    );
  }

  /**
   * 是否可以转换
   */
  canTransition(toState: LoopPhase): boolean {
    const rules = this.transitions.get(this.currentPhase) || [];
    return rules.some((rule) => rule.toState === toState);
  }

  /**
   * 获取允许的事件类型
   */
  getAllowedEvents(): CoreEventType[] {
    const rules = this.transitions.get(this.currentPhase) || [];
    const eventTypes = new Set<CoreEventType>();
    for (const rule of rules) {
      for (const eventType of rule.allowedEvents) {
        eventTypes.add(eventType);
      }
    }
    return Array.from(eventTypes);
  }

  // ============================================================================
  // 状态转换
  // ============================================================================

  /**
   * 尝试转换状态
   */
  transition(event: CoreEvent): StateTransition {
    // 如果已经是终态，不允许转换
    if (this.isTerminal()) {
      return {
        allowed: false,
        toState: this.currentPhase,
        reason: 'Already in terminal state',
        triggerEvent: event.type,
      };
    }

    // 查找匹配的转换规则
    const rules = this.transitions.get(this.currentPhase) || [];
    const matchingRule = rules.find((rule) => {
      // 检查事件类型是否匹配
      if (!rule.allowedEvents.includes(event.type)) {
        return false;
      }

      // 检查条件（如果有）
      if (rule.condition && !rule.condition(this.currentPhase, event)) {
        return false;
      }

      return true;
    });

    if (matchingRule) {
      // 执行转换
      const previousPhase = this.currentPhase;
      this.currentPhase = matchingRule.toState;
      this.previousPhase = previousPhase;
      this.eventHistory.push(event);

      // 发送状态变化事件
      this.emitStateChange(previousPhase, this.currentPhase, event);

      // 更新迭代计数
      this.updateIteration(previousPhase, this.currentPhase);

      return {
        allowed: true,
        toState: this.currentPhase,
        reason: `Transitioned from ${previousPhase} to ${this.currentPhase}`,
        triggerEvent: event.type,
      };
    }

    // 没有匹配的规则
    return {
      allowed: false,
      toState: this.currentPhase,
      reason: `No valid transition from ${this.currentPhase} for event ${event.type}`,
      triggerEvent: event.type,
    };
  }

  /**
   * 强制设置状态（跳过规则检查）
   */
  forceTransition(toState: LoopPhase, reason: string = 'forced'): void {
    const previousPhase = this.currentPhase;
    this.currentPhase = toState;
    this.previousPhase = previousPhase;
    this.emitStateChange(previousPhase, toState);
  }

  /**
   * 重置状态机
   */
  reset(): void {
    this.currentPhase = LoopPhase.IDLE;
    this.previousPhase = undefined;
    this.iteration = 0;
    this.eventHistory = [];
    this.startTime = Date.now();
    this.emitter.emit('reset');
  }

  // ============================================================================
  // 快照
  // ============================================================================

  /**
   * 创建快照
   */
  createSnapshot(): StateSnapshot {
    return {
      phase: this.currentPhase,
      iteration: this.iteration,
      timestamp: Date.now(),
      eventHistory: [...this.eventHistory],
    };
  }

  /**
   * 从快照恢复
   */
  restoreFromSnapshot(snapshot: StateSnapshot): void {
    this.currentPhase = snapshot.phase;
    this.iteration = snapshot.iteration;
    this.eventHistory = [...snapshot.eventHistory];
    this.emitter.emit('restored', snapshot);
  }

  // ============================================================================
  // 事件订阅
  // ============================================================================

  /**
   * 订阅状态变化
   */
  onStateChange(
    listener: (previous: LoopPhase, current: LoopPhase, event?: CoreEvent) => void
  ): () => void {
    this.emitter.on('state-change', listener);
    return () => this.emitter.off('state-change', listener);
  }

  /**
   * 订阅事件
   */
  on(event: string, listener: (...args: any[]) => void): () => void {
    this.emitter.on(event, listener);
    return () => this.emitter.off(event, listener);
  }

  // ============================================================================
  // 内部方法
  // ============================================================================

  private emitStateChange(
    previous: LoopPhase,
    current: LoopPhase,
    event?: CoreEvent
  ): void {
    const stateEvent: StateMachineEvent = {
      type: StateMachineEventType.STATE_CHANGE,
      payload: {
        previousState: previous,
        currentState: current,
      },
      timestamp: Date.now(),
    };

    this.emitter.emit('state-change', previous, current, event);
    this.emitter.emit('event', stateEvent);
  }

  private updateIteration(previous: LoopPhase, current: LoopPhase): void {
    // 每次从 EXECUTING -> OBSERVING 算一次迭代
    if (previous === LoopPhase.EXECUTING && current === LoopPhase.OBSERVING) {
      this.iteration++;

      this.emitter.emit('iteration-end', this.iteration);

      // 检查是否超过最大迭代次数
      if (this.iteration >= this.maxIterations) {
        this.forceTransition(LoopPhase.COMPLETED, 'max_iterations_reached');
      }
    }
  }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 创建状态机
 */
export function createStateMachine(
  options?: Partial<StateMachineConfig>
): StateMachine {
  return new StateMachine({
    initialState: LoopPhase.IDLE,
    maxIterations: 10,
    ...options,
  });
}

/**
 * 创建状态机配置
 */
export function createStateMachineConfig(
  options?: Partial<StateMachineConfig>
): StateMachineConfig {
  return {
    initialState: LoopPhase.IDLE,
    maxIterations: 10,
    ...options,
  };
}
