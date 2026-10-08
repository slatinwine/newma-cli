// src/session.ts
import chalk from 'chalk';
import fs from 'fs';
import { ExecutionTracker } from './history';
import { Config } from './config';
import { PermissionLevel } from './permissions';
import { ReasoningTracker } from './ultrathink/tracker';
import { TaskTracker } from './task-tracker/tracker';
import { TaskStorage } from './task-tracker/storage';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  SessionContextManager,
  ExecutionHistoryManager,
  PreferencesManager,
  ErrorMemoryManager,
} from './memory';

/**
 * 会话状态管理器
 * 管理 REPL 会话的状态、历史和配置
 */
export class SessionManager {
  private sessionId: string;
  private startTime: Date;
  private commandCount: number = 0;
  private projectRoot: string;
  private config: Config;
  private permissionLevel: PermissionLevel;
  private useTools: boolean;
  private useVerify: boolean;
  private useMultiAgent: boolean;
  private enableAutonomous: boolean;
  private tracker: ExecutionTracker;
  private currentMode: 'plan' | 'verify' = 'plan';
  private iterationCount: number = 0;
  private ultrathinkEnabled: boolean = false;
  private readonly PROFILE_FILE = '用户侧写.md'; // 侧写文件名（由插件管理）
  private reasoningTracker: ReasoningTracker | null = null; // Ultrathink 追踪器
  private traceDir: string | null = null; // 追踪数据输出目录
  private userInputs: string[] = []; // 用户输入历史（用于生成侧写）
  private readonly PROFILE_UPDATE_INTERVAL = 3; // 每3次对话更新一次侧写
  private taskTracker: TaskTracker; // Task tracker

  // 🔥 新增：记忆管理器
  private sessionContextManager: SessionContextManager;
  private executionHistoryManager: ExecutionHistoryManager;
  private preferencesManager: PreferencesManager;
  private errorMemory: ErrorMemoryManager;
  private memoryInitialized: boolean = false;

  // 🔥 新增：Review Mode状态
  private reviewModeEnabled: boolean = false;

  // 🔥 新增：事件驱动运行时选项
  private useRuntime: boolean = false;

  constructor(
    projectRoot: string,
    config: Config,
    options: {
      permissionLevel?: PermissionLevel;
      useTools?: boolean;
      useVerify?: boolean;
      useMultiAgent?: boolean;
      enableAutonomous?: boolean;
      traceDir?: string; // 追踪数据输出目录
      useRuntime?: boolean; // 🔥 新增：是否使用事件驱动运行时
    } = {}
  ) {
    this.sessionId = this.generateSessionId();
    this.startTime = new Date();
    this.projectRoot = path.resolve(projectRoot);
    this.config = config;
    this.permissionLevel = options.permissionLevel ?? PermissionLevel.SAFE;
    this.useTools = options.useTools ?? false;
    this.useVerify = options.useVerify ?? false;
    this.useMultiAgent = options.useMultiAgent ?? false;
    this.enableAutonomous = options.enableAutonomous ?? false;
    this.useRuntime = options.useRuntime ?? false; // 🔥 新增
    this.tracker = new ExecutionTracker();

    // Initialize task tracker
    const taskStorage = new TaskStorage({
      dataDir: path.join(this.projectRoot, '.memo', 'tasks'),  // 🔥 修改：统一存储到 .memo/ 目录
      compressAfterDays: 30,
      compressionLevel: 9,
      algorithm: 'gzip',
    });
    this.taskTracker = new TaskTracker(taskStorage);

    // 初始化追踪器（如果指定了输出目录）
    this.traceDir = options.traceDir ?? null;
    if (this.traceDir) {
      this.reasoningTracker = new ReasoningTracker(this.traceDir);
    }

    // 🔥 初始化记忆管理器
    this.sessionContextManager = new SessionContextManager(this.projectRoot);
    this.executionHistoryManager = new ExecutionHistoryManager(this.projectRoot);
    this.preferencesManager = new PreferencesManager(this.projectRoot);
    this.errorMemory = new ErrorMemoryManager(this.projectRoot);

    // 🔥 初始化Review Mode状态
    this.reviewModeEnabled = config.reviewMode?.enabled ?? false;
  }

