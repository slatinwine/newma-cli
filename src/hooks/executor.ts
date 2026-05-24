/**
 * Hook Executor
 *
 * Executes hooks with error handling and timeout protection.
 */

import { Hook, HookType, HookContext, HookExecutionResult, HookSystemConfig } from './types';
import { HookRegistry } from './registry';
import chalk from 'chalk';

/**
 * Hook executor handles running hooks with safety features
 */
export class HookExecutor {
  private registry: HookRegistry;
  private config: HookSystemConfig;

  constructor(registry: HookRegistry, config: HookSystemConfig) {
    this.registry = registry;
    this.config = config;
  }

  /**
   * Execute all hooks for a specific type
   */
  async execute(
    type: HookType,
    context: Omit<HookContext, 'type' | 'timestamp'>
  ): Promise<HookExecutionResult[]> {
    // Skip if hook system is disabled
    if (!this.config.enabled) {
      return [];
    }

    const hooks = this.registry.getHooks(type);

    if (hooks.length === 0) {
      return [];
    }

    const results: HookExecutionResult[] = [];

    for (const hook of hooks) {
      const result = await this.executeHook(hook, {
        ...context,
        type,
        timestamp: new Date(),
      });

      results.push(result);
    }

    return results;
  }

  /**
   * Execute a single hook with error handling and timeout
   */
  private async executeHook(
    hook: Hook,
    context: HookContext
  ): Promise<HookExecutionResult> {
    const startTime = Date.now();
    let success = false;
    let error: Error | undefined;

    try {
      if (this.config.verbose) {
        console.log(
          chalk.gray(`[HOOK] Executing: ${hook.name} (${hook.type})`)
        );
      }

      // Execute with timeout
      await Promise.race([
        hook.handler(context),
        this.createTimeout(this.config.timeout),
      ]);

      success = true;

      if (this.config.verbose) {
        const duration = Date.now() - startTime;
        console.log(
          chalk.gray(`[HOOK] ✓ ${hook.name} completed in ${duration}ms`)
        );
      }
    } catch (err) {
      error = err as Error;
      success = false;

      if (this.config.verbose) {
        console.error(
          chalk.red(`[HOOK] ✗ ${hook.name} failed: ${error.message}`)
        );
      }
    }

    return {
      hook,
      success,
      duration: Date.now() - startTime,
      error,
    };
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Hook execution timeout after ${ms}ms`));
      }, ms);
    });
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HookSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): HookSystemConfig {
    return { ...this.config };
  }
}
