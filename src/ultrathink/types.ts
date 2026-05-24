/**
 * Ultrathink Type Definitions
 *
 * Implements Tree of Thoughts (ToT) and ReAct (Reasoning + Acting) patterns
 * based on research papers:
 * - Tree of Thoughts: https://arxiv.org/abs/2210.03629
 * - ReAct: https://arxiv.org/abs/2305.10601
 */

import { Action } from '../types';

// ============================================================================
// TREE OF THOUGHTS TYPES
// ============================================================================

/**
 * A single thought node in the reasoning tree
 */
export interface ThoughtNode {
  id: string;
  content: string; // The thought/reasoning
  parentId: string | null; // Parent thought ID (null for root)
  children: ThoughtNode[]; // Child thoughts
  depth: number; // Depth in the tree
  score?: number; // Evaluation score (0-1)
  state: ThoughtState; // Current state of this thought
  metadata?: ThoughtMetadata; // Additional information
}

/**
 * State of a thought in the reasoning process
 */
export enum ThoughtState {
  PENDING = 'pending', // Thought created but not evaluated
  EVALUATING = 'evaluating', // Currently being evaluated
  EVALUATED = 'evaluated', // Evaluation complete
  SELECTED = 'selected', // Selected for further exploration
  EXPANDED = 'expanded', // Children have been generated
  PRUNED = 'pruned', // Discarded during search
  SOLVED = 'solved', // Thought leads to solution
  FAILED = 'failed', // Thought leads to dead end
}

/**
 * Metadata associated with a thought
 */
export interface ThoughtMetadata {
  timestamp: number; // When thought was created
  evaluationMethod?: 'heuristic' | 'llm' | 'value-function';
  evaluationReasoning?: string; // Why this score was assigned
  generationMethod?: 'sample' | 'generate' | 'propose';
  estimatedCost?: number; // Estimated time/tokens to execute
  riskLevel?: 'low' | 'medium' | 'high'; // Risk assessment
}

/**
 * A tree of thoughts representing alternative reasoning paths
 */
export interface ThoughtTree {
  root: ThoughtNode; // Root thought
  nodes: Map<string, ThoughtNode>; // All nodes for fast lookup
  currentLeaf: ThoughtNode | null; // Current exploration point
  maxDepth: number; // Maximum depth allowed
  beamWidth: number; // Number of thoughts to keep at each level (BFS)
  branchingFactor: number; // Number of children to generate per node
  searchStrategy: 'bfs' | 'dfs' | 'beam'; // Search algorithm
  metadata: TreeMetadata;
}

/**
 * Metadata for the entire thought tree
 */
export interface TreeMetadata {
  requirement: string; // Original user requirement
  createdAt: number; // Tree creation timestamp
  totalNodes: number; // Total number of nodes
  evaluatedNodes: number; // Number of evaluated nodes
  prunedNodes: number; // Number of pruned nodes
  searchTime: number; // Time taken for search (ms)
  bestScore: number; // Best score found
  solutionPath?: ThoughtNode[]; // Path to solution (if found)
}

// ============================================================================
// PLAN TYPES (ToT for Planning)
// ============================================================================

/**
 * An action plan derived from thought tree exploration
 */
export interface ActionPlan {
  id: string;
  thoughtNodeId: string; // Associated thought node
  actions: Action[]; // Sequence of actions
  reasoning: string; // Explanation of why this plan
  estimatedTime: number; // Estimated execution time (ms)
  confidence: number; // Confidence score (0-1)
  riskLevel: 'low' | 'medium' | 'high';
  dependencies?: string[]; // Other plan IDs this depends on
  alternativePlans?: string[]; // IDs of alternative plans
  metadata: PlanMetadata;
}

/**
 * Metadata for an action plan
 */
export interface PlanMetadata {
  generationMethod: 'tot-bfs' | 'tot-dfs' | 'standard' | 'fallback';
  searchDepth: number; // Depth of thought tree exploration
  nodesExplored: number; // Number of thoughts evaluated
  evaluationCriteria: string[]; // How plan was evaluated
  rejectionReasons?: string[]; // Why alternative plans were rejected
  thoughtTree?: ThoughtTree; // Associated thought tree (for ToT-generated plans)
}

/**
 * Multiple alternative plans for comparison
 */
export interface PlanAlternatives {
  selected: ActionPlan; // The chosen plan
  rejected: ActionPlan[]; // Alternative plans that were considered
  selectionReason: string; // Why selected plan was chosen
  comparison: PlanComparison; // Detailed comparison
}

/**
 * Comparison metrics between plans
 */
export interface PlanComparison {
  criteria: {
    time: number; // Faster is better
    confidence: number; // Higher is better
    risk: number; // Lower is better (1=low, 3=high)
    complexity: number; // Number of actions
  }[];
  reasoning: string; // Explanation of comparison
}

// ============================================================================
// REACT TYPES (Reasoning + Acting)
// ============================================================================

/**
 * A single step in the ReAct loop
 */
export interface ReActStep {
  stepNumber: number;
  thought: string; // Reasoning about current state
  action: Action | null; // Action to take (can be null for think-only steps)
  observation: string; // Result of executing action
  timestamp: number; // When this step was executed
  executionTime?: number; // Time taken for action (ms)
  success: boolean; // Whether step succeeded
}

/**
 * Complete ReAct trace
 */
