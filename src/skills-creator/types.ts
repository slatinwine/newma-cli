/**
 * Skills Creator Type Definitions
 *
 * Types for the plugin generator and packager
 */

import type { Plugin } from '../plugins/types';
import type { Tool } from '../tools/types';

/**
 * Plugin requirement specification
 */
export interface PluginRequirement {
  /** Plugin name */
  name: string;

  /** Plugin description */
  description: string;

  /** Plugin version */
  version?: string;

  /** Tools to include */
  tools: ToolRequirement[];

  /** Plugin metadata */
  metadata?: PluginMetadataRequirement;

  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Tool requirement specification
 */
export interface ToolRequirement {
  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** Tool category */
  category?: string;

  /** Required permissions */
  permissions?: string[];

  /** Parameters schema */
  parameters?: ParameterSchema;

  /** Implementation hints */
  implementationHints?: string[];

  /** Examples */
  examples?: ToolExample[];
}

/**
 * Parameter schema
 */
export interface ParameterSchema {
  type: 'object' | 'string' | 'number' | 'boolean' | 'array';
  properties?: Record<string, {
    type: string;
    description: string;
    required?: boolean;
    default?: unknown;
  }>;
  required?: string[];
}

/**
 * Tool example
 */
export interface ToolExample {
  input: Record<string, unknown>;
  output: unknown;
  description?: string;
}

/**
 * Plugin metadata requirement
 */
export interface PluginMetadataRequirement {
  author?: string;
  license?: string;
  tags?: string[];
  keywords?: string[];
}

/**
 * Chat message
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

/**
 * Analysis result from chat history
 */
export interface ChatAnalysisResult {
  /** Extracted requirements */
  requirements: PluginRequirement;

  /** Confidence score (0-1) */
  confidence: number;

  /** Missing information */
  missing: string[];

  /** Suggestions */
  suggestions: string[];

  /** Relevant conversation excerpts */
  excerpts: string[];
}

/**
 * Plugin generation options
 */
export interface PluginGenerationOptions {
  /** Template to use */
  template?: PluginTemplate;

  /** Include TypeScript definitions */
  includeTypes?: boolean;

  /** Include tests */
  includeTests?: boolean;

  /** Include README */
  includeReadme?: boolean;

  /** Include resource files (scripts/, references/, assets/) */
  includeResources?: boolean;

  /** Code style preferences */
  codeStyle?: {
    semicolons?: boolean;
    quotes?: 'single' | 'double';
    trailingComma?: boolean;
  };

  /** Output directory */
  outDir?: string;

  // NEW: AI generation options
  /** Enable Function Calling API (auto-detect by default) */
  useFunctionCalling?: boolean;

  /** Force specific provider ('openai' | 'anthropic' | 'azure' | 'local') */
  forceProvider?: 'openai' | 'anthropic' | 'azure' | 'local';

  /** Maximum retry attempts (default: 2) */
  maxRetries?: number;

  /** Interactive mode: Show preview before writing files */
  interactive?: boolean;

  /** Skip bun compilation check (default: false) */
  skipCompile?: boolean;

  /** Continue writing files even if compilation fails (default: false) */
  continueOnError?: boolean;
}

/**
 * Plugin template type
 */
export type PluginTemplate =
  | 'basic'           // Basic tool plugin
  | 'transformer'     // Data transformation plugin
  | 'analyzer'        // Code analysis plugin
  | 'integrator'      // Third-party integration plugin
  | 'custom';         // Custom template

/**
 * Generation result
 */
export interface PluginGenerationResult {
  /** Generated plugin */
  plugin: Plugin;

  /** Generated files */
  files: GeneratedFile[];

  /** Warnings */
  warnings?: string[];

  /** Next steps */
  nextSteps: string[];
}

/**
 * Generated file
 */
export interface GeneratedFile {
  /** File path (relative to plugin root) */
  path: string;

  /** File content */
  content: string;

  /** File type */
  type: 'code' | 'config' | 'documentation' | 'test';
}

/**
 * Package result
 */
export interface PackageResult {
  /** Package directory */
  directory: string;

  /** Created files */
  files: string[];

  /** Build success */
  success: boolean;

  /** Build output */
  output: string;

  /** Errors */
  errors?: string[];
}

/**
 * Test result
 */
export interface TestResult {
  /** All tests passed */
  passed: boolean;

  /** Test results */
  tests: Array<{
    name: string;
    passed: boolean;
    output?: string;
    error?: string;
  }>;

  /** Coverage */
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
}

/**
 * Skills creator configuration
 */
export interface SkillsCreatorConfig {
  /** Default template */
  defaultTemplate?: PluginTemplate;

  /** Default output directory */
  defaultOutDir?: string;

  /** Whether to run tests after generation */
  autoTest?: boolean;

  /** Whether to initialize git repo */
  initGit?: boolean;

  /** AI model for code generation */
  aiModel?: string;

  /** Verbose output */
  verbose?: boolean;

  /** NEW: Interactive mode - preview before writing files */
  interactive?: boolean;
}

/**
 * Template context
 */
export interface TemplateContext {
  /** Plugin name */
  pluginName: string;

  /** Plugin ID (kebab-case) */
  pluginId: string;

  /** Plugin description */
  description: string;

  /** Tool definitions */
  tools: ToolRequirement[];

  /** Plugin version */
  version: string;

  /** Author */
  author?: string;

  /** Current year */
  year: number;

  /** Kode version */
  kodeVersion: string;
}
