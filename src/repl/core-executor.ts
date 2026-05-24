/**
 * Core Executor Interface
 *
 * 核心执行器接口 - 抽象不同的执行策略
 */

import { SessionManager } from '../session';
import { ExtendedAIResponse } from '../ai';
import { ExecutionRecord } from '../history';

// ============================================================================
// 执行模式
// ============================================================================

/**
 * 执行模式枚举
 */
export enum ExecutionMode {
  /** 聊天模式 - 简单对话 */
  CHAT = 'chat',
  /** 规划模式 - 生成计划 */
  PLAN = 'plan',
  /** 执行模式 - 直接执行 */
  DO = 'do',
  /** 验证模式 - 验证结果 */
  VERIFY = 'verify',
  /** 循环模式 - plan-do-verify 循环 */
  LOOP = 'loop',
}

// ============================================================================
// 执行结果
// ============================================================================

/**
 * 执行结果
 */
export interface ExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** 输出消息 */
  output?: string;
  /** 错误消息 */
  error?: string;
  /** 执行时长（毫秒） */
  duration: number;
  /** AI 响应（如果有） */
  aiResponse?: ExtendedAIResponse;
  /** 执行记录（如果有） */
  executionRecords?: ExecutionRecord[];
}

// ============================================================================
// 执行上下文
// ============================================================================

/**
 * 执行上下文
 */
export interface ExecutionContext {
  /** 会话管理器 */
  session: SessionManager;
  /** 项目根目录 */
  projectRoot: string;
  /** 执行模式 */
  mode: ExecutionMode;
  /** 是否启用工具 */
  useTools: boolean;
  /** 是否启用验证 */
  verify: boolean;
  /** 是否启用 ultrathink */
  ultrathink: boolean;
  /** 中断信号 */
  abortSignal?: AbortSignal;
}

// ============================================================================
// 执行器接口
// ============================================================================

/**
 * 执行器接口
 *
 * 定义执行用户需求的标准接口
 */
export interface IExecutor {
  /**
   * 执行器名称
   */
  readonly name: string;

  /**
   * 执行器描述
   */
  readonly description: string;

  /**
   * 支持的执行模式
   */
  readonly supportedModes: ExecutionMode[];

  /**
   * 判断是否支持指定的模式
   */
  supportsMode(mode: ExecutionMode): boolean;

  /**
   * 执行用户需求
   *
   * @param requirement 用户需求
   * @param context 执行上下文
   * @returns 执行结果
   */
  execute(
    requirement: string,
    context: ExecutionContext
  ): Promise<ExecutionResult>;

  /**
   * 中断当前执行
   */
  abort(): void;

  /**
   * 获取执行器状态
   */
  getState(): {
    isExecuting: boolean;
    currentRequirement?: string;
    progress?: number;
  };
}

// ============================================================================
// 执行器工厂
// ============================================================================

/**
 * 执行器工厂
 *
 * 创建不同类型的执行器
 */
export interface IExecutorFactory {
  /**
   * 创建执行器
   */
  createExecutor(type: 'legacy' | 'runtime'): IExecutor;

  /**
   * 获取可用的执行器类型
   */
  getAvailableTypes(): string[];
}

// ============================================================================
// 执行器适配器（将现有逻辑适配到新接口）
// ============================================================================

/**
 * 适配器：将 REPLManager 的执行逻辑适配到 IExecutor 接口
 *
 * 这个适配器包装了现有的执行逻辑，使其符合新的模块化接口
 */
export class REPLManagerExecutorAdapter implements IExecutor {
  readonly name = 'repl-manager-adapter';
  readonly description = 'Adapter for REPLManager execution logic';
  readonly supportedModes = [
    ExecutionMode.CHAT,
    ExecutionMode.PLAN,
    ExecutionMode.DO,
    ExecutionMode.LOOP,
  ];

  private replManager: any; // REPLManager instance
  private isExecutingFlag: boolean = false;
  private currentRequirement: string = '';

  constructor(replManager: any) {
    this.replManager = replManager;
  }

  supportsMode(mode: ExecutionMode): boolean {
    return this.supportedModes.includes(mode);
  }

  async execute(
    requirement: string,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    this.isExecutingFlag = true;
    this.currentRequirement = requirement;

    try {
      // 委托给 REPLManager 的现有方法
      let result: ExecutionResult;

      switch (context.mode) {
        case ExecutionMode.CHAT:
          result = await this.executeChat(requirement, context);
          break;
        case ExecutionMode.PLAN:
          result = await this.executePlan(requirement, context);
          break;
        case ExecutionMode.DO:
          result = await this.executeDo(requirement, context);
          break;
        case ExecutionMode.LOOP:
          result = await this.executeLoop(requirement, context);
          break;
        default:
          result = await this.executeChat(requirement, context);
      }

      result.duration = Date.now() - startTime;
      return result;
    } finally {
      this.isExecutingFlag = false;
    }
  }

  private async executeChat(
    requirement: string,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    // 委托给 REPLManager.chatMode()
    // @ts-ignore - accessing private method through adapter
    await this.replManager.chatMode(requirement);
    return {
      success: true,
      output: `Chat response for: ${requirement}`,
      duration: 0, // Will be set by execute()
    };
  }

  private async executePlan(
    requirement: string,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    // 委托给 REPLManager.executeRequirement() with plan mode
    // @ts-ignore
    const result = await this.replManager.executeRequirement(requirement, 'plan');
    return {
      success: true,
      output: `Plan generated for: ${requirement}`,
      duration: 0,
    };
  }

  private async executeDo(
    requirement: string,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    // 委托给 REPLManager.executeRequirement() with do mode
    // @ts-ignore
    const result = await this.replManager.executeRequirement(requirement, 'do');
    return {
      success: true,
      output: `Executed: ${requirement}`,
      duration: 0,
    };
  }

  private async executeLoop(
    requirement: string,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    // 委托给 REPLManager.executeRequirement() with loop mode
    // @ts-ignore
    const result = await this.replManager.executeRequirement(requirement, 'loop');
    return {
      success: true,
      output: `Loop completed for: ${requirement}`,
      duration: 0,
    };
  }

  abort(): void {
    // @ts-ignore
    if (this.replManager.currentAbortController) {
      // @ts-ignore
      this.replManager.currentAbortController.abort();
    }
  }

  getState() {
    return {
      isExecuting: this.isExecutingFlag,
      currentRequirement: this.currentRequirement,
    };
  }
}

// ============================================================================
// 执行器注册表
// ============================================================================

/**
 * 执行器注册表
 *
 * 管理多个执行器实例
 */
export class ExecutorRegistry {
  private executors: Map<string, IExecutor> = new Map();

  register(executor: IExecutor): void {
    this.executors.set(executor.name, executor);
  }

  unregister(name: string): void {
    this.executors.delete(name);
  }

  get(name: string): IExecutor | undefined {
    return this.executors.get(name);
  }

  list(): IExecutor[] {
    return Array.from(this.executors.values());
  }

  getExecutorForMode(mode: ExecutionMode): IExecutor | undefined {
    return Array.from(this.executors.values()).find(executor =>
      executor.supportsMode(mode)
    );
  }
}
