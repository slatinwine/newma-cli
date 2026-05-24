// src/self-healing/detector.ts
/**
 * Issue detection engine
 * Analyzes errors and execution history to identify patterns and issues
 */

import { ExecutionRecord } from '../history';
import { KodeError, ErrorCode } from '../errors';
import { IssuePattern, IssueCategory, DiagnosisResult, IssueSeverity, SuggestedAction } from './types';
import { ToolCall, ToolResult } from '../tools/types';

/**
 * Issue detector class
 * Analyzes execution history and errors to identify recurring patterns
 */
export class IssueDetector {
  private patterns: Map<string, IssuePattern> = new Map();
  private executionHistory: ExecutionRecord[] = [];
  private errorHistory: Array<{ error: KodeError; timestamp: Date; context?: unknown }> = [];

  /**
   * Add execution record to history
   */
  addExecution(record: ExecutionRecord): void {
    this.executionHistory.push(record);
    this.analyzeExecution(record);
  }

  /**
   * Add error to history
   */
  addError(error: KodeError, context?: unknown): void {
    const errorEntry = {
      error,
      timestamp: new Date(),
      context,
    };
    this.errorHistory.push(errorEntry);
    this.analyzeError(errorEntry);
  }

  /**
   * Analyze an execution record for issues
   */
  private analyzeExecution(record: ExecutionRecord): void {
    // Check for failed tool executions
    if (record.status !== 'success') {
      this.detectFailurePattern(record);
    }

    // Check for slow operations (performance issues)
    if (record.duration && record.duration > 10000) { // 10 seconds
      this.detectPerformancePattern(record);
    }

    // Check for repeated patterns
    this.detectRepeatingPatterns(record);
  }

  /**
   * Analyze an error for patterns
   */
  private analyzeError(errorEntry: { error: KodeError; timestamp: Date; context?: unknown }): void {
    const { error, timestamp } = errorEntry;

    // Create or update pattern based on error code
    const patternId = `error_${error.code}_${this.getErrorSignature(error)}`;

    const existingPattern = this.patterns.get(patternId);

    if (existingPattern) {
      existingPattern.frequency++;
      existingPattern.lastOccurrence = timestamp;
    } else {
      const newPattern: IssuePattern = {
        id: patternId,
        category: this.categorizeError(error),
        errorCode: error.code,
        pattern: this.getErrorSignature(error),
        frequency: 1,
        lastOccurrence: timestamp,
        suggestedFix: this.generateSuggestedFix(error),
      };

      this.patterns.set(patternId, newPattern);
    }
  }

  /**
   * Detect failure patterns in execution records
   */
  private detectFailurePattern(record: ExecutionRecord): void {
    const action = record.action;

    // Check if this is a tool failure
    if (action.type === 'run' || action.type === 'create' || action.type === 'modify') {
      const patternId = `tool_failure_${action.type}`;

      const existingPattern = this.patterns.get(patternId);

      const failurePattern: IssuePattern = existingPattern || {
        id: patternId,
        category: IssueCategory.TOOL_ERROR,
        pattern: `Failed ${action.type} operation`,
        frequency: 0,
        lastOccurrence: new Date(),
      };

      failurePattern.frequency++;
      failurePattern.lastOccurrence = new Date();
      this.patterns.set(patternId, failurePattern);
    }
  }

  /**
   * Detect performance patterns
   */
  private detectPerformancePattern(record: ExecutionRecord): void {
    const patternId = `performance_slow_${record.action.type}`;

    const existingPattern = this.patterns.get(patternId);

    const performancePattern: IssuePattern = existingPattern || {
      id: patternId,
      category: IssueCategory.PERFORMANCE,
      pattern: `Slow ${record.action.type} operation (>10s)`,
      frequency: 0,
      lastOccurrence: new Date(),
    };

    performancePattern.frequency++;
    performancePattern.lastOccurrence = new Date();
    this.patterns.set(patternId, performancePattern);
  }

