/**
 * Memory Injection - Token Budget Manager
 *
 * Manages token estimation and allocation for memory injection
 */

/**
 * Token allocation by memory source
 */
export interface TokenAllocation {
  /**
   * Tokens allocated for errors
   */
  errors: number;

  /**
   * Tokens allocated for executions
   */
  executions: number;

  /**
   * Tokens allocated for reasoning
   */
  reasoning: number;

  /**
   * Tokens allocated for sessions
   */
  sessions: number;

  /**
   * Tokens allocated for context
   */
  context: number;

  /**
   * Total allocated tokens
   */
  total: number;
}

/**
 * Token budget configuration
 */
export interface TokenBudgetConfig {
  /**
   * Default maximum tokens
   */
  defaultMaxTokens: number;

  /**
   * Default allocation percentages
   */
  defaultAllocation: {
    errors: number;
    executions: number;
    reasoning: number;
    sessions: number;
    context: number;
  };
}

/**
 * Token estimation result
 */
export interface TokenEstimation {
  /**
   * Estimated token count
   */
  tokens: number;

  /**
   * Character count
   */
  characters: number;

  /**
   * Word count (approximate)
   */
  words: number;

  /**
   * Chinese character count
   */
  chineseChars: number;

  /**
   * Non-Chinese character count
   */
  otherChars: number;
}

/**
 * Token Budget Manager
 *
 * Manages token estimation and allocation for memory injection
 */
export class TokenBudgetManager {
  private config: TokenBudgetConfig;
  private currentAllocation: TokenAllocation;

  constructor(config?: Partial<TokenBudgetConfig>) {
    this.config = {
      defaultMaxTokens: config?.defaultMaxTokens || 2000,
      defaultAllocation: config?.defaultAllocation || {
        errors: 0.4,
        executions: 0.2,
        reasoning: 0.2,
        sessions: 0.1,
        context: 0.1,
      },
    };

    // Initialize current allocation
    this.currentAllocation = this.calculateAllocation(
      this.config.defaultMaxTokens,
      this.config.defaultAllocation
    );
  }

  /**
   * Calculate token allocation based on max tokens
   */
  calculateAllocation(
    maxTokens: number,
    customAllocation?: Partial<{
      errors: number;
      executions: number;
      reasoning: number;
      sessions: number;
      context: number;
    }>
  ): TokenAllocation {
    const allocation = customAllocation || this.config.defaultAllocation;

    // Calculate absolute token amounts
    const errors = Math.round(maxTokens * (allocation.errors || 0));
    const executions = Math.round(maxTokens * (allocation.executions || 0));
    const reasoning = Math.round(maxTokens * (allocation.reasoning || 0));
    const sessions = Math.round(maxTokens * (allocation.sessions || 0));
    const context = Math.round(maxTokens * (allocation.context || 0));

    // Calculate actual total (due to rounding)
    const total = errors + executions + reasoning + sessions + context;

    return {
      errors,
      executions,
      reasoning,
      sessions,
      context,
      total,
    };
  }

  /**
   * Estimate token count for text
   */
  estimateTokens(text: string): TokenEstimation {
    // Count Chinese characters
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;

    // Count other characters
    const otherChars = text.length - chineseChars;

    // Estimate words (rough approximation)
    const words = text.split(/\s+/).filter(w => w.length > 0).length;

    // Estimate tokens (Chinese: ~2 chars per token, Other: ~4 chars per token)
    const tokens = Math.ceil(chineseChars / 2 + otherChars / 4);

    return {
      tokens,
      characters: text.length,
      words,
      chineseChars,
      otherChars,
    };
  }

  /**
   * Estimate tokens for structured data
   */
  estimateTokensForData(data: any): number {
    const text = JSON.stringify(data);
    return this.estimateTokens(text).tokens;
  }

  /**
   * Calculate remaining budget
   */
  calculateRemaining(usedTokens: number): number {
    return Math.max(0, this.config.defaultMaxTokens - usedTokens);
  }

  /**
   * Check if within budget
   */
  isWithinBudget(usedTokens: number): boolean {
    return usedTokens <= this.config.defaultMaxTokens;
  }

  /**
   * Get current allocation
   */
  getCurrentAllocation(): TokenAllocation {
    return { ...this.currentAllocation };
  }

  /**
   * Get maximum tokens
   */
  getMaxTokens(): number {
    return this.config.defaultMaxTokens;
  }

