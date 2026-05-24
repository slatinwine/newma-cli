/**
 * Hook Loader
 *
 * Loads user-defined hooks from the filesystem.
 */

import { Hook, HookType, HookSystemConfig } from './types';
import { HookRegistry } from './registry';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Hook loader loads hooks from .kode/hooks/ directory
 */
export class HookLoader {
  private registry: HookRegistry;
  private config: HookSystemConfig;

  constructor(registry: HookRegistry, config: HookSystemConfig) {
    this.registry = registry;
    this.config = config;
  }

  /**
   * Load all hooks from the configured directory
   */
  async loadAll(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const hooksDir = this.config.directory;

    try {
      await fs.access(hooksDir);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(hooksDir, { recursive: true });
      return;
    }

    // Load hooks for each type
    for (const hookType of Object.values(HookType)) {
      await this.loadHooksForType(hookType);
    }
  }

  /**
   * Load hooks for a specific type
   */
  async loadHooksForType(type: HookType): Promise<void> {
    const typeDir = path.join(this.config.directory, type);

    try {
      const files = await fs.readdir(typeDir);
      const hookFiles = files.filter(
        file => file.endsWith('.ts') || file.endsWith('.js')
      );

      for (const file of hookFiles) {
        await this.loadHookFile(type, path.join(typeDir, file));
      }
    } catch {
      // Type directory doesn't exist, skip
    }
  }

  /**
   * Load a single hook file
   */
  private async loadHookFile(
    type: HookType,
    filePath: string
  ): Promise<void> {
    try {
      // Dynamic import (requires ts-node or transpiled JS)
      // Note: This is simplified - production should use proper module loading
      const module = await import(filePath);
      const hookFunction = module.default;

      if (typeof hookFunction !== 'function') {
        console.warn(
          `[HOOK] Invalid hook file: ${filePath} (no default export)`
        );
        return;
      }

      // Create hook object
      const hookName = path.basename(filePath, path.extname(filePath));
      const hook: Hook = {
        id: `${type}:${hookName}`,
        type,
        name: hookName,
        description: module.description || `Hook loaded from ${filePath}`,
        handler: hookFunction,
        priority: module.priority || 100,
        enabled: module.enabled !== false,
        metadata: {
          filePath,
        },
      };

      this.registry.register(hook);
    } catch (error) {
      console.error(`[HOOK] Failed to load hook from ${filePath}:`, error);
    }
  }

  /**
   * Reload all hooks (clears and reloads)
   */
  async reload(): Promise<void> {
    this.registry.clear();
    await this.loadAll();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HookSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
