/**
 * Loop Plugin Interface
 *
 * 定义 Loop 插件接口
 * 允许插件完全控制 Loop 执行流程
 */

import { Plugin } from '../../plugins/types';
import {
  FlowController,
  InputProcessingResult,
  ModifiedPlan,
} from './flow-controller';
import { LoopSession } from './session';
import { FlowResult } from './flow-controller';

/**
 * 输入处理前钩子结果
 */
export interface BeforeInputResult {
  /**
   * 是否继续处理
   */
  shouldContinue: boolean;

  /**
   * 修改后的输入
   */
  modifiedInput?: string;

  /**
   * 是否跳过此输入
   */
  shouldSkip?: boolean;

  /**
   * 重定向到
   */
  redirectTo?: string;
}

/**
 * 输入处理后钩子结果
 */
export interface AfterInputResult {
  /**
   * 是否继续
   */
  shouldContinue: boolean;

  /**
   * 修改后的结果
   */
  modifiedResult?: FlowResult;
}

/**
 * 执行前钩子结果
 */
export interface BeforeExecutionResult {
  /**
   * 是否继续执行
   */
  shouldContinue: boolean;

  /**
   * 修改后的计划
   */
  modifiedPlan?: any;
}

/**
 * 插件上下文
 */
export interface LoopPluginContext {
  /**
   * 会话
   */
  session: LoopSession;

  /**
   * 插件配置
   */
  config: Record<string, any>;

  /**
   * 插件根目录
   */
  pluginRoot: string;

  /**
   * 项目根目录
   */
  projectRoot: string;
}

/**
 * Loop 插件接口
 *
 * 扩展标准插件接口，添加 Loop 特定功能
 */
export interface LoopPlugin extends Plugin {
  /**
   * 插件类型
   */
  type: 'loop' | 'command' | 'standard';

  /**
   * 输入处理前钩子
   * 在用户输入被处理之前调用
   */
  onBeforeInput?: (
    input: string,
    context: LoopPluginContext
  ) => Promise<BeforeInputResult> | BeforeInputResult;

  /**
   * 输入处理后钩子
   * 在用户输入被处理之后调用
   */
  onAfterInput?: (
    result: FlowResult,
    context: LoopPluginContext
  ) => Promise<AfterInputResult> | AfterInputResult;

  /**
   * 执行前钩子
   * 在计划执行之前调用
   */
  onBeforeExecution?: (
    plan: any,
    context: LoopPluginContext
  ) => Promise<BeforeExecutionResult> | BeforeExecutionResult;

  /**
   * 执行后钩子
   * 在计划执行之后调用
   */
  onAfterExecution?: (
    result: any,
    context: LoopPluginContext
  ) => Promise<void> | void;

  /**
   * 模式切换钩子
   * 当会话模式改变时调用
   */
  onModeChange?: (
    oldMode: string,
    newMode: string,
    context: LoopPluginContext
  ) => Promise<void> | void;

  /**
   * 会话开始钩子
   */
  onSessionStart?: (context: LoopPluginContext) => Promise<void> | void;

  /**
   * 会话结束钩子
   */
  onSessionEnd?: (context: LoopPluginContext) => Promise<void> | void;

  /**
   * 错误处理钩子
   */
  onError?: (
    error: Error,
    context: LoopPluginContext
  ) => Promise<boolean> | boolean;
}

/**
 * Loop 插件管理器
 *
 * 管理 Loop 插件的注册和生命周期
 */
export interface LoopPluginManager {
  /**
   * 注册 Loop 插件
   */
  registerLoopPlugin(plugin: LoopPlugin): void;

  /**
   * 注销 Loop 插件
   */
  unregisterLoopPlugin(pluginId: string): void;

  /**
   * 获取所有 Loop 插件
   */
  getLoopPlugins(): LoopPlugin[];

  /**
   * 执行输入前钩子
   */
  executeBeforeInputHooks(
    input: string,
    context: LoopPluginContext
  ): Promise<BeforeInputResult>;

  /**
   * 执行输入后钩子
   */
  executeAfterInputHooks(
    result: FlowResult,
    context: LoopPluginContext
  ): Promise<AfterInputResult>;

  /**
   * 执行执行前钩子
   */
  executeBeforeExecutionHooks(
    plan: any,
    context: LoopPluginContext
  ): Promise<BeforeExecutionResult>;

  /**
   * 执行执行后钩子
   */
  executeAfterExecutionHooks(
    result: any,
    context: LoopPluginContext
  ): Promise<void>;

  /**
   * 执行模式切换钩子
   */
  executeModeChangeHooks(
    oldMode: string,
    newMode: string,
    context: LoopPluginContext
  ): Promise<void>;

  /**
   * 执行会话开始钩子
   */
  executeSessionStartHooks(context: LoopPluginContext): Promise<void>;

  /**
   * 执行会话结束钩子
   */
  executeSessionEndHooks(context: LoopPluginContext): Promise<void>;

  /**
   * 执行错误处理钩子
   */
  executeErrorHooks(
    error: Error,
    context: LoopPluginContext
  ): Promise<boolean>;
}
