/**
 * Subtask Types
 * 并行 subagent 系统的子任务类型定义
 */

import { Action } from '../../types';

/**
 * 子任务状态
 */
export enum SubTaskStatus {
  PENDING = 'pending',           // 等待执行
  RUNNING = 'running',           // 执行中
  COMPLETED = 'completed',       // 已完成
  FAILED = 'failed',             // 执行失败
  CANCELLED = 'cancelled',       // 已取消
  BLOCKED = 'blocked'            // 被阻塞（等待依赖）
}

/**
 * Agent 类型
 */
export enum AgentType {
  CODE_ANALYSIS = 'code-analysis',         // 代码分析专家
  ARCHITECTURE = 'architecture',           // 架构设计专家
  IMPLEMENTATION = 'implementation',       // 实现专家
  TESTING = 'testing',                     // 测试专家
  DOCUMENTATION = 'documentation',         // 文档专家
  GENERAL = 'general'                      // 通用助手
}

/**
 * 子任务定义
 */
export interface SubTask {
  /**
   * 子任务 ID
   */
  id: string;

  /**
   * 子任务描述
   */
  description: string;

  /**
   * Agent 类型
   */
  agentType: AgentType;

  /**
   * 状态
   */
  status: SubTaskStatus;

  /**
   * 输入数据
   */
  input: {
    /**
     * 任务目标
     */
    goal: string;

    /**
     * 上下文信息
     */
    context?: any;

    /**
     * 相关文件列表
     */
    relatedFiles?: string[];

    /**
     * 约束条件
     */
    constraints?: string[];
  };

  /**
   * 输出结果
   */
  output?: {
    /**
     * 执行的操作
     */
    actions?: Action[];

    /**
     * 生成的文件
     */
    files?: string[];

    /**
     * 分析结果或建议
     */
    analysis?: string;

    /**
     * 错误信息（如果失败）
     */
    error?: string;

    /**
     * 原始响应
     */
    rawResponse?: any;
  };

  /**
   * 依赖的其他子任务 ID
   */
  dependencies: string[];

  /**
   * 执行开始时间
   */
  startedAt?: Date;

  /**
   * 执行结束时间
   */
  completedAt?: Date;

  /**
   * 执行时长（毫秒）
   */
  duration?: number;

  /**
   * Token 使用统计
   */
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };

  /**
   * 推理过程（AI 的思考步骤）
   */
  reasoning?: string[];

  /**
   * 工具调用记录
   */
  toolCalls?: ToolCallRecord[];

  /**
   * 创建时间
   */
  createdAt: Date;

  /**
   * 优先级（数字越大优先级越高）
   */
  priority: number;

  /**
   * 重试次数
   */
  retryCount: number;

  /**
   * 最大重试次数
   */
  maxRetries: number;
}

/**
 * 工具调用记录
 */
export interface ToolCallRecord {
  /**
   * 工具名称
   */
  tool: string;

  /**
   * 调用时间
   */
  timestamp: Date;

  /**
   * 输入参数
   */
  input: any;

  /**
   * 输出结果
   */
  output: any;

  /**
   * 执行时长（毫秒）
   */
  duration: number;

  /**
   * 是否成功
   */
  success: boolean;

  /**
   * 错误信息（如果失败）
   */
  error?: string;
}

/**
 * 子任务执行结果
 */
export interface SubTaskResult {
  /**
   * 子任务
   */
  task: SubTask;

  /**
   * 是否成功
   */
  success: boolean;

  /**
   * 结果摘要
   */
  summary: string;
}

/**
 * 并行执行配置
 */
export interface ParallelExecutionConfig {
  /**
   * 最大并行 subagent 数量
   * @default 5
   */
  maxSubagents?: number;

  /**
   * 单个子任务超时时间（毫秒）
   * @default 60000 (60s)
   */
  taskTimeout?: number;

  /**
   * 总体超时时间（毫秒）
   * @default 300000 (5min)
   */
  totalTimeout?: number;

  /**
   * 是否启用依赖管理
   * @default true
   */
  enableDependencies?: boolean;

  /**
   * 失败时是否继续执行其他任务
   * @default true
   */
  continueOnFailure?: boolean;

  /**
   * Agent 配置
   */
  agentConfigs?: Record<AgentType, AgentConfig>;
}

/**
 * Agent 配置
 */
export interface AgentConfig {
  /**
   * 是否启用
   */
  enabled: boolean;

  /**
   * 温度参数（控制创造性）
   */
  temperature?: number;

  /**
   * 最大迭代次数
   */
  maxIterations?: number;

  /**
   * 可用工具白名单
   */
  tools?: string[];

  /**
   * 系统提示词（可选）
   */
  systemPrompt?: string;
}

/**
 * 并行执行摘要
 */
export interface ParallelExecutionSummary {
  /**
   * 总子任务数
   */
  totalTasks: number;

  /**
   * 成功任务数
   */
  successfulTasks: number;

  /**
   * 失败任务数
   */
  failedTasks: number;

  /**
   * 总执行时长（毫秒）
   */
  totalDuration: number;

  /**
   * 总 Token 使用量
   */
  totalTokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };

  /**
   * 各 Agent 的执行时间
   */
  agentDurations: Record<AgentType, number>;

  /**
   * 所有子任务结果
   */
  results: SubTaskResult[];

  /**
   * 时间线（用于可视化）
   */
  timeline: TimelineEvent[];
}

/**
 * 时间线事件
 */
export interface TimelineEvent {
  /**
   * 时间戳
   */
  timestamp: Date;

  /**
   * 事件类型
   */
  type: 'task_started' | 'task_completed' | 'task_failed' | 'task_retry' | 'execution_started' | 'execution_finished';

  /**
   * 相关的子任务 ID
   */
  taskId?: string;

  /**
   * Agent 类型
   */
  agentType?: AgentType;

  /**
   * 事件描述
   */
  description: string;
}

/**
 * 任务分解器接口
 */
export interface TaskDecomposer {
  /**
   * 将需求分解为子任务
   */
  decompose(requirement: string, context: any): Promise<SubTask[]>;
}

/**
 * 结果聚合器接口
 */
export interface ResultAggregator {
  /**
   * 聚合多个子任务的结果
   */
  aggregate(results: SubTaskResult[]): Promise<any>;
}
