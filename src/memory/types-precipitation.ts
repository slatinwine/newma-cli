/**
 * Precipitation System Type Definitions
 *
 * 经验自动沉淀系统的类型定义
 */

/**
 * 支持证据
 */
export interface Evidence {
  /** 证据来源 */
  source:
    | 'errors'
    | 'history'
    | 'preferences'
    | 'context'
    | 'reasoning'
    | 'decisions'
    | 'sessions'
    | 'branches'; // 🎮 分支树结局（哪些决策路线成功/失败/被放弃）
  /** 证据描述 */
  description: string;
  /** 具体示例 */
  examples: string[];
  /** 出现次数 */
  count?: number;
  /** 最后出现时间 */
  lastSeen?: Date;
}

/**
 * 示例场景
 */
export interface Example {
  /** 场景描述 */
  scenario: string;
  /** 解决方案 */
  solution: string;
  /** 相关代码示例（可选） */
  code?: string;
}

/**
 * 技能建议
 */
export interface SkillSuggestion {
  /** 技能名称 */
  name: string;
  /** 简短描述（50字内） */
  description: string;
  /** 技能类型 */
  type: 'knowledge' | 'action' | 'analysis';
  /** 复杂度 (1-5) */
  complexity: number;
  /** 标签列表 */
  tags: string[];
  /** AI 置信度 (0.0-1.0) */
  confidence: number;
  /** 支持证据列表 */
  evidence: Evidence[];
  /** 使用场景 */
  whenToUse: string[];
  /** 核心知识点 (Markdown 格式) */
  coreKnowledge: string;
  /** 示例列表 */
  examples: Example[];
  /** 技能 ID（自动生成） */
  id?: string;
  /** 生成时间 */
  generatedAt?: Date;
}

/**
 * 草稿技能状态
 */
export type DraftStatus = 'draft' | 'approved' | 'rejected';

/**
 * 草稿技能
 */
export interface DraftSkill {
  /** 草稿 ID */
  id: string;
  /** 技能目录路径 */
  path: string;
  /** 技能建议 */
  suggestion: SkillSuggestion;
  /** 创建时间 */
  createdAt: Date;
  /** 当前状态 */
  status: DraftStatus;
  /** 审批时间（可选） */
  reviewedAt?: Date;
  /** 审批备注（可选） */
  reviewNote?: string;
}

/**
 * Dream 配置（嵌入在 PrecipitationConfig 中）
 */
export interface DreamConfigOptions {
  /** 是否启用（默认: true） */
  enabled?: boolean;
  /** 最小间隔小时数（默认: 24） */
  minHours?: number;
  /** 最小 session 数量（默认: 5） */
  minSessions?: number;
  /** 最大轮次（默认: 30） */
  maxTurns?: number;
  /** 锁文件路径（默认: .memo/dream/.consolidate-lock） */
  lockFilePath?: string;
  /** Memory 目录路径（默认: .memo/memory） */
  memoryDir?: string;
  /** Session 目录路径（默认: .kode/sessions） */
  sessionDir?: string;
  /** 事件冷却时间（秒，默认: 30） */
  eventCooldownSeconds?: number;
  /** 整合后触发沉淀（默认: true） */
  triggerPrecipitation?: boolean;
}

/**
 * 沉淀系统配置
 */
export interface PrecipitationConfig {
  /** 是否启用（默认: true） */
  enabled?: boolean;
  /** Cron 表达式（默认: "0 2 * * *"） */
  schedule?: string;
  /** 置信度阈值（默认: 0.6） */
  confidenceThreshold?: number;
  /** 每日最大生成数量（默认: 5） */
  maxDailySkills?: number;
  /** 草稿保留天数（默认: 30） */
  draftRetentionDays?: number;
  /** 低于此阈值自动批准（可选） */
  autoApproveBelow?: number;
  /** 高于此阈值自动拒绝（可选） */
  autoRejectAbove?: number;
  /** 分析数据时间范围（天数，默认: 7） */
  analysisDays?: number;
  /** 是否在启动时初始化目录（默认: true） */
  initOnStart?: boolean;
  /** Dream 系统配置（可选） */
  dream?: DreamConfigOptions;
}

/**
 * 沉淀任务结果
 */
export interface PrecipitationResult {
  /** 是否成功 */
  success: boolean;
  /** 开始时间 */
  startTime: Date;
  /** 结束时间 */
  endTime: Date;
  /** 生成的技能建议数量 */
  suggestionsGenerated: number;
  /** 保存的草稿数量 */
  draftsSaved: number;
  /** 自动批准的数量 */
  autoApproved: number;
  /** 自动拒绝的数量 */
  autoRejected: number;
  /** 错误信息（如果失败） */
  error?: string;
  /** 执行日志 */
  logs: string[];
}

/**
 * 记忆数据汇总
 */
export interface MemoryDataSummary {
  /** 错误记录 */
  errors: any[];
  /** 执行历史 */
  history: any[];
  /** 用户偏好 */
  preferences: any;
  /** 项目上下文 */
  context: any;
  /** 推理过程 */
  reasoning: any[];
  /** 决策记录 */
  decisions: any[];
  /** 会话历史 */
  sessions: any[];
  /** 🎮 分支树结局（决策路线的成功/失败/放弃统计） */
  branches?: any[];
  /** 数据时间范围 */
  dateRange: {
    start: Date;
    end: Date;
  };
}

/**
 * 分析器选项
 */
export interface AnalyzerOptions {
  /** 置信度阈值 */
  confidenceThreshold: number;
  /** 最大生成数量 */
  maxSkills: number;
  /** 分析数据时间范围（天数） */
  analysisDays: number;
  /** 权重配置 */
  weights?: {
    /** 错误解决方案权重 */
    errors?: number;
    /** 执行历史权重 */
    history?: number;
    /** 用户偏好权重 */
    preferences?: number;
    /** 其他记忆权重 */
    others?: number;
  };
}

/**
 * 技能生成器选项
 */
export interface GeneratorOptions {
  /** 是否保存为草稿 */
  saveAsDraft: boolean;
  /** 目标目录 */
  targetDir: string;
  /** 是否包含元数据注释 */
  includeMetadata: boolean;
}

/**
 * 草稿管理器选项
 */
export interface DraftManagerOptions {
  /** 草稿目录 */
  draftsDir: string;
  /** 已批准目录 */
  approvedDir: string;
  /** 已拒绝目录 */
  rejectedDir: string;
  /** 草稿保留天数 */
  retentionDays: number;
}

/**
 * 沉淀系统统计
 */
export interface PrecipitationStats {
  /** 总沉淀次数 */
  totalPrecipitations: number;
  /** 总生成技能数 */
  totalSkillsGenerated: number;
  /** 总批准数 */
  totalApproved: number;
  /** 总拒绝数 */
  totalRejected: number;
  /** 待审批数 */
  pendingCount: number;
  /** 平均置信度 */
  averageConfidence: number;
  /** 最后沉淀时间 */
  lastPrecipitation?: Date;
  /** 下次沉淀时间 */
  nextPrecipitation?: Date;
}
