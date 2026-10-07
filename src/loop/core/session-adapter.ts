/**
 * Session Adapter
 *
 * 将现有的 SessionManager 适配到 LoopSession 接口
 * 保持向后兼容性
 */

import path from 'path';
import fs from 'fs/promises';
import { SessionManager } from '../../session';
import {
  LoopSession,
  LoopSessionState,
  LoopState,
  SessionStats,
  LoopSessionOptions,
  Permission,
} from '../interfaces/session';
import { Config } from '../../config';
import { ExecutionRecord } from '../../history';
import { Plan } from '../interfaces/flow-controller';
import { LoopFrontend, OutputStyle } from '../interfaces/frontend';
import { HookSystem, HookType } from '../../hooks';

/**
 * 生成简单的 UUID
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Loop 会话管理器适配器
 *
 * 将 SessionManager 适配到 LoopSession 接口
 * 这样可以复用现有的会话管理逻辑
 */
export class LoopSessionManagerAdapter implements LoopSession {
  private sessionManager: SessionManager;
  private frontend: LoopFrontend;
  private hookSystem?: HookSystem;
  public loopState: LoopState;  // 改为 public
  private userDataStore: Map<string, any> = new Map();

  // 原有属性映射
  readonly sessionId: string;
  readonly startTime: Date;
  readonly projectRoot: string;
  currentMode: 'chat' | 'plan' | 'execute' | 'verify' | 'loop';
  iterationCount: number;
  maxIterations: number | null;
  executionHistory: ExecutionRecord[];
  currentPlan?: Plan;
  currentAbortController?: AbortController;
  config: Config;
  permissions: Set<Permission>;

  constructor(
    sessionManager: SessionManager,
    frontend: LoopFrontend,
    hookSystem?: HookSystem,
    options: LoopSessionOptions = {}
  ) {
    this.sessionManager = sessionManager;
    this.frontend = frontend;
    this.hookSystem = hookSystem;

    // 初始化基本属性
    this.sessionId = generateUUID();
    this.startTime = new Date();
    this.projectRoot = sessionManager.getProjectRoot();
    this.currentMode = 'chat';
    this.iterationCount = 0;
    this.maxIterations = options.maxIterations || null;
    this.executionHistory = sessionManager.getTracker().getHistory();
    this.config = sessionManager.getConfig();
    this.permissions = new Set();

    // 初始化 loop 状态
    this.loopState = {
      iteration: 0,
      maxIterations: options.maxIterations || null,
      completed: false,
      history: [],
    };
  }

  /**
   * 启动会话
   */
  async start(): Promise<void> {
    // 显示欢迎信息
    this.printWelcome();

    // 执行钩子
    if (this.hookSystem?.hasHooks(HookType.BEFORE_SESSION_START)) {
      await this.hookSystem.execute(HookType.BEFORE_SESSION_START, {
        data: {
          session: this.sessionManager,
          config: this.config,
        },
        session: this.sessionManager,
        config: this.config,
      } as any);
    }
  }

  /**
   * 停止会话
   */
  async stop(): Promise<void> {
    // 执行钩子
    if (this.hookSystem?.hasHooks(HookType.AFTER_SESSION_END)) {
      await this.hookSystem.execute(HookType.AFTER_SESSION_END, {
        data: {
          session: this.sessionManager,
          config: this.config,
        },
        session: this.sessionManager,
        config: this.config,
      } as any);
    }

    this.loopState.completed = true;
  }

  /**
   * 重置会话状态
   */
  reset(): void {
    this.iterationCount = 0;
    this.loopState.iteration = 0;
    this.loopState.completed = false;
    this.loopState.history = [];
    this.currentPlan = undefined;
  }

  /**
   * 获取完整状态
   */
  getState(): LoopSessionState {
    return {
      sessionId: this.sessionId,
      startTime: this.startTime,
      projectRoot: this.projectRoot,
      currentMode: this.currentMode,
      loopState: this.loopState,
      iterationCount: this.iterationCount,
      executionHistory: this.executionHistory,
      currentPlan: this.currentPlan,
      currentAbortController: this.currentAbortController,
      config: this.config,
      permissions: this.permissions,
      userData: Object.fromEntries(this.userDataStore),
    };
  }

  /**
   * 更新状态
   */
  updateState(updates: Partial<LoopSessionState>): void {
    if (updates.currentMode) {
      this.currentMode = updates.currentMode;
    }
    if (updates.loopState) {
      this.loopState = { ...this.loopState, ...updates.loopState };
    }
    if (updates.currentPlan) {
      this.currentPlan = updates.currentPlan;
    }
    if (updates.config) {
      this.config = { ...this.config, ...updates.config };
    }
    if (updates.permissions) {
      this.permissions = updates.permissions;
    }
  }

