/**
 * Default Flow Controller
 *
 * 默认流程控制器实现
 * 处理命令、聊天、规划和执行模式
 */

import chalk from 'chalk';
import {
  FlowController,
  FlowResult,
  FlowResultType,
  InputProcessingResult,
  ModifiedPlan,
  FlowControllerConfig,
  FlowContext,
  Plan,
} from '../interfaces/flow-controller';
import { LoopSession } from '../interfaces/session';
import { LoopFrontend, OutputStyle } from '../interfaces/frontend';
import { CommandManager } from '../commands/command-manager';
import { LoopPluginManager, LoopPluginContext } from '../interfaces/plugin';

/**
 * 默认流程控制器配置
 */
export interface DefaultFlowControllerConfig extends FlowControllerConfig {
  /**
   * 命令管理器
   */
  commandManager: CommandManager;

  /**
   * 会话
   */
  session: LoopSession;

  /**
   * 前端
   */
  frontend: LoopFrontend;

  /**
   * AI 处理函数（用于聊天和规划）
   */
  aiHandler?: (input: string, mode: 'chat' | 'plan') => Promise<any>;

  /**
   * 插件管理器（可选）
   */
  pluginManager?: LoopPluginManager;
}

/**
 * 默认流程控制器
 *
 * 提供标准的输入处理流程：
 * 1. 检查是否为命令（以 / 开头）
 * 2. 判断处理模式（chat、plan、execute、verify）
 * 3. 执行相应的处理逻辑
 */
export class DefaultFlowController implements FlowController {
  private config: DefaultFlowControllerConfig;
  private redirectCount: number = 0;

  constructor(config: DefaultFlowControllerConfig) {
    this.config = {
      enablePreprocessing: true,
      enablePostprocessing: true,
      allowSkip: true,
      allowModify: true,
      allowRedirect: true,
      maxRedirects: 10,
      ...config,
    };
  }

  /**
   * 处理用户输入
   */
  async processInput(input: string): Promise<FlowResult> {
    const trimmed = input.trim();

    // 1. 检查是否为命令
    if (trimmed.startsWith('/')) {
      return await this.processCommand(trimmed);
    }

    // 2. 判断处理模式
    const mode = this.determineMode(trimmed);

    // 3. 根据模式处理
    switch (mode) {
      case 'chat':
        return await this.processChat(trimmed);

      case 'plan':
        return await this.processPlan(trimmed);

      case 'execute':
        return await this.processExecute(trimmed);

      case 'verify':
        return await this.processVerify(trimmed);

      case 'loop':
        return await this.processLoop(trimmed);

      default:
        return await this.processChat(trimmed);
    }
  }

  /**
   * 判断输入的处理模式
   */
  private determineMode(input: string): FlowResultType {
    // 简单判断逻辑
    // TODO: 可以使用更复杂的意图识别

    const session = this.config.session;
    const currentMode = session.currentMode;

    // 如果会话已有特定模式，继续使用
    if (currentMode === 'execute' || currentMode === 'verify') {
      return currentMode;
    }

    // 默认为聊天模式
    return 'chat';
  }

  /**
   * 处理命令
   */
  private async processCommand(input: string): Promise<FlowResult> {
    const parts = input.split(/\s+/);
    const command = parts[0].slice(1).toLowerCase(); // 移除 /
    const args = parts.slice(1);

    try {
      const result = await this.config.commandManager.execute(command, args, {
        session: this.config.session,
        rawInput: input,
      });

      return {
        type: 'command',
        data: result,
        shouldContinue: !result.metadata?.exit,
      };
    } catch (error: any) {
      this.config.frontend.writeError(`Command error: ${error.message}`);
      return {
        type: 'command',
        data: { success: false, error: error.message },
        shouldContinue: true,
      };
    }
  }

  /**
   * 处理聊天模式
   */
  private async processChat(input: string): Promise<FlowResult> {
    this.config.session.switchMode('chat');

    if (!this.config.aiHandler) {
      this.config.frontend.writeOutput(
        'Chat mode is not available without AI handler',
        OutputStyle.WARNING
      );
      return {
        type: 'chat',
        data: null,
        shouldContinue: true,
      };
    }

    try {
      const result = await this.config.aiHandler(input, 'chat');
      return {
        type: 'chat',
        data: result,
        shouldContinue: true,
      };
    } catch (error: any) {
      this.config.frontend.writeError(`Chat error: ${error.message}`);
      return {
        type: 'chat',
        data: null,
        shouldContinue: true,
        error: error.message,
      };
    }
  }

  /**
   * 处理规划模式
   */
  private async processPlan(input: string): Promise<FlowResult> {
    this.config.session.switchMode('plan');

    if (!this.config.aiHandler) {
      this.config.frontend.writeOutput(
        'Plan mode is not available without AI handler',
        OutputStyle.WARNING
      );
      return {
        type: 'plan',
        data: null,
        shouldContinue: true,
      };
    }

    try {
      const result = await this.config.aiHandler(input, 'plan');
      return {
        type: 'plan',
        data: result,
        shouldContinue: true,
      };
    } catch (error: any) {
      this.config.frontend.writeError(`Plan error: ${error.message}`);
      return {
        type: 'plan',
        data: null,
        shouldContinue: true,
        error: error.message,
      };
    }
  }

