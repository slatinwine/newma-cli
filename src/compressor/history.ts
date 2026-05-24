// src/compressor/history.ts
/**
 * Execution History Summarization
 * Summarizes execution history to reduce token usage
 */

import { ExecutionRecord } from '../history';
import { HistorySummarizationOptions, CompressionStats, CompressionResult } from './types';

/**
 * History summarizer class
 */
export class HistorySummarizer {
  private options: HistorySummarizationOptions;

  constructor(options: HistorySummarizationOptions = {}) {
    this.options = {
      maxIterations: options.maxIterations || 10,
      keepRecent: options.keepRecent || 3,
      summarizeOld: options.summarizeOld !== false,
      focusOnErrors: options.focusOnErrors || true,
    };
  }

  /**
   * Summarize execution history
   */
  summarize(history: ExecutionRecord[]): CompressionResult<ExecutionRecord[]> {
    const startTime = Date.now();
    const originalSize = this.calculateSize(history);

    let summarized: ExecutionRecord[];

    // Keep error-prone iterations
    const errorIterations = this.options.focusOnErrors
      ? history.filter(record => record.status !== 'success')
      : [];

    // Separate into recent and old
    const recent = history.slice(-this.options.keepRecent!);
    const old = history.slice(0, -this.options.keepRecent!);

    if (this.options.summarizeOld) {
      // Summarize old iterations
      const summarizedOld = this.summarizeRecords(old);
      summarized = [...summarizedOld, ...recent, ...errorIterations];
    } else {
      // Just keep recent and error iterations
      summarized = [...recent, ...errorIterations];
    }

    // Remove duplicates and limit
    summarized = this.deduplicate(summarized);
    summarized = summarized.slice(0, this.options.maxIterations!);

    const endTime = Date.now();
    const compressedSize = this.calculateSize(summarized);

    const stats: CompressionStats = {
      originalSize,
      compressedSize,
      reduction: ((originalSize - compressedSize) / originalSize) * 100,
      reductionBytes: originalSize - compressedSize,
      compressionTime: endTime - startTime,
    };

    return { data: summarized, stats };
  }

  /**
   * Summarize execution records
   */
  private summarizeRecords(records: ExecutionRecord[]): ExecutionRecord[] {
    if (records.length === 0) return [];

    // Create a single summary record
    const successCount = records.filter(r => r.status === 'success').length;
    const summary: ExecutionRecord = {
      id: 'summary-' + Date.now(),
      iteration: records[0].iteration,
      action: {
        type: 'summary',
        description: `Summarized ${records.length} iterations`,
      } as any,
      status: successCount > records.length / 2 ? 'success' : 'failed',
      timestamp: new Date(Math.min(...records.map(r => r.timestamp.getTime()))),
      duration: records.reduce((sum, r) => sum + r.duration, 0),
      error: successCount < records.length ? `Some of ${records.length} actions failed` : undefined,
    };

    return [summary];
  }

  /**
   * Generate summary text
   */
  private generateSummary(records: ExecutionRecord[]): string {
    const successCount = records.filter(r => r.status === 'success').length;
    const failureCount = records.length - successCount;

    const summary: string[] = [
      `Summary of ${records.length} iterations:`,
      `  Success: ${successCount}`,
      `  Failures: ${failureCount}`,
    ];

    // Add action breakdown
    const actionCounts = new Map<string, number>();
    records.forEach(record => {
      const actionType = record.action.type || 'unknown';
      actionCounts.set(actionType, (actionCounts.get(actionType) || 0) + 1);
    });

    summary.push('  Actions performed:');
    actionCounts.forEach((count, type) => {
      summary.push(`    - ${type}: ${count}`);
    });

    return summary.join('\n');
  }

  /**
   * Remove duplicate records
   */
  private deduplicate(records: ExecutionRecord[]): ExecutionRecord[] {
    const seen = new Set<string>();
    const unique: ExecutionRecord[] = [];

    for (const record of records) {
      const key = `${record.action.type}-${record.action.description}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(record);
      }
    }

    return unique;
  }

  /**
   * Calculate size of records in characters
   */
  private calculateSize(records: ExecutionRecord[]): number {
    return JSON.stringify(records).length;
  }

  /**
   * Get summarization statistics without actually summarizing
   */
  estimate(history: ExecutionRecord[]): CompressionStats {
    const result = this.summarize(history);
    return result.stats;
  }
}
