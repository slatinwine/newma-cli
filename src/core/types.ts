/**
 * Newma Core Types
 *
 * 基于 π (pi-mono) 框架思想的核心类型定义
 * 参考: https://github.com/badlogic/pi-mono
 */

// ============================================================================
// 核心事件类型
// ============================================================================

/**
 * 核心事件类型枚举
 */
export enum CoreEventType {
  // 用户交互
  USER_INPUT = 'user_input',
  USER_COMMAND = 'user_command',

  // AI 交互
  AI_REQUEST = 'ai_request',
  AI_RESPONSE = 'ai_response',
  AI_STREAM = 'ai_stream',
  AI_ERROR = 'ai_error',

  // 工具调用
  TOOL_CALL = 'tool_call',
  TOOL_RESULT = 'tool_result',
  TOOL_ERROR = 'tool_error',

  // 循环控制
  LOOP_START = 'loop_start',
  LOOP_ITERATION = 'loop_iteration',
  LOOP_END = 'loop_end',
  LOOP_ABORT = 'loop_abort',

  // 状态变化
  STATE_CHANGE = 'state_change',

  // 推理
  REASONING_START = 'reasoning_start',
  REASONING_END = 'reasoning_end',

  // 执行
  EXECUTION_START = 'execution_start',
  EXECUTION_END = 'execution_end',

  // 观测
  OBSERVATION_START = 'observation_start',
  OBSERVATION_END = 'observation_end',

  // 修复
  REPAIR_START = 'repair_start',
  REPAIR_END = 'repair_end',

  // Steering（中断/转向）
  STEER = 'steer',
  FOLLOW_UP = 'follow_up',

  // 错误
  ERROR = 'error',

  // 系统
  SYSTEM = 'system',
}

// ============================================================================
// 事件定义
// ============================================================================

/**
 * 事件基础接口
 */
export interface EventBase<T extends CoreEventType = CoreEventType, P = unknown> {
  /** 事件类型 */
  type: T;
  /** 事件负载 */
  payload: P;
  /** 时间戳 */
  timestamp: number;
  /** 事件唯一 ID */
  id: string;
  /** 关联的事件 ID（用于追踪） */
  correlationId?: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 用户输入事件
 */
export interface UserInputEvent extends EventBase<CoreEventType.USER_INPUT, {
  input: string;
  images?: Array<{ data: string; mimeType: string }>;
}> {}

/**
 * 用户命令事件
 */
export interface UserCommandEvent extends EventBase<CoreEventType.USER_COMMAND, {
  command: string;
  args: string[];
}> {}

/**
 * AI 请求事件
 */
export interface AIRequestEvent extends EventBase<CoreEventType.AI_REQUEST, {
  messages: AIMessage[];
  tools?: AITool[];
  context?: AgentContext;
}> {}

/**
 * AI 响应事件
 */
export interface AIResponseEvent extends EventBase<CoreEventType.AI_RESPONSE, {
  message: AIMessage;
  toolCalls?: AIToolCall[];
  reasoning?: string;
}> {}

/**
 * AI 流式事件
 */
export interface AIStreamEvent extends EventBase<CoreEventType.AI_STREAM, {
  delta: string;
  isComplete: boolean;
}> {}

/**
 * 工具调用事件
 */
export interface ToolCallEvent extends EventBase<CoreEventType.TOOL_CALL, {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}> {}

/**
 * 工具结果事件
 */
export interface ToolResultEvent extends EventBase<CoreEventType.TOOL_RESULT, {
  toolCallId: string;
  result: unknown;
  isError: boolean;
}> {}

/**
 * 循环开始事件
 */
export interface LoopStartEvent extends EventBase<CoreEventType.LOOP_START, {
  requirement: string;
  maxIterations: number;
}> {}

/**
 * 循环迭代事件
 */
export interface LoopIterationEvent extends EventBase<CoreEventType.LOOP_ITERATION, {
  iteration: number;
  phase: 'reasoning' | 'execution' | 'observation' | 'repair';
}> {}

/**
 * 循环结束事件
 */
export interface LoopEndEvent extends EventBase<CoreEventType.LOOP_END, {
  completed: boolean;
  iterations: number;
  reason: 'completed' | 'aborted' | 'error' | 'max_iterations';
}> {}

/**
 * 循环中断事件
 */
export interface LoopAbortEvent extends EventBase<CoreEventType.LOOP_ABORT, {
  reason: string;
}> {}

/**
 * AI 错误事件
 */
export interface AIErrorEvent extends EventBase<CoreEventType.AI_ERROR, {
  error: Error;
  requestId?: string;
}> {}

/**
 * 工具错误事件
 */
export interface ToolErrorEvent extends EventBase<CoreEventType.TOOL_ERROR, {
  toolCallId: string;
  toolName: string;
  error: Error;
}> {}

/**
 * 状态变化事件
 */
export interface StateChangeEvent extends EventBase<CoreEventType.STATE_CHANGE, {
  previousState: LoopState;
  currentState: LoopState;
  trigger: string;
}> {}

/**
 * Steering 事件（中断当前执行，转向新方向）
 */
export interface SteerEvent extends EventBase<CoreEventType.STEER, {
  message: string;
  priority: 'high' | 'normal' | 'low';
}> {}

/**
 * Follow-up 事件（当前执行完成后，继续执行）
 */
export interface FollowUpEvent extends EventBase<CoreEventType.FOLLOW_UP, {
  message: string;
}> {}

/**
 * 错误事件
 */
export interface ErrorEvent extends EventBase<CoreEventType.ERROR, {
  error: Error;
  context?: Record<string, unknown>;
  recoverable: boolean;
}> {}

/**
 * 联合事件类型
 */
export type CoreEvent =
  | UserInputEvent
  | UserCommandEvent
  | AIRequestEvent
  | AIResponseEvent
  | AIStreamEvent
  | AIErrorEvent
  | ToolCallEvent
  | ToolResultEvent
  | ToolErrorEvent
  | LoopStartEvent
  | LoopIterationEvent
  | LoopEndEvent
  | LoopAbortEvent
  | StateChangeEvent
  | SteerEvent
  | FollowUpEvent
  | ErrorEvent;

// ============================================================================
// AI 类型
// ============================================================================

/**
 * AI 消息角色
 */
export type AIMessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * AI 消息
 */
export interface AIMessage {
  role: AIMessageRole;
  content: string | AIContentBlock[];
  name?: string;
  toolCallId?: string;
  toolCalls?: AIToolCall[];
  timestamp?: number;
}

/**
 * AI 内容块
 */
export type AIContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolUseId: string; content: string; isError?: boolean };

