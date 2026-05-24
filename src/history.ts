// src/history.ts
/**
 * Execution history tracker for action lifecycle management
 * Provides minimal overhead with maximum insight for LLM verification
 */

import { Action } from './types';

/**
 * Rollback snapshot data
 */
export interface RollbackSnapshot {
  type: 'file_backup' | 'git_commit' | 'none';
  previousContent?: string;
  filePath?: string;
  commitHash?: string;
  timestamp: Date;
}

/**
 * Execution record for each action
 */
export interface ExecutionRecord {
  id: string;
  iteration: number;
  action: Action;
  status: 'pending' | 'success' | 'failed' | 'rolled_back';
  timestamp: Date;
  error?: string;
  duration: number;  // Duration in milliseconds
  rollbackData?: RollbackSnapshot;
}

/**
 * Execution summary statistics
 */
export interface ExecutionSummary {
  totalActions: number;
  successful: number;
  failed: number;
  rolledBack: number;
  totalDuration: number;
  iterations: number;
}

/**
 * Execution history tracker
 */
export class ExecutionTracker {
  private records: ExecutionRecord[] = [];
  private currentIteration = 0;
  private iterationStartTimes: Map<number, number> = new Map();

  /**
   * Start a new iteration
   */
  startIteration(): void {
    this.currentIteration++;
    this.iterationStartTimes.set(this.currentIteration, Date.now());
  }

  /**
   * Get current iteration number
   */
  getCurrentIteration(): number {
    return this.currentIteration;
  }

  /**
   * Record an action execution
   */
  recordExecution(
    action: Action,
    status: ExecutionRecord['status'],
    duration: number,
    error?: string,
    rollbackData?: RollbackSnapshot
  ): ExecutionRecord {
    const record: ExecutionRecord = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      iteration: this.currentIteration,
      action,
      status,
      timestamp: new Date(),
      error,
      duration,
      rollbackData,
    };

    this.records.push(record);
    return record;
  }

  /**
   * Get all execution records
   */
  getHistory(): ExecutionRecord[] {
    return [...this.records];
  }

  /**
   * Get records for a specific iteration
   */
  getIterationRecords(iteration: number): ExecutionRecord[] {
    return this.records.filter(r => r.iteration === iteration);
  }

  /**
   * Get the last failed record
   */
  getLastFailed(): ExecutionRecord | null {
    for (let i = this.records.length - 1; i >= 0; i--) {
      if (this.records[i].status === 'failed') {
        return this.records[i];
      }
    }
    return null;
  }

  /**
   * Get the last successful record
   */
  getLastSuccessful(): ExecutionRecord | null {
    for (let i = this.records.length - 1; i >= 0; i--) {
      if (this.records[i].status === 'success') {
        return this.records[i];
      }
    }
    return null;
  }

  /**
   * Get execution summary
   */
  getSummary(): ExecutionSummary {
    const summary: ExecutionSummary = {
      totalActions: this.records.length,
      successful: 0,
      failed: 0,
      rolledBack: 0,
      totalDuration: 0,
      iterations: this.currentIteration,
    };

    for (const record of this.records) {
      switch (record.status) {
        case 'success':
          summary.successful++;
          break;
        case 'failed':
          summary.failed++;
          break;
        case 'rolled_back':
          summary.rolledBack++;
          break;
      }
      summary.totalDuration += record.duration;
    }

    return summary;
  }

  /**
   * Format history for LLM consumption
   * Returns concise, actionable summary
   */
  formatForLLM(): string {
    if (this.records.length === 0) {
      return 'No actions have been executed yet.';
    }

    const lines: string[] = [];
    lines.push('=== PREVIOUS EXECUTION HISTORY ===\n');

    // Group records by iteration
    const grouped = new Map<number, ExecutionRecord[]>();
    for (const record of this.records) {
      const list = grouped.get(record.iteration) ?? [];
      list.push(record);
      grouped.set(record.iteration, list);
    }

    // Format each iteration
    for (const [iteration, records] of grouped.entries()) {
      lines.push(`Iteration ${iteration}:`);

      for (const record of records) {
        const statusIcon = this.getStatusIcon(record.status);
        const desc = this.describeAction(record.action);
        const duration = (record.duration / 1000).toFixed(2);

        lines.push(`  ${statusIcon} ${desc} (${duration}s)`);

        if (record.error) {
          lines.push(`     [ERROR] ${record.error}`);
        }

        if (record.rollbackData?.commitHash) {
          lines.push(`     [ROLLBACK] ${record.rollbackData.commitHash}`);
        }
      }

      lines.push('');
    }

    // Add summary
    const summary = this.getSummary();
    lines.push('Summary:');
    lines.push(`  Total actions: ${summary.totalActions}`);
    lines.push(`  Successful: ${summary.successful}`);
    lines.push(`  Failed: ${summary.failed}`);
    lines.push(`  Rolled back: ${summary.rolledBack}`);
    lines.push(`  Total time: ${(summary.totalDuration / 1000).toFixed(2)}s`);

    return lines.join('\n');
  }

  /**
   * Get status icon for a status
   */
  private getStatusIcon(status: ExecutionRecord['status']): string {
    switch (status) {
      case 'success':
        return '[OK]';
      case 'failed':
        return '[FAIL]';
      case 'rolled_back':
        return '[ROLLBACK]';
      case 'pending':
        return '[PENDING]';
      default:
        return '[UNKNOWN]';
    }
  }

  /**
   * Describe an action in human-readable format
   */
  private describeAction(action: Action): string {
    switch (action.type) {
      case 'create':
        return `Create file ${action.path}`;
      case 'modify':
        return `Modify file ${action.path}`;
      case 'delete':
        return `Delete file ${action.path}`;
      case 'run':
        return `Run command "${action.command}"`;
      case 'verify':
        return `Verify "${action.command}"`;
      default:
        return `Unknown action: ${JSON.stringify(action)}`;
    }
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.records = [];
    this.currentIteration = 0;
    this.iterationStartTimes.clear();
  }

  /**
   * Get duration of current iteration in milliseconds
   */
  getIterationDuration(): number {
    const startTime = this.iterationStartTimes.get(this.currentIteration);
    return startTime ? Date.now() - startTime : 0;
  }
}
