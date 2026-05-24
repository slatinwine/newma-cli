/**
 * AI Flow Controller
 *
 * 集成了真实 AI 处理逻辑的流程控制器
 * 连接到现有的 chatAI 和 callAI 系统
 */

import chalk from 'chalk';
import {
  FlowController,
  FlowResult,
  FlowResultType,
  InputProcessingResult,
} from '../interfaces/flow-controller';
import { LoopSession } from '../interfaces/session';
import { LoopFrontend, OutputStyle } from '../interfaces/frontend';
import { CommandManager } from '../commands/command-manager';
import { chatAI, callAI } from '../../ai';
import { scanDirectory } from '../../scanner';
import { ToolExecutor } from '../../executor-v2';
import { RollbackManager } from '../../rollback';
import { PermissionManager } from '../../permissions';
import { Permission } from '../../tools/types';
import { LoopPluginManager, LoopPluginContext } from '../interfaces/plugin';

/**
 * AI 流程控制器配置
 */
export interface AIFlowControllerConfig {
  commandManager: CommandManager;
  session: LoopSession;
  frontend: LoopFrontend;
  projectRoot: string;
  toolExecutor?: ToolExecutor;
  rollbackManager?: RollbackManager;
  pluginManager?: LoopPluginManager;
  memoPlugin?: any; // MemoCliPlugin (optional) - 用于记忆上下文
}

/**
 * AI 流程控制器
 *
 * 扩展 DefaultFlowController，集成真实的 AI 处理
 */
export class AIFlowController implements FlowController {
  private config: AIFlowControllerConfig;
  private redirectCount: number = 0;
  private currentAbortController: AbortController | null = null;

  constructor(config: AIFlowControllerConfig) {
    this.config = config;
  }

  /**
   * 处理用户输入
   */
  async processInput(input: string): Promise<FlowResult> {
    // 1. 预处理输入（调用插件钩子）
    const preprocessResult = await this.preprocessInput(input);

    // 检查是否应该跳过
    if (preprocessResult.shouldSkip) {
      return {
        type: 'skip',
        data: null,
        shouldContinue: true,
      };
    }

    // 检查是否应该重定向
    if (preprocessResult.redirectTo) {
      this.redirectCount++;

      // 防止无限重定向
      if (this.redirectCount > 10) {
        this.config.frontend.writeError('Too many redirects, stopping');
        return {
          type: 'skip',
          data: null,
          shouldContinue: false,
        };
      }

      return await this.processInput(preprocessResult.redirectTo);
    }

    // 使用处理后的输入
    const actualInput = preprocessResult.modifiedInput || input;
    const trimmed = actualInput.trim();

    // 2. 检查是否为命令
    if (trimmed.startsWith('/')) {
      return await this.processCommand(trimmed);
    }

    // 3. 判断处理模式
    const mode = this.determineMode(trimmed);

    // 4. 根据模式处理
    let result: FlowResult;
    switch (mode) {
      case 'chat':
        result = await this.processChat(trimmed);
        break;

      case 'plan':
        result = await this.processPlan(trimmed);
        break;

      case 'execute':
        result = await this.processExecute(trimmed);
        break;

      case 'verify':
        result = await this.processVerify(trimmed);
        break;

      case 'loop':
        result = await this.processLoop(trimmed);
        break;

      default:
        result = await this.processChat(trimmed);
        break;
    }

    // 5. 后处理结果（调用插件钩子）
    result = await this.postprocessResult(result, input);

    // 重置重定向计数
    this.redirectCount = 0;

    return result;
  }

  /**
   * 预处理输入
   */
  async preprocessInput(input: string): Promise<InputProcessingResult> {
    // 1. 检查是否应该跳过
    if (await this.shouldSkip(input)) {
      return {
        shouldContinue: false,
        shouldSkip: true,
      };
    }

    // 2. 执行插件的 beforeInput 钩子
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

    // 3. 默认处理
    return {
      shouldContinue: true,
    };
  }

