/**
 * Custom Commands Plugin
 *
 * 展示如何创建自定义命令插件
 * 添加一些实用的开发命令
 */

import chalk from 'chalk';
import { Command } from '../../src/loop/commands/types';
import { CommandContext, CommandResult } from '../../src/loop/commands/types';
import { LoopPlugin, LoopPluginContext, BeforeInputResult } from '../../src/loop/interfaces/plugin';
import { execFileNoThrow } from '../../utils/execFileNoThrow';
import fs from 'fs';
import path from 'path';

/**
 * 自定义命令插件
 *
 * 提供实用的开发命令：
 * - /git - Git 操作快捷命令
 * - /npm - NPM 操作快捷命令
 * - /env - 环境变量管理
 * - /config - 项目配置查看
 */
export class CustomCommandsPlugin implements LoopPlugin {
  id = 'custom-commands-plugin';
  name = 'Custom Commands Plugin';
  description = 'Useful development commands';
  version = '1.0.0';
  type = 'command' as const;

  tools = [];
  config = { enabled: true };
  configSchema = undefined;
  dependencies = [];
  metadata = {
    author: 'Kode Team',
    license: 'MIT',
  };

  private commands: Command[] = [];

  async initialize(context: any): Promise<void> {
    // 初始化命令列表
    this.commands = [
      this.createGitCommand(),
      this.createNpmCommand(),
      this.createEnvCommand(),
      this.createConfigCommand(),
    ];

    console.log(chalk.gray('[Custom Commands Plugin] Initialized'));
  }

  async cleanup(context: any): Promise<void> {
    console.log(chalk.gray('[Custom Commands Plugin] Cleaned up'));
  }

