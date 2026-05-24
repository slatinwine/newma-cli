// src/agents/types.ts
/**
 * Multi-Agent System Type Definitions
 */

import { ToolCall, ToolResult } from '../tools/types';

/**
 * Agent capability types
 */
export enum AgentCapability {
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  DATABASE = 'database',
  TESTING = 'testing',
  DEPLOYMENT = 'deployment',
  DOCUMENTATION = 'documentation',
  ANALYSIS = 'analysis',
  REFACTORING = 'refactoring',
}

/**
 * Agent status
 */
export enum AgentStatus {
  IDLE = 'idle',
  THINKING = 'thinking',
  WORKING = 'working',
  WAITING = 'waiting',
  DONE = 'done',
  FAILED = 'failed',
}

/**
 * Agent message for inter-agent communication
 */
export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  timestamp: number;
  type: 'request' | 'response' | 'broadcast';
  content: string;
  data?: any;
}

/**
 * Agent task
 */
export interface AgentTask {
  id: string;
  description: string;
  capabilities: AgentCapability[];
  priority: 'low' | 'medium' | 'high';
  dependencies: string[]; // Task IDs this depends on
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedTo?: string;
  result?: any;
  error?: string;
}

/**
 * Agent context
 */
export interface AgentContext {
  projectRoot: string;
  requirements: string;
  messages: AgentMessage[];
  sharedState: Map<string, any>;
  config?: any; // Config for LLM calls
}

/**
 * Agent interface
 */
export interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: AgentCapability[];
  status: AgentStatus;

  /**
   * Process a task and return result
   */
  process(task: AgentTask, context: AgentContext, options?: AgentExecutionOptions): Promise<AgentResult>;

  /**
   * Handle message from another agent
   */
  handleMessage(message: AgentMessage): Promise<void>;

  /**
   * Get current status
   */
  getStatus(): AgentStatus;

  /**
   * Reset agent state
   */
  reset(): void;

  /**
   * Check if this agent can handle a task
   */
  canHandle(task: AgentTask): boolean;
}

/**
 * Agent execution result
 */
export interface AgentResult {
  success: boolean;
  agentId: string;
  taskId: string;
  output: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  nextTasks?: AgentTask[];
  messages?: AgentMessage[];
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Agent coordination plan
 */
export interface CoordinationPlan {
  tasks: AgentTask[];
  taskGraph: Map<string, string[]>; // Task ID -> Dependencies
  executionOrder: string[][]; // Groups of tasks that can run in parallel
  estimatedIterations: number;
}

/**
 * Agent specialization config
 */
export interface AgentSpecialization {
  capabilities: AgentCapability[];
  filePatterns: string[]; // Files this agent handles (e.g., ['*.tsx', '*.css'])
  exclusions: string[]; // Files this agent doesn't handle
  tools: string[]; // Tools this agent can use
  systemPrompt: string; // Custom system prompt
}

/**
 * Streaming callback
 */
export interface StreamingCallback {
  onToken?: (token: string) => void;
  onToolCall?: (tool: ToolCall) => void;
  onToolResult?: (result: ToolResult) => void;
  onComplete?: (result: AgentResult) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: number) => void;
}

/**
 * Agent execution options
 */
export interface AgentExecutionOptions {
  streaming?: boolean;
  callbacks?: StreamingCallback;
  timeout?: number;
  maxIterations?: number;
}
