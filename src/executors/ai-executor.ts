/**
 * Newma AI Executor
 *
 * AI 执行器 - 处理 AI 请求和响应
 */

import { Executor, ExecutorContext, ExecutorResult, success, failure } from './types';
import {
  CoreEventType,
  AIRequestEvent,
  AIResponseEvent,
  AIMessage,
  AITool,
} from '../core/types';
import { createAIResponseEvent, createErrorEvent } from '../core/event';

// ============================================================================
// AI 配置
// ============================================================================

/**
 * AI 配置
 */
export interface AIConfig {
  /** 模型名称 */
  model?: string;
  /** API 密钥 */
  apiKey?: string;
  /** 基础 URL */
  baseUrl?: string;
  /** 温度 */
  temperature?: number;
  /** 最大 Token */
  maxTokens?: number;
  /** 其他参数 */
  extra?: Record<string, unknown>;
}

// ============================================================================
// AI 客户端接口
// ============================================================================

/**
 * AI 客户端接口
 */
export interface AIClient {
  /**
   * 发送请求
   */
  send(
    messages: AIMessage[],
    tools?: AITool[],
    config?: AIConfig
  ): Promise<AIResponse>;
}

/**
 * AI 响应
 */
export interface AIResponse {
  message: AIMessage;
  toolCalls?: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;
  reasoning?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ============================================================================
// AI 执行器
// ============================================================================

/**
 * AI 执行器配置
 */
export interface AIExecutorConfig {
  /** AI 客户端 */
  client: AIClient;
  /** 默认配置 */
  defaultConfig?: AIConfig;
  /** 请求超时（毫秒） */
  timeout?: number;
  /** 重试次数 */
  retries?: number;
}

/**
 * AI 执行器
 */
export class AIExecutor implements Executor<AIRequestEvent> {
  readonly name = 'ai-executor';
  readonly eventType = CoreEventType.AI_REQUEST;
  readonly priority = 20;

  private client: AIClient;
  private defaultConfig?: AIConfig;
  private timeout: number;
  private retries: number;

  constructor(config: AIExecutorConfig) {
    this.client = config.client;
    this.defaultConfig = config.defaultConfig;
    this.timeout = config.timeout ?? 120000;
    this.retries = config.retries ?? 3;
  }

  async execute(event: AIRequestEvent, context: ExecutorContext): Promise<ExecutorResult> {
    const { messages, tools, context: aiContext } = event.payload;

    // 合并配置
    const config: AIConfig = {
      ...this.defaultConfig,
      ...(aiContext?.extra?.aiConfig as AIConfig | undefined),
    };

    let lastError: Error | null = null;

    // 重试逻辑
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        // 发送请求（带超时）
        const response = await this.executeWithTimeout(
          this.client.send(messages, tools, config),
          this.timeout,
          context.signal
        );

        // 构建后续事件
        const nextEvents = [
          createAIResponseEvent(
            response.message,
            response.toolCalls,
            response.reasoning,
            { correlationId: event.correlationId }
          ),
        ];

        return success(response, {
          nextEvents,
          message: `AI response received (${response.usage?.totalTokens ?? 0} tokens)`,
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 检查是否可重试
        if (!this.isRetryable(lastError)) {
          break;
        }

        // 等待一段时间后重试
        if (attempt < this.retries) {
          await this.sleep(1000 * (attempt + 1));
        }
      }
    }

    // 所有重试都失败
    return failure(lastError!, {
      recoverable: false,
      nextEvents: [createErrorEvent(lastError!, true)],
    });
  }

  /**
   * 检查错误是否可重试
   */
  private isRetryable(error: Error): boolean {
    // 网络错误、超时、5xx 错误可重试
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
      /5\d{2}/,
      /rate limit/i,
      /overloaded/i,
    ];

    return retryablePatterns.some((pattern) => pattern.test(error.message));
  }

  /**
   * 带超时执行
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeout: number,
    signal?: AbortSignal
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`AI request timeout after ${timeout}ms`));
      }, timeout);

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('AI request aborted'));
        });
      }

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 创建 AI 执行器
 */
export function createAIExecutor(config: AIExecutorConfig): AIExecutor {
  return new AIExecutor(config);
}

/**
 * 空的 AI 客户端（用于测试）
 */
export class MockAIClient implements AIClient {
  async send(messages: AIMessage[]): Promise<AIResponse> {
    return {
      message: {
        role: 'assistant',
        content: 'This is a mock response.',
      },
    };
  }
}
