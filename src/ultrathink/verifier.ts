/**
 * Enhanced Verification using ReAct
 *
 * Extends the verification system to use ReAct loop for self-correcting
 * requirement satisfaction checking.
 */

import { Config } from '../config';
import { ExecutionRecord } from '../history';
import { Action } from '../types';
import { ReActTrace, ReActStep } from './types';
import { runReActLoop, ReActOptimizationOptions } from './react-loop';
import { formatReActTrace } from './utils';
import { callAI, extractJSON } from '../ai';
import { ReasoningTracker, TrackedEventType } from './tracker';
import chalk from 'chalk';

// ============================================================================
// VERIFIER OPTIMIZATION OPTIONS (Phase 3)
// ============================================================================

/**
 * Optimization options for verifier (Phase 3)
 */
export interface VerifierOptimizationOptions extends ReActOptimizationOptions {
  /** Use incremental observation building (default: false) */
  useIncrementalObservation?: boolean;
  /** Cache for incremental updates */
  lastObservationCache?: {
    lastHistoryLength: number;
    lastObservation: string;
  };
}

// ============================================================================
// REACT VERIFIER
// ============================================================================

export class ReActVerifier {
  private config: Config;
  private projectInfo: any;
  private requirement: string;
  private optimizationOptions: VerifierOptimizationOptions;
  private observationCache: VerifierOptimizationOptions['lastObservationCache'];

  constructor(
    config: Config,
    projectInfo: any,
    requirement: string,
    optimizationOptions: VerifierOptimizationOptions = {}
  ) {
    this.config = config;
    this.projectInfo = projectInfo;
    this.requirement = requirement;
    this.optimizationOptions = {
      useOptimizations: false,
      useIncrementalObservation: false,
      ...optimizationOptions,
    };
    this.observationCache = this.optimizationOptions.lastObservationCache;
  }

  /**
   * Verify requirement satisfaction using ReAct loop
   * This replaces the simple done=true/false check with an intelligent loop
   *
   * Phase 3: Added incremental observation building and tracking
   */
  async verifyWithReAct(
    executionHistory: ExecutionRecord[],
    maxIterations: number = 5
  ): Promise<{
    satisfied: boolean;
    trace?: ReActTrace;
    reasoning: string;
  }> {
    const { tracker, useOptimizations, useIncrementalObservation } = this.optimizationOptions;

    console.log(chalk.cyan('\n🔍 Starting ReAct Verification...\n'));

    // Start tracking verification stage (Phase 3)
    tracker?.startStage('verification');

    // Build initial observation (with incremental optimization if enabled)
    const initialObservation = useIncrementalObservation
      ? this.buildObservationIncremental(executionHistory)
      : this.buildObservationFromHistory(executionHistory);

    // Run ReAct loop for verification (with optimization options)
    const trace = await runReActLoop(
      this.config,
      this.projectInfo,
      this.requirement,
      {
        maxSteps: maxIterations,
        initialObservation,
        onStep: (step) => {
          // Optional: Handle each step (e.g., for progress display)
        },
        // Pass optimization options to ReAct loop
        useOptimizations,
        tracker,
      }
    );

    // Display trace
    console.log(formatReActTrace(trace.steps, true));

    // Complete tracking stage (Phase 3)
    tracker?.endStage('verification');

    // Determine satisfaction
    const satisfied = trace.success;

    return {
      satisfied,
      trace,
      reasoning: trace.reasoning,
    };
  }

