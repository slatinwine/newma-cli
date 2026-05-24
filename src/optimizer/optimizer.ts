// src/optimizer/optimizer.ts
/**
 * Self-Optimizer
 * Analyzes performance and suggests improvements
 */

import { MetricsCollector } from './metrics';
import { PatternAnalyzer, Pattern } from './patterns';
import { ExecutionRecord } from '../history';
import { OptimizationMetrics, OptimizationSuggestion } from './types';

/**
 * Self-optimizer class
 */
export class SelfOptimizer {
  private metricsCollector: MetricsCollector;
  private patternAnalyzer: PatternAnalyzer;
  private baseline: PerformanceBaseline | null = null;

  constructor() {
    this.metricsCollector = new MetricsCollector();
    this.patternAnalyzer = new PatternAnalyzer();
  }

  /**
   * Add execution record for analysis
   */
  recordExecution(record: ExecutionRecord): void {
    this.metricsCollector.addRecord(record);
    this.patternAnalyzer.addRecord(record);
  }

  /**
   * Analyze and optimize
   */
  analyzeAndOptimize(): OptimizationReport {
    // Collect metrics
    const metrics = this.metricsCollector.calculateMetrics();

    // Identify patterns
    const patterns = this.patternAnalyzer.identifySuccessfulPatterns();

    // Generate optimization report
    const report = this.generateReport(metrics, patterns);

    return report;
  }

  /**
   * Get current metrics
   */
  getMetrics(): OptimizationMetrics {
    return this.metricsCollector.calculateMetrics();
  }

  /**
   * Get identified patterns
   */
  getPatterns(): Pattern[] {
    return this.patternAnalyzer.identifySuccessfulPatterns();
  }

  /**
   * Get optimization suggestions
   */
  getSuggestions(): OptimizationSuggestion[] {
    const metrics = this.metricsCollector.calculateMetrics();
    return metrics.suggestions;
  }

  /**
   * Apply optimizations automatically
   */
  applyOptimizations(): AppliedOptimizations {
    const report = this.analyzeAndOptimize();
    const applied: AppliedOptimizations = {
      appliedSuggestions: [],
      skippedSuggestions: [],
    };

    // Apply high-priority suggestions automatically
    for (const suggestion of report.suggestions.filter(s => s.priority === 'high')) {
      if (this.canApplyAutomatically(suggestion)) {
        this.applySuggestion(suggestion);
        applied.appliedSuggestions.push(suggestion);
      } else {
        applied.skippedSuggestions.push({
          suggestion,
          reason: 'Requires manual intervention',
        });
      }
    }

    return applied;
  }

  /**
   * Establish performance baseline
   */
  establishBaseline(): PerformanceBaseline {
    const metrics = this.metricsCollector.calculateMetrics();

    this.baseline = {
      averageSuccessRate: metrics.successRate,
      averageExecutionTime: metrics.averageExecutionTime,
      averageErrorsPerTask: metrics.failedTasks / Math.max(metrics.totalTasks, 1),
      establishedAt: Date.now(),
    };

    return this.baseline;
  }

  /**
   * Compare with baseline
   */
  compareToBaseline(): ComparisonResult {
    if (!this.baseline) {
      throw new Error('No baseline established');
    }

    const current = this.metricsCollector.calculateMetrics();

    return {
      successRateChange: current.successRate - this.baseline.averageSuccessRate,
      executionTimeChange: current.averageExecutionTime - this.baseline.averageExecutionTime,
      errorRateChange: (current.failedTasks / Math.max(current.totalTasks, 1)) - this.baseline.averageErrorsPerTask,
      improved: current.successRate > this.baseline.averageSuccessRate &&
                 current.averageExecutionTime < this.baseline.averageExecutionTime,
    };
  }

  /**
   * Generate optimization report
   */
  private generateReport(metrics: OptimizationMetrics, patterns: Pattern[]): OptimizationReport {
    return {
      timestamp: Date.now(),
      metrics,
      patterns: patterns.slice(0, 5), // Top 5 patterns
      suggestions: metrics.suggestions,
      overallHealth: this.calculateOverallHealth(metrics),
      summary: this.generateSummary(metrics),
    };
  }

