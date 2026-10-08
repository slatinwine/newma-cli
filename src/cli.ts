#!/usr/bin/env node

// src/cli.ts
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import path from 'path';
import { scanDirectory } from './scanner';
import { callAI, ExtendedAIResponse } from './ai';
import { AIResponse, Action } from './types';
import { getDefaultConfig, Config } from './config';
import { ExecutionTracker } from './history';
import { RollbackManager } from './rollback';
import { handleError, isRetryable } from './errors';
import { retryWithBackoff } from './retry';
import { ToolExecutor } from './executor-v2';
import { PermissionManager, PermissionLevel } from './permissions';
import { Verifier, autoDetectStages } from './verifier';
import { AgentCoordinator } from './agents/coordinator';
import { AutonomousAgent } from './autonomous/agent';
import { CompressionConfig } from './compressor';
import { SessionManager } from './session';
import { REPLManager } from './repl';
import { LoopREPLManager } from './repl-loop';
import { getMCPConfig } from './config';
import { MCPServer } from './mcp/server';
import { createMCPServerFromRegistry, runStdioServer } from './mcp/server';
import { MCPClientManager } from './mcp/client';
import { runApiMode, readStdin, formatOutput } from './api'; // 🔥 新增：API 模式
import { MemoCliPlugin } from './loop/plugins/memo-cli-plugin'; // 🔥 新增：记忆系统集成

// 版本号单一来源：package.json（发布与 --version 永远一致）
const { readFileSync } = await import('fs');
const pkgVersion: string = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
).version ?? '0.0.0';

const program = new Command();

