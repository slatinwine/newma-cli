/**
 * Tree of Thoughts (ToT) Implementation
 *
 * Based on research paper: https://arxiv.org/abs/2210.03629
 * and Python demo: 202601170938.py
 *
 * ToT enables LM to explore multiple reasoning paths and evaluate them
 * before committing to a particular course of action.
 */

import { ThoughtNode, ThoughtTree, ThoughtState, ThoughtMetadata } from './types';
import {
  createThoughtNode,
  addChildToNode,
  findNodeById,
  countNodes,
  getLeafNodes,
  generateId,
} from './utils';
import { callAI, ExtendedAIResponse } from '../ai';
import { Config } from '../config';
import { ReasoningTracker } from './tracker';
import { ProjectContextCache } from './cache';
import { AdaptiveContextManager, ComplexityLevel } from './context-manager';
import { MemoCliPlugin } from '../loop/plugins/memo-cli-plugin';
import chalk from 'chalk';

// ============================================================================
// TREE OF THOUGHTS ENGINE
// ============================================================================

export class TreeOfThoughtsEngine {
  private config: Config;
  private projectInfo: any;
  private requirement: string;

  // Phase 1: Optimization components (optional for backward compatibility)
  private tracker?: ReasoningTracker;
  private cache?: ProjectContextCache;
  private contextManager?: AdaptiveContextManager;
  private complexityLevel?: ComplexityLevel;
  private useOptimizations: boolean = false;

  // Phase 9: Memo integration
  private memoPlugin?: MemoCliPlugin;
  private chainId?: string;
  private nodeToStepMap: Map<string, string> = new Map(); // ThoughtNode.id -> ReasoningStep.id

  constructor(
    config: Config,
    projectInfo: any,
    requirement: string,
    options?: {
      tracker?: ReasoningTracker;
      cache?: ProjectContextCache;
      contextManager?: AdaptiveContextManager;
      complexityLevel?: ComplexityLevel;
      useOptimizations?: boolean;
      // Phase 9: Memo plugin
      memoPlugin?: MemoCliPlugin;
    }
  ) {
    this.config = config;
    this.projectInfo = projectInfo;
    this.requirement = requirement;

    // Phase 1: Initialize optimization components if provided
    if (options?.useOptimizations) {
      this.useOptimizations = true;
      this.tracker = options.tracker;
      this.cache = options.cache;
      this.contextManager = options.contextManager;
      this.complexityLevel = options.complexityLevel || ComplexityLevel.MEDIUM;
    }

    // Phase 9: Initialize memo plugin
    this.memoPlugin = options?.memoPlugin;
    this.nodeToStepMap = new Map();
  }

  /**
   * Initialize a new thought tree with root thought
   */
  async initializeTree(
    initialThought: string,
    searchStrategy: 'bfs' | 'dfs' | 'beam',
    maxDepth: number,
    beamWidth: number,
    branchingFactor: number
  ): Promise<ThoughtTree> {
    // Phase 9: Create reasoning chain in Memo
    this.chainId = this.memoPlugin ?
      await this.memoPlugin.createReasoningChain(this.requirement, 'planning') :
      undefined;

    if (this.chainId) {
      console.log(`📝 ToT reasoning chain: ${this.chainId.substring(0, 8)}...`);
    }

    const root = createThoughtNode(initialThought, null, 0);
    root.state = ThoughtState.EVALUATED;

    // Phase 9: Record root node in Memo
    if (this.memoPlugin && this.chainId) {
      const rootStepId = await this.memoPlugin.addReasoningStep(
        'planning',
        'ToT Root Thought',
        initialThought,
        undefined,
        {
          algorithm: 'ToT',
          confidence: 1.0,
          metadata: { depth: 0, isRoot: true }
        }
      );
      this.nodeToStepMap.set(root.id, rootStepId);
    }

    const nodes = new Map<string, ThoughtNode>();
    nodes.set(root.id, root);

    const tree: ThoughtTree = {
      root,
      nodes,
      currentLeaf: root,
      maxDepth,
      beamWidth,
      branchingFactor,
      searchStrategy,
      metadata: {
        requirement: this.requirement,
        createdAt: Date.now(),
        totalNodes: 1,
        evaluatedNodes: 1,
        prunedNodes: 0,
        searchTime: 0,
        bestScore: 0,
      },
    };

    return tree;
  }