  /**
   * Calculate overall health score
   */
  private calculateOverallHealth(metrics: OptimizationMetrics): HealthScore {
    let score = 100;
    const issues: string[] = [];

    // Success rate impact
    if (metrics.successRate < 0.5) {
      score -= 30;
      issues.push('Critical: Success rate below 50%');
    } else if (metrics.successRate < 0.7) {
      score -= 20;
      issues.push('Warning: Success rate below 70%');
    } else if (metrics.successRate < 0.9) {
      score -= 10;
      issues.push('Note: Success rate below 90%');
    }

    // Performance impact
    if (metrics.averageExecutionTime > 10000) {
      score -= 20;
      issues.push('Slow average execution time (>10s)');
    } else if (metrics.averageExecutionTime > 5000) {
      score -= 10;
      issues.push('Moderate execution time (>5s)');
    }

    // Error impact
    if (metrics.commonErrors.length > 10) {
      score -= 20;
      issues.push('Many different error types detected');
    } else if (metrics.commonErrors.length > 5) {
      score -= 10;
      issues.push('Several error patterns detected');
    }

    return {
      score: Math.max(0, score),
      level: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor',
      issues,
    };
  }

  /**
   * Generate summary
   */
  private generateSummary(metrics: OptimizationMetrics): string {
    const health = this.calculateOverallHealth(metrics);
    return `
Overall Health: ${health.level.toUpperCase()} (${health.score}/100)

Total Tasks: ${metrics.totalTasks}
Success Rate: ${(metrics.successRate * 100).toFixed(1)}%
Average Time: ${metrics.averageExecutionTime.toFixed(0)}ms

Top Suggestions: ${metrics.suggestions.slice(0, 3).map(s => s.description).join(', ')}
    `.trim();
  }

  /**
   * Check if suggestion can be applied automatically
   */
  private canApplyAutomatically(suggestion: OptimizationSuggestion): boolean {
    // For now, only apply certain types automatically
    const autoApplicableCategories = ['performance'];
    return autoApplicableCategories.includes(suggestion.category);
  }

  /**
   * Apply a single suggestion
   */
  private applySuggestion(suggestion: OptimizationSuggestion): void {
    // Implementation would depend on suggestion type
    // For now, this is a placeholder
    console.log(`[AUTO-OPTIMIZE] Applying: ${suggestion.description}`);
  }

  /**
   * Export learning data
   */
  exportLearningData(): string {
    const data = {
      timestamp: Date.now(),
      metrics: this.metricsCollector.calculateMetrics(),
      patterns: this.patternAnalyzer.getTopPatterns(10),
      baseline: this.baseline,
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Clear all collected data
   */
  clear(): void {
    this.metricsCollector.clearHistory();
    // Pattern analyzer doesn't have clear, but we could add one
    this.baseline = null;
  }
}

/**
 * Optimization report
 */
export interface OptimizationReport {
  timestamp: number;
  metrics: OptimizationMetrics;
  patterns: Pattern[];
  suggestions: OptimizationSuggestion[];
  overallHealth: HealthScore;
  summary: string;
}

/**
 * Health score
 */
export interface HealthScore {
  score: number; // 0-100
  level: 'excellent' | 'good' | 'fair' | 'poor';
  issues: string[];
}

/**
 * Performance baseline
 */
interface PerformanceBaseline {
  averageSuccessRate: number;
  averageExecutionTime: number;
  averageErrorsPerTask: number;
  establishedAt: number;
}

/**
 * Comparison result
 */
interface ComparisonResult {
  successRateChange: number;
  executionTimeChange: number;
  errorRateChange: number;
  improved: boolean;
}

/**
 * Applied optimizations
 */
export interface AppliedOptimizations {
  appliedSuggestions: OptimizationSuggestion[];
  skippedSuggestions: Array<{
    suggestion: OptimizationSuggestion;
    reason: string;
  }>;
}
