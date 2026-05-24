/**
 * Hook System
 *
 * Main entry point for the hook system. Coordinates registry, executor, and loader.
 */

import { Hook, HookType, HookContext, HookExecutionResult, HookSystemConfig } from './types';
import { HookRegistry } from './registry';
import { HookExecutor } from './executor';
import { HookLoader } from './loader';

/**
 * Hook system coordinates all hook-related functionality
 */
export class HookSystem {
  private registry: HookRegistry;
  private executor: HookExecutor;
  private loader: HookLoader;
  private config: HookSystemConfig;

  constructor(config?: Partial<HookSystemConfig>) {
    this.config = {
      enabled: config?.enabled ?? false,
      directory: config?.directory ?? '.kode/hooks',
      timeout: config?.timeout ?? 5000,
      verbose: config?.verbose ?? false,
    };

    this.registry = new HookRegistry();
    this.executor = new HookExecutor(this.registry, this.config);
    this.loader = new HookLoader(this.registry, this.config);
  }

  /**
   * Initialize hook system (load user hooks)
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    await this.loader.loadAll();
  }

  /**
   * Register a hook programmatically
   */
  registerHook(hook: Hook): void {
    this.registry.register(hook);
  }

  /**
   * Unregister a hook
   */
  unregisterHook(hookId: string, type?: HookType): boolean {
    return this.registry.unregister(hookId, type);
  }

  /**
   * Execute all hooks for a specific type
   */
  async execute(
    type: HookType,
    context: Omit<HookContext, 'type' | 'timestamp'>
  ): Promise<HookExecutionResult[]> {
    return this.executor.execute(type, context);
  }

  /**
   * Check if any hooks are registered for a type
   */
  hasHooks(type: HookType): boolean {
    return this.registry.hasHooks(type);
  }

  /**
   * Get hook statistics
   */
  getStats(): {
    total: number;
    byType: Record<string, number>;
    enabled: number;
    disabled: number;
  } {
    return this.registry.getStats();
  }

  /**
   * Get all hooks
   */
  getAllHooks(): Map<HookType, Hook[]> {
    return this.registry.getAllHooks();
  }

  /**
   * Enable or disable hook system
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.executor.updateConfig({ enabled });
    this.loader.updateConfig({ enabled });
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HookSystemConfig>): void {
    this.config = { ...this.config, ...config };
    this.executor.updateConfig(this.config);
    this.loader.updateConfig(this.config);
  }

  /**
   * Reload hooks from filesystem
   */
  async reload(): Promise<void> {
    await this.loader.reload();
  }

  /**
   * Clear all hooks
   */
  clear(): void {
    this.registry.clear();
  }

  /**
   * Get current configuration
   */
  getConfig(): HookSystemConfig {
    return { ...this.config };
  }

  /**
   * Enable or disable verbose logging
   */
  setVerbose(verbose: boolean): void {
    this.config.verbose = verbose;
    this.executor.updateConfig(this.config);
  }

  /**
   * Enable or disable a specific hook
   */
  setHookEnabled(hookId: string, type: HookType, enabled: boolean): boolean {
    return this.registry.setHookEnabled(hookId, type, enabled);
  }
}

// Export all types and classes
export * from './types';
export { HookRegistry } from './registry';
export { HookExecutor } from './executor';
export { HookLoader } from './loader';
