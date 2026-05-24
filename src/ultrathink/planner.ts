/**
 * Multi-Plan Generator using Tree of Thoughts
 *
 * Generates multiple alternative action plans and selects the best one
 * using Tree of Thoughts reasoning for evaluation.
 */

import { Action } from '../types';
import { Config } from '../config';
import { callAI, ExtendedAIResponse } from '../ai';
import { ThoughtTree, ActionPlan, PlanAlternatives, PlanMetadata } from './types';
import { runToTSearch, getSolutionPath } from './tree-of-thoughts';
import { generateId } from './utils';
import { ReasoningTracker, TrackedEventType } from './tracker';
import { AdaptiveContextManager, ComplexityLevel } from './context-manager';
import { ProjectSummary } from './cache';
import chalk from 'chalk';

// Re-export types for convenience
export type { PlanAlternatives };

// ============================================================================
// OPTIMIZATION OPTIONS
// ============================================================================

/**
 * Optimization options for planner (Phase 2)
 */
export interface PlannerOptimizationOptions {
  /** Enable optimizations (default: false) */
  useOptimizations?: boolean;
  /** Reasoning tracker instance */
  tracker?: ReasoningTracker;
  /** Context manager instance */
  contextManager?: AdaptiveContextManager;
  /** Cached project summary (from cache.ts) */
  projectSummary?: ProjectSummary;
  /** Quick filter: only evaluate top N plans in detail (default: 3) */
  quickFilterTopN?: number;
}

// ============================================================================
// MULTI-PLAN GENERATOR
// ============================================================================

export class MultiPlanGenerator {
  private config: Config;
  private projectInfo: any;
  private optimizationOptions: PlannerOptimizationOptions;

  constructor(config: Config, projectInfo: any, optimizationOptions: PlannerOptimizationOptions = {}) {
    this.config = config;
    this.projectInfo = projectInfo;
    this.optimizationOptions = {
      useOptimizations: false,
      quickFilterTopN: 3,
      ...optimizationOptions,
    };
  }

  /**
   * Generate multiple alternative plans using ToT and select the best
   */
  async generateAndSelectPlans(
    requirement: string,
    context: string,
    options: {
      numAlternatives?: number;
      searchStrategy?: 'bfs' | 'dfs' | 'beam';
      maxDepth?: number;
      beamWidth?: number;
      showRejected?: boolean;
    } = {}
  ): Promise<{
    selected: ActionPlan;
    rejected: ActionPlan[];
    thoughtTree: ThoughtTree;
    reasoning: string;
  }> {
    const {
      numAlternatives = 3,  // OPTIMIZED: 减少从 7 到 3，提升速度
      searchStrategy = 'beam',  // OPTIMIZED: 从 bfs 改为 beam，更快
      maxDepth = 4,         // OPTIMIZED: 减少从 6 到 4，减少搜索深度
      beamWidth = 3,        // OPTIMIZED: 减少从 5 到 3，减少分支宽度
      showRejected = false,
    } = options;

    try {
      console.log(chalk.gray('⏱️  [Ultrathink] 开始计划生成...\n'));

      // Step 1: Generate initial thought
      const initialThoughtStart = Date.now();
      const initialThought = await this.generateInitialThought(requirement, context);
      console.log(chalk.gray(`⏱️  [Ultrathink] 初始思考生成: ${Date.now() - initialThoughtStart}ms\n`));

      // Step 2: Run ToT search to explore reasoning paths
      const totSearchStart = Date.now();
      const { tree, bestNode } = await runToTSearch(
        this.config,
        this.projectInfo,
        requirement,
        initialThought,
        searchStrategy,
        maxDepth,
        beamWidth,
        numAlternatives
      );
      console.log(chalk.gray(`⏱️  [Ultrathink] ToT搜索: ${Date.now() - totSearchStart}ms\n`));

      // Step 3: Generate action plans from top thoughts
      const topThoughts = this.getTopThoughts(tree, numAlternatives);
      const planGenStart = Date.now();
      const plans = await this.generatePlansFromThoughts(
        requirement,
        topThoughts
      );
      console.log(chalk.gray(`⏱️  [Ultrathink] 计划生成: ${Date.now() - planGenStart}ms\n`));

      // Step 4: Evaluate plans
      const evalStart = Date.now();
      const evaluatedPlans = await this.evaluatePlans(plans, requirement);
      console.log(chalk.gray(`⏱️  [Ultrathink] 计划评估: ${Date.now() - evalStart}ms\n`));

      // Step 5: Select best plan
      if (evaluatedPlans.length === 0) {
        throw new Error('No valid plans were generated');
      }

      const selected = evaluatedPlans[0];
      const rejected = evaluatedPlans.slice(1);

      const reasoning = this.generateSelectionReasoning(selected, rejected, tree);

      return {
        selected,
        rejected,
        thoughtTree: tree,
        reasoning,
      };
    } catch (error) {
      // Return fallback plan on error
      console.error(`Error in generateAndSelectPlans: ${error}`);

      const fallbackPlan: ActionPlan = {
        id: generateId(),
        thoughtNodeId: generateId(),
        actions: [],
        reasoning: 'Fallback plan due to error',
        estimatedTime: 0,
        confidence: 0.5,
        riskLevel: 'high',
        metadata: {
          generationMethod: 'fallback',
          searchDepth: 0,
          nodesExplored: 0,
          evaluationCriteria: [],
        },
      };

      return {
        selected: fallbackPlan,
        rejected: [],
        thoughtTree: {
          root: {
            id: 'root',
            content: 'Error occurred',
            parentId: null,
            children: [],
            depth: 0,
            state: 'pending' as any,
            metadata: { timestamp: Date.now() },
          },
          nodes: new Map(),
          currentLeaf: null,
          maxDepth: 0,
          beamWidth: 0,
          branchingFactor: 0,
          searchStrategy: 'bfs' as const,
          metadata: {
            requirement,
            createdAt: Date.now(),
            totalNodes: 0,
            evaluatedNodes: 0,
            prunedNodes: 0,
            searchTime: 0,
            bestScore: 0,
          },
        },
        reasoning: 'Error occurred during planning, using fallback plan',
      };
    }
  }

