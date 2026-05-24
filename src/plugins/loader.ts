/**
 * Plugin Loader
 *
 * Discovers, loads, and unloads plugins.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  Plugin,
  PluginExport,
  PluginManifest,
  PluginLoaderConfig,
  PluginLoadResult,
  PluginState,
  ValidationResult,
} from './types';
import { PluginRegistry } from './registry';
import { createPluginContext } from './context';
import { ToolRegistry } from '../tools/registry';
import { HookSystem } from '../hooks';
import chalk from 'chalk';

/**
 * Plugin loader handles plugin discovery and loading
 */
export class PluginLoader {
  private registry: PluginRegistry;
  private config: PluginLoaderConfig;
  private toolRegistry: ToolRegistry;
  private hookSystem: HookSystem;
  private projectRoot: string;

  constructor(
    registry: PluginRegistry,
    config: PluginLoaderConfig,
    toolRegistry: ToolRegistry,
    hookSystem: HookSystem,
    projectRoot: string
  ) {
    this.registry = registry;
    this.config = config;
    this.toolRegistry = toolRegistry;
    this.hookSystem = hookSystem;
    this.projectRoot = projectRoot;
  }

  /**
   * Discover plugins from configured directories
   */
  async discover(): Promise<PluginManifest[]> {
    if (!this.config.enabled) {
      return [];
    }

    const manifests: PluginManifest[] = [];

    for (const dir of this.config.directories) {
      const pluginDir = this.expandHomeDir(dir);

      try {
        await fs.access(pluginDir);
      } catch {
        // Directory doesn't exist, create it
        await fs.mkdir(pluginDir, { recursive: true });
        continue;
      }

      const entries = await fs.readdir(pluginDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const pluginRoot = path.join(pluginDir, entry.name);
        const manifest = await this.readManifest(pluginRoot);

        if (manifest) {
          manifests.push(manifest);

          if (this.config.verbose) {
            console.log(chalk.gray(`[PLUGIN] Discovered: ${manifest.name} v${manifest.version}`));
          }
        }
      }
    }

    return manifests;
  }

  /**
   * Load a plugin from manifest
   */
  async load(manifest: PluginManifest): Promise<PluginLoadResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    if (this.config.verbose) {
      console.log(chalk.cyan(`[PLUGIN] Loading: ${manifest.name}...`));
    }

