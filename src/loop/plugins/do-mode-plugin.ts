/**
 * Do Mode Plugin
 *
 * Handles /do command with automatic intent recognition and algorithm selection
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
 * Do Mode Plugin
 *
 * Similar to /plan, but with automatic intent recognition enabled.
 * Redirects to the best planning algorithm based on task complexity.
 */
export class DoModePlugin implements LoopPlugin {
  id = 'do-mode-plugin';
  name = 'Do Mode Plugin';
  type = 'loop' as const;
  version = '1.0.0';
  description = 'Handles task execution with auto-intent recognition';
  tools: Tool[] = []; // Loop plugins don't provide tools

  private intentRecognizer: IntentRecognizer;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.intentRecognizer = new IntentRecognizer(config);
  }

  /**
   * 检查是否为有效的任务需求
   */
  private isValidTaskRequirement(requirement: string): boolean {
    if (!requirement || requirement.trim().length === 0) {
      return false;
    }

    const trimmed = requirement.trim().toLowerCase();

    if (trimmed.length < 3) {
      return false;
    }

    return true;
  }

  /**
   * 输入前钩子 - 拦截 /do 命令
   */
  async onBeforeInput(
    input: string,
    context: LoopPluginContext
  ): Promise<BeforeInputResult> {
    // 只处理 /do 开头的命令
    if (!input.startsWith('/do ')) {
      return { shouldContinue: true };
    }

    // 提取需求（去掉 /do 前缀）
    const requirement = input.slice(4).trim();

    // 验证需求
    if (!this.isValidTaskRequirement(requirement)) {
      console.log(chalk.yellow('\n⚠️  Invalid task requirement\n'));
      console.log(chalk.gray('Usage: /do <your requirement>\n'));
      console.log(chalk.gray('Example: /do Fix the login bug\n'));
      console.log(chalk.gray('         /do Add unit tests\n'));

      return {
        shouldContinue: true,
        shouldSkip: true,
      };
    }

    // 🔥 自动意图识别
    console.log(chalk.cyan('\n🎯 Analyzing task...\n'));

    try {
      const intent = await this.intentRecognizer.recognizeIntent(
        requirement,
        undefined,
        false // 使用启发式规则（快速）
      );

      console.log(chalk.gray(`📊 Intent: ${intent.taskType}\n`));
      console.log(chalk.gray(`📊 Complexity: ${intent.complexity}\n`));
      console.log(chalk.gray(`📊 Algorithm: ${intent.recommendedAlgorithm}\n`));
      console.log(chalk.gray(`📊 Confidence: ${(intent.confidence * 100).toFixed(0)}%\n`));

      // 根据推荐的算法选择合适的命令
      // 如果是简单问题，使用 /chat
      // 如果是任务，使用 /plan（FFT/Landmark/ToT 会由 plan 模式自动选择）

      if (String(intent.taskType) === 'question' && intent.complexity === 'simple') {
        // 简单问题 → 聊天模式
        console.log(chalk.cyan('💬 Redirecting to chat mode...\n'));
        return {
          shouldContinue: true,
          redirectTo: `/chat ${requirement}`,
        };
      } else {
        // 任务 → 规划模式
        console.log(chalk.cyan('📋 Redirecting to plan mode...\n'));
        return {
          shouldContinue: true,
          redirectTo: `/plan ${requirement}`,
        };
      }
    } catch (error: any) {
      console.log(chalk.yellow(`⚠️  Intent recognition failed: ${error.message}\n`));
      console.log(chalk.cyan('📋 Falling back to plan mode...\n'));

      // 如果意图识别失败，回退到 plan 模式
      return {
        shouldContinue: true,
        redirectTo: `/plan ${requirement}`,
      };
    }
  }

  /**
   * 模式切换钩子
   */
  async onModeChange(
    oldMode: string,
    newMode: string,
    context: LoopPluginContext
  ): Promise<void> {
    // Do nothing, let the mode-specific plugins handle it
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
