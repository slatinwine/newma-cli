/**
 * Plan Mode Plugin
 *
 * Handles /plan command with task validation and planning logic
 */

import chalk from 'chalk';
import {
  LoopPlugin,
  LoopPluginContext,
  BeforeInputResult,
} from '../interfaces/plugin';
import { FlowResult, FlowResultType } from '../interfaces/flow-controller';
import { OutputStyle } from '../interfaces/frontend';
import { Tool } from '../../tools/types';

/**
 * Plan Mode Plugin
 *
 * Intercepts /plan commands, validates requirements, and delegates to AIFlowController
 */
export class PlanModePlugin implements LoopPlugin {
  id = 'plan-mode-plugin';
  name = 'Plan Mode Plugin';
  type = 'loop' as const;
  version = '1.0.0';
  description = 'Handles task planning with validation';
  tools: Tool[] = []; // Loop plugins don't provide tools

  /**
   * 检查是否为有效的任务需求
   *
   * 从 repl.ts 移植过来的验证逻辑
   */
  private isValidTaskRequirement(requirement: string): boolean {
    if (!requirement || requirement.trim().length === 0) {
      return false;
    }

    const trimmed = requirement.trim().toLowerCase();

    // 检查是否为过短的需求
    if (trimmed.length < 3) {
      return false;
    }

    // 可选：关键词白名单检查（当前已禁用）
    // const taskKeywords = [
    //   'add', 'create', 'implement', 'build', 'develop',
    //   'fix', 'refactor', 'update', 'modify', 'change',
    //   '添加', '创建', '实现', '构建', '开发',
    //   '修复', '重构', '更新', '修改', '改变'
    // ];
    // const hasTaskKeyword = taskKeywords.some(keyword => trimmed.includes(keyword));
    // if (!hasTaskKeyword) {
    //   return false;
    // }

    return true;
  }

  /**
   * 输入前钩子 - 拦截 /plan 命令
   */
  async onBeforeInput(
    input: string,
    context: LoopPluginContext
  ): Promise<BeforeInputResult> {
    // 只处理 /plan 开头的命令
    if (!input.startsWith('/plan ')) {
      return { shouldContinue: true };
    }

    // 提取需求（去掉 /plan 前缀）
    const requirement = input.slice(6).trim();

    // 验证需求
    if (!this.isValidTaskRequirement(requirement)) {
      console.log(chalk.yellow('\n⚠️  Invalid task requirement\n'));
      console.log(chalk.gray('Usage: /plan <your requirement>\n'));
      console.log(chalk.gray('Example: /plan Add a login page\n'));
      console.log(chalk.gray('         /plan Create a REST API\n'));

      // 返回 shouldSkip 以阻止继续处理
      return {
        shouldContinue: true,
        shouldSkip: true,
      };
    }

    // 返回修改后的输入（移除 /plan 前缀，让 AIFlowController 处理）
    // 但需要切换到 plan 模式
    return {
      shouldContinue: true,
      modifiedInput: requirement,
      redirectTo: undefined, // 不重定向，直接让流程继续
    };
  }

  /**
   * 模式切换钩子
   */
  async onModeChange(
    oldMode: string,
    newMode: string,
    context: LoopPluginContext
  ): Promise<void> {
    if (newMode === 'plan') {
      console.log(chalk.cyan('\n📋 Switched to plan mode\n'));
    }
  }

  /**
   * 错误处理钩子
   */
  async onError(
    error: Error,
    context: LoopPluginContext
  ): Promise<boolean> {
    // 返回 false 表示我们不想处理这个错误，让其他处理器处理
    return false;
  }
}