  /**
   * 处理执行模式
   */
  private async processExecute(input: string): Promise<FlowResult> {
    this.config.session.switchMode('execute');

    // TODO: 实现执行逻辑
    this.config.frontend.writeOutput('Execute mode not yet implemented', OutputStyle.WARNING);
    return {
      type: 'execute',
      data: null,
      shouldContinue: true,
    };
  }

  /**
   * 处理验证模式
   */
  private async processVerify(input: string): Promise<FlowResult> {
    this.config.session.switchMode('verify');

    // TODO: 实现验证逻辑
    this.config.frontend.writeOutput('Verify mode not yet implemented', OutputStyle.WARNING);
    return {
      type: 'verify',
      data: null,
      shouldContinue: true,
    };
  }

  /**
   * 处理循环模式
   */
  private async processLoop(input: string): Promise<FlowResult> {
    this.config.session.switchMode('loop');

    // TODO: 实现循环逻辑
    this.config.frontend.writeOutput('Loop mode not yet implemented', OutputStyle.WARNING);
    return {
      type: 'loop',
      data: null,
      shouldContinue: true,
    };
  }

  /**
   * 判断是否应该继续
   */
  async canContinue(): Promise<boolean> {
    const session = this.config.session;

    // 检查是否达到最大迭代次数
    if (
      session.maxIterations !== null &&
      session.iterationCount >= session.maxIterations
    ) {
      return false;
    }

    return true;
  }

  /**
   * 判断是否应该跳过
   */
  async shouldSkip(input: string): Promise<boolean> {
    // 检查是否为空行
    if (!input.trim()) {
      return true;
    }

    // 检查是否为注释
    if (input.trim().startsWith('#')) {
      return true;
    }

    return false;
  }

  /**
   * 判断是否应该修改输入
   */
  async shouldModify(
    input: string,
    originalPlan?: Plan
  ): Promise<ModifiedPlan | null> {
    // 默认不修改
    // 插件可以覆盖此方法来实现修改逻辑
    return null;
  }

  /**
   * 判断是否应该重定向
   */
  async shouldRedirect(input: string): Promise<string | null> {
    // 默认不重定向
    // 插件可以覆盖此方法来实现重定向逻辑
    return null;
  }

  /**
   * 预处理输入
   */
  async preprocessInput(input: string): Promise<InputProcessingResult> {
    // 1. 执行插件的 beforeInput 钩子
    if (this.config.pluginManager) {
      const pluginContext: LoopPluginContext = {
        session: this.config.session,
        config: {},
        pluginRoot: process.cwd(),
        projectRoot: this.config.session.projectRoot,
      };

      const pluginResult = await this.config.pluginManager.executeBeforeInputHooks(
        input,
        pluginContext
      );

      // 如果插件返回了修改、跳过或重定向，直接返回
      if (pluginResult.modifiedInput || pluginResult.shouldSkip || pluginResult.redirectTo) {
        return {
          shouldContinue: pluginResult.shouldContinue,
          modifiedInput: pluginResult.modifiedInput,
          shouldSkip: pluginResult.shouldSkip,
          redirectTo: pluginResult.redirectTo,
        };
      }

      // 如果插件要求停止，返回
      if (!pluginResult.shouldContinue) {
        return {
          shouldContinue: false,
        };
      }
    }

    // 2. 原有的跳过/修改/重定向逻辑
    // 检查是否应该跳过
    if (this.config.allowSkip && (await this.shouldSkip(input))) {
      return {
        shouldContinue: false,
        shouldSkip: true,
      };
    }

    // 检查是否应该修改
    if (this.config.allowModify) {
      const modified = await this.shouldModify(input);
      if (modified) {
        return {
          shouldContinue: true,
          modifiedInput: modified.plan.steps[0].description, // 简化处理
        };
      }
    }

    // 检查是否应该重定向
    if (this.config.allowRedirect) {
      const redirected = await this.shouldRedirect(input);
      if (redirected) {
        return {
          shouldContinue: true,
          redirectTo: redirected,
        };
      }
    }

    return {
      shouldContinue: true,
    };
  }

  /**
   * 后处理结果
   */
  async postprocessResult(result: FlowResult, input: string): Promise<FlowResult> {
    let finalResult = result;

    // 1. 执行插件的 afterInput 钩子
    if (this.config.pluginManager) {
      const pluginContext: LoopPluginContext = {
        session: this.config.session,
        config: {},
        pluginRoot: process.cwd(),
        projectRoot: this.config.session.projectRoot,
      };

      const pluginResult = await this.config.pluginManager.executeAfterInputHooks(
        finalResult,
        pluginContext
      );

      // 如果插件修改了结果，使用修改后的结果
      if (pluginResult.modifiedResult) {
        finalResult = pluginResult.modifiedResult;
      }

      // 如果插件要求停止，返回
      if (!pluginResult.shouldContinue) {
        return finalResult;
      }
    }

    // 2. 原有的后处理逻辑
    // 更新会话统计
    if (finalResult.type !== 'skip') {
      this.config.session.incrementIteration();
    }

    return finalResult;
  }
}
