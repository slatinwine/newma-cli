/**
 * Section Cache Manager
 * Caches skill sections to avoid redundant loading and improve performance
 */

import { SkillReference } from './types';

export interface CacheEntry {
  name: string;
  path: string;
  content: string;
  tokens: number;
  loaded: boolean;
  timestamp: number;
  accessCount: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  totalTokens: number;
  entries: Array<{
    key: string;
    name: string;
    tokens: number;
    accessCount: number;
  }>;
}

/**
 * Section Cache
 * LRU (Least Recently Used) cache for skill sections
 */
export class SectionCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private maxTokens: number;
  private hits: number;
  private misses: number;

  constructor(options?: { maxSize?: number; maxTokens?: number }) {
    this.cache = new Map();
    this.maxSize = options?.maxSize || 100; // Maximum number of entries
    this.maxTokens = options?.maxTokens || 100000; // Maximum total tokens (100k)
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get a cached entry
   */
  get(key: string): CacheEntry | undefined {
    const entry = this.cache.get(key);

    if (entry) {
      // Update access metadata
      entry.accessCount++;
      entry.timestamp = Date.now();
      this.hits++;

      return entry;
    }

    this.misses++;
    return undefined;
  }

  /**
   * Set a cache entry
   */
  set(key: string, reference: Omit<SkillReference, 'loaded'>): void {
    // Check if we need to evict entries
    this.evictIfNeeded(reference.tokens);

    // Create cache entry
    const entry: CacheEntry = {
      name: reference.name,
      path: reference.path,
      content: reference.content,
      tokens: reference.tokens,
      loaded: true,
      timestamp: Date.now(),
      accessCount: 1,
    };

    this.cache.set(key, entry);
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete a specific entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries for a specific skill
   */
  clearSkill(skillId: string): number {
    let count = 0;

    for (const key of this.cache.keys()) {
      if (key.startsWith(`${skillId}:`)) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Evict entries if cache is full
   * Uses LRU strategy
   */
  private evictIfNeeded(newTokens: number): void {
    // Check size limit
    while (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    // Check token limit
    const currentTokens = this.getTotalTokens();
    while (currentTokens + newTokens > this.maxTokens && this.cache.size > 0) {
      this.evictLRU();
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get total tokens in cache
   */
  private getTotalTokens(): number {
    let total = 0;

    for (const entry of this.cache.values()) {
      total += entry.tokens;
    }

    return total;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      name: entry.name,
      tokens: entry.tokens,
      accessCount: entry.accessCount,
    }));

    // Sort by access count descending
    entries.sort((a, b) => b.accessCount - a.accessCount);

    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0
        ? this.hits / (this.hits + this.misses)
        : 0,
      totalTokens: this.getTotalTokens(),
      entries,
    };
  }

  /**
   * Get cache size (number of entries)
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all entries
   */
  entries(): Map<string, CacheEntry> {
    return new Map(this.cache);
  }

  /**
   * Warm up cache with multiple entries
   */
  warmUp(entries: Array<{ key: string; reference: Omit<SkillReference, 'loaded'> }>): void {
    for (const { key, reference } of entries) {
      if (!this.has(key)) {
        this.set(key, reference);
      }
    }
  }

  /**
   * Export cache state (for persistence)
   */
  export(): Record<string, CacheEntry> {
    const obj: Record<string, CacheEntry> = {};

    for (const [key, entry] of this.cache.entries()) {
      obj[key] = entry;
    }

    return obj;
  }

  /**
   * Import cache state (for persistence)
   */
  import(data: Record<string, CacheEntry>): void {
    this.clear();

    for (const [key, entry] of Object.entries(data)) {
      this.cache.set(key, entry);
    }
  }

  /**
   * Get entries by access pattern
   */
  getAccessPattern(): {
    hot: string[]; // Frequently accessed
    warm: string[]; // Moderately accessed
    cold: string[]; // Rarely accessed
  } {
    const entries = Array.from(this.cache.entries());

    const hot: string[] = [];
    const warm: string[] = [];
    const cold: string[] = [];

    entries.forEach(([key, entry]) => {
      if (entry.accessCount >= 10) {
        hot.push(key);
      } else if (entry.accessCount >= 3) {
        warm.push(key);
      } else {
        cold.push(key);
      }
    });

    return { hot, warm, cold };
  }

  /**
   * Optimize cache based on access patterns
   */
  optimize(): void {
    const pattern = this.getAccessPattern();

    // Preload hot entries (they're already cached, just ensure priority)
    // Consider evicting cold entries if cache is under pressure
    if (this.cache.size >= this.maxSize * 0.9) {
      // Cache is nearly full, evict cold entries first
      for (const key of pattern.cold) {
        if (this.cache.size >= this.maxSize * 0.7) {
          this.delete(key);
        }
      }
    }
  }

  /**
   * Get memory usage estimate
   */
  getMemoryUsage(): {
    entries: number;
    totalTokens: number;
    estimatedBytes: number;
  } {
    let totalChars = 0;

    for (const entry of this.cache.values()) {
      totalChars += entry.content.length;
      // Add overhead for other fields
      totalChars += entry.name.length;
      totalChars += entry.path.length;
    }

    // Rough estimate: 1 char ≈ 2 bytes (UTF-16)
    const estimatedBytes = totalChars * 2;

    return {
      entries: this.cache.size,
      totalTokens: this.getTotalTokens(),
      estimatedBytes,
    };
  }
}

/**
 * Create a section cache instance
 */
export function createSectionCache(options?: {
  maxSize?: number;
  maxTokens?: number;
}): SectionCache {
  return new SectionCache(options);
}

/**
 * Global shared cache instance
 */
let globalCache: SectionCache | undefined;

/**
 * Get or create global cache
 */
export function getGlobalCache(): SectionCache {
  if (!globalCache) {
    globalCache = new SectionCache();
  }

  return globalCache;
}

/**
 * Reset global cache
 */
export function resetGlobalCache(): void {
  if (globalCache) {
    globalCache.clear();
  }
}
