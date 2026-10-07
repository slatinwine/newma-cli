/**
 * Task Tracker - Main service for task lifecycle management
 */

import { TaskDocument, TaskStatus, TaskFilter, TaskMode } from './types';
import { TaskStorage } from './storage';

/**
 * Task tracker service
 * Manages task lifecycle and persistence
 */
export class TaskTracker {
  private storage: TaskStorage;
  private currentTask: TaskDocument | null = null;
  private disabled: boolean = false;

  constructor(storage: TaskStorage) {
    this.storage = storage;
  }

  /**
   * Start a new task
   */
  startTask(requirement: string, mode: TaskMode, sessionId: string, projectRoot: string): TaskDocument {
    if (this.disabled) {
      return null as any; // Tracking disabled
    }

    try {
      const now = new Date().toISOString();

      const task: TaskDocument = {
        id: sessionId, // Reuse sessionId for simplicity
        sessionId,
        status: 'pending',
        mode,
        createdAt: now,
        updatedAt: now,
        projectRoot,
        requirement,
        reasoning: {},
        execution: {
          actions: [],
          summary: {
            total: 0,
            succeeded: 0,
            failed: 0,
          },
        },
        metadata: {
          duration: 0,
          status: 'pending',
        },
      };

      this.currentTask = task;
      this.storage.save(task);

      return task;
    } catch (error) {
      console.warn('⚠️  Task tracking disabled due to error:', (error as Error).message);
      this.disabled = true;
      return null as any;
    }
  }

