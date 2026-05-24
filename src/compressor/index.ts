// src/compressor/index.ts
/**
 * Unified Token Compression Manager
 * Integrates all compression strategies
 */

import { ContextCompressor } from './context';
import { HistorySummarizer } from './history';
import { ContentOptimizer } from './content';
import { IncrementalTracker } from './incremental';
import {
  CompressionConfig,
  CompressionStats,
  ContextCompressionOptions,
  HistorySummarizationOptions,
  FileContentOptions,
  IncrementalTrackingOptions,
} from './types';
import { ExecutionRecord } from '../history';
import chalk from 'chalk';

/**
 * Compression report
 */
export interface CompressionReport {
  context?: CompressionStats;
  history?: CompressionStats;
  content?: CompressionStats;
  incremental?: CompressionStats;
  total: {
    originalSize: number;
    compressedSize: number;
    reduction: number;
    reductionBytes: number;
    totalTime: number;
  };
}

/**
 * Compression manager
 */
export class CompressionManager {
  private config: CompressionConfig;
  private contextCompressor: ContextCompressor;
  private historySummarizer: HistorySummarizer;
  private contentOptimizer: ContentOptimizer;
  private incrementalTracker: IncrementalTracker;

  constructor(config: CompressionConfig = {}) {
    this.config = {
      enabled: config.enabled !== false,
      maxTokens: config.maxTokens || 8000,
      targetReduction: config.targetReduction || 50,
      aggressive: config.aggressive || false,
    };

    this.contextCompressor = new ContextCompressor();
    this.historySummarizer = new HistorySummarizer();
    this.contentOptimizer = new ContentOptimizer();
    this.incrementalTracker = new IncrementalTracker();
  }

  /**
   * Compress everything
   */
  compressAll(params: {
    context?: string;
    contextRoot?: string;
    history?: ExecutionRecord[];
    files?: Map<string, string>;
    contextOptions?: ContextCompressionOptions;
    historyOptions?: HistorySummarizationOptions;
    contentOptions?: FileContentOptions;
    incrementalOptions?: IncrementalTrackingOptions;
  }): {
    context?: string;
    history?: ExecutionRecord[];
    files?: Map<string, string>;
    report: CompressionReport;
  } {
    const startTime = Date.now();
    const report: CompressionReport = {
      total: {
        originalSize: 0,
        compressedSize: 0,
        reduction: 0,
        reductionBytes: 0,
        totalTime: 0,
      },
    };

    let result: any = {
      context: params.context,
      history: params.history,
      files: params.files,
    };

    if (!this.config.enabled) {
      result.report = {
        total: {
          originalSize: 0,
          compressedSize: 0,
          reduction: 0,
          reductionBytes: 0,
          totalTime: 0,
        },
      };
      return result;
    }

    // Compress context
    if (params.context && params.contextRoot) {
      const contextResult = this.contextCompressor.compress(
        params.context,
        params.contextRoot
      );
      result.context = contextResult.data;
      report.context = contextResult.stats;
      report.total.originalSize += contextResult.stats.originalSize;
      report.total.compressedSize += contextResult.stats.compressedSize;
    }

    // Summarize history
    if (params.history) {
      const historyResult = this.historySummarizer.summarize(params.history);
      result.history = historyResult.data;
      report.history = historyResult.stats;
      report.total.originalSize += historyResult.stats.originalSize;
      report.total.compressedSize += historyResult.stats.compressedSize;
    }

    // Optimize file contents
    if (params.files && params.files.size > 0) {
      const contentResult = this.contentOptimizer.optimizeMultiple(params.files);
      result.files = contentResult.data;
      report.content = contentResult.stats;
      report.total.originalSize += contentResult.stats.originalSize;
      report.total.compressedSize += contentResult.stats.compressedSize;
    }

    const endTime = Date.now();

    // Calculate totals
    report.total.reduction =
      ((report.total.originalSize - report.total.compressedSize) /
        report.total.originalSize) * 100;
    report.total.reductionBytes =
      report.total.originalSize - report.total.compressedSize;
    report.total.totalTime = endTime - startTime;

    result.report = report;

    return result;
  }

