/**
 * Core Plugin
 *
 * 提供核心命令功能
 * 包括：/help、/status、/history、/clear、/exit、/time 等
 */

import chalk from 'chalk';
import { Command, CommandContext, CommandResult } from '../commands/types';
import { LoopSession } from '../interfaces/session';

/**
 * 核心插件命令集合
 */
export class CorePluginCommands {
  /**
   * 创建技能命令
   */
  static createSkillsCommand(): Command {
    return {
      name: 'skills',
      description: 'Show available skills (agents, tools, plugins)',
      handler: async (context: CommandContext): Promise<CommandResult> => {
        const { userData } = context;

        console.log(chalk.cyan('\n🎯 Available Skills'));
        console.log(chalk.cyan('═'.repeat(60)));

        // 1. Show Agents (if multi-agent is enabled)
        const coordinator = userData.get('coordinator');
        if (coordinator) {
          const agents = coordinator.getAllAgents();
          console.log(chalk.yellow(`\n🤖 Agents (${agents.length})`));
          console.log(chalk.gray('─'.repeat(60)));

          agents.forEach((agent: any) => {
            console.log(`  ${chalk.white(agent.name)} ${chalk.gray(`[${agent.id}]`)}`);
            console.log(`    ${chalk.gray(agent.description)}`);
            const caps = agent.capabilities.join(', ');
            console.log(`    ${chalk.cyan('Capabilities:')} ${chalk.white(caps)}`);
            console.log(`    ${chalk.cyan('Status:')} ${chalk.green(agent.status)}`);
            console.log('');
          });
        } else {
          console.log(chalk.yellow(`\n🤖 Agents`));
          console.log(chalk.gray('─'.repeat(60)));
          console.log(chalk.gray('  Multi-agent system not enabled'));
          console.log(chalk.gray('  Enable with: /set useMultiAgent true'));
        }

        // 2. Show Tools (if tool system is enabled)
        const toolRegistry = userData.get('toolRegistry');
        if (toolRegistry) {
          const tools = toolRegistry.list();
          console.log(chalk.yellow(`\n🔧 Tools (${tools.length})`));
          console.log(chalk.gray('─'.repeat(60)));

          // Group by category
          const grouped = new Map<string, typeof tools>();
          for (const tool of tools) {
            const cat = tool.category || 'general';
            if (!grouped.has(cat)) {
              grouped.set(cat, []);
            }
            grouped.get(cat)!.push(tool);
          }

          grouped.forEach((tools, category) => {
            console.log(`  ${chalk.white(category.toUpperCase())}`);
            tools.forEach((tool: any) => {
              console.log(`    ${chalk.green(tool.name)}: ${chalk.gray(tool.description)}`);
            });
            console.log('');
          });
        } else {
          console.log(chalk.yellow(`\n🔧 Tools`));
          console.log(chalk.gray('─'.repeat(60)));
          console.log(chalk.gray('  Tool system not enabled'));
          console.log(chalk.gray('  Enable with: /set useTools true'));
        }

        // 3. Show Commands
        const commandManager = userData.get('commandManager');
        if (commandManager) {
          const commands = commandManager.getAll();
          console.log(chalk.yellow(`\n📝 Commands (${commands.length})`));
          console.log(chalk.gray('─'.repeat(60)));

          // Group by category
          const grouped = new Map<string, typeof commands>();
          for (const cmd of commands) {
            const cat = cmd.help?.category || 'general';
            if (!grouped.has(cat)) {
              grouped.set(cat, []);
            }
            grouped.get(cat)!.push(cmd);
          }

          grouped.forEach((commands, category) => {
            console.log(`  ${chalk.white(category.toUpperCase())}`);
            commands.forEach((cmd: any) => {
              const aliases = cmd.config?.aliases?.join(', ') || '';
              const aliasText = aliases ? chalk.gray(` (${aliases})`) : '';
              console.log(`    ${chalk.green(cmd.name)}${aliasText}: ${chalk.gray(cmd.description)}`);
            });
            console.log('');
          });
        }

        // 4. Show Plugins
        if (commandManager) {
          // Get commands grouped by plugin
          const commands = commandManager.getAll();
          const plugins = new Map<string, typeof commands>();

          for (const cmd of commands) {
            const pluginId = cmd.pluginId || 'core';
            if (!plugins.has(pluginId)) {
              plugins.set(pluginId, []);
            }
            plugins.get(pluginId)!.push(cmd);
          }

          console.log(chalk.yellow(`\n🔌 Plugins (${plugins.size})`));
          console.log(chalk.gray('─'.repeat(60)));

          plugins.forEach((commands, pluginId) => {
            console.log(`  ${chalk.white(pluginId.toUpperCase())} ${chalk.gray(`(${commands.length} commands)`)}`);
          });
        }

        console.log(chalk.cyan('═'.repeat(60)) + '\n');

        return { success: true, output: 'Skills displayed' };
      },
      help: {
        name: 'skills',
        description: 'Show all available skills (agents, tools, plugins)',
        usage: '/skills',
        category: 'general',
      },
    };
  }

  /**
   * 创建帮助命令
   */
  static createHelpCommand(commandManager: any): Command {
    return {
      name: 'help',
      description: 'Show available commands',
      handler: async (context: CommandContext): Promise<CommandResult> => {
        const category = context.args[0];
        commandManager.printHelp(category);
        return { success: true, output: 'Help displayed' };
      },
      config: {
        aliases: ['?', 'h'],
      },
      help: {
        name: 'help',
        description: 'Show available commands',
        usage: '/help [category]',
        examples: ['/help', '/help general'],
        category: 'general',
      },
    };
  }

