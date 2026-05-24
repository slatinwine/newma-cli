/**
 * Plugin Registry
 *
 * Manages loaded plugins and their state.
 */

import {
  Plugin,
  PluginState,
  PluginFilter,
  PluginResolutionResult,
  PluginDependency,
} from './types';

// Re-export Plugin for use in context.ts
export { Plugin } from './types';
import { satisfies, valid, coerce } from 'semver';

/**
 * Plugin registry manages all loaded plugins
 */
export class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();
  private states: Map<string, PluginState> = new Map();
  private errors: Map<string, Error> = new Map();

  /**
   * Register a plugin
   */
  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin with id "${plugin.id}" already registered`);
    }

    this.plugins.set(plugin.id, plugin);
    this.states.set(plugin.id, PluginState.LOADED);
    this.errors.delete(plugin.id);
  }

  /**
   * Unregister a plugin
   */
  unregister(pluginId: string): void {
    this.plugins.delete(pluginId);
    this.states.delete(pluginId);
    this.errors.delete(pluginId);
  }

  /**
   * Get a plugin by ID
   */
  get(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Check if plugin is loaded
   */
  isLoaded(pluginId: string): boolean {
    return this.plugins.has(pluginId) &&
           this.states.get(pluginId) === PluginState.LOADED;
  }

  /**
   * Get plugin state
   */
  getState(pluginId: string): PluginState | undefined {
    return this.states.get(pluginId);
  }

  /**
   * Set plugin state
   */
  setState(pluginId: string, state: PluginState): void {
    this.states.set(pluginId, state);
  }

  /**
   * Set plugin error
   */
  setError(pluginId: string, error: Error): void {
    this.errors.set(pluginId, error);
    this.states.set(pluginId, PluginState.ERROR);
  }

  /**
   * Get plugin error
   */
  getError(pluginId: string): Error | undefined {
    return this.errors.get(pluginId);
  }

  /**
   * List all plugins
   */
  list(filter?: PluginFilter): Plugin[] {
    let plugins = Array.from(this.plugins.values());

    if (filter) {
      if (filter.state) {
        plugins = plugins.filter(p => this.states.get(p.id) === filter.state);
      }

      if (filter.tags && filter.tags.length > 0) {
        plugins = plugins.filter(p =>
          p.metadata?.tags?.some(tag => filter.tags!.includes(tag))
        );
      }

      if (filter.dependsOn) {
        plugins = plugins.filter(p =>
          p.dependencies?.some(d => d.pluginId === filter.dependsOn)
        );
      }
    }

    return plugins;
  }

  /**
   * Get all plugin IDs
   */
  getPluginIds(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Get plugin count
   */
  getCount(): number {
    return this.plugins.size;
  }

  /**
   * Resolve plugin dependencies
   */
  resolveDependencies(plugin: Plugin): PluginResolutionResult {
    if (!plugin.dependencies || plugin.dependencies.length === 0) {
      return {
        satisfied: true,
        order: [plugin.id],
      };
    }

    const missing: string[] = [];
    const conflicts: Array<{
      pluginId: string;
      required: string;
      found: string;
    }> = [];

    // Check for missing dependencies
    for (const dep of plugin.dependencies) {
      const depPlugin = this.get(dep.pluginId);

      if (!depPlugin) {
        missing.push(dep.pluginId);
        continue;
      }

      // Check version constraints
      if (dep.minVersion || dep.maxVersion) {
        const foundVersion = coerce(depPlugin.version);

        if (!foundVersion || !valid(foundVersion)) {
          conflicts.push({
            pluginId: dep.pluginId,
            required: `${dep.minVersion || ''} - ${dep.maxVersion || ''}`,
            found: depPlugin.version,
          });
          continue;
        }

        if (dep.minVersion && !satisfies(foundVersion, `>=${dep.minVersion}`)) {
          conflicts.push({
            pluginId: dep.pluginId,
            required: `>=${dep.minVersion}`,
            found: depPlugin.version,
          });
        }

        if (dep.maxVersion && !satisfies(foundVersion, `<=${dep.maxVersion}`)) {
          conflicts.push({
            pluginId: dep.pluginId,
            required: `<=${dep.maxVersion}`,
            found: depPlugin.version,
          });
        }
      }
    }

    // Build dependency order (simple topological sort)
    const order = this.buildDependencyOrder([plugin, ...this.list()]);

    return {
      satisfied: missing.length === 0 && conflicts.length === 0,
      missing: missing.length > 0 ? missing : undefined,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
      order,
    };
  }

  /**
   * Build dependency load order (topological sort)
   */
  private buildDependencyOrder(plugins: Plugin[]): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (pluginId: string) => {
      if (visited.has(pluginId)) {
        return;
      }

      if (visiting.has(pluginId)) {
        // Circular dependency - skip
        return;
      }

      visiting.add(pluginId);

      const plugin = plugins.find(p => p.id === pluginId);
      if (plugin?.dependencies) {
        for (const dep of plugin.dependencies) {
          visit(dep.pluginId);
        }
      }

      visiting.delete(pluginId);
      visited.add(pluginId);
      order.push(pluginId);
    };

    for (const plugin of plugins) {
      visit(plugin.id);
    }

    return order;
  }

  /**
   * Get plugin statistics
   */
  getStats(): {
    total: number;
    byState: Record<string, number>;
    withErrors: number;
  } {
    const stats = {
      total: this.plugins.size,
      byState: {} as Record<string, number>,
      withErrors: 0,
    };

    for (const state of this.states.values()) {
      stats.byState[state] = (stats.byState[state] || 0) + 1;
    }

    stats.withErrors = this.errors.size;

    return stats;
  }

  /**
   * Clear all plugins
   */
  clear(): void {
    this.plugins.clear();
    this.states.clear();
    this.errors.clear();
  }
}
