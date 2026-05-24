// src/tools/types.ts
/**
 * Tool system type definitions
 * Provides extensible tool architecture for Kode
 */

/**
 * Tool categories for organization
 */
export enum ToolCategory {
  FILE = 'file',
  COMMAND = 'command',
  ANALYSIS = 'analysis',
  SYSTEM = 'system',
  VERSION_CONTROL = 'version_control',
  SEARCH = 'search',
  EXECUTION = 'execution',
  DATABASE = 'database',
  NETWORK = 'network',
}

/**
 * Permission types for safety control
 */
export enum Permission {
  READ_FILES = 'read_files',
  WRITE_FILES = 'write_files',
  DELETE_FILES = 'delete_files',
  RUN_COMMANDS = 'run_commands',
  MODIFY_GIT = 'modify_git',
  NETWORK_ACCESS = 'network_access',
}

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array';
  description?: string;
  required: boolean;
  default?: unknown;
  values?: string[]; // For enum type
}

/**
 * Tool validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Tool execution context
 */
export interface ToolContext {
  root: string;
  history: import('../history').ExecutionTracker;
  permissions: Set<Permission>;
  config: import('../config').Config;
  /** 权限验证链引用，用于运行时权限检查 */
  permissionChain?: {
    checkPermission: (context: import('../permission/types').PermissionContext) => import('../permission/types').PermissionDecision;
  };
}

/**
 * Tool result
 */
export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Tool validator function
 */
export type ToolValidator = (params: Record<string, unknown>) => ValidationResult;

/**
 * Tool handler function
 */
export type ToolHandler = (
  params: Record<string, unknown>,
  context: ToolContext
) => Promise<ToolResult>;

/**
 * Tool post-execution hook
 */
export type ToolPostExecutor = (
  result: ToolResult,
  context: ToolContext
) => Promise<void>;

/**
 * Tool interface
 */
export interface Tool {
  name: string;
  description: string;
  category: ToolCategory;
  permissions: Permission[];
  parameters: ToolParameter[];
  handler: ToolHandler;
  validate?: ToolValidator;
  postExecute?: ToolPostExecutor;
}

/**
 * Tool call invocation
 */
export interface ToolCall {
  tool: string;
  parameters: Record<string, unknown>;
  id: string;
  dependencies?: string[]; // For parallel execution
}

/**
 * Verification stage
 */
export interface VerificationStage {
  name: string;
  check: (root: string) => Promise<VerificationResult>;
  required: boolean;
}

/**
 * Verification result
 */
export interface VerificationResult {
  passed: boolean;
  message: string;
  details?: string[];
}
