/**
 * SubAgent Types
 *
 * Subagent 系统的类型定义
 */

import { ToolRegistry } from '../../tools/registry';
import { ToolExecutor } from '../../executor-v2';
import { Config } from '../../config';

/**
 * SubAgent 配置
 */
export interface SubAgentConfig {
  /** SubAgent 唯一标识 */
  id: string;

  /** SubAgent 名称 */
  name: string;

  /** SubAgent 描述 */
  description: string;

  /** 系统提示词 */
  systemPrompt: string;

  /** 允许使用的工具白名单 */
  allowedTools: string[];

  /** 最大迭代次数 */
  maxIterations?: number;

  /** AI 温度参数 */
  temperature?: number;
}

/**
 * SubAgent 执行上下文
 */
export interface SubAgentContext {
  /** 项目根目录 */
  projectRoot: string;

  /** 项目信息 (文件树等) */
  projectInfo: Record<string, string>;

  /** AI 配置 */
  config: Config;

  /** 工具注册表 */
  toolRegistry: ToolRegistry;

  /** 工具执行器 */
  toolExecutor: ToolExecutor;

  /** 中断信号 */
  signal?: AbortSignal;
}

/**
 * SubAgent 执行结果
 */
export interface SubAgentResult {
  /** 是否成功 */
  success: boolean;

  /** SubAgent ID */
  agentId: string;

  /** 输出文本 */
  output: string;

  /** 工具调用次数 */
  toolCallsExecuted: number;

  /** Token 使用统计 */
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };

  /** 执行时长 (毫秒) */
  duration: number;

  /** 错误信息 */
  error?: string;

  /** 额外元数据 */
  metadata?: {
    plan?: any;
    toolResults?: any[];
    [key: string]: any;
  };
}

/**
 * 执行计划 (由 PlanningSubAgent 生成)
 */
export interface ExecutionPlan {
  /** TODO 列表 */
  todo: string[];

  /** 动作列表 */
  actions: Array<{
    type: 'create' | 'modify' | 'delete' | 'run' | 'verify';
    path?: string;
    content?: string;
    command?: string;
    description: string;
  }>;
}

/**
 * SubAgent 协调器结果
 */
export interface SubAgentCoordinatorResult {
  /** 规划阶段结果 */
  planningResult: SubAgentResult;

  /** 执行阶段结果 */
  executionResult?: SubAgentResult;

  /** 总时长 (毫秒) */
  totalDuration: number;
}

/**
 * SubAgent 执行选项
 */
export interface SubAgentExecutionOptions {
  /** 跳过用户确认 */
  skipConfirmation?: boolean;

  /** 显示详细日志 */
  verbose?: boolean;

  /** 保存中间结果 */
  saveIntermediates?: boolean;
}
