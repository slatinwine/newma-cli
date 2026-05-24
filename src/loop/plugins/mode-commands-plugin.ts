/**
 * Mode Commands Plugin
 *
 * 提供模式切换命令：/plan, /do, /loop, /chat, /execute, /verify
 */

import chalk from 'chalk';
import {
  Command,
  CommandContext,
  CommandResult,
} from '../commands/types';
import { OutputStyle } from '../interfaces/frontend';

export class ModeCommandsPlugin {
  /**
   * 检查是否为有效的任务需求
   *
   * 从 repl.ts 移植过来的验证逻辑
   */
  private static isValidTaskRequirement(requirement: string): boolean {
    if (!requirement || requirement.trim().length === 0) {
      return false;
    }

    const trimmed = requirement.trim().toLowerCase();

    // 检查是否为过短的需求
    if (trimmed.length < 3) {
      return false;
    }

    return true;
  }

  /**
   * 创建 /plan 命令
   */
  static createPlanCommand(): Command {
    return {
      name: 'plan',
      description: 'Switch to plan mode for task planning',
      handler: async (context: CommandContext): Promise<CommandResult> => {
        const { session, args, frontend } = context;

        if (args.length === 0) {
          frontend?.writeOutput(
            'Usage: /plan <your requirement>\n' +
            'Example: /plan Add a login page\n' +
            '         /do Create a REST API\n',
            OutputStyle.WARNING
          );
          return { success: false, output: 'Missing requirement' };
        }

        const requirement = args.join(' ');

        // 🔥 验证需求
        if (!this.isValidTaskRequirement(requirement)) {
          frontend?.writeOutput(
            '\n⚠️  Invalid task requirement\n' +
            'Please provide a valid task description (at least 3 characters).\n',
            OutputStyle.WARNING
          );
          return { success: false, output: 'Invalid requirement' };
        }

        // 切换到 plan 模式
        session.switchMode('plan');

        frontend?.writeOutput(`\n📋 Planning: ${requirement}\n`, OutputStyle.INFO);

        return {
          success: true,
          output: 'Switched to plan mode',
          metadata: {
            mode: 'plan',
            requirement,
            execute: true, // 告诉 LoopEngine 执行该模式
          },
        };
      },
      help: {
        name: 'plan',
        description: 'Switch to plan mode and create a task plan',
        usage: '/plan <requirement>',
        examples: [
          '/plan Add a login page',
          '/plan Create a REST API',
        ],
        category: 'mode',
      },
    };
  }

  /**
   * 创建 /do 命令（/plan 的别名，但带意图识别）
   */
  static createDoCommand(): Command {
    return {
      name: 'do',
      description: 'Execute a task with auto-intent recognition',
      handler: async (context: CommandContext): Promise<CommandResult> => {
        const { session, args, frontend } = context;

        if (args.length === 0) {
          frontend?.writeOutput(
            'Usage: /do <your requirement>\n' +
            'Example: /do Fix the login bug\n' +
            '         /do Add unit tests\n',
            OutputStyle.WARNING
          );
          return { success: false, output: 'Missing requirement' };
        }

        const requirement = args.join(' ');

        // 🔥 验证需求
        if (!this.isValidTaskRequirement(requirement)) {
          frontend?.writeOutput(
            '\n⚠️  Invalid task requirement\n' +
            'Please provide a valid task description (at least 3 characters).\n',
            OutputStyle.WARNING
          );
          return { success: false, output: 'Invalid requirement' };
        }

        // 切换到 plan 模式
        session.switchMode('plan');

        frontend?.writeOutput(`\n🎯 Executing: ${requirement}\n`, OutputStyle.INFO);

        return {
          success: true,
          output: 'Switched to plan mode',
          metadata: {
            mode: 'plan',
            requirement,
            execute: true,
            // 标记为 /do 命令，可以触发意图识别
            isDoCommand: true,
          },
        };
      },
      help: {
        name: 'do',
        description: 'Execute a task with auto-intent recognition (similar to /plan)',
        usage: '/do <requirement>',
        examples: [
          '/do Fix the login bug',
          '/do Add unit tests',
        ],
        category: 'mode',
      },
    };
  }

