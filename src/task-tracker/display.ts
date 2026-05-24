/**
 * Task Display - Console formatting for tasks
 */

import chalk from 'chalk';
import { TaskDocument, TaskStatus } from './types';

/**
 * Display options
 */
export interface DisplayOptions {
  verbose?: boolean;
  showSteps?: boolean;
  showVerification?: boolean;
  showMetrics?: boolean;
  colorize?: boolean;
}

/**
 * Task display formatter
 */
export class TaskDisplay {
  /**
   * Format task for display
   */
  formatTask(task: TaskDocument, options: DisplayOptions = {}): string {
    const opts = {
      verbose: false,
      showSteps: true,
      showVerification: true,
      showMetrics: true,
      colorize: true,
      ...options,
    };

    const lines: string[] = [];

    // Header
    lines.push(this.formatLine('┌─ Task Details ──────────────────────────────────┐', 'cyan', opts.colorize));
    lines.push(this.formatLine(`│ ID:       ${task.id}`, 'white', opts.colorize));
    lines.push(this.formatLine(`│ Status:   ${this.formatStatus(task.status, opts.colorize)}`, 'white', opts.colorize));
    lines.push(this.formatLine(`│ Mode:     ${task.mode.toUpperCase()}`, 'white', opts.colorize));
    lines.push(this.formatLine(`│ Created:  ${task.createdAt}`, 'white', opts.colorize));
    lines.push(this.formatLine(`│ Updated:  ${task.updatedAt}`, 'white', opts.colorize));

    if (task.completedAt) {
      lines.push(this.formatLine(`│ Completed: ${task.completedAt}`, 'white', opts.colorize));
    }

    // Requirement
    lines.push(this.formatLine('├─ Requirement ────────────────────────────────────┤', 'cyan', opts.colorize));
    const requirement = task.requirement.length > 60
      ? task.requirement.substring(0, 57) + '...'
      : task.requirement;
    lines.push(this.formatLine(`│ ${requirement}`, 'white', opts.colorize));

    // Reasoning (verbose only)
    if (opts.verbose && (task.reasoning.algorithm || task.reasoning.thoughts || task.reasoning.plan)) {
      lines.push(this.formatLine('├─ Reasoning ─────────────────────────────────────┤', 'cyan', opts.colorize));

      if (task.reasoning.algorithm) {
        lines.push(this.formatLine(`│ Algorithm: ${task.reasoning.algorithm}`, 'gray', opts.colorize));
      }

      if (task.reasoning.thoughts) {
        const thoughts = task.reasoning.thoughts.length > 60
          ? task.reasoning.thoughts.substring(0, 57) + '...'
          : task.reasoning.thoughts;
        lines.push(this.formatLine(`│ Thoughts: ${thoughts}`, 'gray', opts.colorize));
      }

      if (task.reasoning.plan && task.reasoning.plan.length > 0) {
        lines.push(this.formatLine(`│ Plan:`, 'gray', opts.colorize));
        task.reasoning.plan.slice(0, 5).forEach((step, i) => {
          lines.push(this.formatLine(`│   ${i + 1}. ${step}`, 'gray', opts.colorize));
        });
        if (task.reasoning.plan.length > 5) {
          lines.push(this.formatLine(`│   ... (${task.reasoning.plan.length - 5} more steps)`, 'gray', opts.colorize));
        }
      }
    }

    // Execution steps
    if (opts.showSteps && task.execution.actions.length > 0) {
      lines.push(this.formatLine('├─ Execution Steps ──────────────────────────────┤', 'cyan', opts.colorize));

      const displayActions = task.execution.actions.slice(-10); // Show last 10
      if (task.execution.actions.length > 10) {
        lines.push(this.formatLine(`│ ... (${task.execution.actions.length - 10} earlier actions)`, 'gray', opts.colorize));
      }

      displayActions.forEach((action, i) => {
        const icon = this.getActionIcon(action.status, opts.colorize);
        const target = action.target ? `: ${action.target}` : '';
        lines.push(this.formatLine(`│ ${icon} ${action.type}${target}`, 'white', opts.colorize));

        if (action.error && opts.verbose) {
          lines.push(this.formatLine(`│   Error: ${action.error}`, 'red', opts.colorize));
        }

        if (action.duration && opts.verbose) {
          lines.push(this.formatLine(`│   Duration: ${action.duration}ms`, 'gray', opts.colorize));
        }
      });

      lines.push(this.formatLine(
        `│ Summary: ${task.execution.summary.succeeded}/${task.execution.summary.total} succeeded`,
        'white',
        opts.colorize
      ));
    }

    // Verification
    if (opts.showVerification && task.verification?.enabled) {
      lines.push(this.formatLine('├─ Verification ─────────────────────────────────┤', 'cyan', opts.colorize));
      const status = task.verification.satisfied ? '✓ Passed' : '✗ Failed';
      lines.push(this.formatLine(`│ Status: ${status}`, 'white', opts.colorize));

      if (task.verification.iterations) {
        lines.push(this.formatLine(`│ Iterations: ${task.verification.iterations}`, 'white', opts.colorize));
      }

      if (opts.verbose && task.verification.stages && task.verification.stages.length > 0) {
        lines.push(this.formatLine(`│ Stages:`, 'gray', opts.colorize));
        task.verification.stages.forEach((stage) => {
          const icon = stage.passed ? '✓' : '✗';
          lines.push(this.formatLine(`│   ${icon} ${stage.name}`, 'gray', opts.colorize));
        });
      }
    }

    // Metrics
    if (opts.showMetrics) {
      lines.push(this.formatLine('├─ Metrics ────────────────────────────────────────┤', 'cyan', opts.colorize));
      lines.push(this.formatLine(`│ Duration: ${(task.metadata.duration / 1000).toFixed(2)}s`, 'white', opts.colorize));

      if (task.metadata.tokens) {
        lines.push(this.formatLine(
          `│ Tokens: ${task.metadata.tokens.total} (${task.metadata.tokens.input} in, ${task.metadata.tokens.output} out)`,
          'white',
          opts.colorize
        ));
      }

      if (task.metadata.errorSummary) {
        lines.push(this.formatLine(`│ Error: ${task.metadata.errorSummary}`, 'red', opts.colorize));
      }
    }

    // Footer
    lines.push(this.formatLine('└──────────────────────────────────────────────────┘', 'cyan', opts.colorize));

    return lines.join('\n');
  }