  /**
   * 🔥 初始化记忆系统
   * 在会话开始时调用
   */
  async initializeMemory(): Promise<void> {
    if (this.memoryInitialized) {
      return;
    }

    try {
      // 并行初始化所有记忆管理器
      await Promise.all([
        this.sessionContextManager.initialize(),
        this.executionHistoryManager.initialize(),
        this.preferencesManager.initialize(),
        this.errorMemory.initialize(),
      ]);

      // 创建当前会话的上下文和历史记录
      await this.sessionContextManager.createSession(this.sessionId);
      await this.executionHistoryManager.createSession(this.sessionId, this.projectRoot);

      this.memoryInitialized = true;
      console.log('🧠 Memory system initialized');
    } catch (error) {
      console.error('Failed to initialize memory system:', error);
      // 不抛出错误，允许会话继续
    }
  }

  /**
   * 🔥 保存记忆系统
   * 在会话结束时调用
   */
  async saveMemory(): Promise<void> {
    if (!this.memoryInitialized) {
      return;
    }

    try {
      // 并行保存所有记忆
      await Promise.all([
        this.sessionContextManager.endSession(),
        this.executionHistoryManager.endSession(),
      ]);
    } catch (error) {
      console.error('Failed to save memory:', error);
    }
  }

  /**
   * 🔥 获取会话上下文管理器
   */
  getSessionContextManager(): SessionContextManager {
    return this.sessionContextManager;
  }

  /**
   * 🔥 获取执行历史管理器
   */
  getExecutionHistoryManager(): ExecutionHistoryManager {
    return this.executionHistoryManager;
  }

  /**
   * 🔥 获取偏好管理器
   */
  getPreferencesManager(): PreferencesManager {
    return this.preferencesManager;
  }

  /**
   * 🔥 获取错误记忆
   */
  getErrorMemory(): ErrorMemoryManager {
    return this.errorMemory;
  }

  /**
   * 🔥 检查记忆系统是否已初始化
   */
  isMemoryInitialized(): boolean {
    return this.memoryInitialized;
  }

  /**
   * 生成会话 ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  /**
   * 获取会话 ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * 获取项目根目录
   */
  getProjectRoot(): string {
    return this.projectRoot;
  }

  /**
   * 获取配置
   */
  getConfig(): Config {
    return this.config;
  }

  /**
   * 获取权限级别
   */
  getPermissionLevel(): PermissionLevel {
    return this.permissionLevel;
  }

  /**
   * 是否使用工具系统
   */
  isToolEnabled(): boolean {
    return this.useTools;
  }

  /**
   * 是否启用验证
   */
  isVerifyEnabled(): boolean {
    return this.useVerify;
  }

  /**
   * 设置 ultrathink 状态
   */
  setUltrathink(enabled: boolean): void {
    this.ultrathinkEnabled = enabled;
  }

  /**
   * 设置验证状态
   */
  setVerify(enabled: boolean): void {
    this.useVerify = enabled;
  }

  /**
   * 设置 Function Calling API 状态
   */
  setFunctionCalling(enabled: boolean): void {
    this.config.functionCallingEnabled = enabled;
  }

  /**
   * 设置执行模式
   */
  setExecutionMode(mode: 'function-calling' | 'two-phase' | 'multi-agent' | 'subagent' | 'standard'): void {
    this.config.executionMode = mode;
  }

  /**
   * 获取当前执行模式
   */
  getExecutionMode(): 'function-calling' | 'two-phase' | 'multi-agent' | 'subagent' | 'standard' {
    return this.config.executionMode || 'standard';
  }

  /**
   * 设置 FFT（快速节俭树）模式状态
   */
  setFFT(enabled: boolean): void {
    this.config.useFFT = enabled;
  }

  /**
   * 是否启用 FFT 模式
   */
  isFFTEnabled(): boolean {
    return this.config.useFFT === true;
  }

