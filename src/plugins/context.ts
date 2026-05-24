/**
 * Plugin Context
 *
 * Provides context and utilities for plugins.
 */

import { PluginContext as IPluginContext, PluginLogger } from './types';
import { ToolRegistry } from '../tools/registry';
import { HookSystem } from '../hooks';
import { Plugin, PluginRegistry } from './registry';
import chalk from 'chalk';

/**
 * Plugin context implementation
 */
export class PluginContextImpl implements IPluginContext {
  private plugin: Plugin;
  private pluginRegistry: PluginRegistry;

  constructor(
    plugin: Plugin,
    pluginRoot: string,
    projectRoot: string,
    config: Record<string, unknown>,
    toolRegistry: ToolRegistry,
    hookSystem: HookSystem,
    pluginRegistry: PluginRegistry
  ) {
    this.plugin = plugin;
    this.pluginRoot = pluginRoot;
    this.projectRoot = projectRoot;
    this.config = config;
    this.toolRegistry = toolRegistry;
    this.hookSystem = hookSystem;
    this.pluginRegistry = pluginRegistry;
    this.logger = new PluginLoggerImpl(plugin.id);
  }

  pluginRoot: string;
  projectRoot: string;
  config: Record<string, unknown>;
  toolRegistry: ToolRegistry;
  hookSystem: HookSystem;
  logger: PluginLogger;

  /**
   * Get another loaded plugin
   */
  getPlugin(id: string): Plugin | undefined {
    return this.pluginRegistry.get(id);
  }
}

/**
 * Plugin logger implementation
 */
export class PluginLoggerImpl implements PluginLogger {
  private prefix: string;

  constructor(pluginId: string) {
    this.prefix = `[PLUGIN:${pluginId}]`;
  }

  debug(message: string, ...args: unknown[]): void {
    console.log(chalk.gray(`${this.prefix} ${message}`), ...args);
  }

  info(message: string, ...args: unknown[]): void {
    console.log(chalk.cyan(`${this.prefix} ${message}`), ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.log(chalk.yellow(`${this.prefix} ⚠️  ${message}`), ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(chalk.red(`${this.prefix} ❌ ${message}`), ...args);
  }
}

/**
 * Create plugin context
 */
export function createPluginContext(
  plugin: Plugin,
  pluginRoot: string,
  projectRoot: string,
  config: Record<string, unknown>,
  toolRegistry: ToolRegistry,
  hookSystem: HookSystem,
  pluginRegistry: PluginRegistry
): IPluginContext {
  return new PluginContextImpl(
    plugin,
    pluginRoot,
    projectRoot,
    config,
    toolRegistry,
    hookSystem,
    pluginRegistry
  );
}
