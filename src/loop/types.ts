/**
 * Kode 四步循环架构类型定义
 *
 * 循环流程：推理 → 执行 → 观测 → 修复 → 推理...
 */

/**
 * 推理结果
 * AI 分析需求，生成推理和行动计划
 */
export interface ReasoningResult {
  /** 推理过程（思考步骤） */
  reasoning: string[];
  /** 置信度 (0-1) */
  confidence: number;
  /** 计划的步骤 */
  plan: {
    /** 步骤描述 */
    description: string;
    /** 要执行的操作 */
    actions: Action[];
  };
  /** 预期结果 */
  expectedOutcome: string;
  /** 潜在风险 */
  risks: string[];
}

/**
 * 执行结果
 * 执行计划后的结果
 */
export interface ExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** 已执行的操作 */
  executedActions: ExecutedAction[];
  /** 输出内容 */
  outputs: string[];
  /** 错误信息 */
  errors: ExecutionError[];
  /** 执行耗时（毫秒） */
  duration: number;
  /** 附加元数据 */
  metadata?: Record<string, any>;
}

/**
 * 已执行的操作
 */
export interface ExecutedAction {
  /** 操作类型 */
  action: Action;
  /** 执行状态 */
  status: 'success' | 'failed' | 'partial';
  /** 输出 */
  output?: string;
  /** 错误信息 */
  error?: string;
  /** 耗时（毫秒） */
  duration: number;
}

/**
 * 执行错误
 */
export interface ExecutionError {
  /** 错误类型 */
  type: 'syntax' | 'runtime' | 'logic' | 'external' | 'unknown';
  /** 错误消息 */
  message: string;
  /** 相关操作 */
  relatedAction?: Action;
  /** 错误堆栈 */
  stack?: string;
}

/**
 * 观测结果
 * 分析执行结果，判断是否需要修复
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
  /** 置信度 (0-1) */
  confidence: number;
  /** 建议的下一步 */
  recommendation: 'continue' | 'repair' | 'replan' | 'complete';
}

/**
 * 发现的问题
 */
export interface Issue {
  /** 问题类型 */
  type: 'error' | 'warning' | 'inefficient' | 'missing' | 'conflict';
  /** 严重程度 (1-5) */
  severity: number;
  /** 问题描述 */
  description: string;
  /** 相关文件/代码 */
  location?: string;
  /** 建议的修复方案 */
  suggestedFix?: string;
}

/**
 * 修复结果
 * 基于观测结果，生成修复方案
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
 * 修复方案
 */
export interface Repair {
  /** 修复类型 */
  type: 'fix' | 'retry' | 'skip' | 'replan' | 'complete';
  /** 目标操作 */
  targetAction?: Action;
  /** 修复操作 */
  repairActions: Action[];
  /** 说明 */
  explanation: string;
}

/**
 * 操作（复用现有类型）
 */
export interface Action {
  type: 'create' | 'modify' | 'delete' | 'run' | 'verify';
  path?: string;
  content?: string;
  oldContent?: string;
  newContent?: string;
  command?: string;
  description?: string;
}

/**
 * 循环状态
 */
export interface LoopState {
  /** 当前迭代次数 */
  iteration: number;
  /** 最大迭代次数 */
  maxIterations: number;
  /** 是否已完成 */
  completed: boolean;
  /** 循环历史 */
  history: LoopIteration[];
}

/**
 * 单次循环迭代
 */
export interface LoopIteration {
  /** 迭代编号 */
  iteration: number;
  /** 推理结果 */
  reasoning: ReasoningResult;
  /** 执行结果 */
  execution: ExecutionResult;
  /** 观测结果 */
  observation: ObservationResult;
  /** 修复结果 */
  repair?: RepairResult;
  /** 时间戳 */
  timestamp: number;
}
