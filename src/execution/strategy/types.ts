// src/execution/strategy/types.ts
/**
 * 执行策略模式类型定义
 * 将 repl.ts 中的多个 execute* 方法重构为独立的策略类
 */

import { SessionManager } from '../../session';
import { Config } from '../../config';

/**
 * 执行模式
 */
export enum ExecutionMode {
  FUNCTION_CALLING = 'function-calling',
  MULTI_AGENT = 'multi-agent',
  SUB_AGENT = 'sub-agent',
  FFT = 'fft',
  STATE_MACHINE = 'state-machine',
  CLAUDE_CODE = 'claude-code',  // 新增：Claude Code 并行 subagent 模式
  STANDARD = 'standard',
}

/**
 * 执行上下文
 */
export interface ExecutionContext {
  requirement: string;
  mode: ExecutionMode;
  config: Config;
  session: SessionManager;
  signal?: AbortSignal;
}

/**
 * 执行结果
 */
export interface ExecutionResult {
  success: boolean;
  error?: string;
  data?: any;
  duration?: number; // 可选
}

/**
 * 执行策略接口
 */
export interface IExecutionStrategy {
  /**
   * 策略名称
   */
  readonly name: string;

  /**
   * 策略优先级（数字越小优先级越高）
   */
  readonly priority: number;

  /**
   * 判断是否可以处理当前上下文
   */
  canHandle(context: ExecutionContext): boolean | Promise<boolean>;

  /**
   * 执行策略
   */
  execute(context: ExecutionContext): Promise<ExecutionResult>;
}

/**
 * 策略配置选项
 */
export interface StrategyOptions {
  enableFFT?: boolean;
  enableMultiAgent?: boolean;
  enableSubAgent?: boolean;
  enableStateMachine?: boolean;
}