  /**
   * 后处理结果
   */
  async postprocessResult(result: FlowResult, input: string): Promise<FlowResult> {
    // 1. 更新会话统计
    if (result.type !== 'skip') {
      this.config.session.incrementIteration();
    }

    // 2. 执行插件的 afterInput 钩子
    if (this.config.pluginManager) {
      const pluginContext: LoopPluginContext = {
        session: this.config.session,
        config: {},
        pluginRoot: process.cwd(),
        projectRoot: this.config.session.projectRoot,
      };

      const pluginResult = await this.config.pluginManager.executeAfterInputHooks(
        result,
        pluginContext
      );

      // 如果插件修改了结果，使用修改后的结果
      if (pluginResult.modifiedResult) {
        result = pluginResult.modifiedResult;
      }

      // 如果插件要求停止，标记 shouldContinue
      if (!pluginResult.shouldContinue) {
        result.shouldContinue = false;
      }
    }

    return result;
  }

  /**
   * 判断输入的处理模式
   */
  private determineMode(input: string): FlowResultType {
    const session = this.config.session;
    const currentMode = session.currentMode;

    // 如果会话已有特定模式，继续使用
    if (currentMode === 'execute' || currentMode === 'verify') {
      return currentMode;
    }

    // 检查是否是复杂任务
    const isComplexTask = this.isComplexTask(input);
    if (isComplexTask) {
      return 'plan';
    }

    // 默认为聊天模式
    return 'chat';
  }

  /**
   * 判断是否是复杂任务
   */
  private isComplexTask(input: string): boolean {
    const complexKeywords = [
      '实现', '创建', '添加', '重构', '修改', '部署',
      'implement', 'create', 'add', 'refactor', 'deploy'
    ];

    const lowerInput = input.toLowerCase();
    return complexKeywords.some(keyword => lowerInput.includes(keyword));
  }

