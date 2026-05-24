/**
 * Plugin System
 *
 * Main entry point for the plugin system.
 */

import { PluginLoader } from './loader';
import { PluginRegistry } from './registry';
import { PluginLoaderConfig, Plugin } from './types';
import { ToolRegistry } from '../tools/registry';
import { HookSystem } from '../hooks';

/**
 * Plugin system coordinates all plugin-related functionality
 */
export class PluginSystem {
  private registry: PluginRegistry;
  private loader: PluginLoader;
  private config: PluginLoaderConfig;

  constructor(
    config: Partial<PluginLoaderConfig> = {},
    toolRegistry: ToolRegistry,
    hookSystem: HookSystem,
    projectRoot: string
  ) {
    this.config = {
      directories: config.directories || [
        '.kode/plugins',
        path.join(os.homedir(), '.kode/plugins'),
      ],
      enabled: config.enabled ?? false,
      autoLoad: config.autoLoad,
      timeout: config.timeout || 30000,
      validateDependencies: config.validateDependencies ?? true,
      verbose: config.verbose || false,
    };

    this.registry = new PluginRegistry();
    this.loader = new PluginLoader(
      this.registry,
      this.config,
      toolRegistry,
      hookSystem,
      projectRoot
    );
  }

  /**
   * Initialize plugin system (discover and load plugins)
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Discover plugins
    const manifests = await this.loader.discover();

    // Filter by autoLoad list if specified
    const toLoad = this.config.autoLoad ?
      manifests.filter(m => this.config.autoLoad!.includes(m.id)) :
      manifests;

    // Load plugins
    for (const manifest of toLoad) {
      await this.loader.load(manifest);
    }
  }

  /**
   * Get plugin registry
   */
  getRegistry(): PluginRegistry {
    return this.registry;
  }

  /**
   * Get plugin loader
   */
  getLoader(): PluginLoader {
    return this.loader;
  }

  /**
   * Check if plugin system is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable or disable plugin system
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.loader.updateConfig({ enabled });
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PluginLoaderConfig>): void {
    this.config = { ...this.config, ...config };
    this.loader.updateConfig(this.config);
  }

  /**
   * Get plugin statistics
   */
  getStats() {
    return this.registry.getStats();
  }
}

// Import necessary modules
import * as path from 'path';
import * as os from 'os';

// Export all types and classes
export * from './types';
export { PluginRegistry } from './registry';
export { PluginLoader } from './loader';
export { createPluginContext, PluginContextImpl, PluginLoggerImpl } from './context';

// New: Skill plugins (Claude-like progressive disclosure + knowledge transfer)
export * from './skill-types';
export { SkillLoader, createSkillLoader } from './skill-loader';

// New: Direct execution plugins (no-compilation mode)
export { DirectExecutionEngine, createDirectExecutionEngine } from './direct-execution';

// New: Hybrid plugin manager (combines all approaches)
export { HybridPluginManager, createHybridPluginManager } from './hybrid-manager';

// New: Auto skill manager (automatic discovery and selection)
export * from './auto-skill-manager';
export { AutoSkillManager, createAutoSkillManager } from './auto-skill-manager';
