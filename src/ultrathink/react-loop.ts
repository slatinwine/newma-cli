/**
 * ReAct (Reasoning + Acting) Implementation
 *
 * Based on research paper: https://arxiv.org/abs/2305.10601
 * and Python demo: 202601170945.py
 *
 * ReAct interleaves reasoning and acting by generating thoughts,
 * taking actions, and observing results in a loop.
 */

import { Action } from '../types';
import { Config } from '../config';
import { callAI, ExtendedAIResponse, extractJSON } from '../ai';
import { ReActStep, ReActTrace, ReActState, ReActMetadata } from './types';
import { formatObservation, extractReasoning, formatTime } from './utils';
import { ReasoningTracker, TrackedEventType } from './tracker';
import { AdaptiveContextManager, ComplexityLevel } from './context-manager';
import { MemoCliPlugin } from '../loop/plugins/memo-cli-plugin';
import chalk from 'chalk';

// ============================================================================
// REACT OPTIMIZATION OPTIONS (Phase 3)
// ============================================================================

/**
 * Optimization options for ReAct loop (Phase 3)
 */
export interface ReActOptimizationOptions {
  /** Enable optimizations (default: false) */
  useOptimizations?: boolean;
  /** Reasoning tracker instance */
  tracker?: ReasoningTracker;
  /** Context manager instance */
  contextManager?: AdaptiveContextManager;
  /** Sliding window size for context (default: 3) */
  slidingWindowSize?: number;
  /** Memo plugin for persisting reasoning (Phase 9) */
  memoPlugin?: MemoCliPlugin;
}

// ============================================================================
// REACT AGENT
// ============================================================================

export class ReActAgent {
  private config: Config;
  private projectInfo: any;
  private maxSteps: number;
  private optimizationOptions: ReActOptimizationOptions;
  private stepHistory: ReActStep[] = []; // For sliding window
  private memoPlugin?: MemoCliPlugin; // Memo integration

  constructor(
    config: Config,
    projectInfo: any,
    maxSteps: number = 5,
    optimizationOptions: ReActOptimizationOptions = {}
  ) {
    this.config = config;
    this.projectInfo = projectInfo;
    this.maxSteps = maxSteps;
    this.optimizationOptions = {
      useOptimizations: false,
      slidingWindowSize: 3,
      ...optimizationOptions,
    };
    this.memoPlugin = optimizationOptions.memoPlugin;
  }

