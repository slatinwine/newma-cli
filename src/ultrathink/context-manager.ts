/**
 * Adaptive Context Manager
 *
 * Dynamically adjusts context size based on task complexity.
 *
 * Strategy:
 * - Simple tasks: Minimal context (current node only)
 * - Medium tasks: Current node + parent
 * - Complex tasks: Current node + recent N steps
 * - Adapts batch sizes for efficiency
 */

import { ThoughtNode } from './types';
import { ProjectSummary } from './cache';

// ============================================================================
// COMPLEXITY LEVELS
// ============================================================================

/**
 * Task complexity levels
 */
export enum ComplexityLevel {
  SIMPLE = 'simple',       // Low complexity, minimal context
  MEDIUM = 'medium',       // Medium complexity, moderate context
  COMPLEX = 'complex',     // High complexity, extensive context
}

/**
 * Context configuration for each complexity level
 */
interface ContextConfig {
  maxThoughtsInPrompt: number;    // Max thoughts to include in evaluation prompt
  maxHistorySteps: number;         // Max ReAct steps to include
  includeParentThought: boolean;   // Whether to include parent thought
  includeSiblings: boolean;         // Whether to include sibling thoughts
  batchSize: number;               // Batch size for evaluation
  useSummary: boolean;             // Use project summary instead of full info
}

// ============================================================================
// CONTEXT MANAGER
// ============================================================================

export class AdaptiveContextManager {
  private defaultConfig: ContextConfig = {
    maxThoughtsInPrompt: 3,
    maxHistorySteps: 3,
    includeParentThought: true,
    includeSiblings: false,
    batchSize: 3,
    useSummary: true,
  };

  private complexityConfigs: Map<ComplexityLevel, ContextConfig> = new Map([
    [ComplexityLevel.SIMPLE, {
      maxThoughtsInPrompt: 1,
      maxHistorySteps: 1,
      includeParentThought: false,
      includeSiblings: false,
      batchSize: 5,
      useSummary: true,
    }],
    [ComplexityLevel.MEDIUM, {
      maxThoughtsInPrompt: 3,
      maxHistorySteps: 3,
      includeParentThought: true,
      includeSiblings: false,
      batchSize: 3,
      useSummary: true,
    }],
    [ComplexityLevel.COMPLEX, {
      maxThoughtsInPrompt: 5,
      maxHistorySteps: 5,
      includeParentThought: true,
      includeSiblings: true,
      batchSize: 2,
      useSummary: false, // Use full info for complex tasks
    }],
  ]);

  // ---------------------------------------------------------------------------
  // COMPLEXITY ASSESSMENT
  // ---------------------------------------------------------------------------

  /**
   * Assess task complexity from requirement
   */
  assessComplexity(requirement: string): ComplexityLevel {
    const indicators = {
      simple: 0,
      medium: 0,
      complex: 0,
    };

    // Length indicators
    const wordCount = requirement.split(/\s+/).length;
    if (wordCount < 20) indicators.simple += 2;
    else if (wordCount < 50) indicators.medium += 1;
    else indicators.complex += 2;

    // Complexity keywords
    const simpleKeywords = ['add', 'update', 'fix', 'change', 'remove'];
    const mediumKeywords = ['create', 'implement', 'refactor', 'improve'];
    const complexKeywords = ['design', 'architecture', 'system', 'integration', 'optimize'];

    for (const keyword of simpleKeywords) {
      if (requirement.toLowerCase().includes(keyword)) indicators.simple += 1;
    }
    for (const keyword of mediumKeywords) {
      if (requirement.toLowerCase().includes(keyword)) indicators.medium += 1;
    }
    for (const keyword of complexKeywords) {
      if (requirement.toLowerCase().includes(keyword)) indicators.complex += 1;
    }

    // Multi-part requirements
    const conjunctions = ['and', 'then', 'also', 'additionally', 'furthermore'];
    let conjunctionCount = 0;
    for (const conjunction of conjunctions) {
      conjunctionCount += (requirement.match(new RegExp(conjunction, 'gi')) || []).length;
    }
    if (conjunctionCount > 2) indicators.complex += 2;
    else if (conjunctionCount > 0) indicators.medium += 1;

    // Technical complexity indicators
    const techIndicators = ['api', 'database', 'authentication', 'async', 'concurrent'];
    let techCount = 0;
    for (const indicator of techIndicators) {
      if (requirement.toLowerCase().includes(indicator)) techCount += 1;
    }
    if (techCount > 2) indicators.complex += 2;
    else if (techCount > 0) indicators.medium += 1;

    // Determine level
    if (indicators.complex >= indicators.medium && indicators.complex >= indicators.simple) {
      return ComplexityLevel.COMPLEX;
    } else if (indicators.medium >= indicators.simple) {
      return ComplexityLevel.MEDIUM;
    } else {
      return ComplexityLevel.SIMPLE;
    }
  }