  /**
   * Format task list as table
   */
  formatTaskList(tasks: TaskDocument[], options: DisplayOptions = {}): string {
    if (tasks.length === 0) {
      return this.formatLine('📋 No tasks found.', 'gray', options.colorize !== false);
    }

    const lines: string[] = [];

    lines.push(this.formatLine('\n📋 Tasks', 'cyan', options.colorize !== false));
    lines.push(this.formatLine('═'.repeat(100), 'cyan', options.colorize !== false));

    // Table header
    const header = `${this.pad('ID', 12)}${this.pad('Status', 12)}${this.pad('Mode', 10)}${this.pad('Created', 20)}Requirement`;
    lines.push(this.formatLine(header, 'white', options.colorize !== false));

    lines.push(this.formatLine('─'.repeat(100), 'gray', options.colorize !== false));

    // Table rows
    tasks.forEach((task) => {
      const id = task.id.substring(0, 10);
      const status = this.formatStatusShort(task.status, options.colorize !== false);
      const mode = this.pad(task.mode.toUpperCase(), 10);
      const created = new Date(task.createdAt).toLocaleDateString();
      const requirement = task.requirement.length > 40
        ? task.requirement.substring(0, 37) + '...'
        : task.requirement;

      const row = `${this.pad(id, 12)}${this.pad(status, 12)}${mode}${this.pad(created, 20)}${requirement}`;
      lines.push(this.formatLine(row, 'white', options.colorize !== false));
    });

    lines.push(this.formatLine('═'.repeat(100), 'cyan', options.colorize !== false));
    lines.push(this.formatLine(`Total: ${tasks.length} tasks\n`, 'white', options.colorize !== false));

    return lines.join('\n');
  }

