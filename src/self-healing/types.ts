// src/self-healing/types.ts
/**
 * Self-healing system for Newma
 * Enables automatic tool creation, problem diagnosis, and self-repair
 */

import { ErrorCode } from '../errors';

/**
 * Severity levels for detected issues
 */
export enum IssueSeverity {
  CRITICAL = 'critical',   // System-breaking, requires immediate attention
  HIGH = 'high',          // Major functionality broken
  MEDIUM = 'medium',      // Degraded performance or experience
  LOW = 'low',           // Minor issues or warnings
  INFO = 'info',         // Informational, no action needed
}

/**
 * Issue categories for pattern recognition
 */
export enum IssueCategory {
  TOOL_ERROR = 'tool_error',           // Tool execution failures
  API_FAILURE = 'api_failure',         // API communication issues
  VALIDATION_ERROR = 'validation_error', // Input/output validation
  EXECUTION_ERROR = 'execution_error', // Command execution failures
  PERFORMANCE = 'performance',         // Slow operations
  MISSING_FEATURE = 'missing_feature', // Feature requests from patterns
  UNKNOWN = 'unknown',                 // Uncategorized issues
}

/**
 * Auto-generated tool specification
 */
export interface AutoToolSpec {
  name: string;
  description: string;
  category: string;
  parameters: AutoToolParameter[];
  handlerCode: string;  // Generated TypeScript code
  testCases?: AutoTestCase[];
  estimatedUsefulness: number; // 0-1 score
}

/**
 * Auto-generated tool parameter
 */
export interface AutoToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array';
  description: string;
  required: boolean;
  default?: unknown;
}

/**
 * Test case for auto-generated tool
 */
export interface AutoTestCase {
  description: string;
  input: Record<string, unknown>;
  expectedOutput: unknown;
}

/**
 * Detected issue pattern
 */
export interface IssuePattern {
  id: string;
  category: IssueCategory;
  errorCode?: ErrorCode;
  pattern: string;  // Regex or description of pattern
  frequency: number;  // How often this occurs
  lastOccurrence: Date;
  suggestedTool?: AutoToolSpec;  // Tool that could prevent this
  suggestedFix?: string;  // Manual fix description
}

/**
 * Diagnosis result
 */
export interface DiagnosisResult {
  issue: string;
  category: IssueCategory;
  severity: IssueSeverity;
  rootCause: string;
  suggestedActions: SuggestedAction[];
  canAutoFix: boolean;
  confidence: number; // 0-1
}

/**
 * Suggested action for fixing an issue
 */
export interface SuggestedAction {
  type: 'create_tool' | 'modify_code' | 'run_command' | 'change_config' | 'manual';
  description: string;
  priority: number; // 0-1
  requiresConfirmation: boolean;
  estimatedRisk: 'low' | 'medium' | 'high';
  toolSpec?: AutoToolSpec;
  codeChanges?: CodeChange[];
}

/**
 * Code change specification
 */
export interface CodeChange {
  filePath: string;
  operation: 'create' | 'modify' | 'delete';
  content: string;
  reason: string;
}

/**
 * Self-repair result
 */
export interface RepairResult {
  success: boolean;
  actionsTaken: string[];
  issuesResolved: string[];
  newIssues: string[];
  verificationPassed: boolean;
  rollbackAvailable: boolean;
}

/**
 * Learning record for pattern recognition
 */
export interface LearningRecord {
  pattern: IssuePattern;
  fixApplied: SuggestedAction;
  success: boolean;
  timestamp: Date;
  context: {
    projectState: string;
    command: string;
    environment: Record<string, unknown>;
  };
}

/**
 * Self-healing configuration
 */
export interface SelfHealingConfig {
  enabled: boolean;
  autoRepair: boolean;  // Automatically fix issues without confirmation
  autoToolCreation: boolean;  // Automatically generate tools
  learningEnabled: boolean;  // Learn from past repairs
  maxAutoFixRisk: 'low' | 'medium' | 'high';  // Maximum risk level for auto-fix
  minConfidenceThreshold: number;  // Minimum confidence for auto-actions
  patternRetentionDays: number;  // How long to keep pattern data
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  overallHealth: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    category: IssueCategory;
    status: 'pass' | 'warn' | 'fail';
    message: string;
  }[];
  recommendations: string[];
}
