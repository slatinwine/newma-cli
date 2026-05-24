/**
 * Newma Tool Executor
 *
 * 工具执行器 - 执行工具调用
 */

import { Executor, ExecutorContext, ExecutorResult, success, failure } from './types';
import { CoreEventType, ToolCallEvent } from '../core/types';
import { createToolResultEvent } from '../core/event';

// ============================================================================
// 工具类型
// ============================================================================

/**
 * 工具定义
 */
export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (
    args: Record<string, unknown>,
    context: ExecutorContext
  ) => Promise<unknown>;
}

/**
 * 工具注册表
 */
export type ToolRegistry = Map<string, Tool>;

// ============================================================================
// 工具执行器
// ============================================================================

/**
 * 工具执行器配置
 */
export interface ToolExecutorConfig {
  /** 工具注册表 */
  toolRegistry: ToolRegistry;
  /** 执行超时（毫秒） */
  timeout?: number;
  /** 是否在错误时继续 */
  continueOnError?: boolean;
}

/**
 * 工具执行器
 */
export class ToolExecutor implements Executor<ToolCallEvent> {
  readonly name = 'tool-executor';
  readonly eventType = CoreEventType.TOOL_CALL;
  readonly priority = 10;

  private toolRegistry: ToolRegistry;
  private timeout: number;
  private continueOnError: boolean;

  constructor(config: ToolExecutorConfig) {
    this.toolRegistry = config.toolRegistry;
    this.timeout = config.timeout ?? 60000;
    this.continueOnError = config.continueOnError ?? false;
  }

  async execute(event: ToolCallEvent, context: ExecutorContext): Promise<ExecutorResult> {
    const { toolCallId, toolName, args } = event.payload;

    // 查找工具
    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      return failure(new Error(`Unknown tool: ${toolName}`), {
        recoverable: false,
        nextEvents: [
          createToolResultEvent(toolCallId, { error: `Unknown tool: ${toolName}` }, true),
        ],
      });
    }

    try {
      // 执行工具（带超时）
      const result = await this.executeWithTimeout(
        tool.execute(args, context),
        this.timeout,
        context.signal
      );

      return success(result, {
        nextEvents: [createToolResultEvent(toolCallId, result, false)],
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      return failure(err, {
        recoverable: this.continueOnError,
        nextEvents: [createToolResultEvent(toolCallId, { error: err.message }, true)],
      });
    }
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
        reject(new Error(`Tool execution timeout after ${timeout}ms`));
      }, timeout);

      // 监听中断信号
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('Tool execution aborted'));
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
}

// ============================================================================
// 工具注册表工具函数
// ============================================================================

/**
 * 创建工具注册表
 */
export function createToolRegistry(): ToolRegistry {
  return new Map<string, Tool>();
}

/**
 * 注册工具
 */
export function registerTool(registry: ToolRegistry, tool: Tool): void {
  registry.set(tool.name, tool);
}

/**
 * 批量注册工具
 */
export function registerTools(registry: ToolRegistry, tools: Tool[]): void {
  for (const tool of tools) {
    registerTool(registry, tool);
  }
}

/**
 * 创建工具执行器
 */
export function createToolExecutor(config: ToolExecutorConfig): ToolExecutor {
  return new ToolExecutor(config);
}
