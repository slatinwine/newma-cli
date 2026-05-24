// src/optimizer/metrics.ts
/**
 * Performance Metrics Collector
 * Collects and analyzes execution metrics
 */

import { ExecutionRecord } from '../history';
import { OptimizationMetrics, AgentMetrics, ErrorPattern, OptimizationSuggestion } from './types';

/**
 * Metrics collector class
 */
export class MetricsCollector {
  private history: ExecutionRecord[] = [];
  private learningData: Map<string, any[]> = new Map();

  /**
   * Add execution record to history
   */
  addRecord(record: ExecutionRecord): void {
    this.history.push(record);

    // Extract learning data
    const learningKey = `${record.action.type}`;
    if (!this.learningData.has(learningKey)) {
      this.learningData.set(learningKey, []);
    }
    this.learningData.get(learningKey)!.push({
      timestamp: record.timestamp,
      action: record.action.type,
      status: record.status,
      duration: record.duration,
      error: record.error,
    });
  }

  /**
   * Calculate optimization metrics
   */
  calculateMetrics(): OptimizationMetrics {
    const totalTasks = this.history.length;
    const successfulTasks = this.history.filter(r => r.status === 'success').length;
    const failedTasks = this.history.filter(r => r.status === 'failed').length;
    const successRate = totalTasks > 0 ? successfulTasks / totalTasks : 0;

    // Agent performance
    const agentPerformance = this.calculateAgentMetrics();

    // Timing metrics
    const timingMetrics = this.calculateTimingMetrics();

    // Error patterns
    const commonErrors = this.analyzeErrorPatterns();

    // Generate suggestions
    const suggestions = this.generateSuggestions({
      totalTasks,
      successfulTasks,
      failedTasks,
      successRate,
      agentPerformance,
      averageExecutionTime: timingMetrics.averageTime,
      fastestAgent: timingMetrics.fastestAgent,
      slowestAgent: timingMetrics.slowestAgent,
      commonErrors,
      suggestions: [],
    });

    return {
      totalTasks,
      successfulTasks,
      failedTasks,
      successRate,
      agentPerformance,
      averageExecutionTime: timingMetrics.averageTime,
      fastestAgent: timingMetrics.fastestAgent,
      slowestAgent: timingMetrics.slowestAgent,
      commonErrors,
      suggestions,
    };
  }

  /**
   * Calculate per-agent metrics
   */
  private calculateAgentMetrics(): Map<string, AgentMetrics> {
    const agentMetrics = new Map<string, AgentMetrics>();

    // Group by agent (action type as proxy for agent)
    const agentGroups = new Map<string, ExecutionRecord[]>();
    for (const record of this.history) {
      const agentId = record.action.type || 'unknown';
      if (!agentGroups.has(agentId)) {
        agentGroups.set(agentId, []);
      }
      agentGroups.get(agentId)!.push(record);
    }

    // Calculate metrics for each agent
    for (const [agentId, records] of agentGroups) {
      const completed = records.length;
      const succeeded = records.filter(r => r.status === 'success').length;
      const failed = records.filter(r => r.status === 'failed').length;
      const successRate = completed > 0 ? succeeded / completed : 0;

      const durations = records.map(r => r.duration);
      const averageTime = durations.reduce((a, b) => a + b, 0) / durations.length;
      const fastestTask = Math.min(...durations);
      const slowestTask = Math.max(...durations);

      const commonErrors = records
        .filter(r => r.error)
        .map(r => r.error!)
        .slice(0, 5); // Top 5 errors

      agentMetrics.set(agentId, {
        agentId,
        agentName: this.getAgentName(agentId),
        tasksCompleted: completed,
        tasksSucceeded: succeeded,
        tasksFailed: failed,
        successRate,
        averageTime,
        fastestTask,
        slowestTask,
        commonErrors,
      });
    }

    return agentMetrics;
  }

  /**
   * Calculate timing metrics
   */
  private calculateTimingMetrics(): {
    averageTime: number;
    fastestAgent: string;
    slowestAgent: string;
  } {
    if (this.history.length === 0) {
      return { averageTime: 0, fastestAgent: 'none', slowestAgent: 'none' };
    }

    const durations = this.history.map(r => r.duration);
    const averageTime = durations.reduce((a, b) => a + b, 0) / durations.length;

    // Calculate by agent
    const agentTimes = new Map<string, number[]>();
    for (const record of this.history) {
      const agentId = record.action.type || 'unknown';
      if (!agentTimes.has(agentId)) {
        agentTimes.set(agentId, []);
      }
      agentTimes.get(agentId)!.push(record.duration);
    }

    let fastestAgent = 'none';
    let slowestAgent = 'none';
    let fastestAvg = Infinity;
    let slowestAvg = 0;

    for (const [agentId, times] of agentTimes) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      if (avg < fastestAvg) {
        fastestAvg = avg;
        fastestAgent = this.getAgentName(agentId);
      }
      if (avg > slowestAvg) {
        slowestAvg = avg;
        slowestAgent = this.getAgentName(agentId);
      }
    }

