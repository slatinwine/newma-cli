/**
 * Intent Recognition Integration Plugin
 *
 * Automatically detects user intent and redirects to appropriate mode
 */

import chalk from 'chalk';
import {
  LoopPlugin,
  LoopPluginContext,
  BeforeInputResult,
} from '../interfaces/plugin';
import { IntentRecognizer } from '../../intent/recognizer';
import { Config } from '../../config';
import { Tool } from '../../tools/types';

/**
 * Intent Recognition Integration Plugin Configuration
 */
export interface IntentIntegrationConfig {
  /**
   * 是否启用意图识别
   */
  enabled: boolean;

  /**
   * 是否自动重定向到合适的模式
   */
  autoRedirect: boolean;

  /**
   * 置信度阈值（低于此值不自动重定向）
   */
  confidenceThreshold: number;

  /**
   * 是否自动重定向简单问题到 /chat
   */
  autoRedirectQuestions: boolean;
}

/**
 * Intent Recognition Integration Plugin
 *
 * Automatically analyzes user input and redirects to the most appropriate mode:
 * - Simple questions → /chat
 * - Simple tasks → /plan (FFT)
 * - Medium tasks → /plan (Landmark)
 * - Complex tasks → /plan (ToT)
 */
export class IntentRecognitionPlugin implements LoopPlugin {
  id = 'intent-recognition-plugin';
  name = 'Intent Recognition Plugin';
  type = 'loop' as const;
  version = '1.0.0';
  description = 'Automatically detects user intent and redirects to appropriate mode';
  tools: Tool[] = []; // Loop plugins don't provide tools

  private intentRecognizer: IntentRecognizer;
  private config: Config;
  private pluginConfig: IntentIntegrationConfig;

  constructor(config: Config, pluginConfig?: Partial<IntentIntegrationConfig>) {
    this.config = config;
    this.intentRecognizer = new IntentRecognizer(config);

    // 默认配置
    this.pluginConfig = {
      enabled: pluginConfig?.enabled ?? false, // 默认关闭，需用户主动开启
      autoRedirect: pluginConfig?.autoRedirect ?? true,
      confidenceThreshold: pluginConfig?.confidenceThreshold ?? 0.6,
      autoRedirectQuestions: pluginConfig?.autoRedirectQuestions ?? true,
    };
  }

  /**
   * 更新插件配置
   */
  updateConfig(config: Partial<IntentIntegrationConfig>): void {
    this.pluginConfig = { ...this.pluginConfig, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): IntentIntegrationConfig {
    return { ...this.pluginConfig };
  }

  /**
   * 输入前钩子 - 自动识别意图
   */
  async onBeforeInput(
    input: string,
    context: LoopPluginContext
  ): Promise<BeforeInputResult> {
    // 如果未启用，直接通过
    if (!this.pluginConfig.enabled) {
      return { shouldContinue: true };
    }

    // 跳过命令（不分析命令）
    if (input.startsWith('/')) {
      return { shouldContinue: true };
    }

    // 跳过空输入
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return { shouldContinue: true };
    }

    // 跳过过短输入
    if (trimmed.length < 5) {
      return { shouldContinue: true };
    }

    try {
      // 分析意图
      const intent = await this.intentRecognizer.recognizeIntent(
        trimmed,
        undefined,
        false // 使用启发式规则（快速）
      );

      // 检查置信度
      if (intent.confidence < this.pluginConfig.confidenceThreshold) {
        // 置信度不够，不重定向
        return { shouldContinue: true };
      }

      // 根据任务类型和复杂度决定是否重定向
      if (!this.pluginConfig.autoRedirect) {
        // 不自动重定向，只显示分析结果
        console.log(chalk.gray(`\n📊 Intent: ${intent.taskType} | ${intent.complexity} | ${intent.recommendedAlgorithm}\n`));
        return { shouldContinue: true };
      }

      // 简单问题 → 聊天模式
      if (
        this.pluginConfig.autoRedirectQuestions &&
        String(intent.taskType) === 'question' &&
        intent.complexity === 'simple'
      ) {
        console.log(chalk.cyan('\n💬 Detected: Simple question\n'));
        console.log(chalk.cyan('→ Redirecting to chat mode...\n'));
        return {
          shouldContinue: true,
          redirectTo: `/chat ${trimmed}`,
        };
      }

      // 复杂任务 → 规划模式
      if (String(intent.taskType) === 'task' && intent.complexity !== 'simple') {
        console.log(chalk.cyan('\n📋 Detected: Complex task\n'));
        console.log(chalk.cyan('→ Redirecting to plan mode...\n'));
        return {
          shouldContinue: true,
          redirectTo: `/plan ${trimmed}`,
        };
      }

      // 其他情况 → 保持原样（默认是聊天模式）
      return { shouldContinue: true };
    } catch (error: any) {
      // 意图识别失败，不影响正常流程
      console.log(chalk.yellow(`⚠️  Intent recognition failed: ${error.message}\n`));
      return { shouldContinue: true };
    }
  }

  /**
   * 会话开始钩子 - 显示插件状态
   */
  async onSessionStart(context: LoopPluginContext): Promise<void> {
    if (this.pluginConfig.enabled) {
      console.log(chalk.gray(`\n🎯 Intent recognition: enabled (threshold: ${(this.pluginConfig.confidenceThreshold * 100).toFixed(0)}%)\n`));
    }
  }

  /**
   * 错误处理钩子
   */
  async onError(
    error: Error,
    context: LoopPluginContext
  ): Promise<boolean> {
    return false;
  }
}
