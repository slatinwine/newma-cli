// src/cache/ai-cache.ts
/**
 * AI 响应缓存包装器
 *
 * 为 AI 调用提供透明的缓存功能
 * 基于请求内容自动缓存响应
 */

import { Config } from '../config';
import { CacheManager, getGlobalCacheManager } from './cache-manager';
import crypto from 'crypto';

/**
 * AI 请求元数据
 */
interface AIRequestMetadata {
  model: string;
  temperature: number;
  maxTokens: number;
  messages: Array<{ role: string; content: string }>;
  /** 请求目标端点——不同端点（真实 API vs mock/代理）绝不能共享缓存 */
  baseUrl?: string;
}

/**
 * AI 缓存响应
 */
interface AICachedResponse {
  content: string;
  timestamp: number;
  model: string;
  tokens?: number;
  todo?: string[];
  actions?: any[];
  done?: boolean;
}

/**
 * AI 缓存包装器
 */
export class AICache {
  private cache: CacheManager;
  private enabled: boolean;

  constructor(cache?: CacheManager, enabled: boolean = true) {
    this.cache = cache || getGlobalCacheManager();
    this.enabled = enabled;
  }

  /**
   * 生成缓存键（优化版）
   *
   * 优化策略：
   * 1. 使用最后一条用户消息 + 系统提示哈希（确保上下文不同的请求返回不同缓存）
   * 2. 对于短请求（<50字符），归一化处理以提高命中率
   * 3. 添加请求长度范围，避免微小差异导致缓存失效
   */
  private generateCacheKey(request: AIRequestMetadata): string {
    // 提取最后一条用户消息（通常是用户的实际输入）
    const lastMessage = request.messages[request.messages.length - 1];
    const userMessage = lastMessage?.content || '';

    // 提取系统提示的哈希（确保不同上下文不会错误命中缓存）
    const systemMessage = request.messages.find(m => m.role === 'system');
    const systemHash = systemMessage
      ? crypto.createHash('md5').update(systemMessage.content).digest('hex').substring(0, 8)
      : 'no-sys';

    // 计算消息长度范围（用于归一化）
    const messageLength = userMessage.length;
    let lengthCategory: string;

    if (messageLength < 50) {
      lengthCategory = 'short';
    } else if (messageLength < 200) {
      lengthCategory = 'medium';
    } else if (messageLength < 1000) {
      lengthCategory = 'long';
    } else {
      lengthCategory = 'very-long';
    }

    // 对于短消息（<50字符），直接使用消息内容
    // 对于长消息，使用消息哈希（避免键过长）
    const messageKey = messageLength < 50
      ? userMessage
      : crypto.createHash('md5').update(userMessage).digest('hex').substring(0, 16);

    // 序列化核心参数（不包含完整messages）
    const serialized = JSON.stringify({
      model: request.model,
      // 端点 origin 参与键：防止 mock/代理的响应被回放给真实 API
      origin: request.baseUrl ? new URL(request.baseUrl).origin : '',
      temperature: Math.round(request.temperature * 10) / 10, // 四舍五入到1位小数
      maxTokens: Math.round(request.maxTokens / 1000) * 1000, // 归整到1000
      messageKey,
      systemHash,
      lengthCategory,
    });

    // 生成哈希
    return `ai:${crypto.createHash('sha256').update(serialized).digest('hex')}`;
  }

  /**
   * 获取缓存的 AI 响应
   *
   * @param request - AI 请求元数据
   * @returns Promise<AICachedResponse | null>
   */
  async get(request: AIRequestMetadata): Promise<AICachedResponse | null> {
    if (!this.enabled) return null;
    if (process.env.NEWMA_CACHE === 'off') return null;

    const key = this.generateCacheKey(request);
    const cached = await this.cache.get<AICachedResponse>(key);

    if (cached) {
      console.log(`✨ 使用缓存响应 (模型: ${request.model})`);
      return cached;
    }

    return null;
  }

  /**
   * 设置 AI 响应缓存
   *
   * @param request - AI 请求元数据
   * @param response - AI 响应
   * @param ttl - 过期时间（默认 1 小时）
   */
  async set(
    request: AIRequestMetadata,
    response: string,
    ttl?: number
  ): Promise<void> {
    if (!this.enabled) return;
    if (process.env.NEWMA_CACHE === 'off') return;

    const key = this.generateCacheKey(request);
    const cachedResponse: AICachedResponse = {
      content: response,
      timestamp: Date.now(),
      model: request.model,
    };

    await this.cache.set(key, cachedResponse, ttl);
  }

  /**
   * 失效特定模型的缓存
   *
   * @param model - 模型名称
   */
  async invalidateModel(model: string): Promise<number> {
    if (!this.enabled) return 0;

    const pattern = new RegExp(`^ai:.*`);
    return await this.cache.invalidate(pattern);
  }

  /**
   * 清空所有 AI 缓存
   */
  async clear(): Promise<void> {
    if (!this.enabled) return;

    await this.cache.invalidate(/ai:/);
  }

  /**
   * 启用/禁用缓存
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * 缓存的 AI 调用包装器
 *
 * 自动为 AI 调用添加缓存层
 */
export function cachedAICall(
  aiCall: (request: AIRequestMetadata) => Promise<string>,
  cache?: AICache
): (request: AIRequestMetadata) => Promise<string> {
  const aiCache = cache || new AICache();

  return async (request: AIRequestMetadata): Promise<string> => {
    // 尝试从缓存获取
    const cached = await aiCache.get(request);
    if (cached) {
      return cached.content;
    }

    // 调用 AI
    const response = await aiCall(request);

    // 缓存响应
    await aiCache.set(request, response);

    return response;
  };
}

/**
 * 创建 AI 请求元数据
 */
export function createAIRequest(
  config: Config,
  messages: Array<{ role: string; content: string }>,
  temperature: number = 0.7,
  maxTokens: number = 2048
): AIRequestMetadata {
  return {
    model: config.model,
    temperature,
    maxTokens,
    messages,
  };
}

/**
 * 获取全局 AI 缓存实例
 */
let globalAICache: AICache | null = null;

export function getGlobalAICache(): AICache {
  if (!globalAICache) {
    globalAICache = new AICache();
  }
  return globalAICache;
}

// 重新导出 CacheManager
export { CacheManager, getGlobalCacheManager } from './cache-manager';