  /**
   * Get context configuration for complexity level
   */
  getConfig(level: ComplexityLevel): ContextConfig {
    return this.complexityConfigs.get(level) || this.defaultConfig;
  }

  // ---------------------------------------------------------------------------
  // THOUGHT EVALUATION CONTEXT
  // ---------------------------------------------------------------------------

  /**
   * Build context for thought evaluation
   */
  buildThoughtEvaluationContext(
    thoughtsToEvaluate: ThoughtNode[],
    allThoughts: Map<string, ThoughtNode>,
    requirement: string,
    complexity: ComplexityLevel
  ): {
    context: string;
    batchSize: number;
    estimatedTokens: number;
  } {
    const config = this.getConfig(complexity);
    const context: string[] = [];

    // Requirement
    context.push(`REQUIREMENT: ${requirement}`);
    context.push('');

    // Select thoughts to include (respect batch size)
    const selectedThoughts = this.selectThoughtsForContext(
      thoughtsToEvaluate,
      allThoughts,
      config
    );

    context.push(`EVALUATING ${selectedThoughts.length} THOUGHTS:`);
    context.push('');

    // Include thoughts with context
    for (let i = 0; i < selectedThoughts.length; i++) {
      const thought = selectedThoughts[i];
      context.push(`Thought ${i + 1} (ID: ${thought.id.substring(0, 8)}...):`);
      context.push(thought.content);

      // Include parent if configured
      if (config.includeParentThought && thought.parentId) {
        const parent = allThoughts.get(thought.parentId);
        if (parent) {
          context.push(`  Parent: ${parent.content.substring(0, 100)}...`);
        }
      }

      // Include siblings if configured
      if (config.includeSiblings && thought.parentId) {
        const siblings = Array.from(allThoughts.values()).filter(
          t => t.parentId === thought.parentId && t.id !== thought.id
        );
        if (siblings.length > 0) {
          context.push(`  Siblings: ${siblings.length} alternative thoughts`);
        }
      }

      context.push('');
    }

    const estimatedTokens = this.estimateTokens(context.join('\n'));

    return {
      context: context.join('\n'),
      batchSize: config.batchSize,
      estimatedTokens,
    };
  }

  /**
   * Select thoughts for evaluation context
   */
  private selectThoughtsForContext(
    thoughts: ThoughtNode[],
    allThoughts: Map<string, ThoughtNode>,
    config: ContextConfig
  ): ThoughtNode[] {
    // If already within limit, return as-is
    if (thoughts.length <= config.maxThoughtsInPrompt) {
      return thoughts;
    }

    // Sort by depth (shallower thoughts first)
    const sorted = [...thoughts].sort((a, b) => a.depth - b.depth);

    // Return top N
    return sorted.slice(0, config.maxThoughtsInPrompt);
  }

  // ---------------------------------------------------------------------------
  // REACT CONTEXT
  // ---------------------------------------------------------------------------