program
  .name('newma')
  .description(
    'Newma (牛码) - AI‑driven code assistant with planning → search → execute → verify loop.'
  )
  .version(pkgVersion)
  // 基础选项
  .option('-d, --dir <path>', 'Project root directory', process.cwd())
  // Gateway integration options
  .option('--database-path <path>', 'Gateway database path for external integration')
  .option('--workspaces-dir <path>', 'Gateway workspaces directory for external integration')
  // 可覆盖的运行时配置
  .option('--model <name>', 'OpenAI model name (default from env)')
  .option('--base-url <url>', 'OpenAI base URL, e.g. http://127.0.0.1:8000')
  .option('--api-key <key>', 'OpenAI API key (overrides settings.json and env)')
  .option('--endpoint <url>', 'Complete OpenAI API endpoint URL (overrides base-url)')
  .option('--vision-model <name>', 'Vision model name for image processing (e.g., gpt-4o, glm-4v)')
  .option('--enable-vision', 'Enable vision/multimodal features (image paste and @filename syntax)')
  .option('--max-iterations <n>', 'Maximum planning‑verify cycles', '3')
  // 循环模式选项（用于 bash 脚本）
  .option('--loop', 'Enable loop mode: exit with 0 when done, 1 when not done, 2 on error')
  // 交互模式选项
  .option('-i, --interactive', 'Start interactive REPL mode')
  .option('-c, --continue', 'Interactive mode: continue the most recent session (auto /continue)')
  .option('--web', 'Start web API server mode for external integration')
  .option('--web-port <port>', 'Web server port (default: 3000)', '3000')
  .option('--web-host <host>', 'Web server host (default: 0.0.0.0)', '0.0.0.0')
  .option('--loop-engine', 'Use Loop engine architecture (experimental, plugin-based)')
  .option('--legacy-repl', 'Use legacy readline REPL (default)')
  // UI mode 选项
  .option('--ui <mode>', 'UI mode: console (default) or ink (TUI)', 'console')
  // Phase 10: Event-Driven Architecture 选项
  .option('--use-runtime', 'Enable new event-driven runtime architecture (experimental)')
  // 输出控制选项（用于集成和测试）
  .option('-s, --silent', 'Silent mode: suppress non-essential output (logs, banners, prompts)')
  .option('-q, --quiet', 'Quiet mode: alias for --silent')
  .option('--api', 'API mode: output only AI response (no REPL, no prompts)')
  .option('--mode <mode>', 'API mode type: chat (default), plan, do')
  .option('--api-level <level>', 'API quality level: 1=fast, 2=standard, 3=deep (default: 2)', '2')
  // Phase 2 选项
  .option('--use-tools', 'Enable tool-based architecture (experimental)')
  .option('--permission-level <level>', 'Permission level: read_only|safe|standard|dangerous', 'safe')
  .option('--verify', 'Run automatic verification after each iteration')
  // Phase 3 选项
  .option('--multi-agent', 'Enable multi-agent system with specialized agents (experimental)')
  // Phase 4 选项 (默认禁用)
  .option('--autonomous', 'Enable fully autonomous execution mode (experimental)')
  .option('--no-compress', 'Disable token compression')
  .option('--no-auto-fix', 'Disable automatic fixing of failed tasks')
  .option('--no-auto-optimize', 'Disable automatic self-optimization')
  // Ultrathink 追踪选项
  .option('--trace-dir <path>', 'Enable ultrathink reasoning tracking and save traces to directory')
  // Phase 6: Function Calling API 选项
  .option('--function-calling', 'Enable OpenAI Function Calling API (experimental, requires OpenAI-compatible API)')
  .option('--no-function-calling', 'Disable Function Calling API and use JSON mode instead')
  // Two-Phase Agent System 选项
  .option('--two-phase', 'Enable Two-Phase Agent system (PlanAgent + ExecuteAgent) for improved reliability')
  .option('--execution-mode <mode>', 'Execution mode: function-calling | two-phase | multi-agent | standard', 'standard')
  // 用户需求（非交互模式下必填）
  .argument('[requirement]', 'What you want the AI to do (e.g. "add a login page")')
  .action(async (requirement: string | undefined, options) => {
    // ---------- 创建全局 AbortController 用于处理 Ctrl+C ----------
    const abortController = new AbortController();

    // 监听 SIGINT (Ctrl+C) 和 SIGTERM
    const signalHandler = () => {
      console.log(chalk.yellow('\n⚠️  Interrupted by user, shutting down gracefully...\n'));
      abortController.abort();
    };

    process.on('SIGINT', signalHandler);
    process.on('SIGTERM', signalHandler);

    try {
      // ---------- 检查 Web 模式 ----------
      if (options.web) {
        // Web API 模式：启动 HTTP 服务器
        await startWebMode(options);
        return;
      }

      // ---------- 检查交互模式 ----------
      if (options.interactive) {
        // 交互模式：启动 REPL
        await startInteractiveMode(options);
        return;
      }

      // ---------- 检查 API 模式 ----------
      if (options.api) {
        // API 模式：直接调用 AI，仅输出响应
        await startApiMode(requirement, options);
        return;
      }

    // ---------- 非交互模式：验证参数 ----------
    if (!requirement) {
      console.error(chalk.red('Error: <requirement> argument is required in non-interactive mode.'));

    // ---------- 优先设置命令行参数到环境变量（最高优先级） ----------
    if (options.apiKey) {
      process.env.OPENAI_API_KEY = options.apiKey;
    }
    if (options.baseUrl) {
      process.env.OPENAI_BASE_URL = options.baseUrl;
    }
    if (options.endpoint) {
      process.env.OPENAI_ENDPOINT = options.endpoint;
    }
    if (options.model) {
      process.env.OPENAI_MODEL = options.model;
    }
    if (options.visionModel) {
      process.env.OPENAI_VISION_MODEL = options.visionModel;
    }
      console.error(chalk.gray('Use -i or --interactive flag to start in interactive mode, or provide a requirement.'));
      process.exit(1);
    }

    // ---------- 合并运行时配置 ----------
    const defaultConfig = getDefaultConfig();
    const runtimeConfig: Config = {
      apiKey: defaultConfig.apiKey,
      model: options.model ?? defaultConfig.model,
      baseUrl: (options.baseUrl ?? defaultConfig.baseUrl).replace(/\/+$/, ''),
      endpoint: defaultConfig.endpoint, // 保留 endpoint 配置
      functionCallingEnabled: options.functionCalling ?? undefined,  // Function Calling API
      executionMode: options.twoPhase ? 'two-phase' : options.executionMode,  // Two-Phase or custom mode
    };

    // Deprecation warnings
    if (options.twoPhase) {
      console.log(chalk.yellow('\n⚠️  WARNING: --two-phase flag is deprecated'));
      console.log(chalk.yellow('   This mode will be merged into SubAgent in v4.0.0'));
      console.log(chalk.gray('   Migration: Use /set executionMode subagent (default mode)\n'));
    }

    const MAX_ITERATIONS = Number(options.maxIterations) || 3;

    // ---------- 默认功能配置 (Phase 4) ----------
    // autonomous 默认禁用，其他功能默认启用
    const enableAutonomous = options.autonomous === true;  // 默认禁用
    const enableCompress = options.compress !== false;     // 默认启用
    const enableAutoFix = options.autoFix !== false;       // 默认启用
    const enableAutoOptimize = options.autoOptimize !== false; // 默认启用

    // 循环模式（用于 bash 脚本）
    const loopMode = options.loop === true;
    if (enableAutonomous) {
      console.log(chalk.cyan('🤖 Autonomous mode: Enabled (use --autonomous flag to enable)'));
    }

    // ---------- 初始化 Phase 1 功能 ----------
    const tracker = new ExecutionTracker();
    const rollbackManager = new RollbackManager(path.resolve(options.dir));

    // ---------- 初始化 Phase 2 功能（工具系统现在是默认的）----------
    let toolExecutor: ToolExecutor;
    let verifier: Verifier | null = null;

    // Parse permission level
    let permLevel = PermissionLevel.SAFE;
    if (options.permissionLevel === 'read_only') permLevel = PermissionLevel.READ_ONLY;
    else if (options.permissionLevel === 'standard') permLevel = PermissionLevel.STANDARD;
    else if (options.permissionLevel === 'dangerous') permLevel = PermissionLevel.DANGEROUS;

    // 自主模式或多智能体需要工具系统
    if (options.useTools || enableAutonomous) {
      if (!options.useTools && enableAutonomous) {
        console.log(chalk.cyan('🔧 Tool system: Auto-enabled for autonomous mode'));
      } else if (options.useTools) {
        console.log(chalk.cyan('\n🔧 Tool-based architecture enabled'));
      }
      console.log(chalk.gray(`   Permission level: ${options.permissionLevel}`));
    }

    // Always initialize toolExecutor (for backward compatibility)
    toolExecutor = new ToolExecutor(
      tracker,
      rollbackManager,
      runtimeConfig,
      permLevel
    );

    // 🔥 新增：初始化 MemoCliPlugin（记忆系统）
    const memoPlugin = new MemoCliPlugin(path.resolve(options.dir));
    try {
      await memoPlugin.initialize();
    } catch (error) {
      console.warn(chalk.yellow(`[Memo] Memory plugin initialization failed: ${error}`));
      // Continue anyway - memory is optional
    }

    if (options.verify) {
      console.log(chalk.cyan('🔍 Automatic verification enabled'));
      verifier = new Verifier();
      autoDetectStages(verifier, path.resolve(options.dir));
    }

    // ---------- 初始化 Phase 3 功能（可选）----------
    let coordinator: AgentCoordinator | null = null;

    // 如果用户明确指定多智能体模式（但不是在自主模式下）
    if (options.multiAgent && !enableAutonomous) {
      console.log(chalk.yellow('\n⚠️  WARNING: --multi-agent flag is deprecated'));
      console.log(chalk.yellow('   This mode will be removed in v4.0.0'));
      console.log(chalk.gray('   Migration: Use /set executionMode subagent in REPL, or remove this flag\n'));
      console.log(chalk.cyan('🤖 Multi-agent system enabled'));

      coordinator = new AgentCoordinator(
        toolExecutor,
        tracker,
        rollbackManager,
        runtimeConfig,
        path.resolve(options.dir)
      );

      console.log(chalk.gray(`   Available agents: ${coordinator.getAllAgents().length}`));
      coordinator.getAllAgents().forEach(agent => {
        console.log(chalk.gray(`     - ${agent.name}: ${agent.capabilities.join(', ')}`));
      });
    }

    // ---------- Phase 4: Autonomous Mode (Highest Priority) ----------
    if (enableAutonomous) {
      console.log(chalk.cyan('\n🤖 Autonomous Mode Activated'));

      const autonomousAgent = new AutonomousAgent(
        toolExecutor!,
        tracker,
        rollbackManager,
        runtimeConfig,
        path.resolve(options.dir)
      );

      try {
        const result = await autonomousAgent.executeAutonomously(
          requirement,
          {
            maxIterations: Number(options.maxIterations) || 5,
            autoFix: enableAutoFix,
            autoOptimize: enableAutoOptimize,
            requireConfirmation: false, // Could add --confirm flag later
            stopOnError: false,
            verbose: true,
          }
        );

        // Exit based on final status
        if (result.finalStatus === 'success') {
          process.exit(0);
        } else {
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red('❌ Autonomous execution failed:'), error);
        process.exit(1);
      }
    }

    // ---------- Multi-Agent Path or Single-Agent Path ----------
    if (coordinator) {
      // Multi-agent execution
      console.log(chalk.cyan('\n🎯 Using multi-agent strategy\n'));

      try {
        // Plan task decomposition
        const plan = await coordinator.planDecomposition(requirement);

        console.log(chalk.cyan(`\n📋 Plan: ${plan.tasks.length} tasks in ${plan.executionOrder.length} groups\n`));
        plan.tasks.forEach((task, i) => {
          const assignedTo = task.assignedTo || 'TBD';
          console.log(chalk.gray(`   ${i + 1}. [${task.capabilities.join(', ')}] ${task.description}`));
          console.log(chalk.gray(`      Priority: ${task.priority}, Agent: ${assignedTo}`));
        });

        // Ask for confirmation
        const { confirmPlan } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmPlan',
            message: 'Execute this multi-agent plan?',
            default: true,
          },
        ]);

        if (!confirmPlan) {
          console.log(chalk.yellow('🛑 Cancelled multi-agent execution.'));
          process.exit(0);
        }

        // Execute plan
        const results = await coordinator.executePlan(plan, requirement);

        // Print summary
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        console.log(chalk.cyan('\n📊 Multi-Agent Execution Summary'));
        console.log(chalk.cyan('==='));
        console.log(`Total tasks: ${results.length}`);
        console.log(chalk.green(`Successful: ${successful}`));
        if (failed > 0) {
          console.log(chalk.red(`Failed: ${failed}`));
        }
        console.log(chalk.cyan('===\n'));

        if (failed === 0) {
          console.log(chalk.green('✅ All tasks completed successfully!'));
        } else {
          console.log(chalk.yellow('⚠️ Some tasks failed. You can continue iterating to fix issues.'));
        }

        // Print execution summary
        printExecutionSummary(tracker);

        let verificationPassed = true;
        if (verifier) {
          console.log(chalk.cyan('\n🔍 Running final verification...\n'));
          verifier.printSummary();

          const vr = await verifier.verify(path.resolve(options.dir), 'full');

          if (vr.passed) {
            console.log(chalk.green('\n✅ Final verification passed!'));
          } else {
            console.log(chalk.yellow('\n⚠️ Verification failed:'));
            console.log(vr.message);
            verificationPassed = false;
          }
        }

        process.exit(failed === 0 && verificationPassed ? 0 : 1);
      } catch (error) {
        console.error(chalk.red('❌ Multi-agent execution failed:'), error);
        process.exit(1);
      }
    }

    // ---------- Single-Agent Path (Original) ----------
    // ---------- 主循环 ----------
    let iteration = 0;
    let done = false;

    while (!done && iteration < MAX_ITERATIONS) {
      console.log(chalk.cyan(`\n🔁 迭代 #${iteration + 1} / ${MAX_ITERATIONS}`));

      // 开始新迭代
      tracker.startIteration();

      // (1) 搜索：获取当前最新的项目文件树（轻量级模式）
      const projectRoot = path.resolve(options.dir);
      const projectInfo = await scanDirectory(projectRoot, {
        listOnly: true,  // 只返回文件列表，不包含内容
        maxFiles: 5      // 限制文件数量以提高响应速度
      });

      // (2) 规划或验证
      const mode: 'plan' | 'verify' = iteration === 0 ? 'plan' : 'verify';
      let aiResp: ExtendedAIResponse;  // Use ExtendedAIResponse to access type and content

      // Configure compression (默认已启用，除非使用 --no-compress)
      const compression: CompressionConfig | undefined = enableCompress
        ? {
            enabled: true,
            targetReduction: 50,
            aggressive: false,
          }
        : undefined;

      try {
        aiResp = await callAI(
          runtimeConfig,
          projectInfo,
          requirement,
          mode,
          tracker.getHistory(),
          undefined, // availableTools
          undefined, // grantedPermissions
          compression, // Add compression
          projectRoot, // Add project root for context compression
          abortController.signal, // Add abort signal for Ctrl+C
          undefined, // ultrathink
          undefined, // userProfile
          undefined, // hookSystem
          memoPlugin // 🔥 Add memoPlugin for memory context
        );
      } catch (e) {
        // 检查是否是用户中断
        if (e instanceof Error && (e.name === 'AbortError' || e.message?.includes('abort'))) {
          console.log(chalk.yellow('\n⚠️  Operation cancelled by user'));
          // Loop 模式下返回特定的退出码
          if (loopMode) {
            process.exit(130); // 128 + SIGINT (2) = 130, standard for Ctrl+C
          }
          process.exit(1);
        }

        const error = handleError(e);
        console.error(chalk.red('❌ 调用 LLM 失败:'), error.getUserMessage());

        // 尝试重试
        if (isRetryable(error)) {
          console.log(chalk.yellow('\n🔄 尝试重试...'));
          const result = await retryWithBackoff(
            () =>
              callAI(
                runtimeConfig,
                projectInfo,
                requirement,
                mode,
                tracker.getHistory(),
                undefined,
                undefined,
                compression,
                projectRoot,
                abortController.signal,
                undefined, // ultrathink
                undefined, // userProfile
                undefined, // hookSystem
                memoPlugin // 🔥 Add memoPlugin for memory context
              ),
            { maxAttempts: 3, initialDelay: 1000, maxDelay: 10000, backoffMultiplier: 2 }
          );

          if (result.success) {
            aiResp = result.data;
            console.log(chalk.green('✅ 重试成功'));
          } else {
            process.exit(1);
          }
        } else {
          process.exit(1);
        }
      }

      // ---- 验证阶段的处理 ----
      if (mode === 'verify') {
        // Improved verification logic:
        // - done: true AND no actions → Task is complete, exit loop
        // - done: true BUT has actions → AI wants to apply fixes, continue
        // - done: false AND no actions → Verification failed but unclear what to do, continue
        // - done: false AND has actions → More work needed, continue

        const isActuallyDone = aiResp.done && (!aiResp.actions || aiResp.actions.length === 0);

        if (isActuallyDone) {
          console.log(chalk.green('✅ 验证通过，需求已经完成！'));
          done = true;
          break;
        } else {
          if (aiResp.done && aiResp.actions && aiResp.actions.length > 0) {
            console.log(chalk.yellow('⚠️ 验证基本通过，但有改进建议需要执行。'));
          } else if (!aiResp.done) {
            console.log(chalk.yellow('⚠️ 验证未通过，需要继续改进。'));
          } else {
            console.log(chalk.yellow('⚠️ 验证状态不明确，继续执行。'));
          }
        }
      }

      // ---- 打印本轮 TODO 与 Action Plan ----
      // Special handling for plain text responses (no todo/actions)
      if (aiResp.type === 'analysis') {
        // Plain text response - just display the content
        console.log(chalk.magenta('\n=== AI Response ===\n'));
        console.log(aiResp.content || 'No response content');
        console.log(chalk.gray('\n✓ Response completed (plain text mode)\n'));
        break; // Exit the loop
      }

      console.log(chalk.magenta('\n=== TODO List ==='));
      aiResp.todo.forEach((t: string, i: number) => console.log(`${i + 1}. ${t}`));

      console.log(chalk.magenta('\n=== Action Plan ==='));
      aiResp.actions.forEach((a: Action, i: number) => {
        const desc = describeAction(a);
        console.log(`${i + 1}. ${desc}`);
      });

      // ---- 手动确认是否执行本轮 Action Plan（可选）----
      // Skip confirmation for plain text responses (no actions to execute)
      const hasActionsToExecute = aiResp.actions && aiResp.actions.length > 0;
      if (!hasActionsToExecute) {
        console.log(chalk.gray('\nⓘ No actions to execute, skipping confirmation.\n'));
        break;
      }

      // Loop 模式下跳过确认
      if (loopMode) {
        console.log(chalk.gray('Loop mode: Skipping confirmation, executing...\n'));
      } else {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `是否执行本轮 Action Plan？`,
            default: true,
          },
        ]);
        if (!confirm) {
          console.log(chalk.yellow('🛑 已取消执行当前计划，结束循环。'));
          break;
        }
      }

      // ---- (3) 执行 Action Plan ----
      let executionFailed = false;
      let failedAction: Action | null = null;

      for (const action of aiResp.actions) {
        const result = await toolExecutor.executeAction(action, rollbackManager);

        // 记录执行结果
        tracker.recordExecution(
          action,
          result.success ? 'success' : 'failed',
          result.duration,
          result.error
        );

        if (!result.success) {
          executionFailed = true;
          failedAction = action;

          console.error(
            chalk.red(`\n❌ Action 执行失败: ${describeAction(action)}`)
          );
          console.error(chalk.red(`   错误: ${result.error}`));

          // 尝试回滚
          if (action.dangerous !== false && rollbackManager.isAvailable()) {
            console.log(chalk.yellow('\n🔄 尝试回滚更改...'));

            const latestPoint = rollbackManager.getLatestRestorePoint();
            if (latestPoint) {
              let shouldRollback = true;

              // Loop 模式下自动回滚
              if (!loopMode) {
                const promptResult = await inquirer.prompt([
                  {
                    type: 'confirm',
                    name: 'shouldRollback',
                    message: `回滚到上一个检查点 (${latestPoint.hash})?`,
                    default: true,
                  },
                ]);
                shouldRollback = promptResult.shouldRollback;
              }

              if (shouldRollback) {
                const rollbackSuccess = await rollbackManager.rollback(
                  latestPoint.hash
                );
                if (rollbackSuccess) {
                  console.log(
                    chalk.green('✅ 回滚成功，已恢复到上一个检查点')
                  );
                } else {
                  console.error(chalk.red('❌ 回滚失败'));
                }
              }
            }
          }

          break; // 停止执行剩余的 actions
        }
      }

      // 如果执行失败，询问是否继续
      if (executionFailed) {
        // Loop 模式下遇到错误直接退出，返回错误码
        if (loopMode) {
          console.log(chalk.red('\n❌ Execution failed in loop mode, exiting with error code 2'));
          process.exit(2);
        }

        const { shouldContinue } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'shouldContinue',
            message: '执行过程中出现错误，是否继续下一轮迭代？',
            default: false,
          },
        ]);

        if (!shouldContinue) {
          console.log(chalk.yellow('\n🛑 用户选择终止执行。'));
          break;
        }
      }

      // ---------- 自动验证（Phase 2） ----------
      if (verifier && iteration > 0) {
        console.log(chalk.cyan('\n🔍 Running automatic verification...'));
        verifier.printSummary();

        const verificationResult = await verifier.verify(
          projectRoot,
          'fast'  // Use fast mode for early iterations
        );

        if (!verificationResult.passed) {
          console.log(chalk.yellow(`⚠️ Verification failed: ${verificationResult.message}`));

          // Ask AI to fix verification issues
          console.log(chalk.cyan('\n🔧 Asking AI to fix verification issues...\n'));

          try {
            const fixResponse = await callAI(
              runtimeConfig,
              await scanDirectory(projectRoot, {
                listOnly: true,
                maxFiles: 5
              }),
              `Fix these verification failures:\n${verificationResult.message}\nDetails:\n${verificationResult.details?.join('\n')}`,
              'plan',
              tracker.getHistory(),
              undefined, // availableTools
              undefined, // grantedPermissions
              undefined, // compression
              projectRoot,
              abortController.signal,
              undefined, // ultrathink
              undefined, // userProfile
              undefined, // hookSystem
              memoPlugin // 🔥 Add memoPlugin for memory context
            );

            // Execute the fixes
            for (const action of fixResponse.actions) {
              const result = await toolExecutor.executeAction(action, rollbackManager);
              tracker.recordExecution(
                action,
                result.success ? 'success' : 'failed',
                result.duration,
                result.error
              );

              if (!result.success) {
                console.error(chalk.red(`❌ Fix failed: ${result.error}`));
                break;
              }
            }

            // Re-run verification
            console.log(chalk.cyan('\n🔍 Re-running verification...\n'));
            const recheckResult = await verifier.verify(projectRoot, 'full');

            if (recheckResult.passed) {
              console.log(chalk.green('\n✅ Verification passed after fixes!'));
            } else {
              console.log(chalk.red('\n❌ Verification still failing. Please review manually.'));
              // In loop mode, don't set done=true - let the loop continue naturally
              // In non-loop mode, stop for manual review
              if (!loopMode) {
                done = true; // Stop iteration for manual review
              }
            }
          } catch (error) {
            // 检查是否是用户中断
            if (error instanceof Error && (error.name === 'AbortError' || error.message?.includes('abort'))) {
              console.log(chalk.yellow('\n⚠️  Operation cancelled by user'));
              if (loopMode) {
                process.exit(130); // Ctrl+C
              }
              break;
            }
            console.error(chalk.red('❌ Failed to get fixes from AI')), error;
          }
        } else {
          console.log(chalk.green('✅ Verification passed!'));
        }
      }

      iteration++;
    } // end while

    // 打印执行摘要
    printExecutionSummary(tracker);

    if (!done) {
      console.log(
        chalk.yellow('\n⚠️ 达到最大迭代次数或手动终止，可能仍未完全满足需求。')
      );
    }

    // Loop 模式下返回退出码
    if (loopMode) {
      if (done) {
        // 任务完成
        console.log(chalk.green('\n✅ Task completed successfully, exiting with code 0'));
        process.exit(0);
      } else {
        // 任务未完成
        console.log(chalk.yellow('\n⚠️ Task not completed, exiting with code 1'));
        process.exit(1);
      }
    }
    } finally {
      // 清理信号监听器
      process.removeListener('SIGINT', signalHandler);
      process.removeListener('SIGTERM', signalHandler);
    }
  });

