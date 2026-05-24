/**
 * Ultrathink Utility Functions
 *
 * Helper functions for Tree of Thoughts and ReAct implementations
 */

import { ThoughtNode, ThoughtTree, ActionPlan, ReActStep, ThoughtPattern } from './types';
import chalk from 'chalk';

// ============================================================================
// PROMPT BUILDING FUNCTIONS
// ============================================================================

/**
 * Build system prompt for Tree of Thoughts reasoning
 */
export function buildToTPrompt(
  requirement: string,
  context: string,
  currentThought?: string
): string {
  const basePrompt = `You are an expert software architect using Tree of Thoughts reasoning.
Your task is to break down requirements into thoughtful, step-by-step reasoning chains.

REQUIREMENT: ${requirement}

CONTEXT:
${context}

`;
  if (currentThought) {
    return basePrompt + `CURRENT THOUGHT:
${currentThought}

Based on the current thought above, generate the next reasoning step.
Think about:
1. What is the immediate next step?
2. What alternatives should be considered?
3. What are the potential risks?
4. What dependencies exist?

Provide your next thought as a clear, concise explanation of your reasoning.`;
  }

  return basePrompt + `Generate an initial high-level approach for satisfying this requirement.
Think about:
1. What is the core problem being solved?
2. What are the main components or steps needed?
3. What is a good starting point?
4. What should be considered first?

Provide your initial thought as a clear, strategic overview of your approach.`;
}

/**
 * Build prompt for thought generation
 */
export function buildThoughtGenerationPrompt(
  parentThought: string,
  requirement: string,
  numThoughts: number
): string {
  return `You are using Tree of Thoughts reasoning to explore multiple solution paths.

REQUIREMENT: ${requirement}

PARENT THOUGHT:
${parentThought}

Generate ${numThoughts} distinct, alternative thoughts for how to proceed from this point.
Each thought should:
- Explore a different approach or perspective
- Be specific and actionable
- Consider different trade-offs
- Be independent of the other thoughts

Format your response as a numbered list:
1. [First alternative thought]
2. [Second alternative thought]
...`;
}

/**
 * Build prompt for thought evaluation
 */
export function buildThoughtEvaluationPrompt(
  thoughts: string[],
  requirement: string
): string {
  return `You are evaluating the quality of alternative reasoning paths.

REQUIREMENT: ${requirement}

ALTERNATIVE THOUGHTS:
${thoughts.map((t, i) => `${i + 1}. ${t}`).join('\n\n')}

Evaluate each thought on:
1. Clarity: Is the reasoning clear and well-structured?
2. Feasibility: Can this approach be implemented successfully?
3. Efficiency: Is this an efficient use of resources?
4. Risk: What are the potential risks or downsides?
5. Completeness: Does this move us closer to satisfying the requirement?

For each thought, provide:
- A score from 0.0 to 1.0
- A brief explanation of your reasoning

Format:
Thought 1: [score]
Reasoning: [explanation]

Thought 2: [score]
Reasoning: [explanation]

...`;
}

/**
 * Build prompt for action plan generation from thought
 */
export function buildPlanGenerationPrompt(
  thought: string,
  requirement: string
): string {
  return `Convert a reasoning thought into a concrete action plan.

REQUIREMENT: ${requirement}

REASONING/THOUGHT:
${thought}

Based on this reasoning, generate a detailed action plan with specific steps.
Each action should be one of:
- create_file(path, content)
- modify_file(path, old_content, new_content)
- execute_command(command)

Format your response as a numbered list of actions:
1. [action description]
   Type: create_file/modify_file/execute_command
   Details: [specific parameters]

2. [next action]
   ...`;
}

/**
 * Build ReAct system prompt
 */
