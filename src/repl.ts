// src/repl.ts
import readline from 'readline';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { SessionManager } from './session';
import { scanDirectory } from './scanner';
import { callAI, chatAI, ExtendedAIResponse, callAIWithFunctionCalling, parseUserInputWithImages } from './ai';
import { ToolExecutor } from './executor-v2';
import { RollbackManager } from './rollback';
import { Verifier, autoDetectStages } from './verifier';
import { PermissionLevel, PermissionManager } from './permissions';
import { LoadingSpinner, createSpinner } from './utils/loading-spinner';
import { Permission } from './tools/types';
import { AIResponse, Action, Choice, ImageReference } from './types';
import inquirer from 'inquirer';
import { formatThoughtTree, formatPlanAlternatives } from './ultrathink/utils';
import { verifyWithReAct } from './ultrathink/verifier';
import { actionToToolCall } from './action-adapter';
import { AdventureManager } from './adventure';
import { PlanChoiceManager } from './plan-choice';
import { PluginSystem } from './plugins';
import { HookSystem, HookType } from './hooks';
import { ToolRegistry } from './tools/registry';
import { FFTPlanner, generateFFTPlan } from './fft/planner';
import { FFTPlanOption } from './fft/types';
import { PlanStateMachine, createPlanStateMachine, PlanState } from './plan-state-machine';
import { AutoCompleter, createDefaultCompletionConfig } from './completion';
import { StrategyExecutor } from './execution/strategy'; // 🔥 新增：策略执行器
import { MemoCliPlugin } from './loop/plugins/memo-cli-plugin'; // 🔥 新增：Memo CLI Plugin
import { registerMemoCommands } from './loop/commands/memo-commands'; // 🔥 新增：Memo 命令
import { PrecipitationCoordinator } from './memory/precipitation-coordinator'; // 🔥 新增：沉淀系统协调器
import { getPrecipitationConfig, NewmaConfig } from './config'; // 🔥 新增：配置
import { SimpleSkillManager } from './skills/simple-loader'; // 🔥 新增：Skill Manager
import { SkillRegistry } from './skills/registry'; // 🔥 新增：Skill Registry
import { StateTracker, ExecutionStage, createStateTracker } from './state/tracker'; // 🔥 新增：状态追踪器
import { TimeTravelManager } from './time-travel'; // 🎮 时间旅行（存档/分支树协调器）

/**
 * REPL 管理器
 * 管理交互式会话的输入输出和执行循环
 */
export class REPLManager {
  private rl: readline.Interface;
  private session: SessionManager;
  private commandHistory: string[] = [];
  private historyIndex: number = -1; // 当前历史浏览位置
  private currentAbortController: AbortController | null = null;
  private toolExecutor: ToolExecutor;
  private verifier: Verifier | null = null;
  private pluginSystem?: PluginSystem;
  private adventureManager: AdventureManager = new AdventureManager();
  private planChoiceManager: PlanChoiceManager = new PlanChoiceManager();
  private rollbackManager: RollbackManager;
  private hookSystem?: HookSystem;
  private pendingInput: string = ''; // 用户当前输入但未提交的内容
  private isClosed: boolean = false; // 跟踪 readline 是否已关闭
  private keypressHandler: (str: any, key: any) => void = () => {}; // keypress 监听器引用，用于清理
  private historyFilePath: string; // Command history file path
  private completer: AutoCompleter; // Tab 自动补全器
  private strategyExecutor: StrategyExecutor; // 🔥 新增：策略执行器
  private memoPlugin?: MemoCliPlugin; // 🔥 新增：Memo CLI Plugin 实例
  private precipitationCoordinator?: PrecipitationCoordinator; // 🔥 新增：沉淀系统协调器
  private silent: boolean = false; // 🔥 新增：静默模式标志
  private skillManager!: SimpleSkillManager; // 🔥 新增：Skill Manager
  private skillRegistry!: SkillRegistry; // 🔥 新增：Skill Registry
  private isInstalling: boolean = false; // 🔥 防止并发安装
  private runtime?: any; // 🔥 新增：事件驱动运行时（可选）
  private runtimeReady: Promise<void> = Promise.resolve(); // 运行时初始化完成 promise
  private stateTracker: StateTracker; // 🔥 新增：状态追踪器
  private timeTravel?: TimeTravelManager; // 🎮 存档/分支树/时间旅行协调器
  private lastPlanDecisionNodeId?: string; // 🎮 最近一次计划选择的决策节点（结局回填用）
  /**
   * 🕘 分支树/存档归属的会话 ID（"周目"标识）
   * /continue 或 /load 后切换为被恢复的会话——新决策、存档、flags
   * 都记入同一周目，与注入管道（读活跃标记）保持一致
   */
  private branchSessionId: string = '';