  /**
   * Generate k candidate thoughts from a parent thought
   * Corresponds to thought_generator in Python demo (lines 61-78)
   *
   * Phase 9.1: Added historical reasoning context
   */
  async generateThoughts(
    parentThought: ThoughtNode,
    k: number = 5
  ): Promise<ThoughtNode[]> {
    // Phase 9.1: Fetch historical reasoning context from Memo
    let historicalContext = '';
    if (this.memoPlugin) {
      try {
        historicalContext = await this.memoPlugin.getReasoningAIContext(this.requirement, 'planning');
        if (historicalContext) {
          console.log(chalk.gray('📚 ToT: Using historical reasoning context'));
        }
      } catch (error) {
        // Silently ignore errors in fetching historical context
        console.debug(chalk.gray(`ToT: Failed to fetch historical context: ${error}`));
      }
    }

    const prompt = this.buildThoughtGenerationPrompt(parentThought.content, k, historicalContext);

    try {
      const response = await callAI(
        this.config,
        this.projectInfo,
        prompt,
        'think',
        [], // No execution history needed for thought generation
        undefined,
        undefined,
        undefined,
        process.cwd()
      );

      const thoughts = this.parseThoughtsResponse(response.content || '');
      const thoughtNodes: ThoughtNode[] = [];

      for (const thought of thoughts) {
        const node = createThoughtNode(
          thought,
          parentThought.id,
          parentThought.depth + 1
        );
        node.metadata = {
          timestamp: Date.now(),
          generationMethod: 'generate',
          evaluationMethod: undefined,
          evaluationReasoning: undefined,
        };

        // Phase 9: Record node in Memo
        if (this.memoPlugin && this.chainId) {
          const parentStepId = this.nodeToStepMap.get(parentThought.id);
          const stepId = await this.memoPlugin.addReasoningStep(
            'planning',
            `ToT Node (depth ${node.depth})`,
            thought,
            parentStepId,
            {
              algorithm: 'ToT',
              confidence: 0.5,
              metadata: { depth: node.depth, generationMethod: 'generate' }
            }
          );
          this.nodeToStepMap.set(node.id, stepId);
        }

        thoughtNodes.push(node);
      }

      return thoughtNodes;
    } catch (error) {
      console.error(`Error generating thoughts: ${error}`);
      return [];
    }
  }

