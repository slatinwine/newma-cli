/**
 * Bun Plugin Loader
 *
 * Fast plugin loading using Bun's native TypeScript support
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type {
  Plugin,
  PluginExport,
  PluginManifest,
  PluginLoaderConfig,
  PluginLoadResult,
  ValidationResult,
} from './types';
import { PluginState } from './types';
import { PluginRegistry } from './registry';
import { createPluginContext } from './context';
import { ToolRegistry } from '../tools/registry';
import { HookSystem } from '../hooks';
import chalk from 'chalk';

/**
 * Check if running in Bun
 */
export function isBunRuntime(): boolean {
  return typeof (globalThis as any).Bun !== 'undefined';
}

/**
 * Bun plugin loader - optimized for Bun runtime
 */
export class BunPluginLoader {
  private registry: PluginRegistry;
  private config: PluginLoaderConfig;
  private toolRegistry: ToolRegistry;
  private hookSystem: HookSystem;
  private projectRoot: string;
  private hotReloadWatchers: Map<string, FSWatcher> = new Map();

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
            console.log(chalk.gray(`[BUN PLUGIN] Discovered: ${manifest.name} v${manifest.version}`));
          }
        }
      }
    }

    return manifests;
  }

  /**
   * Load a plugin using Bun's native import
   */
  async load(manifest: PluginManifest): Promise<PluginLoadResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    if (this.config.verbose) {
      console.log(chalk.cyan(`[BUN PLUGIN] Loading: ${manifest.name}...`));
    }

    if (this.registry.isLoaded(manifest.id)) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: new Error(`Plugin ${manifest.id} is already loaded`),
      };
    }

    this.registry.setState(manifest.id, PluginState.LOADING);

    try {
      const entryPoint = path.resolve(manifest.root, manifest.entryPoint);

      // Use Bun's native import (supports TypeScript out of the box)
      const module = await this.importWithBun(entryPoint);

      const plugin = this.extractPlugin(module);

      if (!plugin) {
        throw new Error(`Invalid plugin export from ${entryPoint}`);
      }

      const validation = this.validatePlugin(plugin);
      if (!validation.valid) {
        throw new Error(`Plugin validation failed: ${validation.errors?.join(', ')}`);
      }

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

      const pluginConfig = this.getPluginConfig(plugin.id);

      const context = createPluginContext(
        plugin,
        manifest.root,
        this.projectRoot,
        pluginConfig,
        this.toolRegistry,
        this.hookSystem,
        this.registry
      );

      if (plugin.initialize) {
        if (this.config.verbose) {
          console.log(chalk.gray(`[BUN PLUGIN]   Initializing...`));
        }

        await Promise.race([
          plugin.initialize(context),
          this.createTimeout(this.config.timeout, 'Plugin initialization timeout'),
        ]);
      }

      for (const tool of plugin.tools) {
        this.toolRegistry.register(tool);

        if (this.config.verbose) {
          console.log(chalk.gray(`[BUN PLUGIN]   Registered tool: ${tool.name}`));
        }
      }

      this.registry.register(plugin);

      const duration = Date.now() - startTime;

      if (this.config.verbose) {
        console.log(chalk.green(`[BUN PLUGIN] ✅ Loaded: ${plugin.name} v${plugin.version} (${duration}ms)`));
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

      console.error(chalk.red(`[BUN PLUGIN] ❌ Failed to load ${manifest.id}: ${err.message}`));

      return {
        success: false,
        duration: Date.now() - startTime,
        error: err,
      };
    }
  }

  /**
   * Enable hot reload for a plugin
   */
  async enableHotReload(manifest: PluginManifest, callback: (plugin: Plugin) => void | Promise<void>): Promise<void> {
    if (!isBunRuntime()) {
      console.warn(chalk.yellow('[BUN PLUGIN] Hot reload only works in Bun runtime'));
      return;
    }

    const pluginPath = path.resolve(manifest.root, manifest.entryPoint);
    const dir = path.dirname(pluginPath);

    try {
      const watcher = (globalThis as any).Bun.fs.watch(dir, { persistent: true }, async (event: any, filename: string | null) => {
        if (!filename) return;

        const filePath = path.join(dir, filename);

        if (filePath === pluginPath || filePath.endsWith('.ts')) {
          console.log(chalk.cyan(`[BUN PLUGIN] 🔄 Hot reloading ${manifest.name}...`));

          try {
            await this.unload(manifest.id);

            // Clear require cache
            if (require.cache[pluginPath]) {
              delete require.cache[pluginPath];
            }

            const result = await this.load(manifest);

            if (result.success && result.plugin) {
              await callback(result.plugin);
              console.log(chalk.green(`[BUN PLUGIN] ✅ Hot reload complete`));
            }
          } catch (error) {
            console.error(chalk.red(`[BUN PLUGIN] ❌ Hot reload failed:`), error);
          }
        }
      });

      this.hotReloadWatchers.set(manifest.id, watcher);

      if (this.config.verbose) {
        console.log(chalk.green(`[BUN PLUGIN] 🔥 Hot reload enabled for ${manifest.name}`));
      }
    } catch (error) {
      console.error(chalk.red(`[BUN PLUGIN] ❌ Failed to enable hot reload:`), error);
    }
  }

  /**
   * Disable hot reload for a plugin
   */
  async disableHotReload(pluginId: string): Promise<void> {
    const watcher = this.hotReloadWatchers.get(pluginId);

    if (watcher) {
      await watcher.close();
      this.hotReloadWatchers.delete(pluginId);

      if (this.config.verbose) {
        console.log(chalk.cyan(`[BUN PLUGIN] 🔥 Hot reload disabled for ${pluginId}`));
      }
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
      if (plugin.cleanup) {
        const context = createPluginContext(
          plugin,
          '',
          this.projectRoot,
          {},
          this.toolRegistry,
          this.hookSystem,
          this.registry
        );

        await plugin.cleanup(context);
      }

      for (const tool of plugin.tools) {
        this.toolRegistry['tools']?.delete(tool.name);
      }

      this.registry.unregister(pluginId);

      console.log(chalk.cyan(`[BUN PLUGIN] Unloaded: ${plugin.name}`));
    } catch (error) {
      console.error(chalk.red(`[BUN PLUGIN] Error unloading ${pluginId}:`, error));
      throw error;
    }
  }

  /**
   * Import module using Bun
   */
  private async importWithBun(modulePath: string): Promise<any> {
    if (isBunRuntime()) {
      // Bun can import TypeScript directly
      return Promise.race([
        import(modulePath),
        this.createTimeout(this.config.timeout, 'Module import timeout'),
      ]);
    }

    // Fallback to Node.js with ts-node
    return this.importWithNode(modulePath);
  }

  /**
   * Import module using Node.js (fallback)
   */
  private async importWithNode(modulePath: string): Promise<any> {
    if (modulePath.endsWith('.ts')) {
      const tsNodePath = require.resolve('ts-node');

      const registeredSymbol = Symbol.for('ts-node.registered') as any;
      if (!(process as any)[registeredSymbol]) {
        require(tsNodePath).register({
          transpileOnly: true,
          esm: true,
          experimentalSpecifierResolution: 'node',
        });
        (process as any)[registeredSymbol] = true;
      }
    }

    return Promise.race([
      import(modulePath),
      this.createTimeout(this.config.timeout, 'Module import timeout'),
    ]);
  }

  /**
   * Read plugin manifest
   */
  private async readManifest(pluginRoot: string): Promise<PluginManifest | null> {
    try {
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
      console.error(chalk.red(`[BUN PLUGIN] Error reading manifest from ${pluginRoot}:`, error));
      return null;
    }
  }

  /**
   * Extract plugin from module
   */
  private extractPlugin(module: any): Plugin | null {
    if (module.default?.id) {
      return module.default as Plugin;
    }

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

    if (!plugin.tools || !Array.isArray(plugin.tools) || plugin.tools.length === 0) {
      errors.push('Plugin must provide at least one tool');
    }

    if (plugin.tools) {
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
    return {};
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

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    for (const [pluginId, watcher] of this.hotReloadWatchers) {
      await watcher.close();
    }

    this.hotReloadWatchers.clear();
  }
}

/**
 * FS Watcher type
 */
interface FSWatcher {
  close(): Promise<void>;
}
