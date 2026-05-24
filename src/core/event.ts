/**
 * Newma Core Event Utilities
 *
 * 事件工具函数
 */

import {
  CoreEventType,
  CoreEvent,
  EventBase,
  UserInputEvent,
  UserCommandEvent,
  AIRequestEvent,
  AIResponseEvent,
  AIStreamEvent,
  ToolCallEvent,
  ToolResultEvent,
  LoopStartEvent,
  LoopIterationEvent,
  LoopEndEvent,
  StateChangeEvent,
  SteerEvent,
  FollowUpEvent,
  ErrorEvent,
  AIMessage,
  AITool,
  AIToolCall,
  LoopState,
  AgentContext,
} from './types';

// ============================================================================
// 事件 ID 生成器
// ============================================================================

let eventCounter = 0;

/**
 * 生成唯一事件 ID
 */
export function generateEventId(prefix: string = 'evt'): string {
  return `${prefix}_${Date.now()}_${++eventCounter}`;
}

/**
 * 生成关联 ID
 */
export function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// 事件工厂函数
// ============================================================================

/**
 * 创建基础事件
 */
function createEventBase<T extends CoreEventType, P>(
  type: T,
  payload: P,
  options?: {
    correlationId?: string;
    metadata?: Record<string, unknown>;
  }
): EventBase<T, P> {
  return {
    type,
    payload,
    timestamp: Date.now(),
    id: generateEventId(),
    correlationId: options?.correlationId,
    metadata: options?.metadata,
  };
}

/**
 * 创建用户输入事件
 */
export function createUserInputEvent(
  input: string,
  images?: Array<{ data: string; mimeType: string }>,
  options?: { correlationId?: string }
): UserInputEvent {
  return createEventBase(CoreEventType.USER_INPUT, { input, images }, options);
}

/**
 * 创建用户命令事件
 */
export function createUserCommandEvent(
  command: string,
  args: string[] = [],
  options?: { correlationId?: string }
): UserCommandEvent {
  return createEventBase(CoreEventType.USER_COMMAND, { command, args }, options);
}

/**
 * 创建 AI 请求事件
 */
export function createAIRequestEvent(
  messages: AIMessage[],
  tools?: AITool[],
  context?: AgentContext,
  options?: { correlationId?: string }
): AIRequestEvent {
  return createEventBase(CoreEventType.AI_REQUEST, { messages, tools, context }, options);
}

/**
 * 创建 AI 响应事件
 */
export function createAIResponseEvent(
  message: AIMessage,
  toolCalls?: AIToolCall[],
  reasoning?: string,
  options?: { correlationId?: string }
): AIResponseEvent {
  return createEventBase(
    CoreEventType.AI_RESPONSE,
    { message, toolCalls, reasoning },
    options
  );
}

/**
 * 创建 AI 流式事件
 */
export function createAIStreamEvent(
  delta: string,
  isComplete: boolean,
  options?: { correlationId?: string }
): AIStreamEvent {
  return createEventBase(CoreEventType.AI_STREAM, { delta, isComplete }, options);
}

/**
 * 创建工具调用事件
 */
export function createToolCallEvent(
  toolCallId: string,
  toolName: string,
  args: Record<string, unknown>,
  options?: { correlationId?: string }
): ToolCallEvent {
  return createEventBase(
    CoreEventType.TOOL_CALL,
    { toolCallId, toolName, args },
    options
  );
}

/**
 * 创建工具结果事件
 */
export function createToolResultEvent(
  toolCallId: string,
  result: unknown,
  isError: boolean = false,
  options?: { correlationId?: string }
): ToolResultEvent {
  return createEventBase(
    CoreEventType.TOOL_RESULT,
    { toolCallId, result, isError },
    options
  );
}

/**
 * 创建循环开始事件
 */
export function createLoopStartEvent(
  requirement: string,
  maxIterations: number = 10,
  options?: { correlationId?: string }
): LoopStartEvent {
  return createEventBase(
    CoreEventType.LOOP_START,
    { requirement, maxIterations },
    options
  );
}

/**
 * 创建循环迭代事件
 */
export function createLoopIterationEvent(
  iteration: number,
  phase: 'reasoning' | 'execution' | 'observation' | 'repair',
  options?: { correlationId?: string }
): LoopIterationEvent {
  return createEventBase(
    CoreEventType.LOOP_ITERATION,
    { iteration, phase },
    options
  );
}