  /**
   * 创建 Git 命令
   */
  private createGitCommand(): Command {
    return {
      name: 'git',
      description: 'Git operations shortcut',
      handler: async (context: CommandContext): Promise<CommandResult> => {
        const { args, session } = context;

        if (args.length === 0) {
          return {
            success: false,
            error: 'Usage: /git <command> [args...] (e.g., /git status, /git log -5)',
          };
        }

        try {
          const result = await execFileNoThrow('git', args, {
            cwd: session.projectRoot,
          });

          if (result.status !== 0) {
            return {
              success: false,
              error: `Git command failed: ${result.stderr}`,
            };
          }

          console.log(chalk.cyan('\n📂 Git Output:'));
          console.log(chalk.gray(result.stdout));

          return {
            success: true,
            output: `Git command executed: git ${args.join(' ')}`,
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Git command failed: ${error.message}`,
          };
        }
      },
      help: {
        name: 'git',
        description: 'Execute git commands',
        usage: '/git <command> [args...]',
        examples: [
          '/git status',
          '/git log -5',
          '/git diff',
          '/git branch -a',
        ],
        category: 'development',
      },
    };
  }

  /**
   * 创建 NPM 命令
   */
  private createNpmCommand(): Command {
    return {
      name: 'npm',
      description: 'NPM operations shortcut',
      handler: async (context: CommandContext): Promise<CommandResult> => {
        const { args, session } = context;

        if (args.length === 0) {
          return {
            success: false,
            error: 'Usage: /npm <command> [args...] (e.g., /npm test, /npm run build)',
          };
        }

        try {
          const result = await execFileNoThrow('npm', args, {
            cwd: session.projectRoot,
          });

          if (result.status !== 0) {
            return {
              success: false,
              error: `NPM command failed: ${result.stderr}`,
            };
          }

          console.log(chalk.cyan('\n📦 NPM Output:'));
          console.log(chalk.gray(result.stdout));

          return {
            success: true,
            output: `NPM command executed: npm ${args.join(' ')}`,
          };
        } catch (error: any) {
          return {
            success: false,
            error: `NPM command failed: ${error.message}`,
          };
        }
      },
      help: {
        name: 'npm',
        description: 'Execute npm commands',
        usage: '/npm <command> [args...]',
        examples: [
          '/npm test',
          '/npm run build',
          '/npm install',
          '/npm outdated',
        ],
        category: 'development',
      },
    };
  }

  /**
   * 创建环境变量命令
   */
  private createEnvCommand(): Command {
    return {
      name: 'env',
      description: 'Environment variables management',
      handler: async (context: CommandContext): Promise<CommandResult> => {
        const { args, session } = context;

        const action = args[0];

        if (action === 'list' || !action) {
          // 列出所有环境变量
          console.log(chalk.cyan('\n🔐 Environment Variables:'));
          console.log(chalk.cyan('═'.repeat(50)));

          const envFile = path.join(session.projectRoot, '.env');
          if (fs.existsSync(envFile)) {
            const envContent = fs.readFileSync(envFile, 'utf-8');
            const lines = envContent.split('\n').filter(line => {
              return line.trim() && !line.startsWith('#');
            });

            lines.forEach(line => {
              const [key, ...valueParts] = line.split('=');
              const value = valueParts.join('=');
              const maskedValue = value.includes('secret') || value.includes('key') || value.includes('token')
                ? '***hidden***'
                : value;

              console.log(chalk.white(`${key}`) + chalk.gray(`=${maskedValue}`));
            });
          } else {
            console.log(chalk.yellow('No .env file found'));
          }

          console.log(chalk.cyan('═'.repeat(50)) + '\n');

          return { success: true, output: 'Environment variables listed' };
        }

        if (action === 'get') {
          const key = args[1];
          if (!key) {
            return { success: false, error: 'Usage: /env get <KEY>' };
          }

          const value = process.env[key];
          if (value) {
            console.log(chalk.white(`${key}=`) + chalk.yellow(value));
            return { success: true, output: `${key}=${value}` };
          } else {
            return { success: false, error: `Environment variable not found: ${key}` };
          }
        }

        return {
          success: false,
          error: 'Usage: /env [list|get <KEY>]',
        };
      },
      config: {
        aliases: ['environment'],
      },
      help: {
        name: 'env',
        description: 'Manage environment variables',
        usage: '/env [list|get <KEY>]',
        examples: ['/env', '/env list', '/env get API_KEY'],
        category: 'development',
      },
    };
  }

  /**
   * 创建配置命令
   */
  private createConfigCommand(): Command {
    return {
      name: 'config',
      description: 'View project configuration',
      handler: async (context: CommandContext): Promise<CommandResult> => {
        const { session, args } = context;

        const configKey = args[0];

        console.log(chalk.cyan('\n⚙️  Project Configuration:'));
        console.log(chalk.cyan('═'.repeat(50)));

        if (configKey) {
          // 显示特定配置
          const value = (session.config as any)[configKey];
          if (value !== undefined) {
            console.log(chalk.white(`${configKey}:`) + chalk.gray(` ${JSON.stringify(value, null, 2)}`));
          } else {
            console.log(chalk.yellow(`Configuration key not found: ${configKey}`));
          }
        } else {
          // 显示所有配置
          const config = session.config as any;
          Object.keys(config).forEach(key => {
            const value = config[key];
            const displayValue = typeof value === 'object'
              ? JSON.stringify(value, null, 2)
              : String(value);

            console.log(chalk.white(`${key}:`) + chalk.gray(` ${displayValue}`));
          });
        }

        console.log(chalk.cyan('═'.repeat(50)) + '\n');

        return { success: true, output: 'Configuration displayed' };
      },
      help: {
        name: 'config',
        description: 'View project configuration',
        usage: '/config [key]',
        examples: ['/config', '/config model', '/config permissionLevel'],
        category: 'development',
      },
    };
  }

  /**
   * 获取所有命令
   */
  getCommands(): Command[] {
    return this.commands;
  }
}

/**
 * 导出插件实例
 */
export default new CustomCommandsPlugin();