  /**
   * Format task summary
   */
  formatSummary(task: TaskDocument, colorize: boolean = true): string {
    const lines: string[] = [];

    lines.push(this.formatLine('📊 Task Summary', 'cyan', colorize));
    lines.push(this.formatLine('═'.repeat(50), 'cyan', colorize));
    lines.push(this.formatLine(`Status:   ${this.formatStatus(task.status, colorize)}`, 'white', colorize));
    lines.push(this.formatLine(`Mode:     ${task.mode.toUpperCase()}`, 'white', colorize));
    lines.push(this.formatLine(`Duration: ${(task.metadata.duration / 1000).toFixed(2)}s`, 'white', colorize));

    if (task.execution.actions.length > 0) {
      lines.push(
        this.formatLine(
          `Steps:    ${task.execution.summary.succeeded}/${task.execution.summary.total} succeeded`,
          'white',
          colorize
        )
      );
    }

    if (task.metadata.tokens) {
      lines.push(this.formatLine(`Tokens:   ${task.metadata.tokens.total}`, 'white', colorize));
    }

    if (task.verification?.enabled) {
      const verifyStatus = task.verification.satisfied ? '✓ Passed' : '✗ Failed';
      lines.push(this.formatLine(`Verify:   ${verifyStatus}`, 'white', colorize));
    }

    lines.push(this.formatLine('═'.repeat(50), 'cyan', colorize));

    return lines.join('\n');
  }

  /**
   * Format status with color
   */
  private formatStatus(status: TaskStatus, colorize: boolean): string {
    if (!colorize) {
      return status;
    }

    switch (status) {
      case 'pending':
        return chalk.yellow('⏳ Pending');
      case 'running':
        return chalk.blue('🔄 Running');
      case 'completed':
        return chalk.green('✓ Completed');
      case 'failed':
        return chalk.red('✗ Failed');
      case 'aborted':
        return chalk.gray('⊘ Aborted');
      default:
        return status;
    }
  }

  /**
   * Format short status for table
   */
  private formatStatusShort(status: TaskStatus, colorize: boolean): string {
    if (!colorize) {
      return status;
    }

    switch (status) {
      case 'pending':
        return chalk.yellow('⏳ PENDING');
      case 'running':
        return chalk.blue('🔄 RUNNING');
      case 'completed':
        return chalk.green('✓ DONE');
      case 'failed':
        return chalk.red('✗ FAILED');
      case 'aborted':
        return chalk.gray('⊘ ABORTED');
      default:
        return status;
    }
  }

  /**
   * Get action icon
   */
  private getActionIcon(status: string, colorize: boolean): string {
    const icon = status === 'success' ? '✓' : status === 'failed' ? '✗' : '○';

    if (!colorize) {
      return icon;
    }

    switch (status) {
      case 'success':
        return chalk.green(icon);
      case 'failed':
        return chalk.red(icon);
      default:
        return chalk.gray(icon);
    }
  }

  /**
   * Format line with color
   */
  private formatLine(text: string, color: string, colorize: boolean): string {
    if (!colorize) {
      return text;
    }

    switch (color) {
      case 'cyan':
        return chalk.cyan(text);
      case 'white':
        return chalk.white(text);
      case 'gray':
        return chalk.gray(text);
      case 'yellow':
        return chalk.yellow(text);
      case 'green':
        return chalk.green(text);
      case 'red':
        return chalk.red(text);
      case 'blue':
        return chalk.blue(text);
      default:
        return text;
    }
  }

  /**
   * Pad string to width
   */
  private pad(str: string, width: number): string {
    return str.padEnd(width);
  }
}