  /**
   * 创建 /loop 命令
   */
  static createLoopCommand(): Command {
    return {
      name: 'loop',
      description: 'Switch to loop mode for iterative execution',
      handler: async (context: CommandContext): Promise<CommandResult> => {
        const { session, args, frontend } = context;

        if (args.length === 0) {
          frontend?.writeOutput(
            'Usage: /loop [maxIterations] <your requirement>\n' +
            'Example: /loop Add user authentication         (infinite loop)\n' +
            '         /loop 10 Create a REST API             (max 10 iterations)\n',
            OutputStyle.WARNING
          );
          return { success: false, output: 'Missing requirement' };
        }

        // 解析参数
        let maxIterations: number | undefined;
        let requirement = args.join(' ');

        // 检查第一个参数是否是数字
        const firstArg = args[0];
        if (/^\d+$/.test(firstArg)) {
          maxIterations = parseInt(firstArg, 10);
          requirement = args.slice(1).join(' ');
        }

        if (!requirement) {
          frontend?.writeOutput('Error: Missing requirement\n', OutputStyle.ERROR);
          return { success: false, output: 'Missing requirement' };
        }

        // 切换到 loop 模式
        session.switchMode('loop');

        if (maxIterations) {
          session.maxIterations = maxIterations;
        }

        frontend?.writeOutput(
          `\n🔁 Loop Mode: ${requirement}\n` +
          (maxIterations ? `Max iterations: ${maxIterations}\n` : 'Infinite loop\n'),
          OutputStyle.INFO
        );

        return {
          success: true,
          output: 'Switched to loop mode',
          metadata: {
            mode: 'loop',
            requirement,
            maxIterations,
            execute: true,
          },
        };
      },
      help: {
        name: 'loop',
        description: 'Execute task in loop mode until completion',
        usage: '/loop [maxIterations] <requirement>',
        examples: [
          '/loop Add user authentication',
          '/loop 10 Fix all bugs',
        ],
        category: 'mode',
      },
    };
  }

  /**
   * 创建 /chat 命令
   */
  static createChatCommand(): Command {
    return {
      name: 'chat',
      description: 'Switch to chat mode for conversation',
      handler: async (context: CommandContext): Promise<CommandResult> => {
        const { session, args, frontend } = context;

        if (args.length === 0) {
          session.switchMode('chat');
          frontend?.writeOutput('\n💬 Switched to chat mode\n', OutputStyle.INFO);
          return {
            success: true,
            output: 'Switched to chat mode',
            metadata: { mode: 'chat' },
          };
        }

        // 如果有参数，直接在 chat 模式下处理
        const message = args.join(' ');
        session.switchMode('chat');

        return {
          success: true,
          output: 'Chat mode',
          metadata: {
            mode: 'chat',
            message,
            execute: true,
          },
        };
      },
      help: {
        name: 'chat',
        description: 'Switch to chat mode for conversation',
        usage: '/chat [message]',
        examples: [
          '/chat',
          '/chat Hello, how are you?',
        ],
        category: 'mode',
      },
    };
  }

  /**
   * 创建 /execute 命令
   */
  static createExecuteCommand(): Command {
    return {
      name: 'execute',
      description: 'Switch to execute mode',
      handler: async (context: CommandContext): Promise<CommandResult> => {
        const { session, args, frontend } = context;

        if (args.length === 0) {
          session.switchMode('execute');
          frontend?.writeOutput('\n⚡ Switched to execute mode\n', OutputStyle.INFO);
          return {
            success: true,
            output: 'Switched to execute mode',
            metadata: { mode: 'execute' },
          };
        }

        const command = args.join(' ');
        session.switchMode('execute');

        return {
          success: true,
          output: 'Execute mode',
          metadata: {
            mode: 'execute',
            command,
            execute: true,
          },
        };
      },
      help: {
        name: 'execute',
        description: 'Switch to execute mode',
        usage: '/execute [command]',
        examples: ['/execute', '/execute run tests'],
        category: 'mode',
      },
    };
  }

  /**
   * 创建 /verify 命令
   */
  static createVerifyCommand(): Command {
    return {
      name: 'verify',
      description: 'Switch to verify mode',
      handler: async (context: CommandContext): Promise<CommandResult> => {
        const { session, frontend } = context;

        session.switchMode('verify');
        frontend?.writeOutput('\n✓ Switched to verify mode\n', OutputStyle.INFO);

        return {
          success: true,
          output: 'Switched to verify mode',
          metadata: { mode: 'verify' },
        };
      },
      help: {
        name: 'verify',
        description: 'Switch to verify mode',
        usage: '/verify',
        category: 'mode',
      },
    };
  }

  /**
   * 获取所有模式命令
   */
  static getAllCommands(): Command[] {
    return [
      this.createPlanCommand(),
      this.createDoCommand(),
      this.createLoopCommand(),
      this.createChatCommand(),
      this.createExecuteCommand(),
      this.createVerifyCommand(),
    ];
  }
}