  /**
   * Run ReAct loop to satisfy a requirement
   * Corresponds to main loop in Python demo (lines 135-188)
   */
  async runReActLoop(
    requirement: string,
    initialObservation: string = '',
    onStep?: (step: ReActStep) => void
  ): Promise<ReActTrace> {
    const startTime = Date.now();
    const steps: ReActStep[] = [];
    this.stepHistory = []; // Reset history
    let observation = initialObservation;
    let satisfied = false;
    let selfCorrections = 0;
    let fallbackPlans = 0;

    const { tracker, useOptimizations, memoPlugin } = this.optimizationOptions;

    // Start tracking stage
    tracker?.startStage('react-loop');

    // Create reasoning chain in Memo (Phase 9)
    const chainId = memoPlugin ?
      await memoPlugin.createReasoningChain(requirement, 'verification') :
      undefined;

    console.log('🔄 Starting ReAct loop...');
    console.log(`   Max steps: ${this.maxSteps}\n`);
    if (chainId) {
      console.log(`   📝 Reasoning chain: ${chainId.substring(0, 8)}...\n`);
    }

    for (let stepNumber = 1; stepNumber <= this.maxSteps; stepNumber++) {
      console.log(chalk.cyan(`\n--- Step ${stepNumber}/${this.maxSteps} ---`));

      // THINK: Generate reasoning based on current observation
      const thought = await this.think(requirement, observation, stepNumber);

      // Record think step in Memo (Phase 9)
      const thinkStepId = memoPlugin ?
        await memoPlugin.addReasoningStep(
          'analysis',
          `ReAct Step ${stepNumber}: Think`,
          thought,
          undefined,
          {
            algorithm: 'ReAct',
            confidence: 0.8,
            metadata: { stepNumber, phase: 'think' }
          }
        ) :
        undefined;

      // ACT: Decide on action based on thought
      const action = await this.act(thought, requirement, observation);

      // Check if requirement is satisfied
      if (action && action.type === 'verify' && action.command?.includes('satisfied')) {
        console.log(chalk.green('✅ Requirement satisfied!'));
        satisfied = true;
        steps.push({
          stepNumber,
          thought,
          action: null,
          observation: 'Requirement satisfied',
          timestamp: Date.now(),
          success: true,
        });
        break;
      }

      // EXECUTE: Perform action and observe result
      let actionResult: any;
      let actionSuccess = true;
      let actionObservation = '';

      if (action) {
        try {
          // Note: In real implementation, this would execute the action
          // For now, we simulate the observation
          actionObservation = await this.executeAction(action);
          actionResult = { success: true, output: actionObservation };

          // Update think step with action result (Phase 9)
          if (thinkStepId && memoPlugin) {
            await memoPlugin.updateReasoningStep(
              thinkStepId,
              'completed',
              {
                success: true,
                output: `Action: ${action.type} ${action.path || action.command || ''}\nResult: ${actionObservation}`,
                duration: 0
              }
            );
          }
        } catch (error: any) {
          actionSuccess = false;
          actionObservation = `Error: ${error.message}`;
          actionResult = { success: false, error: error.message };
          console.log(chalk.red(`❌ Action failed: ${error.message}`));

          // Update think step with error (Phase 9)
          if (thinkStepId && memoPlugin) {
            await memoPlugin.updateReasoningStep(
              thinkStepId,
              'failed',
              {
                success: false,
                error: `Action failed: ${error.message}`,
                duration: 0
              }
            );
          }
        }
      }

      const step: ReActStep = {
        stepNumber,
        thought,
        action: action || null,
        observation: actionObservation || observation,
        timestamp: Date.now(),
        executionTime: action ? 0 : 0, // Would be measured in real implementation
        success: actionSuccess,
      };

      steps.push(step);
      this.stepHistory.push(step); // Add to history for sliding window

      // Track Act and Observe events (Phase 3)
      const actTime = action ? 0 : Date.now() - step.timestamp;
      tracker?.trackReActAct(stepNumber, action, actTime);
      tracker?.trackReActObserve(stepNumber, actionObservation || observation);

      // Track complete step
      tracker?.trackReActStep({
        ...step,
        thoughtTime: 0, // Would be measured in think()
        actionTime: actTime,
        contextSize: useOptimizations ? this.buildContextWithSlidingWindow(observation, 3).length : observation.length,
      });

      // Call step callback if provided
      if (onStep) {
        onStep(step);
      }

      // Update observation for next iteration
      observation = actionObservation || observation;

      // Display step summary
      console.log(chalk.gray(`  💭 Thought: ${thought.substring(0, 100)}...`));
      if (action) {
        console.log(chalk.yellow(`  ⚡ Action: ${action.type} ${action.path || action.command || ''}`));
      }
      console.log(chalk.gray(`  👁️  Observation: ${observation.substring(0, 100)}...`));

      // Check if we should continue
      if (observation.toLowerCase().includes('done') || observation.toLowerCase().includes('complete')) {
        console.log(chalk.green('\n✅ Task completed!'));
        satisfied = true;
        break;
      }

      // Small delay for readability
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const endTime = Date.now();

    // Complete reasoning chain in Memo (Phase 9)
    if (chainId && memoPlugin) {
      await memoPlugin.completeReasoningChain(
        satisfied,
        steps.map(s => `${s.stepNumber}. ${s.observation}`).join('\n'),
        satisfied ? undefined : 'Reached max steps without satisfaction'
      );
      console.log(chalk.green(`\n📝 Reasoning chain saved: ${chainId.substring(0, 8)}...`));
    }

    // Complete tracking stage (Phase 3)
    tracker?.endStage('react-loop');

    const metadata: ReActMetadata = {
      startedAt: startTime,
      completedAt: endTime,
      maxSteps: this.maxSteps,
      terminationReason: satisfied ? 'satisfied' : 'max-steps',
      selfCorrections,
      fallbackPlans,
    };

    return {
      requirement,
      steps,
      finalState: observation,
      success: satisfied,
      totalSteps: steps.length,
      totalTime: endTime - startTime,
      reasoning: `ReAct loop completed with ${steps.length} steps. ${satisfied ? 'Requirement satisfied.' : 'Reached max steps without satisfaction.'}`,
      metadata,
    };
  }

  /**
   * THINK: Generate reasoning based on requirement and observation
   * Corresponds to think() in Python demo (lines 13-44)
   *
   * Phase 3: Added sliding window optimization and tracking
   * Phase 9.1: Added historical reasoning context from Memo
   */
  private async think(
    question: string,
    observation: string,
    stepNumber: number
  ): Promise<string> {
    const { tracker, contextManager, useOptimizations, slidingWindowSize = 3, memoPlugin } = this.optimizationOptions;

    const thinkStart = Date.now();

    // Build context with sliding window (if optimizations enabled)
    let context = observation;
    if (useOptimizations && this.stepHistory.length > 0) {
      context = this.buildContextWithSlidingWindow(observation, slidingWindowSize);
    }

    // Phase 9.1: Fetch historical reasoning context from Memo
    let historicalContext = '';
    if (memoPlugin) {
      try {
        historicalContext = await memoPlugin.getReasoningAIContext(question, 'verification');
        if (historicalContext) {
          console.log(chalk.gray('📚 Using historical reasoning context'));
        }
      } catch (error) {
        // Silently ignore errors in fetching historical context
        console.debug(chalk.gray(`Failed to fetch historical context: ${error}`));
      }
    }

    const prompt = this.buildThinkPrompt(question, context, stepNumber, historicalContext);

    try {
      const response = await callAI(
        this.config,
        this.projectInfo,
        prompt,
        'think',
        [],
        undefined,
        undefined,
        undefined,
        process.cwd()
      );

      const thought = extractReasoning(response.content || '');
      const thinkTime = Date.now() - thinkStart;

      // Track Think event
      tracker?.trackReActThink(stepNumber, thought, thinkTime, prompt.length);

      return thought;
    } catch (error) {
      console.error(`Error in think step: ${error}`);
      return `I need to analyze the current state and determine the next step for: ${question}`;
    }
  }

  /**
   * Build context with sliding window (Phase 3 optimization)
   *
   * Only includes recent N steps instead of full history
   * Expected savings: ~66% data transfer
   * - Full history: 5 steps × 1000 chars = 5000 chars
   * - Sliding window: 3 steps × 500 chars = 1500 chars
   */
  private buildContextWithSlidingWindow(currentObservation: string, windowSize: number): string {
    const recentSteps = this.stepHistory.slice(-windowSize);

    if (recentSteps.length === 0) {
      return currentObservation;
    }

    const contextParts: string[] = [];

    // Add recent steps
    for (const step of recentSteps) {
      contextParts.push(`Step ${step.stepNumber}:`);
      contextParts.push(`  Thought: ${step.thought.substring(0, 150)}`);
      if (step.action) {
        contextParts.push(`  Action: ${step.action.type}`);
      }
      contextParts.push(`  Observation: ${step.observation.substring(0, 150)}`);
      contextParts.push('');
    }

    // Add current observation
    contextParts.push(`CURRENT STATE:`);
    contextParts.push(currentObservation);

    return contextParts.join('\n');
  }

  /**
   * ACT: Decide action based on thought and context
   * Corresponds to act() in Python demo (lines 46-66)
   */
  private async act(
    thought: string,
    question: string,
    observation: string
  ): Promise<Action | null> {
    // If thought indicates satisfaction, return verify action
    if (thought.toLowerCase().includes('satisfied') || thought.toLowerCase().includes('complete')) {
      return {
        type: 'verify',
        command: 'satisfied',
      };
    }

    // Otherwise, generate action from thought
    const prompt = this.buildActPrompt(thought, question, observation);

    try {
      const response = await callAI(
        this.config,
        this.projectInfo,
        prompt,
        'plan',
        [],
        undefined,
        undefined,
        undefined,
        process.cwd()
      );

      // Parse action from response
      return this.parseAction(response.content || '');
    } catch (error) {
      console.error(`Error in act step: ${error}`);
      return null;
    }
  }

  /**
   * EXECUTE: Simulate action execution (in real implementation, this would use tool executor)
   * Corresponds to execute_action() in Python demo (lines 68-81)
   */
  private async executeAction(action: Action): Promise<string> {
    // In real implementation, this would:
    // 1. Call ToolExecutor.executeAction(action)
    // 2. Return the actual result
    // For now, we return a simulated observation

    switch (action.type) {
      case 'create':
        return `File ${action.path} created successfully`;
      case 'modify':
        return `File ${action.path} modified successfully`;
      case 'delete':
        return `File ${action.path} deleted successfully`;
      case 'run':
        return `Command "${action.command}" executed`;
      case 'verify':
        return `Verification completed`;
      default:
        return `Action ${action.type} completed`;
    }
  }

  // ============================================================================
  // PROMPT BUILDING
  // ============================================================================

  private buildThinkPrompt(
    requirement: string,
    observation: string,
    stepNumber: number,
    historicalContext: string = ''
  ): string {
    const basePrompt = `You are using ReAct (Reasoning + Acting) to satisfy a requirement.

REQUIREMENT: ${requirement}

CURRENT OBSERVATION:
${observation || 'Starting new task'}

STEP ${stepNumber} of ${this.maxSteps}

Think carefully about:
1. What is the current state?
2. What has worked so far? What hasn't?
3. What should be done next?
4. Are we closer to satisfying the requirement?

Provide your reasoning (thought) as a clear, concise explanation of what you think should happen next.

IMPORTANT: If the requirement appears to be satisfied based on the observation,
clearly state "Requirement satisfied" and explain why.`;

    // Phase 9.1: Append historical reasoning context if available
    if (historicalContext && historicalContext.trim().length > 0) {
      return `${basePrompt}

─────────────────────────────────────────────────────────────
📚 HISTORICAL REASONING CONTEXT
─────────────────────────────────────────────────────────────
${historicalContext}

💡 Use this historical context to inform your reasoning, but adapt
   it to the current situation. Don't blindly repeat past patterns
   if they don't apply.
─────────────────────────────────────────────────────────────`;
    }

    return basePrompt;
  }

  private buildActPrompt(
    thought: string,
    requirement: string,
    observation: string
  ): string {
    return `Based on your reasoning, determine the next action.

REQUIREMENT: ${requirement}

YOUR THOUGHT:
${thought}

CURRENT OBSERVATION:
${observation}

Decide on the next action to take. Respond with a JSON object:
\`\`\`json
{
  "type": "create|modify|delete|run|verify",
  "path": "file path (if applicable)",
  "command": "command (if applicable)",
  "content": "content (if applicable)"
}
\`\`\`

If the requirement is already satisfied, return:
\`\`\`json
{
  "type": "verify",
  "command": "satisfied"
}
\`\`\`

Only return the JSON object, nothing else.`;
  }

  // ============================================================================
  // RESPONSE PARSING
  // ============================================================================

  private parseAction(content: string): Action | null {
    try {
      // Use robust extractJSON function from src/ai.ts
      // This handles various JSON formats including markdown code blocks
      const jsonStr = extractJSON(content);

      if (!jsonStr) {
        console.error(`Error parsing action: Could not extract valid JSON from response`);
        console.error(`Content preview: ${content.substring(0, 200)}...`);
        return null;
      }

      const actionData = JSON.parse(jsonStr);

      return {
        type: actionData.type,
        path: actionData.path,
        command: actionData.command,
        content: actionData.content,
        // oldContent and newContent are not in Action type, remove them
      };
    } catch (error) {
      console.error(`Error parsing action: ${error}`);
      console.error(`Content preview: ${content.substring(0, 200)}...`);
      return null;
    }
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Run ReAct loop (convenience wrapper)
 *
 * Phase 3: Added optimization options support
 */
export async function runReActLoop(
  config: Config,
  projectInfo: any,
  requirement: string,
  options: {
    maxSteps?: number;
    initialObservation?: string;
    onStep?: (step: ReActStep) => void;
    // Phase 3 optimization options
    useOptimizations?: boolean;
    tracker?: ReasoningTracker;
    contextManager?: AdaptiveContextManager;
    slidingWindowSize?: number;
    // Phase 9: Memo plugin
    memoPlugin?: MemoCliPlugin;
  } = {}
): Promise<ReActTrace> {
  const {
    maxSteps,
    initialObservation,
    onStep,
    useOptimizations,
    tracker,
    contextManager,
    slidingWindowSize,
    memoPlugin,
  } = options;

  const agent = new ReActAgent(
    config,
    projectInfo,
    maxSteps || 5,
    {
      useOptimizations,
      tracker,
      contextManager,
      slidingWindowSize,
      memoPlugin,
    }
  );

  return agent.runReActLoop(
    requirement,
    initialObservation || '',
    onStep
  );
}
