/**
 * Command Manager
 *
 * 管理命令注册、执行和帮助系统
 */

import chalk from 'chalk';
import { Command, CommandContext, CommandResult, CommandRegistry, CommandHelp } from './types';
import { LoopSession } from '../interfaces/session';
import { HookSystem } from '../../hooks';

/**
 * 命令管理器实现
 */
export class CommandManager implements CommandRegistry {
  private commands: Map<string, Command> = new Map();
  private aliases: Map<string, string> = new Map();
  private userData: Map<string, any> = new Map();

  /**
   * 注册命令
   */
  register(command: Command, pluginId?: string): void {
    // 设置插件 ID
    if (pluginId) {
      command.pluginId = pluginId;
    }

    // 注册主命令
    this.commands.set(command.name.toLowerCase(), command);

    // 注册别名
    if (command.config?.aliases) {
      for (const alias of command.config.aliases) {
        this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
      }
    }
  }

  /**
   * 注销命令
   */
  unregister(commandName: string): void {
    const name = commandName.toLowerCase();

    // 获取命令
    const command = this.commands.get(name);
    if (!command) {
      return;
    }

    // 移除命令
    this.commands.delete(name);

    // 移除别名
    if (command.config?.aliases) {
      for (const alias of command.config.aliases) {
        this.aliases.delete(alias.toLowerCase());
      }
    }
  }

  /**
   * 获取命令
   */
  get(commandName: string): Command | undefined {
    const name = commandName.toLowerCase();

    // 检查是否是别名
    const actualName = this.aliases.get(name) || name;

    return this.commands.get(actualName);
  }

  /**
   * 检查命令是否存在
   */
  has(commandName: string): boolean {
    return this.get(commandName) !== undefined;
  }

  /**
   * 获取所有命令
   */
  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * 获取命令别名映射
   */
  getAliasMap(): Map<string, string> {
    return new Map(this.aliases);
  }

  /**
   * 清空所有命令
   */
  clear(): void {
    this.commands.clear();
    this.aliases.clear();
  }

  /**
   * 执行命令
   */
  async execute(
    commandName: string,
    args: string[],
    context: Omit<CommandContext, 'args' | 'userData'>
  ): Promise<CommandResult> {
    // 获取命令
    const command = this.get(commandName);
    if (!command) {
      return {
        success: false,
        error: `Unknown command: ${commandName}`,
      };
    }

    // 检查是否启用
    if (command.config?.enabled === false) {
      return {
        success: false,
        error: `Command is disabled: ${commandName}`,
      };
    }

    // 创建命令上下文
    const cmdContext: CommandContext = {
      ...context,
      args,
      userData: this.userData,
    };

    try {
      // 执行命令
      const result = await command.handler(cmdContext);
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Command execution failed',
      };
    }
  }

  /**
   * 打印帮助信息
   */
  printHelp(category?: string): void {
    console.log(chalk.cyan('\n📖 Available Commands'));
    console.log(chalk.cyan('═'.repeat(50)));

    const commands = this.getAll();

    // 按分类分组
    const grouped = new Map<string, Command[]>();
    for (const cmd of commands) {
      const cat = cmd.help?.category || 'general';
      if (!grouped.has(cat)) {
        grouped.set(cat, []);
      }
      grouped.get(cat)!.push(cmd);
    }

    // 打印分类
    const categories = category ? [category] : Array.from(grouped.keys()).sort();
    for (const cat of categories) {
      const cmds = grouped.get(cat);
      if (!cmds || cmds.length === 0) continue;

      console.log(chalk.yellow(`\n${cat.toUpperCase()}`));

      for (const cmd of cmds) {
        const aliases = cmd.config?.aliases?.join(', ') || '';
        const aliasText = aliases ? chalk.gray(` (${aliases})`) : '';
        console.log(`  ${chalk.white(cmd.name)}${aliasText}`);

        if (cmd.description) {
          console.log(`    ${chalk.gray(cmd.description)}`);
        }

        if (cmd.help?.usage) {
          console.log(`    ${chalk.cyan('Usage:')} ${chalk.white(cmd.help.usage)}`);
        }

        if (cmd.help?.examples && cmd.help.examples.length > 0) {
          console.log(`    ${chalk.cyan('Examples:')}`);
          for (const example of cmd.help.examples) {
            console.log(`      ${chalk.gray(example)}`);
          }
        }
      }
    }

    console.log(chalk.cyan('\n═'.repeat(50)) + '\n');
  }

  /**
   * 设置用户数据
   */
  setUserData(key: string, value: any): void {
    this.userData.set(key, value);
  }

  /**
   * 获取用户数据
   */
  getUserData(key: string): any {
    return this.userData.get(key);
  }
}
