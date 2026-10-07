/**
 * Session Context Memory - Type Definitions
 *
 * 跨会话上下文记忆的类型定义
 */

/**
 * 会话消息类型
 */
export type SessionMessageType = 'user' | 'assistant' | 'system' | 'tool_call';

/**
 * 单条消息
 */
export interface SessionMessage {
  /**
   * 消息 ID
   */
  id: string;

  /**
   * 消息角色
   */
  role: SessionMessageType;

  /**
   * 消息内容
   */
  content: string;

  /**
   * 时间戳
   */
  timestamp: string;

  /**
   * 关联的会话 ID
   */
  sessionId: string;

  /**
   * 父消息 ID（分支树语义：默认是前一条消息；
   * 时间旅行后指向回跳目标的消息，旧分支消息仍保留）
   */
  parentMessageId?: string;

  /**
   * Token 数量（可选）
   */
  tokens?: number;

  /**
   * 元数据
   */
  metadata?: {
    mode?: string;
    commandType?: string;
    toolName?: string;
    success?: boolean;
    duration?: number;
    tokens?: number;
  };
}

/**
 * 会话记录
 */
export interface SessionRecord {
  /**
   * 会话 ID
   */
  id: string;

  /**
   * 开始时间
   */
  startTime: string;

  /**
   * 结束时间
   */
  endTime?: string;

  /**
   * 会话标题（自动生成）
   */
  title: string;

  /**
   * 会话摘要
   */
  summary?: string;

  /**
   * 消息列表
   */
  messages: SessionMessage[];

  /**
   * 会话标签
   */
  tags: string[];

  /**
   * 会话状态
   */
  status: 'active' | 'completed' | 'interrupted';

  /**
   * 项目根目录
   */
  projectRoot: string;

  /**
   * 统计信息
   */
  stats: {
    messageCount: number;
    totalTokens: number;
    userMessageCount: number;
    assistantMessageCount: number;
    duration?: number;
  };

  /**
   * 上下文向量（简化版，用于相似性搜索）
   */
  contextVector?: {
    keywords: string[];
    topics: string[];
    techStack: string[];
  };

  /**
   * 废弃分支的消息区间（时间旅行用）：
   * 这些消息保留在文件中（galgame 的 backlog），但不再进入 AI 上下文
   */
  abandonedRanges?: Array<{
    fromMessageId: string;
    toMessageId: string;
    reason?: string;
  }>;
}

/**
 * 上下文检索选项
 */
export interface ContextSearchOptions {
  /**
   * 关键词匹配
   */
  keywords?: string[];

  /**
   * 标签过滤
   */
  tags?: string[];

  /**
   * 时间范围
   */
  timeRange?: {
    start?: string;
    end?: string;
  };

  /**
   * 会话状态
   */
  status?: SessionRecord['status'];

  /**
   * 最大结果数
   */
  limit?: number;

  /**
   * 是否包含完整消息历史
   */
  includeMessages?: boolean;

  /**
   * 技术栈过滤
   */
  techStack?: string[];
}

/**
 * 上下文检索结果
 */
export interface ContextSearchResult {
  /**
   * 会话记录
   */
  session: SessionRecord;

  /**
   * 相关性分数（0-1）
   */
  relevanceScore: number;

  /**
   * 匹配的原因
   */
  matchReasons: string[];
}

/**
 * 会话上下文存储
 */
export interface SessionContextStorage {
  /**
   * 所有会话列表
   */
  sessions: SessionRecord[];

  /**
   * 当前活跃会话 ID
   */
  activeSessionId?: string;

  /**
   * 最后更新时间
   */
  lastUpdated: string;

  /**
   * 统计信息
   */
  stats: {
    totalSessions: number;
    totalMessages: number;
    totalTokens: number;
    averageSessionLength: number;
  };
}