  /**
   * Evaluate thoughts and assign scores
   * Corresponds to state_evaluator in Python demo (lines 80-97)
   *
   * PHASE 1 OPTIMIZATION: Incremental batch evaluation with context management
   */
  async evaluateThoughts(thoughts: ThoughtNode[]): Promise<Map<ThoughtNode, number>> {
    if (thoughts.length === 0) {
      return new Map();
    }

    const startTime = Date.now();
    const scoreMap = new Map<ThoughtNode, number>();

    // Phase 1: Use optimizations if enabled
    if (this.useOptimizations && this.contextManager && this.complexityLevel) {
      return await this.evaluateThoughtsOptimized(thoughts);
    }

    // Original implementation (backward compatible)
    const prompt = this.buildThoughtEvaluationPrompt(
      thoughts.map(t => t.content)
    );

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

      const scores = this.parseEvaluationResponse(response.content || '', thoughts);

      thoughts.forEach((thought, idx) => {
        const score = scores.get(idx) ?? 0.5;
        thought.score = score;
        thought.state = ThoughtState.EVALUATED;
        thought.metadata = {
          timestamp: thought.metadata?.timestamp || Date.now(),
          generationMethod: thought.metadata?.generationMethod,
          evaluationMethod: 'llm',
          evaluationReasoning: undefined,
        };
        scoreMap.set(thought, score);

        // Phase 9: Update node with evaluation score in Memo
        if (this.memoPlugin && this.chainId) {
          const stepId = this.nodeToStepMap.get(thought.id);
          if (stepId) {
            this.memoPlugin.updateReasoningStep(
              stepId,
              'completed',
              {
                success: true,
                output: `Evaluated with score: ${score}`,
                duration: Date.now() - startTime
              }
            );
          }
        }

        // Phase 1: Track evaluation
        if (this.tracker) {
          this.tracker.trackThoughtEvaluated(
            thought.id,
            score,
            'Evaluated via original method',
            'llm',
            Date.now() - startTime,
            undefined
          );
        }
      });

      return scoreMap;
    } catch (error) {
      console.error(`Error evaluating thoughts: ${error}`);
      // Default to middle score if evaluation fails
      thoughts.forEach(thought => {
        thought.score = 0.5;
        thought.state = ThoughtState.EVALUATED;
      });
      thoughts.forEach(t => scoreMap.set(t, 0.5));
      return scoreMap;
    }
  }

  /**
   * PHASE 1: Optimized thought evaluation with batching
   * Reduces prompt size by evaluating thoughts in batches
   */
  private async evaluateThoughtsOptimized(
    thoughts: ThoughtNode[]
  ): Promise<Map<ThoughtNode, number>> {
    const scoreMap = new Map<ThoughtNode, number>();
    const allThoughtsMap = new Map<string, ThoughtNode>();

    // Build map of all thoughts for context
    thoughts.forEach(t => allThoughtsMap.set(t.id, t));

    // Get batch size from context manager
    const batchSize = this.contextManager!.getRecommendedBatchSize(
      this.complexityLevel || ComplexityLevel.MEDIUM
    );

    // Evaluate in batches
    for (let i = 0; i < thoughts.length; i += batchSize) {
      const batch = thoughts.slice(i, Math.min(i + batchSize, thoughts.length));
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(thoughts.length / batchSize);

      const batchStartTime = Date.now();

      // Build optimized context for this batch
      const context = this.contextManager!.buildThoughtEvaluationContext(
        batch,
        allThoughtsMap,
        this.requirement,
        this.complexityLevel!
      );

      // Build prompt with optimized context
      const prompt = this.buildBatchEvaluationPrompt(
        context.context,
        batchNumber,
        totalBatches
      );

      try {
        // Track API call start
        const apiCallStart = Date.now();

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

        const apiCallDuration = Date.now() - apiCallStart;

        // Parse scores for this batch
        const scores = this.parseEvaluationResponse(response.content || '', batch);

        batch.forEach((thought, idx) => {
          const score = scores.get(idx) ?? 0.5;
          thought.score = score;
          thought.state = ThoughtState.EVALUATED;
          thought.metadata = {
            timestamp: thought.metadata?.timestamp || Date.now(),
            generationMethod: thought.metadata?.generationMethod,
            evaluationMethod: 'llm',
            evaluationReasoning: undefined,
          };
          scoreMap.set(thought, score);

          // Track evaluation
          if (this.tracker) {
            this.tracker.trackThoughtEvaluated(
              thought.id,
              score,
              `Batch ${batchNumber}/${totalBatches}`,
              'llm',
              Date.now() - batchStartTime,
              { batchSize, batchIndex: batchNumber - 1 }
            );

            // Track API call
            this.tracker.trackAPICall({
              timestamp: apiCallStart,
              endpoint: 'chat/completions',
              stage: 'planning',
              promptTokens: context.estimatedTokens,
              completionTokens: 500, // Estimate
              totalTokens: context.estimatedTokens + 500,
              latency: apiCallDuration,
              cached: false,
              metadata: {
                model: this.config.model || 'gpt-4o-mini',
                function: 'evaluateThoughts',
                thoughtId: thought.id,
              },
            });
          }
        });
      } catch (error) {
        console.error(`Error evaluating batch ${batchNumber}: ${error}`);
        // Default to middle score for this batch
        batch.forEach(thought => {
          thought.score = 0.5;
          thought.state = ThoughtState.EVALUATED;
          scoreMap.set(thought, 0.5);
        });
      }
    }

    return scoreMap;
  }

  /**
   * PHASE 1: Build prompt for batch evaluation
   */
  private buildBatchEvaluationPrompt(
    context: string,
    batchNumber: number,
    totalBatches: number
  ): string {
    return `You are evaluating batch ${batchNumber} of ${totalBatches} of alternative reasoning paths.

${context}

For each thought above, provide:
1. A score from 0.0 to 1.0 (higher is better)
2. Brief reasoning (1-2 sentences)

Format your response as:
Thought 1: 0.85
Reasoning: [Your reasoning]

Thought 2: 0.72
Reasoning: [Your reasoning]

... and so on.`;
  }

  /**
   * Search using BFS with beam width
   * Corresponds to _bfs_search in Python demo (lines 346-376)
   */
  async bfsSearch(tree: ThoughtTree): Promise<ThoughtNode | null> {
    const startTime = Date.now();
    let currentLevel = [tree.root];

    for (let depth = 0; depth < tree.maxDepth; depth++) {
      if (currentLevel.length === 0) {
        break;
      }

      // Generate children for all nodes at current level
      const nextLevel: ThoughtNode[] = [];

      for (const node of currentLevel) {
        if (node.state === ThoughtState.PRUNED) {
          continue;
        }

        const children = await this.generateThoughts(node, tree.branchingFactor);

        if (children.length > 0) {
          // Evaluate children
          await this.evaluateThoughts(children);

          // Add to tree
          for (const child of children) {
            addChildToNode(node, child);
            tree.nodes.set(child.id, child);
            nextLevel.push(child);
          }
        }
      }

      // Beam search: keep only top k thoughts
      if (nextLevel.length > tree.beamWidth) {
        nextLevel.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        const pruned = nextLevel.slice(tree.beamWidth);
        pruned.forEach(node => {
          node.state = ThoughtState.PRUNED;
          tree.metadata.prunedNodes++;
        });
        currentLevel = nextLevel.slice(0, tree.beamWidth);
      } else {
        currentLevel = nextLevel;
      }

      // Update metadata
      tree.metadata.totalNodes = tree.nodes.size;
      tree.metadata.evaluatedNodes = Array.from(tree.nodes.values()).filter(
        n => n.state === ThoughtState.EVALUATED
      ).length;

      const bestInLevel = Math.max(...currentLevel.map(n => n.score ?? 0));
      if (bestInLevel > tree.metadata.bestScore) {
        tree.metadata.bestScore = bestInLevel;
        const bestNode = currentLevel.find(n => n.score === bestInLevel);
        if (bestNode) {
          tree.currentLeaf = bestNode;
        }
      }
    }

    tree.metadata.searchTime = Date.now() - startTime;

    // Phase 9: Complete reasoning chain in Memo
    if (this.chainId && this.memoPlugin) {
      const bestPath = this.findBestPath(tree);
      await this.memoPlugin.completeReasoningChain(
        true,
        `BFS search completed. Best path: ${bestPath.map(n => n.content.substring(0, 50)).join(' → ')}`,
        undefined
      );
      console.log(`📝 ToT reasoning chain saved: ${this.chainId.substring(0, 8)}...`);
    }

    return tree.currentLeaf;
  }

  /**
   * Search using DFS with backtracking
   * Corresponds to _dfs_search in Python demo (lines 378-412)
   */
  async dfsSearch(tree: ThoughtTree): Promise<ThoughtNode | null> {
    const startTime = Date.now();
    let bestNode: ThoughtNode | null = null;
    let bestScore = 0;

    const searchDepth = async (node: ThoughtNode, depth: number): Promise<void> => {
      if (depth >= tree.maxDepth) {
        return;
      }

      // Generate children
      const children = await this.generateThoughts(node, tree.branchingFactor);

      if (children.length === 0) {
        return;
      }

      // Evaluate children
      await this.evaluateThoughts(children);

      // Sort by score and explore best first
      children.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

      // Add to tree
      for (const child of children) {
        addChildToNode(node, child);
        tree.nodes.set(child.id, child);
      }

      // Explore best child
      const bestChild = children[0];
      if (bestChild.score && bestChild.score > bestScore) {
        bestScore = bestChild.score;
        bestNode = bestChild;
        tree.currentLeaf = bestNode;
        tree.metadata.bestScore = bestScore;
      }

      // Recursively explore
      await searchDepth(bestChild, depth + 1);

      // Backtrack: try next best if this didn't lead to solution
      if (bestChild.state !== ThoughtState.SOLVED && children.length > 1) {
        for (let i = 1; i < Math.min(children.length, 3); i++) {
          const child = children[i];
          if (child.score && child.score > 0.7) {
            await searchDepth(child, depth + 1);
          }
        }
      }
    };

    await searchDepth(tree.root, 0);

    tree.metadata.totalNodes = tree.nodes.size;
    tree.metadata.evaluatedNodes = Array.from(tree.nodes.values()).filter(
      n => n.state === ThoughtState.EVALUATED
    ).length;
    tree.metadata.searchTime = Date.now() - startTime;

    // Phase 9: Complete reasoning chain in Memo
    if (this.chainId && this.memoPlugin) {
      const bestPath = this.findBestPath(tree);
      await this.memoPlugin.completeReasoningChain(
        true,
        `DFS search completed. Best path: ${bestPath.map(n => n.content.substring(0, 50)).join(' → ')}`,
        undefined
      );
      console.log(`📝 ToT reasoning chain saved: ${this.chainId.substring(0, 8)}...`);
    }

    return bestNode;
  }

  /**
   * Search using beam search (combination of BFS and best-first)
   */
  async beamSearch(tree: ThoughtTree): Promise<ThoughtNode | null> {
    // Beam search is similar to BFS but with global best tracking
    const startTime = Date.now();
    const candidates: ThoughtNode[] = [tree.root];
    let bestNode: ThoughtNode | null = null;
    let bestScore = 0;

    for (let depth = 0; depth < tree.maxDepth; depth++) {
      if (candidates.length === 0) {
        break;
      }

      const newCandidates: ThoughtNode[] = [];

      for (const node of candidates) {
        if (node.state === ThoughtState.PRUNED) {
          continue;
        }

        const children = await this.generateThoughts(node, tree.branchingFactor);

        if (children.length > 0) {
          await this.evaluateThoughts(children);

          for (const child of children) {
            addChildToNode(node, child);
            tree.nodes.set(child.id, child);

            if (child.score && child.score > bestScore) {
              bestScore = child.score;
              bestNode = child;
              tree.metadata.bestScore = bestScore;
              tree.currentLeaf = bestNode;
            }

            newCandidates.push(child);
          }
        }
      }

      // Keep only beamWidth best candidates
      newCandidates.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

      if (newCandidates.length > tree.beamWidth) {
        const pruned = newCandidates.slice(tree.beamWidth);
        pruned.forEach(node => {
          node.state = ThoughtState.PRUNED;
          tree.metadata.prunedNodes++;
        });
        candidates.splice(0, candidates.length, ...newCandidates.slice(0, tree.beamWidth));
      } else {
        candidates.splice(0, candidates.length, ...newCandidates);
      }

      tree.metadata.totalNodes = tree.nodes.size;
      tree.metadata.evaluatedNodes = Array.from(tree.nodes.values()).filter(
        n => n.state === ThoughtState.EVALUATED
      ).length;
    }

    tree.metadata.searchTime = Date.now() - startTime;
    return bestNode;
  }

  // ============================================================================
  // PROMPT BUILDING
  // ============================================================================

  private buildThoughtGenerationPrompt(
    parentThought: string,
    k: number,
    historicalContext: string = ''
  ): string {
    const basePrompt = `You are using Tree of Thoughts reasoning to explore multiple solution paths.

REQUIREMENT: ${this.requirement}

PARENT THOUGHT:
${parentThought}

Generate ${k} distinct, alternative thoughts for how to proceed from this point.
Each thought should:
- Explore a different approach or perspective
- Be specific and actionable
- Consider different trade-offs
- Be independent of the other thoughts

Format your response as a numbered list:
1. [First alternative thought]
2. [Second alternative thought]
3. [Third alternative thought]
4. [Fourth alternative thought]
5. [Fifth alternative thought]`;

    // Phase 9.1: Append historical reasoning context if available
    if (historicalContext && historicalContext.trim().length > 0) {
      return `${basePrompt}

─────────────────────────────────────────────────────────────
📚 HISTORICAL PLANNING CONTEXT
─────────────────────────────────────────────────────────────
${historicalContext}

💡 Learn from past planning attempts - what worked, what didn't,
   and why. Adapt successful patterns to the current context.
─────────────────────────────────────────────────────────────`;
    }

    return basePrompt;
  }

  private buildThoughtEvaluationPrompt(thoughts: string[]): string {
    return `You are evaluating the quality of alternative reasoning paths.

REQUIREMENT: ${this.requirement}

ALTERNATIVE THOUGHTS:
${thoughts.map((t, i) => `${i + 1}. ${t}`).join('\n\n')}

Evaluate each thought on:
1. Clarity: Is the reasoning clear and well-structured?
2. Feasibility: Can this approach be implemented successfully?
3. Efficiency: Is this an efficient use of resources?
4. Risk: What are the potential risks or downsides?
5. Completeness: Does this move us closer to satisfying the requirement?

For each thought, provide:
- A score from 0.0 to 1.0 (higher is better)
- A brief explanation

Format exactly like this:
Thought 1: 0.85
Reasoning: Clear approach with good feasibility.

Thought 2: 0.62
Reasoning: Somewhat complex but viable.

Thought 3: 0.91
Reasoning: Excellent, efficient approach.

...and so on for all ${thoughts.length} thoughts.`;
  }

  // ============================================================================
  // RESPONSE PARSING
  // ============================================================================

  private parseThoughtsResponse(response: string): string[] {
    const thoughts: string[] = [];
    const lines = response.split('\n');

    for (const line of lines) {
      const match = line.match(/^\d+\.\s+(.+)$/);
      if (match) {
        thoughts.push(match[1].trim());
      }
    }

    // If no numbered list found, try paragraph split
    if (thoughts.length === 0) {
      const paragraphs = response.split('\n\n').filter(p => p.trim());
      return paragraphs.slice(0, 5).map(p => p.trim());
    }

    return thoughts;
  }

  private parseEvaluationResponse(response: string, thoughts: ThoughtNode[]): Map<number, number> {
    const scores = new Map<number, number>();

    for (let i = 0; i < thoughts.length; i++) {
      const pattern = new RegExp(`Thought\\s+${i + 1}:\\s*(\\d+\\.?\\d*)`, 'i');
      const match = response.match(pattern);
      if (match) {
        const score = parseFloat(match[1]);
        scores.set(i, Math.min(1.0, Math.max(0.0, score))); // Clamp to [0, 1]
      } else {
        // Default score if not found
        scores.set(i, 0.5);
      }
    }

    return scores;
  }

  /**
   * Phase 9: Find best path from root to leaf in the thought tree
   * Used for summarizing the reasoning chain
   */
  private findBestPath(tree: ThoughtTree): ThoughtNode[] {
    const path: ThoughtNode[] = [];
    let current = tree.currentLeaf || tree.root;

    // Traverse up from leaf to root
    while (current) {
      path.unshift(current);
      const parentId = current.parentId;
      if (!parentId) break;
      current = tree.nodes.get(parentId) || tree.root;
    }

    return path;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Run Tree of Thoughts search with specified strategy
 */
export async function runToTSearch(
  config: Config,
  projectInfo: any,
  requirement: string,
  initialThought: string,
  strategy: 'bfs' | 'dfs' | 'beam' = 'bfs',
  maxDepth: number = 6,         // Increased from 4 for GLM-5's 200k context
  beamWidth: number = 5,        // Increased from 3 for broader exploration
  branchingFactor: number = 7,  // Increased from 5 for more alternatives
  // Phase 9: Memo plugin
  memoPlugin?: MemoCliPlugin
): Promise<{
  tree: ThoughtTree;
  bestNode: ThoughtNode | null;
}> {
  const engine = new TreeOfThoughtsEngine(
    config,
    projectInfo,
    requirement,
    { memoPlugin }
  );
  const tree = await engine.initializeTree(
    initialThought,
    strategy,
    maxDepth,
    beamWidth,
    branchingFactor
  );

  let bestNode: ThoughtNode | null;

  switch (strategy) {
    case 'bfs':
      bestNode = await engine.bfsSearch(tree);
      break;
    case 'dfs':
      bestNode = await engine.dfsSearch(tree);
      break;
    case 'beam':
      bestNode = await engine.beamSearch(tree);
      break;
    default:
      throw new Error(`Unknown search strategy: ${strategy}`);
  }

  // Mark best path
  if (bestNode) {
    let current = bestNode;
    while (current && current.parentId) {
      current.state = ThoughtState.SELECTED;
      const parent = tree.nodes.get(current.parentId);
      if (parent) {
        current = parent;
      } else {
        break;
      }
    }
    tree.root.state = ThoughtState.SELECTED;
    tree.metadata.solutionPath = getSolutionPath(tree, bestNode);
  }

  return { tree, bestNode };
}

/**
 * Get path from root to solution node
 */
export function getSolutionPath(tree: ThoughtTree, leaf: ThoughtNode): ThoughtNode[] {
  const path: ThoughtNode[] = [];
  let current: ThoughtNode | null = leaf;

  while (current) {
    path.unshift(current);
    current = current.parentId ? tree.nodes.get(current.parentId) as ThoughtNode : null;
  }

  return path;
}
