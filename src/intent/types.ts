/**
 * Intent Recognition - Type Definitions
 *
 * 意图识别系统用于自动分析用户需求，评估任务复杂度，
 * 并选择最合适的规划算法（FFT、Landmark、ToT、Standard）。
 */

/**
 * 任务复杂度等级
 */
export enum ComplexityLevel {
  SIMPLE = 'simple',       // 简单查询、问答
  MEDIUM = 'medium',       // 中等任务（功能开发）
  COMPLEX = 'complex',     // 复杂任务（架构变更）
}

/**
 * 任务类型
 */
export enum TaskType {
  QUESTION = 'question',           // 问答类
  CODE_GENERATION = 'code_generation',  // 代码生成
  FEATURE_DEVELOPMENT = 'feature_development',  // 功能开发
  REFACTORING = 'refactoring',     // 重构
  DEBUGGING = 'debugging',         // 调试
  DOCUMENTATION = 'documentation', // 文档
  TESTING = 'testing',             // 测试
  ARCHITECTURE = 'architecture',   // 架构设计
  OTHER = 'other',                 // 其他
}

/**
 * 推荐的规划算法
 */
export enum PlanningAlgorithm {
  FFT = 'fft',                     // 快速决策树
  LANDMARK = 'landmark',           // 路标计数
  TOT = 'tot',                     // Tree of Thoughts
  STANDARD = 'standard',           // 标准AI规划
}

/**
 * 意图识别结果
 */
export interface Intent {
  taskType: TaskType;              // 任务类型
  complexity: ComplexityLevel;     // 复杂度等级
  recommendedAlgorithm: PlanningAlgorithm;  // 推荐算法
  confidence: number;              // 置信度 (0-1)
  reasoning: string;               // 推理说明（为什么选择这个算法）
  keywords: string[];              // 识别到的关键词
  estimatedSteps?: number;         // 预估步骤数
}

/**
 * 意图分析特征
 */
export interface IntentFeatures {
  // 文本特征
  length: number;                  // 输入长度
  wordCount: number;               // 词数

  // 关键词特征
  hasQuestionWords: boolean;       // 是否包含疑问词
  hasTechnicalTerms: boolean;      // 是否包含技术术语
  hasActionVerbs: boolean;         // 是否包含动作动词

  // 上下文特征
  mentionsFiles: boolean;          // 是否提到文件
  mentionsMultipleFiles: boolean;  // 是否提到多个文件
  mentionsDependencies: boolean;   // 是否提到依赖
  mentionsTests: boolean;          // 是否提到测试
  mentionsArchitecture: boolean;   // 是否提到架构

  // 复杂度特征
  hasMultipleSteps: boolean;       // 是否包含多个步骤
  hasConditions: boolean;          // 是否包含条件逻辑
  hasUnclearRequirements: boolean; // 是否需求不明确
}

/**
 * 算法选择配置
 */
export interface AlgorithmSelectionConfig {
  autoSelect: boolean;             // 是否启用自动选择（默认true）
  minConfidence: number;           // 最低置信度阈值（默认0.6）
  fallbackAlgorithm: PlanningAlgorithm;  // 回退算法（默认standard）
  useAIForIntent: boolean;         // 是否使用AI进行意图识别（默认false，使用启发式规则）
  strictMode: boolean;             // 严格模式（低于阈值则报错，否则使用fallback）
}
