/**
 * Memory Injection - Relevance Ranker
 *
 * Ranks and filters memory search results by relevance
 */

import { MemorySearchResult, MemorySource } from '../search/memory-search';
import { TokenBudgetManager, TokenAllocation } from './token-budget';

/**
 * Ranked result with additional scoring
 */
export interface RankedResult extends MemorySearchResult {
  /**
   * Combined relevance score (0-1)
   */
  combinedScore: number;

  /**
   * Relevance score component
   */
  relevanceScore: number;

  /**
   * Recency score component (0-1)
   */
  recencyScore: number;

  /**
   * Diversity score component (0-1)
   */
  diversityScore: number;

  /**
   * Estimated token cost
   */
  estimatedTokens: number;
}

/**
 * Ranking options
 */
export interface RankingOptions {
  /**
   * Weight for relevance score (0-1)
   */
  relevanceWeight?: number;

  /**
   * Weight for recency score (0-1)
   */
  recencyWeight?: number;

  /**
   * Weight for diversity score (0-1)
   */
  diversityWeight?: number;

  /**
   * Recency decay rate (higher = faster decay)
   */
  recencyDecay?: number;

  /**
   * Whether to enable diversity boosting
   */
  enableDiversity?: boolean;
}

/**
 * Relevance Ranker
 *
 * Ranks memory search results using multiple factors
 */
export class RelevanceRanker {
  private tokenBudget: TokenBudgetManager;
  private options: Required<RankingOptions>;

  constructor(options: RankingOptions = {}) {
    this.tokenBudget = new TokenBudgetManager();
    this.options = {
      relevanceWeight: options.relevanceWeight ?? 0.6,
      recencyWeight: options.recencyWeight ?? 0.3,
      diversityWeight: options.diversityWeight ?? 0.1,
      recencyDecay: options.recencyDecay ?? 0.1,
      enableDiversity: options.enableDiversity ?? true,
    };
  }

  /**
   * Rank results by relevance
   */
  rankResults(
    results: MemorySearchResult[],
    query: string,
    maxTokens: number
  ): RankedResult[] {
    if (results.length === 0) {
      return [];
    }

    // Calculate scores for each result
    const rankedResults: RankedResult[] = results.map((result, index) => {
      const relevanceScore = result.score; // BM25 score from search

      // Calculate recency score
      const recencyScore = this.calculateRecencyScore(result.timestamp);

      // Calculate diversity score (simple version based on position)
      const diversityScore = this.calculateDiversityScore(results, index);

      // Calculate combined score
      const combinedScore =
        (this.options.relevanceWeight * relevanceScore) +
        (this.options.recencyWeight * recencyScore) +
        (this.options.diversityWeight * diversityScore);

      // Estimate tokens
      const estimatedTokens = this.estimateResultTokens(result);

      return {
        ...result,
        combinedScore,
        relevanceScore,
        recencyScore,
        diversityScore,
        estimatedTokens,
      };
    });

    // Sort by combined score (descending)
    rankedResults.sort((a, b) => b.combinedScore - a.combinedScore);

    // Filter to fit within token budget
    return this.filterByTokenBudget(rankedResults, maxTokens);
  }

  /**
   * Allocate results by source type
   */
  allocateBySource(
    results: RankedResult[],
    allocation: TokenAllocation
  ): RankedResult[] {
    const allocated: RankedResult[] = [];
    const usedTokens = {
      error: 0,
      execution: 0,
      reasoning: 0,
      session: 0,
      context: 0,
    };

    // Group results by source
    const resultsBySource = new Map<MemorySource, RankedResult[]>();
    for (const result of results) {
      if (!resultsBySource.has(result.source)) {
        resultsBySource.set(result.source, []);
      }
      resultsBySource.get(result.source)!.push(result);
    }

    // Allocate from each source up to its budget
    const sourceBudgetMap: Map<MemorySource, number> = new Map([
      ['error', allocation.errors],
      ['execution', allocation.executions],
      ['reasoning', allocation.reasoning],
      ['session', allocation.sessions],
      ['context', allocation.context],
    ]);

    for (const [source, budget] of sourceBudgetMap.entries()) {
      const sourceResults = resultsBySource.get(source) || [];
      let usedBudget = 0;

      for (const result of sourceResults) {
        if (usedBudget + result.estimatedTokens <= budget) {
          allocated.push(result);
          usedBudget += result.estimatedTokens;
        } else {
          break; // Budget exhausted for this source
        }
      }
    }

    return allocated;
  }

  /**
   * Calculate recency score
   */
  private calculateRecencyScore(timestamp: string): number {
    const now = new Date();
    const resultTime = new Date(timestamp);

    // Calculate days since result
    const daysSince = (now.getTime() - resultTime.getTime()) / (1000 * 60 * 60 * 24);

    // Exponential decay
    return Math.exp(-this.options.recencyDecay * daysSince);
  }

  /**
   * Calculate diversity score
   */
  private calculateDiversityScore(results: MemorySearchResult[], currentIndex: number): number {
    if (!this.options.enableDiversity) {
      return 0;
    }

    // Simple diversity: boost items that are different from previous ones
    // In a real implementation, this would use more sophisticated diversity metrics
    const currentResult = results[currentIndex];
    let diversity = 1.0;

    // Check against previous results
    for (let i = 0; i < currentIndex; i++) {
      const otherResult = results[i];

      // Reduce diversity if same source
      if (currentResult.source === otherResult.source) {
        diversity *= 0.9;
      }

      // Reduce diversity if similar metadata
      if (this.hasSimilarMetadata(currentResult, otherResult)) {
        diversity *= 0.95;
      }
    }

    return diversity;
  }

