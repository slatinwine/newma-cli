/**
 * Reasoning Process Memory - Type Definitions
 *
 * 推理过程记忆的类型定义
 */

/**
 * 推理步骤类型
 *
 * Phase 9.2: Added 'decision' type for FFT decision paths
 */
export type ReasoningStepType = 'analysis' | 'planning' | 'execution' | 'verification' | 'reflection' | 'decision';

/**
 * 推理步骤状态
 */
export type ReasoningStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

/**
 * 单个推理步骤
 */
export interface ReasoningStep {
  /**
   * 步骤 ID
   */
  id: string;

  /**
   * 步骤类型
   */
  type: ReasoningStepType;

  /**
   * 步骤描述
   */
  description: string;

  /**
   * 步骤内容（思考过程）
   */
  content: string;

  /**
   * 步骤状态
   */
  status: ReasoningStepStatus;

  /**
   * 时间戳
   */
  timestamp: string;

  /**
   * 父步骤 ID（用于构建推理树）
   */
  parentId?: string;

  /**
   * 子步骤 ID 列表
   */
  childIds: string[];

  /**
   * 依赖的其他步骤
   */
  dependencies: string[];

  /**
   * 结果（可选）
   */
  result?: {
    success: boolean;
    output?: string;
    error?: string;
    duration?: number;
  };

  /**
   * 元数据
   */
  metadata?: {
    algorithm?: string; // FFT, Landmark, ToT, etc.
    confidence?: number; // 0-1
    alternativeApproaches?: string[];
    toolsUsed?: string[];
    tokens?: number;
  };
}

/**
 * 推理链（完整的推理过程）
 */
export interface ReasoningChain {
  /**
   * 推理链 ID
   */
  id: string;

  /**
   * 关联的任务/需求
   */
  task: string;

  /**
   * 任务类型（plan, execute, verify等）
   */
  taskType: string;

  /**
   * 开始时间
   */
  startTime: string;

  /**
   * 结束时间
   */
  endTime?: string;

  /**
   * 推理链状态
   */
  status: 'in_progress' | 'completed' | 'failed' | 'interrupted';

  /**
   * 推理步骤列表（按顺序）
   */
  steps: ReasoningStep[];

  /**
   * 步骤索引（ID -> 步骤）
   */
  stepIndex: Record<string, ReasoningStep>;

  /**
   * 最终结果
   */
  finalResult?: {
    success: boolean;
    output?: string;
    error?: string;
    satisfaction?: number; // 0-1
  };

  /**
   * 学习到的模式
   */
  learnedPatterns?: {
    preferredAlgorithm?: string;
    commonMistakes?: string[];
    successfulStrategies?: string[];
    decisionFactors?: string[];
  };

  /**
   * 统计信息
   */
  stats: {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    totalDuration: number;
    averageStepDuration: number;
    totalTokens: number;
  };

  /**
   * 推理向量（用于相似性搜索）
   */
  reasoningVector?: {
    taskType: string;
    algorithms: string[];
    patterns: string[];
    approaches: string[];
  };
}

/**
 * 推理模式（从历史中学习到的）
 */
export interface ReasoningPattern {
  /**
   * 模式 ID
   */
  id: string;

  /**
   * 模式名称
   */
  name: string;

  /**
   * 模式描述
   */
  description: string;

  /**
   * 触发条件
   */
  triggerConditions: {
    taskTypes: string[];
    keywords: string[];
    complexity: 'simple' | 'medium' | 'complex';
  };

  /**
   * 推荐的推理方法
   */
  recommendedApproach: {
    algorithm: string;
    steps: string[];
    considerations: string[];
  };

  /**
   * 成功率（基于历史）
   */
  successRate: number;

  /**
   * 使用次数
   */
  usageCount: number;

  /**
   * 最后使用时间
   */
  lastUsed: string;

  /**
   * 示例任务
   */
  examples: string[];
}

/**
 * 推理存储
 */
export interface ReasoningStorage {
  /**
   * 所有推理链
   */
  chains: ReasoningChain[];

  /**
   * 学习到的模式
   */
  patterns: ReasoningPattern[];

  /**
   * 最后更新时间
   */
  lastUpdated: string;

  /**
   * 统计信息
   */
  stats: {
    totalChains: number;
    totalSteps: number;
    totalPatterns: number;
    averageChainLength: number;
    overallSuccessRate: number;
  };
}
