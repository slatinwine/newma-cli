/**
 * Command System Types
 *
 * 定义命令系统的类型和接口
 */

import { LoopSession } from '../interfaces/session';
import { HookSystem } from '../../hooks';

/**
 * 命令结果
 */
export interface CommandResult {
  /**
   * 是否成功
   */
  success: boolean;

  /**
   * 输出内容
   */
  output?: string;

  /**
   * 错误信息
   */
  error?: string;

  /**
   * 元数据
   */
  metadata?: Record<string, any>;
}

/**
 * 命令上下文
 * 提供给命令处理器的上下文信息
 */
export interface CommandContext {
  /**
   * 会话
   */
  session: LoopSession;

  /**
   * Hook 系统
   */
  hookSystem?: HookSystem;

  /**
   * 命令参数
   */
  args: string[];

  /**
   * 原始输入
   */
  rawInput: string;

  /**
   * 用户数据存储
   */
  userData: Map<string, any>;

  /**
   * 前端（用于输出）
   */
  frontend?: any;
}

/**
 * 命令处理器
 * 处理特定命令的函数
 */
export type CommandHandler = (
  context: CommandContext
) => Promise<CommandResult> | CommandResult;

/**
 * 命令配置
 */
export interface CommandConfig {
  /**
   * 是否启用
   */
  enabled?: boolean;

  /**
   * 权限级别
   */
  permissionLevel?: string;

  /**
   * 超时时间（毫秒）
   */
  timeout?: number;

  /**
   * 别名
   */
  aliases?: string[];
}

/**
 * 命令帮助信息
 */
export interface CommandHelp {
  /**
   * 命令名称
   */
  name: string;

  /**
   * 命令描述
   */
  description: string;

  /**
   * 使用方法
   */
  usage?: string;

  /**
   * 示例
   */
  examples?: string[];

  /**
   * 别名
   */
  aliases?: string[];

  /**
   * 分类
   */
  category?: string;
}

/**
 * 命令定义
 */
export interface Command {
  /**
   * 命令名称（不带 /）
   */
  name: string;

  /**
   * 命令描述
   */
  description: string;

  /**
   * 处理器
   */
  handler: CommandHandler;

  /**
   * 配置
   */
  config?: CommandConfig;

  /**
   * 帮助信息
   */
  help?: CommandHelp;

  /**
   * 插件 ID（如果是插件注册的）
   */
  pluginId?: string;
}

/**
 * 命令注册表
 */
export interface CommandRegistry {
  /**
   * 注册命令
   */
  register(command: Command, pluginId?: string): void;

  /**
   * 注销命令
   */
  unregister(commandName: string): void;

  /**
   * 获取命令
   */
  get(commandName: string): Command | undefined;

  /**
   * 检查命令是否存在
   */
  has(commandName: string): boolean;

  /**
   * 获取所有命令
   */
  getAll(): Command[];

  /**
   * 获取命令别名映射
   */
  getAliasMap(): Map<string, string>;

  /**
   * 清空所有命令
   */
  clear(): void;
}
