/**
 * Task Lifecycle Plugin - Integration with Loop System
 */

import { LoopPlugin, LoopPluginContext } from '../loop/interfaces/plugin';
import { TaskTracker } from './tracker';
import { TaskMode } from './types';

/**
 * Task lifecycle plugin
 * Automatically tracks tasks during REPL execution
 */
export class TaskLifecyclePlugin implements LoopPlugin {
  id = 'task-lifecycle';
  name = 'Task Lifecycle Plugin';
  description = 'Automatically tracks tasks during REPL execution';
  version = '1.0.0';
  type = 'loop' as const;
  tools: any[] = [];

  constructor(private tracker: TaskTracker) {}

  async onBeforeInput(input: string, context: LoopPluginContext): Promise<{ shouldContinue: boolean }> {
    // Don't track commands
    if (input.startsWith('/')) {
      return { shouldContinue: true };
    }

    // Detect mode from session state
    const currentMode = context.session.currentMode;
    const mode = this.mapMode(currentMode);

    // Start new task if none exists
    if (!this.tracker.getCurrentTask()) {
      this.tracker.startTask(
        input,
        mode,
        context.session.sessionId,
        context.session.projectRoot
      );
    }

    return { shouldContinue: true };
  }

  async onAfterInput(result: any, context: LoopPluginContext): Promise<{ shouldContinue: boolean }> {
    const currentTask = this.tracker.getCurrentTask();

    if (!currentTask) {
      return { shouldContinue: true };
    }

    // Update task with result data
    if (result.metadata) {
      this.tracker.updateMetadata(result.metadata);
    }

    return { shouldContinue: true };
  }

  async onBeforeExecution(plan: any, context: LoopPluginContext): Promise<{ shouldContinue: boolean }> {
    const currentTask = this.tracker.getCurrentTask();

    if (!currentTask) {
      return { shouldContinue: true };
    }

    // Update task status
    await this.tracker.updateTask({ status: 'running' });

    // Update with plan data
    if (plan) {
      await this.tracker.updateReasoning({
        algorithm: plan.algorithm,
        thoughts: plan.thoughts,
        plan: plan.steps,
        alternatives: plan.alternatives,
      });
    }

    return { shouldContinue: true };
  }

  async onAfterExecution(result: any, context: LoopPluginContext): Promise<void> {
    const currentTask = this.tracker.getCurrentTask();

    if (!currentTask) {
      return;
    }

    // Update with verification results
    if (result.verification) {
      await this.tracker.updateVerification(result.verification);
    }

    // Complete task
    const success = result.success !== false;
    await this.tracker.completeTask(success);
  }

  async onError(error: Error, context: LoopPluginContext): Promise<boolean> {
    // Mark task as failed on error
    const currentTask = this.tracker.getCurrentTask();

    if (currentTask) {
      await this.tracker.updateMetadata({
        errorSummary: error.message,
      });
      await this.tracker.completeTask(false);
    }

    // Let error propagate
    return false;
  }

  async onSessionEnd(context: LoopPluginContext): Promise<void> {
    // Clean up current task
    const currentTask = this.tracker.getCurrentTask();

    if (currentTask && currentTask.status === 'running') {
      await this.tracker.abortTask();
    }
  }

  /**
   * Map LoopSession mode to TaskMode
   */
  private mapMode(mode: string): TaskMode {
    switch (mode) {
      case 'plan':
        return 'plan';
      case 'execute':
        return 'execute';
      case 'verify':
        return 'verify';
      case 'loop':
        return 'loop';
      default:
        return 'execute';
    }
  }
}
