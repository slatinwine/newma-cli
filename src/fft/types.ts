/**
 * FFT (Fast and Frugal Tree) Type Definitions
 *
 * FFT is a simple decision tree that makes fast decisions with minimal information.
 * Each node has a binary cue (test) and two exits (exitIfTrue, exitIfFalse).
 */

/**
 * Chat input context
 */
export interface ChatInput {
  message: string;
  userProfile?: string;
  timestamp?: Date;
}

/**
 * FFT Action - what to do when a decision is made
 */
export type FFTAction =
  | {
      type: 'search';
      tool: 'search' | 'search_and_fetch' | 'web_scrape';
      prompt?: string;
      maxResults?: number;
    }
  | {
      type: 'answer';
      prompt?: string;
    }
  | {
      type: 'clarify';
      question: string;
    }
  | {
      type: 'fallback';  // Fallback to standard AI decision
      reason: string;
    };

/**
 * FFT Node - a decision point in the tree
 */
export interface FFTNode {
  id: string;
  cue: string;  // Human-readable description of this cue
  test: (input: ChatInput) => boolean | Promise<boolean>;  // Binary test function
  exitIfTrue: FFTAction | FFTNode;  // If test is true
  exitIfFalse: FFTAction | FFTNode;  // If test is false
}

/**
 * FFT Execution Result
 */
export interface FFTResult {
  action: FFTAction;
  path: string[];  // Array of node IDs visited
  depth: number;  // How many nodes were evaluated
}

/**
 * FFT Configuration
 */
export interface FFTConfig {
  maxDepth?: number;  // Maximum depth to evaluate (default: 3)
  enableFallback?: boolean;  // Allow fallback to standard mode (default: true)
  verbose?: boolean;  // Show decision path (default: false)
}

/**
 * Helper to check if an action is a terminal node (not another node)
 */
export function isTerminalAction(value: FFTAction | FFTNode): value is FFTAction {
  return 'type' in value;
}

/**
 * Helper to format decision path for display
 */
export function formatDecisionPath(result: FFTResult): string {
  const steps = result.path.map((nodeId, idx) => {
    return `${idx + 1}. ${nodeId}`;
  });
  return steps.join(' → ');
}

// ============================================================================
// FFT PLANNING TYPES (Phase 7.1 - FFT for /plan command)
// ============================================================================

/**
 * Action type for FFT planning
 */
export interface PlanAction {
  type: 'create' | 'modify' | 'run' | 'verify';
  path?: string;
  content?: string;
  oldContent?: string;
  newContent?: string;
  command?: string;
}

/**
 * Input for FFT planning
 */
export interface FFTPlanInput {
  requirement: string;
  projectInfo: Record<string, string>;
  userProfile?: string;
}

/**
 * Single plan option for complex tasks
 */
export interface FFTPlanOption {
  id: string;
  name: string;               // e.g., "保守方案 (MVP)", "激进方案 (完整重构)"
  description: string;        // Detailed description of the approach
  strategy: 'conservative' | 'aggressive' | 'balanced';
  actions: PlanAction[];      // Specific actions to execute
  estimatedTime: number;      // Estimated execution time (ms)
  riskLevel: 'low' | 'medium' | 'high';
  pros: string[];             // Advantages
  cons: string[];             // Disadvantages
  confidence: number;         // 0.0 - 1.0
}

/**
 * FFT planning result
 */
export interface FFTPlanResult {
  complexity: 'simple' | 'complex';
  reasoning?: string;         // Why is it simple/complex?
  plan?: FFTPlanOption;       // For simple tasks: single plan
  options?: FFTPlanOption[];  // For complex tasks: multiple options
  analysisTime: number;       // Time taken for analysis (ms)
}

/**
 * Complexity analysis result
 */
export interface ComplexityAnalysis {
  level: 'simple' | 'complex';
  reasoning: string;
  indicators: {
    keywordMatches: string[];
    techStackCount: number;
    estimatedSteps: number;
  };
  confidence: number;         // 0.0 - 1.0
}

/**
 * User answers to clarifying questions for complex tasks
 */
export interface ClarifyingAnswers {
  experience: 'beginner' | 'intermediate' | 'expert';
  projectScale: 'personal' | 'small-team' | 'enterprise';
  timeConstraint: 'urgent' | 'normal' | 'flexible';
  priority: 'speed' | 'quality' | 'balance';
}
