// src/cache/cache-manager.ts
/**
 * 智能缓存管理器
 *
 * 实现多层缓存策略，包括内存缓存和磁盘缓存
 * 基于 LRU 淘汰算法和 TTL 过期策略
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * 缓存条目
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
  hits: number;
}

/**
 * 缓存统计
 */
interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  memoryMaxEntries?: number;    // 内存缓存最大条目数 (默认: 100)
  memoryTTL?: number;           // 内存缓存 TTL (默认: 1小时)
  diskCacheDir?: string;        // 磁盘缓存目录 (默认: ~/.kode/cache)
  diskEnabled?: boolean;        // 是否启用磁盘缓存 (默认: true)
  diskTTL?: number;             // 磁盘缓存 TTL (默认: 24小时)
}

/**
 * LRU (Least Recently Used) 内存缓存
 */
class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxEntries: number;
  private ttl: number;

  constructor(maxEntries: number = 100, ttl: number = 3600000) {
    this.maxEntries = maxEntries;
    this.ttl = ttl;
  }

  /**
   * 获取缓存值
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // 更新访问时间（LRU）
    entry.hits++;
    this.cache.set(key, entry); // 重新插入以更新顺序

    return entry.value;
  }

  /**
   * 设置缓存值
   */
  set(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      value,
      timestamp: now,
      expiresAt: now + (ttl || this.ttl),
      hits: 0,
    };

    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, entry);
  }

  /**
   * 删除缓存值
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 获取所有键
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 获取统计信息
   */
  getStats(): CacheStats {
    let hits = 0;
    let misses = 0;

    for (const entry of this.cache.values()) {
      hits += entry.hits;
    }

    return {
      hits,
      misses: 0,
      evictions: 0,
      size: this.cache.size,
      hitRate: this.cache.size > 0 ? hits / (hits + 1) : 0,
    };
  }
}

/**
 * 磁盘缓存
 */
class DiskCache {
  private cacheDir: string;
  private ttl: number;
  private enabled: boolean;

  constructor(cacheDir: string, ttl: number = 86400000, enabled: boolean = true) {
    this.cacheDir = cacheDir;
    this.ttl = ttl;
    this.enabled = enabled;
  }

  /**
   * 初始化缓存目录
   */
  async init(): Promise<void> {
    if (!this.enabled) return;

    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.warn(`无法创建缓存目录: ${this.cacheDir}`);
      this.enabled = false;
    }
  }

  /**
   * 获取缓存文件路径
   */
  getCachePath(key: string): string {
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    return path.join(this.cacheDir, `${hash}.json`);
  }

  /**
   * 获取缓存值
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) return null;

    try {
      const cachePath = this.getCachePath(key);
      const data = await fs.readFile(cachePath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(data);

      // 检查是否过期
      if (Date.now() > entry.expiresAt) {
        await this.delete(key);
        return null;
      }

      return entry.value;
    } catch (error) {
      // 文件不存在或读取失败
      return null;
    }
  }

  /**
   * 设置缓存值
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.enabled) return;

    try {
      const cachePath = this.getCachePath(key);
      const now = Date.now();
      const entry: CacheEntry<T> = {
        value,
        timestamp: now,
        expiresAt: now + (ttl || this.ttl),
        hits: 0,
      };

      await fs.writeFile(cachePath, JSON.stringify(entry, null, 2), 'utf-8');
    } catch (error) {
      console.warn(`无法写入缓存: ${key}`);
    }
  }

  /**
   * 删除缓存值
   */
  async delete(key: string): Promise<void> {
    if (!this.enabled) return;

    try {
      const cachePath = this.getCachePath(key);
      await fs.unlink(cachePath);
    } catch (error) {
      // 文件不存在，忽略
    }
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    if (!this.enabled) return;

    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.cacheDir, file)))
      );
    } catch (error) {
      console.warn(`无法清空缓存目录: ${this.cacheDir}`);
    }
  }

  /**
   * 清理过期缓存
   */
  async cleanup(): Promise<number> {
    if (!this.enabled) return 0;

    let cleaned = 0;

    try {
      const files = await fs.readdir(this.cacheDir);
      const now = Date.now();

      for (const file of files) {
        try {
          const filePath = path.join(this.cacheDir, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const entry: CacheEntry<any> = JSON.parse(data);

          if (now > entry.expiresAt) {
            await fs.unlink(filePath);
            cleaned++;
          }
        } catch (error) {
          // 读取失败，删除文件
          await fs.unlink(path.join(this.cacheDir, file));
          cleaned++;
        }
      }
    } catch (error) {
      console.warn(`无法清理缓存目录: ${this.cacheDir}`);
    }

    return cleaned;
  }

  /**
   * 获取缓存大小
   */
  async size(): Promise<number> {
    if (!this.enabled) return 0;

    try {
      const files = await fs.readdir(this.cacheDir);
      return files.length;
    } catch (error) {
      return 0;
    }
  }
}