export function buildReActPrompt(
  requirement: string,
  observation: string,
  stepNumber: number,
  maxSteps: number
): string {
  return `You are using ReAct (Reasoning + Acting) to satisfy a requirement.

REQUIREMENT: ${requirement}

CURRENT OBSERVATION:
${observation}

STEP ${stepNumber} of ${maxSteps}

Think carefully about:
1. What is the current state?
2. What has worked so far? What hasn't?
3. What should be done next?
4. Are we closer to satisfying the requirement?

Provide your reasoning (thought), then decide on an action if needed.

IMPORTANT: If the requirement appears to be satisfied based on the observation,
clearly state "Requirement satisfied" and explain why.`;
}

// ============================================================================
// THOUGHT TREE VISUALIZATION
// ============================================================================

/**
 * Format thought tree as ASCII tree for display
 */
export function formatThoughtTree(tree: ThoughtTree, rootOnly = false): string {
  const lines: string[] = [];

  lines.push(chalk.bold.cyan('\n🌳 Tree of Thoughts'));
  lines.push(chalk.gray('─'.repeat(60)));

  const formatNode = (node: ThoughtNode, prefix: string, isLast: boolean): void => {
    const connector = isLast ? '└── ' : '├── ';
    const scoreText = node.score !== undefined ? chalk.yellow(` (score: ${node.score.toFixed(2)})`) : '';
    const stateIcon = getStateIcon(node.state);
    const depthColor = getDepthColor(node.depth);

    lines.push(`${prefix}${connector}${stateIcon} ${depthColor(node.content.substring(0, 60))}${scoreText}`);

    if (!rootOnly && node.children.length > 0) {
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      node.children.forEach((child, idx) => {
        formatNode(child, newPrefix, idx === node.children.length - 1);
      });
    }
  };

  formatNode(tree.root, '', true);

  if (!rootOnly) {
    lines.push(chalk.gray('─'.repeat(60)));
    lines.push(chalk.gray(`Total nodes: ${tree.metadata.totalNodes} | Evaluated: ${tree.metadata.evaluatedNodes} | Best score: ${tree.metadata.bestScore.toFixed(2)}`));
  }

  return lines.join('\n');
}

/**
 * Get icon for thought state
 */
function getStateIcon(state: string): string {
  const icons: Record<string, string> = {
    pending: '⏳',
    evaluating: '🔍',
    evaluated: '✓',
    selected: '⭐',
    expanded: '🌿',
    pruned: '✂️',
    solved: '✅',
    failed: '❌',
  };
  return icons[state] || '•';
}

/**
 * Get color function based on depth
 */
function getDepthColor(depth: number): (str: string) => string {
  const colors = [
    chalk.bold.white,
    chalk.green,
    chalk.blue,
    chalk.magenta,
    chalk.cyan,
  ];
  return colors[depth % colors.length];
}

/**
 * Format plan alternatives for display
 */
export function formatPlanAlternatives(
  selected: ActionPlan,
  rejected: ActionPlan[],
  showReasoning: boolean
): string {
  const lines: string[] = [];

  lines.push(chalk.bold.cyan('\n📋 Plan Alternatives Generated'));
  lines.push(chalk.gray('─'.repeat(60)));

  // Show selected plan
  lines.push(chalk.bold.green('\n✅ SELECTED PLAN:'));
  lines.push(formatSinglePlan(selected, showReasoning));

  // Show rejected plans if requested
  if (rejected.length > 0) {
    lines.push(chalk.bold.red('\n❌ REJECTED PLANS:'));
    rejected.forEach((plan, idx) => {
      lines.push(chalk.red(`\nAlternative ${idx + 1}:`));
      lines.push(formatSinglePlan(plan, showReasoning));
    });
  }

  return lines.join('\n');
}

/**
 * Format a single action plan
 */
