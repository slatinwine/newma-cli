/**
 * Observation Extraction and Formatting
 *
 * Utilities for extracting and formatting observations from
 * action execution results for use in ReAct loops.
 */

import { Action } from '../types';
import { ExecutionRecord } from '../history';

// ============================================================================
// OBSERVATION TYPES
// ============================================================================

/**
 * Structured observation from action execution
 */
export interface ActionObservation {
  success: boolean;
  actionType: string;
  target: string; // file path or command
  output: string;
  error?: string;
  metadata: ObservationMetadata;
}

/**
 * Metadata for observation
 */
export interface ObservationMetadata {
  timestamp: number;
  executionTime: number;
  changedFiles?: string[];
  testResults?: TestResults;
  errors?: ErrorInfo[];
}

/**
 * Test results from verification
 */
export interface TestResults {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  failures: string[];
}

/**
 * Error information
 */
export interface ErrorInfo {
  type: string;
  message: string;
  stack?: string;
  location?: string;
}

// ============================================================================
// OBSERVATION EXTRACTOR
// ============================================================================

export class ObservationExtractor {
  /**
   * Extract observation from action execution result
   */
  static extractFromActionResult(
    action: Action,
    result: any
  ): ActionObservation {
    const success = result.success !== false;
    const metadata: ObservationMetadata = {
      timestamp: Date.now(),
      executionTime: result.duration || 0,
    };

    if (!success) {
      return {
        success: false,
        actionType: action.type,
        target: action.path || action.command || '',
        output: result.output || '',
        error: result.error || 'Action failed',
        metadata,
      };
    }

    // Extract structured data based on action type
    switch (action.type) {
      case 'create':
        return this.extractFromFileCreate(action, result, metadata);
      case 'modify':
        return this.extractFromFileModify(action, result, metadata);
      case 'run':
        return this.extractFromCommandRun(action, result, metadata);
      case 'verify':
        return this.extractFromVerification(action, result, metadata);
      default:
        return this.extractGeneric(action, result, metadata);
    }
  }

  /**
   * Extract observation from file creation
   */
  private static extractFromFileCreate(
    action: Action,
    result: any,
    metadata: ObservationMetadata
  ): ActionObservation {
    return {
      success: true,
      actionType: 'create',
      target: action.path || '',
      output: `File ${action.path} created successfully`,
      metadata: {
        ...metadata,
        changedFiles: [action.path || ''],
      },
    };
  }

  /**
   * Extract observation from file modification
   */
  private static extractFromFileModify(
    action: Action,
    result: any,
    metadata: ObservationMetadata
  ): ActionObservation {
    return {
      success: true,
      actionType: 'modify',
      target: action.path || '',
      output: `File ${action.path} modified successfully`,
      metadata: {
        ...metadata,
        changedFiles: [action.path || ''],
      },
    };
  }

  /**
   * Extract observation from command execution
   */
  private static extractFromCommandRun(
    action: Action,
    result: any,
    metadata: ObservationMetadata
  ): ActionObservation {
    // Check if output contains test results
    const testResults = this.parseTestResults(result.output || '');

    return {
      success: true,
      actionType: 'run',
      target: action.command || '',
      output: result.output || `Command "${action.command}" executed`,
      metadata: {
        ...metadata,
        testResults: testResults || undefined,
      },
    };
  }

  /**
   * Extract observation from verification step
   */
  private static extractFromVerification(
    action: Action,
    result: any,
    metadata: ObservationMetadata
  ): ActionObservation {
    const output = result.output || '';
    const testResults = this.parseTestResults(output);

    return {
      success: result.success !== false,
      actionType: 'verify',
      target: action.command || '',
      output: output || 'Verification completed',
      metadata: {
        ...metadata,
        testResults: testResults || undefined,
      },
    };
  }

  /**
   * Generic observation extraction
   */
  private static extractGeneric(
    action: Action,
    result: any,
    metadata: ObservationMetadata
  ): ActionObservation {
    return {
      success: true,
      actionType: action.type,
      target: action.path || action.command || '',
      output: result.output || `Action ${action.type} completed`,
      metadata,
    };
  }

