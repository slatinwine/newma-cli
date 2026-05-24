/**
 * User Preferences Memory - Type Definitions
 *
 * 用户偏好设置记忆的类型定义
 */

/**
 * 代码风格偏好
 */
export interface CodeStylePreferences {
  /**
   * 缩进方式
   */
  indent: 'spaces' | 'tabs';

  /**
   * 缩进大小
   */
  indentSize: number;

  /**
   * 引号风格
   */
  quoteStyle: 'single' | 'double';

  /**
   * 是否使用尾随逗号
   */
  trailingComma: boolean;

  /**
   * 是否使用分号
   */
  semicolons: boolean;

  /**
   * 命名约定
   */
  namingConvention: 'camelCase' | 'snake_case' | 'PascalCase' | 'kebab-case';

  /**
   * 最大行长度
   */
  maxLineLength: number;

  /**
   * 花括号位置
   */
  bracePosition: 'same-line' | 'new-line';
}

/**
 * 开发工作流偏好
 */
export interface WorkflowPreferences {
  /**
   * 自动保存
   */
  autoSave: boolean;

  /**
   * 自动测试
   */
  autoTest: boolean;

  /**
   * 默认模式
   */
  defaultMode: 'chat' | 'plan' | 'execute' | 'loop';

  /**
   * 验证级别
   */
  verificationLevel: 'fast' | 'standard' | 'thorough';

  /**
   * 是否显示详细输出
   */
  verbose: boolean;

  /**
   * 是否启用彩色输出
   */
  colors: boolean;
}

/**
 * AI 交互偏好
 */
export interface AIInteractionPreferences {
  /**
   * 语言偏好
   */
  language: 'zh' | 'en' | 'auto' | 'mixed';

  /**
   * 详细程度
   */
  verbosity: 'concise' | 'normal' | 'detailed';

  /**
   * 默认规划算法
   */
  planningAlgorithm: 'auto' | 'fft' | 'landmark' | 'tot';

  /**
   * 是否包含上下文
   */
  includeContext: boolean;

  /**
   * 是否使用表情符号
   */
  useEmojis: boolean;

  /**
   * 是否主动提供建议
   */
  proactiveSuggestions: boolean;

  /**
   * 代码注释风格
   */
  commentStyle: 'minimal' | 'standard' | 'detailed';

  /**
   * 错误处理偏好
   */
  errorHandling: 'fix-automatically' | 'suggest-fixes' | 'report-only';
}

/**
 * 工具偏好
 */
export interface ToolPreferences {
  /**
   * 首选包管理器
   */
  preferredPackageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';

  /**
   * 测试框架
   */
  testFramework: string;

  /**
   * Linter 配置
   */
  linters: string[];

  /**
   * 格式化工具
   */
  formatters: string[];

  /**
   * 构建工具
   */
  buildTool: string;

  /**
   * 版本控制
   */
  versionControl: {
    enabled: boolean;
    autoCommit: boolean;
    commitMessageFormat: string;
  };
}

/**
 * 技术栈偏好
 */
export interface TechStackPreferences {
  /**
   * 首选语言
   */
  primaryLanguages: string[];

  /**
   * 首选框架
   */
  preferredFrameworks: string[];

  /**
   * 首选库
   */
  preferredLibraries: Record<string, string>;

  /**
   * 避免的技术
   */
  avoidedTechnologies: string[];

  /**
   * 学习意愿
   */
  learningMode: 'conservative' | 'balanced' | 'experimental';
}

/**
 * 通知偏好
 */
export interface NotificationPreferences {
  /**
   * 启用通知
   */
  enabled: boolean;

  /**
   * 通知级别
   */
  level: 'errors-only' | 'warnings-and-errors' | 'all';

  /**
   * 错误通知
   */
  onError: boolean;

  /**
   * 警告通知
   */
  onWarning: boolean;

  /**
   * 完成通知
   */
  onComplete: boolean;

  /**
   * 进度更新频率（秒）
   */
  progressUpdateInterval: number;
}

/**
 * 完整用户偏好设置
 */
export interface UserPreferences {
  /**
   * 用户 ID（自动生成）
   */
  userId: string;

  /**
   * 最后更新时间
   */
  lastUpdated: string;

  /**
   * 代码风格
   */
  codeStyle: CodeStylePreferences;

  /**
   * 工作流
   */
  workflow: WorkflowPreferences;

  /**
   * AI 交互
   */
  aiInteraction: AIInteractionPreferences;

  /**
   * 工具
   */
  tools: ToolPreferences;

  /**
   * 技术栈
   */
  techStack: TechStackPreferences;

  /**
   * 通知
   */
  notifications: NotificationPreferences;

  /**
   * 自定义设置（扩展用）
   */
  custom: Record<string, any>;
}

/**
 * 偏好更新选项
 */
export interface PreferencesUpdateOptions {
  /**
   * 是否自动应用
   */
  applyAutomatically?: boolean;

  /**
   * 是否确认更新
   */
  confirmUpdate?: boolean;

  /**
   * 更新原因（用于日志）
   */
  reason?: string;
}