    // Check if already loaded
    if (this.registry.isLoaded(manifest.id)) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: new Error(`Plugin ${manifest.id} is already loaded`),
      };
    }

    this.registry.setState(manifest.id, PluginState.LOADING);

    try {
      // Resolve entry point (use absolute path)
      const entryPoint = path.resolve(manifest.root, manifest.entryPoint);

      // Dynamic import
      const module = await this.importWithTimeout(entryPoint, this.config.timeout);

      // Extract plugin
      const plugin = this.extractPlugin(module);

      if (!plugin) {
        throw new Error(`Invalid plugin export from ${entryPoint}`);
      }

      // Validate plugin
      const validation = this.validatePlugin(plugin);
      if (!validation.valid) {
        throw new Error(`Plugin validation failed: ${validation.errors?.join(', ')}`);
      }

      // Resolve dependencies
      if (this.config.validateDependencies && plugin.dependencies) {
        const resolution = this.registry.resolveDependencies(plugin);

        if (!resolution.satisfied) {
          const missing = resolution.missing?.join(', ') || 'none';
          const conflicts = resolution.conflicts?.map(c => c.pluginId).join(', ') || 'none';
          throw new Error(
            `Plugin dependencies not satisfied:\n` +
            `  Missing: ${missing}\n` +
            `  Conflicts: ${conflicts}`
          );
        }
      }

      // Get plugin config
      const pluginConfig = this.getPluginConfig(plugin.id);

      // Create plugin context
      const context = createPluginContext(
        plugin,
        manifest.root,
        this.projectRoot,
        pluginConfig,
        this.toolRegistry,
        this.hookSystem,
        this.registry
      );

      // Initialize plugin
      if (plugin.initialize) {
        if (this.config.verbose) {
          console.log(chalk.gray(`[PLUGIN]   Initializing...`));
        }

        await Promise.race([
          plugin.initialize(context),
          this.createTimeout(this.config.timeout, 'Plugin initialization timeout'),
        ]);
      }

      // Register plugin's tools
      for (const tool of plugin.tools) {
        this.toolRegistry.register(tool);

        if (this.config.verbose) {
          console.log(chalk.gray(`[PLUGIN]   Registered tool: ${tool.name}`));
        }
      }

      // Register plugin
      this.registry.register(plugin);

      const duration = Date.now() - startTime;

      if (this.config.verbose) {
        console.log(chalk.green(`[PLUGIN] ✅ Loaded: ${plugin.name} v${plugin.version} (${duration}ms)`));
      }

      return {
        plugin,
        success: true,
        duration,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      const err = error as Error;
      this.registry.setError(manifest.id, err);

      console.error(chalk.red(`[PLUGIN] ❌ Failed to load ${manifest.id}: ${err.message}`));

      return {
        success: false,
        duration: Date.now() - startTime,
        error: err,
      };
    }
  }

  /**
   * Unload a plugin
   */
  async unload(pluginId: string): Promise<void> {
    const plugin = this.registry.get(pluginId);

    if (!plugin) {
      throw new Error(`Plugin ${pluginId} is not loaded`);
    }

    this.registry.setState(pluginId, PluginState.UNLOADING);

    try {
      // Call cleanup
      if (plugin.cleanup) {
        const context = createPluginContext(
          plugin,
          '', // Plugin root not available during unload
          this.projectRoot,
          {},
          this.toolRegistry,
          this.hookSystem,
          this.registry
        );

        await plugin.cleanup(context);
      }

      // Unregister tools
      for (const tool of plugin.tools) {
        // Note: ToolRegistry doesn't have unregister, just remove from map
        this.toolRegistry['tools']?.delete(tool.name);
      }

      // Unregister plugin
      this.registry.unregister(pluginId);

      console.log(chalk.cyan(`[PLUGIN] Unloaded: ${plugin.name}`));
    } catch (error) {
      console.error(chalk.red(`[PLUGIN] Error unloading ${pluginId}:`, error));
      throw error;
    }
  }

  /**
   * Reload a plugin (unload + load)
   */
  async reload(pluginId: string): Promise<void> {
    const plugin = this.registry.get(pluginId);

    if (!plugin) {
      throw new Error(`Plugin ${pluginId} is not loaded`);
    }

    const manifest = await this.findManifest(pluginId);

    if (!manifest) {
      throw new Error(`Cannot find manifest for plugin ${pluginId}`);
    }

    await this.unload(pluginId);
    await this.load(manifest);
  }

  /**
   * Read plugin manifest from directory
   */
  private async readManifest(pluginRoot: string): Promise<PluginManifest | null> {
    try {
      // Try package.json first
      const packageJsonPath = path.join(pluginRoot, 'package.json');
      const packageJsonExists = await fs.access(packageJsonPath).then(() => true).catch(() => false);

      if (packageJsonExists) {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

        if (packageJson.kode?.id && packageJson.kode?.entryPoint) {
          return {
            id: packageJson.kode.id,
            name: packageJson.name || packageJson.kode.id,
            entryPoint: packageJson.kode.entryPoint,
            root: pluginRoot,
            version: packageJson.version,
            description: packageJson.description,
            dependencies: packageJson.peerDependencies ?
              Object.keys(packageJson.peerDependencies).map(pluginId => ({ pluginId })) :
              undefined,
            metadata: {
              author: packageJson.author,
              license: packageJson.license,
              repository: packageJson.repository?.url || packageJson.repository,
            },
          };
        }
      }

      // Fallback: look for plugin.ts
      const pluginTsPath = path.join(pluginRoot, 'plugin.ts');
      const pluginTsExists = await fs.access(pluginTsPath).then(() => true).catch(() => false);

      if (pluginTsExists) {
        const dirName = path.basename(pluginRoot);
        return {
          id: dirName,
          name: dirName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          entryPoint: 'plugin.ts',
          root: pluginRoot,
          version: '1.0.0',
          description: `Plugin from ${dirName}`,
        };
      }

      return null;
    } catch (error) {
      console.error(chalk.red(`[PLUGIN] Error reading manifest from ${pluginRoot}:`, error));
      return null;
    }
  }

  /**
   * Extract plugin from module
   */
  private extractPlugin(module: any): Plugin | null {
    // Check for default export
    if (module.default?.id) {
      return module.default as Plugin;
    }

    // Check if module itself is a plugin
    if (module.id) {
      return module as Plugin;
    }

    return null;
  }

  /**
   * Validate plugin structure
   */
  private validatePlugin(plugin: Plugin): ValidationResult {
    const errors: string[] = [];

    if (!plugin.id) {
      errors.push('Plugin missing id');
    }

    if (!plugin.name) {
      errors.push('Plugin missing name');
    }

    if (!plugin.version) {
      errors.push('Plugin missing version');
    }

    // Tools array can be empty for hook-only plugins
    if (!plugin.tools || !Array.isArray(plugin.tools)) {
      errors.push('Plugin tools must be an array');
    }

    // Validate each tool (if any)
    if (plugin.tools && plugin.tools.length > 0) {
      for (const tool of plugin.tools) {
        if (!tool.name) {
          errors.push('Tool missing name');
        }

        if (!tool.handler) {
          errors.push(`Tool ${tool.name} missing handler`);
        }

        if (!tool.description) {
          errors.push(`Tool ${tool.name} missing description`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Get plugin configuration
   */
  private getPluginConfig(pluginId: string): Record<string, unknown> {
    // TODO: Load from settings.json pluginConfigs section
    return {};
  }

  /**
   * Find manifest by plugin ID
   */
  private async findManifest(pluginId: string): Promise<PluginManifest | null> {
    const manifests = await this.discover();
    return manifests.find(m => m.id === pluginId) || null;
  }

  /**
   * Import module with timeout
   */
  private async importWithTimeout(modulePath: string, timeout: number): Promise<any> {
    // Check if file is TypeScript
    if (modulePath.endsWith('.ts')) {
      // Use ts-node to load TypeScript files
      return this.importTypeScript(modulePath, timeout);
    }

    // Use regular import for JavaScript files
    return Promise.race([
      import(modulePath),
      this.createTimeout(timeout, 'Module import timeout'),
    ]);
  }

  /**
   * Import TypeScript file using ts-node
   */
  private async importTypeScript(modulePath: string, timeout: number): Promise<any> {
    const tsNodePath = require.resolve('ts-node');

    // Register ts-node if not already registered
    const registeredSymbol = Symbol.for('ts-node.registered') as any;
    if (!(process as any)[registeredSymbol]) {
      require(tsNodePath).register({
        transpileOnly: true,
        esm: true,
        experimentalSpecifierResolution: 'node',
      });
      (process as any)[registeredSymbol] = true;
    }

    // Import using regular import (ts-node will handle TypeScript)
    return Promise.race([
      import(modulePath),
      this.createTimeout(timeout, 'TypeScript import timeout'),
    ]);
  }

  /**
   * Create timeout promise
   */
  private createTimeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  /**
   * Expand ~ in path
   */
  private expandHomeDir(filePath: string): string {
    if (filePath.startsWith('~/') || filePath === '~') {
      return filePath.replace('~', os.homedir());
    }
    return filePath;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PluginLoaderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): PluginLoaderConfig {
    return { ...this.config };
  }
}