  /**
   * 保存状态到持久存储
   *
   * 🎮 落地原先的 TODO：持久化到 .memo/loop-state/<sessionId>.json
   * （存档=指针/状态元组，不拷贝内容；AbortController 不可序列化被剥离）
   */
  async saveState(): Promise<void> {
    try {
      const state = this.getState();
      const serializable = {
        ...state,
        // 不可序列化字段剥离
        currentAbortController: undefined,
        loopState: {
          ...state.loopState,
          history: state.loopState.history.slice(-100),
        },
        savedAt: new Date().toISOString(),
      };

      const dir = path.join(this.projectRoot, '.memo', 'loop-state');
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, `${this.sessionId.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`);
      await fs.writeFile(file, JSON.stringify(serializable, null, 2), 'utf-8');
    } catch (error) {
      // 状态保存失败不阻断主流程
      console.warn(`[LoopSession] saveState failed: ${(error as Error).message}`);
    }
  }

  /**
   * 加载状态从持久存储
   */
  async loadState(): Promise<void> {
    try {
      const dir = path.join(this.projectRoot, '.memo', 'loop-state');
      const file = path.join(dir, `${this.sessionId.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`);
      const content = await fs.readFile(file, 'utf-8');
      const saved = JSON.parse(content) as LoopSessionState & { savedAt?: string };

      this.updateState({
        currentMode: saved.currentMode,
        loopState: saved.loopState,
        currentPlan: saved.currentPlan,
        config: saved.config,
        permissions: saved.permissions,
      });
      this.iterationCount = saved.iterationCount ?? this.iterationCount;
    } catch {
      // 无存档或读取失败：保持当前状态（新会话的正常路径）
    }
  }

  /**
   * 增加迭代次数
   */
  incrementIteration(): void {
    this.iterationCount++;
    this.loopState.iteration++;
  }

  /**
   * 添加执行记录
   */
  addExecutionRecord(record: ExecutionRecord): void {
    this.executionHistory.push(record);
  }

  /**
   * 设置当前计划
   */
  setCurrentPlan(plan: Plan): void {
    this.currentPlan = plan;
  }

  /**
   * 清除当前计划
   */
  clearCurrentPlan(): void {
    this.currentPlan = undefined;
  }

  /**
   * 获取新的中断控制器
   */
  getNewAbortController(): AbortController {
    this.currentAbortController = new AbortController();
    return this.currentAbortController;
  }

  /**
   * 中断当前操作
   */
  abortCurrent(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
  }

  /**
   * 切换模式
   */
  switchMode(mode: 'chat' | 'plan' | 'execute' | 'verify' | 'loop'): void {
    this.currentMode = mode;
    this.frontend.showStatus({
      mode,
      isRunning: true,
      iteration: this.loopState.iteration,
      maxIterations: this.loopState.maxIterations,
    });
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<Config>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * 更新权限
   */
  updatePermissions(permissions: Permission[]): void {
    this.permissions = new Set(permissions);
  }

  /**
   * 设置用户数据
   */
  setUserData(key: string, value: any): void {
    this.userDataStore.set(key, value);
  }

  /**
   * 获取用户数据
   */
  getUserData(key: string): any {
    return this.userDataStore.get(key);
  }

  /**
   * 获取统计信息
   */
  getStats(): SessionStats {
    const history = this.executionHistory;
    const successCount = history.filter((r) => r.status === 'success').length;
    const failureCount = history.filter((r) => r.status === 'failed').length;
    const totalDuration = history.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = history.length > 0 ? totalDuration / history.length : 0;
    const sessionDuration = Date.now() - this.startTime.getTime();

    return {
      commandCount: history.length,
      totalDuration,
      successCount,
      failureCount,
      averageDuration,
      sessionDuration,
    };
  }

  /**
   * 打印欢迎信息
   */
  private printWelcome(): void {
    // 读取版本号（从编译后的路径或源文件路径）
    let version = '3.0.0';
    try {
      // 尝试从源文件路径读取
      const pkgPath = require.resolve('../../package.json');
      version = require(pkgPath).version;
    } catch {
      // 如果失败，使用默认版本
      version = '3.3.0';
    }

    this.frontend.writeOutput(
      `
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   Kode AI Assistant v${version}                 ║
║   Interactive Mode                                    ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝

Type /help for available commands
Type /plan or /do to execute tasks
`,
      OutputStyle.INFO
    );
  }

  /**
   * 获取底层 SessionManager
   */
  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  /**
   * 获取用户侧写
   * 从 SessionManager 中读取用户侧写文件
   */
  async getUserProfile(): Promise<string | null> {
    return await this.sessionManager.getUserProfile();
  }

  /**
   * 检查是否应该更新用户侧写
   * 基于用户输入次数判断
   */
  shouldUpdateProfile(): boolean {
    return this.sessionManager.shouldUpdateProfile();
  }

  /**
   * 添加用户输入记录
   * 用于跟踪何时需要更新用户侧写
   */
  addUserInput(input: string): void {
    this.sessionManager.recordUserInput(input);
  }

  /**
   * 清空用户输入记录
   */
  clearUserInputs(): void {
    this.sessionManager.clearUserInputs();
  }
}