  /**
   * 处理命令
   */
  private async processCommand(input: string): Promise<FlowResult> {
    const parts = input.split(/\s+/);
    const command = parts[0].slice(1).toLowerCase();
    const args = parts.slice(1);

    try {
      const result = await this.config.commandManager.execute(command, args, {
        session: this.config.session,
        rawInput: input,
        frontend: this.config.frontend,
      });

      // 检查是否需要执行相应的模式
      if (result.metadata?.execute && result.metadata?.mode) {
        const mode = result.metadata.mode as FlowResultType;
        const requirement = result.metadata.requirement || result.metadata.message || result.metadata.command || '';

        // 根据模式执行相应的处理
        switch (mode) {
          case 'chat':
            return await this.processChat(requirement);
          case 'plan':
            return await this.processPlan(requirement);
          case 'execute':
            return await this.processExecute(requirement);
          case 'loop':
            return await this.processLoop(requirement);
          case 'verify':
            return await this.processVerify(requirement);
          default:
            break;
        }
      }

      return {
        type: 'command',
        data: result,
        shouldContinue: !result.metadata?.exit,
        metadata: result.metadata,
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

    this.config.frontend.writeOutput('\n💬 Chat\n', OutputStyle.INFO);

    if (!this.config.toolExecutor) {
      this.config.frontend.writeOutput(
        'Chat mode requires toolExecutor to be configured',
        OutputStyle.WARNING
      );
      return {
        type: 'chat',
        data: null,
        shouldContinue: true,
      };
    }

    try {
      // 添加用户输入记录（用于跟踪何时更新用户侧写）
      this.config.session.addUserInput(input);

      this.currentAbortController = new AbortController();

      // 获取用户侧写
      const userProfile = await this.getUserProfile();

      const response = await chatAI(
        this.config.session.config,
        input,
        this.currentAbortController.signal,
        userProfile || undefined,
        this.config.toolExecutor.getRegistry(),
        this.config.toolExecutor,
        undefined, // hookSystem
        this.config.frontend // Pass frontend for WebFrontend output
      );

      // chatAI 已经在内部打印了响应
      const success = response && !response.startsWith('Error:');

      if (success) {
        this.config.frontend.writeOutput('\n✅ Done\n', OutputStyle.SUCCESS);
      } else if (response && response.startsWith('Error:')) {
        this.config.frontend.writeError(`\n${response}\n`);
      }

      // 检查是否需要更新用户侧写
      if (this.config.session.shouldUpdateProfile()) {
        await this.updateUserProfile();
      }

      return {
        type: 'chat',
        data: { response, success },
        shouldContinue: true,
      };
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('abort')) {
        this.config.frontend.writeOutput('\n⚠️  Chat cancelled.\n', OutputStyle.WARNING);
        return {
          type: 'chat',
          data: null,
          shouldContinue: true,
        };
      }

      this.config.frontend.writeError(`Chat error: ${error.message}`);
      return {
        type: 'chat',
        data: null,
        shouldContinue: true,
        error: error.message,
      };
    } finally {
      this.resetAbortController();
    }
  }

  /**
   * 处理规划模式
   */
  private async processPlan(input: string): Promise<FlowResult> {
    this.config.session.switchMode('plan');

    this.config.frontend.writeOutput('\n📋 Planning Mode\n', OutputStyle.INFO);
    this.config.frontend.writeOutput(
      `🎯 Processing: ${input}\n`,
      OutputStyle.INFO
    );

    try {
      this.currentAbortController = new AbortController();

      // 扫描项目
      const projectInfo = await scanDirectory(this.config.projectRoot, {
        listOnly: true,
        maxFiles: 3,
      });

      // 调用 AI 进行规划
      const response = await callAI(
        this.config.session.config,
        projectInfo,
        input,
        'plan',
        this.config.session.executionHistory,
        undefined, // toolRegistryOrTools
        undefined, // grantedPermissions
        undefined, // compression
        this.config.projectRoot, // projectRoot
        this.currentAbortController.signal, // signal
        undefined, // ultrathink
        undefined, // userProfile
        undefined, // hookSystem
        this.config.memoPlugin // 🔥 memoPlugin
      );

      // 显示结果（通过 frontend 输出，使 Web 模式也能获取）
      this.config.frontend.writeOutput(
        '\n─────────────────────────────────────────────────────\n',
        OutputStyle.DEFAULT
      );
      this.config.frontend.writeOutput(
        '📋 Plan Generated\n',
        OutputStyle.DEFAULT
      );
      this.config.frontend.writeOutput(
        '─────────────────────────────────────────────────────\n\n',
        OutputStyle.DEFAULT
      );

      if (response.todo && response.todo.length > 0) {
        this.config.frontend.writeOutput('Todo:\n', OutputStyle.DEFAULT);
        response.todo.forEach((item: string, index: number) => {
          this.config.frontend.writeOutput(
            `  ${index + 1}. ${item}\n`,
            OutputStyle.DEFAULT
          );
        });
        this.config.frontend.writeOutput('\n', OutputStyle.DEFAULT);
      }

      // 返回执行结果
      return {
        type: 'plan',
        data: response,
        shouldContinue: true,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        this.config.frontend.writeOutput('\n⚠️  Planning cancelled.\n', OutputStyle.WARNING);
        return {
          type: 'plan',
          data: null,
          shouldContinue: true,
        };
      }

      this.config.frontend.writeError(`Plan error: ${error.message}`);
      return {
        type: 'plan',
        data: null,
        shouldContinue: true,
        error: error.message,
      };
    } finally {
      this.resetAbortController();
    }
  }

  /**
   * 处理执行模式
   */
  private async processExecute(input: string): Promise<FlowResult> {
    this.config.session.switchMode('execute');

    this.config.frontend.writeOutput('\n⚙️  Execute Mode\n', OutputStyle.INFO);
    this.config.frontend.writeOutput(`🎯 Executing: ${input}\n`, OutputStyle.INFO);

    if (!this.config.toolExecutor) {
      this.config.frontend.writeOutput(
        'Execute mode requires toolExecutor to be configured',
        OutputStyle.WARNING
      );
      return {
        type: 'execute',
        data: null,
        shouldContinue: true,
      };
    }

    try {
      this.currentAbortController = new AbortController();

      // 获取用户侧写
      const userProfile = await this.getUserProfile();

      // 扫描项目
      const projectInfo = await scanDirectory(this.config.projectRoot, {
        listOnly: true,
        maxFiles: 3,
      });

      // 调用 AI 获取工具调用
      const response = await callAI(
        this.config.session.config,
        projectInfo,
        input,
        'think', // 使用 think 模式获取工具调用
        this.config.session.executionHistory,
        this.config.toolExecutor.getRegistry(), // 提供 tool registry
        undefined, // grantedPermissions
        undefined, // compression
        this.config.projectRoot,
        this.currentAbortController.signal,
        undefined, // ultrathink
        userProfile || undefined,
        undefined, // hookSystem
        this.config.memoPlugin // 🔥 memoPlugin
      );

      // 检查是否有工具调用
      if (response.toolCalls && response.toolCalls.length > 0) {
        this.config.frontend.writeOutput(
          `\n📝 Executing ${response.toolCalls.length} action(s)...\n`,
          OutputStyle.INFO
        );

        // 🚀 优化：使用并行执行（自动检测依赖关系）
        const toolCallsWithIds = response.toolCalls.map(toolCall => ({
          id: toolCall.id || `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          tool: toolCall.function.name,
          parameters: JSON.parse(toolCall.function.arguments),
          dependencies: toolCall.dependencies || [] // 支持依赖关系
        }));

        // 显示要执行的工具
        toolCallsWithIds.forEach(call => {
          this.config.frontend.writeOutput(
            `  → ${call.tool}\n`,
            OutputStyle.DEFAULT
          );
        });

        // 🔥 并行执行（executeParallel 会自动处理依赖关系）
        const startTime = Date.now();
        const results = await this.config.toolExecutor.executeParallel(toolCallsWithIds);
        const duration = Date.now() - startTime;

        // 显示结果（保持原有顺序）
        results.forEach((result, index) => {
          if (result.success) {
            this.config.frontend.writeOutput(
              `  ✓ ${toolCallsWithIds[index].tool}${result.output ? ': ' + result.output.substring(0, 50) + '...' : ''}\n`,
              OutputStyle.SUCCESS
            );
          } else {
            this.config.frontend.writeOutput(
              `  ✗ ${toolCallsWithIds[index].tool}: ${result.error || 'Failed'}\n`,
              OutputStyle.ERROR
            );
          }
        });

        this.config.frontend.writeOutput(
          `\n⏱️  Execution time: ${duration}ms\n`,
          OutputStyle.INFO
        );

        const successCount = results.filter((r: any) => r.success).length;
        this.config.frontend.writeOutput(
          `\n✅ Execution complete: ${successCount}/${results.length} succeeded\n`,
          successCount === results.length ? OutputStyle.SUCCESS : OutputStyle.WARNING
        );

        return {
          type: 'execute',
          data: { response, results },
          shouldContinue: true,
        };
      } else {
        // 没有工具调用，显示 AI 的文本响应
        if (response.content || response.message) {
          this.config.frontend.writeOutput(
            `\n💡 ${response.content || response.message}\n`,
            OutputStyle.INFO
          );
        }

        return {
          type: 'execute',
          data: { response },
          shouldContinue: true,
        };
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('abort')) {
        this.config.frontend.writeOutput('\n⚠️  Execution cancelled.\n', OutputStyle.WARNING);
        return {
          type: 'execute',
          data: null,
          shouldContinue: true,
        };
      }

      this.config.frontend.writeError(`Execute error: ${error.message}`);
      return {
        type: 'execute',
        data: null,
        shouldContinue: true,
        error: error.message,
      };
    } finally {
      this.resetAbortController();
    }
  }

  /**
   * 处理验证模式
   */
  private async processVerify(input: string): Promise<FlowResult> {
    this.config.session.switchMode('verify');

    this.config.frontend.writeOutput('\n✅ Verify Mode\n', OutputStyle.INFO);
    this.config.frontend.writeOutput(`🔍 Verifying: ${input}\n`, OutputStyle.INFO);

    try {
      // 动态导入 Verifier 避免循环依赖
      const { Verifier } = await import('../../verifier');

      // 创建验证器
      const verifier = new Verifier(undefined, this.config.session.config);

      // 自动检测并添加验证阶段
      await this.detectAndAddVerificationStages(verifier);

      // 运行验证
      this.config.frontend.writeOutput(
        `\n📋 Running verification stages...\n`,
        OutputStyle.INFO
      );

      const result = await verifier.verify(this.config.projectRoot, 'fast');

      if (result.passed) {
        this.config.frontend.writeOutput(
          `\n✅ ${result.message}\n`,
          OutputStyle.SUCCESS
        );

        return {
          type: 'verify',
          data: { result, passed: true },
          shouldContinue: true,
        };
      } else {
        this.config.frontend.writeOutput(
          `\n⚠️  ${result.message}\n`,
          OutputStyle.WARNING
        );

        // 显示详细信息
        if (result.details && result.details.length > 0) {
          result.details.forEach(detail => {
            this.config.frontend.writeOutput(
              `  • ${detail}\n`,
              OutputStyle.DEFAULT
            );
          });
        }

        return {
          type: 'verify',
          data: { result, passed: false },
          shouldContinue: true,
        };
      }
    } catch (error: any) {
      this.config.frontend.writeError(`Verify error: ${error.message}`);
      return {
        type: 'verify',
        data: null,
        shouldContinue: true,
        error: error.message,
      };
    }
  }

  /**
   * 自动检测并添加验证阶段
   */
  private async detectAndAddVerificationStages(verifier: any): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    const root = this.config.projectRoot;

    // 检测 TypeScript 项目
    const hasTypeScript = fs.existsSync(path.join(root, 'tsconfig.json'));
    if (hasTypeScript) {
      verifier.addStage({
        name: 'TypeScript Check',
        required: true,
        check: async (projectRoot: string) => {
          try {
            const { execFileSync } = await import('child_process');
            execFileSync('npx', ['tsc', '--noEmit'], { cwd: projectRoot });
            return { passed: true, message: 'TypeScript compilation successful' };
          } catch (error: any) {
            return {
              passed: false,
              message: 'TypeScript compilation failed',
              details: [error.stderr?.toString() || error.message],
            };
          }
        },
      });
    }

    // 检测 ESLint
    let hasEslint = false;
    try {
      const eslintFiles = ['.eslintrc.js', '.eslintrc.json', '.eslintrc.yaml', '.eslintrc.yml', 'eslint.config.js', 'eslint.config.mjs'];
      hasEslint = eslintFiles.some(file => fs.existsSync(path.join(root, file)));
    } catch (e) {
      // Ignore errors
    }
    if (hasEslint) {
      verifier.addStage({
        name: 'ESLint',
        required: false,
        check: async (projectRoot: string) => {
          try {
            const { execFileSync } = await import('child_process');
            execFileSync('npx', ['eslint', '.', '--max-warnings=0'], { cwd: projectRoot });
            return { passed: true, message: 'No ESLint errors' };
          } catch (error: any) {
            return {
              passed: false,
              message: 'ESLint found issues',
              details: ['Run `npx eslint .` for details'],
            };
          }
        },
      });
    }

    // 检测测试
    const hasTests = fs.existsSync(path.join(root, 'test')) ||
                     fs.existsSync(path.join(root, 'tests')) ||
                     fs.existsSync(path.join(root, '__tests__'));
    if (hasTests) {
      verifier.addStage({
        name: 'Tests',
        required: true,
        check: async (projectRoot: string) => {
          try {
            const { execFileSync } = await import('child_process');
            execFileSync('npm', ['test'], { cwd: projectRoot });
            return { passed: true, message: 'All tests passed' };
          } catch (error: any) {
            return {
              passed: false,
              message: 'Tests failed',
              details: ['Run `npm test` for details'],
            };
          }
        },
      });
    }

    // 检测构建脚本
    const packageJsonPath = path.join(root, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      if (packageJson.scripts && packageJson.scripts.build) {
        verifier.addStage({
          name: 'Build',
          required: true,
          check: async (projectRoot: string) => {
            try {
              const { execFileSync } = await import('child_process');
              execFileSync('npm', ['run', 'build'], { cwd: projectRoot });
              return { passed: true, message: 'Build successful' };
            } catch (error: any) {
              return {
                passed: false,
                message: 'Build failed',
                details: ['Run `npm run build` for details'],
              };
            }
          },
        });
      }
    }
  }

  /**
   * 处理循环模式
   */
  private async processLoop(input: string): Promise<FlowResult> {
    this.config.session.switchMode('loop');

    this.config.frontend.writeOutput('\n🔄 Loop Mode\n', OutputStyle.INFO);
    this.config.frontend.writeOutput(`🎯 Task: ${input}\n`, OutputStyle.INFO);

    if (!this.config.toolExecutor) {
      this.config.frontend.writeOutput(
        'Loop mode requires toolExecutor to be configured',
        OutputStyle.WARNING
      );
      return {
        type: 'loop',
        data: null,
        shouldContinue: true,
      };
    }

    const maxIterations = 3;
    let iteration = 0;
    let satisfied = false;
    const loopResults = [];

    this.config.frontend.writeOutput(
      `📝 Max iterations: ${maxIterations}\n`,
      OutputStyle.INFO
    );

    while (iteration < maxIterations && !satisfied) {
      iteration++;

      this.config.frontend.writeOutput(
        `\n${'='.repeat(60)}\n`,
        OutputStyle.DEFAULT
      );
      this.config.frontend.writeOutput(
        `🔄 Iteration ${iteration}/${maxIterations}\n`,
        OutputStyle.INFO
      );
      this.config.frontend.writeOutput(
        `${'='.repeat(60)}\n`,
        OutputStyle.DEFAULT
      );

      // Step 1: Plan
      this.config.frontend.writeOutput(
        `\n📋 Step 1: Planning...\n`,
        OutputStyle.INFO
      );

      const planResult = await this.processPlan(input);
      loopResults.push({ step: 'plan', iteration, result: planResult });

      if (planResult.error) {
        this.config.frontend.writeError(`Planning failed: ${planResult.error}`);
        break;
      }

      // Step 2: Execute
      this.config.frontend.writeOutput(
        `\n⚙️  Step 2: Executing...\n`,
        OutputStyle.INFO
      );

      const executeResult = await this.processExecute(input);
      loopResults.push({ step: 'execute', iteration, result: executeResult });

      if (executeResult.error) {
        this.config.frontend.writeError(`Execution failed: ${executeResult.error}`);
        break;
      }

      // Step 3: Verify
      this.config.frontend.writeOutput(
        `\n✅ Step 3: Verifying...\n`,
        OutputStyle.INFO
      );

      const verifyResult = await this.processVerify(input);
      loopResults.push({ step: 'verify', iteration, result: verifyResult });

      if (verifyResult.error) {
        this.config.frontend.writeError(`Verification failed: ${verifyResult.error}`);
        break;
      }

      // Check if satisfied
      if (verifyResult.data?.passed === true) {
        satisfied = true;
        this.config.frontend.writeOutput(
          `\n🎉 Task completed successfully!\n`,
          OutputStyle.SUCCESS
        );
      } else {
        this.config.frontend.writeOutput(
          `\n⚠️  Task not satisfied, continuing to next iteration...\n`,
          OutputStyle.WARNING
        );

        // Add a small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Summary
    this.config.frontend.writeOutput(
      `\n${'='.repeat(60)}\n`,
      OutputStyle.DEFAULT
    );
    this.config.frontend.writeOutput(
      `📊 Loop Summary\n`,
      OutputStyle.INFO
    );
    this.config.frontend.writeOutput(
      `${'='.repeat(60)}\n`,
      OutputStyle.DEFAULT
    );
    this.config.frontend.writeOutput(
      `Iterations: ${iteration}/${maxIterations}\n`,
      OutputStyle.INFO
    );
    this.config.frontend.writeOutput(
      `Satisfied: ${satisfied ? '✅ Yes' : '❌ No'}\n`,
      satisfied ? OutputStyle.SUCCESS : OutputStyle.WARNING
    );

    return {
      type: 'loop',
      data: {
        iterations: iteration,
        satisfied,
        results: loopResults,
      },
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
  async shouldModify(): Promise<any> {
    // 默认不修改
    return null;
  }

  /**
   * 判断是否应该重定向
   */
  async shouldRedirect(): Promise<string | null> {
    // 默认不重定向
    return null;
  }

  /**
   * 获取用户侧写
   */
  private async getUserProfile(): Promise<string | null> {
    return await this.config.session.getUserProfile();
  }

  /**
   * 更新用户侧写
   * 生成新的用户侧写并保存到文件
   */
  private async updateUserProfile(): Promise<void> {
    this.config.frontend.writeOutput('\n📊 正在更新用户侧写...\n', OutputStyle.INFO);

    try {
      const userProfile = await this.generateUserProfile();
      await this.updateUserProfileFile(userProfile);

      // 清空输入记录
      this.config.session.clearUserInputs();

      this.config.frontend.writeOutput('✅ 用户侧写已更新！\n', OutputStyle.SUCCESS);
    } catch (error: any) {
      this.config.frontend.writeError(`更新用户侧写失败: ${error.message}`);
    }
  }

  /**
   * 生成用户侧写
   * 使用 AI 总结用户输入历史
   */
  private async generateUserProfile(): Promise<string> {
    const sessionManager = (this.config.session as any).getSessionManager?.();
    if (!sessionManager) {
      throw new Error('SessionManager not available');
    }

    // 获取用户输入历史
    const userInputs = sessionManager.getUserInputs();

    if (userInputs.length === 0) {
      return '';
    }

    // 构建提示词
    const prompt = `请根据以下用户输入历史，生成用户侧写总结。

用户输入历史：
${userInputs.map((input: string, index: number) => `${index + 1}. ${input}`).join('\n')}

请生成简洁的用户侧写（100-200字），包括：
1. 用户的沟通语言偏好（中文/英文/混合）
2. 提问风格和偏好
3. 常见话题领域
4. 其他显著特征

用户侧写：`;

    this.currentAbortController = new AbortController();

    // 使用 chatAI 生成侧写
    const profile = await chatAI(
      this.config.session.config,
      prompt,
      this.currentAbortController.signal,
      undefined, // 不使用用户侧写（避免循环）
      this.config.toolExecutor?.getRegistry(),
      this.config.toolExecutor,
      undefined, // hookSystem
      this.config.frontend
    );

    return profile;
  }

  /**
   * 更新用户侧写文件
   */
  private async updateUserProfileFile(profile: string): Promise<void> {
    const sessionManager = (this.config.session as any).getSessionManager?.();
    if (!sessionManager) {
      throw new Error('SessionManager not available');
    }

    const fs = require('fs').promises;
    const path = require('path');

    const profilePath = path.join(
      this.config.projectRoot,
      '.newma',
      'user-profile.md'
    );

    // 确保目录存在
    const profileDir = path.dirname(profilePath);
    await fs.mkdir(profileDir, { recursive: true });

    // 写入文件
    await fs.writeFile(profilePath, profile, 'utf-8');
  }

  /**
   * 获取中断信号
   */
  private getAbortSignal(): AbortSignal | undefined {
    return this.currentAbortController?.signal;
  }

  /**
   * 重置中断控制器
   */
  private resetAbortController(): void {
    this.currentAbortController = null;
  }

  /**
   * 中断当前操作
   */
  abort(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
  }
}
