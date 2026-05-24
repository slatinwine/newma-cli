// src/autonomous/agent.ts
/**
 * Autonomous Agent
 * Proactively executes tasks without user intervention
 */

import { AgentCoordinator } from '../agents/coordinator';
import { ExecutionTracker } from '../history';
import { ToolExecutor } from '../executor-v2';
import { RollbackManager } from '../rollback';
import { Config } from '../config';
import { PermissionLevel } from '../permissions';
import { Verifier } from '../verifier';
import path from 'path';
import chalk from 'chalk';

/**
 * Autonomous agent configuration
 */
export interface AutonomousConfig {
  maxIterations?: number;
  autoFix?: boolean;
  autoOptimize?: boolean;
  requireConfirmation?: boolean;
  stopOnError?: boolean;
  verbose?: boolean;
}

/**
 * Autonomous agent class
 */
export class AutonomousAgent {
  private coordinator: AgentCoordinator;
  private verifier: Verifier;
  private projectRoot: string;

  constructor(
    toolExecutor: ToolExecutor,
    tracker: ExecutionTracker,
    rollbackManager: RollbackManager,
    config: Config,
    projectRoot: string
  ) {
    this.coordinator = new AgentCoordinator(
      toolExecutor,
      tracker,
      rollbackManager,
      config,
      projectRoot
    );
    this.verifier = new Verifier();
    this.projectRoot = projectRoot;
  }

  /**
   * Execute autonomously
   */
  async executeAutonomously(
    requirement: string,
    options: AutonomousConfig = {}
  ): Promise<AutonomousResult> {
    const {
      maxIterations = 5,
      autoFix = true,
      autoOptimize = true,
      requireConfirmation = false,
      stopOnError = false,
      verbose = true,
    } = options;

    console.log(chalk.cyan('\n🤖 Autonomous Mode Activated\n'));

    const results: AutonomousResult = {
      requirement,
      iterations: [],
      finalStatus: 'running',
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      startTime: Date.now(),
    };

    // Phase 1: Planning
    if (verbose) console.log(chalk.blue('📋 Phase 1: Strategic Planning'));
    const plan = await this.coordinator.planDecomposition(requirement);

    if (verbose) {
      console.log(chalk.gray(`   Tasks: ${plan.tasks.length}`));
      console.log(chalk.gray(`   Groups: ${plan.executionOrder.length}`));
    }

    // Ask for confirmation if required
    if (requireConfirmation) {
      const { shouldProceed } = await this.requestConfirmation(plan);
      if (!shouldProceed) {
        results.finalStatus = 'cancelled';
        return results;
      }
    }

    // Phase 2: Execution
    if (verbose) console.log(chalk.blue('\n⚙️ Phase 2: Autonomous Execution'));

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const iterationResult = await this.executeIteration(
        plan,
        iteration,
        verbose
      );
      results.iterations.push(iterationResult);

      if (iterationResult.allSuccessful && iterationResult.allPassed) {
        results.finalStatus = 'success';
        break;
      }

      if (stopOnError && iterationResult.hasErrors) {
        results.finalStatus = 'failed';
        break;
      }

      // Auto-fix if enabled
      if (autoFix && !iterationResult.allPassed) {
        if (verbose) console.log(chalk.yellow('\n🔧 Auto-fix triggered'));
        await this.attemptAutoFix(iterationResult, verbose);
      }
    }

    // Phase 3: Verification
    if (verbose) console.log(chalk.blue('\n✅ Phase 3: Quality Verification'));
    const verificationResult = await this.verifier.verify(this.projectRoot, 'full');

    if (verbose) {
      console.log(chalk.gray(`   Verification: ${verificationResult.passed ? 'PASSED' : 'FAILED'}`));
    }

    // Phase 4: Self-Optimization
    if (autoOptimize) {
      if (verbose) console.log(chalk.blue('\n🧠 Phase 4: Self-Optimization'));
      // Optimization would happen here
      if (verbose) console.log(chalk.gray('   Analyzing patterns...'));
    }

    // Calculate final metrics
    results.endTime = Date.now();
    results.totalDuration = results.endTime - results.startTime;
    results.totalTasks = plan.tasks.length;
    results.successfulTasks = results.iterations.filter(i => i.allSuccessful).length;
    results.failedTasks = results.iterations.filter(i => !i.allSuccessful).length;