  /**
   * Update task with partial data
   */
  async updateTask(updates: Partial<TaskDocument>): Promise<void> {
    if (this.disabled || !this.currentTask) {
      return;
    }

    try {
      // Merge updates
      const updatedTask: TaskDocument = {
        ...this.currentTask,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      // 'running' 状态落地：任务一旦开始推进（推理/执行/验证），
      // 从 pending 迁移到 running——此前该状态只在类型里存在，从未被设置
      const isProgressing =
        updates.reasoning !== undefined ||
        updates.execution !== undefined ||
        updates.verification !== undefined;
      if (isProgressing && updatedTask.status === 'pending' && !updates.status) {
        updatedTask.status = 'running';
      }

      // Update metadata status
      if (updates.status) {
        updatedTask.metadata.status = updates.status;
      } else if (updatedTask.metadata.status === 'pending' && updatedTask.status === 'running') {
        updatedTask.metadata.status = 'running';
      }

      // Update currentTask reference
      this.currentTask = updatedTask;

      // Save to disk
      await this.storage.save(updatedTask);
    } catch (error) {
      console.warn('⚠️  Failed to update task:', (error as Error).message);
    }
  }

  /**
   * Update AI reasoning
   */
  async updateReasoning(reasoning: {
    algorithm?: 'fft' | 'landmark' | 'tot' | 'standard';
    thoughts?: string;
    plan?: string[];
    alternatives?: any[];
  }): Promise<void> {
    if (this.disabled || !this.currentTask) {
      return;
    }

    await this.updateTask({
      reasoning: {
        ...this.currentTask.reasoning,
        ...reasoning,
      },
    });
  }

  /**
   * Update execution progress
   */
  async updateExecution(action: {
    type: string;
    target?: string;
    status: 'pending' | 'running' | 'success' | 'failed';
    result?: string;
    error?: string;
    duration?: number;
  }): Promise<void> {
    if (this.disabled || !this.currentTask) {
      return;
    }

    const actions = [...this.currentTask.execution.actions];
    actions.push({
      ...action,
      timestamp: new Date().toISOString(),
    });

    // Update summary
    let succeeded = this.currentTask.execution.summary.succeeded;
    let failed = this.currentTask.execution.summary.failed;

    if (action.status === 'success') {
      succeeded++;
    } else if (action.status === 'failed') {
      failed++;
    }

    // Update currentTask immediately before calling updateTask
    this.currentTask.execution = {
      actions,
      summary: {
        total: actions.length,
        succeeded,
        failed,
      },
    };

    await this.updateTask({
      execution: this.currentTask.execution,
    });
  }

  /**
   * Update verification results
   */
  async updateVerification(verification: {
    enabled: boolean;
    stages?: Array<{
      name: string;
      passed: boolean;
      message?: string;
      duration?: number;
    }>;
    satisfied: boolean;
    iterations?: number;
  }): Promise<void> {
    if (this.disabled || !this.currentTask) {
      return;
    }

    await this.updateTask({ verification });
  }

  /**
   * Update metadata (tokens, duration, etc.)
   */
  async updateMetadata(metadata: {
    duration?: number;
    tokens?: {
      input: number;
      output: number;
      total: number;
    };
    errorSummary?: string;
  }): Promise<void> {
    if (this.disabled || !this.currentTask) {
      return;
    }

    await this.updateTask({
      metadata: {
        ...this.currentTask.metadata,
        ...metadata,
      },
    });
  }

  /**
   * Complete task (success or failure)
   */
  async completeTask(success: boolean): Promise<void> {
    if (this.disabled || !this.currentTask) {
      return;
    }

    await this.updateTask({
      status: success ? 'completed' : 'failed',
      completedAt: new Date().toISOString(),
    });

    this.currentTask = null;
  }

  /**
   * Abort task (user cancelled)
   */
  async abortTask(): Promise<void> {
    if (this.disabled || !this.currentTask) {
      return;
    }

    await this.updateTask({
      status: 'aborted',
      completedAt: new Date().toISOString(),
    });

    this.currentTask = null;
  }

  /**
   * Get current task
   */
  getCurrentTask(): TaskDocument | null {
    return this.currentTask;
  }

  /**
   * Get current task ID
   */
  getCurrentTaskId(): string | null {
    return this.currentTask?.id || null;
  }

  /**
   * Get task by ID
   */
  async getTask(id: string): Promise<TaskDocument | null> {
    if (this.disabled) {
      return null;
    }

    return this.storage.load(id);
  }

  /**
   * List tasks with optional filter
   */
  async listTasks(filter?: TaskFilter): Promise<TaskDocument[]> {
    if (this.disabled) {
      return [];
    }

    return this.storage.list(filter);
  }

  /**
   * Export task to JSON string
   */
  async exportTask(id: string, format: 'json' | 'markdown'): Promise<string> {
    const task = await this.getTask(id);

    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    if (format === 'json') {
      return JSON.stringify(task, null, 2);
    } else {
      return this.formatTaskAsMarkdown(task);
    }
  }

  /**
   * Format task as markdown
   */
  private formatTaskAsMarkdown(task: TaskDocument): string {
    const lines: string[] = [];

    lines.push(`# Task: ${task.id}`);
    lines.push('');
    lines.push(`**Status:** ${task.metadata.status}`);
    lines.push(`**Mode:** ${task.mode}`);
    lines.push(`**Created:** ${task.createdAt}`);
    if (task.completedAt) {
      lines.push(`**Completed:** ${task.completedAt}`);
    }
    lines.push('');

    lines.push('## Requirement');
    lines.push(task.requirement);
    lines.push('');

    if (task.reasoning.algorithm || task.reasoning.thoughts || task.reasoning.plan) {
      lines.push('## Reasoning');
      if (task.reasoning.algorithm) {
        lines.push(`**Algorithm:** ${task.reasoning.algorithm}`);
      }
      if (task.reasoning.thoughts) {
        lines.push(`**Thoughts:** ${task.reasoning.thoughts}`);
      }
      if (task.reasoning.plan) {
        lines.push('**Plan:**');
        task.reasoning.plan.forEach((step, i) => {
          lines.push(`${i + 1}. ${step}`);
        });
      }
      lines.push('');
    }

    if (task.execution.actions.length > 0) {
      lines.push('## Execution');
      task.execution.actions.forEach((action, i) => {
        const icon = action.status === 'success' ? '✓' : action.status === 'failed' ? '✗' : '○';
        lines.push(`${i + 1}. ${icon} ${action.type}${action.target ? `: ${action.target}` : ''}`);
        if (action.error) {
          lines.push(`   **Error:** ${action.error}`);
        }
        if (action.duration) {
          lines.push(`   **Duration:** ${action.duration}ms`);
        }
      });
      lines.push('');
      lines.push(`**Summary:** ${task.execution.summary.succeeded}/${task.execution.summary.total} succeeded`);
      lines.push('');
    }

    if (task.verification?.enabled) {
      lines.push('## Verification');
      lines.push(`**Satisfied:** ${task.verification.satisfied ? 'Yes' : 'No'}`);
      if (task.verification.iterations) {
        lines.push(`**Iterations:** ${task.verification.iterations}`);
      }
      if (task.verification.stages) {
        lines.push('**Stages:**');
        task.verification.stages.forEach((stage) => {
          const icon = stage.passed ? '✓' : '✗';
          lines.push(`- ${icon} ${stage.name}${stage.message ? `: ${stage.message}` : ''}`);
        });
      }
      lines.push('');
    }

    lines.push('## Metadata');
    lines.push(`**Duration:** ${task.metadata.duration}ms`);
    if (task.metadata.tokens) {
      lines.push(`**Tokens:** ${task.metadata.tokens.total} (${task.metadata.tokens.input} input, ${task.metadata.tokens.output} output)`);
    }
    if (task.metadata.errorSummary) {
      lines.push(`**Error:** ${task.metadata.errorSummary}`);
    }

    return lines.join('\n');
  }

  /**
   * Check if tracking is disabled
   */
  isDisabled(): boolean {
    return this.disabled;
  }

  /**
   * Run maintenance (compress old tasks)
   */
  async runMaintenance(): Promise<void> {
    if (this.disabled) {
      return;
    }

    try {
      const stats = await this.storage.compressOldTasks();
      if (stats.compressedCount > 0) {
        console.log(`🗜️  Compressed ${stats.compressedCount} old tasks (${stats.reduction.toFixed(1)}% reduction)`);
      }
    } catch (error) {
      console.warn('⚠️  Maintenance failed:', (error as Error).message);
    }
  }
}
