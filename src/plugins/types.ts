/**
 * Plugin System Type Definitions
 *
 * Defines the core types for the plugin system that allows
 * extending Kode with dynamically loadable plugins.
 */

import { Tool } from '../tools/types';
import { ToolRegistry } from '../tools/registry';
import { HookSystem } from '../hooks';

/**
 * Plugin interface
 * A plugin is a container for one or more related tools
 */
export interface Plugin {
  /** Unique plugin identifier (e.g., 'search-plugin') */
  id: string;

  /** Human-readable name */
  name: string;

  /** Plugin description */
  description: string;

  /** Plugin version (semver) */
  version: string;

  /** Kode version compatibility (semver range) */
  kodeVersion?: string;

  /** Tools provided by this plugin */
  tools: Tool[];

  /** Plugin configuration schema */
  configSchema?: PluginConfigSchema;

  /** Plugin dependencies */
  dependencies?: PluginDependency[];

  /** Optional initialization function */
  initialize?(context: PluginContext): Promise<void> | void;

  /** Optional cleanup function */
  cleanup?(context: PluginContext): Promise<void> | void;

  /** Optional configuration validator */
  validateConfig?(config: Record<string, unknown>): ValidationResult;

  /** Plugin metadata */
  metadata?: PluginMetadata;
}

/**
 * Plugin context passed to initialize/cleanup
 */
export interface PluginContext {
  /** Plugin root directory */
  pluginRoot: string;

  /** Project root directory */
  projectRoot: string;

  /** Plugin configuration */
  config: Record<string, unknown>;

  /** Tool registry (for registering tools) */
  toolRegistry: ToolRegistry;

  /** Hook system (for registering hooks) */
  hookSystem: HookSystem;

  /** Access other plugins */
  getPlugin(id: string): Plugin | undefined;

  /** Logger instance */
  logger: PluginLogger;
}

/**
 * Plugin dependency specification
 */
export interface PluginDependency {
  /** Plugin ID */
  pluginId: string;

  /** Minimum version (semver) */
  minVersion?: string;

  /** Maximum version (semver) */
  maxVersion?: string;
}

/**
 * Plugin configuration schema
 */
export interface PluginConfigSchema {
  /** Configuration properties */
  properties: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'enum';
    description: string;
    required?: boolean;
    default?: unknown;
    enum?: unknown[];
  }>;

  /** Required configuration keys */
  required?: string[];
}

/**
 * Plugin metadata
 */
export interface PluginMetadata {
  /** Author information */
  author?: string;

  /** Homepage URL */
  homepage?: string;

  /** Repository URL */
  repository?: string;

  /** License */
  license?: string;

  /** Tags for categorization */
  tags?: string[];

  /** Keywords */
  keywords?: string[];
}

/**
 * Plugin validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;

  /** Validation errors */
  errors?: string[];
}

/**
 * Plugin logger
 */
export interface PluginLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Plugin state
 */
export enum PluginState {
  /** Plugin is being loaded */
  LOADING = 'loading',

  /** Plugin is loaded and initialized */
  LOADED = 'loaded',

  /** Plugin is being unloaded */
  UNLOADING = 'unloading',

  /** Plugin is unloaded */
  UNLOADED = 'unloaded',

  /** Plugin encountered an error */
  ERROR = 'error',
}

/**
 * Plugin manifest (metadata before loading)
 */
export interface PluginManifest {
  /** Plugin ID */
  id: string;

  /** Plugin name */
  name: string;

  /** Entry point path (relative to plugin root) */
  entryPoint: string;

  /** Plugin root directory */
  root: string;

  /** Plugin version */
  version: string;

  /** Plugin description */
  description: string;

  /** Plugin dependencies */
  dependencies?: PluginDependency[];

  /** Plugin metadata */
  metadata?: PluginMetadata;
}

/**
 * Plugin resolution result
 */
export interface PluginResolutionResult {
  /** Whether all dependencies are satisfied */
  satisfied: boolean;

  /** Missing dependencies */
  missing?: string[];

  /** Version conflicts */
  conflicts?: Array<{
    pluginId: string;
    required: string;
    found: string;
  }>;

  /** Dependency order (topological sort) */
  order?: string[];
}

/**
 * Plugin loader configuration
 */
export interface PluginLoaderConfig {
  /** Directories to search for plugins */
  directories: string[];

  /** Whether plugins are enabled */
  enabled: boolean;

  /** Plugins to auto-load */
  autoLoad?: string[];

  /** Plugin load timeout in ms */
  timeout: number;

  /** Whether to validate dependencies */
  validateDependencies: boolean;

  /** Verbose logging */
  verbose: boolean;
}

/**
 * Plugin filter options
 */
export interface PluginFilter {
  /** Filter by category (from metadata tags) */
  tags?: string[];

  /** Filter by state */
  state?: PluginState;

  /** Filter by dependency */
  dependsOn?: string;
}

/**
 * Plugin load result
 */
export interface PluginLoadResult {
  /** Loaded plugin */
  plugin?: Plugin;

  /** Whether load was successful */
  success: boolean;

  /** Load duration in ms */
  duration: number;

  /** Error if load failed */
  error?: Error;

  /** Warnings (non-fatal) */
  warnings?: string[];
}

/**
 * Plugin export (what plugin.ts should export)
 */
export type PluginExport = Plugin | { default: Plugin };
