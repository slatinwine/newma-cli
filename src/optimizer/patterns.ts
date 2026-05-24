// src/optimizer/patterns.ts
/**
 * Pattern Analyzer
 * Identifies successful patterns and best practices
 */

import { ExecutionRecord } from '../history';

/**
 * Pattern analyzer class
 */
export class PatternAnalyzer {
  private history: ExecutionRecord[] = [];

  /**
   * Add execution record
   */
  addRecord(record: ExecutionRecord): void {
    this.history.push(record);
  }

  /**
   * Identify successful patterns
   */
  identifySuccessfulPatterns(): Pattern[] {
    const patterns: Pattern[] = [];

    // Pattern 1: Successful task sequences
    patterns.push(...this.analyzeTaskSequences());

    // Pattern 2: High-success operations
    patterns.push(...this.analyzeHighSuccessOperations());

    // Pattern 3: Fast operations
    patterns.push(...this.analyzeFastOperations());

    // Pattern 4: Reliable agents
    patterns.push(...this.analyzeReliableAgents());

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Analyze task sequences that lead to success
   */
  private analyzeTaskSequences(): Pattern[] {
    const patterns: Pattern[] = [];

    // Find successful sequences of 3+ tasks
    for (let i = 0; i < this.history.length - 2; i++) {
      const seq1 = this.history[i];
      const seq2 = this.history[i + 1];
      const seq3 = this.history[i + 2];

      if (
        seq1.status === 'success' &&
        seq2.status === 'success' &&
        seq3.status === 'success'
      ) {
        const sequence = `${seq1.action.type} → ${seq2.action.type} → ${seq3.action.type}`;

        patterns.push({
          type: 'task_sequence',
          description: `Successful sequence: ${sequence}`,
          confidence: this.calculateConfidence([seq1, seq2, seq3]),
          recommendation: `Follow this sequence for similar tasks`,
          example: {
            tasks: [
              { type: seq1.action.type, description: seq1.action.description },
              { type: seq2.action.type, description: seq2.action.description },
              { type: seq3.action.type, description: seq3.action.description },
            ],
          },
        });
      }
    }

    return patterns;
  }

  /**
   * Analyze operations with high success rate
   */
  private analyzeHighSuccessOperations(): Pattern[] {
    const patterns: Pattern[] = [];

    // Group by action type
    const actionGroups = new Map<string, ExecutionRecord[]>();
    for (const record of this.history) {
      const type = record.action.type;
      if (!actionGroups.has(type)) {
        actionGroups.set(type, []);
      }
      actionGroups.get(type)!.push(record);
    }

    // Find high-success operations
    for (const [actionType, records] of actionGroups) {
      if (records.length < 3) continue; // Need minimum sample size

      const successCount = records.filter(r => r.status === 'success').length;
      const successRate = successCount / records.length;

      if (successRate >= 0.9) {
        patterns.push({
          type: 'high_success_operation',
          description: `${actionType} has ${(successRate * 100).toFixed(0)}% success rate`,
          confidence: successRate,
          recommendation: `Prefer ${actionType} operations when possible`,
          example: {
            operation: actionType,
            successRate: successRate,
            sampleSize: records.length,
          },
        });
      }
    }

    return patterns;
  }

  /**
   * Analyze fast operations
   */
  private analyzeFastOperations(): Pattern[] {
    const patterns: Pattern[] = [];

    // Calculate average duration per action type
    const actionDurations = new Map<string, number[]>();
    for (const record of this.history) {
      const type = record.action.type;
      if (!actionDurations.has(type)) {
        actionDurations.set(type, []);
      }
      actionDurations.get(type)!.push(record.duration);
    }

    // Find fast operations (< 1s average)
    for (const [actionType, durations] of actionDurations) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;

      if (avg < 1000 && durations.length >= 3) {
        patterns.push({
          type: 'fast_operation',
          description: `${actionType} is fast (${avg.toFixed(0)}ms average)`,
          confidence: 0.9,
          recommendation: `Use ${actionType} for time-critical tasks`,
          example: {
            operation: actionType,
            averageDuration: avg,
          },
        });
      }
    }

    return patterns;
  }

  /**
   * Analyze reliable agents
   */
  private analyzeReliableAgents(): Pattern[] {
    // This would be populated with actual agent data
    // For now, return placeholder
    return [];
  }

  /**
   * Calculate pattern confidence
   */
  private calculateConfidence(records: ExecutionRecord[]): number {
    const successCount = records.filter(r => r.status === 'success').length;
    return records.length > 0 ? successCount / records.length : 0;
  }

  /**
   * Get patterns by type
   */
  getPatternsByType(type: string): Pattern[] {
    return this.identifySuccessfulPatterns().filter(p => p.type === type);
  }

  /**
   * Get top patterns
   */
  getTopPatterns(limit: number = 5): Pattern[] {
    return this.identifySuccessfulPatterns().slice(0, limit);
  }
}

/**
 * Pattern interface
 */
export interface Pattern {
  type: string;
  description: string;
  confidence: number; // 0-1
  recommendation: string;
  example: any;
}