  /**
   * 切换 FFT 模式状态
   */
  toggleFFT(): boolean {
    this.config.useFFT = !this.config.useFFT;
    return this.config.useFFT === true;
  }

  /**
   * 设置 Landmark Counting 状态
   */
  setLandmark(enabled: boolean): void {
    this.config.useLandmark = enabled;
  }

  /**
   * 是否启用 Landmark Counting
   */
  isLandmarkEnabled(): boolean {
    return this.config.useLandmark === true;
  }

  /**
   * 切换 Landmark Counting 状态
   */
  toggleLandmark(): boolean {
    this.config.useLandmark = !this.config.useLandmark;
    return this.config.useLandmark === true;
  }

  /**
   * 是否使用多智能体
   */
  isMultiAgentEnabled(): boolean {
    return this.useMultiAgent;
  }

  /**
   * 是否启用自主模式
   */
  isAutonomousEnabled(): boolean {
    return this.enableAutonomous;
  }

  /**
   * 设置自主模式状态
   */
  setAutonomous(enabled: boolean): void {
    this.enableAutonomous = enabled;
  }

  /**
   * 是否启用 ultrathink（显示 AI 请求详情）
   */
  isUltrathinkEnabled(): boolean {
    return this.ultrathinkEnabled;
  }

  /**
   * 切换 ultrathink 状态
   */
  toggleUltrathink(): boolean {
    this.ultrathinkEnabled = !this.ultrathinkEnabled;
    return this.ultrathinkEnabled;
  }

  /**
   * 获取执行追踪器
   */
  getTracker(): ExecutionTracker {
    return this.tracker;
  }

  /**
   * 获取任务追踪器
   */
  getTaskTracker(): TaskTracker {
    return this.taskTracker;
  }

  /**
   * 获取推理追踪器（Ultrathink）
   */
  getReasoningTracker(): ReasoningTracker | null {
    return this.reasoningTracker;
  }

  /**
   * 是否启用推理追踪
   */
  isReasoningTrackingEnabled(): boolean {
    return this.reasoningTracker !== null;
  }

  /**
   * 获取当前模式
   */
  getCurrentMode(): 'plan' | 'verify' {
    return this.currentMode;
  }

  /**
   * 设置当前模式
   */
  setMode(mode: 'plan' | 'verify'): void {
    this.currentMode = mode;
  }

  /**
   * 获取迭代计数
   */
  getIterationCount(): number {
    return this.iterationCount;
  }

  /**
   * 增加迭代计数
   */
  incrementIteration(): void {
    this.iterationCount++;
  }

  /**
   * 重置迭代计数
   */
  resetIteration(): void {
    this.iterationCount = 0;
  }

  /**
   * 增加命令计数
   */
  incrementCommandCount(): void {
    this.commandCount++;
  }

  /**
   * 获取会话统计信息
   */
  getStats(): SessionStats {
    const duration = Date.now() - this.startTime.getTime();
    const trackerSummary = this.tracker.getSummary();

    return {
      sessionId: this.sessionId,
      startTime: this.startTime,
      duration,
      commandCount: this.commandCount,
      projectRoot: this.projectRoot,
      permissionLevel: this.permissionLevel,
      useTools: this.useTools,
      useVerify: this.useVerify,
      useMultiAgent: this.useMultiAgent,
      enableAutonomous: this.enableAutonomous,
      ultrathinkEnabled: this.ultrathinkEnabled,
      totalActions: trackerSummary.totalActions,
      successfulActions: trackerSummary.successful,
      failedActions: trackerSummary.failed,
      rolledBackActions: trackerSummary.rolledBack,
      currentMode: this.currentMode,
      iterationCount: this.iterationCount,
    };
  }

