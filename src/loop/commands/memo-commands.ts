/**
 * Memo Commands
 *
 * 注册 memo 相关命令到 CommandManager
 */

import chalk from 'chalk';
import { Command, CommandContext, CommandResult } from './types';
import { CommandManager } from './command-manager';
import { MemoCliPlugin, Decision } from '../plugins/memo-cli-plugin';
import { TaskTracker } from '../../task-tracker/tracker'; // 🔥 新增：导入 TaskTracker
import { TaskDocument } from '../../task-tracker/types'; // 🔥 新增：导入 TaskDocument 类型

/**
 * 注册所有 Memo 命令
 *
 * @param commandManager 命令管理器
 * @param memoPlugin Memo CLI 插件实例
 * @param taskTracker 任务追踪器实例（可选）
 */
export function registerMemoCommands(
  commandManager: CommandManager,
  memoPlugin: MemoCliPlugin,
  taskTracker?: TaskTracker // 🔥 新增参数
): void {
  /**
   * /decision - 记录项目决策
   */
  commandManager.register({
    name: 'decision',
    description: 'Record a project decision to memo',
    handler: async (context: CommandContext): Promise<CommandResult> => {
      try {
        const args = context.args;

        if (args.length < 2) {
          return {
            success: false,
            error: 'Usage: /decision <title> <content> [--tags tag1,tag2]',
          };
        }

        const title = args[0];
        const content = args[1];

        // 解析标签（如果有）
        const tags: string[] = [];
        const tagIndex = args.findIndex(arg => arg === '--tags');
        if (tagIndex !== -1 && args[tagIndex + 1]) {
          const tagStr = args[tagIndex + 1];
          tags.push(...tagStr.split(',').map(t => t.trim()));
        }

        await memoPlugin.recordDecision(title, content, tags);

        return {
          success: true,
          output: chalk.green('✓ Decision recorded:') + ` ${title}\n` +
                   chalk.cyan('  Tags:') + ` ${tags.join(', ') || 'none'}`,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to record decision: ${error}`,
        };
      }
    },
    help: {
      name: 'decision',
      description: 'Record a project decision to memo',
      usage: '/decision <title> <content> [--tags tag1,tag2]',
      examples: [
        '/decision "Use PostgreSQL" "Better JSON support" --tags database,architecture',
        '/decision "Add authentication" "Implement JWT auth" --tags feature,security',
      ],
      category: 'memory',
    },
  }, 'memo');

  /**
   * /decisions - 搜索历史决策
   */
  commandManager.register({
    name: 'decisions',
    description: 'Search historical decisions in memo',
    handler: async (context: CommandContext): Promise<CommandResult> => {
      try {
        const args = context.args;
        const query = args[0] || '';

        // 解析选项
        const options: any = {};
        const tagIndex = args.findIndex(arg => arg === '--tag');
        if (tagIndex !== -1 && args[tagIndex + 1]) {
          options.tag = args[tagIndex + 1];
        }

        const results = await memoPlugin.searchDecisions(query, options);

        if (results.length === 0) {
          return {
            success: true,
            output: chalk.yellow('No decisions found'),
          };
        }

        let output = chalk.bold(`📋 Found ${results.length} decision(s):\n\n`);

        results.forEach((decision: Decision) => {
          const date = new Date(decision.timestamp).toLocaleDateString();
          output += chalk.cyan(`[${date}] ${decision.title}\n`);
          output += chalk.gray(`  ${decision.content.substring(0, 100)}...\n`);

          if (decision.tags.length > 0) {
            output += chalk.gray(`  Tags: ${decision.tags.join(', ')}\n`);
          }

          output += '\n';
        });

        return {
          success: true,
          output,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to search decisions: ${error}`,
        };
      }
    },
    help: {
      name: 'decisions',
      description: 'Search historical decisions in memo',
      usage: '/decisions [query] [--tag tag1,tag2]',
      examples: [
        '/decisions architecture',
        '/decisions "" --tag database',
        '/decisions authentication --tag security',
      ],
      category: 'memory',
    },
  }, 'memo');

  /**
   * /memo-index - 索引项目代码
   */
  commandManager.register({
    name: 'memo-index',
    description: 'Index project code with memo',
    handler: async (context: CommandContext): Promise<CommandResult> => {
      try {
        await memoPlugin.indexProject();

        const stats = await memoPlugin.getStats();

        return {
          success: true,
          output: chalk.green('✓ Project indexed\n') +
                   chalk.cyan(`  Files: ${stats.files}\n`) +
                   chalk.cyan(`  Decisions: ${stats.decisions}`),
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to index project: ${error}`,
        };
      }
    },
    help: {
      name: 'memo-index',
      description: 'Index project code with memo',
      usage: '/memo-index',
      examples: ['/memo-index'],
      category: 'memory',
    },
  }, 'memo');

  /**
   * /find - 查找相关代码
   */
  commandManager.register({
    name: 'find',
    description: 'Find related code using memo index',
    handler: async (context: CommandContext): Promise<CommandResult> => {
      try {
        const args = context.args;

        if (args.length === 0) {
          return {
            success: false,
            error: 'Usage: /find <keyword>',
          };
        }

        const keyword = args[0];
        const results = await memoPlugin.findRelated(keyword);

        if (results.length === 0) {
          return {
            success: true,
            output: chalk.yellow(`No results found for "${keyword}"`),
          };
        }

        let output = chalk.bold(`🔍 Found ${results.length} result(s) for "${keyword}":\n\n`);

        results.forEach(({ file, info }) => {
          output += chalk.cyan(`✓ ${file}\n`);
          output += chalk.gray(`    Lines: ${info.lines}`);

          if (info.classes.length > 0) {
            output += chalk.gray(` | Classes: ${info.classes.join(', ')}`);
          }

          if (info.functions.length > 0) {
            output += chalk.gray(` | Functions: ${info.functions.slice(0, 3).join(', ')}${info.functions.length > 3 ? '...' : ''}`);
          }

          output += '\n\n';
        });

        return {
          success: true,
          output,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to find code: ${error}`,
        };
      }
    },
    help: {
      name: 'find',
      description: 'Find related code using memo index',
      usage: '/find <keyword>',
      examples: [
        '/find UserService',
        '/find Auth',
        '/find Controller',
      ],
      category: 'memory',
    },
  }, 'memo');

  /**
   * /memo-doc - 生成项目文档
   */
  commandManager.register({
    name: 'memo-doc',
    description: 'Generate project documentation from memo',
    handler: async (context: CommandContext): Promise<CommandResult> => {
      try {
        const output = await memoPlugin.generateDoc();

        return {
          success: true,
          output: chalk.green('✓ Documentation generated (MEMO.md)'),
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to generate doc: ${error}`,
        };
      }
    },
    help: {
      name: 'memo-doc',
      description: 'Generate project documentation from memo',
      usage: '/memo-doc',
      examples: ['/memo-doc'],
      category: 'memory',
    },
  }, 'memo');

  /**
   * /memo-stats - 查看记忆统计
   */
  commandManager.register({
    name: 'memo-stats',
    description: 'Show memory statistics',
    handler: async (context: CommandContext): Promise<CommandResult> => {
      try {
        const stats = await memoPlugin.getStats();

        let output = chalk.bold('📊 Memory Statistics\n\n');
        output += chalk.cyan(`  Indexed Files: ${stats.files}\n`);
        output += chalk.cyan(`  Decisions: ${stats.decisions}\n`);

        return {
          success: true,
          output,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get stats: ${error}`,
        };
      }
    },
    help: {
      name: 'memo-stats',
      description: 'Show memory statistics',
      usage: '/memo-stats',
      examples: ['/memo-stats'],
      category: 'memory',
    },
  }, 'memo');

  // 🔥 新增：任务相关命令

  /**
   * /tasks - 查看任务历史
   */
  if (taskTracker) {
    commandManager.register({
      name: 'tasks',
      description: 'Show task history',
      handler: async (context: CommandContext): Promise<CommandResult> => {
        try {
          const args = context.args;
          const filter: any = {};

          // 解析过滤参数
          if (args.includes('--completed')) {
            filter.status = 'completed';
          } else if (args.includes('--failed')) {
            filter.status = 'failed';
          } else if (args.includes('--running')) {
            filter.status = 'running';
          } else if (args.includes('--pending')) {
            filter.status = 'pending';
          }

          // 解析 limit 参数
          const limitIndex = args.indexOf('--limit');
          if (limitIndex !== -1 && args[limitIndex + 1]) {
            filter.limit = parseInt(args[limitIndex + 1], 10);
          }

          // 获取任务列表
          const tasks = await taskTracker.listTasks(filter);

          if (tasks.length === 0) {
            return {
              success: true,
              output: chalk.yellow('No tasks found'),
            };
          }

          let output = chalk.bold(`📋 Task History (${tasks.length} task${tasks.length > 1 ? 's' : ''})\n\n`);

          tasks.slice(0, 20).forEach((task: TaskDocument) => {
            const date = new Date(task.createdAt).toLocaleDateString();
            const status = task.metadata?.status || task.status || 'unknown';
            const mode = task.mode;
            const requirement = task.requirement?.substring(0, 60) || '(no requirement)';

            output += `${chalk.cyan(`[${date}]`)} ${chalk.bold(status.toUpperCase())} | ${mode}\n`;
            output += `  ${requirement}${task.requirement && task.requirement.length >= 60 ? '...' : ''}\n`;
            output += `  ID: ${task.id}\n\n`;
          });

          if (tasks.length > 20) {
            output += chalk.gray(`... and ${tasks.length - 20} more task(s)\n\n`);
          }

          return {
            success: true,
            output,
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to list tasks: ${error}`,
          };
        }
      },
      help: {
        name: 'tasks',
        description: 'Show task history',
        usage: '/tasks [--completed|--failed|--running|--pending] [--limit N]',
        examples: [
          '/tasks',
          '/tasks --completed',
          '/tasks --failed --limit 5',
        ],
        category: 'memory',
      },
    }, 'memo');

    /**
     * /task-search - 搜索任务
     */
    commandManager.register({
      name: 'task-search',
      description: 'Search tasks by keyword',
      handler: async (context: CommandContext): Promise<CommandResult> => {
        try {
          const args = context.args;

          if (args.length === 0) {
            return {
              success: false,
              error: 'Usage: /task-search <query>',
            };
          }

          const query = args[0];

          // 使用 Memo Plugin 搜索任务
          const tasks = await memoPlugin.searchTasks(query);

          if (tasks.length === 0) {
            return {
              success: true,
              output: chalk.yellow(`No tasks found matching "${query}"`),
            };
          }

          let output = chalk.bold(`🔍 Found ${tasks.length} task(s) matching "${query}"\n\n`);

          tasks.forEach((task) => {
            const date = new Date(task.createdAt).toLocaleDateString();
            const status = task.status;
            const mode = task.mode;

            output += `${chalk.cyan(`[${date}]`)} ${chalk.bold(status.toUpperCase())} | ${mode}\n`;
            output += `  ${task.requirement}\n`;
            output += `  ID: ${task.id}\n\n`;
          });

          return {
            success: true,
            output,
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to search tasks: ${error}`,
          };
        }
      },
      help: {
        name: 'task-search',
        description: 'Search tasks by keyword',
        usage: '/task-search <query>',
        examples: [
          '/task-search auth',
          '/task-search "用户认证"',
          '/task-search refactor',
        ],
        category: 'memory',
      },
    }, 'memo');

  /**
   * /memory-history - 查看执行历史
   */
  commandManager.register({
    name: 'memory-history',
    description: 'View execution history from memory',
    handler: async (context: CommandContext): Promise<CommandResult> => {
      try {
        const args = context.args;
        const limit = args[0] ? parseInt(args[0], 10) : 5;

        const summary = await memoPlugin.getExecutionSummary(7);
        if (!summary) {
          return {
            success: true,
            output: chalk.yellow('No execution history found'),
          };
        }

        let output = chalk.bold(`📜 Execution History (Last ${limit})\n\n`);
        output += `${chalk.cyan('Total Commands:')} ${summary.totalCommands}\n`;
        output += `${chalk.cyan('Success Rate:')} ${(summary.averageSuccessRate * 100).toFixed(1)}%\n`;
        output += `${chalk.cyan('Total Duration:')} ${summary.totalDuration}ms\n\n`;

        // 获取最近的命令
        const sessions = await memoPlugin.getRecentSessions(limit);
        if (sessions && sessions.length > 0) {
          sessions.slice(0, limit).forEach((session: any, index: number) => {
            output += `${chalk.green((index + 1).toString() + '.')} ${chalk.bold(session.title || 'Untitled')}\n`;
            output += `   Status: ${session.status}\n`;
            output += `   Messages: ${session.stats?.messageCount || 0}\n`;
            if (session.stats?.duration) {
              output += `   Duration: ${Math.floor(session.stats.duration / 1000)}s\n`;
            }
            output += `\n`;
          });
        }

        return {
          success: true,
          output,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get execution history: ${error}`,
        };
      }
    },
    help: {
      name: 'memory-history',
      description: 'View execution history from memory',
      usage: '/memory-history [limit]',
      examples: ['/memory-history', '/memory-history 10'],
      category: 'memory',
    },
  }, 'memo');

  /**
   * /memory-errors - 查看错误记录
   */
  commandManager.register({
    name: 'memory-errors',
    description: 'View error solutions from memory',
    handler: async (context: CommandContext): Promise<CommandResult> => {
      try {
        const args = context.args;
        const limit = args[0] ? parseInt(args[0], 10) : 5;

        const summary = await memoPlugin.getErrorSummary(7);
        if (!summary) {
          return {
            success: true,
            output: chalk.yellow('No errors found'),
          };
        }

        let output = chalk.bold(`❌ Error Solutions (Last ${limit})\n\n`);
        output += `${chalk.cyan('Total Errors:')} ${summary.totalErrors}\n`;
        output += `${chalk.cyan('Resolved:')} ${summary.resolvedErrors}\n`;
        output += `${chalk.cyan('Resolution Rate:')} ${(summary.resolutionRate * 100).toFixed(1)}%\n\n`;

        // 搜索最近的错误
        const errors = await memoPlugin.searchErrors({ limit });
        if (errors && errors.length > 0) {
          errors.slice(0, limit).forEach((error: any, index: number) => {
            output += `${chalk.red((index + 1).toString() + '.')} ${chalk.bold(error.errorType)}\n`;
            output += `   Error: ${error.errorMessage.substring(0, 80)}${error.errorMessage.length > 80 ? '...' : ''}\n`;
            output += `   Status: ${error.occurrenceCount} occurrence(s)\n`;
            if (error.solutions && error.solutions.length > 0) {
              output += `   Solution: ${error.solutions[0].description.substring(0, 60)}...\n`;
            }
            output += `\n`;
          });
        }

        return {
          success: true,
          output,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get error solutions: ${error}`,
        };
      }
    },
    help: {
      name: 'memory-errors',
      description: 'View error solutions from memory',
      usage: '/memory-errors [limit]',
      examples: ['/memory-errors', '/memory-errors 10'],
      category: 'memory',
    },
  }, 'memo');

  /**
   * /memory-prefs - 查看用户偏好
   */
  commandManager.register({
    name: 'memory-prefs',
    description: 'View user preferences from memory',
    handler: async (context: CommandContext): Promise<CommandResult> => {
      try {
        const prefs = await memoPlugin.getUserPreferences();
        if (!prefs) {
          return {
            success: true,
            output: chalk.yellow('No user preferences found'),
          };
        }

        let output = chalk.bold('⚙️  User Preferences\n\n');

        output += `${chalk.cyan('Language:')} ${prefs.aiInteraction.language}\n`;
        output += `${chalk.cyan('Verbosity:')} ${prefs.aiInteraction.verbosity}\n`;
        output += `${chalk.cyan('Algorithm:')} ${prefs.aiInteraction.planningAlgorithm}\n\n`;

        output += `${chalk.bold('Code Style:')}\n`;
        output += `  Indent: ${prefs.codeStyle.indent} (${prefs.codeStyle.indentSize} spaces)\n`;
        output += `  Quotes: ${prefs.codeStyle.quoteStyle}\n`;
        output += `  Naming: ${prefs.codeStyle.namingConvention}\n\n`;

        output += `${chalk.bold('Tools:')}\n`;
        output += `  Package Manager: ${prefs.tools.preferredPackageManager}\n`;
        output += `  Test Framework: ${prefs.tools.testFramework}\n`;
        output += `  Linter: ${prefs.tools.linters.join(', ')}\n\n`;

        output += `${chalk.bold('Tech Stack:')}\n`;
        output += `  Languages: ${prefs.techStack.primaryLanguages.join(', ')}\n`;
        output += `  Frameworks: ${prefs.techStack.preferredFrameworks.join(', ')}\n\n`;

        output += `${chalk.gray('Updated: ')}${prefs.lastUpdated}\n`;

        return {
          success: true,
          output,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get user preferences: ${error}`,
        };
      }
    },
    help: {
      name: 'memory-prefs',
      description: 'View user preferences from memory',
      usage: '/memory-prefs',
      examples: ['/memory-prefs'],
      category: 'memory',
    },
  }, 'memo');

  /**
   * /memory-sessions - 查看会话历史
   */
  commandManager.register({
    name: 'memory-sessions',
    description: 'View session history from memory',
    handler: async (context: CommandContext): Promise<CommandResult> => {
      try {
        const args = context.args;
        const limit = args[0] ? parseInt(args[0], 10) : 5;

        const sessions = await memoPlugin.getRecentSessions(limit);
        if (!sessions || sessions.length === 0) {
          return {
            success: true,
            output: chalk.yellow('No sessions found'),
          };
        }

        let output = chalk.bold(`💬 Session History (Last ${limit})\n\n`);

        sessions.slice(0, limit).forEach((session: any, index: number) => {
          output += `${chalk.green((index + 1).toString() + '.')} ${chalk.bold(session.title)}\n`;
          output += `   Status: ${session.status}\n`;
          output += `   Messages: ${session.stats?.messageCount || 0}\n`;
          if (session.stats?.duration) {
            output += `   Duration: ${Math.floor(session.stats.duration / 1000)}s\n`;
          }
          if (session.contextVector?.topics) {
            output += `   Topics: ${session.contextVector.topics.slice(0, 3).join(', ')}\n`;
          }
          output += `\n`;
        });

        return {
          success: true,
          output,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get session history: ${error}`,
        };
      }
    },
    help: {
      name: 'memory-sessions',
      description: 'View session history from memory',
      usage: '/memory-sessions [limit]',
      examples: ['/memory-sessions', '/memory-sessions 10'],
      category: 'memory',
    },
  }, 'memo');

  /**
   * /memory-reasoning - 查看推理过程
   */
  commandManager.register({
    name: 'memory-reasoning',
    description: 'View reasoning process from memory',
    handler: async (context: CommandContext): Promise<CommandResult> => {
      try {
        const args = context.args;
        const limit = args[0] ? parseInt(args[0], 10) : 3;

        const stats = memoPlugin.getReasoningStats();
        if (!stats || stats.totalChains === 0) {
          return {
            success: true,
            output: chalk.yellow('No reasoning chains found'),
          };
        }

        let output = chalk.bold(`🧠 Reasoning Process (Last ${limit})\n\n`);
        output += `${chalk.cyan('Total Chains:')} ${stats.totalChains}\n`;
        output += `${chalk.cyan('Total Steps:')} ${stats.totalSteps}\n`;
        output += `${chalk.cyan('Success Rate:')} ${(stats.overallSuccessRate * 100).toFixed(1)}%\n\n`;

        // 获取最近的推理链
        const chains = await memoPlugin.searchSimilarReasoning('', '', limit);
        if (chains && chains.length > 0) {
          chains.slice(0, limit).forEach((result: any, index: number) => {
            const chain = result.chain;
            output += `${chalk.green((index + 1).toString() + '.')} ${chalk.bold(chain.task)}\n`;
            output += `   Type: ${chain.taskType}\n`;
            output += `   Status: ${chain.status}\n`;
            output += `   Steps: ${chain.stats.totalSteps}\n`;
            if (chain.learnedPatterns?.preferredAlgorithm) {
              output += `   Algorithm: ${chain.learnedPatterns.preferredAlgorithm}\n`;
            }
            output += `\n`;
          });
        }

        return {
          success: true,
          output,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get reasoning process: ${error}`,
        };
      }
    },
    help: {
      name: 'memory-reasoning',
      description: 'View reasoning process from memory',
      usage: '/memory-reasoning [limit]',
      examples: ['/memory-reasoning', '/memory-reasoning 5'],
      category: 'memory',
    },
  }, 'memo');

  /**
   * /memory-stats - 查看记忆统计
   */
  commandManager.register({
    name: 'memory-stats',
    description: 'View memory system statistics',
    handler: async (context: CommandContext): Promise<CommandResult> => {
      try {
        let output = chalk.bold('📊 Memory System Statistics\n\n');

        // 执行历史统计
        const execSummary = await memoPlugin.getExecutionSummary(7);
        if (execSummary) {
          output += `${chalk.bold('Execution History:')}\n`;
          output += `  Commands: ${execSummary.totalCommands}\n`;
          output += `  Success Rate: ${(execSummary.averageSuccessRate * 100).toFixed(1)}%\n`;
          output += `  Duration: ${execSummary.totalDuration}ms\n\n`;
        }

        // 错误统计
        const errorSummary = await memoPlugin.getErrorSummary(7);
        if (errorSummary) {
          output += `${chalk.bold('Error Solutions:')}\n`;
          output += `  Total: ${errorSummary.totalErrors}\n`;
          output += `  Resolved: ${errorSummary.resolvedErrors}\n`;
          output += `  Resolution Rate: ${(errorSummary.resolutionRate * 100).toFixed(1)}%\n\n`;
        }

        // 推理统计
        const reasoningStats = memoPlugin.getReasoningStats();
        if (reasoningStats && reasoningStats.totalChains > 0) {
          output += `${chalk.bold('Reasoning Process:')}\n`;
          output += `  Chains: ${reasoningStats.totalChains}\n`;
          output += `  Steps: ${reasoningStats.totalSteps}\n`;
          output += `  Success Rate: ${(reasoningStats.overallSuccessRate * 100).toFixed(1)}%\n\n`;
        }

        // 用户偏好
        const prefs = await memoPlugin.getUserPreferences();
        if (prefs) {
          output += `${chalk.bold('User Preferences:')}\n`;
          output += `  Language: ${prefs.aiInteraction.language}\n`;
          output += `  Verbosity: ${prefs.aiInteraction.verbosity}\n`;
          output += `  Last Updated: ${new Date(prefs.lastUpdated).toLocaleDateString()}\n\n`;
        }

        output += chalk.gray('All data stored in .memo/ directory\n');
        output += chalk.gray('No data deletion - permanent retention!\n');

        return {
          success: true,
          output,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get statistics: ${error}`,
        };
      }
    },
    help: {
      name: 'memory-stats',
      description: 'View memory system statistics',
      usage: '/memory-stats',
      examples: ['/memory-stats'],
      category: 'memory',
    },
  }, 'memo');
  }
}
