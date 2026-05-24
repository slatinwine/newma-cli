/**
 * Cached Skill Loader
 *
 * Integrates SkillCache with SkillLoader for automatic caching:
 * - Automatic cache lookups on load
 * - Automatic cache updates on miss
 * - Transparent to users
 *
 * Usage:
 * ```typescript
 * const cachedLoader = new CachedSkillLoader();
 *
 * // First load - from disk
 * const skill1 = await cachedLoader.loadSkill('doc-coauthoring');
 *
 * // Second load - from cache (90% faster)
 * const skill2 = await cachedLoader.loadSkill('doc-coauthoring');
 * ```
 */

import { SkillLoader, SkillLoaderOptions } from './skill-loader';
import { SkillPlugin } from './skill-types';
import { SkillCache, createSkillCache, SkillCacheOptions } from '../cache/skill-cache';

/**
 * Cached skill loader options
 */
export interface CachedSkillLoaderOptions extends SkillLoaderOptions {
  /** Cache options (null to disable caching) */
  cache?: SkillCacheOptions | null;
}

/**
 * Cached Skill Loader
 *
 * Wraps SkillLoader with automatic caching.
 */
export class CachedSkillLoader extends SkillLoader {
  private cache: SkillCache | null;
  private cacheEnabled: boolean;

  constructor(options: CachedSkillLoaderOptions = {}) {
    super(options);

    // Initialize cache
    if (options.cache !== null) {
      this.cache = createSkillCache({
        verbose: options.verbose || false,
        ...options.cache,
      });
      this.cacheEnabled = true;
    } else {
      this.cache = null;
      this.cacheEnabled = false;
    }
  }

  /**
   * Load skill with caching
   *
   * Attempts to load from cache first, falls back to disk.
   *
   * @param skillPath - Path to skill directory
   * @returns Loaded skill
   */
  async loadSkill(skillPath: string): Promise<SkillPlugin> {
    // If caching disabled, use parent implementation
    if (!this.cacheEnabled || !this.cache) {
      return super.loadSkill(skillPath);
    }

    // Try cache first
    const cached = await this.cache.get(skillPath);
    if (cached) {
      return cached;
    }

    // Cache miss - load from disk
    const skill = await super.loadSkill(skillPath);

    // Store in cache
    await this.cache.set(skillPath, skill);

    return skill;
  }

  /**
   * Invalidate skill cache
   *
   * Forces reload from disk on next access.
   *
   * @param skillPath - Path to skill directory
   */
  async invalidateCache(skillPath: string): Promise<void> {
    if (this.cache) {
      await this.cache.invalidate(skillPath);
    }
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    if (this.cache) {
      await this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    if (this.cache) {
      return await this.cache.getStats();
    }
    return null;
  }

  /**
   * Print cache statistics
   */
  async printCacheStats(): Promise<void> {
    if (this.cache) {
      await this.cache.printStats();
    } else {
      console.log('[CachedSkillLoader] Caching is disabled');
    }
  }
}

/**
 * Create a cached skill loader instance
 */
export function createCachedSkillLoader(
  options?: CachedSkillLoaderOptions
): CachedSkillLoader {
  return new CachedSkillLoader(options);
}