  /**
   * Build observation string from execution history
   */
  private buildObservationFromHistory(history: ExecutionRecord[]): string {
    if (history.length === 0) {
      return 'No actions have been executed yet.';
    }

    const lines: string[] = [];

    // Group by iteration
    const grouped = new Map<number, ExecutionRecord[]>();
    for (const record of history) {
      const list = grouped.get(record.iteration) ?? [];
      list.push(record);
      grouped.set(record.iteration, list);
    }

    // Build observation text
    lines.push(`EXECUTION SUMMARY:`);
    lines.push(`Total iterations: ${grouped.size}`);
    lines.push(`Total actions: ${history.length}`);
    lines.push('');

    // Last iteration details
    const lastIteration = Math.max(...Array.from(grouped.keys()));
    const lastRecords = grouped.get(lastIteration) || [];

    lines.push(`LAST ITERATION (Iteration ${lastIteration}):`);
    for (const record of lastRecords) {
      const statusIcon = record.status === 'success' ? '✅' : '❌';
      lines.push(`  ${statusIcon} ${this.describeAction(record.action)}`);

      if (record.error) {
        lines.push(`     ❌ Error: ${record.error}`);
      }
    }

    // Success/failure summary
    const successCount = history.filter(r => r.status === 'success').length;
    const failureCount = history.filter(r => r.status === 'failed').length;

    lines.push('');
    lines.push(`STATISTICS:`);
    lines.push(`  Successful actions: ${successCount}`);
    lines.push(`  Failed actions: ${failureCount}`);
    lines.push(`  Success rate: ${((successCount / history.length) * 100).toFixed(1)}%`);

    const observation = lines.join('\n');

    // Update cache (Phase 3)
    if (this.optimizationOptions.useIncrementalObservation) {
      this.observationCache = {
        lastHistoryLength: history.length,
        lastObservation: observation,
      };
    }

    return observation;
  }

  /**
   * Build observation incrementally (Phase 3 optimization)
   *
   * Only processes new execution records since last build
   * Expected savings: ~70% processing time for incremental updates
   */
  private buildObservationIncremental(history: ExecutionRecord[]): string {
    // If no cache or history is smaller, build from scratch
    if (!this.observationCache || history.length < this.observationCache.lastHistoryLength) {
      return this.buildObservationFromHistory(history);
    }

    // If no new records, return cached observation
    if (history.length === this.observationCache.lastHistoryLength) {
      return this.observationCache.lastObservation;
    }

    // Get only the new records
    const newRecords = history.slice(this.observationCache.lastHistoryLength);

    // Build incremental update
    const lines: string[] = [this.observationCache.lastObservation];

    lines.push('');
    lines.push(`⚡ UPDATE (${newRecords.length} new action(s)):`);

    // Group new records by iteration
    const grouped = new Map<number, ExecutionRecord[]>();
    for (const record of newRecords) {
      const list = grouped.get(record.iteration) ?? [];
      list.push(record);
      grouped.set(record.iteration, list);
    }

    // Add new records
    for (const [iteration, records] of Array.from(grouped.entries())) {
      lines.push(`  Iteration ${iteration}:`);
      for (const record of records) {
        const statusIcon = record.status === 'success' ? '✅' : '❌';
        lines.push(`    ${statusIcon} ${this.describeAction(record.action)}`);
        if (record.error) {
          lines.push(`       ❌ Error: ${record.error}`);
        }
      }
    }

    // Update statistics
    const successCount = history.filter(r => r.status === 'success').length;
    const failureCount = history.filter(r => r.status === 'failed').length;

    lines.push('');
    lines.push(`UPDATED STATISTICS:`);
    lines.push(`  Total actions: ${history.length}`);
    lines.push(`  Successful: ${successCount}`);
    lines.push(`  Failed: ${failureCount}`);
    lines.push(`  Success rate: ${((successCount / history.length) * 100).toFixed(1)}%`);

    const observation = lines.join('\n');

    // Update cache
    this.observationCache = {
      lastHistoryLength: history.length,
      lastObservation: observation,
    };

    return observation;
  }

  /**
   * Describe an action for observation
   */
  private describeAction(action: any): string {
    switch (action.type) {
      case 'create':
        return `Created ${action.path}`;
      case 'modify':
        return `Modified ${action.path}`;
      case 'delete':
        return `Deleted ${action.path}`;
      case 'run':
        return `Ran "${action.command}"`;
      case 'verify':
        return `Verified "${action.command}"`;
      default:
        return `Action: ${JSON.stringify(action)}`;
    }
  }