function formatSinglePlan(plan: ActionPlan, showDetails: boolean): string {
  const lines: string[] = [];

  lines.push(chalk.gray(`  Confidence: ${plan.confidence.toFixed(2)} | Risk: ${plan.riskLevel} | Est. time: ${plan.estimatedTime}ms`));

  if (showDetails && plan.reasoning) {
    lines.push(chalk.gray(`  Reasoning: ${plan.reasoning.substring(0, 150)}...`));
  }

  lines.push(chalk.gray(`  Actions (${plan.actions.length}):`));
  plan.actions.forEach((action, idx) => {
    lines.push(chalk.gray(`    ${idx + 1}. ${action.type}: ${action.path || action.command}`));
  });

  return lines.join('\n');
}

/**
 * Format ReAct trace for display
 */
export function formatReActTrace(trace: ReActStep[], showThoughts: boolean): string {
  const lines: string[] = [];

  lines.push(chalk.bold.cyan('\n🔄 ReAct Execution Trace'));
  lines.push(chalk.gray('─'.repeat(60)));

  trace.forEach((step, idx) => {
    lines.push(chalk.bold(`\nStep ${step.stepNumber}:`));

    if (showThoughts || step.stepNumber === trace.length) {
      lines.push(chalk.blue(`  💭 Thought: ${step.thought.substring(0, 200)}`));
    }

    if (step.action) {
      lines.push(chalk.yellow(`  ⚡ Action: ${step.action.type} ${step.action.path || step.action.command}`));
    }

    lines.push(chalk.gray(`  👁️  Observation: ${step.observation.substring(0, 200)}`));

    if (step.executionTime) {
      lines.push(chalk.gray(`  ⏱️  Time: ${step.executionTime}ms`));
    }

    if (!step.success) {
      lines.push(chalk.red(`  ❌ Failed`));
    }
  });

  return lines.join('\n');
}

// ============================================================================
// TREE MANIPULATION FUNCTIONS
// ============================================================================

/**
 * Create a new thought node
 */
export function createThoughtNode(
  content: string,
  parentId: string | null,
  depth: number
): ThoughtNode {
  return {
    id: generateId(),
    content,
    parentId,
    children: [],
    depth,
    state: 'pending' as any,
    metadata: {
      timestamp: Date.now(),
    },
  };
}

/**
 * Add child to parent node
 */
export function addChildToNode(parent: ThoughtNode, child: ThoughtNode): void {
  parent.children.push(child);
  child.parentId = parent.id;
  parent.state = 'expanded' as any;
}

/**
 * Find node by ID in tree
 */
export function findNodeById(tree: ThoughtTree, nodeId: string): ThoughtNode | undefined {
  return tree.nodes.get(nodeId);
}

/**
 * Get path from root to node
 */
export function getPathToNode(node: ThoughtNode, tree: ThoughtTree): ThoughtNode[] {
  const path: ThoughtNode[] = [];
  let current: ThoughtNode | null = node;

  while (current) {
    path.unshift(current);
    current = current.parentId ? findNodeById(tree, current.parentId) as ThoughtNode : null;
  }

  return path;
}

/**
 * Count total nodes in tree
 */
export function countNodes(root: ThoughtNode): number {
  let count = 1;
  for (const child of root.children) {
    count += countNodes(child);
  }
  return count;
}

/**
 * Get all leaf nodes (nodes with no children)
 */
export function getLeafNodes(root: ThoughtNode): ThoughtNode[] {
  if (root.children.length === 0) {
    return [root];
  }

  const leaves: ThoughtNode[] = [];
  for (const child of root.children) {
    leaves.push(...getLeafNodes(child));
  }
  return leaves;
}

/**
 * Filter nodes by state
 */
export function filterNodesByState(root: ThoughtNode, state: string): ThoughtNode[] {
  const matching: ThoughtNode[] = [];

  if (root.state === state) {
    matching.push(root);
  }

  for (const child of root.children) {
    matching.push(...filterNodesByState(child, state));
  }

  return matching;
}

// ============================================================================
// REACT UTILITY FUNCTIONS
// ============================================================================

/**
 * Format observation for ReAct
 */