  /**
   * Build sliding window context for ReAct
   */
  buildReActContext(
    currentStep: number,
    allSteps: Array<{ thought: string; action: any; observation: string }>,
    requirement: string,
    complexity: ComplexityLevel
  ): {
    context: string;
    windowSize: number;
    estimatedTokens: number;
  } {
    const config = this.getConfig(complexity);
    const context: string[] = [];

    // Requirement
    context.push(`REQUIREMENT: ${requirement}`);
    context.push('');
    context.push(`CURRENT STEP: ${currentStep}`);
    context.push('');

    // Determine window
    const windowStart = Math.max(0, currentStep - config.maxHistorySteps);
    const windowSteps = allSteps.slice(windowStart, currentStep);

    if (windowSteps.length > 0) {
      context.push(`RECENT STEPS (Last ${windowSteps.length}):`);
      context.push('');

      for (let i = 0; i < windowSteps.length; i++) {
        const step = windowSteps[i];
        const stepNumber = windowStart + i + 1;

        context.push(`Step ${stepNumber}:`);
        context.push(`  Thought: ${step.thought.substring(0, 150)}...`);
        if (step.action) {
          context.push(`  Action: ${step.action.type}`);
        }
        context.push(`  Observation: ${step.observation.substring(0, 150)}...`);
        context.push('');
      }
    }

    const estimatedTokens = this.estimateTokens(context.join('\n'));

    return {
      context: context.join('\n'),
      windowSize: config.maxHistorySteps,
      estimatedTokens,
    };
  }

  // ---------------------------------------------------------------------------
  // PROJECT CONTEXT
  // ---------------------------------------------------------------------------

  /**
   * Build project context (full info or summary)
   */
  buildProjectContext(
    projectInfo: Record<string, string>,
    projectSummary: ProjectSummary | null,
    complexity: ComplexityLevel
  ): {
    context: string;
    useSummary: boolean;
    estimatedTokens: number;
  } {
    const config = this.getConfig(complexity);
    const context: string[] = [];

    if (config.useSummary && projectSummary) {
      // Use summary format
      context.push('PROJECT CONTEXT (Summary):');
      context.push('');
      context.push(`- Files: ${projectSummary.totalFiles}`);
      context.push(`- Languages: ${projectSummary.languages.join(', ')}`);
      if (projectSummary.framework) {
        context.push(`- Framework: ${projectSummary.framework}`);
      }
      context.push('');

      // File tree (truncated)
      context.push('FILE TREE (Structure only):');
      context.push(this.renderCompactFileTree(projectSummary.fileTree));

      return {
        context: context.join('\n'),
        useSummary: true,
        estimatedTokens: this.estimateTokens(context.join('\n')),
      };
    } else {
      // Use full info
      context.push('PROJECT CONTEXT (Complete):');
      context.push('');

      const fileCount = Object.keys(projectInfo).length;
      context.push(`Total files: ${fileCount}`);
      context.push('');

      // List all files with preview
      let count = 0;
      for (const [path, content] of Object.entries(projectInfo)) {
        if (count >= 20) {
          context.push('... (remaining files truncated)');
          break;
        }

        const lines = content.split('\n');
        const preview = lines.slice(0, 10).join('\n');
        context.push(`\n${path} (${lines.length} lines):`);
        context.push('```');
        context.push(preview);
        if (lines.length > 10) {
          context.push('...');
        }
        context.push('```');

        count++;
      }

      return {
        context: context.join('\n'),
        useSummary: false,
        estimatedTokens: this.estimateTokens(context.join('\n')),
      };
    }
  }

  /**
   * Render compact file tree
   */
  private renderCompactFileTree(nodes: any[], prefix: string = '', maxDepth: number = 3, currentDepth: number = 0): string {
    if (currentDepth >= maxDepth) return '';

    const lines: string[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const isLast = i === nodes.length - 1;
      const connector = isLast ? '└──' : '├──';
      const icon = node.type === 'directory' ? '📁' : '📄';

      lines.push(`${prefix}${connector} ${icon} ${node.path.split('/').pop()}`);

      if (node.children && node.children.length > 0) {
        const childPrefix = prefix + (isLast ? '    ' : '│   ');
        lines.push(this.renderCompactFileTree(node.children, childPrefix, maxDepth, currentDepth + 1));
      }
    }

    return lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // UTILITY FUNCTIONS
  // ---------------------------------------------------------------------------

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Get recommended batch size for thought evaluation
   */
  getRecommendedBatchSize(complexity: ComplexityLevel): number {
    const config = this.getConfig(complexity);
    return config.batchSize;
  }

  /**
   * Get recommended window size for ReAct
   */
  getRecommendedWindowSize(complexity: ComplexityLevel): number {
    const config = this.getConfig(complexity);
    return config.maxHistorySteps;
  }

  /**
   * Check if should use project summary
   */
  shouldUseSummary(complexity: ComplexityLevel): boolean {
    const config = this.getConfig(complexity);
    return config.useSummary;
  }
}
