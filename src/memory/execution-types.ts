/**
 * Execution History Memory - Type Definitions
 *
 * 执行历史记忆的类型定义
 */

/**
 * 命令类型
 */
export type CommandType =
  | 'plan'        // 规划模式
  | 'execute'     // 执行模式
  | 'verify'      // 验证模式
  | 'loop'        // 循环模式
  | 'chat'        // 聊天模式
  | 'fft'         // FFT 规划
  | 'landmark'    // Landmark 规划
  | 'special';    // 特殊命令（/help, /status 等）

/**
 * 命令状态
 */
export type CommandStatus = 'pending' | 'running' | 'success' | 'failed' | 'aborted';

/**
 * 单个命令记录
 */
export interface CommandRecord {
  /**
   * 命令序号（会话内）
   */
  index: number;

  /**
   * 命令输入
   */
  input: string;

  /**
   * 命令类型
   */
  type: CommandType;

  /**
   * 命令状态
   */
  status: CommandStatus;

  /**
   * 开始时间（ISO 字符串）
   */
  startTime: string;

  /**
   * 结束时间（ISO 字符串）
   */
  endTime: string;

  /**
   * 执行时长（毫秒）
   */
  duration: number;

  /**
   * 执行的动作数量
   */
  actionCount?: number;

  /**
   * 成功的动作数量
   */
  successCount?: number;

  /**
   * 失败的动作数量
   */
  failureCount?: number;

  /**
   * Token 使用量
   */
  tokens?: {
    input: number;
    output: number;
    total: number;
  };

  /**
   * 错误信息（如果失败）
   */
  error?: string;

  /**
   * 附加元数据
   */
  metadata?: {
    mode?: string;
    algorithm?: string;
    iterations?: number;
    [key: string]: any;
  };
}

/**
 * 会话统计
 */
export interface SessionStats {
  /**
   * 会话 ID
   */
  sessionId: string;

  /**
   * 开始时间（ISO 字符串）
   */
  startTime: string;

  /**
   * 结束时间（ISO 字符串）
   */
  endTime: string;

  /**
   * 会话总时长（毫秒）
   */
  totalDuration: number;

  /**
   * 命令总数
   */
  totalCommands: number;

  /**
   * 成功命令数
   */
  successCommands: number;

  /**
   * 失败命令数
   */
  failedCommands: number;

  /**
   * 中止命令数
   */
  abortedCommands: number;

  /**
   * 成功率（百分比）
   */
  successRate: number;

  /**
   * 平均命令时长（毫秒）
   */
  averageCommandDuration: number;

  /**
   * 总 token 使用量
   */
  totalTokens?: {
    input: number;
    output: number;
    total: number;
  };

  /**
   * 最常用的命令类型
   */
  topCommandTypes: Array<{
    type: CommandType;
    count: number;
  }>;

  /**
   * 使用的算法统计
   */
  algorithms?: string[];
}

/**
 * 执行会话（完整）
 */
export interface ExecutionSession {
  /**
   * 会话 ID
   */
  sessionId: string;

  /**
   * 项目根目录
   */
  projectRoot: string;

  /**
   * 会话统计
   */
  stats: SessionStats;

  /**
   * 命令记录列表
   */
  commands: CommandRecord[];

  /**
   * 会话版本（用于缓存失效）
   */
  version: string;
}

/**
 * 历史查询选项
 */
export interface HistoryQueryOptions {
  /**
   * 会话 ID 过滤
   */
  sessionId?: string;

  /**
   * 命令类型过滤
   */
  commandType?: CommandType;

  /**
   * 状态过滤
   */
  status?: CommandStatus;

  /**
   * 日期范围
   */
  startDate?: Date;
  endDate?: Date;

  /**
   * 关键词搜索
   */
  keyword?: string;

  /**
   * 限制返回数量
   */
  limit?: number;
}

/**
 * 执行历史存储选项
 */
export interface ExecutionHistoryOptions {
  /**
   * 存储目录
   */
  dataDir?: string;

  /**
   * 是否压缩旧数据
   * @default true
   */
  compress?: boolean;

  /**
   * 压缩前的天数
   * @default 7
   */
  compressAfterDays?: number;

  /**
   * 压缩级别
   * @default 9 (max)
   */
  compressionLevel?: number;
}
