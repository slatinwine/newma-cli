/**
 * Tool Executor Adapter
 *
 * 适配器模式 - 将现有 ToolExecutor 适配到新的 Executor 接口
 * 实现双轨运行，允许新旧系统并存
 */

import { Executor, ExecutorContext, ExecutorResult, success, failure } from './types';
import { CoreEventType, ToolCallEvent } from '../core/types';
import { ToolExecutor } from '../executor-v2';
import { ToolCall, ToolResult } from '../tools/types';

// ============================================================================
// 适配器配置
// ============================================================================

/**
 * 适配器配置
 */
export interface ToolExecutorAdapterConfig {
  /** 是否启用详细日志 */
  debug?: boolean;
  /** 是否自动追踪执行历史 */
  enableTracking?: boolean;
}

// ============================================================================
// ToolExecutor 适配器
// ============================================================================

/**
 * ToolExecutor 适配器
 *
 * 将现有的 ToolExecutor 适配到新的 Executor 接口
 * 使其可以在新的事件循环系统中使用
 */
export class ToolExecutorAdapter implements Executor<ToolCallEvent> {
  readonly name = 'tool-executor-adapter';
  readonly eventType = CoreEventType.TOOL_CALL;
  readonly priority = 10; // 高优先级

  private toolExecutor: ToolExecutor;
  private config: ToolExecutorAdapterConfig;

  constructor(
    toolExecutor: ToolExecutor,
    config: ToolExecutorAdapterConfig = {}
  ) {
    this.toolExecutor = toolExecutor;
    this.config = {
      debug: false,
      enableTracking: true,
      ...config,
    };
  }

  /**
   * 执行工具调用
   *
   * 将 CoreEvent 转换为 ToolCall，调用现有的 ToolExecutor，
   * 然后将 ToolResult 转换回 ExecutorResult
   */
  async execute(event: ToolCallEvent, context: ExecutorContext): Promise<ExecutorResult> {
    const startTime = Date.now();

    try {
      // 1. 转换 CoreEvent → ToolCall
      const toolCall: ToolCall = this.convertEventToToolCall(event);

      this.log(`[Adapter] Executing tool: ${toolCall.tool}`);
      this.log(`[Adapter] Parameters:`, JSON.stringify(toolCall.parameters, null, 2));

      // 2. 调用现有的 ToolExecutor
      const toolResult: ToolResult = await this.toolExecutor.executeToolCall(toolCall);

      const duration = Date.now() - startTime;
      this.log(`[Adapter] Tool execution completed in ${duration}ms`);

      // 3. 转换 ToolResult → ExecutorResult
      if (toolResult.success) {
        return success(toolResult.output, {
          message: `Tool ${toolCall.tool} executed successfully`,
        });
      } else {
        return failure(toolResult.error || 'Unknown error', {
          recoverable: this.isRecoverable(toolResult),
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));

      this.log(`[Adapter] Tool execution failed after ${duration}ms:`, err.message);

      return failure(err, {
        recoverable: this.isRecoverableError(err),
      });
    }
  }

  /**
   * 转换 CoreEvent 到 ToolCall
   */
  private convertEventToToolCall(event: ToolCallEvent): ToolCall {
    // 从 event.payload 提取工具信息
    const { toolName, args, toolCallId } = event.payload;

    return {
      tool: toolName,
      parameters: args as Record<string, unknown>,
      id: toolCallId || event.id,
    };
  }

  /**
   * 判断 ToolResult 是否可恢复
   */
  private isRecoverable(result: ToolResult): boolean {
    // 如果有错误信息，检查是否包含可恢复的关键词
    if (result.error) {
      const recoverablePatterns = [
        /timeout/i,
        /network/i,
        /ECONNREFUSED/i,
        /ETIMEDOUT/i,
        /rate limit/i,
        /overloaded/i,
      ];

      return recoverablePatterns.some((pattern) =>
        result.error ? pattern.test(result.error) : false
      );
    }

    // 默认不可恢复
    return false;
  }

  /**
   * 判断 Error 是否可恢复
   */
  private isRecoverableError(error: Error): boolean {
    const recoverablePatterns = [
      /timeout/i,
      /network/i,
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
      /5\d{2}/,
      /rate limit/i,
      /overloaded/i,
    ];

    return recoverablePatterns.some((pattern) => pattern.test(error.message));
  }

  /**
   * 日志输出
   */
  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[ToolExecutorAdapter]', ...args);
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建 ToolExecutor 适配器
 */
export function createToolExecutorAdapter(
  toolExecutor: ToolExecutor,
  config?: ToolExecutorAdapterConfig
): ToolExecutorAdapter {
  return new ToolExecutorAdapter(toolExecutor, config);
}