// ============================================================================
// API Mode
// ============================================================================

/**
 * 启动 API 模式
 *
 * 直接调用 AI，仅输出响应内容，不包含任何元数据或日志
 * 适用于程序化调用和测试
 */
async function startApiMode(requirement: string | undefined, options: any): Promise<void> {
  // API 模式下把日志重定向到 stderr，stdout 只输出最终响应
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  console.log = (...args: any[]) => process.stderr.write(args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') + '\n');
  console.warn = (...args: any[]) => process.stderr.write(args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') + '\n');
  console.info = (...args: any[]) => process.stderr.write(args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') + '\n');

  try {
    // 合并配置
    const defaultConfig = getDefaultConfig();
    const runtimeConfig: Config = {
      apiKey: defaultConfig.apiKey,
      model: options.model ?? defaultConfig.model,
      baseUrl: (options.baseUrl ?? defaultConfig.baseUrl).replace(/\/+$/, ''),
      endpoint: defaultConfig.endpoint,
      executionMode: options.twoPhase ? 'two-phase' : options.executionMode,
      enableVision: options.enableVision ?? defaultConfig.enableVision,
      visionModel: options.visionModel ?? defaultConfig.visionModel,
    };

    // 确定输入来源
    let input: string;
    if (!requirement) {
      // 从 stdin 读取
      try {
        input = await readStdin();
      } catch (error) {
        console.error(chalk.red('Error: Failed to read from stdin.'));
        console.error(chalk.gray('Provide input as argument or via stdin: echo "input" | npx newma-cli --api'));
        process.exit(1);
      }
    } else {
      input = requirement;
    }

    // 如果输入为空，报错退出
    if (!input || input.trim() === '') {
      console.error(chalk.red('Error: Input is empty.'));
      process.exit(1);
    }

    // 确定 API 模式（chat/plan/do）
    const apiMode: 'chat' | 'plan' | 'do' =
      options.mode === 'plan' ? 'plan' :
      options.mode === 'do' ? 'do' : 'chat';

    // 调用 API 模式
    const response = await runApiMode(
      runtimeConfig,
      path.resolve(options.dir),
      input,
      {
        mode: apiMode,
        silent: true, // API 模式总是静默的
      }
    );

    // 输出响应（恢复 console.log 后输出到 stdout）
    console.log = originalLog;
    console.warn = originalWarn;
    console.info = originalInfo;
    console.log(response);

    // 成功退出
    process.exit(0);
  } catch (error: any) {
    // 错误时输出到 stderr
    console.log = originalLog;
    console.warn = originalWarn;
    console.info = originalInfo;
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

// ========== GitLab Integration Commands ==========

const gitlabCmd = program
  .command('gitlab')
  .description('GitLab integration commands');

// GitLab review command
gitlabCmd
  .command('review')
  .description('Review a GitLab merge request')
  .option('--iid <mr_iid>', 'Merge request IID')
  .option('--project-id <project_id>', 'GitLab project ID')
  .option('--gitlab-url <url>', 'GitLab server URL')
  .option('--gitlab-token <token>', 'GitLab access token')
  .option('--auto-fix', 'Automatically fix issues (experimental)')
  .option('--dry-run', 'Run without publishing to GitLab')
  .action(async (options) => {
    const { runGitLabCIFromArgs } = await import('./gitlab-ci');

    console.log(chalk.cyan('\n🔍 GitLab Merge Request Review\n'));

    try {
      const exitCode = await runGitLabCIFromArgs({
        projectId: options.projectId ? parseInt(options.projectId) : undefined,
        mrIid: options.iid ? parseInt(options.iid) : undefined,
        gitlabUrl: options.gitlabUrl,
        gitlabToken: options.gitlabToken,
        autoFix: options.autoFix,
        dryRun: options.dryRun,
      });

      process.exit(exitCode);
    } catch (error: any) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// GitLab setup command
gitlabCmd
  .command('setup')
  .description('Generate GitLab CI configuration file')
  .option('-o, --output <path>', 'Output file path', '.gitlab-ci.yml')
  .action(async (options) => {
    const { promises: fs } = await import('fs');
    const path = await import('path');

    console.log(chalk.cyan('\n🔧 GitLab CI Setup\n'));

    try {
      // Get template content
      const templatePath = path.join(__dirname, '../templates/gitlab-ci.yml');

      try {
        // Copy template to output path
        await fs.copyFile(templatePath, options.output);

        console.log(chalk.green(`✅ Created ${options.output}`));
        console.log(chalk.gray('\nNext steps:'));
        console.log(chalk.gray('1. Review and customize the CI configuration'));
        console.log(chalk.gray('2. Set GITLAB_URL and GITLAB_TOKEN as CI/CD variables'));
        console.log(chalk.gray('3. Commit and push .gitlab-ci.yml to your repository'));
        console.log(chalk.gray('4. Create a merge request to test the integration\n'));

        process.exit(0);
      } catch (error: any) {
        console.error(chalk.red(`❌ Failed to create ${options.output}: ${error.message}`));
        process.exit(1);
      }
    } catch (error: any) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// GitLab webhook command
gitlabCmd
  .command('webhook')
  .description('Start GitLab webhook server')
  .option('--port <port>', 'Webhook server port', '3000')
  .option('--host <host>', 'Webhook server host', '0.0.0.0')
  .option('--path <path>', 'Webhook endpoint path', '/webhook/gitlab')
  .option('--secret <secret>', 'Webhook secret for verification')
  .action(async (options) => {
    const { createMergeRequestWebhookServer } = await import('./gitlab/webhook');
    const { getDefaultConfig } = await import('./config');
    const { MergeRequestReviewer } = await import('./gitlab/reviewer');
    const { publishReviewResults } = await import('./gitlab/reviewer');
    const { createClientFromEnv } = await import('./gitlab/client');

    console.log(chalk.cyan('\n🔌 GitLab Webhook Server\n'));

    try {
      // Create webhook server
      const server = createMergeRequestWebhookServer(
        {
          port: parseInt(options.port),
          host: options.host,
          path: options.path,
          secret: options.secret,
        },
        async (event) => {
          // Extract MR info
          const { projectId, mrIid, title, author } = require('./gitlab/webhook').MergeRequestEventHandler.extractMRInfo(event);

          console.log(chalk.cyan(`\n📋 Processing MR !${mrIid}: ${title}`));
          console.log(chalk.gray(`👤 Author: ${author}`));

          try {
            // Create reviewer
            const client = createClientFromEnv();
            if (!client) {
              console.error(chalk.red('❌ Failed to create GitLab client'));
              return;
            }

            const config = await import('./gitlab/types').then(m => ({
              url: process.env.GITLAB_URL || '',
              token: process.env.GITLAB_TOKEN || '',
              projectId,
              mergeRequestId: mrIid,
            }));

            const aiConfig = getDefaultConfig();
            const reviewer = new MergeRequestReviewer(config, aiConfig);

            // Perform review
            const result = await reviewer.reviewMergeRequest(projectId, mrIid);

            // Publish results
            await publishReviewResults(client, projectId, mrIid, result);

            console.log(chalk.green('✅ Review complete\n'));
          } catch (error: any) {
            console.error(chalk.red(`❌ Review failed: ${error.message}\n`));
          }
        }
      );

      // Start server
      await server.start();

      console.log(chalk.gray('\nPress Ctrl+C to stop the server\n'));

      // Handle shutdown
      process.on('SIGINT', async () => {
        console.log(chalk.yellow('\n⚠️  Received interrupt signal, stopping server...\n'));
        await server.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log(chalk.yellow('\n⚠️  Received terminate signal, stopping server...\n'));
        await server.stop();
        process.exit(0);
      });

    } catch (error: any) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

program.parseAsync(process.argv);

/** 将 Action 转成易读文字（保持不变） */
function describeAction(action: Action): string {
  switch (action.type) {
    case 'create':
      return `创建文件 ${action.path}`;
    case 'modify':
      return `修改文件 ${action.path}`;
    case 'delete':
      return `删除文件 ${action.path}`;
    case 'run':
      return `执行命令 "${action.command}"`;
    case 'verify':
      return `验证 "${action.command}"`;
    default:
      return `未知操作 ${JSON.stringify(action)}`;
  }
}

/** 打印执行摘要 */
function printExecutionSummary(tracker: ExecutionTracker): void {
  const summary = tracker.getSummary();

  console.log(chalk.cyan('\n📊 执行摘要'));
  console.log(chalk.cyan('==='));
  console.log(`总操作数: ${summary.totalActions}`);
  console.log(chalk.green(`成功: ${summary.successful}`));
  if (summary.failed > 0) {
    console.log(chalk.red(`失败: ${summary.failed}`));
  }
  if (summary.rolledBack > 0) {
    console.log(chalk.yellow(`已回滚: ${summary.rolledBack}`));
  }
  console.log(`总耗时: ${(summary.totalDuration / 1000).toFixed(2)}s`);
  console.log(chalk.cyan('===\n'));
}

/**
 * 启动 Web API 模式
 */
async function startWebMode(options: any): Promise<void> {
  // 合并配置
  const defaultConfig = getDefaultConfig();
  const runtimeConfig: Config = {
    apiKey: defaultConfig.apiKey,
    model: options.model ?? defaultConfig.model,
    baseUrl: (options.baseUrl ?? defaultConfig.baseUrl).replace(/\/+$/, ''),
    endpoint: defaultConfig.endpoint,
    executionMode: options.twoPhase ? 'two-phase' : options.executionMode,
    // Vision configuration
    enableVision: options.enableVision ?? defaultConfig.enableVision,
    visionModel: options.visionModel ?? defaultConfig.visionModel,
  };

  // 解析权限级别
  // Web 模式默认使用 DANGEROUS 级别，允许自动执行命令（无需交互确认）
  let permLevel = PermissionLevel.DANGEROUS;
  if (options.permissionLevel === 'read_only') permLevel = PermissionLevel.READ_ONLY;
  else if (options.permissionLevel === 'standard') permLevel = PermissionLevel.STANDARD;
  else if (options.permissionLevel === 'safe') permLevel = PermissionLevel.SAFE;

  console.log(chalk.cyan('\n🌐 Starting Web API Server Mode\n'));
  console.log(chalk.gray('─').repeat(50));

  // 创建会话管理器
  const needsToolSystem = options.useTools ||
                          (runtimeConfig.executionMode === 'subagent');

  const session = new SessionManager(
    path.resolve(options.dir),
    runtimeConfig,
    {
      permissionLevel: permLevel,
      useTools: needsToolSystem,
      useVerify: options.verify,
      useMultiAgent: options.multiAgent,
      enableAutonomous: false, // Web 模式不使用 autonomous
      traceDir: options.traceDir || null,
    }
  );

  // 导入 Web Frontend
  const { WebFrontend } = await import('./loop/frontends/web-frontend');
  const { LoopEngine } = await import('./loop/core/loop-engine');
  const { AIFlowController } = await import('./loop/core/ai-flow-controller');
  const { LoopSessionManagerAdapter } = await import('./loop/core/session-adapter');
  const { CommandManager } = await import('./loop/commands/command-manager');
  const { CorePluginCommands } = await import('./loop/plugins/core-plugin');
  const { ToolExecutor } = await import('./executor-v2');
  const { RollbackManager } = await import('./rollback');
  const { HookSystem } = await import('./hooks');
  const { PluginSystem } = await import('./plugins');
  const { ToolRegistry } = await import('./tools/registry');

  // 创建 Web Frontend
  const frontend = new WebFrontend({
    port: parseInt(options.webPort),
    host: options.webHost,
    colors: true,
    debug: process.env.DEBUG === '1',
  });

  // 创建会话适配器
  const loopSession = new LoopSessionManagerAdapter(session, frontend);

  // 创建命令管理器
  const commandManager = new CommandManager();
  const coreCommands = CorePluginCommands.getAllCommands(commandManager);
  coreCommands.forEach(cmd => commandManager.register(cmd, 'core'));

  // 注册模式命令（/plan, /do, /loop, /chat 等）
  const { ModeCommandsPlugin } = await import('./loop/plugins/mode-commands-plugin');
  const modeCommands = ModeCommandsPlugin.getAllCommands();
  modeCommands.forEach(cmd => commandManager.register(cmd, 'mode'));

  // 创建工具系统组件
  const rollbackManager = new RollbackManager(path.resolve(options.dir));
  const hookSystem = new HookSystem({ enabled: false });
  const pluginSystem = new PluginSystem(
    {
      enabled: true,
      directories: [
        path.join(path.resolve(options.dir), '.kode', 'plugins'),
        path.join(path.resolve(options.dir), 'plugins'),
      ],
      timeout: 30000,
      validateDependencies: true,
      verbose: false,
    },
    new ToolRegistry(),
    hookSystem,
    path.resolve(options.dir)
  );

  // 创建工具执行器
  const toolExecutor = new ToolExecutor(
    session.getTracker(),
    rollbackManager,
    session.getConfig(),
    session.getPermissionLevel(),
    hookSystem,
    pluginSystem
  );

  // 初始化插件系统（异步，不阻塞启动）
  toolExecutor.initializePlugins(session.getConfig()).catch((error) => {
    console.error(chalk.yellow('[PLUGIN] Failed to initialize plugins:'), error.message);
  });

  // 🔥 新增：初始化 MemoCliPlugin（记忆系统）
  const memoPlugin = new MemoCliPlugin(path.resolve(options.dir));
  try {
    await memoPlugin.initialize();
    console.log(chalk.gray('✓ Memory plugin initialized'));
  } catch (error) {
    console.warn(chalk.yellow(`[Memo] Memory plugin initialization failed: ${error}`));
    // Continue anyway - memory is optional
  }

  // 创建 AI Flow Controller
  const flowController = new AIFlowController({
    commandManager,
    session: loopSession,
    frontend,
    projectRoot: path.resolve(options.dir),
    toolExecutor,
    rollbackManager,
    memoPlugin, // 🔥 Add memoPlugin for memory context
  });

  // 创建 Loop Engine
  const engine = new LoopEngine(
    frontend,
    flowController,
    loopSession,
    {
      frontend,
      sessionOptions: {},
      enableCommands: true,
      enablePlugins: false, // Web 模式暂时不启用插件
    }
  );

  // 设置中断处理器
  frontend.setInterruptHandler(() => {
    console.log(chalk.yellow('\n⚠️  Shutting down web server gracefully...\n'));
    engine.stop().then(() => process.exit(0));
  });

  // 启动引擎
  try {
    await engine.start();

    console.log(chalk.cyan('\n✅ Web server is ready to accept requests'));
    console.log(chalk.gray('\nPress Ctrl+C to stop the server\n'));

    // 保持运行
    await new Promise(() => {
      //永远不会 resolve，直到进程被终止
    });
  } catch (error: any) {
    console.error(chalk.red(`\n❌ Failed to start web server: ${error.message}\n`));
    process.exit(1);
  }
}

/**
 * 启动交互式 REPL 模式
 */
async function startInteractiveMode(options: any): Promise<void> {
  // 合并配置
  const defaultConfig = getDefaultConfig();
  const runtimeConfig: Config = {
    apiKey: defaultConfig.apiKey,
    model: options.model ?? defaultConfig.model,
    baseUrl: (options.baseUrl ?? defaultConfig.baseUrl).replace(/\/+$/, ''),
    endpoint: defaultConfig.endpoint, // 保留 endpoint 配置
    executionMode: options.twoPhase ? 'two-phase' : options.executionMode,  // 传递 executionMode
    // Vision configuration
    enableVision: options.enableVision ?? defaultConfig.enableVision,
    visionModel: options.visionModel ?? defaultConfig.visionModel,
  };

  // 解析权限级别
  let permLevel = PermissionLevel.SAFE;
  if (options.permissionLevel === 'read_only') permLevel = PermissionLevel.READ_ONLY;
  else if (options.permissionLevel === 'standard') permLevel = PermissionLevel.STANDARD;
  else if (options.permissionLevel === 'dangerous') permLevel = PermissionLevel.DANGEROUS;

  // 检查使用哪个 REPL 版本
  const useLoopEngine = options.loopEngine === true;
  const useRuntime = options.useRuntime === true;

  if (useLoopEngine) {
    console.log(chalk.cyan('\n🔧 Using Loop Engine REPL (Plugin-based architecture)'));
    console.log(chalk.gray('─').repeat(50));
  }

  if (useRuntime) {
    console.log(chalk.cyan('\n🚀 Using New Event-Driven Runtime (Experimental)'));
    console.log(chalk.gray('─').repeat(50));
  }

  // 创建会话管理器
  // SubAgent 模式需要工具系统，自动启用
  const needsToolSystem = options.useTools ||
                          (runtimeConfig.executionMode === 'subagent');

  // 如果启用新运行时，需要工具系统
  const needsToolSystemFinal = needsToolSystem || useRuntime;

  const session = new SessionManager(
    path.resolve(options.dir),
    runtimeConfig,
    {
      permissionLevel: permLevel,
      useTools: needsToolSystemFinal,
      useVerify: options.verify,
      useMultiAgent: options.multiAgent,
      enableAutonomous: options.autonomous !== false,
      traceDir: options.traceDir || null, // 传递追踪目录
      useRuntime: useRuntime, // 传递运行时选项
    }
  );

  // 根据选项创建 REPL 管理器
  // 解析静默模式（silent 和 quiet 是别名）
  const silentMode = options.silent || options.quiet || false;
  const useInkUI = options.ui === 'ink';

  if (useInkUI && !useLoopEngine) {
    // ── Ink TUI 模式 ──
    console.log(chalk.cyan('\n🖥️  Starting Ink TUI mode...\n'));

    // 动态 import ESM UI modules
    // Dynamic import of ESM UI — compiled separately by tsconfig.ui.json
    const { createInkREPLBridge } = await import(/* webpackIgnore: true */ '../dist/ui/ink-repl.js') as any;
    const { createOutputAdapter } = await import('./output-adapter.js');

    // 创建 InkAdapter 用于 REPL 输出
    const outputAdapter = createOutputAdapter('ink');

    // 创建 REPL（silent=true 避免它自己打印欢迎信息，Ink 会处理）
    const repl = new REPLManager(session, true);
    // 注入 outputAdapter 到 REPL（如果 REPL 支持的话）
    if ((repl as any).setOutputAdapter) {
      (repl as any).setOutputAdapter(outputAdapter);
    }

    // 创建异步输入队列
    const inputQueue: { input: string; resolve: () => void }[] = [];
    let inputResolve: ((value: string) => void) | null = null;

    const getNextInput = (): Promise<string> => {
      return new Promise<string>((resolve) => {
        if (inputQueue.length > 0) {
          const item = inputQueue.shift()!;
          resolve(item.input);
        } else {
          inputResolve = resolve;
        }
      });
    };

    // 启动 Ink bridge
    const bridge = createInkREPLBridge({
      onSubmit: (input: string) => {
        if (inputResolve) {
          inputResolve(input);
          inputResolve = null;
        } else {
          inputQueue.push({ input, resolve: () => {} });
        }
      },
      onInterrupt: () => {
        // Ctrl+C handling
        console.log(chalk.yellow('\n⚠️  Interrupted'));
      },
      model: runtimeConfig.model,
    });

    // 启动 Ink render（后台）
    const inkPromise = bridge.start();

    // 替换 REPL 的 readline 为队列输入
    // Monkey-patch: 让 REPL 从队列获取输入
    const originalStart = repl.start.bind(repl);
    repl.start = function(this: any): void {
      // 不调用原始 start（它会创建 readline）
      // 改为启动一个循环从队列读取输入
      const processInput = async () => {
        // 打印欢迎信息到 Ink
        outputAdapter.log(chalk.cyan('🖥️  牛码 v3.0 — Ink TUI Mode'));
        outputAdapter.log(chalk.cyan('🖥️  牛码 v3.0 — Ink TUI Mode'));
        outputAdapter.log(chalk.gray('Type /help for commands, /exit to quit.\n'));

        while (true) {
          const input = await getNextInput();
          if (!input.trim()) continue;
          if (input.trim() === '/exit' || input.trim() === '/quit') {
            process.exit(0);
          }
          // 调用 REPL 的命令处理
          if (input.startsWith('/')) {
            try {
              await (repl as any).handleSpecialCommand(input);
            } catch (e: any) {
              outputAdapter.error(`Command error: ${e.message}`);
            }
          } else {
            try {
              await (repl as any).processUserInput?.(input);
            } catch (e: any) {
              outputAdapter.error(`Error: ${e.message}`);
            }
          }
        }
      };
      processInput().catch((_e) => { /* cli: processInput failed */ });
    };

    // 启动修改后的 REPL
    repl.start();

    // 等待 Ink 退出
    await inkPromise;
  } else if (useLoopEngine) {
    // 使用 Loop Engine REPL (实验性)
    const repl = new LoopREPLManager(session);
    await repl.start();
  } else {
    // 使用传统的 readline REPL
    const repl = new REPLManager(session, silentMode);
    repl.start();

    // 🕘 --continue/-c：启动后自动继续最近会话（等 REPL 内部就绪）
    if (options.continue) {
      void repl.continueLastSession();
    }
  }
}

// ============================================================================
// MCP Commands
// ============================================================================

// MCP list command
program
  .command('mcp:list')
  .description('List all configured MCP servers')
  .action(async () => {
    const { enabled, servers } = getMCPConfig();

    if (!enabled) {
      console.log(chalk.yellow('MCP is not enabled in settings.json'));
      console.log(chalk.gray('Add "mcp": { "enabled": true } to enable it'));
      return;
    }

    const serverNames = Object.keys(servers);

    if (serverNames.length === 0) {
      console.log(chalk.yellow('No MCP servers configured'));
      console.log(chalk.gray('Add servers to settings.json under "mcp.servers"'));
      return;
    }

    console.log(chalk.cyan(`\n📋 MCP Servers (${serverNames.length})\n`));

    for (const [name, config] of Object.entries(servers)) {
      const status = config.disabled
        ? chalk.red('disabled')
        : chalk.green('enabled');

      console.log(`${chalk.bold(name)} [${status}]`);
      console.log(chalk.gray(`  Command: ${config.command}`));
      console.log(chalk.gray(`  Args: ${config.args.join(' ')}`));
      if (config.transport) {
        console.log(chalk.gray(`  Transport: ${config.transport}`));
      }
      console.log();
    }
  });

// MCP test command
program
  .command('mcp:test <serverName>')
  .description('Test connection to an MCP server')
  .action(async (serverName: string) => {
    const { enabled, servers } = getMCPConfig();

    if (!enabled) {
      console.log(chalk.yellow('MCP is not enabled in settings.json'));
      return;
    }

    const config = servers[serverName];
    if (!config) {
      console.log(chalk.red(`Server "${serverName}" not found in configuration`));
      return;
    }

    if (config.disabled) {
      console.log(chalk.yellow(`Server "${serverName}" is disabled`));
      return;
    }

    console.log(chalk.cyan(`\n🔍 Testing MCP server: ${serverName}\n`));

    try {
      const manager = new MCPClientManager();
      await manager.addClient(serverName, config);

      const client = manager.getClient(serverName);
      if (!client) {
        throw new Error('Failed to get client');
      }

      // List tools
      console.log(chalk.gray('Fetching tools...'));
      const tools = await client.listTools();
      console.log(chalk.green(`✓ Connected! Found ${tools.length} tool(s)\n`));

      if (tools.length > 0) {
        console.log(chalk.cyan('Available tools:'));
        for (const tool of tools) {
          console.log(chalk.gray(`  - ${tool.name}: ${tool.description}`));
        }
      }

      await manager.disconnectAll();
      console.log(chalk.green('\n✓ Test successful'));
    } catch (error) {
      console.log(chalk.red(`\n✗ Test failed: ${error}\n`));
      process.exit(1);
    }
  });

// MCP server command
program
  .command('mcp-server')
  .description('Run Kode as an MCP server (exposes tools via stdio)')
  .action(async () => {
    console.log(chalk.cyan('🔌 Starting Kode MCP Server...\n'));

    // Create a minimal tool registry
    const { ToolRegistry: ToolRegistryClass } = await import('./tools/registry');
    const { fileTool } = await import('./tools/builtin/file');
    const { commandTool } = await import('./tools/builtin/command');

    const registry = new ToolRegistryClass();
    registry.register(fileTool);
    registry.register(commandTool);

    // Create MCP server
    const server = createMCPServerFromRegistry(registry);

    console.log(chalk.gray('Server running in stdio mode'));
    console.log(chalk.gray('Waiting for JSON-RPC requests on stdin/stdout...\n'));

    // Run server
    await runStdioServer(server);
  });

// Validate plugin command
program
  .command('validate-plugin <path>')
  .description('Validate a Kode plugin code')
  .action(async (pluginPath: string) => {
    const { promises: fs } = await import('fs');
    const path = await import('path');

    console.log(chalk.cyan(`\n🔍 Validating plugin: ${pluginPath}\n`));

    try {
      // Resolve path
      const resolvedPath = path.resolve(pluginPath);

      // Check if file exists
      try {
        await fs.access(resolvedPath);
      } catch {
        console.log(chalk.red(`❌ File not found: ${resolvedPath}\n`));
        process.exit(1);
      }

      // Read plugin code
      const code = await fs.readFile(resolvedPath, 'utf-8');

      // Import validator
      const { PluginCodeValidator } = await import('./skills-creator/validator');
      const validator = new PluginCodeValidator();

      // Validate
      console.log(chalk.gray('Running validation checks...\n'));
      const result = validator.validate(code);

      // Display results
      validator.displayValidation(result);

      // Exit with appropriate code
      if (result.valid) {
        console.log(chalk.green('\n✅ Plugin validation passed!\n'));
        process.exit(0);
      } else {
        console.log(chalk.red('\n❌ Plugin validation failed!\n'));
        process.exit(1);
      }
    } catch (error: any) {
      console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
      process.exit(1);
    }
  });