  /**
   * Estimate compression without actually compressing
   */
  estimate(params: {
    context?: string;
    contextRoot?: string;
    history?: ExecutionRecord[];
    files?: Map<string, string>;
  }): CompressionReport {
    const report: CompressionReport = {
      total: {
        originalSize: 0,
        compressedSize: 0,
        reduction: 0,
        reductionBytes: 0,
        totalTime: 0,
      },
    };

    if (params.context && params.contextRoot) {
      const stats = this.contextCompressor.estimate(params.context, params.contextRoot);
      report.context = stats;
      report.total.originalSize += stats.originalSize;
      report.total.compressedSize += stats.compressedSize;
    }

    if (params.history) {
      const stats = this.historySummarizer.estimate(params.history);
      report.history = stats;
      report.total.originalSize += stats.originalSize;
      report.total.compressedSize += stats.compressedSize;
    }

    if (params.files && params.files.size > 0) {
      // Estimate for files (assume 50% reduction)
      const originalSize = Array.from(params.files.values()).join('').length;
      const estimatedCompressed = originalSize * 0.5;
      report.content = {
        originalSize,
        compressedSize: estimatedCompressed,
        reduction: 50,
        reductionBytes: originalSize - estimatedCompressed,
        compressionTime: 0,
      };
      report.total.originalSize += originalSize;
      report.total.compressedSize += estimatedCompressed;
    }

    report.total.reduction =
      ((report.total.originalSize - report.total.compressedSize) /
        report.total.originalSize) * 100;
    report.total.reductionBytes =
      report.total.originalSize - report.total.compressedSize;

    return report;
  }

  /**
   * Print compression report
   */
  printReport(report: CompressionReport): void {
    console.log(chalk.cyan('\n📊 Token Compression Report'));
    console.log(chalk.cyan('===') + chalk.gray(` (${report.total.totalTime}ms)`));

    if (report.context) {
      console.log(chalk.blue('\nContext Compression:'));
      console.log(chalk.gray(`  Original: ${this.formatSize(report.context.originalSize)}`));
      console.log(chalk.gray(`  Compressed: ${this.formatSize(report.context.compressedSize)}`));
      console.log(
        chalk.green(
          `  Saved: ${report.context.reduction.toFixed(1)}% (${this.formatSize(report.context.reductionBytes)})`
        )
      );
    }

    if (report.history) {
      console.log(chalk.blue('\nHistory Summarization:'));
      console.log(chalk.gray(`  Original: ${this.formatSize(report.history.originalSize)}`));
      console.log(chalk.gray(`  Compressed: ${this.formatSize(report.history.compressedSize)}`));
      console.log(
        chalk.green(
          `  Saved: ${report.history.reduction.toFixed(1)}% (${this.formatSize(report.history.reductionBytes)})`
        )
      );
    }

    if (report.content) {
      console.log(chalk.blue('\nContent Optimization:'));
      console.log(chalk.gray(`  Original: ${this.formatSize(report.content.originalSize)}`));
      console.log(chalk.gray(`  Compressed: ${this.formatSize(report.content.compressedSize)}`));
      console.log(
        chalk.green(
          `  Saved: ${report.content.reduction.toFixed(1)}% (${this.formatSize(report.content.reductionBytes)})`
        )
      );
    }

    console.log(chalk.cyan('\n' + '==='));
    console.log(chalk.gray(`Total Original: ${this.formatSize(report.total.originalSize)}`));
    console.log(chalk.gray(`Total Compressed: ${this.formatSize(report.total.compressedSize)}`));
    console.log(
      chalk.green.bold(
        `Total Saved: ${report.total.reduction.toFixed(1)}% (${this.formatSize(report.total.reductionBytes)})`
      )
    );
    console.log(chalk.cyan('===\n'));
  }

  /**
   * Format size for display
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * Get context compressor
   */
  getContextCompressor(): ContextCompressor {
    return this.contextCompressor;
  }

  /**
   * Get history summarizer
   */
  getHistorySummarizer(): HistorySummarizer {
    return this.historySummarizer;
  }

  /**
   * Get content optimizer
   */
  getContentOptimizer(): ContentOptimizer {
    return this.contentOptimizer;
  }

  /**
   * Get incremental tracker
   */
  getIncrementalTracker(): IncrementalTracker {
    return this.incrementalTracker;
  }
}

// Export all types and classes
export * from './types';
export { ContextCompressor } from './context';
export { HistorySummarizer } from './history';
export { ContentOptimizer } from './content';
export { IncrementalTracker } from './incremental';