    // Print summary
    this.printSummary(results, verificationResult);

    return results;
  }

  /**
   * Execute a single iteration
   */
  private async executeIteration(
    plan: any,
    iteration: number,
    verbose: boolean
  ): Promise<IterationResult> {
    const result: IterationResult = {
      iteration,
      tasks: [],
      allSuccessful: true,
      allPassed: true,
      hasErrors: false,
    };

    if (verbose) {
      console.log(chalk.cyan(`\n   Iteration ${iteration + 1}/${plan.executionOrder.length}`));
    }

    // Execute tasks in parallel groups
    for (const group of plan.executionOrder) {
      const groupResults = await Promise.all(
        group.map(async (taskId: string) => {
          const task = plan.tasks.find((t: any) => t.id === taskId);
          return await this.executeTask(task, verbose);
        })
      );

      result.tasks.push(...groupResults);

      // Check if any failed
      const hasFailures = groupResults.some(r => !r.success);
      if (hasFailures) {
        result.allSuccessful = false;
        result.hasErrors = true;
      }
    }

    return result;
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: any, verbose: boolean): Promise<TaskResult> {
    if (verbose) {
      console.log(chalk.gray(`      → ${task.description}`));
    }

    try {
      const results = await this.coordinator.executePlan(
        {
          tasks: [task],
          taskGraph: new Map(),
          executionOrder: [[task.id]],
          estimatedIterations: 1
        },
        task.description,
        { streaming: false }
      );

      const success = results.length > 0 && results[0].success;

      return {
        taskId: task.id,
        success,
        result: results[0],
      };
    } catch (error) {
      if (verbose) {
        console.log(chalk.red(`      ✗ Failed: ${error}`));
      }

      return {
        taskId: task.id,
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Attempt automatic fix
   */
  private async attemptAutoFix(iteration: IterationResult, verbose: boolean): Promise<void> {
    // Get failed tasks
    const failedTasks = iteration.tasks.filter(t => !t.success);

    if (verbose) {
      console.log(chalk.yellow(`      Attempting to fix ${failedTasks.length} failed tasks`));
    }

    // For each failed task, try to fix it
    for (const task of failedTasks) {
      if (verbose) {
        console.log(chalk.gray(`         Fixing: ${task.taskId}`));
      }

      // In a real implementation, this would call the LLM to fix the issue
      // For now, it's a placeholder
    }
  }

  /**
   * Request user confirmation
   */
  private async requestConfirmation(plan: any): Promise<{ shouldProceed: boolean }> {
    const inquirer = await import('inquirer');
    const { shouldProceed } = await inquirer.default.prompt([
      {
        type: 'confirm',
        name: 'shouldProceed',
        message: `Execute ${plan.tasks.length} tasks autonomously?`,
        default: true,
      },
    ]);

    return { shouldProceed };
  }

  /**
   * Print execution summary
   */
  private printSummary(results: AutonomousResult, verificationResult: any): void {
    console.log(chalk.cyan('\n📊 Autonomous Execution Summary'));
    console.log(chalk.cyan('==='));
    console.log(`Requirement: ${results.requirement}`);
    console.log(`Status: ${results.finalStatus.toUpperCase()}`);
    console.log(`Duration: ${(results.totalDuration! / 1000).toFixed(1)}s`);
    console.log(`Tasks: ${results.successfulTasks}/${results.totalTasks} successful`);
    console.log(chalk.cyan('===\n'));
  }
}

/**
 * Autonomous result
 */
export interface AutonomousResult {
  requirement: string;
  iterations: IterationResult[];
  finalStatus: 'success' | 'failed' | 'cancelled' | 'running';
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  startTime: number;
  endTime?: number;
  totalDuration?: number;
}

/**
 * Iteration result
 */
interface IterationResult {
  iteration: number;
  tasks: TaskResult[];
  allSuccessful: boolean;
  allPassed: boolean;
  hasErrors: boolean;
}

/**
 * Task result
 */
interface TaskResult {
  taskId: string;
  success: boolean;
  result?: any;
  error?: string;
}
