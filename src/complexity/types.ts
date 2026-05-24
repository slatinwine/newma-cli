/**
 * Complexity Analysis Types
 * 分析任务复杂度的类型定义
 */

/**
 * 复杂度等级
 */
export enum ComplexityLevel {
  SIMPLE = 'simple',           // 简单：1-2 个文件，单一技术栈
  MEDIUM = 'medium',           // 中等：3-5 个文件，2-3 个技术栈
  COMPLEX = 'complex',         // 复杂：6-10 个文件，3-4 个技术栈
  VERY_COMPLEX = 'very_complex' // 非常复杂：10+ 个文件，5+ 个技术栈
}

/**
 * 复杂度评分
 */
export interface ComplexityScore {
  /**
   * 总体评分 (0-100)
   */
  total: number;

  /**
   * 复杂度等级
   */
  level: ComplexityLevel;

  /**
   * 各维度评分
   */
  dimensions: {
    /**
     * 文件数量评分 (0-20)
     */
    fileCount: number;

    /**
     * 技术栈数量评分 (0-20)
     */
    techStack: number;

    /**
     * 依赖关系复杂度评分 (0-20)
     */
    dependencies: number;

    /**
     * 预估步骤数评分 (0-20)
     */
    estimatedSteps: number;

    /**
     * 代码改动范围评分 (0-20)
     */
    codeScope: number;
  };

  /**
   * 评分理由
   */
  reasons: string[];

  /**
   * 建议的执行策略
   */
  recommendedStrategy: 'fft' | 'function-calling' | 'subagent' | 'claude-code';

  /**
   * 分析时间戳
   */
  analyzedAt: Date;
}

/**
 * 任务上下文
 */
export interface TaskContext {
  /**
   * 项目根目录
   */
  projectRoot: string;

  /**
   * 用户需求描述
   */
  requirement: string;

  /**
   * 项目信息（可选）
   */
  projectInfo?: {
    fileTree?: any;
    totalFiles?: number;
    languages?: string[];
    frameworks?: string[];
  };

  /**
   * 相关文件列表（可选，由工具调用结果提供）
   */
  relatedFiles?: string[];

  /**
   * 执行历史（可选，用于增量分析）
   */
  history?: any[];
}

/**
 * 复杂度分析配置
 */
export interface ComplexityAnalyzerConfig {
  /**
   * 触发 claude-code 模式的阈值
   * @default 70
   */
  claudeCodeThreshold?: number;

  /**
   * 触发 subagent 模式的阈值
   * @default 50
   */
  subagentThreshold?: number;

  /**
   * 触发 function-calling 模式的阈值
   * @default 30
   */
  functionCallingThreshold?: number;

  /**
   * 是否启用详细分析
   * @default true
   */
  detailedAnalysis?: boolean;

  /**
   * 自定义权重配置
   */
  weights?: {
    fileCount?: number;
    techStack?: number;
    dependencies?: number;
    estimatedSteps?: number;
    codeScope?: number;
  };
}

/**
 * 分析结果
 */
export interface AnalysisResult {
  /**
   * 复杂度评分
   */
  score: ComplexityScore;

  /**
   * 是否应该使用 claude-code 模式
   */
  shouldUseClaudeCode: boolean;

  /**
   * 建议的 subagent 数量
   */
  suggestedSubagentCount?: number;

  /**
   * 建议的 subagent 类型
   */
  suggestedAgentTypes?: string[];
}