  /**
   * Detect repeating patterns (same command failing multiple times)
   */
  private detectRepeatingPatterns(record: ExecutionRecord): void {
    // Find similar recent executions
    const recentSimilar = this.executionHistory.filter(
      r =>
        r !== record &&
        JSON.stringify(r.action) === JSON.stringify(record.action) &&
        r.status !== 'success'
    );

    if (recentSimilar.length >= 2) { // Same command failed 2+ times
      const patternId = `repeating_failure_${this.getActionSignature(record.action)}`;

      const existingPattern = this.patterns.get(patternId);

      const repeatingPattern: IssuePattern = existingPattern || {
        id: patternId,
        category: IssueCategory.EXECUTION_ERROR,
        pattern: `Repeating failure: ${this.getActionSignature(record.action)}`,
        frequency: recentSimilar.length,
        lastOccurrence: new Date(),
        suggestedFix: 'Consider creating a specialized tool to handle this operation',
      };

      repeatingPattern.frequency++;
      repeatingPattern.lastOccurrence = new Date();
      this.patterns.set(patternId, repeatingPattern);
    }
  }

  /**
   * Diagnose a specific issue
   */
  async diagnoseIssue(issue: string): Promise<DiagnosisResult> {
    // Find matching patterns
    const matchingPatterns = Array.from(this.patterns.values()).filter(
      p => issue.toLowerCase().includes(p.pattern.toLowerCase()) ||
           p.pattern.toLowerCase().includes(issue.toLowerCase())
    );

    if (matchingPatterns.length === 0) {
      return {
        issue,
        category: IssueCategory.UNKNOWN,
        severity: IssueSeverity.LOW,
        rootCause: 'Unknown - no matching patterns found',
        suggestedActions: [],
        canAutoFix: false,
        confidence: 0,
      };
    }

    // Use the most frequent matching pattern
    const pattern = matchingPatterns.sort((a, b) => b.frequency - a.frequency)[0];

    return {
      issue,
      category: pattern.category,
      severity: this.assessSeverity(pattern),
      rootCause: this.inferRootCause(pattern),
      suggestedActions: this.generateSuggestedActions(pattern),
      canAutoFix: this.canAutoFix(pattern),
      confidence: Math.min(pattern.frequency / 5, 1), // More frequent = higher confidence
    };
  }

  /**
   * Get all detected patterns
   */
  getPatterns(): IssuePattern[] {
    return Array.from(this.patterns.values()).sort(
      (a, b) => b.frequency - a.frequency
    );
  }

  /**
   * Get patterns by category
   */
  getPatternsByCategory(category: IssueCategory): IssuePattern[] {
    return this.getPatterns().filter(p => p.category === category);
  }

  /**
   * Get high-frequency patterns (potential tool candidates)
   */
  getHighFrequencyPatterns(threshold: number = 3): IssuePattern[] {
    return this.getPatterns().filter(p => p.frequency >= threshold);
  }

  /**
   * Helper: Get error signature for pattern matching
   */
  private getErrorSignature(error: KodeError): string {
    // Extract key information from error
    const message = error.message.toLowerCase();
    const code = error.code;

    // Common patterns
    if (message.includes('enoent') || message.includes('not found')) {
      return 'file_not_found';
    }
    if (message.includes('eacces') || message.includes('permission')) {
      return 'permission_denied';
    }
    if (message.includes('timeout')) {
      return 'timeout';
    }
    if (message.includes('network') || message.includes('connection')) {
      return 'network_error';
    }

    return `${code}_${message.split(' ').slice(0, 3).join('_')}`;
  }

  /**
   * Helper: Get action signature for pattern matching
   */
  private getActionSignature(action: any): string {
    if (action.type === 'run') {
      return `command:${action.command.split(' ')[0]}`;
    }
    if (action.type === 'create' || action.type === 'modify') {
      return `file:${action.path}`;
    }
    return `${action.type}:unknown`;
  }

