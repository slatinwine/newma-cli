/**
 * Runtime Integration
 *
 * 集成新的事件驱动运行时架构到现有 CLI 系统
 * 实现双轨运行：旧系统和新系统可以并存
 */

import { createRuntime, NewmaRuntime } from './runtime/runtime';
import { NewmaRuntimeConfig } from './runtime/runtime';
import { ToolExecutor } from './executor-v2';
import { ExecutionTracker } from './history';
import { RollbackManager } from './rollback';
import { Config } from './config';
import { createToolExecutorAdapter } from './executors/tool-executor-adapter';
import { createAIExecutor } from './executors/ai-executor';
import { AIClient } from './executors/ai-executor';
import { createToolRegistry } from './executors/tool-executor';
import { callAI } from './ai';
import { CoreEventType } from './core/types';

// ============================================================================
// AI Client Adapter
// ============================================================================

/**
 * AI Client Adapter
 *
 * 将现有的 callAI 函数适配到新的 AIClient 接口
 */
class AIClientAdapter implements AIClient {
  constructor(private config: Config, private projectRoot: string) {}

  async send(
    messages: any[],
    tools?: any[],
    aiConfig?: any
  ): Promise<any> {
    // 调用现有的 callAI 函数
    // 注意：这里需要根据实际的 callAI 接口进行调整
    const response = await callAI(
      this.config,
      { projectRoot: this.projectRoot },
      messages[messages.length - 1].content, // 最后一条消息作为用户输入
      'plan', // 默认使用 plan 模式
      [], // 空 history
      undefined,
      undefined,
      undefined,
      this.projectRoot,
      undefined
    );

    // 转换响应格式
    return {
      message: {
        role: 'assistant',
        content: response.content || '',
      },
      toolCalls: response.toolCalls || [],
    };
  }
}

// ============================================================================
// Runtime 工厂函数
// ============================================================================

/**
 * 创建运行时配置
 */
export function createRuntimeConfig(
  projectRoot: string,
  config: Config,
  toolExecutor: ToolExecutor
): NewmaRuntimeConfig {
  return {
    projectRoot,
    debug: config.eventSystem?.debugMode ?? false,
    maxIterations: 10,
    extra: {
      aiConfig: config,
    },
  };
}

/**
 * 创建并初始化运行时
 *
 * @param projectRoot 项目根目录
 * @param config 配置对象
 * @param toolExecutor 现有的 ToolExecutor 实例
 * @returns 初始化好的 NewmaRuntime 实例
 */
export function createAndInitializeRuntime(
  projectRoot: string,
  config: Config,
  toolExecutor: ToolExecutor
): NewmaRuntime {
  // 创建 AI Client
  const aiClient: AIClient = new AIClientAdapter(config, projectRoot);

  // 创建工具注册表
  const toolRegistry = createToolRegistry();

  // 创建运行时配置
  const runtimeConfig = createRuntimeConfig(projectRoot, config, toolExecutor);

  // 创建运行时
  const runtime = createRuntime({
    ...runtimeConfig,
    aiClient,
    toolRegistry,
  });

  // 注意：ToolExecutor 适配器的注册需要在运行时启动后进行
  // 这里暂时不注册，后续在 REPL 集成时会处理

  return runtime;
}

/**
 * 启动运行时
 *
 * @param runtime 运行时实例
 * @returns 启动 Promise
 */
export async function startRuntime(runtime: NewmaRuntime): Promise<void> {
  await runtime.start();
}

/**
 * 停止运行时
 *
 * @param runtime 运行时实例
 * @returns 停止 Promise
 */
export async function stopRuntime(runtime: NewmaRuntime): Promise<void> {
  await runtime.stop();
}

/**
 * 发送任务到运行时
 *
 * @param runtime 运行时实例
 * @param requirement 任务需求
 * @returns 执行 Promise
 */
export async function executeTaskWithRuntime(
  runtime: NewmaRuntime,
  requirement: string
): Promise<void> {
  await runtime.startTask(requirement);

  // 等待任务完成
  // TODO: 实现更完善的完成检测机制
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Task execution timeout'));
    }, 300000); // 5 分钟超时

    runtime.on('complete', (result: any) => {
      clearTimeout(timeout);
      resolve();
    });

    runtime.on('stop', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
