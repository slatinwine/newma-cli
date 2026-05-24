/**
 * Loop Session Interface
 *
 * 定义 Loop 会话的生命周期和状态管理
 */

import { Config } from '../../config';
import { ExecutionRecord } from '../../history';
import { Plan } from './flow-controller';

/**
 * Permission 类型（简化版）
 */
export type Permission = string;

/**
 * Loop 状态
 */
export interface LoopState {
  /**
   * 当前迭代次数
   */
  iteration: number;

  /**
   * 最大迭代次数
   */
  maxIterations: number | null;

  /**
   * 是否完成
   */
  completed: boolean;

  /**
   * Loop 历史记录
   */
  history: LoopHistoryEntry[];
}

/**
 * Loop 历史记录条目
 */
export interface LoopHistoryEntry {
  /**
   * 时间戳
   */
  timestamp: Date;

  /**
   * 输入
   */
  input: string;

  /**
   * 处理模式
   */
  mode: 'chat' | 'plan' | 'execute' | 'verify' | 'loop';

  /**
   * 结果
   */
  result: any;

  /**
   * 执行时长（毫秒）
   */
  duration: number;
}

/**
 * Loop 会话状态
 */
export interface LoopSessionState {
  /**
   * 会话 ID
   */
  sessionId: string;

  /**
   * 开始时间
   */
  startTime: Date;

  /**
   * 项目根目录
   */
  projectRoot: string;

  /**
   * 当前模式
   */
  currentMode: 'chat' | 'plan' | 'execute' | 'verify' | 'loop';

  /**
   * Loop 状态
   */
  loopState: LoopState;

  /**
   * 迭代次数
   */
  iterationCount: number;

  /**
   * 执行历史
   */
  executionHistory: ExecutionRecord[];

  /**
   * 当前计划（如果有）
   */
  currentPlan?: Plan;

  /**
   * 当前中断控制器（如果有）
   */
  currentAbortController?: AbortController;

  /**
   * 配置
   */
  config: Config;

  /**
   * 权限集合
   */
  permissions: Set<Permission>;

  /**
   * 用户自定义数据
   */
  userData?: Record<string, any>;
}

/**
 * Loop 会话接口
 */
export interface LoopSession {
  /**
   * 会话 ID
   */
  readonly sessionId: string;

  /**
   * 开始时间
   */
  readonly startTime: Date;

  /**
   * 项目根目录
   */
  readonly projectRoot: string;

  /**
   * 当前模式
   */
  currentMode: 'chat' | 'plan' | 'execute' | 'verify' | 'loop';

  /**
   * Loop 状态
   */
  loopState: LoopState;

  /**
   * 迭代次数
   */
  iterationCount: number;

  /**
   * 最大迭代次数
   */
  maxIterations: number | null;

  /**
   * 执行历史
   */
  executionHistory: ExecutionRecord[];

  /**
   * 当前计划（如果有）
   */
  currentPlan?: Plan;

  /**
   * 当前中断控制器（如果有）
   */
  currentAbortController?: AbortController;

  /**
   * 配置
   */
  config: Config;

  /**
   * 权限集合
   */
  permissions: Set<Permission>;

  /**
   * 启动会话
   */
  start(): Promise<void>;

  /**
   * 停止会话
   */
  stop(): Promise<void>;

  /**
   * 重置会话状态
   */
  reset(): void;

  /**
   * 获取完整状态
   */
  getState(): LoopSessionState;

  /**
   * 更新状态
   * @param updates - 要更新的状态字段
   */
  updateState(updates: Partial<LoopSessionState>): void;

  /**
   * 保存状态到持久存储
   */
  saveState(): Promise<void>;

  /**
   * 加载状态从持久存储
   */
  loadState(): Promise<void>;

  /**
   * 增加迭代次数
   */
  incrementIteration(): void;

  /**
   * 添加执行记录
   * @param record - 执行记录
   */
  addExecutionRecord(record: ExecutionRecord): void;

  /**
   * 设置当前计划
   * @param plan - 计划
   */
  setCurrentPlan(plan: Plan): void;

  /**
   * 清除当前计划
   */
  clearCurrentPlan(): void;

  /**
   * 获取新的中断控制器
   */
  getNewAbortController(): AbortController;

  /**
   * 中断当前操作
   */
  abortCurrent(): void;

  /**
   * 切换模式
   * @param mode - 新模式
   */
  switchMode(mode: 'chat' | 'plan' | 'execute' | 'verify' | 'loop'): void;

  /**
   * 更新配置
   * @param updates - 配置更新
   */
  updateConfig(updates: Partial<Config>): void;

  /**
   * 更新权限
   * @param permissions - 新权限集合
   */
  updatePermissions(permissions: Permission[]): void;

  /**
   * 设置用户数据
   * @param key - 键
   * @param value - 值
   */
  setUserData(key: string, value: any): void;

  /**
   * 获取用户数据
   * @param key - 键
   * @returns 值或 undefined
   */
  getUserData(key: string): any;

  /**
   * 获取统计信息
   */
  getStats(): SessionStats;

  /**
   * 获取用户侧写
   * @returns 用户侧写内容或 null
   */
  getUserProfile(): Promise<string | null>;

  /**
   * 检查是否应该更新用户侧写
   * @returns 是否需要更新
   */
  shouldUpdateProfile(): boolean;

  /**
   * 添加用户输入记录
   * @param input - 用户输入
   */
  addUserInput(input: string): void;

  /**
   * 清空用户输入记录
   */
  clearUserInputs(): void;
}

/**
 * 会话统计信息
 */
export interface SessionStats {
  /**
   * 命令执行次数
   */
  commandCount: number;

  /**
   * 总执行时长（毫秒）
   */
  totalDuration: number;

  /**
   * 成功执行次数
   */
  successCount: number;

  /**
   * 失败执行次数
   */
  failureCount: number;

  /**
   * 平均执行时长（毫秒）
   */
  averageDuration: number;

  /**
   * 会话时长（毫秒）
   */
  sessionDuration: number;
}

/**
 * Loop 会话选项
 */
export interface LoopSessionOptions {
  /**
   * 最大迭代次数
   */
  maxIterations?: number;

  /**
   * 初始权限
   */
  permissions?: Permission[];

  /**
   * 是否持久化状态
   */
  persistent?: boolean;

  /**
   * 状态存储路径
   */
  statePath?: string;
}
