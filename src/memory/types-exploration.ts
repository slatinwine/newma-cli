/**
 * Exploration System Types
 *
 * 自主探索系统类型定义
 */

/**
 * 探索配置
 */
export interface ExplorationConfig {
  /** 是否启用探索（默认 true） */
  enabled?: boolean;
  /** Cron 表达式（默认每4小时） */
  schedule?: string;
  /** 探索领域（默认全部） */
  domains?: string[];
  /** 每个领域最大动作数（默认 3） */
  maxActionsPerDomain?: number;
  /** 单个动作超时时间（毫秒，默认 30000） */
  actionTimeout?: number;
  /** 日志保留天数（默认 30） */
  logRetentionDays?: number;
  /** 最大日志大小（MB，默认 100） */
  maxLogSize?: number;
}

/**
 * 探索领域
 */
export type ExplorationDomainType =
  | 'system_maintenance'
  | 'code_analysis'
  | 'knowledge_exploration'
  | 'workspace_optimization';

/**
 * 探索动作状态
 */
export type ExplorationActionStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * 探索动作优先级
 */
export type ExplorationActionPriority = 'high' | 'medium' | 'low';
