/**
 * Hook System Type Definitions
 *
 * Defines the core types for the plugin hook system that allows
 * extending Kode at key execution points.
 */

import { SessionManager } from '../session';
import { Config } from '../config';

/**
 * All available hook types in the system
 */
export enum HookType {
  // Tool execution hooks
  BEFORE_TOOL_EXECUTION = 'beforeToolExecution',
  AFTER_TOOL_EXECUTION = 'afterToolExecution',

  // AI call hooks
  BEFORE_AI_REQUEST = 'beforeAIRequest',
  AFTER_AI_RESPONSE = 'afterAIResponse',

  // Verification hooks
  BEFORE_VERIFICATION = 'beforeVerification',
  AFTER_VERIFICATION = 'afterVerification',

  // User input hooks
  BEFORE_INPUT_PROCESSING = 'beforeInputProcessing',
  AFTER_INPUT_PROCESSING = 'afterInputProcessing',

  // Lifecycle hooks
  BEFORE_SESSION_START = 'beforeSessionStart',
  AFTER_SESSION_END = 'afterSessionEnd',
}

/**
 * Hook function signature
 */
export type HookHandler = (context: HookContext) => Promise<void> | void;

/**
 * Core hook interface
 */
export interface Hook {
  /** Unique hook identifier */
  id: string;

  /** Hook type determines when it executes */
  type: HookType;

  /** Human-readable name */
  name: string;

  /** Optional description */
  description?: string;

  /** The function to execute */
  handler: HookHandler;

  /** Priority (lower = executes first, default: 100) */
  priority?: number;

  /** Whether hook is enabled (default: true) */
  enabled?: boolean;

  /** Optional metadata */
  metadata?: Record<string, any>;
}

/**
 * Context passed to all hook handlers
 */
export interface HookContext {
  /** Type of hook being executed */
  type: HookType;

  /** Hook-specific data */
  data: any;

  /** Current session */
  session: SessionManager;

  /** Current configuration */
  config: Config;

  /** Timestamp when hook was triggered */
  timestamp: Date;

  /** Optional error information (for error hooks) */
  error?: Error;
}

/**
 * Tool execution hook data
 */
export interface ToolExecutionData {
  /** Tool name being executed */
  toolName: string;

  /** Tool parameters */
  params: any;

  /** Tool execution result (for after hooks) */
  result?: any;

  /** Execution duration in ms (for after hooks) */
  duration?: number;

  /** Whether execution was successful (for after hooks) */
  success?: boolean;
}

/**
 * AI request hook data
 */
export interface AIRequestData {
  /** Request mode (plan, verify, chat, think) */
  mode: string;

  /** Request body being sent to API */
  requestBody?: any;

  /** API endpoint */
  endpoint?: string;

  /** Request duration in ms (for after hooks) */
  duration?: number;

  /** Response from API (for after hooks) */
  response?: any;

  /** Error if request failed (for after hooks) */
  error?: Error;
}

/**
 * Verification hook data
 */
export interface VerificationData {
  /** Verification stage name */
  stage: string;

  /** Project root directory */
  projectRoot: string;

  /** Verification result (for after hooks) */
  result?: {
    passed: boolean;
    message: string;
    output?: string;
  };

  /** Duration in ms (for after hooks) */
  duration?: number;
}

/**
 * User input hook data
 */
export interface InputProcessingData {
  /** Raw user input */
  input: string;

  /** Modified input (hooks can change this) */
  modifiedInput?: string;

  /** Whether input is a special command */
  isCommand?: boolean;

  /** Processing result (for after hooks) */
  result?: any;
}

/**
 * Hook execution result
 */
export interface HookExecutionResult {
  /** Hook that was executed */
  hook: Hook;

  /** Whether execution was successful */
  success: boolean;

  /** Execution duration in ms */
  duration: number;

  /** Error if execution failed */
  error?: Error;

  /** Any data returned by hook */
  data?: any;
}

/**
 * Hook loader options
 */
export interface HookLoaderOptions {
  /** Directory containing hook files */
  directory?: string;

  /** Whether hooks are enabled */
  enabled?: boolean;

  /** Hook execution timeout in ms */
  timeout?: number;
}

/**
 * Hook system configuration
 */
export interface HookSystemConfig {
  /** Whether hook system is enabled */
  enabled: boolean;

  /** Directory to load user hooks from */
  directory: string;

  /** Default timeout for hook execution */
  timeout: number;

  /** Whether to log hook execution */
  verbose: boolean;
}