  /**
   * 打印会话状态
   */
  printStatus(): void {
    const stats = this.getStats();
    const durationMin = (stats.duration / 60000).toFixed(1);

    console.log(chalk.cyan('\n📊 Session Status'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(`${chalk.gray('Session ID:')}     ${stats.sessionId}`);
    console.log(`${chalk.gray('Project:')}        ${path.basename(stats.projectRoot)}`);
    console.log(`${chalk.gray('Duration:')}       ${durationMin} min`);
    console.log(`${chalk.gray('Commands:')}       ${stats.commandCount}`);
    console.log(chalk.cyan('─'.repeat(50)));

    console.log(`${chalk.gray('Current Mode:')}   ${stats.currentMode.toUpperCase()}`);
    console.log(`${chalk.gray('Iterations:')}     ${stats.iterationCount}`);
    console.log(chalk.cyan('─'.repeat(50)));

    console.log(`${chalk.gray('Permission:')}     ${stats.permissionLevel}`);
    console.log(`${chalk.gray('Tools:')}          ${stats.useTools ? chalk.green('Enabled') : chalk.gray('Disabled')}`);
    console.log(`${chalk.gray('Verification:')}   ${stats.useVerify ? chalk.green('Enabled') : chalk.gray('Disabled')}`);
    console.log(`${chalk.gray('Multi-Agent:')}    ${stats.useMultiAgent ? chalk.green('Enabled') : chalk.gray('Disabled')}`);
    console.log(`${chalk.gray('Autonomous:')}     ${stats.enableAutonomous ? chalk.green('Enabled') : chalk.gray('Disabled')}`);
    console.log(`${chalk.gray('Ultrathink:')}     ${stats.ultrathinkEnabled ? chalk.green('Enabled') : chalk.gray('Disabled')}`);

    if (stats.totalActions > 0) {
      console.log(chalk.cyan('─'.repeat(50)));
      console.log(`${chalk.gray('Total Actions:')}  ${stats.totalActions}`);
      console.log(`${chalk.green('✅ Success:')}     ${stats.successfulActions}`);
      if (stats.failedActions > 0) {
        console.log(`${chalk.red('❌ Failed:')}      ${stats.failedActions}`);
      }
      if (stats.rolledBackActions > 0) {
        console.log(`${chalk.yellow('↩️  Rolled Back:')} ${stats.rolledBackActions}`);
      }
    }

    console.log(chalk.cyan('═'.repeat(50)));
  }

  /**
   * 打印欢迎信息
   */
  printWelcome(): void {
    // ASCII Art for Newma
    const asciiArt = chalk.cyan(`
          ┌─────────┐
          │  ◉   ◉  │
      ────┤    ▼    ├────
          │         │
      ┌───┴─────────┴───┐
      │                 │
   ───┤     NEWMA       ├──
      │                 │
      │    ╔═══════╗    │
      └────╢       ╟────┘
           ╚═══════╝
    `);

    console.log(asciiArt);
    // 版本号从包根的 package.json 读取（与 --version 同源；
    // 本模块位于 dist/ 或 src/，上一级即包根）
    let version = '';
    try {
      const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
      if (fs.existsSync(pkgPath)) {
        version = ' v' + JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version;
      }
    } catch {
      // 版本号仅用于展示，失败不打扰
    }
    console.log(chalk.cyan('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║') + chalk.white.bold(`        Newma (牛码) AI Assistant${version} - Interactive Mode`) + chalk.cyan('║'));
    console.log(chalk.cyan('╚══════════════════════════════════════════════════════════════╝'));
    console.log(chalk.gray(`\nSession: ${this.sessionId}`));
    console.log(chalk.gray(`Project: ${path.basename(this.projectRoot)}\n`));

    console.log(chalk.white('💬 Default: Chat with AI'));
    console.log(chalk.white('🎯 Task: Use /plan or /do to execute tasks'));
    console.log(chalk.gray('\nSpecial commands:'));
    console.log(chalk.gray('  /plan or /do - Execute task with planning'));
    console.log(chalk.gray('  /status     - Show session status'));
    console.log(chalk.gray('  /clear      - Clear screen'));
    console.log(chalk.gray('  /history    - Show command history'));
    console.log(chalk.gray('  /help       - Show all commands'));
    console.log(chalk.gray('  /exit       - Exit session'));

    console.log(chalk.gray('\n💡 Tip: Use ↑/↓ arrow keys to browse command history\n'));
  }

  /**
   * 打印命令历史
   */
  printHistory(commands: string[]): void {
    if (commands.length === 0) {
      console.log(chalk.yellow('\n📜 No commands in history yet.\n'));
      return;
    }

    console.log(chalk.cyan('\n📜 Command History'));
    console.log(chalk.cyan('═'.repeat(50)));
    commands.forEach((cmd, idx) => {
      const num = (idx + 1).toString().padStart(3, ' ');
      const truncated = cmd.length > 60 ? cmd.substring(0, 57) + '...' : cmd;
      console.log(chalk.gray(`${num}. ${truncated}`));
    });
    console.log(chalk.cyan('═'.repeat(50)) + '\n');
  }

  /**
   * 读取用户侧写（由 user-profile-plugin 管理）
   * 这个方法保留用于向后兼容，直接从文件读取
   */
  async getUserProfile(): Promise<string> {
    const profilePath = path.join(this.projectRoot, this.PROFILE_FILE);

    try {
      const content = await fs.promises.readFile(profilePath, 'utf-8');
      return content;
    } catch (error) {
      // 文件不存在，返回空字符串
      return '';
    }
  }

  /**
   * 记录用户输入（用于生成用户侧写）
   */
  recordUserInput(input: string): void {
    this.userInputs.push(input);
  }

  /**
   * 检查是否应该更新用户侧写
   */
  shouldUpdateProfile(): boolean {
    return this.userInputs.length >= this.PROFILE_UPDATE_INTERVAL;
  }

  /**
   * 获取用户输入历史
   */
  getUserInputs(): string[] {
    return [...this.userInputs]; // 返回副本
  }

  /**
   * 清空用户输入历史
   */
  clearUserInputs(): void {
    this.userInputs = [];
  }

  /**
   * 获取侧写更新间隔
   */
  getProfileUpdateInterval(): number {
    return this.PROFILE_UPDATE_INTERVAL;
  }

  /**
   * 🔥 启用Review Mode
   */
  enableReviewMode(): void {
    this.reviewModeEnabled = true;
    // 更新config
    if (this.config.reviewMode) {
      this.config.reviewMode.enabled = true;
    } else {
      this.config.reviewMode = { enabled: true };
    }
  }

  /**
   * 🔥 禁用Review Mode
   */
  disableReviewMode(): void {
    this.reviewModeEnabled = false;
    // 更新config
    if (this.config.reviewMode) {
      this.config.reviewMode.enabled = false;
    }
  }

  /**
   * 🔥 检查Review Mode是否启用
   */
  isReviewModeEnabled(): boolean {
    return this.reviewModeEnabled;
  }

  /**
   * 🔥 检查是否使用事件驱动运行时
   */
  isUsingRuntime(): boolean {
    return this.useRuntime;
  }

  /**
   * 获取 TaskLifecyclePlugin（用于 Loop 系统注册）
   * 此方法动态导入并创建 TaskLifecyclePlugin 实例
   */
  getTaskLifecyclePlugin(): any {
    try {
      // 动态导入以避免循环依赖
      const { TaskLifecyclePlugin } = require('./task-tracker/plugin');
      return new TaskLifecyclePlugin(this.taskTracker);
    } catch (error: any) {
      console.warn('Could not load TaskLifecyclePlugin:', error.message);
      return null;
    }
  }
}

/**
 * 会话统计信息
 */
export interface SessionStats {
  sessionId: string;
  startTime: Date;
  duration: number;
  commandCount: number;
  projectRoot: string;
  permissionLevel: PermissionLevel;
  useTools: boolean;
  useVerify: boolean;
  useMultiAgent: boolean;
  enableAutonomous: boolean;
  ultrathinkEnabled: boolean;
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  rolledBackActions: number;
  currentMode: 'plan' | 'verify';
  iterationCount: number;
}