  /**
   * Parse test results from output
   */
  private static parseTestResults(output: string): TestResults | null {
    // Try to find common test patterns
    // Example: "3 passing, 1 failing"
    const testPatterns = [
      /(\d+)\s+passing,\s*(\d+)\s+failing/i,
      /(\d+)\s+passed,\s*(\d+)\s+failed/i,
      /tests:\s*(\d+),\s*passed:\s*(\d+),\s*failed:\s*(\d+)/i,
    ];

    for (const pattern of testPatterns) {
      const match = output.match(pattern);
      if (match) {
        return {
          total: parseInt(match[1]) + parseInt(match[2]),
          passed: parseInt(match[1]),
          failed: parseInt(match[2]),
          skipped: 0,
          failures: [],
        };
      }
    }

    return null;
  }
}

// ============================================================================
// OBSERVATION FORMATTER
// ============================================================================

export class ObservationFormatter {
  /**
   * Format observation as human-readable text
   */
  static formatAsText(observation: ActionObservation): string {
    const lines: string[] = [];

    // Status
    const statusIcon = observation.success ? '✅' : '❌';
    lines.push(`${statusIcon} ${observation.actionType}: ${observation.target}`);

    // Output
    if (observation.output) {
      const preview = observation.output.length > 100
        ? observation.output.substring(0, 100) + '...'
        : observation.output;
      lines.push(`Output: ${preview}`);
    }

    // Error
    if (observation.error) {
      lines.push(`Error: ${observation.error}`);
    }

    // Metadata
    const metadata = observation.metadata;
    if (metadata.executionTime > 0) {
      lines.push(`Time: ${metadata.executionTime}ms`);
    }

    if (metadata.changedFiles && metadata.changedFiles.length > 0) {
      lines.push(`Changed: ${metadata.changedFiles.join(', ')}`);
    }

    if (metadata.testResults) {
      const results = metadata.testResults;
      lines.push(`Tests: ${results.passed}/${results.total} passed`);
      if (results.failed > 0) {
        lines.push(`Failed: ${results.failed} tests`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format observation as structured JSON
   */
  static formatAsJSON(observation: ActionObservation): string {
    return JSON.stringify(observation, null, 2);
  }

  /**
   * Format observation for AI consumption (compact)
   */
  static formatForAI(observation: ActionObservation): string {
    const parts: string[] = [];

    parts.push(`Action: ${observation.actionType} ${observation.target}`);
    parts.push(`Status: ${observation.success ? 'SUCCESS' : 'FAILED'}`);

    if (observation.output) {
      parts.push(`Output: ${observation.output.substring(0, 200)}`);
    }

    if (observation.error) {
      parts.push(`Error: ${observation.error}`);
    }

    if (observation.metadata.testResults) {
      const t = observation.metadata.testResults;
      parts.push(`Tests: ${t.passed}/${t.total} passed, ${t.failed} failed`);
    }

    return parts.join(' | ');
  }

  /**
   * Format multiple observations as summary
   */
  static formatSummary(observations: ActionObservation[]): string {
    if (observations.length === 0) {
      return 'No observations yet.';
    }

    const successCount = observations.filter(o => o.success).length;
    const failureCount = observations.filter(o => !o.success).length;
    const totalTime = observations.reduce((sum, o) => sum + o.metadata.executionTime, 0);

    const allChangedFiles = observations
      .map(o => o.metadata.changedFiles || [])
      .flat();

    const lines: string[] = [];
    lines.push(`OBSERVATION SUMMARY:`);
    lines.push(`Total actions: ${observations.length}`);
    lines.push(`Successful: ${successCount}`);
    lines.push(`Failed: ${failureCount}`);
    lines.push(`Total time: ${totalTime}ms`);

    if (allChangedFiles.length > 0) {
      lines.push(`Files modified: ${allChangedFiles.length}`);
    }

    return lines.join('\n');
  }
}

// ============================================================================
// OBSERVATION BUILDER
// ============================================================================

export class ObservationBuilder {
  /**
   * Build observation from execution record
   */
  static fromExecutionRecord(record: ExecutionRecord): ActionObservation {
    return {
      success: record.status === 'success',
      actionType: record.action.type,
      target: record.action.path || record.action.command || '',
      output: '', // No output in ExecutionRecord
      error: record.error,
      metadata: {
        timestamp: record.timestamp instanceof Date ? record.timestamp.getTime() : Date.now(),
        executionTime: record.duration,
        changedFiles: [], // No changedFiles in RollbackSnapshot, use empty array
      },
    };
  }

  /**
   * Build observation from multiple execution records
   */
  static fromExecutionHistory(records: ExecutionRecord[]): string {
    if (records.length === 0) {
      return 'No actions executed yet.';
    }

    const observations = records.map(r => this.fromExecutionRecord(r));
    return ObservationFormatter.formatSummary(observations);
  }
}
