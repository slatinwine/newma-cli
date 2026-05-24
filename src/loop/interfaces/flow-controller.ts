/**
 * Flow Controller Interface
 *
 * 定义执行流程的控制逻辑
 * 允许插件拦截、修改、重定向用户输入的处理流程
 */

import { ExecutionRecord } from '../../history';

/**
 * Plan 类型（简化版）
 * 实际使用时可以替换为项目中的完整 Plan 类型
 */
export interface Plan {
  steps: PlanStep[];
  metadata?: Record<string, any>;
}

/**
 * 计划步骤
 */
export interface PlanStep {
  description: string;
  action?: any;
  metadata?: Record<string, any>;
}

/**
 * 流程结果类型
 */
export type FlowResultType =
  | 'command'      // 特殊命令（/status、/help 等）
  | 'chat'         // 聊天模式
  | 'plan'         // 规划模式
  | 'execute'      // 执行模式
  | 'verify'       // 验证模式
  | 'loop'         // 循环模式
  | 'skip';        // 跳过处理

/**
 * 流程结果
 */
export interface FlowResult {
  /**
   * 结果类型
   */
  type: FlowResultType;

  /**
   * 结果数据
   */
  data: any;

  /**
   * 是否继续循环
   */
  shouldContinue: boolean;

  /**
   * 修改后的输入（如果有）
   */
  modifiedInput?: string;

  /**
   * 错误信息（如果有）
   */
  error?: string;

  /**
   * 元数据（如果有）
   */
  metadata?: Record<string, any>;
}

/**
 * 修改后的计划
 */
export interface ModifiedPlan {
  /**
   * 修改后的计划
   */
  plan: Plan;

  /**
   * 修改原因
   */
  reason: string;
}

/**
 * 输入处理结果
 */
export interface InputProcessingResult {
  /**
   * 是否应该继续处理
   */
  shouldContinue: boolean;

  /**
   * 修改后的输入
   */
  modifiedInput?: string;

  /**
   * 是否应该跳过
   */
  shouldSkip?: boolean;

  /**
   * 重定向到（新输入）
   */
  redirectTo?: string;
}

/**
 * 流程控制器接口
 *
 * 负责决定如何处理用户输入
 * 插件可以通过这个接口控制执行流程
 */
export interface FlowController {
  /**
   * 处理用户输入
   * @param input - 用户输入
   * @returns 处理结果
   */
  processInput(input: string): Promise<FlowResult>;

  /**
   * 判断是否应该继续执行
   * @returns 是否继续
   */
  canContinue(): Promise<boolean>;

  /**
   * 判断是否应该跳过此输入
   * @param input - 用户输入
   * @returns 是否跳过
   */
  shouldSkip(input: string): Promise<boolean>;

  /**
   * 判断是否应该修改输入
   * @param input - 用户输入
   * @param originalPlan - 原始计划（如果有）
   * @returns 修改后的计划或 null
   */
  shouldModify(input: string, originalPlan?: Plan): Promise<ModifiedPlan | null>;

  /**
   * 判断是否应该重定向到其他输入
   * @param input - 用户输入
   * @returns 重定向的目标输入或 null
   */
  shouldRedirect(input: string): Promise<string | null>;

  /**
   * 预处理输入（在主处理之前）
   * @param input - 用户输入
   * @returns 预处理结果
   */
  preprocessInput(input: string): Promise<InputProcessingResult>;

  /**
   * 后处理结果（在主处理之后）
   * @param result - 处理结果
   * @param input - 原始输入
   * @returns 后处理结果
   */
  postprocessResult(result: FlowResult, input: string): Promise<FlowResult>;
}

/**
 * 流程控制器配置
 */
export interface FlowControllerConfig {
  /**
   * 是否启用插件预处理
   */
  enablePreprocessing?: boolean;

  /**
   * 是否启用插件后处理
   */
  enablePostprocessing?: boolean;

  /**
   * 是否允许跳过输入
   */
  allowSkip?: boolean;

  /**
   * 是否允许修改输入
   */
  allowModify?: boolean;

  /**
   * 是否允许重定向
   */
  allowRedirect?: boolean;

  /**
   * 最大重定向次数（防止无限循环）
   */
  maxRedirects?: number;
}

/**
 * 流程上下文
 * 提供给流程控制器的上下文信息
 */
export interface FlowContext {
  /**
   * 会话 ID
   */
  sessionId: string;

  /**
   * 项目根目录
   */
  projectRoot: string;

  /**
   * 当前模式
   */
  currentMode: 'chat' | 'plan' | 'execute' | 'verify' | 'loop';

  /**
   * 执行历史
   */
  executionHistory: ExecutionRecord[];

  /**
   * 当前计划（如果有）
   */
  currentPlan?: Plan;

  /**
   * 迭代次数
   */
  iteration: number;

  /**
   * 最大迭代次数
   */
  maxIterations: number | null;
}