/**
 * 智能缓存管理器
 *
 * 实现多层缓存策略：
 * 1. 内存缓存 (最快，容量有限)
 * 2. 磁盘缓存 (中等，容量较大)
 */
export class CacheManager {
  private memoryCache: LRUCache<any>;
  private diskCache: DiskCache;
  private stats: CacheStats;

  constructor(config: CacheConfig = {}) {
    const {
      memoryMaxEntries = 100,
      memoryTTL = 3600000, // 1小时
      diskCacheDir = path.join(os.homedir(), '.kode', 'cache'),
      diskEnabled = true,
      diskTTL = 86400000, // 24小时
    } = config;

    this.memoryCache = new LRUCache(memoryMaxEntries, memoryTTL);
    this.diskCache = new DiskCache(diskCacheDir, diskTTL, diskEnabled);
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      hitRate: 0,
    };

    // 初始化磁盘缓存
    this.diskCache.init().catch(console.error);
  }

  /**
   * 获取缓存值（多层查找）
   *
   * @param key - 缓存键
   * @returns Promise<T | null>
   */
  async get<T>(key: string): Promise<T | null> {
    // 1. 尝试从内存缓存获取
    const memoryValue = this.memoryCache.get(key) as T | null;
    if (memoryValue !== null) {
      this.stats.hits++;
      this.updateHitRate();
      return memoryValue;
    }

    // 2. 尝试从磁盘缓存获取
    const diskValue = await this.diskCache.get<T>(key);
    if (diskValue !== null) {
      this.stats.hits++;

      // 提升到内存缓存
      this.memoryCache.set(key, diskValue);

      this.updateHitRate();
      return diskValue;
    }

    // 3. 缓存未命中
    this.stats.misses++;
    this.updateHitRate();
    return null;
  }

  /**
   * 设置缓存值（同时写入内存和磁盘）
   *
   * @param key - 缓存键
   * @param value - 缓存值
   * @param ttl - 过期时间（毫秒）
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // 写入内存缓存
    this.memoryCache.set(key, value, ttl);

    // 写入磁盘缓存（异步，不等待）
    this.diskCache.set(key, value, ttl).catch(console.error);

    this.stats.size = this.memoryCache.size() + await this.diskCache.size();
  }

  /**
   * 删除缓存值
   *
   * @param key - 缓存键
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    await this.diskCache.delete(key);

    this.stats.size = this.memoryCache.size() + await this.diskCache.size();
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    await this.diskCache.clear();

    this.stats.size = 0;
  }

  /**
   * 按模式失效缓存
   *
   * @param pattern - 正则表达式模式
   */
  async invalidate(pattern: RegExp): Promise<number> {
    let invalidated = 0;

    // 失效内存缓存
    const memoryKeys = this.memoryCache.keys();
    for (const key of memoryKeys) {
      if (pattern.test(key)) {
        this.memoryCache.delete(key);
        invalidated++;
      }
    }

    // 磁盘缓存需要重建索引才能高效失效，暂时跳过
    // 可以在后台异步清理

    this.stats.size = this.memoryCache.size() + await this.diskCache.size();
    return invalidated;
  }

  /**
   * 清理过期缓存
   */
  async cleanup(): Promise<number> {
    const memoryCleaned = 0; // LRU 自动清理，无需手动
    const diskCleaned = await this.diskCache.cleanup();

    this.stats.size = this.memoryCache.size() + await this.diskCache.size();
    return memoryCleaned + diskCleaned;
  }

  /**
   * 获取统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: this.stats.size,
      hitRate: 0,
    };
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * 生成缓存键
   *
   * @param parts - 键的部分
   * @returns 哈希后的缓存键
   */
  static generateKey(...parts: string[]): string {
    const key = parts.join(':');
    return crypto.createHash('md5').update(key).digest('hex');
  }
}

/**
 * 单例缓存管理器实例
 */
let globalCacheManager: CacheManager | null = null;

/**
 * 获取全局缓存管理器
 */
export function getGlobalCacheManager(config?: CacheConfig): CacheManager {
  if (!globalCacheManager) {
    globalCacheManager = new CacheManager(config);
  }
  return globalCacheManager;
}