  /**
   * Helper: Categorize error
   */
  private categorizeError(error: KodeError): IssueCategory {
    const message = error.message.toLowerCase();

    if (message.includes('api') || message.includes('fetch') || message.includes('network')) {
      return IssueCategory.API_FAILURE;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return IssueCategory.VALIDATION_ERROR;
    }
    if (message.includes('command') || message.includes('execution')) {
      return IssueCategory.EXECUTION_ERROR;
    }

    return IssueCategory.TOOL_ERROR;
  }

  /**
   * Helper: Assess severity based on pattern
   */
  private assessSeverity(pattern: IssuePattern): IssueSeverity {
    if (pattern.frequency >= 10) {
      return IssueSeverity.CRITICAL;
    }
    if (pattern.frequency >= 5) {
      return IssueSeverity.HIGH;
    }
    if (pattern.frequency >= 3) {
      return IssueSeverity.MEDIUM;
    }
    return IssueSeverity.LOW;
  }

  /**
   * Helper: Infer root cause from pattern
   */
  private inferRootCause(pattern: IssuePattern): string {
    switch (pattern.category) {
      case IssueCategory.API_FAILURE:
        return 'Network connectivity or API endpoint issue';
      case IssueCategory.TOOL_ERROR:
        return 'Tool may be missing or improperly configured';
      case IssueCategory.EXECUTION_ERROR:
        return 'Command execution failing due to environment or dependency issues';
      case IssueCategory.VALIDATION_ERROR:
        return 'Input validation or type mismatch';
      case IssueCategory.PERFORMANCE:
        return 'Inefficient algorithm or resource bottleneck';
      default:
        return 'Unknown cause - requires investigation';
    }
  }

  /**
   * Helper: Generate suggested fix
   */
  private generateSuggestedFix(error: KodeError): string {
    switch (error.code) {
      case ErrorCode.FILE_NOT_FOUND:
        return 'Check file path or create file if missing';
      case ErrorCode.PERMISSION_DENIED:
        return 'Check file permissions or run with appropriate access level';
      case ErrorCode.API_TIMEOUT:
        return 'Increase timeout or check network connectivity';
      case ErrorCode.API_RATE_LIMIT:
        return 'Implement rate limiting or add delays between requests';
      default:
        return 'Review error details and consider implementing retry logic';
    }
  }

  /**
   * Helper: Generate suggested actions
   */
  private generateSuggestedActions(pattern: IssuePattern): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    // Suggest tool creation for high-frequency patterns
    if (pattern.frequency >= 3) {
      actions.push({
        type: 'create_tool',
        description: `Create specialized tool to handle: ${pattern.pattern}`,
        priority: Math.min(pattern.frequency / 10, 1),
        requiresConfirmation: true,
        estimatedRisk: 'low',
      });
    }

    // Add pattern-specific suggestions
    switch (pattern.category) {
      case IssueCategory.API_FAILURE:
        actions.push({
          type: 'modify_code',
          description: 'Add retry logic with exponential backoff',
          priority: 0.8,
          requiresConfirmation: false,
          estimatedRisk: 'low',
        });
        break;
      case IssueCategory.PERFORMANCE:
        actions.push({
          type: 'modify_code',
          description: 'Optimize algorithm or add caching',
          priority: 0.7,
          requiresConfirmation: false,
          estimatedRisk: 'medium',
        });
        break;
    }

    return actions;
  }

  /**
   * Helper: Check if issue can be auto-fixed
   */
  private canAutoFix(pattern: IssuePattern): boolean {
    // Only auto-fix low-risk, high-confidence patterns
    return (
      pattern.category === IssueCategory.VALIDATION_ERROR ||
      pattern.category === IssueCategory.PERFORMANCE
    ) && pattern.frequency >= 5;
  }

  /**
   * Clear old patterns (for cleanup)
   */
  clearOldPatterns(daysToKeep: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    for (const [id, pattern] of this.patterns.entries()) {
      if (pattern.lastOccurrence < cutoffDate) {
        this.patterns.delete(id);
      }
    }
  }
}
