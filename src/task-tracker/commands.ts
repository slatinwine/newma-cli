/**
 * Task Commands - CLI command handlers
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { TaskTracker } from './tracker';
import { TaskDisplay, DisplayOptions } from './display';
import { TaskFilter } from './types';

/**
 * Task commands class
 */
export class TaskCommands {
  constructor(
    private tracker: TaskTracker,
    private display: TaskDisplay
  ) {}

  /**
   * Handle /tasks command (list all tasks)
   */
  async handleListTasks(args: string[]): Promise<void> {
    try {
      // Parse options
      const filter = this.parseFilter(args);
      const tasks = await this.tracker.listTasks(filter);

      // Display
      const output = this.display.formatTaskList(tasks, { colorize: true });
      console.log(output);
    } catch (error) {
      console.error(chalk.red('❌ Failed to list tasks:'), (error as Error).message);
    }
  }

  /**
   * Handle /task <id> command (view task details)
   */
  async handleViewTask(args: string[]): Promise<void> {
    try {
      const id = args[0];
      const options = this.parseDisplayOptions(args.slice(1));

      if (!id) {
        console.log(chalk.yellow('Usage: /task <id> [--verbose] [--no-steps] [--no-verification] [--no-metrics]'));
        return;
      }

      const task = await this.tracker.getTask(id);

      if (!task) {
        console.log(chalk.red(`❌ Task not found: ${id}`));
        return;
      }

      const output = this.display.formatTask(task, options);
      console.log(output);
    } catch (error) {
      console.error(chalk.red('❌ Failed to view task:'), (error as Error).message);
    }
  }

  /**
   * Handle /task export <id> command (export task to file)
   */
  async handleExportTask(args: string[], projectRoot: string): Promise<void> {
    try {
      const id = args[0];
      const format = args.find(a => a.startsWith('--format='))?.split('=')[1] || 'json';

      if (!id) {
        console.log(chalk.yellow('Usage: /task export <id> [--format=<json|markdown>]'));
        return;
      }

      // Export
      const data = await this.tracker.exportTask(id, format as 'json' | 'markdown');

      // Write to file
      const filename = `task-export-${id}.${format}`;
      const exportPath = join(projectRoot, filename);
      await fs.writeFile(exportPath, data, 'utf-8');

      console.log(chalk.green(`✅ Exported to: ${exportPath}`));
    } catch (error) {
      console.error(chalk.red('❌ Failed to export task:'), (error as Error).message);
    }
  }

  /**
   * Handle /task compress command (compress old tasks)
   */
  async handleCompressTasks(): Promise<void> {
    try {
      console.log(chalk.gray('🗜️  Compressing old tasks...'));
      await this.tracker.runMaintenance();
      console.log(chalk.green('✅ Compression complete'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to compress tasks:'), (error as Error).message);
    }
  }

  /**
   * Parse filter options from arguments
   */
  private parseFilter(args: string[]): TaskFilter {
    const filter: TaskFilter = {};

    for (const arg of args) {
      if (arg.startsWith('--status=')) {
        filter.status = arg.split('=')[1] as any;
      } else if (arg.startsWith('--mode=')) {
        filter.mode = arg.split('=')[1] as any;
      } else if (arg.startsWith('--limit=')) {
        filter.limit = parseInt(arg.split('=')[1], 10);
      }
    }

    return filter;
  }

  /**
   * Parse display options from arguments
   */
  private parseDisplayOptions(args: string[]): DisplayOptions {
    const options: DisplayOptions = {
      verbose: args.includes('--verbose'),
      showSteps: !args.includes('--no-steps'),
      showVerification: !args.includes('--no-verification'),
      showMetrics: !args.includes('--no-metrics'),
      colorize: !args.includes('--no-color'),
    };

    return options;
  }

  /**
   * Get help text
   */
  getHelpText(): string {
    return `
${chalk.cyan('Task Commands:')}

${chalk.white('/tasks [options]')}
  List all tasks
  Options:
    --status=<status>   Filter by status (pending, running, completed, failed, aborted)
    --mode=<mode>       Filter by mode (plan, execute, verify, loop)
    --limit=<n>         Limit number of results

${chalk.white('/task <id> [options]')}
  View task details
  Options:
    --verbose           Show full details including reasoning
    --no-steps          Hide execution steps
    --no-verification   Hide verification results
    --no-metrics        Hide metrics
    --no-color          Disable colors

${chalk.white('/task export <id> [options]')}
  Export task to file
  Options:
    --format=<format>   Export format (json, markdown) [default: json]

${chalk.white('/task compress')}
  Compress old tasks (older than 30 days)

${chalk.gray('Examples:')}
  /tasks
  /tasks --status=completed --limit=10
  /task abc123 --verbose
  /task export abc123 --format=markdown
`;
  }
}
