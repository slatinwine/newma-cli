/**
 * Memory Injection - Context Injector
 *
 * Automatically injects relevant memory context into AI calls
 */

import { MemorySearchEngine, MemorySearchResult, MemorySource } from '../search/memory-search';
import { TokenBudgetManager, TokenAllocation } from './token-budget';
import { RelevanceRanker, RankedResult } from './relevance-ranker';

/**
 * Memory injection result
 */
export interface MemoryInjection {
  /**
   * Relevant error records
   */
  relevantErrors: any[];

  /**
   * Similar command executions
   */
  similarExecutions: any[];

  /**
   * Applicable reasoning patterns
   */
  reasoningPatterns: any[];

  /**
   * Related session contexts
   */
  relatedSessions: any[];

  /**
   * Total estimated tokens
   */
  estimatedTokens: number;

  /**
   * Token allocation by source
   */
  tokenAllocation: TokenAllocation;

  /**
   * Formatted context string for AI
   */
  formattedContext: string;

  /**
   * Metadata about the injection
   */
  metadata: {
    query: string;
    timestamp: string;
    sourcesSearched: MemorySource[];
    totalResults: number;
    searchTime: number;
  };
}

/**
 * Context injection options
 */
export interface ContextInjectionOptions {
  /**
   * Maximum tokens for memory injection
   */
  maxTokens?: number;

  /**
   * Which memory sources to search
   */
  sources?: MemorySource[];

  /**
   * Minimum relevance threshold (0-1)
   */
  minRelevance?: number;

  /**
   * Whether to include formatted context string
   */
  includeFormattedContext?: boolean;

  /**
   * Custom token allocation percentages
   */
  tokenAllocation?: {
    errors?: number;
    executions?: number;
    reasoning?: number;
    sessions?: number;
    context?: number;
  };
}

/**
 * Memory Context Injector
 *
 * Automatically retrieves and formats relevant memory context
 * for injection into AI prompts
 */
export class MemoryContextInjector {
  private searchEngine: MemorySearchEngine;
  private tokenBudget: TokenBudgetManager;
  private relevanceRanker: RelevanceRanker;

  constructor(searchEngine: MemorySearchEngine) {
    this.searchEngine = searchEngine;
    this.tokenBudget = new TokenBudgetManager();
    this.relevanceRanker = new RelevanceRanker();
  }