/**
 * 创建循环结束事件
 */
export function createLoopEndEvent(
  completed: boolean,
  iterations: number,
  reason: 'completed' | 'aborted' | 'error' | 'max_iterations',
  options?: { correlationId?: string }
): LoopEndEvent {
  return createEventBase(
    CoreEventType.LOOP_END,
    { completed, iterations, reason },
    options
  );
}

/**
 * 创建状态变化事件
 */
export function createStateChangeEvent(
  previousState: LoopState,
  currentState: LoopState,
  trigger: string,
  options?: { correlationId?: string }
): StateChangeEvent {
  return createEventBase(
    CoreEventType.STATE_CHANGE,
    { previousState, currentState, trigger },
    options
  );
}

/**
 * 创建 Steering 事件
 */
export function createSteerEvent(
  message: string,
  priority: 'high' | 'normal' | 'low' = 'normal',
  options?: { correlationId?: string }
): SteerEvent {
  return createEventBase(CoreEventType.STEER, { message, priority }, options);
}

/**
 * 创建 Follow-up 事件
 */
export function createFollowUpEvent(
  message: string,
  options?: { correlationId?: string }
): FollowUpEvent {
  return createEventBase(CoreEventType.FOLLOW_UP, { message }, options);
}

/**
 * 创建错误事件
 */
export function createErrorEvent(
  error: Error,
  recoverable: boolean = false,
  context?: Record<string, unknown>,
  options?: { correlationId?: string }
): ErrorEvent {
  return createEventBase(
    CoreEventType.ERROR,
    { error, context, recoverable },
    options
  );
}

// ============================================================================
// 事件类型检查
// ============================================================================

/**
 * 检查事件类型
 */
export function isEventType<T extends CoreEventType>(
  event: CoreEvent,
  type: T
): event is CoreEvent & { type: T } {
  return event.type === type;
}

/**
 * 是否是用户事件
 */
export function isUserEvent(event: CoreEvent): boolean {
  return (
    event.type === CoreEventType.USER_INPUT ||
    event.type === CoreEventType.USER_COMMAND
  );
}

/**
 * 是否是 AI 事件
 */
export function isAIEvent(event: CoreEvent): boolean {
  return (
    event.type === CoreEventType.AI_REQUEST ||
    event.type === CoreEventType.AI_RESPONSE ||
    event.type === CoreEventType.AI_STREAM ||
    event.type === CoreEventType.AI_ERROR
  );
}

/**
 * 是否是工具事件
 */
export function isToolEvent(event: CoreEvent): boolean {
  return (
    event.type === CoreEventType.TOOL_CALL ||
    event.type === CoreEventType.TOOL_RESULT ||
    event.type === CoreEventType.TOOL_ERROR
  );
}

/**
 * 是否是循环控制事件
 */
export function isLoopControlEvent(event: CoreEvent): boolean {
  return (
    event.type === CoreEventType.LOOP_START ||
    event.type === CoreEventType.LOOP_ITERATION ||
    event.type === CoreEventType.LOOP_END ||
    event.type === CoreEventType.LOOP_ABORT
  );
}

/**
 * 是否是控制流事件（steering/follow-up）
 */
export function isControlFlowEvent(event: CoreEvent): boolean {
  return (
    event.type === CoreEventType.STEER ||
    event.type === CoreEventType.FOLLOW_UP
  );
}

// ============================================================================
// 事件过滤器
// ============================================================================

/**
 * 事件过滤器
 */
export type EventFilter = (event: CoreEvent) => boolean;

/**
 * 按类型过滤
 */
export function filterByType(...types: CoreEventType[]): EventFilter {
  return (event) => types.includes(event.type);
}

/**
 * 按时间范围过滤
 */
export function filterByTimeRange(start: number, end: number): EventFilter {
  return (event) => event.timestamp >= start && event.timestamp <= end;
}

/**
 * 按关联 ID 过滤
 */
export function filterByCorrelationId(correlationId: string): EventFilter {
  return (event) => event.correlationId === correlationId;
}

/**
 * 组合过滤器（AND）
 */
export function andFilter(...filters: EventFilter[]): EventFilter {
  return (event) => filters.every((f) => f(event));
}

/**
 * 组合过滤器（OR）
 */
export function orFilter(...filters: EventFilter[]): EventFilter {
  return (event) => filters.some((f) => f(event));
}
