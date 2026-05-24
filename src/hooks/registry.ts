/**
 * Hook Registry
 *
 * Manages registration and retrieval of hooks.
 */

import { Hook, HookType, HookContext, HookExecutionResult } from './types';

/**
 * Hook registry manages all registered hooks
 */
export class HookRegistry {
  private hooks: Map<HookType, Map<string, Hook>> = new Map();

  /**
   * Register a hook
   */
  register(hook: Hook): void {
    const { type, id } = hook;

    if (!this.hooks.has(type)) {
      this.hooks.set(type, new Map());
    }

    const typeHooks = this.hooks.get(type)!;

    if (typeHooks.has(id)) {
      throw new Error(`Hook with id "${id}" already registered for type "${type}"`);
    }

    typeHooks.set(id, hook);
  }

  /**
   * Unregister a hook
   */
  unregister(hookId: string, type?: HookType): boolean {
    if (type) {
      const typeHooks = this.hooks.get(type);
      if (!typeHooks) return false;

      return typeHooks.delete(hookId);
    } else {
      // Search all types
      for (const [, typeHooks] of this.hooks.entries()) {
        if (typeHooks.delete(hookId)) {
          return true;
        }
      }
      return false;
    }
  }

  /**
   * Get a specific hook
   */
  getHook(hookId: string, type: HookType): Hook | undefined {
    const typeHooks = this.hooks.get(type);
    return typeHooks?.get(hookId);
  }

  /**
   * Get all hooks for a specific type
   */
  getHooks(type: HookType): Hook[] {
    const typeHooks = this.hooks.get(type);
    if (!typeHooks) {
      return [];
    }

    // Return only enabled hooks, sorted by priority
    return Array.from(typeHooks.values())
      .filter(hook => hook.enabled !== false)
      .sort((a, b) => (a.priority || 100) - (b.priority || 100));
  }

  /**
   * Get all registered hooks
   */
  getAllHooks(): Map<HookType, Hook[]> {
    const allHooks = new Map<HookType, Hook[]>();

    for (const [type] of this.hooks.entries()) {
      allHooks.set(type, this.getHooks(type));
    }

    return allHooks;
  }

  /**
   * Check if any hooks are registered for a type
   */
  hasHooks(type: HookType): boolean {
    return this.getHooks(type).length > 0;
  }

  /**
   * Clear all hooks
   */
  clear(): void {
    this.hooks.clear();
  }

  /**
   * Clear hooks for a specific type
   */
  clearType(type: HookType): void {
    this.hooks.delete(type);
  }

  /**
   * Get hook count for a type
   */
  getCount(type: HookType): number {
    return this.getHooks(type).length;
  }

  /**
   * Get total hook count
   */
  getTotalCount(): number {
    let count = 0;
    for (const [, typeHooks] of this.hooks.entries()) {
      count += typeHooks.size;
    }
    return count;
  }

  /**
   * Enable or disable a hook
   */
  setHookEnabled(hookId: string, type: HookType, enabled: boolean): boolean {
    const hook = this.getHook(hookId, type);
    if (!hook) return false;

    hook.enabled = enabled;
    return true;
  }

  /**
   * Get statistics about registered hooks
   */
  getStats(): {
    total: number;
    byType: Record<string, number>;
    enabled: number;
    disabled: number;
  } {
    const stats = {
      total: 0,
      byType: {} as Record<string, number>,
      enabled: 0,
      disabled: 0,
    };

    for (const [type, typeHooks] of this.hooks.entries()) {
      const count = typeHooks.size;
      stats.total += count;
      stats.byType[type] = count;

      for (const hook of typeHooks.values()) {
        if (hook.enabled !== false) {
          stats.enabled++;
        } else {
          stats.disabled++;
        }
      }
    }

    return stats;
  }
}