  constructor(session: SessionManager, silent: boolean = false, hookSystem?: HookSystem) {
    this.silent = silent;
    this.session = session;
    this.branchSessionId = session.getSessionId();
    this.historyFilePath = path.join(session.getProjectRoot(), '.kode', 'history.json');
    this.rollbackManager = new RollbackManager(session.getProjectRoot());
    this.hookSystem = hookSystem;

    // 初始化自动补全器
    const completionConfig = createDefaultCompletionConfig(session.getProjectRoot());
    this.completer = new AutoCompleter(completionConfig);

    // 🔥 初始化策略执行器
    this.strategyExecutor = new StrategyExecutor();

    // 🔥 初始化状态追踪器
    this.stateTracker = createStateTracker({
      debug: process.env.DEBUG_STATE === '1',
      enableVisualization: true,
      maxHistory: 100,
    });

    // 初始化 readline 接口
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.getPrompt(),
      completer: this.completer.createCompleter(),
      terminal: true, // 显式启用终端模式，确保 tab 补全正常工作
    });

    // 设置中断处理
    this.setupInterruptHandling();

    // 设置历史浏览
    this.setupHistoryNavigation();

    // 加载历史记录（异步，不阻塞启动）
    this.loadHistory();

    // 初始化插件系统（总是启用）
    // 创建 HookSystem（如果没有提供）
    if (!this.hookSystem) {
      this.hookSystem = new HookSystem({ enabled: false });
    }

    // 创建插件系统
    this.pluginSystem = new PluginSystem(
      {
        enabled: true,
        directories: [
          path.join(session.getProjectRoot(), '.kode', 'plugins'),
          path.join(session.getProjectRoot(), 'plugins'),
        ],
        // 不设置 autoLoad，这样会加载所有发现的插件
        timeout: 30000,
        validateDependencies: true,
        verbose: false, // 不显示详细日志
      },
      new ToolRegistry(),
      this.hookSystem,
      session.getProjectRoot()
    );

    // 创建工具执行器（带插件系统）- 总是初始化
    this.toolExecutor = new ToolExecutor(
      this.session.getTracker(),
      this.rollbackManager,
      this.session.getConfig(),
      this.session.getPermissionLevel(),
      this.hookSystem,
      this.pluginSystem
    );

    // 异步初始化插件（不阻塞 REPL 启动）
    this.initializePluginsAsync();

    // 🔥 初始化 Memo Plugin
    this.initializeMemoPlugin();

    // 🔥 初始化沉淀系统
    this.initializePrecipitationSystem();

    // 🔥 初始化 Skill Manager
    this.initializeSkillManager();

    // 初始化验证器（如果需要）
    if (this.session.isVerifyEnabled()) {
      this.verifier = new Verifier();
      autoDetectStages(this.verifier, this.session.getProjectRoot());
    }
  }

  /**
   * 异步初始化插件系统
   */
  private async initializePluginsAsync(): Promise<void> {
    if (!this.toolExecutor || !this.pluginSystem) {
      return;
    }

    try {
      // 初始化插件系统（发现并加载插件）
      await this.toolExecutor.initializePlugins(this.session.getConfig());
    } catch (error) {
      console.error(chalk.red('\n[PLUGIN] Failed to initialize plugins:'), (error as Error).message);
    }
  }

  /**
   * 🔥 异步初始化事件驱动运行时（如果启用）
   */
  private async initializeRuntimeAsync(): Promise<void> {
    // 检查是否启用了新运行时
    if (!this.session.isUsingRuntime()) {
      return;
    }

    try {
      // 动态导入运行时集成模块（避免循环依赖）
      const {
        createAndInitializeRuntime,
        startRuntime,
      } = await import('./runtime-integration');

      // 创建并初始化运行时
      this.runtime = createAndInitializeRuntime(
        this.session.getProjectRoot(),
        this.session.getConfig(),
        this.toolExecutor
      );

      // 启动运行时
      await startRuntime(this.runtime);

      if (!this.silent) {
        console.log(chalk.cyan('🚀 Event-driven runtime initialized'));
      }
    } catch (error) {
      console.error(chalk.red('\n[RUNTIME] Failed to initialize event-driven runtime:'), (error as Error).message);
      console.error(chalk.gray('Falling back to legacy execution system\n'));
      this.runtime = undefined;
    }
  }

  /**
   * 🔥 初始化 Memo Plugin
   */
  private initializeMemoPlugin(): void {
    try {
      // 创建 Memo CLI Plugin 实例
      this.memoPlugin = new MemoCliPlugin(this.session.getProjectRoot());

      // 异步初始化 .memo/ 目录（不阻塞启动）
      this.memoPlugin.initialize().then(() => {
        console.log(chalk.gray('📚 Memo system initialized'));
      }).catch((error) => {
        // 静默失败 - memo 可能不可用
        console.log(chalk.gray(`[Memo] Initialization skipped: ${error.message}`));
      });

      // 注册 Memo 命令到命令系统（如果存在）
      // TODO: 需要在 CommandManager 可用时注册
    } catch (error) {
      // 静默失败 - memo 是可选功能
      console.log(chalk.gray(`[Memo] Not available: ${(error as Error).message}`));
    }

    // 🔥 初始化记忆系统
    this.initializeMemorySystem();
  }

  /**
   * 🔥 初始化记忆系统
   */
  private initializeMemorySystem(): void {
    this.session.initializeMemory().then(() => {
      // 🎮 初始化时间旅行协调器（共享 session 的上下文管理器与 memo 的分支树）
      try {
        this.timeTravel = new TimeTravelManager(
          this.session.getProjectRoot(),
          this.session.getSessionContextManager(),
          this.rollbackManager,
          this.memoPlugin?.getBranchTreeManager()
        );
        // 标记活跃会话（ai.ts 注入管道据此定位 flags/前世记忆）
        void this.memoPlugin?.setActiveBranchSession(this.session.getSessionId());

        // 🎮 review-mode 批准时自动存档（钩子注入，review-mode 不依赖记忆系统）
        void import('./review-mode').then(({ setReviewAutoSaveHook }) => {
          setReviewAutoSaveHook(async (change, gitHash) => {
            if (!this.timeTravel) return;
            await this.timeTravel.createSave({
              sessionId: this.branchSessionId,
              reason: 'auto: review approve',
              summary: `${change.type} ${change.path}`,
              gitHashOverride: gitHash,
            });
          });
        });
      } catch (error) {
        console.log(chalk.gray(`[TimeTravel] Not available: ${(error as Error).message}`));
      }
      // 记忆系统初始化成功
    }).catch((error) => {
      console.log(chalk.gray(`[Memory] Failed to initialize: ${(error as Error).message}`));
    });
  }

  /**
   * 🔥 初始化沉淀系统
   */
  private initializePrecipitationSystem(): void {
    try {
      // 获取配置
      const precipitationConfig = getPrecipitationConfig();

      // 创建 NewmaConfig（合并必要配置）
      const config: NewmaConfig = {
        apiKey: this.session.getConfig().apiKey,
        baseUrl: this.session.getConfig().baseUrl,
        model: this.session.getConfig().model,
        precipitation: precipitationConfig,
      };

      // 创建协调器
      this.precipitationCoordinator = new PrecipitationCoordinator(
        {
          projectRoot: this.session.getProjectRoot(),
          precipitationConfig,
          initOnStart: true,
        },
        config
      );

      // 异步启动（不阻塞 REPL 启动）
      this.precipitationCoordinator.start().then(() => {
        console.log(chalk.gray('⏰ Precipitation system started'));
      }).catch((error) => {
        console.log(chalk.yellow(`[Precipitation] Start failed: ${error.message}`));
      });

    } catch (error) {
      // 静默失败 - 沉淀系统是可选功能
      console.log(chalk.gray(`[Precipitation] Not available: ${(error as Error).message}`));
    }
  }

  /**
   * 🔥 初始化 Skill Manager
   */
  private initializeSkillManager(): void {
    try {
      const skillsDir = path.join(this.session.getProjectRoot(), '.kode', 'skills');
      const registryPath = path.join(skillsDir, 'registry.json');

      // 创建 Skill Manager
      this.skillManager = new SimpleSkillManager({
        skillDirectories: [skillsDir],
      });

      // 创建 Skill Registry
      this.skillRegistry = new SkillRegistry(registryPath);

      // 初始化 registry
      this.skillRegistry.initialize().then(() => {
        console.log(chalk.gray('✓ Skill system initialized'));
      }).catch((error) => {
        console.log(chalk.yellow(`[Skills] Registry init failed: ${error.message}`));
      });

      // 发现 skills
      this.skillManager.discoverSkills().then((skills) => {
        console.log(chalk.gray(`✓ Discovered ${skills.length} skill(s)`));
      }).catch((error) => {
        console.log(chalk.yellow(`[Skills] Discovery failed: ${error.message}`));
      });
    } catch (error) {
      console.log(chalk.yellow(`[Skills] Initialization failed: ${(error as Error).message}`));
    }
  }

  /**
   * 🔥 显示待审批的草稿通知
   */
  private async showDraftsNotification(): Promise<void> {
    if (!this.precipitationCoordinator) {
      return;
    }

    try {
      const draftManager = this.precipitationCoordinator.getDraftManager();
      const drafts = await draftManager.listDrafts({ status: 'draft' });

      if (drafts.length > 0) {
        console.log('');
        console.log(chalk.yellow.bold(`📝 You have ${drafts.length} skill draft(s) waiting for approval`));
        console.log(chalk.gray(`   Use ${chalk.cyan('/drafts')} to view, ${chalk.cyan('/approve <id>')} to approve`));
        console.log('');
      }
    } catch (error) {
      // 静默失败 - 不影响 REPL 启动
    }
  }

  /**
   * 🔥 记录命令开始
   */
  private async recordCommandStart(input: string, isCommand: boolean): Promise<number> {
    if (!this.session.isMemoryInitialized()) {
      return -1; // 记忆系统未初始化，返回 -1
    }

    try {
      const executionHistoryManager = this.session.getExecutionHistoryManager();
      return await executionHistoryManager.recordCommandStart(
        input,
        isCommand ? 'special' : 'chat'
      );
    } catch (error) {
      // 静默失败，不影响主流程
      console.log(chalk.gray(`[Memory] Failed to record command start: ${(error as Error).message}`));
      return -1;
    }
  }

  /**
   * 🔥 记录命令结束
   */
  private async recordCommandEnd(
    commandIndex: number,
    status: 'success' | 'failed' | 'aborted',
    errorMessage?: string
  ): Promise<void> {
    if (!this.session.isMemoryInitialized() || commandIndex < 0) {
      return; // 记忆系统未初始化或没有有效索引
    }

    try {
      const executionHistoryManager = this.session.getExecutionHistoryManager();
      const result = {
        duration: 0, // 简化处理，实际应该记录真实的持续时间
        error: errorMessage,
        metadata: errorMessage ? { error: errorMessage } : undefined,
      };
      await executionHistoryManager.recordCommandEnd(commandIndex, status, result);
    } catch (error) {
      // 静默失败，不影响主流程
      console.log(chalk.gray(`[Memory] Failed to record command end: ${(error as Error).message}`));
    }
  }

  /**
   * 🔥 记录会话消息
   */
  private async recordSessionMessage(
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: any
  ): Promise<void> {
    if (!this.session.isMemoryInitialized()) {
      return; // 记忆系统未初始化
    }

    try {
      const sessionContextManager = this.session.getSessionContextManager();
      await sessionContextManager.addMessage(role, content, metadata);
    } catch (error) {
      // 静默失败，不影响主流程
      console.log(chalk.gray(`[Memory] Failed to record message: ${(error as Error).message}`));
    }
  }

  /**
   * 获取执行模式的图标
   */
  private getExecutionModeIcon(): string {
    const mode = this.session.getExecutionMode();
    const icons: Record<string, string> = {
      'subagent': '🤖',
      'standard': '⚙️',
      'two-phase': '🔄',
      'multi-agent': '👥',
      'function-calling': '🔧',
    };
    return icons[mode] || '⚙️';
  }

  /**
   * 获取提示符
   */
  private getPrompt(): string {
    const projectName = path.basename(this.session.getProjectRoot());
    const executionMode = this.session.getExecutionMode();
    const modeIcon = this.getExecutionModeIcon();

    // 简化模式显示（subagent 显示完整，其他简化）
    const modeDisplay = executionMode === 'subagent' ? 'subagent' :
                        executionMode === 'function-calling' ? 'fc' :
                        executionMode === 'two-phase' ? '2p' :
                        executionMode === 'multi-agent' ? 'ma' :
                        'std';

    // 使用 'newma' 作为显示名称（如果项目目录是 'kode'）
    const displayName = projectName === 'kode' ? 'newma' : projectName;

    return chalk.cyan(`\n[${displayName}|${modeDisplay}] ${modeIcon} ❯ `);
  }

  /**
   * 设置中断处理（Ctrl+C）
   */
  private setupInterruptHandling(): void {
    this.rl.on('SIGINT', () => {
      if (this.currentAbortController) {
        // 正在执行 AI 调用，取消它
        this.currentAbortController.abort();

        console.log(chalk.yellow('\n\n⚠️  AI request interrupted.\n'));
        this.rl.prompt();
      } else {
        // 没有正在执行的请求，询问是否退出
        console.log(chalk.gray('\n\nPress Ctrl+C again to exit, or /exit to quit.'));
        this.rl.prompt();
      }
    });
  }

  /**
   * Load command history from file
   */
  private async loadHistory(): Promise<void> {
    try {
      const data = await fs.readFile(this.historyFilePath, 'utf-8');
      const history = JSON.parse(data);
      if (Array.isArray(history) && history.length > 0) {
        this.commandHistory = history;
        console.log(chalk.gray(`\n📜 Loaded ${history.length} commands from history\n`));

        // 更新补全器的历史记录
        this.completer.updateHistory(this.commandHistory);
      }
    } catch (error) {
      // File doesn't exist or is invalid - that's fine, start with empty history
      this.commandHistory = [];
    }
  }

  /**
   * Save command history to file
   */
  private async saveHistory(): Promise<void> {
    try {
      // Ensure .kode directory exists
      const historyDir = path.dirname(this.historyFilePath);
      await fs.mkdir(historyDir, { recursive: true });

      // Save history to file
      await fs.writeFile(
        this.historyFilePath,
        JSON.stringify(this.commandHistory, null, 2),
        'utf-8'
      );
    } catch (error) {
      // Silently fail - history persistence is not critical
      console.debug('Failed to save history:', error);
    }
  }

  /**
   * 设置键盘历史浏览（上下键）
   */
  private setupHistoryNavigation(): void {
    // 启用按键监听（readline 需要这个）
    readline.emitKeypressEvents(process.stdin);

    // 如果 stdin 是 TTY，设置为原始模式
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    // 监听按键事件
    this.keypressHandler = (str: any, key: any) => {
      // 只处理上下键
      if (key.name === 'up' || key.name === 'down') {
        // 如果历史为空，忽略
        if (this.commandHistory.length === 0) {
          return;
        }

        if (key.name === 'up') {
          // 向上键：浏览更早的历史
          if (this.historyIndex === -1) {
            // 第一次按向上键，保存当前输入
            const line = this.rl.line;
            this.pendingInput = line;
            this.historyIndex = this.commandHistory.length - 1;
          } else if (this.historyIndex > 0) {
            // 继续向上
            this.historyIndex--;
          }
        } else if (key.name === 'down') {
          // 向下键：浏览更近的历史
          if (this.historyIndex !== -1) {
            this.historyIndex++;

            // 如果超过了历史记录，恢复到用户输入
            if (this.historyIndex >= this.commandHistory.length) {
              this.historyIndex = -1;
            }
          }
        }

        // 清除当前行并显示历史命令
        this.rl.write(null, { ctrl: true, name: 'u' }); // 清除行

        if (this.historyIndex === -1) {
          // 显示用户原始输入
          if (this.pendingInput) {
            this.rl.write(this.pendingInput);
          }
        } else {
          // 显示历史命令
          const cmd = this.commandHistory[this.historyIndex];
          if (cmd) {
            this.rl.write(cmd);
          }
        }
      }
    };

    // 注册 keypress handler
    process.stdin.on('keypress', this.keypressHandler);
  }

  /**
   * 获取当前的中断信号（如果存在）
   */
  private getAbortSignal(): AbortSignal | undefined {
    return this.currentAbortController?.signal;
  }

  /**
   * 检查是否已中断
   */
  private isAborted(): boolean {
    return this.currentAbortController?.signal.aborted ?? false;
  }

  /**
   * 重置中断控制器
   */
  private resetAbortController(): void {
    this.currentAbortController = null;
  }

  /**
   * 启动 REPL 循环
   */
  public start(): void {
    // 🔥 新增：初始化事件驱动运行时（如果启用）
    // 使用 ready promise 保护：运行时初始化完成前，命令处理会等待
    this.runtimeReady = this.initializeRuntimeAsync();

    // 🔥 只在非静默模式下显示欢迎信息
    if (!this.silent) {
      this.session.printWelcome();
      // 显示待审批的草稿提示
      this.showDraftsNotification();
    }

    this.rl.prompt();

    this.rl.on('line', async (line) => {
      // 等待运行时初始化完成（防止竞态条件）
      await this.runtimeReady;

      const trimmed = line.trim();

      // 重置历史索引（命令已执行）
      this.historyIndex = -1;
      this.pendingInput = '';

      // 空行，直接显示提示符
      if (!trimmed) {
        this.rl.prompt();
        return;
      }

      // Execute beforeInputProcessing hooks
      if (this.hookSystem && this.hookSystem.hasHooks(HookType.BEFORE_INPUT_PROCESSING)) {
        await this.hookSystem.execute(HookType.BEFORE_INPUT_PROCESSING, {
          data: {
            input: trimmed,
            isCommand: trimmed.startsWith('/'),
          },
          session: this.session,
          config: this.session.getConfig(),
        });
      }

      // 添加到历史
      this.commandHistory.push(trimmed);
      this.session.incrementCommandCount();

      // 更新补全器的历史记录
      this.completer.updateHistory(this.commandHistory);

      // 🔥 记录命令开始到记忆系统
      const commandIndex = await this.recordCommandStart(trimmed, trimmed.startsWith('/'));

      // 处理特殊命令
      if (trimmed.startsWith('/')) {
        try {
          await this.handleSpecialCommand(trimmed);
          // 🔥 记录命令成功完成
          await this.recordCommandEnd(commandIndex, 'success');
        } catch (error) {
          // 🔥 记录命令失败
          await this.recordCommandEnd(commandIndex, 'failed', error instanceof Error ? error.message : String(error));
        }

        if (!this.isClosed) this.rl.prompt();

        // Execute afterInputProcessing hooks for commands
        if (this.hookSystem && this.hookSystem.hasHooks(HookType.AFTER_INPUT_PROCESSING)) {
          await this.hookSystem.execute(HookType.AFTER_INPUT_PROCESSING, {
            data: {
              input: trimmed,
              isCommand: true,
              result: { type: 'command' },
            },
            session: this.session,
            config: this.session.getConfig(),
          });
        }

        return;
      }

      // 默认模式：简单聊天
      let chatResult;
      try {
        chatResult = await this.chatMode(trimmed);
        // 🔥 记录命令成功完成
        await this.recordCommandEnd(commandIndex, 'success');
      } catch (error) {
        console.error(chalk.red('❌ Error:'), error);
        chatResult = { error: error instanceof Error ? error.message : String(error) };
        // 🔥 记录命令失败
        await this.recordCommandEnd(commandIndex, 'failed', chatResult.error);
      }

      // Execute afterInputProcessing hooks for chat
      if (this.hookSystem && this.hookSystem.hasHooks(HookType.AFTER_INPUT_PROCESSING)) {
        await this.hookSystem.execute(HookType.AFTER_INPUT_PROCESSING, {
          data: {
            input: trimmed,
            isCommand: false,
            result: chatResult,
          },
          session: this.session,
          config: this.session.getConfig(),
        });
      }

      if (!this.isClosed) this.rl.prompt();
    });

    this.rl.on('close', () => {
      this.isClosed = true;
      // 清理 keypress 监听器防止内存泄漏
      process.stdin.removeListener('keypress', this.keypressHandler);
      // 使用 setImmediate 确保在 readline 完全关闭后执行
      setImmediate(async () => {
        try {
          process.stdout.write(chalk.cyan('\n\n👋 Session ended. Goodbye!\n\n'));
          this.session.printStatus();

          // 🎮 结局自动结算：残留 active 分支批量标记 abandoned（MCTS 统计完整性）
          if (this.timeTravel) {
            try {
              await this.timeTravel
                .getBranchTreeManager()
                .closeActiveBranches(this.branchSessionId, 'session ended');
            } catch {
              // 结算失败不影响退出
            }
          }

          // 生成推理追踪报告（如果启用）
          if (this.session.isReasoningTrackingEnabled()) {
            await this.generateReasoningReport();
          }

          // 🔥 保存记忆系统
          await this.session.saveMemory();

          process.exit(0);
        } catch (error: any) {
          // 确保即使出错也能退出
          console.error('Error during cleanup:', error);
          process.exit(1);
        }
      });
    });
  }

  /**
   * 处理特殊命令
   */
  private async handleSpecialCommand(cmd: string): Promise<void> {
    const parts = cmd.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case '/exit':
      case '/quit':
        // 🔥 Stop precipitation system
        if (this.precipitationCoordinator) {
          try {
            await this.precipitationCoordinator.stop();
          } catch (error) {
            console.log(chalk.gray('Precipitation system stopped'));
          }
        }
        // Save history before exiting
        await this.saveHistory();

        // 清理 StateTracker 监听器
        if (this.stateTracker) {
          this.stateTracker.removeAllListeners();
        }

        this.isClosed = true;
        this.rl.close();
        break;

      case '/clear':
        console.clear();
        this.session.printWelcome();
        break;

      case '/status':
        this.session.printStatus();
        break;

      case '/state':
        console.log(this.stateTracker.format());
        console.log('');
        break;

      case '/state-history':
        console.log(this.stateTracker.visualizeHistory());
        console.log('');
        break;

      case '/history':
        this.session.printHistory(this.commandHistory);
        break;

      case '/help':
        this.printHelp();
        break;

      case '/runtime-toggle':
      case '/use-runtime':
        // 切换运行时模式
        if (this.runtime) {
          console.log(chalk.yellow('Runtime is already enabled'));
          console.log(chalk.gray('Current mode: Event-driven Runtime\n'));
        } else {
          console.log(chalk.yellow('Runtime not initialized'));
          console.log(chalk.gray('Please restart with --use-runtime flag\n'));
        }
        break;

      case '/runtime-status':
        // 显示运行时状态
        if (this.runtime) {
          const state = this.runtime.getState();
          console.log(chalk.cyan('\n🚀 Runtime Status'));
          console.log(chalk.cyan('═'.repeat(50)));
          console.log(chalk.white('Running:   ') + chalk.yellow(state.isRunning ? 'Yes' : 'No'));
          console.log(chalk.white('Phase:     ') + chalk.yellow(state.phase));
          console.log(chalk.white('Iteration: ') + chalk.yellow(state.iteration.toString()));
          console.log(chalk.white('Events:    ') + chalk.yellow(state.processedEvents.toString()));
          if (state.startTime) {
            const duration = Date.now() - state.startTime;
            console.log(chalk.white('Uptime:    ') + chalk.yellow(`${Math.floor(duration / 1000)}s`));
          }
          console.log(chalk.cyan('═'.repeat(50)) + '\n');
        } else {
          console.log(chalk.yellow('Runtime not enabled\n'));
        }
        break;

      case '/time':
        this.printCurrentTime();
        break;

      case '/preset':
        await this.handlePresetCommand(args);
        break;

      case '/ultrathink':
        this.handleUltrathinkCommand();
        break;

      case '/mode':
        await this.handleModeCommand(args);
        break;

      case '# memorize':
        await this.handleMemorize();
        break;

      case '/chat':
        await this.handleChatCommand(args);
        break;

      // 🔥 /plan and /do are now handled by Loop Plugin System
      // See: src/loop/plugins/plan-mode-plugin.ts, do-mode-plugin.ts
      // When Loop system is integrated into REPL, these will be automatically handled
      //
      // case '/plan':
      // case '/do':
      //   await this.handlePlanCommand(args);
      //   break;

      case '/loop':
        await this.handleLoopCommand(args);
        break;

      case '/set':
        await this.handleSetCommand(args);
        break;

      case '/fft':
        this.handleFFTCommand(args);
        break;

      case '/landmark':
        this.handleLandmarkCommand(args);
        break;

      case '/intent':
        await this.handleIntentCommand(args);
        break;

      case '/init':
        await this.handleInitCommand();
        break;

      case '/create-plugin':
        await this.handleCreatePluginCommand(args);
        break;

      case '/plugin-list':
        await this.handlePluginListCommand();
        break;

      case '/undo':
        await this.handleUndoCommand();
        break;

      // 🎮 游戏存档模式命令（Phase 1）
      case '/save':
        await this.handleSaveCommand(args);
        break;

      case '/saves':
        await this.handleSavesCommand(args);
        break;

      case '/load':
        await this.handleLoadCommand(args);
        break;

      // 🎮 Galgame 分支树命令（Phase 2/3）
      case '/tree':
        await this.handleTreeCommand();
        break;

      case '/flags':
        await this.handleFlagsCommand(args);
        break;

      case '/back-to':
        await this.handleBackToCommand(args);
        break;

      // 🎲 MCTS 探索推荐（AlphaZero 风格）
      case '/next':
        await this.handleNextCommand(args);
        break;

      // 🕘 继续最近会话（Claude Code --continue 的 galgame 版）
      case '/continue':
      case '/resume-session':
        await this.handleContinueCommand();
        break;

      case '/modes':
        this.handleModesCommand();
        break;

      case '/diff':
        await this.handleDiffCommand();
        break;

      case '/tasks':
        await this.handleTasksCommand(args);
        break;

      case '/task':
        await this.handleTaskCommand(args);
        break;

      case '/resume':
        await this.handleResumeCommand();
        break;

      case '/skills':
        this.handleSkillsCommand();
        break;

      case '/memory-stats':
        await this.handleMemoryStatsCommand();
        break;

      case '/memory-sessions':
        await this.handleMemorySessionsCommand(args);
        break;

      case '/memory-errors':
        await this.handleMemoryErrorsCommand(args);
        break;

      case '/memory-search':
        await this.handleMemorySearchCommand(args);
        break;

      // 🔥 沉淀系统命令
      case '/drafts':
      case '/approve':
      case '/reject':
      case '/view-draft':
      case '/delete-draft':
      case '/precipitate':
      case '/precipitation-status':
      case '/precipitation-schedule':
        await this.handlePrecipitationCommand(command, args);
        break;

      // 🤖 Claude Code Subagent Commands
      case '/claude':
        await this.handleClaudeCommand(args);
        break;

      case '/complexity':
        await this.handleComplexityCommand(args);
        break;

      case '/subagents':
        await this.handleSubagentsCommand(args);
        break;

      // 🔥 Skill Management Commands
      case '/skill-list':
        await this.handleSkillListCommand(args);
        break;

      case '/skill-info':
        await this.handleSkillInfoCommand(args);
        break;

      case '/skill-install':
        await this.handleSkillInstallCommand(args);
        break;

      case '/skill-uninstall':
        await this.handleSkillUninstallCommand(args);
        break;

      case '/skill-search':
        await this.handleSkillSearchCommand(args);
        break;

      case '/review-on':
        this.session.enableReviewMode();
        console.log(chalk.green('✅ Review mode enabled\n'));
        break;

      case '/review-off':
        this.session.disableReviewMode();
        console.log(chalk.yellow('⚠️  Review mode disabled\n'));
        break;

      case '/review-bypass':
        // Enable session-level bypass (approve all)
        const { setSessionBypass } = await import('./review-mode');
        setSessionBypass(true);
        console.log(chalk.green('🔓 Session bypass enabled: All changes will be auto-approved\n'));
        break;

      default:
        console.log(chalk.yellow(`Unknown command: ${command}`));
        console.log(chalk.gray('Type /help for available commands.\n'));
    }
  }

  /**
   * 🔥 处理沉淀系统命令
   */
  private async handlePrecipitationCommand(command: string, args: string[]): Promise<void> {
    if (!this.precipitationCoordinator) {
      console.log(chalk.yellow('Precipitation system is not available'));
      return;
    }

    try {
      const draftManager = this.precipitationCoordinator.getDraftManager();

      // Strip leading slash from command for matching
      const commandName = command.startsWith('/') ? command.slice(1) : command;

      switch (commandName) {
        case 'drafts': {
          const statusFilter = args.includes('--pending')
            ? 'pending'
            : args.includes('--approved')
            ? 'approved'
            : args.includes('--rejected')
            ? 'rejected'
            : undefined;

          const drafts = await draftManager.listDrafts(
            statusFilter ? { status: statusFilter as any } : undefined
          );

          if (drafts.length === 0) {
            console.log(chalk.gray('No drafts found.'));
            return;
          }

          console.log(chalk.bold('\n📝 Skill Drafts\n'));
          drafts.forEach((draft, index) => {
            const statusIcon = draft.status === 'draft' ? '📋' : draft.status === 'approved' ? '✅' : '❌';
            const confidenceColor =
              draft.suggestion.confidence >= 0.8
                ? 'green'
                : draft.suggestion.confidence >= 0.6
                ? 'yellow'
                : 'red';

            console.log(`${statusIcon} [${index + 1}] ${chalk.cyan(draft.suggestion.name)}`);
            console.log(`   ${chalk.gray(draft.suggestion.description)}`);
            console.log(
              `   ${chalk.gray('ID:')} ${chalk.gray(draft.id)} | ${chalk.gray('Confidence:')} ${chalk[confidenceColor](
                `${(draft.suggestion.confidence * 100).toFixed(1)}%`
              )}`
            );
            console.log(
              `   ${chalk.gray('Created:')} ${chalk.gray(draft.createdAt.toLocaleDateString())} | ${chalk.gray(
                `Type: ${draft.suggestion.type}`
              )}`
            );
            console.log('');
          });
          console.log(chalk.gray(`Total: ${drafts.length} draft(s)\n`));
          break;
        }

        case 'approve': {
          if (args.length === 0) {
            console.log(chalk.red('Error: Draft ID is required'));
            console.log(chalk.gray('Usage: /approve <draft-id>'));
            return;
          }

          const draftId = args[0];
          const note = args.slice(1).join(' ') || 'Approved by user';
          await draftManager.approve(draftId, note);
          console.log(chalk.green(`✅ Draft approved: ${draftId}`));
          break;
        }

        case 'reject': {
          if (args.length === 0) {
            console.log(chalk.red('Error: Draft ID is required'));
            console.log(chalk.gray('Usage: /reject <draft-id>'));
            return;
          }

          const draftId = args[0];
          const note = args.slice(1).join(' ') || 'Rejected by user';
          await draftManager.reject(draftId, note);
          console.log(chalk.yellow(`❌ Draft rejected: ${draftId}`));
          break;
        }

        case 'view-draft': {
          if (args.length === 0) {
            console.log(chalk.red('Error: Draft ID is required'));
            console.log(chalk.gray('Usage: /view-draft <draft-id>'));
            return;
          }

          const draftId = args[0];
          const draft = await draftManager.getDraft(draftId);

          if (!draft) {
            console.log(chalk.red(`Draft not found: ${draftId}`));
            return;
          }

          console.log(chalk.bold(`\n📄 ${draft.suggestion.name}\n`));
          console.log(chalk.gray(draft.suggestion.description));
          console.log('');
          console.log(chalk.gray(`Type: ${draft.suggestion.type}`));
          console.log(chalk.gray(`Complexity: ${draft.suggestion.complexity}/5`));
          console.log(
            chalk.gray(
              `Confidence: ${chalk.bold(
                `${(draft.suggestion.confidence * 100).toFixed(1)}%`
              )}`
            )
          );
          console.log(chalk.gray(`Tags: ${draft.suggestion.tags.join(', ')}`));
          console.log(chalk.gray(`Status: ${draft.status}`));
          console.log(chalk.gray(`Created: ${draft.createdAt.toLocaleString()}`));
          console.log('');

          if (draft.suggestion.coreKnowledge) {
            console.log(chalk.bold('Core Knowledge:'));
            console.log(draft.suggestion.coreKnowledge);
            console.log('');
          }

          if (draft.suggestion.examples && draft.suggestion.examples.length > 0) {
            console.log(chalk.bold('Examples:'));
            draft.suggestion.examples.forEach((example, index) => {
              console.log(chalk.gray(`\n[${index + 1}] ${example.scenario}`));
              console.log(example.solution);
            });
            console.log('');
          }
          break;
        }

        case 'delete-draft': {
          if (args.length === 0) {
            console.log(chalk.red('Error: Draft ID is required'));
            console.log(chalk.gray('Usage: /delete-draft <draft-id>'));
            return;
          }

          const draftId = args[0];
          await draftManager.delete(draftId);
          console.log(chalk.red(`🗑️  Draft deleted: ${draftId}`));
          break;
        }

        case 'precipitate': {
          console.log(chalk.cyan('⏰ Triggering precipitation...\n'));
          const result = await this.precipitationCoordinator.trigger();
          if (result.success) {
            const duration = result.endTime.getTime() - result.startTime.getTime();
            console.log(chalk.green(`✅ Precipitation completed`));
            console.log(chalk.gray(`Suggestions generated: ${result.suggestionsGenerated}`));
            console.log(chalk.gray(`Drafts saved: ${result.draftsSaved}`));
            console.log(chalk.gray(`Duration: ${duration}ms`));
          } else {
            console.log(chalk.red(`❌ Precipitation failed: ${result.error}`));
          }
          break;
        }

        case 'precipitation-status': {
          const status = this.precipitationCoordinator.getStatus();
          const stats = await draftManager.getStats();

          console.log(chalk.bold('\n⚙️  Precipitation System Status\n'));
          console.log(chalk.gray(`Status: ${status.scheduler.isRunning ? '🟢 Running' : '🔴 Stopped'}`));
          console.log(chalk.gray(`Next run: ${status.scheduler.nextExecution ? status.scheduler.nextExecution.toLocaleString() : 'N/A'}`));

          // Get last run from scheduler jobs
          const precipJob = status.scheduler.jobs.find((j: any) => j.name === 'precipitation');
          console.log(chalk.gray(`Last run: ${precipJob?.lastRun ? precipJob.lastRun.toLocaleString() : 'Never'}`));
          console.log('');
          console.log(chalk.bold('📊 Draft Statistics'));
          console.log(chalk.gray(`Pending: ${stats.pending}`));
          console.log(chalk.gray(`Approved: ${stats.approved}`));
          console.log(chalk.gray(`Rejected: ${stats.rejected}`));
          console.log(
            chalk.gray(
              `Avg Confidence: ${stats.averageConfidence > 0 ? `${(stats.averageConfidence * 100).toFixed(1)}%` : 'N/A'}`
            )
          );
          console.log('');
          break;
        }

        case 'precipitation-schedule': {
          const status = this.precipitationCoordinator.getStatus();
          console.log(chalk.bold('\n⏰ Precipitation Schedule\n'));
          console.log(chalk.gray(`Next scheduled run:`));
          if (status.scheduler.nextExecution) {
            console.log(chalk.cyan(status.scheduler.nextExecution.toLocaleString()));
            const timeUntil = status.scheduler.nextExecution.getTime() - Date.now();
            const hours = Math.floor(timeUntil / (1000 * 60 * 60));
            const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
            console.log(chalk.gray(`(${hours}h ${minutes}m from now)`));
          } else {
            console.log(chalk.gray('Not scheduled'));
          }
          console.log('');
          break;
        }

        default:
          console.log(chalk.yellow(`Unknown precipitation command: ${command}`));
      }
    } catch (error: any) {
      console.log(chalk.red(`Error executing precipitation command: ${error.message}`));
    }
  }

  /**
   * 🤖 处理 /claude 命令 - 强制使用 Claude Code 模式
   */
  private async handleClaudeCommand(args: string[]): Promise<void> {
    const requirement = args.join(' ');

    // 如果没有参数，显示当前状态
    if (!requirement) {
      console.log(chalk.cyan('\n🤖 Claude Code Mode'));
      console.log(chalk.cyan('═'.repeat(50)));
      console.log(chalk.gray('Force execution using Claude Code parallel subagent system.'));
      console.log('');
      console.log(chalk.white('Usage:'));
      console.log(chalk.gray('  /claude <requirement>'));
      console.log(chalk.gray('  Example: /claude 重构用户认证系统，添加 OAuth2 支持'));
      console.log('');
      return;
    }

    // 使用 Claude Code 模式执行
    console.log(chalk.cyan('\n🤖 Claude Code Mode Activated\n'));
    console.log(chalk.gray(`Requirement: ${requirement}\n`));

    try {
      // TODO: 集成 ClaudeCodeStrategy 并执行
      // const strategy = new ClaudeCodeStrategy({ userExplicit: true });
      // const result = await strategy.execute({...});

      console.log(chalk.yellow('Claude Code integration is under development.'));
      console.log(chalk.gray('This will execute the task using parallel subagents.\n'));

    } catch (error: any) {
      console.log(chalk.red(`Error: ${error.message}\n`));
    }
  }

  /**
   * 🤖 处理 /complexity 命令 - 分析任务复杂度
   */
  private async handleComplexityCommand(args: string[]): Promise<void> {
    const requirement = args.join(' ');

    if (!requirement) {
      console.log(chalk.cyan('\n📊 Complexity Analysis'));
      console.log(chalk.cyan('═'.repeat(50)));
      console.log(chalk.gray('Analyze task complexity to determine optimal execution strategy.'));
      console.log('');
      console.log(chalk.white('Usage:'));
      console.log(chalk.gray('  /complexity <requirement>'));
      console.log(chalk.gray('  Example: /complexity 添加用户认证和授权系统'));
      console.log('');
      return;
    }

    console.log(chalk.cyan('\n📊 Analyzing Task Complexity\n'));
    console.log(chalk.gray(`Requirement: ${requirement}\n`));

    try {
      // TODO: 集成 ComplexityAnalyzer
      // const analyzer = new ComplexityAnalyzer();
      // const result = await analyzer.analyze({...});

      console.log(chalk.yellow('Complexity analysis is under development.'));
      console.log(chalk.gray('This will show the complexity score and recommended strategy.\n'));

    } catch (error: any) {
      console.log(chalk.red(`Error: ${error.message}\n`));
    }
  }

  /**
   * 🤖 处理 /subagents 命令 - 显示并行 subagent 统计
   */
  private async handleSubagentsCommand(args: string[]): Promise<void> {
    console.log(chalk.cyan('\n🤖 Parallel Subagent Statistics'));
    console.log(chalk.cyan('═'.repeat(50)));

    // 显示参数选项
    if (args.includes('--help') || args.includes('-h')) {
      console.log(chalk.white('Options:'));
      console.log(chalk.gray('  --recent    Show recent parallel executions'));
      console.log(chalk.gray('  --stats     Show overall statistics'));
      console.log(chalk.gray('  --clear     Clear execution history'));
      console.log('');
      return;
    }

    try {
      // TODO: 从 ParallelExecutionTracker 获取统计信息
      if (args.includes('--stats')) {
        console.log(chalk.yellow('Overall Statistics:'));
        console.log(chalk.gray('  Total executions:  0'));
        console.log(chalk.gray('  Successful:        0'));
        console.log(chalk.gray('  Failed:            0'));
        console.log(chalk.gray('  Avg duration:      0ms'));
        console.log(chalk.gray('  Total tokens:      0'));
        console.log('');
      } else if (args.includes('--recent')) {
        console.log(chalk.yellow('Recent Executions:'));
        console.log(chalk.gray('  No recent parallel executions found.\n'));
      } else {
        console.log(chalk.yellow('Status:'));
        console.log(chalk.gray('  Parallel subagent system is ready.'));
        console.log('');
        console.log(chalk.white('Usage:'));
        console.log(chalk.gray('  /subagents --stats   - Show overall statistics'));
        console.log(chalk.gray('  /subagents --recent  - Show recent executions'));
        console.log('');
      }

    } catch (error: any) {
      console.log(chalk.red(`Error: ${error.message}\n`));
    }
  }

  /**
   * 打印当前时间
   */
  private printCurrentTime(): void {
    const now = new Date();

    // 格式化时间
    const dateStr = now.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long'
    });

    const timeStr = now.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const utcOffset = -now.getTimezoneOffset() / 60;
    const utcOffsetStr = utcOffset >= 0 ? `+${utcOffset}` : utcOffset;

    console.log(chalk.cyan('\n🕐 Current System Time'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(chalk.white('Date:       ') + chalk.yellow(dateStr));
    console.log(chalk.white('Time:       ') + chalk.yellow(timeStr));
    console.log(chalk.white('Timezone:   ') + chalk.yellow(timezone));
    console.log(chalk.white('UTC Offset: ') + chalk.yellow(`UTC${utcOffsetStr}`));
    console.log(chalk.white('Timestamp:  ') + chalk.gray(now.getTime()));
    console.log(chalk.cyan('═'.repeat(50)) + '\n');
  }

  /**
   * 打印帮助信息
   */
  private printHelp(): void {
    console.log(chalk.cyan('\n📖 Available Commands'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(chalk.white('/skills') + chalk.gray('       - Show available skills (agents, tools, plugins)'));
    console.log(chalk.white('/loop') + chalk.gray(' or /plan - Execute task with 4-step loop'));
    console.log(chalk.white('/do') + chalk.gray('           - Quick task execution (legacy)'));
    console.log(chalk.white('/init') + chalk.gray('          - Initialize AI understanding of project'));
    console.log(chalk.white('/create-plugin') + chalk.gray(' - Create a new plugin'));
    console.log(chalk.white('/plugin-list') + chalk.gray('  - List all loaded plugins'));
    console.log(chalk.white('/status') + chalk.gray('        - Show session status'));
    console.log(chalk.white('/state') + chalk.gray('         - Show current execution state'));
    console.log(chalk.white('/state-history') + chalk.gray(' - Show state transition history'));
    console.log(chalk.white('/runtime-toggle') + chalk.gray(' - Toggle runtime mode'));
    console.log(chalk.white('/runtime-status') + chalk.gray(' - Show runtime status'));
    console.log(chalk.white('/history') + chalk.gray('       - Show command history'));
    console.log(chalk.white('/resume') + chalk.gray('       - Resume previous session (show history)'));
    console.log(chalk.white('/time') + chalk.gray('         - Show current system time'));
    console.log(chalk.white('/clear') + chalk.gray('        - Clear screen'));
    console.log(chalk.white('/modes') + chalk.gray('        - Show available execution modes'));
    console.log(chalk.white('/undo') + chalk.gray('          - Undo last action (git rollback)'));
    console.log(chalk.white('/diff') + chalk.gray('          - Show git diff of changes'));
    console.log(chalk.white('/preset') + chalk.gray('       - Quick configuration presets'));
    console.log(chalk.white('/mode') + chalk.gray('         - Show or change execution mode'));
    console.log(chalk.white('/set') + chalk.gray('          - Set configuration options'));
    console.log(chalk.white('/fft') + chalk.gray('          - Toggle FFT fast decision mode'));
    console.log(chalk.white('/landmark') + chalk.gray('     - Toggle Landmark Counting mode'));
    console.log(chalk.white('/ultrathink') + chalk.gray('   - Toggle AI reasoning features'));
    console.log(chalk.white('/memory-stats') + chalk.gray('  - Show memory system statistics'));
    console.log(chalk.white('/memory-sessions') + chalk.gray(' - List all sessions in memory'));
    console.log(chalk.white('/memory-errors') + chalk.gray('  - Show error memory'));
    console.log(chalk.white('/memory-search') + chalk.gray(' - Search in session history'));
    console.log(chalk.cyan('\n🎮 Save & Branch System (game-style)'));
    console.log(chalk.cyan('─'.repeat(50)));
    console.log(chalk.white('/save [name]') + chalk.gray('   - Create save point (git + messages + flags)'));
    console.log(chalk.white('/saves [--all]') + chalk.gray(' - List save points (all sessions with --all)'));
    console.log(chalk.white('/load <id|name>') + chalk.gray(' - Restore a save point (lossless)'));
    console.log(chalk.white('/tree') + chalk.gray('           - Show decision tree (galgame flowchart)'));
    console.log(chalk.white('/flags') + chalk.gray('           - Show/set session flags (/flags set k=v)'));
    console.log(chalk.white('/back-to <id>') + chalk.gray('   - Time travel to a decision/save point'));
    console.log(chalk.white('/next') + chalk.gray('           - MCTS recommendation: which branch to try next'));
    console.log(chalk.white('/continue') + chalk.gray('        - Continue the most recent session (AI remembers)'));
    console.log(chalk.cyan('\n📦 Skill Management'));
    console.log(chalk.cyan('─'.repeat(50)));
    console.log(chalk.white('/skill-list') + chalk.gray('       - List installed skills'));
    console.log(chalk.white('/skill-info <name>') + chalk.gray('  - Show skill details'));
    console.log(chalk.white('/skill-install <url>') + chalk.gray(' - Install new skill'));
    console.log(chalk.white('/skill-uninstall <name>') + chalk.gray(' - Uninstall a skill'));
    console.log(chalk.white('/skill-search <query>') + chalk.gray(' - Search skills'));
    console.log(chalk.cyan('\n⏰ Precipitation System'));
    console.log(chalk.cyan('─'.repeat(50)));
    console.log(chalk.white('/drafts') + chalk.gray('            - List skill drafts'));
    console.log(chalk.white('/approve <id>') + chalk.gray('     - Approve a skill draft'));
    console.log(chalk.white('/reject <id>') + chalk.gray('      - Reject a skill draft'));
    console.log(chalk.white('/view-draft <id>') + chalk.gray('  - View draft details'));
    console.log(chalk.white('/delete-draft <id>') + chalk.gray(' - Delete a draft'));
    console.log(chalk.white('/precipitate') + chalk.gray('       - Manually trigger precipitation'));
    console.log(chalk.white('/precipitation-status') + chalk.gray(' - Show system status'));
    console.log(chalk.white('/precipitation-schedule') + chalk.gray(' - Show next execution'));
    console.log(chalk.cyan('\n🤖 Claude Code Subagent System'));
    console.log(chalk.cyan('─'.repeat(50)));
    console.log(chalk.white('/claude <req>') + chalk.gray('       - Force Claude Code parallel mode'));
    console.log(chalk.white('/complexity <req>') + chalk.gray('   - Analyze task complexity'));
    console.log(chalk.white('/subagents') + chalk.gray('         - Show parallel subagent stats'));
    console.log(chalk.white('/help') + chalk.gray('             - Show this help'));
    console.log(chalk.white('# memorize') + chalk.gray('     - Save conversation to KODE.md'));
    console.log(chalk.white('/exit') + chalk.gray('         - Exit session'));
    console.log(chalk.cyan('═'.repeat(50)));

    console.log(chalk.cyan('\n🎯 Configuration Presets'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(chalk.gray('/preset fast') + chalk.gray('      - Quick prototyping (no verification)'));
    console.log(chalk.gray('/preset standard') + chalk.gray('   - Balanced (ToT planning)'));
    console.log(chalk.gray('/preset thorough') + chalk.gray('   - Production-ready (ToT + verify)'));
    console.log(chalk.gray('/preset expert') + chalk.gray('     - Maximum quality (all features)'));
    console.log(chalk.cyan('═'.repeat(50)));

    console.log(chalk.cyan('\n💡 Usage Tips'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(chalk.gray('• Type anything to chat with AI (default mode)'));
    console.log(chalk.white('• /loop <task>') + chalk.gray(' - Use 4-step loop (Reason→Execute→Observe→Repair)'));
    console.log(chalk.white('• /plan <task>') + chalk.gray(' - Traditional planning mode'));
    console.log(chalk.gray('• Press Up/Down arrow keys to browse command history'));
    console.log(chalk.gray('• Press Ctrl+C to interrupt AI requests'));
    console.log(chalk.gray('• Use /preset to quickly configure for your use case'));
    console.log(chalk.gray('• Use /set executionMode to switch execution mode dynamically'));
    console.log(chalk.gray('• Use # memorize to save important conversations'));
    console.log(chalk.cyan('═'.repeat(50)) + '\n');
  }

  /**
   * Handle /preset command
   * Quick configuration presets for different use cases
   */
  private async handlePresetCommand(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log(chalk.cyan('\n⚙️  Configuration Presets'));
      console.log(chalk.cyan('═'.repeat(50)));
      console.log(chalk.white('/preset fast') + chalk.gray('      - Quick prototyping (no verification)'));
      console.log(chalk.white('/preset standard') + chalk.gray('   - Balanced (ToT planning)'));
      console.log(chalk.white('/preset thorough') + chalk.gray('   - Production-ready (ToT + verify)'));
      console.log(chalk.white('/preset expert') + chalk.gray('     - Maximum quality (all features)'));
      console.log(chalk.cyan('═'.repeat(50)) + '\n');
      return;
    }

    const preset = args[0].toLowerCase();

    switch (preset) {
      case 'fast':
        this.session.setUltrathink(false);
        console.log(chalk.green('\n✅ Fast preset activated'));
        console.log(chalk.gray('• Ultrathink: disabled'));
        console.log(chalk.gray('• Verification: disabled'));
        console.log(chalk.gray('• Best for: Quick prototyping\n'));
        break;

      case 'standard':
        this.session.setUltrathink(true);
        console.log(chalk.green('\n✅ Standard preset activated'));
        console.log(chalk.gray('• Ultrathink: enabled (ToT planning)'));
        console.log(chalk.gray('• Verification: disabled'));
        console.log(chalk.gray('• Best for: Regular development\n'));
        break;

      case 'thorough':
        this.session.setUltrathink(true);
        this.session.setVerify(true);
        console.log(chalk.green('\n✅ Thorough preset activated'));
        console.log(chalk.gray('• Ultrathink: enabled (ToT + ReAct)'));
        console.log(chalk.gray('• Verification: enabled (2-stage)'));
        console.log(chalk.gray('• Best for: Production code\n'));
        break;

      case 'expert':
        this.session.setUltrathink(true);
        this.session.setVerify(true);
        console.log(chalk.green('\n✅ Expert preset activated'));
        console.log(chalk.gray('• Ultrathink: enabled (max options)'));
        console.log(chalk.gray('• Verification: enabled (full ReAct)'));
        console.log(chalk.gray('• Auto-fix: enabled'));
        console.log(chalk.gray('• Best for: Critical systems\n'));
        console.log(chalk.yellow('Note: This mode uses more API calls and takes longer.\n'));
        break;

      default:
        console.log(chalk.yellow(`\n⚠️  Unknown preset: ${preset}`));
        console.log(chalk.gray('Available presets: fast, standard, thorough, expert\n'));
    }
  }

  /**
   * Handle /mode command
   */
  private async handleModeCommand(args: string[]): Promise<void> {
    const currentMode = this.session.getCurrentMode();
    const iterationCount = this.session.getIterationCount();

    // No arguments - show current mode
    if (args.length === 0) {
      console.log(chalk.cyan('\n🔄 Execution Mode'));
      console.log(chalk.cyan('═'.repeat(50)));
      console.log(`${chalk.gray('Current Mode:')}   ${currentMode.toUpperCase()}`);
      console.log(`${chalk.gray('Iterations:')}     ${iterationCount}`);
      console.log(chalk.cyan('─'.repeat(50)));

      if (currentMode === 'plan') {
        console.log(chalk.gray('Plan mode: Generate new action plans from requirements'));
      } else {
        console.log(chalk.gray('Verify mode: Check if requirements are satisfied'));
      }
      console.log(chalk.cyan('═'.repeat(50)) + '\n');
      return;
    }

    // Parse mode argument
    const modeArg = args[0].toLowerCase();

    // Handle mode switching
    if (modeArg === 'plan') {
      this.session.setMode('plan');
      this.session.resetIteration();
      console.log(chalk.green('\n✅ Switched to PLAN mode'));
      console.log(chalk.gray('Iterations reset to 0\n'));
    } else if (modeArg === 'verify') {
      this.session.setMode('verify');
      console.log(chalk.green('\n✅ Switched to VERIFY mode'));
      console.log(chalk.gray(`Iteration count: ${this.session.getIterationCount()}\n`));
    } else if (modeArg === 'reset') {
      this.session.resetIteration();
      console.log(chalk.green('\n✅ Iteration counter reset\n'));
    } else {
      console.log(chalk.yellow(`\n⚠️  Unknown mode: ${modeArg}`));
      console.log(chalk.gray('Available modes: plan, verify'));
      console.log(chalk.gray('Use: /mode reset to reset iterations\n'));
    }
  }

  /**
   * Handle /set command
   * Set configuration options dynamically
   */
  private async handleSetCommand(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log(chalk.cyan('\n⚙️  Configuration Options'));
      console.log(chalk.cyan('═'.repeat(50)));
      console.log(chalk.white('/set functionCalling true') + chalk.gray('  - Enable Function Calling API'));
      console.log(chalk.white('/set functionCalling false') + chalk.gray(' - Disable Function Calling API (use JSON mode)'));
      console.log(chalk.white('/set executionMode <mode>') + chalk.gray(' - Set execution mode'));
      console.log(chalk.cyan('─'.repeat(50)));

      // Detailed mode descriptions
      console.log(chalk.gray('\nAvailable Execution Modes:'));
      console.log(chalk.white('  • subagent') + chalk.gray('      - Two-phase planning with specialized agents (recommended)'));
      console.log(chalk.gray('                              Best for: Complex tasks requiring planning'));
      console.log(chalk.white('  • standard') + chalk.gray('      - Direct execution without planning'));
      console.log(chalk.gray('                              Best for: Simple, quick tasks'));
      console.log(chalk.white('  • two-phase') + chalk.gray('     - Plan → Execute workflow with confirmation'));
      console.log(chalk.gray('                              Best for: Tasks where you want to review the plan'));
      console.log(chalk.white('  • multi-agent') + chalk.gray('   - Parallel specialized agents (frontend, backend, etc.)'));
      console.log(chalk.gray('                              Best for: Tasks with multiple components'));
      console.log(chalk.white('  • function-calling') + chalk.gray(' - OpenAI Function Calling API'));
      console.log(chalk.gray('                              Best for: OpenAI-compatible APIs'));

      console.log(chalk.cyan('\n' + '═'.repeat(50)));
      console.log(chalk.gray('\nExamples:'));
      console.log(chalk.gray('  /set executionMode subagent'));
      console.log(chalk.gray('  /set mode standard'));
      console.log(chalk.gray('  /set functionCalling true'));
      console.log(chalk.cyan('═'.repeat(50)));
      console.log(chalk.gray('\nCurrent Settings:'));
      const config = this.session.getConfig();
      const execMode = this.session.getExecutionMode();
      console.log(chalk.gray(`• Function Calling: ${config.functionCallingEnabled ? chalk.green('enabled') : chalk.red('disabled')}`));
      console.log(chalk.gray(`• Execution Mode: ${chalk.white(execMode)}`));

      // Show mode description for current mode
      const modeDescriptions: Record<string, string> = {
        'subagent': 'Two-phase planning with specialized agents',
        'standard': 'Direct execution without planning',
        'two-phase': 'Plan → Execute workflow',
        'multi-agent': 'Parallel specialized agents',
        'function-calling': 'OpenAI Function Calling API',
      };
      const currentDesc = modeDescriptions[execMode];
      if (currentDesc) {
        console.log(chalk.gray(`  └─ ${currentDesc}`));
      }

      console.log('');
      return;
    }

    const key = args[0];
    const value = args[1];

    if (key === 'functionCalling') {
      if (value === 'true' || value === '1') {
        this.session.setFunctionCalling(true);
        console.log(chalk.green('\n✅ Function Calling API enabled'));
        console.log(chalk.gray('• AI will use OpenAI Function Calling API'));
        console.log(chalk.gray('• Requires OpenAI-compatible API\n'));
      } else if (value === 'false' || value === '0') {
        this.session.setFunctionCalling(false);
        console.log(chalk.green('\n✅ Function Calling API disabled'));
        console.log(chalk.gray('• Using JSON response format instead'));
        console.log(chalk.gray('• Better compatibility with non-OpenAI APIs\n'));
      } else {
        console.log(chalk.yellow('\n⚠️  Invalid value'));
        console.log(chalk.gray('Use: /set functionCalling true|false\n'));
      }
    } else if (key === 'executionMode' || key === 'mode') {
      const validModes = ['function-calling', 'two-phase', 'multi-agent', 'subagent', 'standard'];
      if (!value || !validModes.includes(value)) {
        console.log(chalk.yellow('\n⚠️  Invalid execution mode'));
        console.log(chalk.gray(`Received: "${value || '(empty)'}"`));
        console.log(chalk.gray('\nAvailable modes:'));
        validModes.forEach(mode => {
          console.log(chalk.gray(`  • ${mode}`));
        });
        console.log(chalk.gray('\nExamples:'));
        console.log(chalk.gray('  /set executionMode subagent'));
        console.log(chalk.gray('  /set mode standard\n'));
        return;
      }

      const previousMode = this.session.getExecutionMode();

      // Deprecation warnings for old modes
      if (value === 'two-phase') {
        console.log(chalk.yellow('\n⚠️  WARNING: two-phase execution mode is deprecated'));
        console.log(chalk.yellow('   This mode will be merged into subagent in v4.0.0'));
        console.log(chalk.gray('   Migration: Use /set executionMode subagent (recommended)\n'));
      } else if (value === 'multi-agent') {
        console.log(chalk.yellow('\n⚠️  WARNING: multi-agent execution mode is deprecated'));
        console.log(chalk.yellow('   This mode will be integrated into subagent in v4.0.0'));
        console.log(chalk.gray('   Migration: Use /set executionMode subagent (recommended)\n'));
      }

      this.session.setExecutionMode(value as any);

      console.log(chalk.green(`\n✅ Execution mode changed: ${chalk.white(previousMode)} → ${chalk.white(value)}`));

      // Add mode description
      const modeDescriptions: Record<string, string> = {
        'subagent': 'Two-phase planning with specialized agents (recommended)',
        'standard': 'Direct execution without planning phase',
        'two-phase': 'Plan → Execute workflow with confirmation',
        'multi-agent': 'Parallel specialized agents (frontend, backend, etc.)',
        'function-calling': 'OpenAI Function Calling API (requires compatible API)',
      };

      const description = modeDescriptions[value];
      if (description) {
        console.log(chalk.gray(`• ${description}`));
      }

      console.log(chalk.gray(`• Prompt updated: check the mode indicator\n`));

      // Automatically disable autonomous mode for two-phase and multi-agent
      // to avoid conflicts
      if (value === 'two-phase' || value === 'multi-agent') {
        const wasAutonomous = this.session.isAutonomousEnabled();
        if (wasAutonomous) {
          this.session.setAutonomous(false);
          console.log(chalk.yellow('ℹ️  Autonomous mode auto-disabled (conflicts with ' + value + ')'));
        }
      }

      // Show mode-specific info
      switch (value) {
        case 'function-calling':
          console.log(chalk.gray('• Using OpenAI Function Calling API'));
          console.log(chalk.gray('• AI autonomously calls tools\n'));
          break;
        case 'two-phase':
          console.log(chalk.gray('• Using Two-Phase Agent system (tool-based)'));
          console.log(chalk.gray('• PlanAgent uses read-only tools to analyze'));
          console.log(chalk.gray('• ExecuteAgent uses write tools to implement'));
          console.log(chalk.gray('• Higher success rate for complex tasks\n'));
          break;
        case 'multi-agent':
          console.log(chalk.gray('• Using Multi-Agent system'));
          console.log(chalk.gray('• Specialized agents collaborate\n'));
          break;
        case 'standard':
          console.log(chalk.gray('• Using standard JSON mode'));
          console.log(chalk.gray('• Single AI call with structured response\n'));
          break;
      }
    } else {
      console.log(chalk.yellow(`\n⚠️  Unknown option: ${key}`));
      console.log(chalk.gray('Type /set to see available options.\n'));
    }
  }

  /**
   * Handle /fft command - FFT (Fast and Frugal Tree) mode control
   */
  private handleFFTCommand(args: string[]): void {
    if (args.length === 0) {
      console.log(chalk.cyan('\n⚡ FFT (Fast and Frugal Tree) Mode'));
      console.log(chalk.cyan('═'.repeat(50)));
      console.log(chalk.gray('FFT uses a fast decision tree for quick decisions.'));
      console.log(chalk.white('/fft on') + chalk.gray('   - Enable FFT mode (fast decisions)'));
      console.log(chalk.white('/fft off') + chalk.gray('  - Disable FFT mode (AI free decision)'));
      console.log(chalk.white('/fft status') + chalk.gray(' - Show FFT mode status'));
      console.log(chalk.cyan('═'.repeat(50)));
      console.log(chalk.gray('\nCurrent status:'));
      const fftEnabled = this.session.isFFTEnabled();
      console.log(chalk.gray(`• FFT Mode: ${fftEnabled ? chalk.green('enabled') : chalk.red('disabled')}`));
      console.log(chalk.gray(fftEnabled
        ? '• Using: Fast decision tree with preset paths'
        : '• Using: AI free decision (standard mode)\n'));
      return;
    }

    const action = args[0].toLowerCase();

    if (action === 'on' || action === 'true' || action === 'enable') {
      this.session.setFFT(true);
      console.log(chalk.cyan('\n⚡ FFT Mode Enabled'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.gray('• Fast decision tree with preset paths'));
      console.log(chalk.gray('• Typical response time: 1-2 seconds'));
      console.log(chalk.gray('• Max API calls: 1-3 (vs 2-10 in standard mode)'));
      console.log(chalk.gray('• Best for: Quick questions, current info queries'));
      console.log(chalk.gray('\nDecision tree:'));
      console.log(chalk.gray('  1. Check for time-sensitive keywords → Search if yes'));
      console.log(chalk.gray('  2. Check if knowledge is sufficient → Answer if yes'));
      console.log(chalk.gray('  3. Otherwise → Search for comprehensive answer'));
      console.log(chalk.cyan('─'.repeat(50)) + '\n');
    } else if (action === 'off' || action === 'false' || action === 'disable') {
      this.session.setFFT(false);
      console.log(chalk.cyan('\n🤖 Standard Mode Enabled'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.gray('• AI freely decides whether to use tools'));
      console.log(chalk.gray('• Multiple tool calls possible (up to 10)'));
      console.log(chalk.gray('• Typical response time: 3-5 seconds'));
      console.log(chalk.gray('• Best for: Complex queries, multi-step research'));
      console.log(chalk.cyan('─'.repeat(50)) + '\n');
    } else if (action === 'status') {
      const fftEnabled = this.session.isFFTEnabled();
      console.log(chalk.cyan('\n⚡ FFT Mode Status'));
      console.log(chalk.cyan('─'.repeat(50)));
      console.log(chalk.gray(`Status: ${fftEnabled ? chalk.green('ENABLED') : chalk.red('DISABLED')}`));
      console.log(chalk.gray(`Mode: ${fftEnabled ? 'Fast decision tree' : 'AI free decision'}`));
      console.log(chalk.cyan('─'.repeat(50)) + '\n');
    } else {
      console.log(chalk.yellow('\n⚠️  Unknown action'));
      console.log(chalk.gray('Use: /fft on|off|status\n'));
    }
  }

  /**
   * Handle /landmark command - Landmark Counting mode control
   */
  private handleLandmarkCommand(args: string[]): void {
    if (args.length === 0) {
      console.log(chalk.cyan('\n📍 Landmark Counting Mode'));
      console.log(chalk.cyan('═'.repeat(50)));
      console.log(chalk.gray('Landmark Counting uses milestone-based planning with topological sorting.'));
      console.log(chalk.white('/landmark on') + chalk.gray('   - Enable Landmark Counting (smart step-by-step)'));
      console.log(chalk.white('/landmark off') + chalk.gray('  - Disable Landmark Counting'));
      console.log(chalk.white('/landmark status') + chalk.gray(' - Show Landmark Counting status'));
      console.log(chalk.cyan('═'.repeat(50)));
      console.log(chalk.gray('\nCurrent status:'));
      const landmarkEnabled = this.session.isLandmarkEnabled();
      console.log(chalk.gray(`• Landmark Counting: ${landmarkEnabled ? chalk.green('enabled') : chalk.red('disabled')}`));
      console.log(chalk.gray(landmarkEnabled
        ? '• Using: Milestone-based planning with topological sorting'
        : '• Not using landmark-based planning\n'));
      return;
    }

    const action = args[0].toLowerCase();

    if (action === 'on' || action === 'true' || action === 'enable') {
      this.session.setLandmark(true);
      console.log(chalk.cyan('\n📍 Landmark Counting Mode Enabled'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.gray('• Milestone-based planning with smart step-by-step execution'));
      console.log(chalk.gray('• Typical response time: 3-5 seconds'));
      console.log(chalk.gray('• Max API calls: 3-5 (vs 2-10 in standard, 15-30 in ToT)'));
      console.log(chalk.gray('• Best for: Medium complexity tasks with clear sub-goals'));
      console.log(chalk.gray('\nPlanning process:'));
      console.log(chalk.gray('  1. AI identifies key milestones (landmarks)'));
      console.log(chalk.gray('  2. Analyzes dependencies between milestones'));
      console.log(chalk.gray('  3. Topological sort for execution order (Kahn algorithm)'));
      console.log(chalk.gray('  4. Generates actions for each milestone'));
      console.log(chalk.cyan('─'.repeat(50)) + '\n');
    } else if (action === 'off' || action === 'false' || action === 'disable') {
      this.session.setLandmark(false);
      console.log(chalk.cyan('\n🤖 Standard Mode Enabled'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.gray('• AI directly generates action plan'));
      console.log(chalk.gray('• No intermediate milestone breakdown'));
      console.log(chalk.gray('• Typical response time: 1-2 seconds'));
      console.log(chalk.gray('• Best for: Simple tasks or when ToT/Landmark planning fails'));
      console.log(chalk.cyan('─'.repeat(50)) + '\n');
    } else if (action === 'status') {
      const landmarkEnabled = this.session.isLandmarkEnabled();
      console.log(chalk.cyan('\n📍 Landmark Counting Status'));
      console.log(chalk.cyan('─'.repeat(50)));
      console.log(chalk.gray(`Status: ${landmarkEnabled ? chalk.green('ENABLED') : chalk.red('DISABLED')}`));
      console.log(chalk.gray(`Mode: ${landmarkEnabled ? 'Milestone-based planning' : 'Standard AI planning'}`));
      console.log(chalk.cyan('─'.repeat(50)) + '\n');
    } else {
      console.log(chalk.yellow('\n⚠️  Unknown action'));
      console.log(chalk.gray('Use: /landmark on|off|status\n'));
    }
  }

  /**
   * Handle /intent command - Intent Recognition control
   */
  private async handleIntentCommand(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log(chalk.cyan('\n🎯 Intent Recognition Mode'));
      console.log(chalk.cyan('═'.repeat(50)));
      console.log(chalk.gray('Intent Recognition automatically detects user intent and redirects to appropriate mode.'));
      console.log(chalk.white('/intent on') + chalk.gray('    - Enable intent recognition'));
      console.log(chalk.white('/intent off') + chalk.gray('   - Disable intent recognition'));
      console.log(chalk.white('/intent status') + chalk.gray(' - Show intent recognition status'));
      console.log(chalk.cyan('═'.repeat(50)));
      console.log(chalk.gray('\nCurrent status:'));
      const intentConfig = await this.getIntentRecognitionConfig();
      const intentEnabled = intentConfig?.enabled ?? false;
      console.log(chalk.gray(`• Intent Recognition: ${intentEnabled ? chalk.green('enabled') : chalk.red('disabled')}`));
      if (intentEnabled) {
        console.log(chalk.gray(`• Auto-redirect: ${intentConfig?.autoRedirect ?? true ? chalk.green('yes') : chalk.red('no')}`));
        console.log(chalk.gray(`• Confidence threshold: ${Math.round((intentConfig?.confidenceThreshold ?? 0.6) * 100)}%`));
      }
      console.log(chalk.gray('\nWhen enabled:'));
      console.log(chalk.gray('• Simple questions → /chat mode'));
      console.log(chalk.gray('• Simple tasks → /plan (FFT)'));
      console.log(chalk.gray('• Medium tasks → /plan (Landmark)'));
      console.log(chalk.gray('• Complex tasks → /plan (ToT)'));
      console.log('');
      return;
    }

    const action = args[0].toLowerCase();

    if (action === 'on' || action === 'true' || action === 'enable') {
      // Read current config
      const config = await this.loadSettingsFile();
      if (!config.intentRecognition) {
        config.intentRecognition = {};
      }
      config.intentRecognition.enabled = true;

      // Save config
      await this.saveSettingsFile(config);

      console.log(chalk.cyan('\n🎯 Intent Recognition Enabled'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.gray('• User input will be automatically analyzed'));
      console.log(chalk.gray('• Redirect to appropriate mode based on intent'));
      console.log(chalk.gray('• Simple questions → /chat'));
      console.log(chalk.gray('• Tasks → /plan (with algorithm selection)'));
      console.log(chalk.cyan('─'.repeat(50)) + '\n');
    } else if (action === 'off' || action === 'false' || action === 'disable') {
      // Read current config
      const config = await this.loadSettingsFile();
      if (!config.intentRecognition) {
        config.intentRecognition = {};
      }
      config.intentRecognition.enabled = false;

      // Save config
      await this.saveSettingsFile(config);

      console.log(chalk.cyan('\n🎯 Intent Recognition Disabled'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.gray('• Users must manually specify /plan, /do, or /chat'));
      console.log(chalk.gray('• Default mode is chat'));
      console.log(chalk.cyan('─'.repeat(50)) + '\n');
    } else if (action === 'status') {
      const intentConfig = await this.getIntentRecognitionConfig();
      const intentEnabled = intentConfig?.enabled ?? false;
      console.log(chalk.cyan('\n🎯 Intent Recognition Status'));
      console.log(chalk.cyan('─'.repeat(50)));
      console.log(chalk.gray(`Status: ${intentEnabled ? chalk.green('ENABLED') : chalk.red('DISABLED')}`));
      console.log(chalk.gray(`Auto-redirect: ${intentConfig?.autoRedirect ?? true ? chalk.green('yes') : chalk.red('no')}`));
      console.log(chalk.gray(`Confidence threshold: ${Math.round((intentConfig?.confidenceThreshold ?? 0.6) * 100)}%`));
      console.log(chalk.gray(`Auto-redirect questions: ${intentConfig?.autoRedirectQuestions ?? true ? chalk.green('yes') : chalk.red('no')}`));
      console.log(chalk.cyan('─'.repeat(50)) + '\n');
    } else {
      console.log(chalk.yellow('\n⚠️  Unknown action'));
      console.log(chalk.gray('Use: /intent on|off|status\n'));
    }
  }

  /**
   * Handle /ultrathink command
   */
  private handleUltrathinkCommand(): void {
    const isEnabled = this.session.toggleUltrathink();

    console.log(chalk.cyan('\n🔍 Ultrathink Mode'));
    console.log(chalk.cyan('─'.repeat(50)));

    if (isEnabled) {
      console.log(chalk.green('✅ Ultrathink ENABLED'));
      console.log(chalk.gray('AI request timing and token usage will be displayed.\n'));
    } else {
      console.log(chalk.gray('⬜ Ultrathink DISABLED'));
      console.log(chalk.gray('AI request details will be hidden.\n'));
    }

    console.log(chalk.cyan('─'.repeat(50)) + '\n');
  }

  /**
   * Handle /undo command - Undo last action using git rollback
   */
  private async handleUndoCommand(): Promise<void> {
    const { execFileSync } = require('child_process');
    const inquirer = require('inquirer');

    try {
      // Get the current git status to check if there are changes
      const root = this.session.getProjectRoot();

      // Check if we're in a git repository
      try {
        execFileSync('git', ['rev-parse', '--git-dir'], {
          cwd: root,
          stdio: 'ignore',
        });
      } catch (error) {
        console.log(chalk.yellow('\n⚠️  Not a git repository'));
        console.log(chalk.gray('Undo requires git to be initialized.\n'));
        return;
      }

      // Get the last commit
      const lastCommit = execFileSync('git', ['log', '-1', '--pretty=format:%h|%s|%an, %ar'], {
        cwd: root,
        encoding: 'utf-8',
      }).trim();

      if (!lastCommit) {
        console.log(chalk.yellow('\n⚠️  No git history found'));
        console.log(chalk.gray('No actions to undo.\n'));
        return;
      }

      const [hash, message, meta] = lastCommit.split('|');
      const shortHash = hash.substring(0, 8);

      // 🎮 区分 kode checkpoint 与用户自己的提交
      const isKodeCheckpoint = this.rollbackManager.isKodeCheckpoint(hash);
      if (!isKodeCheckpoint) {
        console.log(chalk.yellow('\n⚠️  HEAD commit was NOT created by newma'));
        console.log(chalk.gray(`Commit: ${shortHash} - ${message}`));
        console.log(chalk.gray('This looks like your own commit. /undo will permanently discard it.'));
        console.log(chalk.gray('If you want to rewind a newma change, use /saves + /back-to instead (lossless).'));
      }

      // Get the list of files changed in the last commit
      const changedFiles = execFileSync('git', ['diff', '--name-only', 'HEAD~1', 'HEAD'], {
        cwd: root,
        encoding: 'utf-8',
      }).trim().split('\n').filter((f: string) => f);

      // Display what will be undone
      console.log(chalk.yellow('\n⚠️  Undo Last Action'));
      console.log(chalk.yellow('═'.repeat(60)));
      console.log(chalk.gray(`Commit: ${chalk.cyan(shortHash)}`));
      console.log(chalk.gray(`Author: ${meta}`));
      console.log(chalk.white(`Message: ${message}`));

      if (changedFiles.length > 0 && changedFiles[0] !== '') {
        console.log(chalk.gray('\nFiles that will be reverted:'));
        changedFiles.forEach((file: string) => {
          console.log(chalk.gray(`  • ${file}`));
        });
      }

      console.log(chalk.gray('\nThis will reset to the previous commit.'));
      console.log(chalk.yellow('═'.repeat(60)));

      // Ask for confirmation (non-kode commits require explicit opt-in)
      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: isKodeCheckpoint
            ? 'Rollback to previous state?'
            : 'This is YOUR OWN commit. Discard it anyway?',
          default: isKodeCheckpoint,
        },
      ]);

      if (!answers.confirmed) {
        console.log(chalk.gray('\n⚠️  Undo cancelled by user\n'));
        return;
      }

      // Perform the rollback
      execFileSync('git', ['reset', '--hard', 'HEAD~1'], {
        cwd: root,
        stdio: 'inherit',
      });

      console.log(chalk.green('\n✅ Successfully rolled back to previous state'));
      console.log(chalk.gray(`Removed commit: ${shortHash}\n`));

    } catch (error: any) {
      console.error(chalk.red(`\n❗ Undo failed: ${error.message}\n`));
    }
  }

  /**
   * Handle /modes command - Show available execution modes
   */
  private handleModesCommand(): void {
    const currentMode = this.session.getExecutionMode();

    console.log(chalk.cyan('\n📋 Available Execution Modes'));
    console.log(chalk.cyan('═'.repeat(60)));

    const modes = [
      {
        name: 'subagent',
        icon: '🤖',
        description: 'Two-phase planning with specialized agents',
        bestFor: 'Complex tasks requiring planning',
        current: currentMode === 'subagent',
      },
      {
        name: 'standard',
        icon: '⚙️',
        description: 'Direct execution without planning',
        bestFor: 'Simple, quick tasks',
        current: currentMode === 'standard',
      },
      {
        name: 'two-phase',
        icon: '🔄',
        description: 'Plan → Execute workflow with confirmation',
        bestFor: 'Tasks requiring approval before execution',
        current: currentMode === 'two-phase',
      },
      {
        name: 'multi-agent',
        icon: '👥',
        description: 'Parallel specialized agents (frontend, backend, etc.)',
        bestFor: 'Multi-domain tasks',
        current: currentMode === 'multi-agent',
      },
      {
        name: 'function-calling',
        icon: '🔧',
        description: 'OpenAI Function Calling API',
        bestFor: 'APIs with tool calling support',
        current: currentMode === 'function-calling',
      },
    ];

    modes.forEach(mode => {
      const marker = mode.current ? chalk.green('→') : ' ';
      const currentTag = mode.current ? chalk.green(' (Current)') : '';
      console.log(`${marker} ${mode.icon} ${chalk.white(mode.name)}${currentTag}`);
      if (mode.current) {
        console.log(chalk.gray(`   ${mode.description}`));
        console.log(chalk.gray(`   Best for: ${mode.bestFor}\n`));
      } else {
        console.log(chalk.gray(`   ${mode.description}`));
        console.log(chalk.gray(`   Best for: ${mode.bestFor}\n`));
      }
    });

    console.log(chalk.cyan('═'.repeat(60)));
    console.log(chalk.gray(`Switch modes: ${chalk.white('/set executionMode <mode>')}`));
    console.log(chalk.gray(`Or use: ${chalk.white('/mode <mode>')}\n`));
  }

  /**
   * Handle /diff command - Show git diff of changes
   */
  private async handleDiffCommand(): Promise<void> {
    const { execFileSync } = require('child_process');

    try {
      const root = this.session.getProjectRoot();

      // Check if we're in a git repository
      try {
        execFileSync('git', ['rev-parse', '--git-dir'], {
          cwd: root,
          stdio: 'ignore',
        });
      } catch (error) {
        console.log(chalk.yellow('\n⚠️  Not a git repository'));
        console.log(chalk.gray('Git diff requires git to be initialized.\n'));
        return;
      }

      // Check if there are uncommitted changes
      const status = execFileSync('git', ['status', '--porcelain'], {
        cwd: root,
        encoding: 'utf-8',
      }).trim();

      if (!status) {
        console.log(chalk.cyan('\n📊 Git Diff'));
        console.log(chalk.cyan('═'.repeat(60)));
        console.log(chalk.gray('No uncommitted changes found.\n'));
        console.log(chalk.gray('Everything is clean. Make some changes to see the diff.\n'));
        console.log(chalk.cyan('═'.repeat(60)) + '\n');
        return;
      }

      console.log(chalk.cyan('\n📊 Changes Made This Session'));
      console.log(chalk.cyan('═'.repeat(60)));

      // Parse the status to get changed files
      const lines = status.split('\n');
      const modifiedFiles: string[] = [];
      const addedFiles: string[] = [];
      const deletedFiles: string[] = [];

      lines.forEach((line: string) => {
        if (!line) return;
        const statusCode = line.substring(0, 2);
        const filePath = line.substring(3);
        if (statusCode.includes('M')) {
          modifiedFiles.push(filePath);
        } else if (statusCode.includes('A')) {
          addedFiles.push(filePath);
        } else if (statusCode.includes('D')) {
          deletedFiles.push(filePath);
        }
      });

      // Show summary of changes
      if (modifiedFiles.length > 0) {
        console.log(chalk.yellow('Modified:'));
        modifiedFiles.forEach(file => {
          console.log(chalk.gray(`  • ${file}`));
        });
        console.log('');
      }

      if (addedFiles.length > 0) {
        console.log(chalk.green('Added:'));
        addedFiles.forEach(file => {
          console.log(chalk.gray(`  • ${file}`));
        });
        console.log('');
      }

      if (deletedFiles.length > 0) {
        console.log(chalk.red('Deleted:'));
        deletedFiles.forEach(file => {
          console.log(chalk.gray(`  • ${file}`));
        });
        console.log('');
      }

      // Get actual diff for first few files
      const filesToShow = [...modifiedFiles, ...addedFiles].slice(0, 3);

      if (filesToShow.length > 0) {
        console.log(chalk.cyan('═'.repeat(60)));
        console.log(chalk.gray('Preview of changes (first 3 files):\n'));

        filesToShow.forEach(file => {
          try {
            const diff = execFileSync('git', ['diff', '--unified=3', file], {
              cwd: root,
              encoding: 'utf-8',
            }).trim();

            if (diff) {
              // Show a simplified version of the diff
              const lines = diff.split('\n');
              const relevantLines = lines.slice(5); // Skip git headers

              console.log(chalk.white(`${file}`));
              console.log(chalk.gray('─'.repeat(60)));

              // Show up to 20 lines of diff
              relevantLines.slice(0, 20).forEach((line: string) => {
                if (line.startsWith('+') && !line.startsWith('+++')) {
                  console.log(chalk.green(line));
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                  console.log(chalk.red(line));
                } else if (line.startsWith('@')) {
                  console.log(chalk.cyan(line));
                } else {
                  console.log(chalk.gray(line));
                }
              });

              if (relevantLines.length > 20) {
                console.log(chalk.gray(`... (${relevantLines.length - 20} more lines)`));
              }
              console.log('');
            }
          } catch (error) {
            // Skip files that fail to diff
          }
        });
      }

      console.log(chalk.cyan('═'.repeat(60)));
      console.log(chalk.gray('To see full diff, run: ') + chalk.white('git diff'));
      console.log(chalk.gray('To commit all changes, use git commit\n'));
      console.log(chalk.cyan('═'.repeat(60)) + '\n');

    } catch (error: any) {
      console.error(chalk.red(`\n❗ Failed to show diff: ${error.message}\n`));
    }
  }

  /**
   * Handle /tasks command - List all tasks
   */
  private async handleTasksCommand(args: string[]): Promise<void> {
    const { TaskCommands } = await import('./task-tracker/commands');
    const { TaskDisplay } = await import('./task-tracker/display');

    const taskTracker = this.session.getTaskTracker();
    const taskDisplay = new TaskDisplay();
    const taskCommands = new TaskCommands(taskTracker, taskDisplay);

    await taskCommands.handleListTasks(args);
  }

  /**
   * Handle /task command - View or export task
   */
  private async handleTaskCommand(args: string[]): Promise<void> {
    const { TaskCommands } = await import('./task-tracker/commands');
    const { TaskDisplay } = await import('./task-tracker/display');

    const taskTracker = this.session.getTaskTracker();
    const taskDisplay = new TaskDisplay();
    const taskCommands = new TaskCommands(taskTracker, taskDisplay);

    // Check if subcommand is 'export'
    if (args[0] === 'export') {
      await taskCommands.handleExportTask(args.slice(1), this.session.getProjectRoot());
    } else {
      await taskCommands.handleViewTask(args);
    }
  }

  /**
   * Handle /resume command - Show and reload command history
   */
  private async handleResumeCommand(): Promise<void> {
    console.log(chalk.cyan('\n📜 Command History Resume'));
    console.log(chalk.cyan('═'.repeat(60)));

    const historyCount = this.commandHistory.length;
    const lastCommand = this.commandHistory[this.commandHistory.length - 1];

    console.log(chalk.gray(`Total commands in history: ${chalk.white(historyCount)}`));

    if (lastCommand) {
      console.log(chalk.gray(`Last command: ${chalk.white(lastCommand)}`));
    }

    console.log('');

    // Show recent commands (last 10)
    if (historyCount > 0) {
      const recentCount = Math.min(10, historyCount);
      const startIndex = Math.max(0, historyCount - recentCount);

      console.log(chalk.gray(`Recent commands (last ${recentCount}):`));
      console.log('');

      for (let i = startIndex; i < historyCount; i++) {
        const cmd = this.commandHistory[i];
        const num = i + 1;
        const isLast = i === historyCount - 1;
        const marker = isLast ? chalk.green('→') : ' ';
        console.log(`${marker} ${chalk.gray(`[${num}]`)} ${chalk.white(cmd)}`);
      }

      console.log('');
    } else {
      console.log(chalk.gray('No commands in history yet.\n'));
    }

    console.log(chalk.cyan('═'.repeat(60)));
    console.log(chalk.gray('Tips:'));
    console.log(chalk.gray('  • History is automatically saved on exit'));
    console.log(chalk.gray('  • Use Up/Down arrows to browse history'));
    console.log(chalk.gray('  • Type /history to see full history'));
    console.log(chalk.cyan('═'.repeat(60)) + '\n');
  }

  // ==================== 🎮 游戏存档 / Galgame 分支命令 ====================

  /**
   * Handle /save [name] - 创建存档点（绑定 git + 消息 + flags + 任务）
   */
  private async handleSaveCommand(args: string[]): Promise<void> {
    if (!this.ensureTimeTravelReady()) return;

    const name = args.join(' ').trim() || undefined;

    try {
      const save = await this.timeTravel!.createSave({
        sessionId: this.branchSessionId,
        name,
        taskId: this.session.getTaskTracker().getCurrentTaskId() ?? undefined,
      });

      const label = name ? `"${name}"` : '(quick save)';
      console.log(chalk.green(`\n💾 Saved ${label}`));
      console.log(chalk.gray(`   id: ${save.id}`));
      if (save.gitHash) {
        console.log(chalk.gray(`   git: ${save.gitHash.substring(0, 7)}`));
      }
      console.log(chalk.gray(`   messages: ${save.messageCount}`));
      console.log(chalk.gray(`   Use /load ${save.id} to restore\n`));
    } catch (error: any) {
      console.log(chalk.red(`\n❗ Save failed: ${error.message}\n`));
    }
  }

  /**
   * Handle /saves - 列出全部存档槽（跨会话）
   */
  private async handleSavesCommand(args: string[]): Promise<void> {
    if (!this.ensureTimeTravelReady()) return;

    try {
      const all = args.includes('--all');
      const saves = await this.timeTravel!
        .getSavePointManager()
        .listSavePoints(all ? undefined : this.branchSessionId);

      console.log(chalk.cyan('\n💾 Save Points') + chalk.gray(all ? ' (all sessions)' : ' (this session, --all for all)'));
      console.log(chalk.cyan('═'.repeat(60)));
      console.log(this.timeTravel!.getSavePointManager().formatSaveList(saves));
      console.log(chalk.cyan('═'.repeat(60)) + '\n');
    } catch (error: any) {
      console.log(chalk.red(`\n❗ Failed to list saves: ${error.message}\n`));
    }
  }

  /**
   * Handle /load <id|name> - 读档（会话消息 + flags + git 无损恢复）
   */
  private async handleLoadCommand(args: string[]): Promise<void> {
    if (!this.ensureTimeTravelReady()) return;

    const target = args.join(' ').trim();
    if (!target) {
      console.log(chalk.yellow('\n⚠️  Usage: /load <save-id | save-name>'));
      console.log(chalk.gray('Run /saves to list available save points.\n'));
      return;
    }

    try {
      const saves = await this.timeTravel!.getSavePointManager();
      const save = await saves.getSavePoint(target);

      if (!save) {
        console.log(chalk.yellow(`\n⚠️  Save point not found: ${target}`));
        console.log(chalk.gray('Run /saves to list available save points.\n'));
        return;
      }

      console.log(chalk.cyan(`\n📥 Loading ${save.name ? `"${save.name}"` : save.id}...`));
      console.log(chalk.gray(`   from session ${save.sessionId}, ${save.messageCount} messages`));

      this.rl.pause();
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Restore this save point? (current work is preserved on a git branch)',
          default: true,
        },
      ]);
      this.rl.resume();

      if (!confirmed) {
        console.log(chalk.gray('\nLoad cancelled.\n'));
        return;
      }

      const result = await this.timeTravel!.loadSave(this.branchSessionId, save);

      if (result.success) {
        console.log(chalk.green('\n✅ Save restored'));
        if (result.preservedBranch) {
          console.log(chalk.gray(`   current work preserved on git branch: ${result.preservedBranch}`));
        }
        if (result.rewindBranch) {
          console.log(chalk.gray(`   checked out git branch: ${result.rewindBranch}`));
        }
        if (result.gitSkipped) {
          console.log(chalk.yellow(`   ⚠️  git not restored: ${result.gitSkipped}`));
        }
        // 周目切换：读档后决策/存档记入存档所属会话
        this.branchSessionId = save.sessionId;
        console.log(chalk.gray('   Session context and flags restored.'));
        console.log(chalk.gray('   Use /tree to see the decision tree.\n'));
      } else {
        console.log(chalk.red(`\n❗ Load failed: ${result.error}\n`));
      }
    } catch (error: any) {
      console.log(chalk.red(`\n❗ Load failed: ${error.message}\n`));
    }
  }

  /**
   * Handle /tree - 渲染 galgame 式决策流程图
   */
  private async handleTreeCommand(): Promise<void> {
    if (!this.ensureTimeTravelReady()) return;

    try {
      const text = await this.timeTravel!
        .getBranchTreeManager()
        .renderTree(this.branchSessionId);
      console.log(chalk.cyan('\n🌳 Decision Tree'));
      console.log(chalk.cyan('═'.repeat(60)));
      console.log(text);
      console.log(chalk.cyan('═'.repeat(60)) + '\n');
    } catch (error: any) {
      console.log(chalk.red(`\n❗ Failed to render tree: ${error.message}\n`));
    }
  }

  /**
   * Handle /flags [set k=v | clear k] - 会话事件标记（galgame flags）
   */
  private async handleFlagsCommand(args: string[]): Promise<void> {
    if (!this.ensureTimeTravelReady()) return;

    const branchTree = this.timeTravel!.getBranchTreeManager();
    const sessionId = this.branchSessionId;

    try {
      const sub = (args[0] || '').toLowerCase();

      if (sub === 'set') {
        const pair = args.slice(1).join(' ');
        const eq = pair.indexOf('=');
        if (eq <= 0) {
          console.log(chalk.yellow('\n⚠️  Usage: /flags set <key>=<value>\n'));
          return;
        }
        const key = pair.substring(0, eq).trim();
        const value = pair.substring(eq + 1).trim();
        await branchTree.setFlag(sessionId, key, value, 'user');
        console.log(chalk.green(`\n🎏 Flag set: ${key} = ${value}`));
        console.log(chalk.gray('   It will be injected into all plan generation.\n'));
        return;
      }

      if (sub === 'clear') {
        const key = args[1];
        if (!key) {
          console.log(chalk.yellow('\n⚠️  Usage: /flags clear <key>\n'));
          return;
        }
        const removed = await branchTree.clearFlag(sessionId, key);
        console.log(removed ? chalk.green(`\n🎏 Flag cleared: ${key}\n`) : chalk.yellow(`\n⚠️  No such flag: ${key}\n`));
        return;
      }

      const flags = await branchTree.getFlags(sessionId);
      console.log(chalk.cyan('\n🎏 Session Flags'));
      console.log(chalk.cyan('═'.repeat(60)));
      if (flags.length === 0) {
        console.log(chalk.gray('No flags set. Use /flags set <key>=<value>'));
        console.log(chalk.gray('e.g. /flags set state-lib=zustand:confirmed'));
      } else {
        flags.forEach((f) => {
          console.log(`${chalk.white(f.key)} = ${chalk.cyan(f.value)} ${chalk.gray(`[${f.source}]`)}`);
        });
      }
      console.log(chalk.cyan('═'.repeat(60)) + '\n');
    } catch (error: any) {
      console.log(chalk.red(`\n❗ Flags command failed: ${error.message}\n`));
    }
  }

  /**
   * Handle /back-to <decision-node | save-id> - 时间旅行（galgame 无损回跳）
   */
  private async handleBackToCommand(args: string[]): Promise<void> {
    if (!this.ensureTimeTravelReady()) return;

    const target = args.join(' ').trim();
    if (!target) {
      console.log(chalk.yellow('\n⚠️  Usage: /back-to <decision-id | save-id | save-name>'));
      console.log(chalk.gray('Run /tree to see decision nodes, /saves for save points.'));
      console.log(chalk.gray('Time travel is lossless: abandoned branches are preserved.\n'));
      return;
    }

    try {
      const sessionId = this.branchSessionId;
      const branchTree = this.timeTravel!.getBranchTreeManager();
      const saves = this.timeTravel!.getSavePointManager();

      // 优先匹配决策节点，其次匹配存档点
      let backTarget = await this.timeTravel!.targetFromDecision(sessionId, target);
      let source = 'decision';

      if (!backTarget) {
        const save = await saves.getSavePoint(target);
        if (save) {
          backTarget = this.timeTravel!.targetFromSave(save);
          source = 'save';
        }
      }

      if (!backTarget) {
        console.log(chalk.yellow(`\n⚠️  Target not found: ${target}`));
        console.log(chalk.gray('Run /tree for decision nodes or /saves for save points.\n'));
        return;
      }

      console.log(chalk.magenta(`\n⏪ Time Travel`));
      console.log(chalk.cyan('═'.repeat(60)));
      console.log(chalk.gray(`Target (${source}): ${backTarget.label}`));
      if (backTarget.gitHash) {
        console.log(chalk.gray(`git: ${backTarget.gitHash.substring(0, 7)}`));
      }
      console.log(chalk.gray('The current branch will be preserved (abandoned, not deleted).'));
      console.log(chalk.gray('Prior attempts will be injected as PRIOR BRANCH MEMORY.'));
      console.log(chalk.cyan('═'.repeat(60)));

      this.rl.pause();
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Rewind to this point?',
          default: false,
        },
      ]);
      this.rl.resume();

      if (!confirmed) {
        console.log(chalk.gray('\nTime travel cancelled.\n'));
        return;
      }

      const result = await this.timeTravel!.backTo(sessionId, backTarget);

      if (result.success) {
        console.log(chalk.green('\n✅ Rewound successfully'));
        if (result.preservedBranch) {
          console.log(chalk.gray(`   old branch preserved as: ${result.preservedBranch}`));
        }
        if (result.rewindBranch) {
          console.log(chalk.gray(`   now on git branch: ${result.rewindBranch}`));
        }
        if (result.gitSkipped) {
          console.log(chalk.yellow(`   ⚠️  git not rewound: ${result.gitSkipped}`));
          console.log(chalk.gray('      (session/decision context was still rewound)'));
        }
        if (result.abandonedDecisions > 0) {
          console.log(chalk.gray(`   ${result.abandonedDecisions} decision(s) marked abandoned`));
        }
        if (result.abandonedMessages > 0) {
          console.log(chalk.gray(`   ${result.abandonedMessages} message(s) moved out of AI context`));
        }
        console.log(chalk.gray('   Continue working — the AI remembers what failed before.\n'));
      } else {
        console.log(chalk.red(`\n❗ Time travel failed: ${result.error}\n`));
      }
    } catch (error: any) {
      console.log(chalk.red(`\n❗ Time travel failed: ${error.message}\n`));
    }
  }

  /**
   * Handle /continue - 继续最近一次会话（消息上下文 + flags + 分支树）
   */
  private async handleContinueCommand(): Promise<void> {
    await this.continueLastSession();
  }

  /**
   * 继续最近会话（/continue 命令与 CLI --continue 共用）
   */
  async continueLastSession(): Promise<boolean> {
    // 时间旅行系统是异步初始化的——CLI --continue 启动即调用时等它就绪
    for (let i = 0; i < 20 && !this.timeTravel; i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!this.ensureTimeTravelReady()) return false;

    try {
      const sessionCtx = this.session.getSessionContextManager();
      const candidates = await sessionCtx.getRecentSessions(5);

      // 找最近一个有实质消息且不是当前会话的历史会话
      const target = candidates.find(
        (s) => s.id !== this.session.getSessionId() && s.stats.messageCount > 0
      );

      if (!target) {
        console.log(chalk.yellow('\n🕘 No previous session with messages found.'));
        console.log(chalk.gray('Sessions are saved automatically on exit.\n'));
        return false;
      }

      console.log(chalk.cyan(`\n🕘 Continuing session: ${chalk.white(target.title)}`));
      console.log(chalk.gray(`   id: ${target.id} | ${target.stats.messageCount} messages`));

      const restored = await sessionCtx.restoreSession(target.id);
      if (!restored) {
        console.log(chalk.red(`\n❗ Failed to load session ${target.id}\n`));
        return false;
      }

      // 活跃会话标记指向恢复的会话（注入管道据此回放对话/flags/前世记忆）
      await this.timeTravel!.getBranchTreeManager().setActiveSession(target.id);
      if (this.memoPlugin) {
        await this.memoPlugin.setActiveBranchSession(target.id);
      }
      // 周目标识切换：后续决策/存档/flags 记入同一周目
      this.branchSessionId = target.id;

      // 回放最近几条，给用户确认感
      const messages = sessionCtx.getActiveMessages();
      const recent = messages.slice(-4);
      if (recent.length > 0) {
        console.log(chalk.gray('\n   Last exchange:'));
        for (const m of recent) {
          const who = m.role === 'user' ? '👤' : m.role === 'assistant' ? '🤖' : '⚙️';
          const text = m.content.replace(/\n+/g, ' ').slice(0, 72);
          console.log(chalk.gray(`   ${who} ${text}`));
        }
      }

      console.log(chalk.green('\n✅ Session continued — the AI remembers this conversation.'));
      console.log(chalk.gray('   (conversation replay + flags + branch memory are injected automatically)\n'));
      return true;
    } catch (error: any) {
      console.log(chalk.red(`\n❗ Continue failed: ${error.message}\n`));
      return false;
    }
  }

  /**
   * 🎮 确认时间旅行系统就绪（惰性提示）
   */
  private ensureTimeTravelReady(): boolean {
    if (!this.timeTravel) {
      console.log(chalk.yellow('\n⚠️  Save/branch system not ready yet (memory system initializing).'));
      console.log(chalk.gray('Wait a moment and try again.\n'));
      return false;
    }
    return true;
  }

  /**
   * Handle /next - MCTS 探索推荐（AlphaZero PUCT）
   *
   * 展示当前决策点各选项的 Q/N/先验与综合分，
   * 平衡利用（高 Q 已知好路线）与探索（低 N 未试路线）。
   */
  private async handleNextCommand(args: string[]): Promise<void> {
    if (!this.ensureTimeTravelReady()) return;

    try {
      const branchTree = this.timeTravel!.getBranchTreeManager();
      const sessionId = this.branchSessionId;
      const nodeId = args[0]; // 可选：指定决策节点
      const rec = await branchTree.getRecommendation(sessionId, nodeId);

      if (!rec) {
        console.log(chalk.yellow('\n🎲 No decision point with options yet.'));
        console.log(chalk.gray('Run a /plan task first — choices get recorded automatically.\n'));
        return;
      }

      console.log(chalk.cyan('\n🎲 MCTS Exploration Recommendation (AlphaZero PUCT)'));
      console.log(chalk.cyan('═'.repeat(60)));
      console.log(chalk.gray(`Decision: "${rec.node.prompt}"`));
      console.log(chalk.gray(`Tried: ${rec.node.visits ?? 0}x\n`));

      for (const r of rec.ranked) {
        const prior = r.option.stats?.prior !== undefined
          ? chalk.gray(` P=${r.option.stats.prior.toFixed(2)}`)
          : '';
        const qText = r.n > 0 ? r.q.toFixed(2) : '—';
        console.log(
          `  ${chalk.white(`score ${r.score.toFixed(2)}`)}  ` +
          `${chalk.cyan(r.option.label)}  ` +
          chalk.gray(`Q=${qText} N=${r.n}`) + prior
        );
      }

      console.log(chalk.cyan('─'.repeat(60)));
      if (rec.exploit && rec.explore) {
        console.log(chalk.green(`⭐ Best known: ${rec.exploit.option.label} (Q=${rec.exploit.q.toFixed(2)})`));
        console.log(chalk.magenta(`🔭 Worth exploring: ${rec.explore.option.label} (untried)`));
      } else if (rec.exploit) {
        console.log(chalk.green(`⭐ Best known: ${rec.exploit.option.label} (Q=${rec.exploit.q.toFixed(2)})`));
      } else if (rec.explore) {
        console.log(chalk.magenta(`🔭 Nothing settled yet — start with: ${rec.explore.option.label}`));
      }

      console.log(chalk.gray('\nThis recommendation is also injected into plan generation.'));
      console.log(chalk.gray('Use /back-to <decision-id> to rewind and try another option.'));
      console.log(chalk.cyan('═'.repeat(60)) + '\n');
    } catch (error: any) {
      console.log(chalk.red(`\n❗ Recommendation failed: ${error.message}\n`));
    }
  }

  /**
   * Handle /skills command - Show available skills
   */
  private handleSkillsCommand(): void {
    console.log(chalk.cyan('\n🎯 Available Skills'));
    console.log(chalk.cyan('═'.repeat(60)));

    // 1. Show Agents
    console.log(chalk.yellow(`\n🤖 Agents (4)`));
    console.log(chalk.gray('─'.repeat(60)));

    const agents = [
      {
        name: 'Frontend Agent',
        id: 'frontend',
        description: 'Handles UI/UX tasks, components, styling',
        capabilities: ['frontend', 'design'],
        status: 'idle',
      },
      {
        name: 'Backend Agent',
        id: 'backend',
        description: 'Handles API, server logic, databases',
        capabilities: ['backend', 'database'],
        status: 'idle',
      },
      {
        name: 'Testing Agent',
        id: 'testing',
        description: 'Handles test writing and execution',
        capabilities: ['testing'],
        status: 'idle',
      },
      {
        name: 'Documentation Agent',
        id: 'documentation',
        description: 'Handles documentation and comments',
        capabilities: ['documentation'],
        status: 'idle',
      },
    ];

    agents.forEach(agent => {
      console.log(`  ${chalk.white(agent.name)} ${chalk.gray(`[${agent.id}]`)}`);
      console.log(`    ${chalk.gray(agent.description)}`);
      const caps = agent.capabilities.join(', ');
      console.log(`    ${chalk.cyan('Capabilities:')} ${chalk.white(caps)}`);
      console.log(`    ${chalk.cyan('Status:')} ${chalk.green(agent.status)}`);
      console.log('');
    });

    // 2. Show Tools
    if (this.toolExecutor) {
      const tools = this.toolExecutor.getRegistry().list();
      console.log(chalk.yellow(`\n🔧 Tools (${tools.length})`));
      console.log(chalk.gray('─'.repeat(60)));

      // Group by category
      const grouped = new Map<string, typeof tools>();
      for (const tool of tools) {
        const cat = tool.category || 'general';
        if (!grouped.has(cat)) {
          grouped.set(cat, []);
        }
        grouped.get(cat)!.push(tool);
      }

      grouped.forEach((tools, category) => {
        console.log(`  ${chalk.white(category.toUpperCase())}`);
        tools.forEach(tool => {
          console.log(`    ${chalk.green(tool.name)}: ${chalk.gray(tool.description)}`);
        });
        console.log('');
      });
    } else {
      console.log(chalk.yellow(`\n🔧 Tools`));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(chalk.gray('  Tool system not enabled'));
      console.log(chalk.gray('  Enable with: /set useTools true'));
    }

    // 3. Show Commands
    console.log(chalk.yellow(`\n📝 Commands`));
    console.log(chalk.gray('─'.repeat(60)));

    const commands = [
      { name: '/help', desc: 'Show available commands', aliases: ['?', 'h'] },
      { name: '/skills', desc: 'Show available skills (agents, tools, plugins)', aliases: [] },
      { name: '/status', desc: 'Show session status', aliases: [] },
      { name: '/history', desc: 'Show command history', aliases: [] },
      { name: '/clear', desc: 'Clear the screen', aliases: ['cls'] },
      { name: '/exit', desc: 'Exit the session', aliases: ['quit', 'q'] },
      { name: '/time', desc: 'Show current time', aliases: [] },
      { name: '/plan', desc: 'Plan a task (FFT/ToT)', aliases: [] },
      { name: '/do', desc: 'Execute a task', aliases: [] },
      { name: '/loop', desc: 'Plan → Execute → Verify loop', aliases: [] },
      { name: '/chat', desc: 'Chat mode (casual conversation)', aliases: [] },
      { name: '/set', desc: 'Set configuration options', aliases: [] },
      { name: '/fft', desc: 'FFT planning mode', aliases: [] },
      { name: '/landmark', desc: 'Landmark planning mode', aliases: [] },
      { name: '/ultrathink', desc: 'Toggle ultrathink mode', aliases: [] },
      { name: '/modes', desc: 'Show all execution modes', aliases: [] },
      { name: '/tasks', desc: 'Show task history', aliases: [] },
      { name: '/resume', desc: 'Resume command history', aliases: [] },
      { name: '/undo', desc: 'Undo last git commit', aliases: [] },
      { name: '/diff', desc: 'Show git diff', aliases: [] },
      { name: '/preset', desc: 'Manage configuration presets', aliases: [] },
      { name: '/init', desc: 'Initialize newma config', aliases: [] },
      { name: '/plugin-list', desc: 'List installed plugins', aliases: [] },
      { name: '/create-plugin', desc: 'Create a new plugin', aliases: [] },
    ];

    commands.forEach(cmd => {
      const aliasText = cmd.aliases.length > 0 ? chalk.gray(` (${cmd.aliases.join(', ')})`) : '';
      console.log(`  ${chalk.green(cmd.name)}${aliasText}: ${chalk.gray(cmd.desc)}`);
    });

    // 4. Show Plugins (if any)
    if (this.pluginSystem) {
      console.log(chalk.yellow(`\n🔌 Plugins`));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(chalk.gray('  Plugin system enabled'));
      console.log(chalk.gray('  Use /plugin-list to see installed plugins'));
    }

    console.log(chalk.cyan('═'.repeat(60)) + '\n');
  }

  /**
   * 使用策略执行器执行需求
   * 🚀 新方法：策略模式版本
   */
  private async executeWithStrategy(
    requirement: string,
    projectInfo: Record<string, string>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 构建执行上下文
      const context: any = {
        requirement,
        mode: this.determineExecutionMode(),
        config: this.session.getConfig(),
        session: this.session,
        signal: this.getAbortSignal(),
        // 附加上下文
        projectInfo,
        projectRoot: this.session.getProjectRoot(),
      };

      // 使用策略执行器
      const result = await this.strategyExecutor.execute(context);

      return {
        success: result.success,
        error: result.error,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Strategy execution failed: ${error.message}`,
      };
    }
  }

  /**
   * 判断执行模式
   */
  private determineExecutionMode(): any {
    const config = this.session.getConfig();
    const executionMode = config.executionMode || 'standard';

    // 映射到 ExecutionMode 枚举
    const modeMap: Record<string, any> = {
      'subagent': 'sub-agent',
      'multi-agent': 'multi-agent',
      'function-calling': 'function-calling',
      'fft': 'fft',
      'state-machine': 'state-machine',
      'standard': 'standard',
    };

    return modeMap[executionMode] || 'standard';
  }

  /**
   * Execute requirement using Function Calling API
   * This implements multi-turn conversation with tool execution
   */
  private async executeWithFunctionCalling(
    requirement: string,
    projectInfo: Record<string, string>
  ): Promise<void> {
    if (!this.toolExecutor) {
      console.log(chalk.red('❌ Tool executor not available\n'));
      return;
    }

    const config = this.session.getConfig();
    const registry = this.toolExecutor.getRegistry();

    // Initialize message history
    const history: any[] = [];

    let iteration = 0;
    const MAX_ITERATIONS = 10;

    while (iteration < MAX_ITERATIONS) {
      iteration++;
      console.log(chalk.gray(`\n[迭代 ${iteration}] 调用 AI...\n`));

      // 创建 AbortController
      this.currentAbortController = new AbortController();

      const iterStart = Date.now(); // 性能监控：迭代开始

      try {
        // Call AI with Function Calling
        const aiResp = await callAIWithFunctionCalling(
          config,
          projectInfo,
          requirement,
          history,
          registry,
          this.getAbortSignal()
        );

        const iterDuration = Date.now() - iterStart; // 性能监控：迭代耗时
        console.log(chalk.gray(`⏱️  [Function Calling] 迭代 ${iteration} 耗时: ${iterDuration}ms\n`));

        this.resetAbortController();

        // Handle tool_calls response
        if (aiResp.type === 'tool_calls' && aiResp.toolCalls) {
          console.log(chalk.cyan(`🔧 AI 调用了 ${aiResp.toolCalls.length} 个工具\n`));

          // Add assistant message with tool_calls
          history.push({
            role: 'assistant',
            tool_calls: aiResp.toolCalls,
            content: null,
          });

          // Execute all tool calls
          const toolResults = await Promise.all(
            aiResp.toolCalls.map(async (call: any) => {
              const toolName = chalk.cyan(call.function.name);
              console.log(`  ⚙️  [${toolName}] ${call.function.arguments}`);

              const args = JSON.parse(call.function.arguments);
              const result = await this.toolExecutor!.executeToolCall({
                tool: call.function.name,
                parameters: args,
                id: call.id,
              });

              if (result.success) {
                console.log(chalk.green(`  ✅ [${toolName}] 成功`));
                // Truncate long output
                const output = result.output?.slice(0, 200) || 'Done';
                if ((result.output?.length || 0) > 200) {
                  console.log(chalk.gray(`  📄 ${output}... (truncated)`));
                } else {
                  console.log(chalk.gray(`  📄 ${output}`));
                }
              } else {
                console.log(chalk.red(`  ❌ [${toolName}] 失败: ${result.error}`));
              }

              // Return tool result message
              return {
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify(result),
              };
            })
          );

          // Add all tool results to history
          history.push(...toolResults);

          // Continue loop to let AI decide next step
          console.log(chalk.gray('\n✅ 工具执行完成，继续...\n'));
          continue;
        }

        // Handle text response (final answer or error)
        if (aiResp.type === 'text' || aiResp.type === 'error') {
          console.log(chalk.gray('\n' + '─'.repeat(50)));
          console.log(chalk.cyan('📝 AI 响应：\n'));

          if (aiResp.type === 'error') {
            console.log(chalk.yellow(aiResp.message || 'Unknown error'));
          } else {
            console.log(aiResp.content || 'No content');
          }

          console.log(chalk.gray('\n' + '─'.repeat(50)) + '\n');

          // Add assistant message to history
          if (aiResp.content) {
            history.push({
              role: 'assistant',
              content: aiResp.content,
            });
          }

          // Check if task is done
          if (aiResp.done) {
            console.log(chalk.green('✅ 任务完成！\n'));
          }

          break;
        }

      } catch (error: any) {
        this.resetAbortController();

        // Check for abort error
        if (error.name === 'AbortError' || error.message?.includes('abort')) {
          console.log(chalk.yellow('\n⚠️  执行被取消.\n'));
          return;
        }

        console.error(chalk.red('❌ Function Calling error:'), error.message);
        console.error(chalk.gray(error.stack));
        break;
      }
    }

    if (iteration >= MAX_ITERATIONS) {
      console.log(chalk.yellow(`⚠️  达到最大迭代次数 (${MAX_ITERATIONS})，终止循环\n`));
    }

    console.log(chalk.gray(`⏱️  [Function Calling] 总迭代次数: ${iteration}\n`));
  }

  /**
   * Execute requirement using Multi-Agent system
   * Uses specialized agents (Frontend, Backend, Testing, Documentation)
   * Tasks are decomposed and assigned to appropriate agents
   */
  private async executeWithMultiAgent(
    requirement: string,
    projectInfo: Record<string, string>
  ): Promise<void> {
    if (!this.toolExecutor) {
      console.log(chalk.red('❌ Tool executor not available\n'));
      return;
    }

    const { AgentCoordinator } = await import('./agents/coordinator');
    const config = this.session.getConfig();

    console.log(chalk.cyan('\n🤖 Multi-Agent System Enabled'));
    console.log(chalk.gray('═'.repeat(50)));
    console.log(chalk.gray(`Requirement: ${requirement}`));
    console.log(chalk.gray('═'.repeat(50)));

    try {
      // Create coordinator
      const coordinator = new AgentCoordinator(
        this.toolExecutor,
        this.session.getTracker(),
        this.rollbackManager,
        config,
        this.session.getProjectRoot()
      );

      // Show available agents
      const agents = coordinator.getAllAgents();
      console.log(chalk.gray(`\n📋 Available Agents: ${agents.length}`));
      agents.forEach(agent => {
        console.log(chalk.gray(`  • ${agent.name}: ${agent.capabilities.join(', ')}`));
      });
      console.log('');

      // Plan decomposition
      const plan = await coordinator.planDecomposition(requirement);

      console.log(chalk.magenta('\n📊 Task Decomposition:'));
      console.log(chalk.magenta('─'.repeat(50)));
      console.log(chalk.gray(`Tasks: ${plan.tasks.length}`));
      console.log(chalk.gray(`Estimated iterations: ${plan.estimatedIterations}`));

      // Show tasks
      plan.tasks.forEach((task, idx) => {
        const num = idx + 1;
        const priorityColor = task.priority === 'high' ? chalk.red :
                            task.priority === 'medium' ? chalk.yellow : chalk.green;
        console.log(chalk.gray(`\n${num}. ${task.description}`));
        console.log(chalk.gray(`   Priority: ${priorityColor(task.priority)}`));
        console.log(chalk.gray(`   Capabilities: ${task.capabilities.join(', ')}`));
        if (task.dependencies.length > 0) {
          console.log(chalk.gray(`   Dependencies: ${task.dependencies.join(', ')}`));
        }
      });

      console.log(chalk.magenta('\n' + '─'.repeat(50)));

      // Confirm execution
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Execute this multi-agent plan?',
          default: true,
        },
      ]);

      if (!confirm) {
        console.log(chalk.yellow('\n⚠️  Multi-agent execution cancelled by user.\n'));
        return;
      }

      // Execute plan
      const results = await coordinator.executePlan(plan, requirement);

      // Display results
      console.log(chalk.cyan('\n🎉 Multi-Agent Execution Completed!'));
      console.log(chalk.gray('═'.repeat(50)));

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      console.log(chalk.gray(`\nTotal tasks: ${results.length}`));
      console.log(chalk.green(`Successful: ${successful}`));
      if (failed > 0) {
        console.log(chalk.red(`Failed: ${failed}`));
      }

      if (failed === 0) {
        console.log(chalk.green('\n✅ All tasks completed successfully!\n'));
      } else {
        console.log(chalk.yellow('\n⚠️  Some tasks failed. You can continue iterating.\n'));
      }
    } catch (error: any) {
      console.error(chalk.red('\n❌ Multi-agent execution failed:'), error.message);
      console.log(chalk.gray('\nFalling back to standard mode...\n'));
    }
  }

  /**
   * Execute requirement using SubAgent system
   * Phase 1: PlanningSubAgent (read-only tools)
   * Phase 2: ExecutionSubAgent (all tools)
   */
  private async executeWithSubAgent(
    requirement: string,
    projectInfo: Record<string, string>,
    options?: { skipConfirmation?: boolean }
  ): Promise<void> {
    if (!this.toolExecutor) {
      console.log(chalk.red('❌ Tool executor not available\n'));
      return;
    }

    const { SubAgentCoordinator } = await import('./agents/subagent');

    // Create SubAgent context
    const context = {
      projectRoot: this.session.getProjectRoot(),
      projectInfo,
      config: this.session.getConfig(),
      toolRegistry: this.toolExecutor.getRegistry(),
      toolExecutor: this.toolExecutor,
      signal: this.getAbortSignal(),
    };

    // Create coordinator and execute
    const coordinator = new SubAgentCoordinator(context);
    const result = await coordinator.execute(requirement, options);

    // Display final summary
    if (result.planningResult.success && result.executionResult?.success) {
      console.log(chalk.green('\n✅ SubAgent execution completed successfully!\n'));
    } else {
      console.log(chalk.yellow('\n⚠️  SubAgent execution completed with issues\n'));
    }

    console.log(chalk.gray(`Total duration: ${result.totalDuration}ms\n`));
  }

  /**
   * Execute requirement using FFT Planner with State Machine (Phase 7.1 Enhanced)
   * Fast planning with interactive navigation for complex tasks
   */
  private async executeWithFFTPlanner(
    requirement: string,
    projectInfo: Record<string, string>
  ): Promise<void> {
    const config = this.session.getConfig();

    // Get user profile if available
    const userProfile = await this.session.getUserProfile();

    console.log(chalk.gray('─'.repeat(50)));

    try {
      // Step 1: Generate plan using FFT
      const fftResult = await generateFFTPlan(
        config,
        requirement,
        projectInfo,
        userProfile || undefined
      );

      console.log(chalk.gray(`⏱️  FFT Analysis: ${fftResult.analysisTime}ms\n`));

      // Step 2: Handle based on complexity
      if (fftResult.complexity === 'simple' && fftResult.plan) {
        // Simple task: execute directly (no state machine needed)
        console.log(chalk.green('✅ Simple task detected - executing single plan\n'));
        await this.executeFFTPlan(fftResult.plan);

      } else if (fftResult.complexity === 'complex' && fftResult.options) {
        // Complex task: use state machine for interactive navigation
        console.log(chalk.cyan('💡 Complex task detected - entering interactive planning\n'));

        await this.executeWithStateMachine(requirement, projectInfo, fftResult, userProfile);
      } else {
        console.log(chalk.yellow('\n⚠️  FFT planner returned invalid result\n'));
      }

    } catch (error: any) {
      console.log(chalk.red(`❌ FFT planning error: ${error.message}\n`));

      // Fallback to standard planning
      console.log(chalk.gray('Falling back to standard planning...\n'));
      // Continue with standard mode (will be caught by existing logic)
    }
  }

  /**
   * Execute with state machine - interactive navigation for complex tasks
   */
  private async executeWithStateMachine(
    requirement: string,
    projectInfo: Record<string, string>,
    initialFftResult: any,
    userProfile?: string
  ): Promise<void> {
    // Create state machine
    const stateMachine = createPlanStateMachine(requirement, projectInfo);
    stateMachine.updateContext({
      fftResult: initialFftResult,
      allOptions: initialFftResult.options,
    });

    // Initial state: OPTION_SELECTION
    stateMachine.setState(PlanState.OPTION_SELECTION);

    // State machine loop
    let currentState = stateMachine.getState();

    while (currentState !== PlanState.EXECUTING &&
           currentState !== PlanState.CANCELLED &&
           currentState !== PlanState.COMPLETED) {

      switch (currentState) {
        case PlanState.OPTION_SELECTION:
          await this.handleOptionSelectionState(stateMachine);
          break;

        case PlanState.PLAN_CONFIRMATION:
          await this.handlePlanConfirmationState(stateMachine);
          break;

        case PlanState.ANALYZING:
          // Regenerating options
          await this.handleRegenerateState(stateMachine, userProfile);
          break;

        default:
          console.log(chalk.yellow(`\n⚠️  Unknown state: ${currentState}\n`));
          stateMachine.setState(PlanState.CANCELLED);
          break;
      }

      // Update current state
      currentState = stateMachine.getState();
    }

    // Execute if confirmed
    const result = stateMachine.getResult();
    if (result.planToExecute && !result.cancelled) {
      await this.executeFFTPlan(result.planToExecute);
    } else if (result.cancelled) {
      console.log(chalk.yellow('\n⚠️  计划已取消\n'));
    }
  }

  /**
   * Handle OPTION_SELECTION state
   */
  private async handleOptionSelectionState(stateMachine: PlanStateMachine): Promise<void> {
    const context = stateMachine.getContext();
    const options = context.allOptions;

    if (!options || options.length === 0) {
      console.log(chalk.yellow('\n⚠️  没有可用的选项\n'));
      stateMachine.setState(PlanState.CANCELLED);
      return;
    }

    // Prompt user to select an option (with navigation support)
    const selectedOption = await this.promptUserForPlanOptionWithNavigation(options);

    if (!selectedOption) {
      // User wants to navigate - show navigation menu
      const action = await stateMachine.promptNavigation();

      const transition = await stateMachine.transition(action);

      if (transition.shouldExit) {
        stateMachine.setState(PlanState.CANCELLED);
      } else {
        stateMachine.setState(transition.nextState);
      }
    } else {
      // User selected an option
      stateMachine.updateContext({ selectedOption });
      stateMachine.setState(PlanState.PLAN_CONFIRMATION);
    }
  }

  /**
   * Handle PLAN_CONFIRMATION state
   */
  private async handlePlanConfirmationState(stateMachine: PlanStateMachine): Promise<void> {
    // Display plan confirmation
    stateMachine.displayPlanConfirmation();

    // Prompt for navigation
    const action = await stateMachine.promptNavigation();

    const transition = await stateMachine.transition(action);

    if (transition.shouldExit) {
      stateMachine.setState(PlanState.CANCELLED);
    } else if (transition.nextState === PlanState.EXECUTING) {
      // User confirmed execution
      stateMachine.setState(PlanState.EXECUTING);
    } else {
      // Navigate to another state
      stateMachine.setState(transition.nextState);
    }
  }

  /**
   * Handle REGENERATE state (go back to analyzing)
   */
  private async handleRegenerateState(
    stateMachine: PlanStateMachine,
    userProfile?: string
  ): Promise<void> {
    const config = this.session.getConfig();
    const context = stateMachine.getContext();

    console.log(chalk.cyan('\n🔄 重新生成方案选项...\n'));

    try {
      // Generate new options
      const newFftResult = await generateFFTPlan(
        config,
        context.requirement,
        context.projectInfo,
        userProfile || undefined
      );

      if (newFftResult.complexity === 'complex' && newFftResult.options) {
        console.log(chalk.gray(`⏱️  FFT Analysis: ${newFftResult.analysisTime}ms\n`));

        // Update context with new options
        stateMachine.updateContext({
          fftResult: newFftResult,
          allOptions: newFftResult.options,
          selectedOption: undefined,  // Clear previous selection
        });

        // Go to option selection
        stateMachine.setState(PlanState.OPTION_SELECTION);
      } else {
        console.log(chalk.yellow('\n⚠️  重新生成失败，使用原有选项\n'));
        stateMachine.setState(PlanState.OPTION_SELECTION);
      }
    } catch (error: any) {
      console.log(chalk.red(`❌ 重新生成失败: ${error.message}\n`));
      console.log(chalk.gray('使用原有选项...\n'));
      stateMachine.setState(PlanState.OPTION_SELECTION);
    }
  }

  /**
   * Execute a single FFT plan
   */
  private async executeFFTPlan(plan: FFTPlanOption): Promise<void> {
    console.log(chalk.cyan('\n📋 Execution Plan'));
    console.log(chalk.cyan('─'.repeat(50)));
    console.log(chalk.white(`Plan: ${plan.name}`));
    console.log(chalk.gray(plan.description));
    console.log(chalk.gray(`⏱️  Estimated: ${plan.estimatedTime}ms`));
    console.log(chalk.gray(`⚠️  Risk: ${plan.riskLevel}`));
    console.log(chalk.gray(`Confidence: ${(plan.confidence * 100).toFixed(0)}%`));

    if (plan.pros.length > 0 || plan.cons.length > 0) {
      console.log(chalk.gray('\n📊 Analysis:'));
      if (plan.pros.length > 0) {
        console.log(chalk.green('  ✅ ' + plan.pros.join('\n  ✅ ')));
      }
      if (plan.cons.length > 0) {
        console.log(chalk.yellow('  ❌ ' + plan.cons.join('\n  ❌ ')));
      }
    }

    console.log(chalk.cyan('─'.repeat(50)) + '\n');

    // Convert FFT actions to standard actions and execute
    const projectRoot = this.session.getProjectRoot();

    if (plan.actions.length === 0) {
      console.log(chalk.yellow('⚠️  No actions to execute\n'));
      return;
    }

    console.log(chalk.gray(`Executing ${plan.actions.length} actions...\n`));

    for (const action of plan.actions) {
      try {
        await this.executeFFTAction(action, projectRoot);
      } catch (error: any) {
        console.log(chalk.red(`❌ Action failed: ${error.message}\n`));
        // Continue with next action
      }
    }

    console.log(chalk.green('\n✅ Plan execution completed!\n'));
  }

  /**
   * Execute a single FFT action
   */
  private async executeFFTAction(action: any, projectRoot: string): Promise<void> {
    // Convert FFT action to standard action format
    const standardAction: Action = {
      type: action.type,
      path: action.path,
      content: action.content,
      oldContent: action.oldContent,
      newContent: action.newContent,
      command: action.command,
    };

    await this.toolExecutor.executeAction(standardAction, this.rollbackManager);
  }

  /**
   * Prompt user to select from multiple plan options
   */
  private async promptUserForPlanOption(options: FFTPlanOption[]): Promise<FFTPlanOption | null> {
    console.log(chalk.cyan('📊 Multiple Implementation Options'));
    console.log(chalk.cyan('═'.repeat(60)));

    // Display options
    options.forEach((option, idx) => {
      const num = idx + 1;
      const strategyColor =
        option.strategy === 'conservative' ? chalk.green :
        option.strategy === 'aggressive' ? chalk.red :
        chalk.yellow;

      const riskColor =
        option.riskLevel === 'low' ? chalk.green :
        option.riskLevel === 'high' ? chalk.red :
        chalk.yellow;

      console.log(chalk.white(`\n  [${num}] ${strategyColor(option.name)}`));
      console.log(chalk.gray(`      ${option.description}`));
      console.log(chalk.gray(`      ⏱️  ${option.estimatedTime}ms  │  ${riskColor(`Risk: ${option.riskLevel}`)}  │  Confidence: ${(option.confidence * 100).toFixed(0)}%`));

      if (option.pros.length > 0) {
        console.log(chalk.green('      ✅ ' + option.pros.join('  | ')));
      }
      if (option.cons.length > 0) {
        console.log(chalk.yellow('      ❌ ' + option.cons.join('  | ')));
      }
    });

    console.log(chalk.cyan('\n' + '═'.repeat(60)));

    // Prompt user
    const { choice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message: '请选择实施方案 (Select implementation option):',
        choices: options.map((opt, idx) => ({
          name: `[${idx + 1}] ${opt.name} (${opt.estimatedTime / 1000}s, ${opt.riskLevel} risk)`,
          value: idx,
        })),
        default: options.length - 1, // Default to last option (usually balanced)
      },
    ]);

    const selected = options[choice];
    console.log(chalk.green(`\n✅ Selected: ${selected.name}\n`));

    return selected;
  }

  /**
   * Display plan options without prompting for selection
   * Used by state machine for separate display and selection
   */
  private displayPlanOptions(options: FFTPlanOption[]): void {
    console.log(chalk.cyan('📊 Multiple Implementation Options'));
    console.log(chalk.cyan('═'.repeat(60)));

    // Display options
    options.forEach((option, idx) => {
      const num = idx + 1;
      const strategyColor =
        option.strategy === 'conservative' ? chalk.green :
        option.strategy === 'aggressive' ? chalk.red :
        chalk.yellow;

      const riskColor =
        option.riskLevel === 'low' ? chalk.green :
        option.riskLevel === 'high' ? chalk.red :
        chalk.yellow;

      console.log(chalk.white(`\n  [${num}] ${strategyColor(option.name)}`));
      console.log(chalk.gray(`      ${option.description}`));
      console.log(chalk.gray(`      ⏱️  ${option.estimatedTime}ms  │  ${riskColor(`Risk: ${option.riskLevel}`)}  │  Confidence: ${(option.confidence * 100).toFixed(0)}%`));

      if (option.pros.length > 0) {
        console.log(chalk.green('      ✅ ' + option.pros.join('  | ')));
      }
      if (option.cons.length > 0) {
        console.log(chalk.yellow('      ❌ ' + option.cons.join('  | ')));
      }
    });

    console.log(chalk.cyan('\n' + '═'.repeat(60)));
  }

  /**
   * Prompt user to select from multiple plan options with navigation support
   * Returns null if user selects navigation (instead of an option)
   */
  private async promptUserForPlanOptionWithNavigation(options: FFTPlanOption[]): Promise<FFTPlanOption | null> {
    console.log(chalk.cyan('📊 Multiple Implementation Options'));
    console.log(chalk.cyan('═'.repeat(60)));

    // Display options
    options.forEach((option, idx) => {
      const num = idx + 1;
      const strategyColor =
        option.strategy === 'conservative' ? chalk.green :
        option.strategy === 'aggressive' ? chalk.red :
        chalk.yellow;

      const riskColor =
        option.riskLevel === 'low' ? chalk.green :
        option.riskLevel === 'high' ? chalk.red :
        chalk.yellow;

      console.log(chalk.white(`\n  [${num}] ${strategyColor(option.name)}`));
      console.log(chalk.gray(`      ${option.description}`));
      console.log(chalk.gray(`      ⏱️  ${option.estimatedTime}ms  │  ${riskColor(`Risk: ${option.riskLevel}`)}  │  Confidence: ${(option.confidence * 100).toFixed(0)}%`));

      if (option.pros.length > 0) {
        console.log(chalk.green('      ✅ ' + option.pros.join('  | ')));
      }
      if (option.cons.length > 0) {
        console.log(chalk.yellow('      ❌ ' + option.cons.join('  | ')));
      }
    });

    console.log(chalk.cyan('\n' + '═'.repeat(60)));

    // Build choices with navigation options
    const choices = [
      ...options.map((opt, idx) => ({
        name: `[${idx + 1}] ${opt.name} (${opt.estimatedTime / 1000}s, ${opt.riskLevel} risk)`,
        value: idx,
      })),
      new inquirer.Separator(chalk.gray('─'.repeat(60))),
      { name: '🔄 重新生成选项', value: 'regenerate' },
      { name: '❌ 退出', value: 'exit' },
    ];

    // Prompt user
    const { choice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message: '请选择实施方案 (Select implementation option):',
        choices,
        default: options.length - 1, // Default to last option (usually balanced)
      },
    ]);

    // Check if user selected navigation
    if (choice === 'regenerate' || choice === 'exit') {
      return null;  // Signal to handle navigation
    }

    const selected = options[choice as number];
    console.log(chalk.green(`\n✅ Selected: ${selected.name}\n`));

    return selected;
  }

  /**
   * 执行用户需求（策略模式版本）
   */
  private async executeRequirement(requirement: string): Promise<void> {
    // 🔥 状态追踪：进入规划阶段
    this.stateTracker.enterPlanning('Starting requirement execution');

    console.log(chalk.cyan('\n─────────────────────────────────────────────────────'));
    console.log(chalk.white(`🎯 Processing: ${requirement}`));
    console.log(chalk.cyan('─────────────────────────────────────────────────────\n'));

    const projectRoot = this.session.getProjectRoot();
    const projectInfo = await scanDirectory(projectRoot, {
      listOnly: true,  // 轻量级模式：只返回文件列表
      maxFiles: 3      // 进一步限制文件数量（从 5 降到 3）
      // listOnly 模式下不会读取文件内容，所以不需要 maxLinesPerFile
    });
    const mode = this.session.getCurrentMode();
    const config = this.session.getConfig();

    // 🚀 新增：使用策略执行器（如果启用）
    if (config.useStrategy !== false) {
      try {
        console.log(chalk.gray('📌 [Strategy Mode] 使用策略执行器\n'));

        const result = await this.executeWithStrategy(requirement, projectInfo);

        if (result.success) {
          return; // 策略执行成功，直接返回
        } else {
          console.log(chalk.yellow(`⚠️  策略执行失败: ${result.error}`));
          console.log(chalk.yellow('🔄 回退到传统执行模式...\n'));
          // 继续执行传统模式
        }
      } catch (error: any) {
        console.log(chalk.red(`❌ 策略执行器异常: ${error.message}`));
        console.log(chalk.yellow('🔄 回退到传统执行模式...\n'));
        // 继续执行传统模式
      }
    }

    // 原有的执行逻辑（保持向后兼容）
    const executionMode = config.executionMode || 'standard';

    // Priority 1: Check explicit execution modes (SubAgent, Two-Phase, Multi-Agent)
    // These modes have priority over generic Function Calling
    if (executionMode === 'subagent') {
      console.log(chalk.cyan('🤖 SubAgent Mode Enabled\n'));
      await this.executeWithSubAgent(requirement, projectInfo, { skipConfirmation: false });
      return;
    } else if (executionMode === 'two-phase') {
      // DEPRECATED: Map to SubAgent with confirmation
      console.log(chalk.cyan('🎭 Two-Phase Mode Enabled (using SubAgent backend)\n'));
      await this.executeWithSubAgent(requirement, projectInfo, { skipConfirmation: false });
      return;
    } else if (executionMode === 'multi-agent') {
      // DEPRECATED: Use Multi-Agent system
      console.log(chalk.cyan('🤖 Multi-Agent Mode Enabled\n'));
      await this.executeWithMultiAgent(requirement, projectInfo);
      return;
    } else if (executionMode === 'function-calling') {
      console.log(chalk.cyan('🔧 Function Calling Mode Enabled\n'));
      await this.executeWithFunctionCalling(requirement, projectInfo);
      return;
    }

    // Priority 2: Function Calling mode (auto-enabled when tools are available)
    // Enable if: explicitly configured OR --use-tools is enabled
    if ((config.functionCallingEnabled || this.session.isToolEnabled()) && this.toolExecutor) {
      console.log(chalk.cyan('🔧 Function Calling API Enabled\n'));
      await this.executeWithFunctionCalling(requirement, projectInfo);
      return;
    }

    // Priority 2.5: FFT Planning (NEW: Phase 7.1)
    // Use FFT planner for planning mode when ultrathink is NOT enabled
    // This provides fast planning (1-5s) vs. ToT (10-30s)
    if (mode === 'plan' && !this.session.isUltrathinkEnabled()) {
      console.log(chalk.cyan('⚡ FFT Planning Mode (Fast and Frugal)\n'));
      await this.executeWithFFTPlanner(requirement, projectInfo);
      return;
    }

    // Priority 3: Standard mode (default)
    // Continue to existing implementation below
    // Note: When ultrathink is enabled, ToT will be used via ultrathinkOptions above

    // Max-iteration safety check for verify mode
    const MAX_ITERATIONS = 5;
    if (mode === 'verify' && this.session.getIterationCount() >= MAX_ITERATIONS) {
      console.log(chalk.yellow(`⚠️  Maximum iterations (${MAX_ITERATIONS}) reached.`));
      console.log(chalk.gray('Use /mode plan to start fresh or /mode reset to continue.\n'));
      return;
    }

    // 创建 AbortController 用于中断
    this.currentAbortController = new AbortController();

    try {
      // 调用 AI
      // Start loading spinner before AI call
      const spinner = createSpinner('Thinking...');
      spinner.start();

      // In verify mode, include execution history
      const history = mode === 'verify' ? this.session.getTracker().getHistory() : undefined;

      // Get user profile if available
      const userProfile = await this.session.getUserProfile();

      // Prepare ultrathink options if enabled
      const ultrathinkOptions = this.session.isUltrathinkEnabled() && mode === 'plan' ? {
        enabled: true,
        numAlternatives: 3,  // OPTIMIZED: 减少从 7 到 3，提升速度
        searchStrategy: 'beam' as const,  // OPTIMIZED: 从 bfs 改为 beam，更快
        maxDepth: 4,         // OPTIMIZED: 减少从 6 到 4，减少搜索深度
        beamWidth: 3,        // OPTIMIZED: 减少从 5 到 3，减少分支宽度
        showThoughts: true,
        showRejected: false,
      } : undefined;

      const aiResp = await callAI(
        this.session.getConfig(),
        projectInfo,
        requirement,
        mode,
        history,
        this.toolExecutor?.getRegistry(), // 修复:传递完整的 ToolRegistry
        undefined, // grantedPermissions
        undefined, // compression
        projectRoot,
        this.getAbortSignal(), // 传递 signal
        ultrathinkOptions, // ultrathink configuration
        userProfile || undefined, // user profile
        undefined, // hookSystem
        this.memoPlugin // 🔥 memo plugin for memory context
      );

      // Stop spinner after AI call completes
      spinner.stop();
      console.log(''); // Add newline after spinner

      this.resetAbortController();

      // Display timing and token usage if ultrathink is enabled
      if (this.session.isUltrathinkEnabled()) {
        this.displayAIRequestInfo(aiResp, requirement);
      }

      // Use ReAct for verification if ultrathink is enabled in verify mode
      if (mode === 'verify' && this.session.isUltrathinkEnabled()) {
        console.log(chalk.cyan('\n🔄 Pre-execution ReAct verification...\n'));

        // 获取之前的执行历史（不包括当前的 aiResp）
        const previousHistory = this.session.getTracker().getHistory();

        // 只有在有之前执行历史时才验证
        if (previousHistory.length > 0) {
          // 重新扫描项目以获取当前状态（轻量级模式）
          const projectInfo = await scanDirectory(projectRoot, {
            listOnly: true,
            maxFiles: 5
          });

          const verifyResult = await verifyWithReAct(
            this.session.getConfig(),
            projectInfo,
            requirement,
            previousHistory,
            3 // max iterations (fewer for pre-execution check)
          );

          if (verifyResult.satisfied) {
            console.log(chalk.green('\n✅ Requirement satisfied!'));
            console.log(chalk.gray('ReAct verification confirmed all tasks completed.\n'));

            // Reset to plan mode for next requirement
            this.session.setMode('plan');
            this.session.resetIteration();
            console.log(chalk.gray('Auto-switched to PLAN mode for next requirement.\n'));
            return;
          } else {
            console.log(chalk.yellow('\n⚠️  Verification not yet satisfied.'));
            console.log(chalk.gray(`Reasoning: ${verifyResult.reasoning}\n`));
            console.log(chalk.gray('Continuing with additional actions...\n'));
            // Continue to action execution below
          }
        } else {
          console.log(chalk.gray('\nℹ️  No previous execution history - skipping pre-execution verification\n'));
          console.log(chalk.gray('Actions will be executed and verified afterward...\n'));
        }
      }

      // Handle verify mode's done response (standard mode, no ReAct)
      if (mode === 'verify' && !this.session.isUltrathinkEnabled() && aiResp.done === true) {
        console.log(chalk.green('\n✅ Requirement satisfied!'));
        console.log(chalk.gray('All tasks completed successfully.\n'));

        // Reset to plan mode for next requirement
        this.session.setMode('plan');
        this.session.resetIteration();
        console.log(chalk.gray('Auto-switched to PLAN mode for next requirement.\n'));
        return;
      }

      // Check response type
      if ((aiResp as any).type === 'tool_calls' && (aiResp as any).toolCalls) {
        // AI decided to use tools (e.g., search)
        // Execute the tool calls and then call AI again with the results
        console.log(chalk.cyan('\n🔧 AI is using tools to gather information...\n'));

        if (!this.toolExecutor) {
          console.log(chalk.red('❌ Tool executor not available\n'));
          return;
        }

        const toolCalls = (aiResp as any).toolCalls;
        const toolResults = [];

        // Execute all tool calls
        for (const call of toolCalls) {
          const toolName = chalk.cyan(call.function.name);
          console.log(`  ⚙️  [${toolName}] ${call.function.arguments}`);

          const args = JSON.parse(call.function.arguments);
          const result = await this.toolExecutor.executeToolCall({
            tool: call.function.name,
            parameters: args,
            id: call.id,
          });

          if (result.success) {
            console.log(chalk.green(`  ✅ [${toolName}] 成功`));
            // Truncate long output
            const output = result.output?.slice(0, 200) || 'Done';
            if ((result.output?.length || 0) > 200) {
              console.log(chalk.gray(`  📄 ${output}... (truncated)`));
            } else {
              console.log(chalk.gray(`  📄 ${output}`));
            }
          } else {
            console.log(chalk.red(`  ❌ [${toolName}] 失败: ${result.error}`));
          }

          toolResults.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }

        console.log(chalk.gray('\n✅ 工具执行完成，重新生成计划...\n'));

        // Call AI again with tool results to get the actual plan
        console.log(chalk.gray('🤖 重新思考...\n'));

        // Make a follow-up AI call with tool results embedded in context
        // We need to manually construct a prompt that includes the tool results
        const toolResultsText = toolResults.map(r => {
          const resultData = JSON.parse(r.content);
          return `Tool Result: ${resultData.success ? 'Success' : 'Failed'}\nOutput: ${resultData.output || resultData.error || 'No output'}`;
        }).join('\n\n');

        // Modify the requirement to include tool results
        const enhancedRequirement = `${requirement}\n\n[Tool Results Available:]\n${toolResultsText}\n\nBased on these tool results, please generate your plan.`;

        // Call AI again with enhanced requirement
        const followUpResp = await callAI(
          this.session.getConfig(),
          projectInfo,
          enhancedRequirement,
          mode,
          history,
          this.toolExecutor?.getRegistry(),
          undefined, // grantedPermissions
          undefined, // compression
          projectRoot,
          this.getAbortSignal(),
          ultrathinkOptions,
          userProfile || undefined,
          undefined, // hookSystem
          this.memoPlugin // 🔥 memo plugin for memory context
        );

        // Replace aiResp with followUpResp and continue processing
        // This allows the code below to handle the actual plan
        if (followUpResp.toolCalls && followUpResp.toolCalls.length > 0) {
          // AI still wants to use more tools - limit to 2 iterations
          console.log(chalk.yellow('\n⚠️  AI requested additional tools, but limiting to one tool round for now.\n'));
          console.log(chalk.gray('💡 Tip: Run the command again if needed.\n'));
          return;
        }

        // Update aiResp to the follow-up response and continue
        Object.assign(aiResp, followUpResp);

        // Don't return - continue to process the actual plan below
        // Check response type again for the new response
        if ((aiResp as any).type === 'error') {
          console.log(chalk.yellow('\n⚠️  ' + (aiResp as any).message + '\n'));
          return;
        }
      }

      if ((aiResp as any).type === 'analysis') {
        // Analysis/Query response - just display the response
        console.log(chalk.cyan('\n📊 Analysis Result:\n'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log((aiResp as any).response);
        console.log(chalk.gray('─'.repeat(50)) + '\n');
        console.log(chalk.green('✅ Done\n'));
        return;
      }

      if ((aiResp as any).type === 'error') {
        // Error response
        console.log(chalk.yellow('\n⚠️  ' + (aiResp as any).message + '\n'));
        return;
      }

      if ((aiResp as any).type === 'choice') {
        // Adventure Mode: Present choices to user
        console.log(chalk.magenta.bold('\n🎮 Adventure Mode: Multiple approaches available\n'));

        const selectedChoice = await this.adventureManager.presentChoices(
          (aiResp as any).scenario,
          (aiResp as any).choices
        );

        console.log(chalk.green('\n✓ ' + this.adventureManager.formatChoiceSummary(selectedChoice)));
        console.log(chalk.gray('执行步骤:'));
        selectedChoice.todo.forEach((step: string, i: number) => {
          console.log(chalk.gray(`  ${i + 1}. ${step}`));
        });
        console.log('');

        // Execute the selected choice's actions
        console.log(chalk.cyan('🚀 Executing selected choice...\n'));

        let executionFailed = false;

        for (const action of selectedChoice.actions) {
          if (this.isAborted()) {
            console.log(chalk.yellow('\n⚠️  Execution interrupted by user.\n'));
            return;
          }

          const startTime = Date.now();
          const result = await this.toolExecutor.executeAction(action, this.rollbackManager);
          const duration = Date.now() - startTime;

          if (!result.success) {
            console.log(chalk.red(`✗ Failed: ${this.describeAction(action)}`));
            console.log(chalk.gray(`  Error: ${result.error}\n`));
            executionFailed = true;

            // Record failed execution
            this.session.getTracker().recordExecution(action, 'failed', duration, result.error);
            break;
          } else {
            console.log(chalk.green(`✓ Success: ${this.describeAction(action)}`));
            console.log('');
          }

          // Record successful execution
          // Note: Not passing rollbackData to avoid type complexity in Adventure Mode
          this.session.getTracker().recordExecution(action, 'success', duration);
        }

        if (!executionFailed) {
          console.log(chalk.green('\n✅ All actions completed successfully!\n'));
        }

        return;
      }

      // Default: Task response (backward compatible with old format)
      let todo = (aiResp as any).todo || aiResp.todo;
      let actions = (aiResp as any).actions || aiResp.actions;

      // Validate that todo and actions are arrays
      if (!Array.isArray(todo) || !Array.isArray(actions)) {
        console.log(chalk.yellow('\n⚠️  Invalid response format from AI\n'));
        console.log(chalk.gray('todo and actions must be arrays\n'));
        return;
      }

      // Check for empty plan
      if (todo.length === 0 && actions.length === 0) {
        console.log(chalk.yellow('\n⚠️  AI generated an empty plan\n'));
        console.log(chalk.gray('This usually means the AI didn\'t understand the requirement.\n'));
        console.log(chalk.gray('💡 Tips:'));
        console.log(chalk.gray('  • Try rephrasing your requirement'));
        console.log(chalk.gray('  • Be more specific about what you want'));
        console.log(chalk.gray('  • Use /plan <requirement> for programming tasks\n'));
        return;
      }

      // 显示 TODO 列表
      console.log(chalk.magenta('📋 TODO List:'));
      console.log(chalk.magenta('─'.repeat(50)));
      todo.forEach((t: string, i: number) => {
        console.log(chalk.gray(`  ${i + 1}. ${t}`));
      });
      console.log(chalk.magenta('─'.repeat(50)) + '\n');

      // 显示 Action Plan
      console.log(chalk.magenta('⚡ Action Plan:'));
      console.log(chalk.magenta('─'.repeat(50)));
      actions.forEach((a: Action, i: number) => {
        const desc = this.describeAction(a);
        console.log(chalk.gray(`  ${i + 1}. ${desc}`));
      });
      console.log(chalk.magenta('─'.repeat(50)) + '\n');

      // Adventure Style: Present plan options
      this.rl.pause();

      const choice = await this.planChoiceManager.presentPlanOptions(
        todo,
        actions,
        false // TODO: Detect if AI has alternatives
      );

      this.rl.resume();

      // 🎮 记录决策点到分支树（未选项保留为潜在分支，galgame flowchart）
      if (this.timeTravel) {
        try {
          const lastMsg = this.session.getSessionContextManager().getLastMessage();
          const branchTree = this.timeTravel.getBranchTreeManager();
          const promptText = requirement.length > 80 ? requirement.slice(0, 77) + '...' : requirement;
          const planOptions = [
            { id: 'execute', label: '执行当前计划' },
            { id: 'modify', label: '修改需求后重新计划' },
            { id: 'details', label: '查看详细信息' },
            { id: 'cancel', label: '取消' },
          ];

          // 🎲 跨会话先验回流：同类历史决策的选项战绩作为初始 P 值
          // （价值网络回填——上周"增量方案胜率高"会自动影响今天的推荐）
          let priors: Record<string, number> | undefined;
          try {
            priors =
              (await branchTree.getCrossSessionPriors(
                promptText,
                planOptions,
                this.branchSessionId
              )) ?? undefined;
          } catch {
            // 先验计算失败退化为均匀分布
          }

          const node = await branchTree.recordDecision({
            sessionId: this.branchSessionId,
            type: 'plan-selection',
            prompt: promptText,
            options: planOptions,
            selectedOptionId: choice,
            priors,
            messageId: lastMsg?.id,
            gitHash: this.rollbackManager.getCurrentHash() ?? undefined,
          });
          this.lastPlanDecisionNodeId = node?.id;
        } catch {
          // 分支记录失败不影响主流程
        }
      }

      // Handle user's choice
      if (choice === 'cancel') {
        console.log(chalk.yellow('⚠️  Execution cancelled.\n'));
        return;
      }

      if (choice === 'details') {
        // Show details and ask again
        this.planChoiceManager.showPlanDetails(todo, actions);
        this.rl.pause();

        const confirmDetail = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: '执行此计划?',
            default: true,
          },
        ]);

        this.rl.resume();

        if (!confirmDetail.confirm) {
          console.log(chalk.yellow('⚠️  Execution cancelled.\n'));
          return;
        }
      } else if (choice === 'modify') {
        // Let user modify the requirement
        this.rl.resume();
        const { newRequirement } = await inquirer.prompt([
          {
            type: 'input',
            name: 'newRequirement',
            message: '请输入新的需求:',
          },
        ]);

        if (!newRequirement || newRequirement.trim() === '') {
          console.log(chalk.yellow('⚠️  Empty requirement, cancelled.\n'));
          return;
        }

        // Re-plan with new requirement
        console.log(chalk.cyan('\n🔄 重新计划中...\n'));

        const newAiResp = await callAI(
          this.session.getConfig(),
          await scanDirectory(this.session.getProjectRoot(), {
            listOnly: true,
            maxFiles: 5
          }),
          newRequirement.trim(),
          mode,
          history,
          this.toolExecutor?.getRegistry(),
          undefined,
          undefined,
          this.session.getProjectRoot(),
          this.getAbortSignal(),
          this.session.isUltrathinkEnabled() ? {
            enabled: true,
            numAlternatives: 3,
            searchStrategy: 'bfs',
            maxDepth: 3,
            beamWidth: 3,
            showThoughts: true,
            showRejected: false,
          } : undefined,
          await this.session.getUserProfile() || undefined,
          undefined, // hookSystem
          this.memoPlugin // 🔥 memo plugin for memory context
        );

        this.resetAbortController();

        // Update todo and actions with new plan
        const newTodo = newAiResp.todo;
        const newActions = newAiResp.actions;

        // Display new plan
        console.log(chalk.magenta('📋 新 TODO List:'));
        console.log(chalk.magenta('─'.repeat(50)));
        newTodo.forEach((t: string, i: number) => {
          console.log(chalk.gray(`  ${i + 1}. ${t}`));
        });
        console.log(chalk.magenta('─'.repeat(50)) + '\n');

        console.log(chalk.magenta('⚡ 新 Action Plan:'));
        console.log(chalk.magenta('─'.repeat(50)));
        newActions.forEach((a: Action, i: number) => {
          const desc = this.describeAction(a);
          console.log(chalk.gray(`  ${i + 1}. ${desc}`));
        });
        console.log(chalk.magenta('─'.repeat(50)) + '\n');

        // Confirm execution of new plan
        this.rl.pause();

        const { confirmNew } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmNew',
            message: '执行新计划?',
            default: true,
          },
        ]);

        this.rl.resume();

        if (!confirmNew.confirm) {
          console.log(chalk.yellow('⚠️  Execution cancelled.\n'));
          return;
        }

        // Update todo and actions and continue to execution
        todo = newTodo;
        actions = newActions;
      } else if (choice === 'regenerate') {
        // Regenerate plan (for future use)
        console.log(chalk.yellow('\n⚠️  重新生成功能尚未实现\n'));
        console.log(chalk.gray('💡 提示: 使用"修改需求"选项来调整计划\n'));
        return;
      }

      // choice === 'execute' or any other: continue to execution
      // 🎮 galgame 式自动存档：进入执行（下副本）前留档
      if (this.timeTravel) {
        try {
          await this.timeTravel.createSave({
            sessionId: this.branchSessionId,
            reason: 'auto: before execution',
            summary: requirement.length > 50 ? requirement.slice(0, 47) + '...' : requirement,
          });
        } catch {
          // 自动存档失败不阻塞执行
        }
      }

      // 执行 Actions
      console.log(chalk.cyan('🚀 Executing...\n'));

      let executionFailed = false;

      // Use ToolExecutor (always available now)
      console.log(chalk.gray('Using enhanced tool system...\n'));

      for (const action of aiResp.actions) {
        // 检查中断
        if (this.isAborted()) {
          console.log(chalk.yellow('\n⚠️  Execution interrupted by user.\n'));
          return;
        }

        // Convert action to tool call
        const toolCall = actionToToolCall(action, this.toolExecutor.getRegistry());

        if (!toolCall) {
          console.log(chalk.yellow(`  ⚠️  Unsupported action type: ${(action as any).type}`));
          executionFailed = true;
          break;
        }

        // Execute tool call
        const result = await this.toolExecutor.executeToolCall(toolCall);

        // Convert ToolResult to ExecutionResult for history
        const executionResult = {
          success: result.success,
          output: result.output,
          error: result.error,
          duration: result.metadata?.duration as number || 0,
        };

        // 记录执行结果
        this.session.getTracker().recordExecution(
          action,
          result.success ? 'success' : 'failed',
          executionResult.duration,
          result.error
        );

        if (result.success) {
          const toolName = chalk.cyan(toolCall.tool);
          console.log(chalk.green(`  ✅ [${toolName}] ${result.output || 'Done'}`));
        } else {
          const toolName = chalk.cyan(toolCall.tool);
          console.error(chalk.red(`  ❌ [${toolName}] ${result.error}`));
          executionFailed = true;
          break;
        }
      }

      // 🎮 回填分支结局（galgame 多结局：succeeded / failed）
      if (this.timeTravel && this.lastPlanDecisionNodeId) {
        try {
          await this.timeTravel.getBranchTreeManager().setOutcome(
            this.branchSessionId,
            this.lastPlanDecisionNodeId,
            executionFailed ? 'failed' : 'succeeded',
            executionFailed ? 'execution failed — see /back-to to retry from here' : undefined
          );
        } catch {
          // 结局记录失败不影响主流程
        }
        this.lastPlanDecisionNodeId = undefined;
      }

      if (executionFailed) {
        console.log(chalk.yellow('\n⚠️  Some actions failed. You can continue iterating.\n'));
      } else {
        console.log(chalk.green('\n✅ All actions completed successfully!\n'));

        // Check if this was an information gathering task (summarize, explain, analyze)
        const originalRequirement = requirement.toLowerCase();
        const isInfoTask = /^(summarize|explain|analyze|describe|what is|how does)/.test(originalRequirement);

        if (mode === 'plan' && isInfoTask) {
          // Auto-generate summary based on executed actions
          console.log(chalk.cyan('📊 Generating analysis based on gathered information...\n'));

          try {
            const summary = await this.generateSummary(requirement);
            console.log(chalk.cyan('\n📊 Analysis Result:\n'));
            console.log(chalk.gray('─'.repeat(50)));
            console.log(summary);
            console.log(chalk.gray('─'.repeat(50)) + '\n');
            console.log(chalk.green('✅ Done\n'));

            // Don't switch to verify mode for info tasks
            return;
          } catch (error: any) {
            console.log(chalk.yellow('⚠️  Failed to generate summary: ' + error.message + '\n'));
            console.log(chalk.gray('Continuing to verify mode...\n'));
          }
        }

        // Auto-switch from plan to verify mode after successful execution
        if (mode === 'plan') {
          this.session.setMode('verify');
          this.session.incrementIteration();
          console.log(chalk.gray('Auto-switched to VERIFY mode.'));
          console.log(chalk.gray(`Iteration ${this.session.getIterationCount()} of ${MAX_ITERATIONS}\n`));
        } else {
          // Still in verify mode, increment counter
          this.session.incrementIteration();
        }
      }

      // 自动验证（如果启用）
      if (this.verifier && !executionFailed) {
        console.log(chalk.cyan('🔍 Stage 1: Quick checks (syntax, lint, tests, build)\n'));

        // 阶段 1: 快速检查（旧 verifier）
        const vr = await this.verifier.verify(projectRoot, 'fast');

        if (vr.passed) {
          console.log(chalk.green('✅ Stage 1 passed!\n'));

          // 阶段 2: 智能验证（如果启用了 ultrathink）
          if (this.session.isUltrathinkEnabled() && mode === 'verify') {
            console.log(chalk.cyan('🔍 Stage 2: AI-powered ReAct verification\n'));

            try {
              // 构建 execution history
              const history = this.session.getTracker().getHistory();

              if (history.length > 0) {
                // 重新扫描项目以获取最新状态（轻量级模式）
                const currentProjectInfo = await scanDirectory(projectRoot, {
                  listOnly: true,
                  maxFiles: 5
                });

                // 使用 ReAct verifier 进行智能验证
                const verifyResult = await verifyWithReAct(
                  this.session.getConfig(),
                  currentProjectInfo,
                  requirement,
                  history,
                  5  // max iterations
                );

                if (verifyResult.satisfied) {
                  console.log(chalk.green('✅ Stage 2 passed!\n'));
                  console.log(chalk.gray(`Reasoning: ${verifyResult.reasoning}\n`));
                } else {
                  console.log(chalk.yellow('⚠️  Stage 2: Verification not yet satisfied.\n'));
                  console.log(chalk.gray(`Reasoning: ${verifyResult.reasoning}\n`));

                  // 尝试自动修复
                  if (verifyResult.trace) {
                    const { ReActVerifier } = await import('./ultrathink/verifier');
                    const verifier = new ReActVerifier(
                      this.session.getConfig(),
                      currentProjectInfo,
                      requirement
                    );

                    const fixResult = await verifier.autoFix(verifyResult.trace, history);

                    if (fixResult.fixesApplied > 0) {
                      console.log(chalk.cyan('\n🔧 Auto-fix generated corrective actions:\n'));

                      // 显示修复操作
                      fixResult.correctiveActions.forEach((action, idx) => {
                        console.log(chalk.gray(`  ${idx + 1}. ${this.describeAction(action)}`));
                      });

                      console.log(chalk.cyan('\n' + '─'.repeat(50)));

                      // 询问是否应用修复
                      this.rl.pause();
                      const { applyFixes } = await inquirer.prompt([
                        {
                          type: 'confirm',
                          name: 'applyFixes',
                          message: 'Apply these auto-fixes?',
                          default: true,
                        },
                      ]);
                      this.rl.resume();

                      if (applyFixes) {
                        console.log(chalk.cyan('\n🚀 Applying auto-fixes...\n'));

                        let fixFailed = false;
                        for (const action of fixResult.correctiveActions) {
                          if (this.isAborted()) {
                            console.log(chalk.yellow('\n⚠️  Fix application interrupted.\n'));
                            return;
                          }

                          const result = await this.toolExecutor.executeAction(action, this.rollbackManager);

                          this.session.getTracker().recordExecution(
                            action,
                            result.success ? 'success' : 'failed',
                            result.duration,
                            result.error
                          );

                          if (result.success) {
                            console.log(chalk.green(`  ✅ ${this.describeAction(action)}`));
                          } else {
                            console.error(chalk.red(`  ❌ ${this.describeAction(action)}`));
                            console.error(chalk.red(`     Error: ${result.error}`));
                            fixFailed = true;
                            break;
                          }
                        }

                        if (!fixFailed) {
                          console.log(chalk.green('\n✅ All auto-fixes applied successfully!\n'));
                          console.log(chalk.gray('Running verification again...\n'));

                          // 重新验证（简化版，只运行快速检查）
                          const recheck = await this.verifier.verify(projectRoot, 'fast');
                          if (recheck.passed) {
                            console.log(chalk.green('✅ Verification passed after auto-fix!\n'));
                          } else {
                            console.log(chalk.yellow('⚠️  Verification still failing. Manual intervention may be needed.\n'));
                          }
                        }
                      } else {
                        console.log(chalk.gray('\nAuto-fixes cancelled. You can manually address the issues.\n'));
                      }
                    }
                  }
                }
              } else {
                console.log(chalk.gray('ℹ️  No execution history to verify (Stage 2 skipped)\n'));
              }
            } catch (reactError: any) {
              console.log(chalk.yellow(`⚠️  Stage 2 error: ${reactError.message}\n`));
              console.log(chalk.gray('Continuing anyway...\n'));
            }
          }
        } else {
          console.log(chalk.yellow(`⚠️  Stage 1 failed: ${vr.message}\n`));
          console.log(chalk.gray('Stage 2 (AI verification) skipped due to Stage 1 failure\n'));
        }
      }

    } catch (error: any) {
      this.resetAbortController();

      // 检查是否是中断错误
      if (error.name === 'AbortError' || error.message?.includes('abort')) {
        console.log(chalk.yellow('\n⚠️  Request cancelled.\n'));
        return;
      }

      // 其他错误
      console.error(chalk.red('❌ Error:'), error.message);
      throw error;
    }
  }

  /**
   * 描述 Action
   */
  private describeAction(action: Action): string {
    switch (action.type) {
      case 'create':
        return `Create ${action.path}`;
      case 'modify':
        return `Modify ${action.path}`;
      case 'delete':
        return `Delete ${action.path}`;
      case 'run':
        return `Run "${action.command}"`;
      case 'verify':
        return `Verify "${action.command}"`;
      default:
        return `Unknown action: ${JSON.stringify(action)}`;
    }
  }

  /**
   * Handle /chat command - Simple chat mode for testing AI connection
   */
  private async handleChatCommand(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log(chalk.yellow('\n⚠️  Usage: /chat <your message>\n'));
      console.log(chalk.gray('Example: /chat Hello, how are you?\n'));
      return;
    }

    const message = args.join(' ');
    await this.chatMode(message);
  }

  /**
   * Default chat mode - simply chat with AI
   */
  private async chatMode(message: string): Promise<void> {
    console.log(chalk.cyan('\n💬 Chat\n'));

    try {
      // 记录用户输入（用于生成用户侧写）
      this.session.recordUserInput(message);

      // 🔥 NEW: 检测并提取图片引用
      const config = this.session.getConfig();
      const projectRoot = this.session.getProjectRoot();
      let imageRefs: ImageReference[] = [];
      let cleanedMessage = message;

      if (config.enableVision) {
        const parsed = parseUserInputWithImages(message, projectRoot);
        imageRefs = parsed.images;
        cleanedMessage = parsed.message as string;

        // 如果找到图片，显示提示
        if (imageRefs.length > 0) {
          console.log(chalk.cyan(`📷 Detected ${imageRefs.length} image(s)\n`));
        }
      }

      // 🔥 记录用户消息到会话上下文（使用清理后的消息）
      await this.recordSessionMessage('user', cleanedMessage);

      // 检查是否需要更新用户侧写
      if (this.session.shouldUpdateProfile()) {
        console.log(chalk.cyan('📊 正在更新用户侧写...\n'));

        try {
          const userProfile = await this.generateUserProfile();
          await this.updateUserProfileFile(userProfile);

          // 清空输入记录
          this.session.clearUserInputs();

          console.log(chalk.green('✅ 用户侧写已更新！\n'));
        } catch (error: any) {
          console.log(chalk.yellow(`⚠️  侧写更新失败: ${error.message}\n`));
          // 继续执行，不阻止聊天
        }
      }

      this.currentAbortController = new AbortController();

      // Get user profile if available
      const userProfile = await this.session.getUserProfile();

      // FIX: Create temporary toolExecutor for chat mode if not available
      // This enables search tools in chat mode even when useTools=false globally
      let chatToolExecutor = this.toolExecutor;
      if (!chatToolExecutor) {
        // For chat mode, ensure we have NETWORK_ACCESS permission for search tools
        const chatPermissionManager = new PermissionManager(
          this.session.getPermissionLevel()
        );

        // Grant NETWORK_ACCESS for search tools in chat mode
        chatPermissionManager.grant(Permission.NETWORK_ACCESS);

        chatToolExecutor = new ToolExecutor(
          this.session.getTracker(),
          this.rollbackManager,
          this.session.getConfig(),
          this.session.getPermissionLevel()
        );

        // Manually set the permission manager to our customized one
        (chatToolExecutor as any).permissionManager = chatPermissionManager;

        // Update context with proper Set<Permission>
        (chatToolExecutor as any).context = {
          root: process.cwd(),
          history: this.session.getTracker(),
          permissions: new Set(chatPermissionManager.getGranted()),
          config: this.session.getConfig(),
        };
      }

      const response = await chatAI(
        this.session.getConfig(),
        cleanedMessage, // Use cleaned message (without @ symbols)
        this.getAbortSignal(),
        userProfile || undefined,
        chatToolExecutor.getRegistry(),
        chatToolExecutor, // FIX: Always pass toolExecutor to enable tool execution
        undefined, // hookSystem
        undefined, // frontend
        imageRefs.length > 0 ? imageRefs : undefined, // NEW: Pass image references
        projectRoot, // NEW: Pass project root for resolving image paths
        undefined, // skillManager
        this.memoPlugin // 🔥 memo plugin for memory context
      );

      // 🔥 记录助手响应到会话上下文
      if (response) {
        await this.recordSessionMessage('assistant', response);
      }

      // chatAI already prints the response internally
      // Just show completion status
      if (response && !response.startsWith('Error:')) {
        console.log(chalk.green('✅ Done\n'));
      } else if (response && response.startsWith('Error:')) {
        // Show error message in red
        console.log(chalk.red(`\n${response}\n`));
      }
    } catch (error: any) {
      // Check for abort error
      if (error.name === 'AbortError' || error.message?.includes('abort')) {
        console.log(chalk.yellow('\n⚠️  Chat cancelled.\n'));
        return;
      }

      console.error(chalk.red('❌ Chat error:'), error.message);
    } finally {
      this.resetAbortController();
    }
  }

  /**
   * Handle /plan or /do command - Execute requirement with full planning
   *
   * 🔥 DEPRECATED: This method is now handled by Loop Plugin System
   * See: src/loop/plugins/plan-mode-plugin.ts, do-mode-plugin.ts
   * Keeping this method for backward compatibility until Loop system is fully integrated
   */
  private async handlePlanCommand(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log(chalk.yellow('\n⚠️  Usage: /plan <your requirement>\n'));
      console.log(chalk.gray('Example: /plan Add a login page\n'));
      console.log(chalk.gray('         /do Create a REST API\n'));
      return;
    }

    const requirement = args.join(' ');

    // 验证输入是否是有效的编程任务
    if (!this.isValidTaskRequirement(requirement)) {
      console.log(chalk.yellow('\n⚠️  Invalid task requirement'));
      console.log(chalk.gray('The /plan command is for programming tasks, not casual conversation.\n'));
      console.log(chalk.gray('Examples of valid tasks:'));
      console.log(chalk.gray('  • /plan Add user authentication'));
      console.log(chalk.gray('  • /plan Create a REST API'));
      console.log(chalk.gray('  • /plan Fix the login bug'));
      console.log(chalk.gray('  • /plan Implement a search feature'));
      console.log(chalk.cyan('\n💡 For casual conversation, just type without /plan:\n'));
      console.log(chalk.gray('  [newma] ❯ 你好'));
      console.log(chalk.gray('  [newma] ❯ hello\n'));
      return;
    }

    console.log(chalk.cyan('\n🎯 Planning Mode\n'));
    console.log(chalk.gray('─'.repeat(50)));

    try {
      await this.executeRequirement(requirement);
    } catch (error: any) {
      // Check for abort error
      if (error.name === 'AbortError' || error.message?.includes('abort')) {
        console.log(chalk.yellow('\n⚠️  Planning cancelled.\n'));
        return;
      }

      console.error(chalk.red('❌ Planning error:'), error.message);
    }
  }

  /**
   * Handle /loop command - Loop until task is done
   * Repeatedly calls plan/verify mode until aiResp.done === true
   */
  private async handleLoopCommand(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log(chalk.yellow('\n⚠️  Usage: /loop [maxIterations] <your requirement>\n'));
      console.log(chalk.gray('Example: /loop Add user authentication         (infinite loop)\n'));
      console.log(chalk.gray('         /loop 10 Create a REST API             (max 10 iterations)\n'));
      console.log(chalk.cyan('\n🔁 Loop Mode:'));
      console.log(chalk.gray('  Repeatedly calls plan/verify until task is complete\n'));
      console.log(chalk.gray('  - Skips all confirmations (autonomous)'));
      console.log(chalk.gray('  - Checks aiResp.done to determine completion'));
      console.log(chalk.gray('  - Press Ctrl+C to stop\n'));
      return;
    }

    // 解析参数: /loop [maxIterations] <requirement>
    let maxIterations: number | undefined;
    let requirement: string;

    const firstArg = args[0];
    if (/^\d+$/.test(firstArg)) {
      maxIterations = parseInt(firstArg, 10);

      // 验证 maxIterations > 0
      if (maxIterations === 0) {
        console.log(chalk.yellow('\n⚠️  maxIterations must be greater than 0\n'));
        return;
      }

      requirement = args.slice(1).join(' ');
    } else {
      maxIterations = undefined;
      requirement = args.join(' ');
    }

    // 验证输入
    if (!this.isValidTaskRequirement(requirement)) {
      console.log(chalk.yellow('\n⚠️  Invalid task requirement'));
      console.log(chalk.gray('The /loop command is for programming tasks.\n'));
      return;
    }

    const maxIterDisplay = maxIterations === undefined ? '∞' : maxIterations;
    console.log(chalk.cyan(`\n🔁 Loop Mode (Autonomous, max: ${maxIterDisplay})`));
    console.log(chalk.cyan(`📝 Requirement: ${requirement}\n`));
    console.log(chalk.gray('─'.repeat(50)));

    try {
      this.currentAbortController = new AbortController();

      const projectRoot = this.session.getProjectRoot();
      const config = this.session.getConfig();
      const ultrathinkEnabled = this.session.isUltrathinkEnabled();
      let iteration = 0;
      let done = false;

      // Loop until done or max iterations reached
      while (!done && (maxIterations === undefined || iteration < maxIterations)) {
        // Check for abort
        if (this.getAbortSignal()?.aborted) {
          console.log(chalk.yellow('\n⚠️  Loop cancelled by user\n'));
          break;
        }

        iteration++;
        const iterDisplay = maxIterations === undefined ? '∞' : maxIterations;

        console.log(chalk.cyan(`\n${'═'.repeat(60)}`));
        console.log(chalk.cyan(`📌 Iteration ${iteration}/${iterDisplay}`));
        console.log(chalk.cyan('═'.repeat(60)));

        // Scan project
        const projectInfo = await scanDirectory(projectRoot, {
          listOnly: true,
          maxFiles: 5
        });

        // Determine mode (plan for first iteration, verify for subsequent)
        const mode: 'plan' | 'verify' = this.session.getCurrentMode();

        // ========================================
        // Pre-execution ReAct Verification
        // Only enabled when:
        // 1. In verify mode (not the first planning iteration)
        // 2. Ultrathink is enabled
        // 3. We're at least on iteration 3 (skip first 2 rounds for speed)
        // ========================================
        if (mode === 'verify' && ultrathinkEnabled && iteration >= 3) {
          const previousHistory = this.session.getTracker().getHistory();

          if (previousHistory.length > 0) {
            console.log(chalk.cyan(`\n🔍 Pre-execution ReAct check (iteration ${iteration})...\n`));

            try {
              const verifyResult = await verifyWithReAct(
                this.session.getConfig(),
                projectInfo,
                requirement,
                previousHistory,
                2 // Fast check (2 iterations instead of 3)
              );

              if (verifyResult.satisfied) {
                console.log(chalk.green('\n✅ Requirement satisfied!'));
                console.log(chalk.gray(`Reasoning: ${verifyResult.reasoning}\n`));
                done = true;
                break;
              } else {
                console.log(chalk.yellow('\n⚠️  Not yet satisfied, continuing...\n'));
                console.log(chalk.gray(`Reasoning: ${verifyResult.reasoning}\n`));
              }
            } catch (reactError: any) {
              console.log(chalk.yellow(`⚠️  ReAct check error: ${reactError.message}\n`));
              console.log(chalk.gray('Continuing anyway...\n'));
            }
          }
        }

        // Call AI
        console.log(chalk.gray(`Calling AI (${mode} mode)...\n`));

        const aiResp = await callAI(
          config,
          projectInfo,
          requirement,
          mode,
          this.session.getTracker().getHistory(),
          this.toolExecutor?.getRegistry(), // 修复:传递完整的 ToolRegistry 以启用搜索等功能的完整参数定义
          undefined,  // grantedPermissions
          undefined,  // compression
          projectRoot,
          this.getAbortSignal(),
          ultrathinkEnabled ? { // ultrathinkOptions
            enabled: true,
            showThoughts: true,
            showRejected: false,
          } : undefined,
          await this.session.getUserProfile() || undefined, // user profile
          undefined, // hookSystem
          this.memoPlugin // 🔥 memo plugin for memory context
        );

        // Print TODO and actions
        console.log(chalk.cyan('=== TODO List ===\n'));
        if (aiResp.todo && aiResp.todo.length > 0) {
          aiResp.todo.forEach((item, idx) => {
            console.log(chalk.gray(`${idx + 1}. ${item}`));
          });
        } else {
          console.log(chalk.gray('(No todo items)\n'));
        }

        console.log(chalk.cyan('=== Action Plan ===\n'));
        if (aiResp.actions && aiResp.actions.length > 0) {
          aiResp.actions.forEach((action, idx) => {
            console.log(chalk.gray(`${idx + 1}. ${this.describeAction(action)}`));
          });
        } else {
          console.log(chalk.gray('(No actions)\n'));
        }

        // ========================================
        // 统一检查 done 字段（两种模式都适用）
        // 在 verify 模式下，AI 评估需求是否已满足
        // 在 plan 模式下，AI 可能已完成初始规划
        // 如果 done === true，退出循环
        // ========================================
        if (aiResp.done === true) {
          if (mode === 'verify') {
            console.log(chalk.green('\n✅ Requirement satisfied!'));
            console.log(chalk.gray('AI verification confirmed the task is complete.\n'));
          } else {
            console.log(chalk.green('\n✅ Task completed!\n'));
          }
          done = true;
          break;
        }

        // DEBUG: Log aiResp.done status for troubleshooting
        if (process.env.DEBUG_LOOP) {
          console.log(chalk.gray(`[DEBUG] Mode: ${mode}, aiResp.done: ${aiResp.done}, iteration: ${iteration}, hasActions: ${!!(aiResp.actions && aiResp.actions.length > 0)}\n`));
        }

        // Execute actions
        if (aiResp.actions && aiResp.actions.length > 0) {
          console.log(chalk.cyan(`\n⚙️  Executing ${aiResp.actions.length} actions...\n`));

          for (const action of aiResp.actions) {
            const result = await this.toolExecutor.executeAction(action, this.rollbackManager);

            // Record result using recordExecution
            this.session.getTracker().recordExecution(
              action,
              result.success ? 'success' : 'failed',
              result.duration,
              result.error
            );

            // Print result
            if (result.success) {
              console.log(chalk.green(`✅ ${this.describeAction(action)}`));
            } else {
              console.log(chalk.red(`❌ ${this.describeAction(action)}`));
              console.log(chalk.red(`   Error: ${result.error}\n`));
            }
          }

          // Switch to verify mode for next iteration
          if (mode === 'plan') {
            this.session.setMode('verify');
            console.log(chalk.gray('Switched to verify mode\n'));
          }
        } else if (mode === 'plan') {
          // 即使没有 actions 也要切换到 verify 模式进行验证
          // 这确保 satisfaction check 能在 plan 模式下运行
          this.session.setMode('verify');
          console.log(chalk.gray('切换到验证模式（无需执行操作）\n'));
        }

        // ========================================
        // ⭐ CRITICAL FIX: Simple satisfaction check MOVED OUTSIDE actions block!
        // This must run regardless of whether there are actions to execute
        // Runs when:
        // 1. In verify mode (not first planning iteration)
        // 2. At least iteration 2 (give AI a chance to complete)
        // 3. Not already done
        // This provides a fallback when AI doesn't set done: true
        // ========================================
        // 在两种模式下都运行验证检查（但仅在第 2 次迭代后）
        // 这确保即使 AI 保持在 plan 模式也能检测到完成
        if (iteration >= 2 && !done) {
          console.log(chalk.gray(`\n🔍 Checking if requirement is satisfied...\n`));

          try {
            const history = this.session.getTracker().getHistory();

            // Simple prompt to check if done
            const checkPrompt = `Review the execution history and determine if the original requirement is satisfied.

Original requirement: ${requirement}

Execution history:
${history.map(h => `- ${h.action.description || h.action.type}: ${h.status}`).join('\n')}

Respond with ONLY JSON in the "analysis" field of an action: {"satisfied": true|false, "reasoning": "brief explanation"}`;

            const checkResp = await callAI(
              config,
              projectInfo,
              checkPrompt,
              'plan', // Use plan mode for simple JSON response
              [], // Empty history - we're passing history in the prompt
              undefined, // availableTools
              undefined, // grantedPermissions
              undefined, // compression
              projectRoot,
              this.getAbortSignal(),
              undefined, // ultrathink
              await this.session.getUserProfile() || undefined, // user profile
              undefined, // hookSystem
              this.memoPlugin // 🔥 memo plugin for memory context
            );

            // Parse the response using robust extractJSON
            let checkResult: { satisfied: boolean; reasoning: string } | null = null;

            // Method 1: Try from content first (most reliable)
            if (checkResp.content) {
              const { extractJSON } = await import('./ai');
              const jsonStr = extractJSON(checkResp.content);

              if (jsonStr) {
                try {
                  checkResult = JSON.parse(jsonStr);
                } catch (e) {
                  // Fall through to method 2
                }
              }
            }

            // Method 2: Fallback to action description (backward compatibility)
            if (!checkResult && checkResp.actions && checkResp.actions.length > 0) {
              const firstAction = checkResp.actions[0];
              if (firstAction.description) {
                const { extractJSON } = await import('./ai');
                const jsonStr = extractJSON(firstAction.description);

                if (jsonStr) {
                  try {
                    checkResult = JSON.parse(jsonStr);
                  } catch (e) {
                    // Ignore parse errors
                  }
                }
              }
            }

            if (checkResult && checkResult.satisfied) {
              console.log(chalk.green('\n✅ Requirement satisfied!'));
              console.log(chalk.gray(`Reasoning: ${checkResult.reasoning}\n`));
              done = true;
              break;
            } else if (checkResult) {
              console.log(chalk.yellow('\n⚠️  Not yet satisfied, continuing...\n'));
              console.log(chalk.gray(`Reasoning: ${checkResult.reasoning}\n`));
            }
          } catch (checkError: any) {
            // Silently skip on errors to avoid breaking the loop
            console.log(chalk.gray(`Skipping satisfaction check: ${checkError.message}\n`));
          }
        }

        // ========================================
        // Post-execution ReAct Verification (deep verification)
        // Only enabled when:
        // 1. Ultrathink is enabled
        // 2. We're at least on iteration 6 (start deep verification later)
        // 3. Actions were executed in this iteration
        // ========================================
        if (aiResp.actions && aiResp.actions.length > 0 && ultrathinkEnabled && iteration >= 6) {
          console.log(chalk.cyan(`\n🔍 Post-execution ReAct verify (iteration ${iteration})...\n`));

          try {
            const history = this.session.getTracker().getHistory();
            const verifyResult = await verifyWithReAct(
              this.session.getConfig(),
              projectInfo,
              requirement,
              history,
              3 // Medium depth (3 iterations instead of 5)
            );

            if (verifyResult.satisfied) {
              console.log(chalk.green('\n✅ Requirement satisfied!'));
              console.log(chalk.gray(`Reasoning: ${verifyResult.reasoning}\n`));
              done = true;
              break;
            } else {
              console.log(chalk.yellow('\n⚠️  Verification failed, continuing...\n'));
              console.log(chalk.gray(`Reasoning: ${verifyResult.reasoning}\n`));
              // Note: We don't do auto-fix in loop mode since it will continue iterating
            }
          } catch (reactError: any) {
            console.log(chalk.yellow(`⚠️  ReAct verify error: ${reactError.message}\n`));
            console.log(chalk.gray('Continuing anyway...\n'));
          }
        }
      }

      // Print summary
      console.log(chalk.cyan('\n' + '─'.repeat(60)));
      console.log(chalk.cyan(`📊 Summary: ${iteration} iterations | ${done ? '✅ Completed' : '❌ Incomplete'}`));
      console.log(chalk.cyan('─'.repeat(60) + '\n'));

      // Reset to plan mode
      this.session.setMode('plan');
      this.session.resetIteration();

    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('abort')) {
        console.log(chalk.yellow('\n⚠️  Loop cancelled.\n'));
        this.resetAbortController();
        return;
      }

      console.error(chalk.red('❌ Loop error:'), error.message);
    } finally {
      this.resetAbortController();

      // 确保 readline 在循环结束后处于活动状态
      // 防止 REPL 完成循环后看起来"卡住"
      if (!this.isClosed) {
        this.rl.resume();
      }
    }
  }

  /**
   * 验证输入是否是有效的编程任务需求
   *
   * 🔥 DEPRECATED: This validation is now handled by Loop Plugin System
   * See: src/loop/plugins/plan-mode-plugin.ts, mode-commands-plugin.ts
   * Keeping this method for backward compatibility
   */
  private isValidTaskRequirement(requirement: string): boolean {
    // 基本长度检查 - 避免空输入或单个字符
    if (requirement.length < 3) {
      return false;
    }

    const lowerReq = requirement.toLowerCase().trim();

    // 排除纯问候语
    const greetings = [
      'hi', 'hello', 'hey', 'yo', '你好', '您好', '嗨',
      '早上好', '下午好', '晚上好', 'greetings'
    ];

    // 如果是纯问候语，建议使用 /chat
    if (greetings.some(g => lowerReq === g)) {
      return false;
    }

    // 移除关键词白名单限制 - 让 AI 自己判断任务类型
    // 支持更多场景：
    // - 执行任务：/plan add user authentication
    // - 分析任务：/plan 总结这个项目, /plan explain this code
    // - 查询任务：/plan how does the auth system work

    return true;
  }

  /**
   * Handle # memorize command
   * Summarizes conversation and appends to KODE.md
   */
  private async handleMemorize(): Promise<void> {
    try {
      console.log(chalk.cyan('\n📝 Gathering conversation context...\n'));

      // Step 1: Gather context
      const context = this.gatherConversationContext();

      // Step 2: Generate summary
      console.log(chalk.cyan('🤖 Generating summary...\n'));
      const summary = await this.generateSummary(context);

      // Step 3: Append to KODE.md
      console.log(chalk.cyan('💾 Saving to KODE.md...\n'));
      await this.appendToKodeMd(summary);

      console.log(chalk.green('✅ Conversation successfully saved to KODE.md!\n'));
    } catch (error: any) {
      // Check for abort error
      if (error.name === 'AbortError' || error.message?.includes('abort')) {
        console.log(chalk.yellow('\n⚠️  Memorization cancelled.\n'));
        return;
      }

      console.error(chalk.red('❌ Failed to memorize conversation:'), error.message);
    }
  }

  /**
   * Gather conversation context
   */
  private gatherConversationContext(): string {
    const parts: string[] = [];

    // Add command history
    parts.push('=== USER COMMANDS ===');
    if (this.commandHistory.length === 0) {
      parts.push('(No commands yet)');
    } else {
      this.commandHistory.forEach((cmd, i) => {
        parts.push(`${i + 1}. ${cmd}`);
      });
    }

    // Add execution history
    parts.push('\n=== EXECUTION HISTORY ===');
    const tracker = this.session.getTracker();
    const formattedHistory = tracker.formatForLLM();
    if (formattedHistory.trim()) {
      parts.push(formattedHistory);
    } else {
      parts.push('(No execution history yet)');
    }

    // Add session stats
    parts.push('\n=== SESSION STATISTICS ===');
    const stats = this.session.getStats();
    parts.push(`Session ID: ${this.session.getSessionId()}`);
    parts.push(`Duration: ${(stats.duration / 60000).toFixed(1)} minutes`);
    parts.push(`Commands executed: ${stats.commandCount}`);
    parts.push(`Total actions: ${stats.totalActions}`);
    parts.push(`Successful actions: ${stats.successfulActions}`);
    parts.push(`Failed actions: ${stats.failedActions}`);

    return parts.join('\n\n');
  }

  /**
   * Generate summary using AI
   */
  private async generateSummary(context: string): Promise<string> {
    const prompt = `Please summarize this conversation into a concise markdown format suitable for appending to a KODE.md file (similar to CLAUDE.md).

CONVERSATION CONTEXT:
${context}

Please provide a structured summary with:
1. **Overview**: Brief description of what was accomplished (2-3 sentences)
2. **Commands Used**: List of key commands executed
3. **Key Changes**: Important changes or actions taken
4. **Lessons Learned**: Any insights, decisions, or important takeaways

Keep it concise, actionable, and formatted as markdown. Focus on information that would be valuable for future reference.
`;

    // Create abort controller for this call
    this.currentAbortController = new AbortController();

    try {
      // Get user profile if available
      const userProfile = await this.session.getUserProfile();

      const response = await callAI(
        this.session.getConfig(),
        {}, // No project info needed for summarization
        prompt,
        'plan',
        this.session.getTracker().getHistory(),
        undefined, // availableTools
        undefined, // grantedPermissions
        undefined, // compression
        this.session.getProjectRoot(),
        this.getAbortSignal(),
        undefined, // ultrathink
        userProfile || undefined,
        undefined, // hookSystem
        this.memoPlugin // 🔥 memo plugin for memory context
      );

      // Extract summary from response
      // The AI returns actions array, we'll use the first action's description or the todo array
      let summary = '';
      if (response.actions && response.actions.length > 0) {
        summary = response.actions.map(a => a.description || '').join('\n');
      } else if (response.todo && response.todo.length > 0) {
        summary = response.todo.join('\n');
      } else {
        summary = 'No summary available';
      }

      return summary;
    } finally {
      this.resetAbortController();
    }
  }

  /**
   * 生成用户侧写
   * 分析用户输入历史，提取用户偏好
   */
  private async generateUserProfile(): Promise<string> {
    const userInputs = this.session.getUserInputs();
    const inputsText = userInputs.map((input, index) => `${index + 1}. ${input}`).join('\n');

    const prompt = `请分析以下用户对话历史，提取用户偏好，生成简洁的用户侧写（100-200字）：

用户对话历史：
${inputsText}

请生成 markdown 格式的侧写，包含以下字段：
- ## 语言偏好
- ## 交流风格
- ## 兴趣领域
- ## 其他特征

直接输出侧写内容，不要分析过程。`;

    try {
      // 调用 AI 生成侧写（使用聊天模式，不使用当前侧写避免循环）
      const config = this.session.getConfig();
      const response = await chatAI(
        config,
        prompt,
        this.getAbortSignal(),
        undefined, // 不使用当前侧写，避免循环
        undefined, // toolRegistry
        undefined, // toolExecutor
        undefined, // hookSystem
        undefined, // frontend
        undefined, // imageRefs
        undefined, // projectRoot
        undefined, // skillManager
        this.memoPlugin // 🔥 memo plugin for memory context
      );

      return response.trim();
    } catch (error: any) {
      throw new Error(`生成侧写失败: ${error.message}`);
    }
  }

  /**
   * 更新用户侧写文件
   */
  private async updateUserProfileFile(content: string): Promise<void> {
    const fs = require('fs').promises;
    const path = require('path');

    const profilePath = path.join(
      this.session.getProjectRoot(),
      this.session['PROFILE_FILE']  // '用户侧写.md'
    );

    const timestamp = new Date().toISOString();
    const header = `<!-- 最后更新: ${timestamp} -->\n\n`;

    try {
      await fs.writeFile(profilePath, header + content, 'utf-8');
    } catch (error: any) {
      throw new Error(`写入侧写文件失败: ${error.message}`);
    }
  }

  /**
   * Append summary to KODE.md
   */
  private async appendToKodeMd(summary: string): Promise<void> {
    const fs = require('fs').promises;
    const path = require('path');

    const kodeMdPath = path.join(this.session.getProjectRoot(), 'KODE.md');
    const timestamp = new Date().toISOString();
    const stats = this.session.getStats();

    const entry = `
## Session Summary - ${timestamp}

**Session ID**: ${this.session.getSessionId()}
**Duration**: ${(stats.duration / 60000).toFixed(1)} minutes
**Commands**: ${stats.commandCount}
**Actions**: ${stats.totalActions}

${summary}

---
`;

    try {
      // Check if file exists
      const fileExists = require('fs').existsSync(kodeMdPath);

      if (!fileExists) {
        // Create file with header
        const header = `# KODE.md

Project memory and conversation summaries.

This file contains automatically generated summaries of interactive sessions.
Use these summaries to recall important decisions, changes, and lessons learned.

---
`;
        await fs.writeFile(kodeMdPath, header, 'utf-8');
      }

      // Append summary
      await fs.appendFile(kodeMdPath, entry, 'utf-8');
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to write to KODE.md:'), error.message);
      throw error;
    }
  }

  /**
   * Handle /init command - Initialize AI understanding of the project
   */
  private async handleInitCommand(): Promise<void> {
    try {
      console.log(chalk.cyan('\n🔍 Analyzing project structure...\n'));

      // Step 1: Scan entire project in batches
      console.log(chalk.gray('Scanning all project files...\n'));

      const BATCH_SIZE = 5;
      let allProjectInfo: any = {};
      let batchCount = 0;

      // First, get file list only
      const fileList = await scanDirectory(this.session.getProjectRoot(), {
        listOnly: true,
        maxFiles: 1000  // Get all files
      });

      const files = Object.keys(fileList).filter(file => {
        // Exclude common directories that don't need to be scanned
        const excludePatterns = [
          'node_modules/',
          '.git/',
          'dist/',
          'coverage/',
          '.next/',
          'build/',
          '.cache/'
        ];

        return !excludePatterns.some(pattern => file.startsWith(pattern));
      });

      console.log(chalk.gray(`Found ${Object.keys(fileList).length} total files, ${files.length} after filtering\n`));

      // Then scan in batches with content
      const fs = require('fs').promises;
      const path = require('path');

      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        batchCount++;
        const batch = files.slice(i, Math.min(i + BATCH_SIZE, files.length));

        console.log(chalk.gray(`Batch ${batchCount}/${Math.ceil(files.length / BATCH_SIZE)}: Scanning ${batch.length} files...`));

        // Read each file in the batch
        for (const file of batch) {
          const fullPath = path.join(this.session.getProjectRoot(), file);
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            // Limit content size (similar to scanner logic)
            const lines = content.split('\n').slice(0, 200);
            allProjectInfo[file] = lines.join('\n');
          } catch (err: any) {
            // Skip files that can't be read
            allProjectInfo[file] = `[Error reading file: ${err.message}]`;
          }
        }

        // Small delay to avoid overwhelming the system
        if (i + BATCH_SIZE < files.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      console.log(chalk.gray(`\n✓ Scanned ${Object.keys(allProjectInfo).length} items total\n`));

      console.log(chalk.cyan('🤖 Generating project overview...\n'));

      // Step 2: Generate project summary
      console.log(chalk.gray('Calling AI to analyze project...'));
      const summary = await this.generateProjectSummary(allProjectInfo);
      console.log(chalk.gray(`✓ Generated ${summary.length} characters of summary\n`));

      // Step 3: Write to KODE.md
      console.log(chalk.cyan('💾 Writing to KODE.md...\n'));
      await this.writeProjectSummary(summary);

      console.log(chalk.green('✅ Project successfully initialized!\n'));
      console.log(chalk.gray('AI now has a comprehensive understanding of your project.\n'));
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('abort')) {
        console.log(chalk.yellow('\n⚠️  Init cancelled.\n'));
        return;
      }

      console.error(chalk.red('❌ Failed to initialize project:'), error.message);
      console.error(chalk.gray(error.stack?.split('\n').slice(0, 5).join('\n')));
    }
  }

  /**
   * Generate comprehensive project summary
   */
  private async generateProjectSummary(projectInfo: any): Promise<string> {
    // First, create a simplified version of project info for the prompt
    const files = Object.keys(projectInfo);
    const fileSummary = files.map(file => {
      const content = projectInfo[file];
      const preview = content.split('\n').slice(0, 5).join('\n').substring(0, 200);
      return `- **${file}**:\n\`\`\`\n${preview}\n\`\`\``;
    }).join('\n\n');

    const prompt = `Analyze the following project files and generate a comprehensive markdown overview.

## Files to Analyze

${fileSummary}

---

Generate a markdown document with the following sections:

## Project Overview

[Brief description - 2-3 sentences]

## Tech Stack

[Programming languages, frameworks, dependencies]

## Architecture

[High-level structure and main components]

## Key Files and Their Purposes

[Important files and what they do]

## Development Guide

[How to run, test, and build]

## Important Notes

[Conventions, patterns, considerations]

---

REQUIREMENTS:
- Output ONLY the markdown document above
- Start immediately with "## Project Overview"
- Do NOT include explanations, thinking process, or meta-commentary
- Use proper markdown formatting
- Be concise and clear
- Focus on essential information`;

    // Create abort controller for this call
    this.currentAbortController = new AbortController();

    try {
      // Get user profile if available
      const userProfile = await this.session.getUserProfile();

      // Use chatAI for natural language response
      let rawSummary = await chatAI(
        this.session.getConfig(),
        prompt,
        this.getAbortSignal(),
        userProfile || undefined,
        this.toolExecutor?.getRegistry(),
        this.toolExecutor || undefined, // FIX: Pass tool executor to enable tool execution
        undefined, // hookSystem
        undefined, // frontend
        undefined, // imageRefs
        this.session.getProjectRoot(), // projectRoot
        undefined, // skillManager
        this.memoPlugin // 🔥 memo plugin for memory context
      );

      // Extract the actual markdown from AI response
      // Look for content that starts with ## Project Overview
      let summary = rawSummary;

      // Try to find the start of actual markdown
      const overviewMatch = rawSummary.match(/## Project Overview[\s\S]*$/m);
      if (overviewMatch) {
        summary = overviewMatch[0];
      }

      // If summary is empty, provide a fallback
      if (!summary.trim()) {
        return `# Project Overview

This project was analyzed but no detailed summary was generated.

**Project Root**: ${this.session.getProjectRoot()}
**Analysis Date**: ${new Date().toISOString()}

For more information, check the project files directly.`;
      }

      return summary;
    } finally {
      this.resetAbortController();
    }
  }

  /**
   * Write project summary to KODE.md (creates new file or overwrites)
   */
  private async writeProjectSummary(summary: string): Promise<void> {
    const fs = require('fs').promises;
    const path = require('path');

    const kodeMdPath = path.join(this.session.getProjectRoot(), 'KODE.md');
    const timestamp = new Date().toISOString();

    const content = `# KODE.md

> **Last Updated**: ${timestamp}
>
> This file contains the AI's understanding of this project.

---

${summary}

---

*This file is automatically generated by the \`/init\` command. You can edit it manually to add additional context or corrections.*
`;

    try {
      await fs.writeFile(kodeMdPath, content, 'utf-8');
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to write to KODE.md:'), error.message);
      throw error;
    }
  }

  /**
   * Display AI request timing and token usage information
   */
  private async displayAIRequestInfo(aiResp: ExtendedAIResponse, requirement?: string): Promise<void> {
    console.log(chalk.gray('📊 AI Request Information'));
    console.log(chalk.gray('─'.repeat(50)));

    // Display timing
    if (aiResp.duration !== undefined) {
      const durationSec = (aiResp.duration / 1000).toFixed(2);
      console.log(`${chalk.gray('⏱️  Response time:')} ${chalk.white(durationSec + 's')}`);
    }

    // Display token usage
    if (aiResp.usage) {
      const { prompt_tokens, completion_tokens, total_tokens } = aiResp.usage;
      console.log(`${chalk.gray('📊 Tokens:')} ${chalk.white(prompt_tokens.toLocaleString())} prompt + ${chalk.white(completion_tokens.toLocaleString())} completion = ${chalk.white(total_tokens.toLocaleString())} total`);
    }

    // Display ultrathink information if available
    if (aiResp.ultrathinkEnabled) {
      console.log(`${chalk.cyan('🧠 Ultrathink:')} ${chalk.white('Enabled')}`);

      // Display thought tree if available
      if (aiResp.thoughtTree) {
        console.log(chalk.gray('─'.repeat(50)));
        console.log(formatThoughtTree(aiResp.thoughtTree, false));
      }

      // Display plan alternatives if available
      if (aiResp.planAlternatives) {
        console.log(chalk.gray('─'.repeat(50)));
        console.log(formatPlanAlternatives(
          aiResp.planAlternatives.selected,
          aiResp.planAlternatives.rejected,
          false
        ));
      }

      // Save ultrathink data to file
      if (requirement) {
        await this.saveUltrathinkData(requirement, aiResp);
      }
    }

    console.log(chalk.gray('─'.repeat(50)) + '\n');
  }

  /**
   * Save ultrathink reasoning data to file
   */
  private async saveUltrathinkData(
    requirement: string,
    aiResp: ExtendedAIResponse
  ): Promise<void> {
    try {
      const fs = require('fs').promises;
      const path = require('path');

      // Create logs directory
      const logsDir = path.join(this.session.getProjectRoot(), '.ultrathink-logs');
      await fs.mkdir(logsDir, { recursive: true });

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `ultrathink-${timestamp}.json`;
      const filepath = path.join(logsDir, filename);

      // Prepare data to save
      const logData = {
        timestamp: new Date().toISOString(),
        requirement,
        sessionId: this.session.getSessionId(),
        thoughtTree: aiResp.thoughtTree,
        planAlternatives: aiResp.planAlternatives ? {
          selected: {
            id: aiResp.planAlternatives.selected.id,
            reasoning: aiResp.planAlternatives.selected.reasoning,
            actions: aiResp.planAlternatives.selected.actions,
            confidence: aiResp.planAlternatives.selected.confidence,
            estimatedTime: aiResp.planAlternatives.selected.estimatedTime,
            riskLevel: aiResp.planAlternatives.selected.riskLevel,
          },
          rejected: aiResp.planAlternatives.rejected.map(r => ({
            id: r.id,
            reasoning: r.reasoning,
            confidence: r.confidence,
          })),
        } : undefined,
        usage: aiResp.usage,
        duration: aiResp.duration,
      };

      // Write to file
      await fs.writeFile(filepath, JSON.stringify(logData, null, 2), 'utf-8');

      console.log(chalk.gray(`💾 Ultrathink data saved to: ${filename}\n`));
    } catch (error: any) {
      // Don't fail if saving fails, just log warning
      console.log(chalk.yellow(`⚠️  Failed to save ultrathink data: ${error.message}\n`));
    }
  }

  /**
   * Generate reasoning tracking report on session end
   */
  private async generateReasoningReport(): Promise<void> {
    try {
      const tracker = this.session.getReasoningTracker();
      if (!tracker) return;

      console.log(chalk.cyan('\n📊 Generating reasoning trace report...\n'));

      // 保存 JSON 格式的完整追踪数据
      const jsonPath = await tracker.save('reasoning-trace.json');
      console.log(chalk.gray(`💾 JSON report saved to: ${jsonPath}\n`));

      // TODO: 生成 Markdown 报告（需要 serializer）
      // const serializer = new ReasoningSerializer(tracker);
      // const mdPath = await serializer.saveMarkdown('reasoning-report.md');

      console.log(chalk.green('✅ Reasoning trace report generated successfully!\n'));
    } catch (error: any) {
      console.log(chalk.yellow(`⚠️  Failed to generate reasoning report: ${error.message}\n`));
    }
  }

  /**
   * Handle /create-plugin command - Create a new plugin
   */
  private async handleCreatePluginCommand(args: string[]): Promise<void> {
    try {
      const { SkillsCreator } = await import('./skills-creator');

      const creator = new SkillsCreator(
        this.session.getConfig(),
        this.session.getProjectRoot(),
        {
          defaultOutDir: path.join(this.session.getProjectRoot(), 'plugins'),
          verbose: true,
        }
      );

      // Check args for mode
      const mode = args[0] || 'interactive';

      if (mode === 'from-chat' || mode === '--from-chat') {
        // Create from chat history
        console.log(chalk.cyan('\n🎨 Creating plugin from chat history...\n'));

        const messages = this.commandHistory.map((msg, idx) => ({
          role: 'user' as const,
          content: msg,
          timestamp: new Date(),
        }));

        await creator.createFromChat(messages);

      } else if (mode === 'help' || mode === '--help') {
        console.log(chalk.cyan('\n📖 Create Plugin Command\n'));
        console.log(chalk.gray('Usage:'));
        console.log(chalk.gray('  /create-plugin              - Interactive mode'));
        console.log(chalk.gray('  /create-plugin from-chat     - From chat history'));
        console.log(chalk.gray('  /create-plugin <requirement> - From description\n'));

      } else if (args.length > 0 && !mode.startsWith('--')) {
        // Create from requirement string
        const requirement = args.join(' ');
        console.log(chalk.cyan('\n🎨 Creating plugin from requirement...\n'));

        await creator.createFromRequirement(requirement);

      } else {
        // Interactive mode
        console.log(chalk.cyan('\n🎨 Interactive Plugin Creation\n'));
        await creator.createInteractive();
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Failed to create plugin:'), (error as Error).message);
    }
  }

  /**
   * Handle /plugin-list command - List all loaded plugins
   */
  private async handlePluginListCommand(): Promise<void> {
    try {
      // Check if tool executor exists and has plugin system
      if (!this.toolExecutor) {
        console.log(chalk.yellow('\n⚠️  Tool system is not enabled.'));
        console.log(chalk.gray('Start Kode with --use-tools flag to enable plugins.\n'));
        return;
      }

      const pluginSystem = this.toolExecutor.getPluginSystem();

      if (!pluginSystem || !pluginSystem.isEnabled()) {
        console.log(chalk.yellow('\n⚠️  Plugin system is not enabled.'));
        console.log(chalk.gray('Plugins are not loaded. Enable plugin system to use plugins.\n'));
        return;
      }

      // Get plugin registry and list plugins
      const pluginRegistry = pluginSystem.getRegistry();
      const plugins = pluginRegistry.list();

      // Get plugin stats
      const stats = pluginRegistry.getStats();

      console.log(chalk.cyan('\n📦 Loaded Plugins'));
      console.log(chalk.cyan('═'.repeat(60)));
      console.log(chalk.white(`Total: ${chalk.green(stats.total.toString())} plugin(s)`));
      console.log(chalk.white(`By State: ${chalk.gray(JSON.stringify(stats.byState))}`));
      if (stats.withErrors > 0) {
        console.log(chalk.white(`Errors: ${chalk.red(stats.withErrors.toString())} plugin(s)\n`));
      } else {
        console.log(chalk.white('Errors: None\n'));
      }

      if (plugins.length === 0) {
        console.log(chalk.gray('No plugins loaded.\n'));
        return;
      }

      // Display each plugin
      for (const plugin of plugins) {
        const state = pluginRegistry.getState(plugin.id);
        const error = pluginRegistry.getError(plugin.id);

        console.log(chalk.cyan(`\n📦 ${plugin.name}`));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.white(`   ID:          ${chalk.yellow(plugin.id)}`));
        console.log(chalk.white(`   Version:     ${chalk.yellow(plugin.version)}`));
        console.log(chalk.white(`   State:       ${this.formatPluginState(state)}`));

        if (plugin.description) {
          console.log(chalk.white(`   Description: ${chalk.gray(plugin.description)}`));
        }

        if (plugin.metadata?.author) {
          console.log(chalk.white(`   Author:      ${chalk.gray(plugin.metadata.author)}`));
        }

        if (plugin.metadata?.license) {
          console.log(chalk.white(`   License:     ${chalk.gray(plugin.metadata.license)}`));
        }

        // Show tools
        if (plugin.tools && plugin.tools.length > 0) {
          console.log(chalk.white(`   Tools (${plugin.tools.length}):`));
          for (const tool of plugin.tools) {
            const permissions = tool.permissions && tool.permissions.length > 0
              ? chalk.gray(` [${tool.permissions.join(', ')}]`)
              : '';
            console.log(chalk.gray(`     • ${chalk.cyan(tool.name)}: ${tool.description}${permissions}`));
          }
        }

        // Show dependencies if any
        if (plugin.dependencies && plugin.dependencies.length > 0) {
          const deps = plugin.dependencies.map(d => d.pluginId).join(', ');
          console.log(chalk.white(`   Depends on:  ${chalk.gray(deps)}`));
        }

        // Show error if any
        if (error) {
          console.log(chalk.red(`   ❌ Error: ${error.message}`));
        }
      }

      console.log(chalk.cyan('\n═'.repeat(60)) + '\n');

    } catch (error) {
      console.error(chalk.red('\n❌ Failed to list plugins:'), (error as Error).message);
    }
  }

  /**
   * Format plugin state for display
   */
  private formatPluginState(state: any): string {
    const stateColors: Record<string, string> = {
      loaded: chalk.green('LOADED'),
      loading: chalk.yellow('LOADING'),
      unloading: chalk.yellow('UNLOADING'),
      error: chalk.red('ERROR'),
    };

    return stateColors[state] || chalk.gray(state?.toString().toUpperCase() || 'UNKNOWN');
  }

  /**
   * 🔥 Handle /memory-stats command
   */
  private async handleMemoryStatsCommand(): Promise<void> {
    if (!this.session.isMemoryInitialized()) {
      console.log(chalk.yellow('\n⚠️  Memory system not initialized\n'));
      return;
    }

    try {
      const sessionContext = this.session.getSessionContextManager();
      const executionHistory = this.session.getExecutionHistoryManager();
      const errorMemory = this.session.getErrorMemory();
      const preferences = this.session.getPreferencesManager();

      console.log(chalk.cyan('\n📊 Memory System Statistics'));
      console.log(chalk.cyan('═'.repeat(50)));

      // Session context stats
      const sessionStats = await sessionContext.getStats();
      console.log(chalk.white('Session Context:'));
      console.log(chalk.gray('  Total Sessions: ') + chalk.yellow(sessionStats.totalSessions.toString()));
      console.log(chalk.gray('  Total Messages: ') + chalk.yellow(sessionStats.totalMessages.toString()));
      console.log(chalk.gray('  Total Tokens: ') + chalk.yellow(sessionStats.totalTokens.toString()));
      console.log(chalk.gray('  Avg Session Length: ') + chalk.yellow(sessionStats.averageSessionLength.toFixed(1)));

      // Execution history stats
      const executionStats = await executionHistory.getStats();
      console.log(chalk.white('\nExecution History:'));
      console.log(chalk.gray('  Total Commands: ') + chalk.yellow(executionStats.totalCommands.toString()));
      console.log(chalk.gray('  Success Rate: ') + chalk.yellow(`${executionStats.successRate.toFixed(1)}%`));
      console.log(chalk.gray('  Avg Duration: ') + chalk.yellow(`${executionStats.averageCommandDuration.toFixed(0)}ms`));

      // Error memory stats
      console.log(chalk.white('\nError Memory:'));
      console.log(chalk.gray('  Total Errors: ') + chalk.yellow('N/A (not implemented)'));
      console.log(chalk.gray('  Unique Errors: ') + chalk.yellow('N/A (not implemented)'));
      console.log(chalk.gray('  Most Common: ') + chalk.yellow('N/A (not implemented)'));

      // Preferences
      const userPrefs = await preferences.getPreferences();
      console.log(chalk.white('\nUser Preferences:'));
      console.log(chalk.gray('  Languages: ') + chalk.yellow(userPrefs?.techStack?.primaryLanguages?.join(', ') || 'Not set'));
      console.log(chalk.gray('  Frameworks: ') + chalk.yellow(userPrefs?.techStack?.preferredFrameworks?.join(', ') || 'Not set'));

      console.log(chalk.cyan('═'.repeat(50)) + '\n');
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to get memory stats:'), error.message);
    }
  }

  /**
   * 🔥 Handle /memory-sessions command
   */
  private async handleMemorySessionsCommand(args: string[]): Promise<void> {
    if (!this.session.isMemoryInitialized()) {
      console.log(chalk.yellow('\n⚠️  Memory system not initialized\n'));
      return;
    }

    try {
      const sessionContext = this.session.getSessionContextManager();
      const limit = args.length > 0 ? parseInt(args[0]) : 10;

      console.log(chalk.cyan(`\n📋 Recent Sessions (Last ${limit})`));
      console.log(chalk.cyan('═'.repeat(50)));

      const sessions = await sessionContext.getRecentSessions(limit);

      if (sessions.length === 0) {
        console.log(chalk.gray('No sessions found\n'));
        return;
      }

      for (const session of sessions) {
        const startTime = new Date(session.startTime).toLocaleString('zh-CN');
        const endTime = session.endTime || new Date().toISOString();
        const duration = ((new Date(endTime).getTime() - new Date(session.startTime).getTime()) / 1000).toFixed(0);
        const messageCount = session.messages ? session.messages.length : 0;
        console.log(chalk.white(`\n📅 Session: ${session.id}`));
        console.log(chalk.gray(`  Start: ${startTime}`));
        console.log(chalk.gray(`  Duration: ${duration}s`));
        console.log(chalk.gray(`  Messages: ${messageCount}`));
      }

      console.log(chalk.cyan('\n' + '═'.repeat(50)) + '\n');
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to get sessions:'), error.message);
    }
  }

  /**
   * 🔥 Handle /memory-errors command
   */
  private async handleMemoryErrorsCommand(args: string[]): Promise<void> {
    if (!this.session.isMemoryInitialized()) {
      console.log(chalk.yellow('\n⚠️  Memory system not initialized\n'));
      return;
    }

    try {
      console.log(chalk.cyan('\n🐛 Error Memory'));
      console.log(chalk.cyan('═'.repeat(50)));
      console.log(chalk.gray('Error memory functionality is not yet fully implemented.'));
      console.log(chalk.gray('This feature will be available in a future update.\n'));
      console.log(chalk.cyan('═'.repeat(50)) + '\n');
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to get errors:'), error.message);
    }
  }

  /**
   * 🔥 Handle /memory-search command
   */
  private async handleMemorySearchCommand(args: string[]): Promise<void> {
    if (!this.session.isMemoryInitialized()) {
      console.log(chalk.yellow('\n⚠️  Memory system not initialized\n'));
      return;
    }

    if (args.length === 0) {
      console.log(chalk.yellow('\n⚠️  Usage: /memory-search <query>\n'));
      return;
    }

    try {
      const sessionContext = this.session.getSessionContextManager();
      const query = args.join(' ');
      const limit = 5; // 固定限制

      console.log(chalk.cyan(`\n🔍 Search Results for: "${query}"`));
      console.log(chalk.cyan('═'.repeat(50)));

      // 简化实现：获取所有会话并搜索
      const sessions = await sessionContext.getRecentSessions(100);
      const matches: { session: any; message: any; score: number }[] = [];

      for (const session of sessions) {
        if (!session.messages) continue;
        for (const message of session.messages) {
          if (message.content && message.content.toLowerCase().includes(query.toLowerCase())) {
            matches.push({
              session,
              message,
              score: 1.0, // 简化评分
            });
          }
        }
      }

      if (matches.length === 0) {
        console.log(chalk.gray('No matches found\n'));
        return;
      }

      // 限制结果数量
      const limitedMatches = matches.slice(0, limit);

      for (const match of limitedMatches) {
        const role = match.message.role === 'user' ? '👤 User' : '🤖 AI';
        const time = new Date(match.message.timestamp).toLocaleString('zh-CN');
        console.log(chalk.white(`\n${role} - ${time}`));
        console.log(chalk.gray(`  ${match.message.content.substring(0, 100)}...`));
        console.log(chalk.gray(`  Score: ${match.score.toFixed(2)}`));
      }

      console.log(chalk.cyan('\n' + '═'.repeat(50)) + '\n');
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to search memory:'), error.message);
    }
  }

  /**
   * 🔥 Helper methods for intent recognition config management
   * These methods integrate with settings.json for persistent configuration
   */

  /**
   * Load settings.json file
   */
  private async loadSettingsFile(): Promise<any> {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');

    // Try local settings first
    const localSettings = path.join(process.cwd(), 'settings.json');
    if (fs.existsSync(localSettings)) {
      const content = fs.readFileSync(localSettings, 'utf-8');
      return JSON.parse(content);
    }

    // Try global settings
    const homeDir = os.homedir();
    const globalSettings = path.join(homeDir, '.kode', 'settings.json');
    if (fs.existsSync(globalSettings)) {
      const content = fs.readFileSync(globalSettings, 'utf-8');
      return JSON.parse(content);
    }

    // Return empty config if no settings file
    return {};
  }

  /**
   * Save settings to settings.json
   */
  private async saveSettingsFile(config: any): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');

    // Use local settings if it exists, otherwise use global
    const localSettings = path.join(process.cwd(), 'settings.json');
    const homeDir = os.homedir();
    const globalSettings = path.join(homeDir, '.kode', 'settings.json');

    const settingsPath = fs.existsSync(localSettings) ? localSettings : globalSettings;

    // Ensure directory exists
    const dir = path.dirname(settingsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write settings
    fs.writeFileSync(settingsPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  /**
   * Get intent recognition config from settings.json
   */
  private async getIntentRecognitionConfig(): Promise<any> {
    const settings = await this.loadSettingsFile();
    return settings?.intentRecognition ?? {};
  }

  /**
   * 🔥 Handle /skill-list command
   */
  private async handleSkillListCommand(args: string[]): Promise<void> {
    try {
      const skills = await this.skillManager.discoverSkills();
      const showAll = args.includes('--all');

      console.log(chalk.cyan('\n📋 Installed Skills'));
      console.log(chalk.cyan('═'.repeat(60)));
      console.log(chalk.gray(`Total: ${skills.length} skill(s)\n`));

      for (const skill of skills) {
        const metadata = skill.metadata;
        const registryEntry = this.skillRegistry.getSkill(metadata.name);
        const enabled = registryEntry?.enabled;

        console.log(`${enabled ? chalk.green('✓') : chalk.red('✗')} ${chalk.white(metadata.name)}`);
        console.log(`  ${chalk.gray(metadata.description.substring(0, 70))}${metadata.description.length > 70 ? '...' : ''}`);
        console.log(`  ${chalk.cyan('Type:')} ${chalk.white(metadata.type)} | ${chalk.cyan('Version:')} ${chalk.white(metadata.version || '1.0.0')}`);

        if (showAll) {
          console.log(`  ${chalk.cyan('Author:')} ${chalk.white(metadata.author || 'Unknown')}`);
          console.log(`  ${chalk.cyan('Tags:')} ${chalk.white(metadata.tags.join(', ') || 'none')}`);
          const usageCount = registryEntry?.usageCount || 0;
          console.log(`  ${chalk.cyan('Usage:')} ${chalk.white(usageCount + ' time(s)')}`);
        }

        console.log('');
      }

      console.log(chalk.cyan('═'.repeat(60)));
      console.log(chalk.gray('Use: /skill-info <name> to view details\n'));
    } catch (error) {
      console.error(chalk.red(`\n❌ Failed to list skills: ${(error as Error).message}`));
    }
  }

  /**
   * 🔥 Handle /skill-info command
   */
  private async handleSkillInfoCommand(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log(chalk.yellow('\n⚠️  Usage: /skill-info <skill-name>\n'));
      return;
    }

    const skillName = args[0];

    try {
      const skill = this.skillManager.getSkill(skillName);

      if (!skill) {
        console.log(chalk.yellow(`\n⚠️  Skill not found: ${skillName}\n`));
        return;
      }

      const metadata = skill.metadata;
      const registryEntry = this.skillRegistry.getSkill(skillName);

      console.log(chalk.cyan(`\n📋 ${skillName}`));
      console.log(chalk.cyan('═'.repeat(60)));

      console.log(chalk.white('\nDescription:'));
      console.log(chalk.gray(`  ${metadata.description}`));

      console.log(chalk.white('\nDetails:'));
      console.log(chalk.gray(`  Version: ${metadata.version || '1.0.0'}`));
      console.log(chalk.gray(`  Type: ${metadata.type}`));
      console.log(chalk.gray(`  Status: ${registryEntry?.enabled ? chalk.green('Enabled') : chalk.red('Disabled')}`));
      console.log(chalk.gray(`  Source: ${registryEntry?.source || 'local'}`));

      if (metadata.author) {
        console.log(chalk.white('\nAuthor:'));
        console.log(chalk.gray(`  ${metadata.author}`));
      }

      if (metadata.license) {
        console.log(chalk.white('\nLicense:'));
        console.log(chalk.gray(`  ${metadata.license}`));
      }

      if (metadata.tags && metadata.tags.length > 0) {
        console.log(chalk.white('\nTags:'));
        console.log(chalk.gray(`  ${metadata.tags.join(' ')}`));
      }

      if (metadata.triggers && metadata.triggers.length > 0) {
        console.log(chalk.white('\nTriggers:'));
        metadata.triggers.forEach((trigger: string) => {
          console.log(chalk.gray(`  • ${trigger}`));
        });
      }

      if (registryEntry) {
        console.log(chalk.white('\nUsage Statistics:'));
        console.log(chalk.gray(`  Executed: ${registryEntry.usageCount || 0} time(s)`));
        console.log(chalk.gray(`  Last used: ${registryEntry.lastUsedAt ? new Date(registryEntry.lastUsedAt).toLocaleString() : 'Never'}`));
      }

      console.log(chalk.white('\nLocation:'));
      console.log(chalk.gray(`  Path: ${skill.path}`));
      console.log(chalk.gray(`  SKILL.md: ${path.join(skill.path, 'SKILL.md')}`));

      console.log(chalk.cyan('\n═'.repeat(60)) + '\n');
    } catch (error) {
      console.error(chalk.red(`\n❌ Failed to get skill info: ${(error as Error).message}`));
    }
  }

  /**
   * 🔥 Handle /skill-install command
   */
  private async handleSkillInstallCommand(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log(chalk.yellow('\n⚠️  Usage: /skill-install <url-or-package>\n'));
      console.log(chalk.gray('Examples:'));
      console.log(chalk.gray('  /skill-install github:anthropics/skills'));
      console.log(chalk.gray('  /skill-install @anthropics/anthropic-agent-skills/document-skills'));
      console.log(chalk.gray('  /skill-install https://example.com/skill.zip'));
      console.log(chalk.gray('  /skill-install ./skill.zip\n'));
      return;
    }

    const source = args[0];

    // P1: Validate source — only allow URLs or npm package names
    const safeSourcePattern = /^(https?:\/\/[^\s;|&`$]+|github:[a-zA-Z0-9._/-]+|@[a-zA-Z0-9._/-]+|[a-zA-Z0-9@._/-]+)$/;
    if (!safeSourcePattern.test(source)) {
      console.log(chalk.red('\n❌ Invalid skill source. Only URLs (http/https), GitHub paths (github:...), or npm package names are allowed.\n'));
      return;
    }

    // P2: Prevent concurrent installations
    if (this.isInstalling) {
      console.log(chalk.yellow('\n⚠️  A skill installation is already in progress. Please wait.\n'));
      return;
    }
    this.isInstalling = true;

    const force = args.includes('--force') || args.includes('-f');
    const skipValidation = args.includes('--skip-validation') || args.includes('-s');

    console.log(chalk.cyan('\n📦 Installing Skill...'));
    console.log(chalk.cyan('═'.repeat(60)));

    try {
      const { execFile } = await import('child_process');

      const installArgs = [source];
      if (force) installArgs.push('--force');
      if (skipValidation) installArgs.push('--skip-validation');

      console.log(chalk.gray(`\nRunning: npx ts-node bin/newma-skill-install.ts ${installArgs.join(' ')}\n`));

      await new Promise<void>((resolve, reject) => {
        const proc = execFile(
          'npx',
          ['ts-node', 'bin/newma-skill-install.ts', ...installArgs],
          { cwd: this.session.getProjectRoot(), timeout: 120000 }, // 2 分钟超时
          (error, stdout, stderr) => {
            if (error) {
              console.error(chalk.red(stderr || error.message));
              reject(error);
            } else {
              console.log(stdout);
              resolve();
            }
          }
        );
      });

      // 重新加载 skills
      await this.skillManager.discoverSkills();

      console.log(chalk.green('\n✅ Skill installation completed\n'));
    } catch (error) {
      console.error(chalk.red(`\n❌ Installation failed: ${(error as Error).message}\n`));
    } finally {
      this.isInstalling = false;
    }
  }

  /**
   * 🔥 Handle /skill-uninstall command
   */
  private async handleSkillUninstallCommand(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log(chalk.yellow('\n⚠️  Usage: /skill-uninstall <skill-name>\n'));
      return;
    }

    const skillName = args[0];

    try {
      const skill = this.skillManager.getSkill(skillName);

      if (!skill) {
        console.log(chalk.yellow(`\n⚠️  Skill not found: ${skillName}\n`));
        return;
      }

      // 确认删除
      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to uninstall skill "${skillName}"?`,
          default: false,
        },
      ]);

      if (!answers.confirm) {
        console.log(chalk.gray('\n✖ Cancelled\n'));
        return;
      }

      const skillDir = skill.path;

      // P2: Path traversal check — ensure skillDir is within project root
      const projectRoot = path.resolve(this.session.getProjectRoot());
      const resolvedSkillDir = path.resolve(skillDir);
      if (!resolvedSkillDir.startsWith(projectRoot + path.sep) && resolvedSkillDir !== projectRoot) {
        console.log(chalk.red('\n❌ Security: Skill path is outside the project directory. Refusing to delete.\n'));
        return;
      }

      // 删除文件（必须在 unregister 之前）
      const { rm } = await import('fs/promises');
      await rm(skillDir, { recursive: true, force: true });

      // P2: Only unregister AFTER successful deletion
      if (this.skillRegistry.hasSkill(skillName)) {
        this.skillRegistry.unregisterSkill(skillName);
      }

      console.log(chalk.green(`\n✅ Skill "${skillName}" uninstalled\n`));

      // 重新加载 skills
      await this.skillManager.discoverSkills();
    } catch (error) {
      console.error(chalk.red(`\n❌ Failed to uninstall skill: ${(error as Error).message}\n`));
    }
  }

  /**
   * 🔥 Handle /skill-search command
   */
  private async handleSkillSearchCommand(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log(chalk.yellow('\n⚠️  Usage: /skill-search <query>\n'));
      return;
    }

    const query = args.join(' ').toLowerCase();

    try {
      const skills = await this.skillManager.discoverSkills();
      const filtered = skills.filter(skill => {
        const metadata = skill.metadata;
        return (
          metadata.name.toLowerCase().includes(query) ||
          metadata.description.toLowerCase().includes(query) ||
          metadata.tags.some((tag: string) => tag.toLowerCase().includes(query))
        );
      });

      console.log(chalk.cyan(`\n🔍 Search Results: "${query}"`));
      console.log(chalk.cyan('═'.repeat(60)));
      console.log(chalk.gray(`Found ${filtered.length} skill(s)\n`));

      if (filtered.length === 0) {
        console.log(chalk.gray('No skills found matching your query.\n'));
      } else {
        for (const skill of filtered) {
          const metadata = skill.metadata;
          console.log(`${chalk.white(metadata.name)}`);
          console.log(`  ${chalk.gray(metadata.description.substring(0, 70))}${metadata.description.length > 70 ? '...' : ''}`);
          console.log(`  ${chalk.cyan('Tags:')} ${chalk.white(metadata.tags.join(', ') || 'none')}`);
          console.log('');
        }
      }

      console.log(chalk.cyan('═'.repeat(60)) + '\n');
    } catch (error) {
      console.error(chalk.red(`\n❌ Failed to search skills: ${(error as Error).message}\n`));
    }
  }
}