  /**
   * Auto-fix issues found during verification
   * Analyzes ReAct trace and generates corrective actions
   */
  async autoFix(
    trace: ReActTrace,
    executionHistory: ExecutionRecord[]
  ): Promise<{
    fixesApplied: number;
    reasoning: string;
    correctiveActions: Action[];
  }> {
    console.log(chalk.yellow('\n🔧 Attempting auto-fix based on ReAct analysis...\n'));

    // Analyze failed steps in trace
    const failedSteps = trace.steps.filter(s => !s.success);

    if (failedSteps.length === 0) {
      console.log(chalk.gray('  No failures detected, no fixes needed.\n'));
      return {
        fixesApplied: 0,
        reasoning: 'No failures detected, no fixes needed.',
        correctiveActions: [],
      };
    }

    console.log(chalk.yellow(`  ⚠️  Detected ${failedSteps.length} issue(s)\n`));

    // Limit to 3 fixes to avoid infinite loops
    const maxFixes = 3;
    const correctiveActions: Action[] = [];

    // Analyze each failure and generate fixes
    for (let i = 0; i < Math.min(failedSteps.length, maxFixes); i++) {
      const step = failedSteps[i];
      const fix = await this.generateFix(step, i + 1);

      if (fix) {
        correctiveActions.push(fix);
        console.log(chalk.yellow(`  ${i + 1}. ${this.describeFix(fix)}`));
      }
    }

    if (correctiveActions.length === 0) {
      console.log(chalk.gray('  No automatic fixes could be generated.\n'));
      return {
        fixesApplied: 0,
        reasoning: `Analyzed ${failedSteps.length} failures but could not generate automatic fixes.`,
        correctiveActions: [],
      };
    }

    console.log(chalk.cyan(`\n  ✅ Generated ${correctiveActions.length} corrective action(s)\n`));

    return {
      fixesApplied: correctiveActions.length,
      reasoning: `Analyzed ${failedSteps.length} failures and generated ${correctiveActions.length} corrective actions.`,
      correctiveActions,
    };
  }

  /**
   * Generate a fix for a failed ReAct step
   */
  private async generateFix(
    step: ReActStep,
    fixNumber: number
  ): Promise<Action | null> {
    const prompt = `You are an expert code debugger. Analyze this failed verification step and generate a fix.

FAILED STEP:
Thought: ${step.thought}
Action: ${JSON.stringify(step.action)}
Observation: ${step.observation}

Based on the failure, generate a specific corrective action.
The action should be one of:
- modify_file (to fix code issues)
- create_file (to add missing files)
- execute_command (to run fix commands)

Respond with ONLY the JSON action object, no explanation:
{
  "type": "modify_file|create_file|execute_command",
  "path": "path/to/file",
  "oldContent": "old content (for modify)",
  "newContent": "new content",
  "command": "command to run (for execute)"
}`;

    try {
      const response = await callAI(
        this.config,
        this.projectInfo,
        prompt,
        'plan', // Fixed: use 'plan' mode since we expect JSON with actions
        [],
        undefined,
        undefined,
        undefined,
        process.cwd()
      );

      const content = response.content || '{}';

      // Use robust extractJSON function from src/ai.ts
      // This handles various JSON formats including markdown code blocks
      const jsonStr = extractJSON(content);

      if (!jsonStr) {
        console.error(chalk.red(`    Error generating fix ${fixNumber}: Could not extract valid JSON from response`));
        console.error(chalk.red(`    Content preview: ${content.substring(0, 200)}...`));
        return null;
      }

      const fixAction = JSON.parse(jsonStr);

      // Validate and normalize the action
      if (fixAction.type === 'modify_file' && !fixAction.oldContent) {
        // For modify, we need oldContent - try to read file
        return null; // Will be handled by higher-level logic
      }

      return fixAction as Action;
    } catch (error) {
      console.error(chalk.red(`    Error generating fix ${fixNumber}: ${error}`));
      return null;
    }
  }

  /**
   * Describe a fix action for display
   */
  private describeFix(action: Action): string {
    switch (action.type) {
      case 'create':
        return `Create ${action.path}`;
      case 'modify':
        return `Modify ${action.path}`;
      case 'run':
        return `Run "${action.command}"`;
      case 'delete':
        return `Delete ${action.path}`;
      default:
        return `Unknown action: ${JSON.stringify(action)}`;
    }
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Verify requirement with ReAct (convenience wrapper)
 *
 * Phase 3: Added optimization options support
 */
export async function verifyWithReAct(
  config: Config,
  projectInfo: any,
  requirement: string,
  executionHistory: ExecutionRecord[],
  maxIterations: number = 5,
  optimizationOptions?: VerifierOptimizationOptions
): Promise<{
  satisfied: boolean;
  trace?: ReActTrace;
  reasoning: string;
}> {
  const verifier = new ReActVerifier(config, projectInfo, requirement, optimizationOptions);
  return verifier.verifyWithReAct(executionHistory, maxIterations);
}