  /**
   * Check if two results have similar metadata
   */
  private hasSimilarMetadata(result1: MemorySearchResult, result2: MemorySearchResult): boolean {
    // Check for common metadata fields
    const metadata1 = result1.metadata || {};
    const metadata2 = result2.metadata || {};

    // Check category/type
    if (metadata1.category && metadata1.category === metadata2.category) {
      return true;
    }

    // Check tags
    const tags1 = metadata1.tags || [];
    const tags2 = metadata2.tags || [];
    const commonTags = tags1.filter((tag: string) => tags2.includes(tag));
    if (commonTags.length > 0) {
      return true;
    }

    return false;
  }

  /**
   * Estimate token cost for a result
   */
  private estimateResultTokens(result: MemorySearchResult): number {
    // Estimate based on data type
    let baseTokens = 50; // Base overhead

    switch (result.source) {
      case 'error':
        baseTokens += 100; // Error message + solution
        break;
      case 'execution':
        baseTokens += 80; // Command + output
        break;
      case 'reasoning':
        baseTokens += 150; // Reasoning chain/pattern
        break;
      case 'session':
        baseTokens += 200; // Session context
        break;
      case 'context':
        baseTokens += 30; // Context data
        break;
      default:
        baseTokens += 50;
    }

    // Add snippet tokens
    if (result.snippet) {
      baseTokens += this.tokenBudget.estimateTokens(result.snippet).tokens;
    }

    return baseTokens;
  }

  /**
   * Filter results to fit within token budget
   */
  private filterByTokenBudget(results: RankedResult[], maxTokens: number): RankedResult[] {
    const filtered: RankedResult[] = [];
    let totalTokens = 0;

    for (const result of results) {
      if (totalTokens + result.estimatedTokens <= maxTokens) {
        filtered.push(result);
        totalTokens += result.estimatedTokens;
      } else {
        break; // Budget exhausted
      }
    }

    return filtered;
  }

  /**
   * Get top N results by score
   */
  getTopResults(results: RankedResult[], limit: number): RankedResult[] {
    return results.slice(0, limit);
  }

  /**
   * Get results by minimum score threshold
   */
  getResultsByThreshold(results: RankedResult[], minScore: number): RankedResult[] {
    return results.filter(r => r.combinedScore >= minScore);
  }

  /**
   * Deduplicate results by ID
   */
  deduplicateResults(results: RankedResult[]): RankedResult[] {
    const seen = new Set<string>();
    const deduplicated: RankedResult[] = [];

    for (const result of results) {
      if (!seen.has(result.id)) {
        seen.add(result.id);
        deduplicated.push(result);
      }
    }

    return deduplicated;
  }

  /**
   * Update ranking options
   */
  updateOptions(options: Partial<RankingOptions>): void {
    this.options = {
      ...this.options,
      ...options,
    };
  }

  /**
   * Get current options
   */
  getOptions(): Required<RankingOptions> {
    return { ...this.options };
  }

  /**
   * Get ranking statistics
   */
  getStatistics(results: RankedResult[]): {
    totalResults: number;
    totalTokens: number;
    averageScore: number;
    scoreDistribution: {
      high: number;    // > 0.7
      medium: number;  // 0.3 - 0.7
      low: number;     // < 0.3
    };
    sourceDistribution: Record<MemorySource, number>;
  } {
    const stats = {
      totalResults: results.length,
      totalTokens: results.reduce((sum, r) => sum + r.estimatedTokens, 0),
      averageScore: results.length > 0 ?
        results.reduce((sum, r) => sum + r.combinedScore, 0) / results.length : 0,
      scoreDistribution: {
        high: 0,
        medium: 0,
        low: 0,
      },
      sourceDistribution: {} as Record<MemorySource, number>,
    };

    // Calculate score distribution
    for (const result of results) {
      if (result.combinedScore > 0.7) {
        stats.scoreDistribution.high++;
      } else if (result.combinedScore > 0.3) {
        stats.scoreDistribution.medium++;
      } else {
        stats.scoreDistribution.low++;
      }

      // Count by source
      stats.sourceDistribution[result.source] =
        (stats.sourceDistribution[result.source] || 0) + 1;
    }

    return stats;
  }

  /**
   * Explain why a result was ranked this way
   */
  explainRanking(result: RankedResult): string {
    const reasons: string[] = [];

    if (result.relevanceScore > 0.7) {
      reasons.push(`High relevance (${(result.relevanceScore * 100).toFixed(0)}%)`);
    }

    if (result.recencyScore > 0.7) {
      reasons.push(`Recent (${(result.recencyScore * 100).toFixed(0)}%)`);
    }

    if (result.diversityScore > 0.7) {
      reasons.push(`Diverse (${(result.diversityScore * 100).toFixed(0)}%)`);
    }

    return reasons.length > 0 ?
      `${reasons.join(', ')}. Total: ${(result.combinedScore * 100).toFixed(0)}%` :
      `Combined score: ${(result.combinedScore * 100).toFixed(0)}%`;
  }
}