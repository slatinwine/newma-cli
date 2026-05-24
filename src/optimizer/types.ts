// src/optimizer/types.ts
/**
 * Self-Optimization System Type Definitions
 */

import { ExecutionRecord } from '../history';

/**
 * Optimization metrics
 */
export interface OptimizationMetrics {
  // Task success rates
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  successRate: number;

  // Agent performance
  agentPerformance: Map<string, AgentMetrics>;

  // Timing metrics
  averageExecutionTime: number;
  fastestAgent: string;
  slowestAgent: string;

  // Error patterns
  commonErrors: ErrorPattern[];

  // Optimization suggestions
  suggestions: OptimizationSuggestion[];
}

/**
 * Agent-specific metrics
 */
export interface AgentMetrics {
  agentId: string;
  agentName: string;
  tasksCompleted: number;
  tasksSucceeded: number;
  tasksFailed: number;
  successRate: number;
  averageTime: number;
  fastestTask: number;
  slowestTask: number;
  commonErrors: string[];
}

/**
 * Error pattern
 */
export interface ErrorPattern {
  type: string;
  frequency: number;
  lastOccurred: number;
  suggestedFix?: string;
}

/**
 * Optimization suggestion
 */
export interface OptimizationSuggestion {
  priority: 'low' | 'medium' | 'high';
  category: 'performance' | 'reliability' | 'efficiency' | 'quality';
  description: string;
  action: string;
  expectedImprovement: string;
}

/**
 * Learning data
 */
export interface LearningData {
  timestamp: number;
  task: string;
  agent: string;
  success: boolean;
  duration: number;
  errors: string[];
  context: Record<string, any>;
}

/**
 * Optimization strategy
 */
export interface OptimizationStrategy {
  name: string;
  description: string;
  apply: (metrics: OptimizationMetrics) => OptimizationSuggestion[];
}

/**
 * Performance baseline
 */
export interface PerformanceBaseline {
  averageSuccessRate: number;
  averageExecutionTime: number;
  averageErrorsPerTask: number;
  establishedAt: number;
}

/**
 * Pattern interface
 */
export interface Pattern {
  type: string;
  description: string;
  confidence: number;
  recommendation: string;
  example: any;
}
