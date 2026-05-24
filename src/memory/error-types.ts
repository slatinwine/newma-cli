/**
 * Error Solution Memory - Type Definitions
 *
 * 错误解决方案记忆的类型定义
 */

/**
 * 错误严重程度
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * 错误分类
 */
export type ErrorCategory =
  | 'syntax'          // 语法错误
  | 'type'            // 类型错误
  | 'runtime'         // 运行时错误
  | 'network'         // 网络错误
  | 'file'            // 文件操作错误
  | 'permission'      // 权限错误
  | 'dependency'      // 依赖错误
  | 'configuration'   // 配置错误
  | 'api'             // API 错误
  | 'build'           // 构建错误
  | 'test'            // 测试错误
  | 'other';          // 其他

/**
 * 错误记录
 */
export interface ErrorRecord {
  /**
   * 错误 ID（自动生成）
   */
  id: string;

  /**
   * 错误类型/名称
   */
  errorType: string;

  /**
   * 错误消息
   */
  errorMessage: string;

  /**
   * 错误分类
   */
  category: ErrorCategory;

  /**
   * 严重程度
   */
  severity: ErrorSeverity;

  /**
   * 发生时间（ISO 字符串）
   */
  timestamp: string;

  /**
   * 错误上下文
   */
  context: {
    /**
     * 触发错误的命令
     */
    command: string;

    /**
     * 命令类型
     */
    commandType: string;

    /**
     * 任务描述
     */
    task?: string;

    /**
     * 相关文件
     */
    files?: string[];

    /**
     * 堆栈信息（可选）
     */
    stackTrace?: string;

    /**
     * 其他元数据
     */
    metadata?: Record<string, any>;
  };

  /**
   * 解决方案（如果已解决）
   */
  solution?: Solution;

  /**
   * 是否已解决
   */
  resolved: boolean;

  /**
   * 出现次数（每次出现时递增）
   */
  occurrenceCount: number;

  /**
   * 最后出现时间
   */
  lastOccurrence: string;

  /**
   * 标签
   */
  tags: string[];
}

/**
 * 解决方案
 */
export interface Solution {
  /**
   * 解决方案描述
   */
  description: string;

  /**
   * 解决步骤
   */
  steps: string[];

  /**
   * 解决时间（ISO 字符串）
   */
  timestamp: string;

  /**
   * 解决方式
   */
  method: 'manual' | 'automatic' | 'retry' | 'workaround';

  /**
   * 验证状态
   */
  verified: boolean;

  /**
   * 成功率（0-1）
   */
  successRate: number;

  /**
   * 使用次数（每次使用时递增）
   */
  usageCount: number;

  /**
   * 最后使用时间
   */
  lastUsed: string;

  /**
   * 相关代码示例（可选）
   */
  codeExample?: string;

  /**
   * 相关链接（可选）
   */
  links?: string[];
}

/**
 * 错误模式统计
 */
export interface ErrorPattern {
  /**
   * 错误类型
   */
  errorType: string;

  /**
   * 错误分类
   */
  category: ErrorCategory;

  /**
   * 出现频率
   */
  frequency: number;

  /**
   * 平均解决时长（毫秒）
   */
  avgResolutionTime: number;

  /**
   * 解决率（0-1）
   */
  resolutionRate: number;

  /**
   * 最有效的解决方案
   */
  topSolution?: {
    description: string;
    successRate: number;
    usageCount: number;
  };

  /**
   * 常见上下文
   */
  commonContexts: Array<{
    command: string;
    count: number;
  }>;

  /**
   * 最后出现时间
   */
  lastOccurrence: string;
}

/**
 * 错误查询选项
 */
export interface ErrorQueryOptions {
  /**
   * 错误类型
   */
  errorType?: string;

  /**
   * 错误分类
   */
  category?: ErrorCategory;

  /**
   * 严重程度
   */
  severity?: ErrorSeverity;

  /**
   * 是否已解决
   */
  resolved?: boolean;

  /**
   * 关键词搜索
   */
  keyword?: string;

  /**
   * 标签过滤
   */
  tags?: string[];

  /**
   * 日期范围
   */
  startDate?: Date;
  endDate?: Date;

  /**
   * 限制返回数量
   */
  limit?: number;

  /**
   * 只包含有解决方案的
   */
  withSolutionOnly?: boolean;
}

/**
 * 错误存储配置
 */
export interface ErrorMemoryOptions {
  /**
   * 存储目录
   */
  dataDir?: string;

  /**
   * 最大错误记录数
   * @default 1000
   */
  maxErrors?: number;

  /**
   * 最大解决方案数
   * @default 500
   */
  maxSolutions?: number;
}