export interface ReActTrace {
  requirement: string; // Original requirement
  steps: ReActStep[]; // Sequence of think-act-observe steps
  finalState: string; // Final observation/state
  success: boolean; // Whether requirement was satisfied
  totalSteps: number; // Number of steps taken
  totalTime: number; // Total time taken (ms)
  reasoning: string; // Overall reasoning summary
  metadata: ReActMetadata;
}

/**
 * Metadata for ReAct execution
 */
export interface ReActMetadata {
  startedAt: number; // Start timestamp
  completedAt: number; // Completion timestamp
  maxSteps: number; // Maximum steps allowed
  terminationReason: 'satisfied' | 'max-steps' | 'error' | 'aborted';
  selfCorrections: number; // Number of times ReAct corrected itself
  fallbackPlans: number; // Number of alternative strategies tried
}

/**
 * State during ReAct execution
 */
export interface ReActState {
  requirement: string;
  observation: string; // Current observation
  stepNumber: number; // Current step
  thoughtHistory: string[]; // Previous thoughts
  actionHistory: Action[]; // Previous actions
  context: Record<string, any>; // Additional context
}

// ============================================================================
// PATTERN LEARNING TYPES
// ============================================================================

/**
 * A learned pattern from successful executions
 */
export interface ThoughtPattern {
  id: string;
  name: string;
  category: PatternCategory;
  trigger: string[]; // Keywords/context that trigger this pattern
  thoughtTemplate: string; // Template for generating thoughts
  successRate: number; // Historical success rate (0-1)
  usageCount: number; // Number of times used
  lastUsed: number; // Last usage timestamp
  example: string; // Example of when this pattern applies
}

/**
 * Categories of thought patterns
 */
export enum PatternCategory {
  TASK_DECOMPOSITION = 'task-decomposition',
  FRONTEND_COMPONENT = 'frontend-component',
  API_ROUTE = 'api-route',
  DATABASE_OPERATION = 'database-operation',
  TESTING = 'testing',
  DEBUGGING = 'debugging',
  REFACTORING = 'refactoring',
  ERROR_RECOVERY = 'error-recovery',
}

/**
 * Library of patterns
 */
export interface PatternLibrary {
  patterns: Map<string, ThoughtPattern>;
  globalPatterns: ThoughtPattern[]; // Patterns applicable to all projects
  projectPatterns: ThoughtPattern[]; // Project-specific patterns
  lastUpdated: number;
}

/**
 * Extracted pattern from execution trace
 */
export interface PatternExtraction {
  thoughts: string[]; // Thought sequence
  actions: Action[]; // Action sequence
  success: boolean; // Whether this led to success
  category?: PatternCategory; // Detected category
  confidence: number; // Confidence this is a reusable pattern
}

// ============================================================================
// AGENT COORDINATION TYPES
// ============================================================================

/**
 * Multi-agent thought tree for task decomposition
 */
export interface AgentThoughtTree {
  root: AgentTaskNode;
  decompositions: TaskDecomposition[]; // Alternative decompositions
  selectedDecomposition: number; // Index of selected decomposition
  evaluationScores: number[]; // Scores for each decomposition
  reasoning: string; // Why this decomposition was chosen
}

/**
 * A task node in multi-agent coordination
 */
export interface AgentTaskNode {
  id: string;
  description: string;
  agentType?: 'frontend' | 'backend' | 'testing' | 'general';
  dependencies: string[]; // IDs of tasks this depends on
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  thought: string; // Reasoning for this task
  subtasks: AgentTaskNode[]; // Nested tasks
}

/**
 * Alternative task decomposition strategies
 */
export interface TaskDecomposition {
  id: string;
  tasks: AgentTaskNode[]; // Task graph
  reasoning: string; // Why decompose this way
  estimatedTime: number; // Estimated completion time
  parallelism: number; // Number of parallel tasks
  riskScore: number; // Risk assessment (0-1)
}

// ============================================================================
// ULTRATHINK CONFIGURATION
// ============================================================================

/**
 * Configuration for ultrathink features
 */
export interface UltrathinkConfig {
  enabled: boolean; // Master switch
  planMode: {
    enabled: boolean;
    numAlternatives: number; // Number of alternative plans (k)
    searchStrategy: 'bfs' | 'dfs' | 'beam';
    beamWidth: number;
    maxDepth: number;
    showRejected: boolean; // Show rejected plans in output
  };
  verifyMode: {
    enabled: boolean;
    maxIterations: number; // Max ReAct steps
    showReasoning: boolean; // Show thought process
  };
  multiAgent: {
    enabled: boolean;
    numDecompositions: number; // Alternative decompositions
    dynamicReassignment: boolean; // Reassign tasks if agents struggle
  };
  learning: {
    enabled: boolean;
    patternStorage: string; // Path to pattern library file
    minConfidence: number; // Minimum confidence to save pattern
    maxPatterns: number; // Maximum patterns to store
  };
}

/**
 * Default ultrathink configuration
 */
export const DEFAULT_ULTRATHINK_CONFIG: UltrathinkConfig = {
  enabled: false,
  planMode: {
    enabled: true,
    numAlternatives: 5,
    searchStrategy: 'bfs',
    beamWidth: 3,
    maxDepth: 4,
    showRejected: false,
  },
  verifyMode: {
    enabled: true,
    maxIterations: 5,
    showReasoning: true,
  },
  multiAgent: {
    enabled: true,
    numDecompositions: 3,
    dynamicReassignment: true,
  },
  learning: {
    enabled: true,
    patternStorage: '.ultrathink-patterns.json',
    minConfidence: 0.7,
    maxPatterns: 100,
  },
};