export function formatObservation(
  actionResult: any,
  success: boolean,
  errorMessage?: string
): string {
  if (!success) {
    return `Action failed: ${errorMessage || 'Unknown error'}`;
  }

  if (actionResult.output) {
    return actionResult.output;
  }

  if (actionResult.changes && actionResult.changes.length > 0) {
    return `Successfully completed ${actionResult.changes.length} actions:\n${
      actionResult.changes.map((c: any) => `  - ${c.type}: ${c.path}`).join('\n')
    }`;
  }

  return 'Action completed successfully';
}

/**
 * Extract reasoning from LLM response
 */
export function extractReasoning(response: string): string {
  // Look for reasoning markers
  const reasoningMarkers = [
    'Reasoning:',
    'Thought:',
    'Thinking:',
    'Analysis:',
  ];

  for (const marker of reasoningMarkers) {
    const idx = response.indexOf(marker);
    if (idx !== -1) {
      const afterMarker = response.substring(idx + marker.length).trim();
      const lines = afterMarker.split('\n');
      return lines[0].trim();
    }
  }

  // If no marker found, return first non-empty line
  const lines = response.split('\n').filter(l => l.trim());
  return lines[0] || response;
}

/**
 * Extract thoughts from numbered list
 */
export function extractThoughtsFromList(response: string): string[] {
  const thoughts: string[] = [];
  const lines = response.split('\n');

  for (const line of lines) {
    const match = line.match(/^\d+\.\s+(.+)$/);
    if (match) {
      thoughts.push(match[1].trim());
    }
  }

  return thoughts;
}

/**
 * Extract score and reasoning from evaluation response
 */
export function extractScoreAndReasoning(response: string, thoughtIndex: number): {
  score: number;
  reasoning: string;
} | null {
  // Look for "Thought N: [score]" pattern
  const pattern = new RegExp(`Thought\\s+${thoughtIndex + 1}:\\s*(\\d+\\.?\\d*)`);
  const match = response.match(pattern);

  if (match) {
    const score = parseFloat(match[1]);
    const reasoningPattern = new RegExp(`Thought\\s+${thoughtIndex + 1}:.*?Reasoning:\\s*(.+?)(?=Thought\\s+\\d+:|$)`, 's');
    const reasoningMatch = response.match(reasoningPattern);
    const reasoning = reasoningMatch ? reasoningMatch[1].trim() : '';

    return { score, reasoning };
  }

  return null;
}

// ============================================================================
// PATTERN UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract potential pattern from execution trace
 */
export function extractPatternFromTrace(
  thoughts: string[],
  actions: any[],
  success: boolean
): Partial<ThoughtPattern> | null {
  if (!success || thoughts.length < 2) {
    return null;
  }

  // Simple pattern extraction (can be enhanced with ML)
  const triggerKeywords = extractKeywords(thoughts[0]);
  const thoughtTemplate = generalizeThoughts(thoughts);

  return {
    name: `Pattern-${Date.now()}`,
    trigger: triggerKeywords,
    thoughtTemplate,
    successRate: 1.0,
    usageCount: 1,
    lastUsed: Date.now(),
  };
}

/**
 * Extract key trigger words from thought
 */
function extractKeywords(thought: string): string[] {
  const words = thought
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 4); // Only meaningful words

  // Remove common words
  const stopWords = ['this', 'that', 'with', 'from', 'have', 'will', 'should'];
  return words.filter(w => !stopWords.includes(w)).slice(0, 5);
}

/**
 * Generalize thoughts into template
 */
function generalizeThoughts(thoughts: string[]): string {
  // Simple generalization by replacing specific values with placeholders
  return thoughts
    .join('\n-> ')
    .replace(/["'].*?["']/g, '[value]')
    .replace(/\b\d+\b/g, '[number]')
    .replace(/\/[^\s]+/g, '[path]');
}

// ============================================================================
// GENERAL UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Format milliseconds as human-readable time
 */
export function formatTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${(ms / 60000).toFixed(1)}m`;
}