  /**
   * Get relevant context for a task
   */
  async getRelevantContext(
    task: string,
    options: ContextInjectionOptions = {}
  ): Promise<MemoryInjection> {
    const startTime = Date.now();

    // Set defaults
    const maxTokens = options.maxTokens || 2000;
    const sources = options.sources || ['error', 'execution', 'reasoning', 'session'];
    const minRelevance = options.minRelevance || 0.1;

    // Calculate token allocation
    const tokenAllocation = this.tokenBudget.calculateAllocation(
      maxTokens,
      options.tokenAllocation
    );

    // Search memory sources
    const searchResults = await this.searchEngine.search(task, {
      sources,
      limitPerSource: 20, // Get more results, then rank and filter
      threshold: minRelevance,
    });

    // Rank and filter results
    const rankedResults = this.relevanceRanker.rankResults(
      searchResults,
      task,
      maxTokens
    );

    // Allocate results by source
    const allocatedResults = this.relevanceRanker.allocateBySource(
      rankedResults,
      tokenAllocation
    );

    // Extract data by source type
    const relevantErrors = this.extractResultsBySource(allocatedResults, 'error');
    const similarExecutions = this.extractResultsBySource(allocatedResults, 'execution');
    const reasoningPatterns = this.extractResultsBySource(allocatedResults, 'reasoning');
    const relatedSessions = this.extractResultsBySource(allocatedResults, 'session');

    // Format context
    const formattedContext = options.includeFormattedContext !== false ?
      this.formatContextForAI({
        relevantErrors,
        similarExecutions,
        reasoningPatterns,
        relatedSessions,
      }) : '';

    // Estimate tokens
    const estimatedTokens = this.estimateTokens(formattedContext);

    return {
      relevantErrors,
      similarExecutions,
      reasoningPatterns,
      relatedSessions,
      estimatedTokens,
      tokenAllocation,
      formattedContext,
      metadata: {
        query: task,
        timestamp: new Date().toISOString(),
        sourcesSearched: sources,
        totalResults: searchResults.length,
        searchTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Get quick context (errors and reasoning only, faster)
   */
  async getQuickContext(
    task: string,
    maxTokens: number = 500
  ): Promise<MemoryInjection> {
    return this.getRelevantContext(task, {
      maxTokens,
      sources: ['error', 'reasoning'],
      tokenAllocation: {
        errors: 0.6,
        reasoning: 0.4,
        executions: 0,
        sessions: 0,
        context: 0,
      },
    });
  }

  /**
   * Extract results by source type
   */
  private extractResultsBySource(results: RankedResult[], source: MemorySource): any[] {
    return results
      .filter(r => r.source === source)
      .map(r => r.data);
  }

  /**
   * Format context for AI consumption
   */
  private formatContextForAI(context: {
    relevantErrors: any[];
    similarExecutions: any[];
    reasoningPatterns: any[];
    relatedSessions: any[];
  }): string {
    const sections: string[] = [];

    // Add errors section
    if (context.relevantErrors.length > 0) {
      sections.push('🔴 Relevant Past Errors:');
      context.relevantErrors.forEach((error, index) => {
        sections.push(`  ${index + 1}. ${error.message}`);
        if (error.solution?.description) {
          sections.push(`     Solution: ${error.solution.description}`);
        }
      });
      sections.push('');
    }

    // Add reasoning patterns section
    if (context.reasoningPatterns.length > 0) {
      sections.push('🧠 Relevant Reasoning Patterns:');
      context.reasoningPatterns.forEach((pattern, index) => {
        sections.push(`  ${index + 1}. ${pattern.name || pattern.description}`);
        if (pattern.category) {
          sections.push(`     Category: ${pattern.category}`);
        }
      });
      sections.push('');
    }

    // Add similar executions section
    if (context.similarExecutions.length > 0) {
      sections.push('⚡ Similar Past Commands:');
      context.similarExecutions.forEach((exec, index) => {
        sections.push(`  ${index + 1}. ${exec.command}`);
        if (exec.output) {
          const snippet = exec.output.substring(0, 100);
          sections.push(`     Output: ${snippet}${exec.output.length > 100 ? '...' : ''}`);
        }
      });
      sections.push('');
    }

    // Add related sessions section
    if (context.relatedSessions.length > 0) {
      sections.push('💬 Related Sessions:');
      context.relatedSessions.forEach((session, index) => {
        sections.push(`  ${index + 1}. ${session.title}`);
        if (session.summary) {
          sections.push(`     Summary: ${session.summary}`);
        }
      });
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English, ~2 for Chinese
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;

    return Math.ceil(chineseChars / 2 + otherChars / 4);
  }

  /**
   * Get injection statistics
   */
  getStatistics(): {
    totalInjections: number;
    averageTokens: number;
    averageSearchTime: number;
    sourcesUsed: Record<string, number>;
  } {
    // This would be tracked in a real implementation
    return {
      totalInjections: 0,
      averageTokens: 0,
      averageSearchTime: 0,
      sourcesUsed: {},
    };
  }

  /**
   * Update token budget configuration
   */
  updateTokenBudget(config: {
    defaultMaxTokens?: number;
    allocation?: {
      errors?: number;
      executions?: number;
      reasoning?: number;
      sessions?: number;
      context?: number;
    };
  }): void {
    if (config.defaultMaxTokens) {
      this.tokenBudget.setMaxTokens(config.defaultMaxTokens);
    }

    if (config.allocation) {
      this.tokenBudget.updateAllocation(config.allocation);
    }
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    await this.searchEngine.dispose();
  }
}