  /**
   * 创建状态命令
   */
  static createStatusCommand(): Command {
    return {
      name: 'status',
      description: 'Show session status',
      handler: async (context: CommandContext): Promise<CommandResult> => {
        const { session } = context;
        const stats = session.getStats();

        console.log(chalk.cyan('\n📊 Session Status'));
        console.log(chalk.cyan('═'.repeat(50)));
        console.log(chalk.white('Session ID:    ') + chalk.gray(session.sessionId));
        console.log(chalk.white('Project:       ') + chalk.yellow(session.projectRoot));
        console.log(chalk.white('Mode:          ') + chalk.green(session.currentMode));
        console.log(chalk.white('Commands:      ') + chalk.yellow(stats.commandCount.toString()));
        console.log(chalk.white('Session Time:  ') + chalk.yellow(`${Math.round(stats.sessionDuration / 1000)}s`));
        console.log(chalk.white('Total Duration:') + chalk.yellow(`${Math.round(stats.totalDuration / 1000)}s`));
        console.log(chalk.white('Success Rate:  ') + chalk.green(`${((stats.successCount / stats.commandCount) * 100).toFixed(1)}%`));

        if (session.currentPlan) {
          console.log(chalk.white('Current Plan:  ') + chalk.green('Active'));
        }

        console.log(chalk.cyan('═'.repeat(50)) + '\n');

        return { success: true, output: 'Status displayed' };
      },
      help: {
        name: 'status',
        description: 'Show current session status',
        usage: '/status',
        category: 'general',
      },
    };
  }

  /**
   * 创建清屏命令
   */
  static createClearCommand(): Command {
    return {
      name: 'clear',
      description: 'Clear the screen',
      handler: async (context: CommandContext): Promise<CommandResult> => {
        console.clear();
        return { success: true, output: 'Screen cleared' };
      },
      config: {
        aliases: ['cls'],
      },
      help: {
        name: 'clear',
        description: 'Clear the terminal screen',
        usage: '/clear',
        category: 'general',
      },
    };
  }

  /**
   * 创建历史命令
   */
  static createHistoryCommand(): Command {
    return {
      name: 'history',
      description: 'Show command history',
      handler: async (context: CommandContext): Promise<CommandResult> => {
        const { session, args } = context;
        const limit = args[0] ? parseInt(args[0], 10) : 20;

        // 从会话获取历史记录
        const history = session.executionHistory.slice(-limit);

        console.log(chalk.cyan(`\n📜 Command History (Last ${history.length} commands)`));
        console.log(chalk.cyan('═'.repeat(50)));

        history.forEach((record, index) => {
          const timestamp = new Date(record.timestamp).toLocaleTimeString();
          const actionType = record.action.type;
          console.log(
            `${chalk.gray((history.length - limit + index + 1).toString().padStart(3))} ` +
            `${chalk.gray(timestamp)} - ${chalk.white(actionType)}`
          );

          if (record.action.type === 'create' || record.action.type === 'modify') {
            console.log(`    ${chalk.gray(record.action.path)}`);
          }
        });

        console.log(chalk.cyan('═'.repeat(50)) + '\n');

        return { success: true, output: 'History displayed' };
      },
      help: {
        name: 'history',
        description: 'Show command execution history',
        usage: '/history [limit]',
        examples: ['/history', '/history 50'],
        category: 'general',
      },
    };
  }

  /**
   * 创建退出命令
   */
  static createExitCommand(): Command {
    return {
      name: 'exit',
      description: 'Exit the session',
      handler: async (context: CommandContext): Promise<CommandResult> => {
        console.log(chalk.yellow('\n👋 Goodbye!\n'));
        return {
          success: true,
          output: 'Exiting...',
          metadata: { exit: true },
        };
      },
      config: {
        aliases: ['quit', 'q'],
      },
      help: {
        name: 'exit',
        description: 'Exit the interactive session',
        usage: '/exit',
        category: 'general',
      },
    };
  }

  /**
   * 创建时间命令
   */
  static createTimeCommand(): Command {
    return {
      name: 'time',
      description: 'Show current system time',
      handler: async (context: CommandContext): Promise<CommandResult> => {
        const now = new Date();

        const dateStr = now.toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          weekday: 'long',
        });

        const timeStr = now.toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });

        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const utcOffset = -now.getTimezoneOffset() / 60;
        const utcOffsetStr = utcOffset >= 0 ? `+${utcOffset}` : utcOffset;

        console.log(chalk.cyan('\n🕐 Current System Time'));
        console.log(chalk.cyan('═'.repeat(50)));
        console.log(chalk.white('Date:       ') + chalk.yellow(dateStr));
        console.log(chalk.white('Time:       ') + chalk.yellow(timeStr));
        console.log(chalk.white('Timezone:   ') + chalk.yellow(timezone));
        console.log(chalk.white('UTC Offset: ') + chalk.yellow(`UTC${utcOffsetStr}`));
        console.log(chalk.white('Timestamp:  ') + chalk.gray(now.getTime()));
        console.log(chalk.cyan('═'.repeat(50)) + '\n');

        return { success: true, output: 'Time displayed' };
      },
      help: {
        name: 'time',
        description: 'Show current system time',
        usage: '/time',
        category: 'general',
      },
    };
  }

  /**
   * 获取所有核心命令
   */
  static getAllCommands(commandManager: any): Command[] {
    return [
      this.createHelpCommand(commandManager),
      this.createSkillsCommand(),
      this.createStatusCommand(),
      this.createClearCommand(),
      this.createHistoryCommand(),
      this.createExitCommand(),
      this.createTimeCommand(),
    ];
  }
}
