/**
 * Loop Plugin Manager Implementation
 *
 * 实现 Loop 插件管理器接口
 * 管理 Loop 插件的注册和生命周期
 */

import {
  LoopPlugin,
  LoopPluginManager,
  LoopPluginContext,
  BeforeInputResult,
  AfterInputResult,
  BeforeExecutionResult,
} from '../interfaces/plugin';
import { FlowResult } from '../interfaces/flow-controller';

/**
 * Loop 插件管理器实现
 */
export class LoopPluginManagerImpl implements LoopPluginManager {
  private plugins: Map<string, LoopPlugin> = new Map();

  /**
   * 注册 Loop 插件
   */
  registerLoopPlugin(plugin: LoopPlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin with id '${plugin.id}' is already registered`);
    }
    this.plugins.set(plugin.id, plugin);
  }

  /**
   * 注销 Loop 插件
   */
  unregisterLoopPlugin(pluginId: string): void {
    this.plugins.delete(pluginId);
  }

  /**
   * 获取所有 Loop 插件
   */
  getLoopPlugins(): LoopPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 执行输入前钩子
   */
  async executeBeforeInputHooks(
    input: string,
    context: LoopPluginContext
  ): Promise<BeforeInputResult> {
    let result: BeforeInputResult = {
      shouldContinue: true,
    };

    for (const plugin of this.plugins.values()) {
      if (plugin.onBeforeInput) {
        try {
          const pluginResult = await plugin.onBeforeInput(input, context);

          // 如果插件要求停止处理，直接返回
          if (!pluginResult.shouldContinue) {
            return pluginResult;
          }

          // 处理跳过
          if (pluginResult.shouldSkip) {
            result.shouldSkip = true;
          }

          // 处理修改输入（优先使用第一个修改）
          if (pluginResult.modifiedInput && !result.modifiedInput) {
            result.modifiedInput = pluginResult.modifiedInput;
          }

          // 处理重定向（优先使用第一个重定向）
          if (pluginResult.redirectTo && !result.redirectTo) {
            result.redirectTo = pluginResult.redirectTo;
          }
        } catch (error: any) {
          console.error(`Error in plugin ${plugin.id} onBeforeInput:`, error.message);
        }
      }
    }

    return result;
  }

  /**
   * 执行输入后钩子
   */
  async executeAfterInputHooks(
    result: FlowResult,
    context: LoopPluginContext
  ): Promise<AfterInputResult> {
    let finalResult = result;

    for (const plugin of this.plugins.values()) {
      if (plugin.onAfterInput) {
        try {
          const pluginResult = await plugin.onAfterInput(finalResult, context);

          // 如果插件修改了结果，使用修改后的结果
          if (pluginResult.modifiedResult) {
            finalResult = pluginResult.modifiedResult;
          }

          // 如果插件要求停止，返回
          if (!pluginResult.shouldContinue) {
            return {
              shouldContinue: false,
              modifiedResult: finalResult,
            };
          }
        } catch (error: any) {
          console.error(`Error in plugin ${plugin.id} onAfterInput:`, error.message);
        }
      }
    }

    return {
      shouldContinue: true,
      modifiedResult: finalResult,
    };
  }

  /**
   * 执行执行前钩子
   */
  async executeBeforeExecutionHooks(
    plan: any,
    context: LoopPluginContext
  ): Promise<BeforeExecutionResult> {
    let result: BeforeExecutionResult = {
      shouldContinue: true,
    };

    for (const plugin of this.plugins.values()) {
      if (plugin.onBeforeExecution) {
        try {
          const pluginResult = await plugin.onBeforeExecution(plan, context);

          // 如果插件要求停止执行，直接返回
          if (!pluginResult.shouldContinue) {
            return pluginResult;
          }

          // 处理修改计划（优先使用第一个修改）
          if (pluginResult.modifiedPlan && !result.modifiedPlan) {
            result.modifiedPlan = pluginResult.modifiedPlan;
          }
        } catch (error: any) {
          console.error(`Error in plugin ${plugin.id} onBeforeExecution:`, error.message);
        }
      }
    }

    return result;
  }

  /**
   * 执行执行后钩子
   */
  async executeAfterExecutionHooks(
    result: any,
    context: LoopPluginContext
  ): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.onAfterExecution) {
        try {
          await plugin.onAfterExecution(result, context);
        } catch (error: any) {
          console.error(`Error in plugin ${plugin.id} onAfterExecution:`, error.message);
        }
      }
    }
  }

  /**
   * 执行模式切换钩子
   */
  async executeModeChangeHooks(
    oldMode: string,
    newMode: string,
    context: LoopPluginContext
  ): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.onModeChange) {
        try {
          await plugin.onModeChange(oldMode, newMode, context);
        } catch (error: any) {
          console.error(`Error in plugin ${plugin.id} onModeChange:`, error.message);
        }
      }
    }
  }

  /**
   * 执行会话开始钩子
   */
  async executeSessionStartHooks(context: LoopPluginContext): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.onSessionStart) {
        try {
          await plugin.onSessionStart(context);
        } catch (error: any) {
          console.error(`Error in plugin ${plugin.id} onSessionStart:`, error.message);
        }
      }
    }
  }

  /**
   * 执行会话结束钩子
   */
  async executeSessionEndHooks(context: LoopPluginContext): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.onSessionEnd) {
        try {
          await plugin.onSessionEnd(context);
        } catch (error: any) {
          console.error(`Error in plugin ${plugin.id} onSessionEnd:`, error.message);
        }
      }
    }
  }

  /**
   * 执行错误处理钩子
   */
  async executeErrorHooks(
    error: Error,
    context: LoopPluginContext
  ): Promise<boolean> {
    let shouldHandleError = false;

    for (const plugin of this.plugins.values()) {
      if (plugin.onError) {
        try {
          const handled = await plugin.onError(error, context);
          if (handled) {
            shouldHandleError = true;
          }
        } catch (error: any) {
          console.error(`Error in plugin ${plugin.id} onError:`, error.message);
        }
      }
    }

    return shouldHandleError;
  }
}