/**
 * AI 工具定义
 */
export interface AITool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * AI 工具调用
 */
export interface AIToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

// ============================================================================
// 状态类型
// ============================================================================

/**
 * 循环状态枚举
 */
export enum LoopState {
  IDLE = 'idle',
  REASONING = 'reasoning',
  EXECUTING = 'executing',
  OBSERVING = 'observing',
  REPAIRING = 'repairing',
  COMPLETED = 'completed',
  ABORTED = 'aborted',
  ERROR = 'error',
}

/**
 * Agent 上下文
 */
export interface AgentContext {
  /** 系统提示 */
  systemPrompt?: string;
  /** 会话 ID */
  sessionId?: string;
  /** 项目根目录 */
  projectRoot: string;
  /** 配置 */
  config: Record<string, unknown>;
  /** 工具列表 */
  tools?: AITool[];
  /** 额外上下文 */
  extra?: Record<string, unknown>;
}

// ============================================================================
// 执行器类型
// ============================================================================

/**
 * 执行结果
 */
export interface ExecutorResult<T = unknown> {
  /** 是否成功 */
  success: boolean;
  /** 返回数据 */
  data?: T;
  /** 错误信息 */
  error?: Error;
  /** 触发的后续事件 */
  nextEvents?: CoreEvent[];
}

/**
 * 执行器上下文
 */
export interface ExecutorContext {
  /** 当前状态 */
  state: LoopState;
  /** Agent 上下文 */
  agentContext: AgentContext;
  /** 信号（用于中断） */
  signal?: AbortSignal;
}

// ============================================================================
// Agent 类型
// ============================================================================

/**
 * Agent 决策
 */
export interface AgentDecision {
  /** 决策类型 */
  type: 'action' | 'plan' | 'skip' | 'complete' | 'error';
  /** 要触发的事件 */
  events: CoreEvent[];
  /** 推理过程 */
  reasoning: string;
  /** 置信度 (0-1) */
  confidence?: number;
}

/**
 * Agent 推理结果
 */
export interface ReasoningResult {
  /** 推理步骤 */
  reasoning: string[];
  /** 置信度 */
  confidence: number;
  /** 计划 */
  plan: {
    description: string;
    actions: AIToolCall[];
  };
  /** 预期结果 */
  expectedOutcome: string;
  /** 潜在风险 */
  risks: string[];
}

/**
 * Agent 观测结果
 */
export interface ObservationResult {
  /** 是否满足需求 */
  satisfied: boolean;
  /** 观测到的状态 */
  observations: string[];
  /** 发现的问题 */
  issues: Issue[];
  /** 与预期的差距 */
  gaps: string[];
  /** 置信度 */
  confidence: number;
  /** 建议的下一步 */
  recommendation: 'continue' | 'repair' | 'replan' | 'complete';
}

/**
 * 问题
 */
export interface Issue {
  type: 'error' | 'warning' | 'inefficient' | 'missing' | 'conflict';
  severity: number;
  description: string;
  location?: string;
  suggestedFix?: string;
}

/**
 * Agent 修复结果
 */
export interface RepairResult {
  /** 是否需要修复 */
  needsRepair: boolean;
  /** 修复方案 */
  repairs: Repair[];
  /** 修复理由 */
  reasoning: string;
  /** 预期效果 */
  expectedOutcome: string;
  /** 是否需要重新规划 */
  shouldReplan: boolean;
}

/**
 * 修复
 */
export interface Repair {
  type: 'fix' | 'retry' | 'skip' | 'replan' | 'complete';
  targetAction?: AIToolCall;
  repairActions: AIToolCall[];
  explanation: string;
}
