/**
 * Runtime Executor
 *
 * 运行时执行器 - 使用 NewmaRuntime 执行任务
 */

import { NewmaRuntime } from './runtime';
import { ExtendedAIResponse } from '../ai';

// ============================================================================
// 执行结果
// ============================================================================

/**
 * 运行时执行结果
 */
export interface RuntimeExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** AI 响应 */
  response?: ExtendedAIResponse;
  /** 错误信息 */
  error?: string;
  /** 执行时长（毫秒） */
  duration?: number;
}

// ============================================================================
// Runtime 执行器
// ============================================================================

/**
 * 运行时执行器
 *
 * 使用 NewmaRuntime 执行用户需求
 */
export class RuntimeExecutor {
  private runtime: NewmaRuntime;

  constructor(runtime: NewmaRuntime) {
    this.runtime = runtime;
  }

  /**
   * 执行用户需求
   *
   * @param requirement 用户需求
   * @returns 执行结果
   */
  async execute(requirement: string): Promise<RuntimeExecutionResult> {
    const startTime = Date.now();

    try {
      // 检查运行时是否已启动
      if (!this.runtime.isRunning()) {
        await this.runtime.start();
      }

      // 发送任务到运行时
      await this.runtime.startTask(requirement);

      // 等待任务完成
      const result = await this.waitForCompletion();

      const duration = Date.now() - startTime;

      return {
        success: true,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * 等待任务完成
   */
  private async waitForCompletion(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Task execution timeout (5 minutes)'));
      }, 300000); // 5 分钟超时

      // 监听完成事件并保存取消订阅函数
      const unsubscribeComplete = this.runtime.on('complete', () => {
        clearTimeout(timeout);
        unsubscribeComplete();
        unsubscribeStop();
        unsubscribeError();
        resolve();
      });

      // 监听停止事件
      const unsubscribeStop = this.runtime.on('stop', () => {
        clearTimeout(timeout);
        unsubscribeComplete();
        unsubscribeStop();
        unsubscribeError();
        resolve();
      });

      // 监听错误事件
      const unsubscribeError = this.runtime.on('error', (error: Error) => {
        clearTimeout(timeout);
        unsubscribeComplete();
        unsubscribeStop();
        unsubscribeError();
        reject(error);
      });
    });
  }

  /**
   * 中断当前执行
   */
  abort(): void {
    this.runtime.abort();
  }

  /**
   * 获取运行时状态
   */
  getStatus() {
    return this.runtime.getState();
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建运行时执行器
 */
export function createRuntimeExecutor(runtime: NewmaRuntime): RuntimeExecutor {
  return new RuntimeExecutor(runtime);
}