  /**
   * Generate initial high-level thought
   */
  private async generateInitialThought(
    requirement: string,
    context: string
  ): Promise<string> {
    const prompt = `You are an expert software architect using Tree of Thoughts reasoning.

REQUIREMENT: ${requirement}

PROJECT CONTEXT:
${context}

Generate an initial high-level approach for satisfying this requirement.
Think about:
1. What is the core problem being solved?
2. What are the main components or steps needed?
3. What is a good starting point?
4. What should be considered first?

Provide your initial thought as a clear, strategic overview of your approach.
Keep it concise (2-3 sentences).`;

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

      return (response.content || 'Default thought').trim();
    } catch (error) {
      console.error(`Error generating initial thought: ${error}`);
      return `I need to analyze the requirement: ${requirement}`;
    }
  }

  /**
   * Get top N thoughts from tree by score
   */
  private getTopThoughts(tree: ThoughtTree, n: number): Array<{
    thought: string;
    score: number;
    depth: number;
  }> {
    const allNodes = Array.from(tree.nodes.values());

    // First try: Filter to nodes with high scores (> 0.5)
    let candidates = allNodes.filter(
      node => node.score !== undefined && node.score > 0.5
    );

    // Fallback: If no high-scoring nodes, take all nodes with scores
    if (candidates.length === 0) {
      candidates = allNodes.filter(
        node => node.score !== undefined
      );
    }

    // Final fallback: If still no nodes, use all nodes with score = 0.5
    if (candidates.length === 0) {
      candidates = allNodes.map(node => ({
        ...node,
        score: node.score ?? 0.5
      }));
    }

    // Sort by score and depth (prefer deeper, high-scoring thoughts)
    candidates.sort((a, b) => {
      const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
      if (Math.abs(scoreDiff) > 0.1) {
        return scoreDiff;
      }
      return b.depth - a.depth; // Prefer deeper thoughts if scores are similar
    });

    return candidates.slice(0, n).map(node => ({
      thought: node.content,
      score: node.score ?? 0.5,
      depth: node.depth,
    }));
  }

  /**
   * Generate concrete action plans from thoughts
   */
  private async generatePlansFromThoughts(
    requirement: string,
    thoughtsWithScores: Array<{ thought: string; score: number; depth: number }>
  ): Promise<ActionPlan[]> {
    const plans: ActionPlan[] = [];

    for (const { thought, score } of thoughtsWithScores) {
      const plan = await this.generatePlanFromThought(requirement, thought, score);
      plans.push(plan);
    }

    return plans;
  }

  /**
   * Generate a single action plan from a thought
   */
  private async generatePlanFromThought(
    requirement: string,
    thought: string,
    thoughtScore: number
  ): Promise<ActionPlan> {
    const prompt = `Convert a reasoning thought into a concrete action plan.

REQUIREMENT: ${requirement}

REASONING/THOUGHT:
${thought}

Based on this reasoning, generate a detailed action plan with specific steps.
Each action should be one of:
- create_file(path, content)
- modify_file(path, old_content, new_content)
- execute_command(command)

Format your response as JSON:
\`\`\`json
{
  "reasoning": "Explanation of why this approach",
  "actions": [
    {"type": "create_file", "path": "path/to/file", "content": "file content"},
    {"type": "modify_file", "path": "path/to/file", "oldContent": "old", "newContent": "new"},
    {"type": "execute_command", "command": "command to run"}
  ],
  "estimatedTime": 5000,
  "riskLevel": "low|medium|high"
}
\`\`\`

Only include the JSON object, nothing else.`;

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

      // Extract JSON from response
      const content = response.content || '{}';
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;

      const planData = JSON.parse(jsonStr);

      const plan: ActionPlan = {
        id: generateId(),
        thoughtNodeId: generateId(),
        actions: planData.actions || [],
        reasoning: planData.reasoning || thought,
        estimatedTime: planData.estimatedTime || 5000,
        confidence: thoughtScore,
        riskLevel: planData.riskLevel || 'medium',
        metadata: {
          generationMethod: 'tot-bfs',
          searchDepth: 3,
          nodesExplored: 10,
          evaluationCriteria: ['clarity', 'feasibility', 'efficiency'],
        },
      };

      return plan;
    } catch (error) {
      console.error(`Error generating plan from thought: ${error}`);

      // Fallback: create simple plan
      return {
        id: generateId(),
        thoughtNodeId: generateId(),
        actions: [],
        reasoning: thought,
        estimatedTime: 5000,
        confidence: thoughtScore,
        riskLevel: 'medium',
        metadata: {
          generationMethod: 'tot-bfs',
          searchDepth: 3,
          nodesExplored: 10,
          evaluationCriteria: ['clarity', 'feasibility', 'efficiency'],
        },
      };
    }
  }

  /**
   * Evaluate and rank plans (with optional two-phase optimization)
   */
  private async evaluatePlans(
    plans: ActionPlan[],
    requirement: string
  ): Promise<ActionPlan[]> {
    if (plans.length === 0) {
      return [];
    }

    // Phase 2 Optimization: Two-stage evaluation
    if (this.optimizationOptions.useOptimizations && plans.length > 3) {
      return await this.evaluatePlansOptimized(plans, requirement);
    }

    // Original single-stage evaluation
    return await this.evaluatePlansOriginal(plans, requirement);
  }

  /**
   * Two-stage evaluation: quick filter → deep evaluation (Phase 2 optimization)
   *
   * Stage 1: Quick filter all plans with minimal context
   * Stage 2: Deep evaluate only top N plans with full context
   *
   * Expected savings: ~37% data transfer
   * - Quick: 7 plans × 100 chars = 700 chars
   * - Deep: Top 3 × 500 chars = 1,500 chars
   * - Total: 2,200 chars (vs original 3,500 chars)
   */
  private async evaluatePlansOptimized(
    plans: ActionPlan[],
    requirement: string
  ): Promise<ActionPlan[]> {
    const { tracker, contextManager, quickFilterTopN = 3 } = this.optimizationOptions;

    // ========================================================================
    // Stage 1: Quick Filter (evaluate all plans with minimal context)
    // ========================================================================

    tracker?.trackEvent(TrackedEventType.STAGE_START, { stage: 'quick-filter', planCount: plans.length });

    const quickFilterStart = Date.now();

    // Build minimal descriptions (only reasoning + action count)
    const quickDesc = plans
      .map((plan, idx) =>
        `Plan ${idx + 1}: ${plan.reasoning?.substring(0, 100) || 'No reasoning'} (${plan.actions.length} actions, confidence: ${plan.confidence.toFixed(2)})`
      )
      .join('\n');

    const quickPrompt = `Quick evaluation: Rank these plans by their reasoning quality (0.0-1.0).

REQUIREMENT: ${requirement}

${quickDesc}

Provide scores in format: Plan 1: 0.85, Plan 2: 0.72, etc.`;

    try {
      const quickResponse = await callAI(
        this.config,
        this.projectInfo,
        quickPrompt,
        'think',
        [],
        undefined,
        undefined,
        undefined,
        process.cwd()
      );

      tracker?.trackEvent(TrackedEventType.API_CALL, {
        stage: 'quick-filter',
        promptLength: quickPrompt.length,
        responseLength: quickResponse.content?.length || 0,
        duration: Date.now() - quickFilterStart,
      });

      const quickScores = this.parsePlanScores(quickResponse.content || '', plans.length);

      // Update with quick scores
      plans.forEach((plan, idx) => {
        const quickScore = quickScores.get(idx) ?? plan.confidence;
        plan.confidence = (plan.confidence + quickScore) / 2;
      });

      // Sort and get top N
      plans.sort((a, b) => b.confidence - a.confidence);
      const topPlans = plans.slice(0, quickFilterTopN);
      const restPlans = plans.slice(quickFilterTopN);

      tracker?.trackEvent(TrackedEventType.STAGE_COMPLETE, {
        stage: 'quick-filter',
        duration: Date.now() - quickFilterStart,
        topPlansSelected: topPlans.length,
      });

      // ========================================================================
      // Stage 2: Deep Evaluation (evaluate only top N with full context)
      // ========================================================================

      tracker?.trackEvent(TrackedEventType.STAGE_START, { stage: 'deep-evaluation', planCount: topPlans.length });

      const deepEvalStart = Date.now();

      // Build detailed descriptions (full reasoning + actions)
      const deepDesc = topPlans
        .map(
          (plan, idx) => `
Top Plan ${idx + 1}:
Reasoning: ${plan.reasoning}
Actions: ${plan.actions.length} steps
${plan.actions.slice(0, 3).map((a, i) => `  ${i + 1}. ${a.type}`).join('\n')}
${plan.actions.length > 3 ? `  ... and ${plan.actions.length - 3} more` : ''}
Estimated Time: ${plan.estimatedTime}ms
Confidence: ${plan.confidence.toFixed(2)}
Risk: ${plan.riskLevel}
`
        )
        .join('\n');

      const deepPrompt = `Deep evaluation: Assess these top plans thoroughly.

REQUIREMENT: ${requirement}

${deepDesc}

Evaluate on:
1. Quality: How well does this satisfy the requirement?
2. Efficiency: Is this the most efficient approach?
3. Risk: What are potential issues or failures?
4. Completeness: Does this cover all necessary steps?

Provide scores (0.0 to 1.0): Plan 1: 0.85, Plan 2: 0.72, etc.`;

      const deepResponse = await callAI(
        this.config,
        this.projectInfo,
        deepPrompt,
        'think',
        [],
        undefined,
        undefined,
        undefined,
        process.cwd()
      );

      tracker?.trackEvent(TrackedEventType.API_CALL, {
        stage: 'deep-evaluation',
        promptLength: deepPrompt.length,
        responseLength: deepResponse.content?.length || 0,
        duration: Date.now() - deepEvalStart,
      });

      const deepScores = this.parsePlanScores(deepResponse.content || '', topPlans.length);

      // Update top plans with deep scores
      topPlans.forEach((plan, idx) => {
        const deepScore = deepScores.get(idx) ?? plan.confidence;
        // Weight deep score more heavily (75% deep, 25% quick)
        plan.confidence = plan.confidence * 0.25 + deepScore * 0.75;
      });

      // Track evaluation events
      topPlans.forEach((plan) => {
        tracker?.trackEvent(TrackedEventType.PLAN_EVALUATED, {
          planId: plan.id,
          confidence: plan.confidence,
          stage: 'deep',
        });
      });

      restPlans.forEach((plan) => {
        tracker?.trackEvent(TrackedEventType.PLAN_EVALUATED, {
          planId: plan.id,
          confidence: plan.confidence,
          stage: 'quick',
        });
      });

      tracker?.trackEvent(TrackedEventType.STAGE_COMPLETE, {
        stage: 'deep-evaluation',
        duration: Date.now() - deepEvalStart,
      });

      // Final sort
      const allPlans = [...topPlans, ...restPlans];
      allPlans.sort((a, b) => b.confidence - a.confidence);

      return allPlans;
    } catch (error) {
      console.error(`Error in optimized evaluation: ${error}`);
      // Fallback to original evaluation
      return await this.evaluatePlansOriginal(plans, requirement);
    }
  }

  /**
   * Original single-stage evaluation (backward compatible)
   */
  private async evaluatePlansOriginal(
    plans: ActionPlan[],
    requirement: string
  ): Promise<ActionPlan[]> {
    // Build evaluation prompt
    const plansDesc = plans
      .map(
        (plan, idx) => `
Plan ${idx + 1}:
Reasoning: ${plan.reasoning}
Actions: ${plan.actions.length} steps
Estimated Time: ${plan.estimatedTime}ms
Confidence: ${plan.confidence.toFixed(2)}
Risk: ${plan.riskLevel}
`
      )
      .join('\n');

    const prompt = `Evaluate these alternative action plans for the requirement.

REQUIREMENT: ${requirement}

${plansDesc}

Evaluate each plan on:
1. Quality: How well does this plan satisfy the requirement?
2. Efficiency: Is this the most efficient approach?
3. Risk: What are the potential issues or failures?
4. Completeness: Does this plan cover all necessary steps?

Provide scores (0.0 to 1.0) for each plan in this format:
Plan 1: 0.85
Plan 2: 0.72
Plan 3: 0.91
...`;

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

      const scores = this.parsePlanScores(response.content || '', plans.length);

      // Update plan scores and sort
      plans.forEach((plan, idx) => {
        const newScore = scores.get(idx) ?? plan.confidence;
        // Combine original confidence with evaluation score
        plan.confidence = (plan.confidence + newScore) / 2;
      });

      plans.sort((a, b) => b.confidence - a.confidence);

      return plans;
    } catch (error) {
      console.error(`Error evaluating plans: ${error}`);
      // Sort by original confidence
      plans.sort((a, b) => b.confidence - a.confidence);
      return plans;
    }
  }

  /**
   * Parse plan scores from evaluation response
   */
  private parsePlanScores(response: string, numPlans: number): Map<number, number> {
    const scores = new Map<number, number>();

    for (let i = 0; i < numPlans; i++) {
      const pattern = new RegExp(`Plan\\s+${i + 1}:\\s*(\\d+\\.?\\d*)`, 'i');
      const match = response.match(pattern);
      if (match) {
        const score = parseFloat(match[1]);
        scores.set(i, Math.min(1.0, Math.max(0.0, score)));
      } else {
        scores.set(i, 0.5); // Default score
      }
    }

    return scores;
  }

  /**
   * Generate reasoning for why this plan was selected
   */
  private generateSelectionReasoning(
    selected: ActionPlan,
    rejected: ActionPlan[],
    tree: ThoughtTree
  ): string {
    const reasons: string[] = [];

    reasons.push(`Selected plan with confidence ${selected.confidence.toFixed(2)} (risk: ${selected.riskLevel})`);
    reasons.push(`Thought tree explored ${tree.metadata.totalNodes} reasoning paths`);
    reasons.push(`Best thought score: ${tree.metadata.bestScore.toFixed(2)}`);

    if (selected.reasoning) {
      reasons.push(`Reasoning: ${selected.reasoning.substring(0, 150)}...`);
    }

    if (rejected.length > 0) {
      reasons.push(`Considered ${rejected.length} alternative approaches with lower scores`);
    }

    return reasons.join('. ');
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Generate plans with ToT (convenience wrapper)
 *
 * Phase 2: Added optimization options support
 */
export async function generatePlansWithToT(
  config: Config,
  projectInfo: any,
  requirement: string,
  context: string,
  options?: {
    numAlternatives?: number;
    searchStrategy?: 'bfs' | 'dfs' | 'beam';
    maxDepth?: number;
    beamWidth?: number;
    // Phase 2 optimization options
    useOptimizations?: boolean;
    tracker?: ReasoningTracker;
    contextManager?: AdaptiveContextManager;
    projectSummary?: ProjectSummary;
    quickFilterTopN?: number;
  }
): Promise<PlanAlternatives> {
  const {
    useOptimizations,
    tracker,
    contextManager,
    projectSummary,
    quickFilterTopN,
    ...totOptions
  } = options || {};

  const generator = new MultiPlanGenerator(config, projectInfo, {
    useOptimizations,
    tracker,
    contextManager,
    projectSummary,
    quickFilterTopN,
  });

  const result = await generator.generateAndSelectPlans(requirement, context, totOptions);

  return {
    selected: result.selected,
    rejected: result.rejected,
    selectionReason: result.reasoning,
    comparison: {
      criteria: [
        {
          time: result.selected.estimatedTime,
          confidence: result.selected.confidence,
          risk: result.selected.riskLevel === 'low' ? 1 : result.selected.riskLevel === 'medium' ? 2 : 3,
          complexity: result.selected.actions.length,
        },
      ],
      reasoning: result.reasoning,
    },
  };
}
