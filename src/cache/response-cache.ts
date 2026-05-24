// src/cache/response-cache.ts
/**
 * Response Cache
 *
 * 缓存 AI 响应以提高性能和降低 API 调用
 * 支持 TTL（过期时间）和内存存储
 */

import { v4 as uuidv4 } from 'uuid';

export interface CachedResponse {
  response: string; // 完整的 JSON 响应字符串
  timestamp: number; // 缓存时间
  expiresAt: number; // 过期时间
  tokens?: number; // 可选：使用的 tokens（用于分析）
}

export class ResponseCache {
  private cache = new Map<string, CachedResponse>();
  private defaultTTL: number = 3600000; // 默认 1 小时
  private hits = 0;
  private misses = 0;

  constructor(ttl: number = 3600000) {
    this.defaultTTL = ttl;
  }

  /**
   * 生成缓存 key
   */
  private generateKey(model: string, messages: any[], temperature: number, maxTokens: number): string {
    // 创建规范化 key：包含所有关键参数
    const keyParts = [
      model,
      JSON.stringify(messages),
      temperature.toString(),
      maxTokens.toString()
    ];
    return keyParts.join(':');
  }

  /**
   * 生成缓存 key 的 hash
   */
  private hashKey(key: string): string {
    // 简单的 hash 算法
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
    }
    return (hash >>> 0).toString(); // 转为正整数并转为字符串
  }

  /**
   * 获取缓存值
   */
  get(model: string, messages: any[], temperature: number, maxTokens: number): string | null {
    const key = this.generateKey(model, messages, temperature, maxTokens);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // 检查是否过期
    const now = Date.now();
    if (now > cached.expiresAt) {
      // 缓存已过期
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // 缓存命中
    this.hits++;
    return cached.response;
  }

  /**
   * 设置缓存值
   */
  set(
    model: string,
    messages: any[],
    temperature: number,
    maxTokens: number,
    response: string,
    options?: {
      ttl?: number; // 自定义过期时间
      tokens?: number; // 可选：记录使用的 tokens
    }
  ): void {
    const key = this.generateKey(model, messages, temperature, maxTokens);
    const now = Date.now();
    const ttl = options?.ttl ?? this.defaultTTL;

    this.cache.set(key, {
      response,
      timestamp: now,
      expiresAt: now + ttl,
      tokens: options?.tokens
    });
  }

  /**
   * 清除过期缓存
   */
  cleanExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, cached] of this.cache.entries()) {
      if (cached.expiresAt < now) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * 获取统计信息
   */
  getStats(): { size: number; hits: number; misses: number; hitRate: string } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(2) : '0.00'
    };
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}
