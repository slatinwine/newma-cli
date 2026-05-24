/**
 * Memory System - Type Definitions
 *
 * 项目记忆系统的核心类型定义
 */

/**
 * 文件类型统计
 */
export interface FileTypeStats {
  extension: string;
  count: number;
  totalLines: number;
}

/**
 * 项目结构信息
 */
export interface ProjectStructure {
  /**
   * 扫描时间戳
   */
  lastScanned: string;

  /**
   * 项目根目录
   */
  projectRoot: string;

  /**
   * 目录列表
   */
  directories: string[];

  /**
   * 文件类型统计
   */
  fileTypes: Record<string, number>;

  /**
   * 文件总数
   */
  totalFiles: number;

  /**
   * 代码总行数（估算）
   */
  totalLines: number;

  /**
   * 主要语言（按文件数量）
   */
  primaryLanguages: string[];
}

/**
 * 依赖信息
 */
export interface DependencyInfo {
  /**
   * 运行时依赖
   */
  runtime: Record<string, string>;

  /**
   * 开发依赖
   */
  dev: Record<string, string>;

  /**
   * 最后更新时间
   */
  lastUpdated: string;
}

/**
 * 项目配置
 */
export interface ProjectConfig {
  /**
   * 检测到的框架
   */
  framework?: string;

  /**
   * 构建工具
   */
  buildTool?: string;

  /**
   * 测试框架
   */
  testing: string[];

  /**
   * 包管理器
   */
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'unknown';

  /**
   * TypeScript 配置
   */
  typescript?: {
    enabled: boolean;
    strict?: boolean;
    target?: string;
  };
}

/**
 * 文件变更记录
 */
export interface FileChange {
  /**
   * 文件路径（相对路径）
   */
  file: string;

  /**
   * 变更时间戳
   */
  timestamp: string;

  /**
   * 变更类型
   */
  type: 'create' | 'modify' | 'delete';

  /**
   * 变更摘要（可选）
   */
  summary?: string;
}

/**
 * 项目上下文（完整）
 */
export interface ProjectContext {
  /**
   * 最后更新时间
   */
  lastUpdated: string;

  /**
   * 项目结构
   */
  structure: ProjectStructure;

  /**
   * 依赖关系
   */
  dependencies: DependencyInfo;

  /**
   * 项目配置
   */
  config: ProjectConfig;

  /**
   * 最近变更（最近 50 条）
   */
  recentChanges: FileChange[];

  /**
   * 版本号（用于缓存失效）
   */
  version: string;
}

/**
 * 上下文缓存选项
 */
export interface ContextCacheOptions {
  /**
   * 缓存目录
   */
  cacheDir?: string;

  /**
   * 缓存有效期（秒）
   * @default 3600 (1小时)
   */
  ttl?: number;

  /**
   * 是否启用压缩
   * @default false
   */
  compress?: boolean;

  /**
   * 最大变更记录数
   * @default 50
   */
  maxChanges?: number;
}

/**
 * 上下文更新结果
 */
export interface ContextUpdateResult {
  /**
   * 是否有更新
   */
  updated: boolean;

  /**
   * 更新时间（毫秒）
   */
  duration: number;

  /**
   * 更新的字段
   */
  changes?: {
    structure?: boolean;
    dependencies?: boolean;
    config?: boolean;
    recentChanges?: boolean;
  };
}