    return { averageTime, fastestAgent, slowestAgent };
  }

  /**
   * Analyze error patterns
   */
  private analyzeErrorPatterns(): ErrorPattern[] {
    const errorCounts = new Map<string, { count: number; lastSeen: number }>();

    for (const record of this.history) {
      if (record.error) {
        const errorKey = this.categorizeError(record.error);
        if (!errorCounts.has(errorKey)) {
          errorCounts.set(errorKey, { count: 0, lastSeen: 0 });
        }
        const data = errorCounts.get(errorKey)!;
        data.count++;
        data.lastSeen = Math.max(data.lastSeen, record.timestamp.getTime());
      }
    }

    // Convert to array and sort by frequency
    const patterns: ErrorPattern[] = [];
    for (const [type, data] of errorCounts) {
      patterns.push({
        type,
        frequency: data.count,
        lastOccurred: data.lastSeen,
        suggestedFix: this.getSuggestedFix(type),
      });
    }

    return patterns.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Generate optimization suggestions
   */
  private generateSuggestions(metrics: OptimizationMetrics): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Success rate suggestions
    if (metrics.successRate < 0.8) {
      suggestions.push({
        priority: 'high',
        category: 'reliability',
        description: `Low success rate detected (${(metrics.successRate * 100).toFixed(1)}%)`,
        action: 'Review and fix common error patterns',
        expectedImprovement: 'Increase success rate to 90%+',
      });
    }

    // Performance suggestions
    if (metrics.averageExecutionTime > 5000) {
      suggestions.push({
        priority: 'medium',
        category: 'performance',
        description: `Slow average execution time (${metrics.averageExecutionTime.toFixed(0)}ms)`,
        action: 'Optimize slow operations or use parallel execution',
        expectedImprovement: 'Reduce execution time by 30%',
      });
    }

    // Agent-specific suggestions
    for (const [agentId, agentMetrics] of metrics.agentPerformance) {
      if (agentMetrics.successRate < 0.7) {
        suggestions.push({
          priority: 'high',
          category: 'reliability',
          description: `${agentMetrics.agentName} has low success rate (${(agentMetrics.successRate * 100).toFixed(1)}%)`,
          action: `Review ${agentMetrics.agentName} implementation and error handling`,
          expectedImprovement: `Improve ${agentMetrics.agentName} reliability`,
        });
      }

      if (agentMetrics.averageTime > metrics.averageExecutionTime * 1.5) {
        suggestions.push({
          priority: 'medium',
          category: 'performance',
          description: `${agentMetrics.agentName} is slower than average`,
          action: 'Optimize agent execution or use caching',
          expectedImprovement: 'Reduce agent execution time',
        });
      }
    }

    // Error pattern suggestions
    for (const error of metrics.commonErrors.slice(0, 3)) {
      suggestions.push({
        priority: error.frequency > 5 ? 'high' : 'medium',
        category: 'quality',
        description: `Frequent error: ${error.type}`,
        action: error.suggestedFix || 'Review error handling',
        expectedImprovement: `Reduce ${error.type} errors`,
      });
    }

    return suggestions;
  }

  /**
   * Categorize error
   */
  private categorizeError(error: string): string {
    if (error.includes('ENOENT') || error.includes('file not found')) {
      return 'FileNotFound';
    }
    if (error.includes('permission') || error.includes('denied')) {
      return 'PermissionError';
    }
    if (error.includes('timeout') || error.includes('ETIMEDOUT')) {
      return 'Timeout';
    }
    if (error.includes('API') || error.includes('fetch')) {
      return 'APIError';
    }
    return 'OtherError';
  }

  /**
   * Get suggested fix for error type
   */
  private getSuggestedFix(errorType: string): string | undefined {
    const fixes: Record<string, string> = {
      FileNotFound: 'Check file paths before operations',
      PermissionError: 'Verify permissions or use appropriate permission level',
      Timeout: 'Increase timeout or optimize operation',
      APIError: 'Implement retry logic with exponential backoff',
    };
    return fixes[errorType];
  }

  /**
   * Get friendly agent name
   */
  private getAgentName(agentId: string): string {
    const names: Record<string, string> = {
      create: 'File Creation Agent',
      modify: 'File Modification Agent',
      delete: 'File Deletion Agent',
      run: 'Command Execution Agent',
      verify: 'Verification Agent',
    };
    return names[agentId] || agentId;
  }

  /**
   * Get learning data for a specific key
   */
  getLearningData(key: string): any[] {
    return this.learningData.get(key) || [];
  }

  /**
   * Get all learning data
   */
  getAllLearningData(): Map<string, any[]> {
    return this.learningData;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    this.learningData.clear();
  }
}