  /**
   * Set maximum tokens
   */
  setMaxTokens(maxTokens: number): void {
    this.config.defaultMaxTokens = maxTokens;
    this.currentAllocation = this.calculateAllocation(maxTokens);
  }

  /**
   * Update allocation percentages
   */
  updateAllocation(allocation: Partial<{
    errors: number;
    executions: number;
    reasoning: number;
    sessions: number;
    context: number;
  }>): void {
    this.config.defaultAllocation = {
      ...this.config.defaultAllocation,
      ...allocation,
    };

    this.currentAllocation = this.calculateAllocation(
      this.config.defaultMaxTokens,
      this.config.defaultAllocation
    );
  }

  /**
   * Validate allocation percentages
   */
  validateAllocation(allocation: {
    errors?: number;
    executions?: number;
    reasoning?: number;
    sessions?: number;
    context?: number;
  }): { valid: boolean; error?: string } {
    const total = (allocation.errors || 0) +
                  (allocation.executions || 0) +
                  (allocation.reasoning || 0) +
                  (allocation.sessions || 0) +
                  (allocation.context || 0);

    if (Math.abs(total - 1.0) > 0.01) {
      return {
        valid: false,
        error: `Allocation percentages must sum to 1.0, got ${total.toFixed(2)}`,
      };
    }

    // Check each value is between 0 and 1
    for (const [key, value] of Object.entries(allocation)) {
      if (value < 0 || value > 1) {
        return {
          valid: false,
          error: `${key} must be between 0 and 1, got ${value}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Get allocation statistics
   */
  getStatistics(): {
    maxTokens: number;
    currentAllocation: TokenAllocation;
    allocationPercentages: {
      errors: number;
      executions: number;
      reasoning: number;
      sessions: number;
      context: number;
    };
  } {
    return {
      maxTokens: this.config.defaultMaxTokens,
      currentAllocation: this.currentAllocation,
      allocationPercentages: this.config.defaultAllocation,
    };
  }

  /**
   * Format token count for display
   */
  static formatTokenCount(tokens: number): string {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    } else {
      return tokens.toString();
    }
  }

  /**
   * Truncate text to fit within token budget
   */
  truncateToBudget(text: string, maxTokens: number): string {
    const estimation = this.estimateTokens(text);

    if (estimation.tokens <= maxTokens) {
      return text;
    }

    // Calculate how much to truncate (rough estimation)
    const ratio = maxTokens / estimation.tokens;
    const targetLength = Math.floor(text.length * ratio * 0.9); // 90% to be safe

    return text.substring(0, targetLength) + '...';
  }

  /**
   * Calculate optimal chunk size for processing
   */
  calculateOptimalChunkSize(totalTokens: number, maxChunks: number = 10): number {
    const chunkSize = Math.ceil(totalTokens / maxChunks);
    return Math.max(100, Math.min(chunkSize, 1000)); // Between 100 and 1000 tokens
  }

  /**
   * Distribute tokens across multiple items
   */
  distributeTokens(itemCount: number, totalTokens: number): number[] {
    if (itemCount === 0) {
      return [];
    }

    const baseTokens = Math.floor(totalTokens / itemCount);
    const remainder = totalTokens % itemCount;

    const distribution: number[] = [];
    for (let i = 0; i < itemCount; i++) {
      // Distribute remainder across first few items
      distribution.push(baseTokens + (i < remainder ? 1 : 0));
    }

    return distribution;
  }

  /**
   * Get recommended allocation for different scenarios
   */
  static getRecommendedAllocations(): Record<string, {
    description: string;
    allocation: {
      errors: number;
      executions: number;
      reasoning: number;
      sessions: number;
      context: number;
    };
  }> {
    return {
      debugging: {
        description: 'Focus on errors and execution history',
        allocation: {
          errors: 0.5,
          executions: 0.3,
          reasoning: 0.1,
          sessions: 0.05,
          context: 0.05,
        },
      },
      planning: {
        description: 'Focus on reasoning and sessions',
        allocation: {
          errors: 0.1,
          executions: 0.1,
          reasoning: 0.5,
          sessions: 0.2,
          context: 0.1,
        },
      },
      balanced: {
        description: 'Balanced across all sources',
        allocation: {
          errors: 0.3,
          executions: 0.2,
          reasoning: 0.2,
          sessions: 0.2,
          context: 0.1,
        },
      },
      quick: {
        description: 'Quick context, minimal tokens',
        allocation: {
          errors: 0.6,
          executions: 0.1,
          reasoning: 0.2,
          sessions: 0.1,
          context: 0.0,
        },
      },
    };
  }
}