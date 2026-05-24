/**
 * Claude Code Strategy
 * 混合执行策略：根据复杂度自动选择最适合的执行方式
 * - 简单任务 → 使用现有策略（FFT, Function Calling, SubAgent）
 * - 复杂任务 → 触发 Parallel Subagent 系统
 */

import { IExecutionStrategy, ExecutionContext, ExecutionResult, ExecutionMode } from './types';
import { ComplexityAnalyzer } from '../../complexity/analyzer';
import { ParallelSubAgentCoordinator, DefaultTaskDecomposer } from '../../agents/subagent/parallel-subagent';
import { SubTask, AgentType } from '../../agents/subagent/subtask';
import { ParallelExecutionTracker } from '../../history/parallel-tracker';
import { scanDirectory } from '../../scanner';
import { FunctionCallingStrategy } from './function-calling-strategy';
import { SubAgentStrategy } from './sub-agent-strategy';

/**
 * Claude Code 策略配置
 */
export interface ClaudeCodeStrategyConfig {
  /**
   * 是否启用复杂度检测
   * @default true
   */
  enableComplexityCheck?: boolean;

  /**
   * 复杂度阈值
   * @default 70
   */
  complexityThreshold?: number;

  /**
   * 是否启用并行 subagent
   * @default true
   */
  enableParallelSubagent?: boolean;

  /**
   * 最大并行 subagent 数量
   * @default 5
   */
  maxSubagents?: number;

  /**
   * 单个任务超时时间（毫秒）
   * @default 60000
   */
  taskTimeout?: number;

  /**
   * 用户是否显式指定使用 Claude Code 模式
   */
  userExplicit?: boolean;
}

export class ClaudeCodeStrategy implements IExecutionStrategy {
  readonly name = 'claude-code';
  readonly priority = 55; // 高于 SubAgent (45) 和 FunctionCalling (50)

  private complexityAnalyzer: ComplexityAnalyzer;
  private parallelTracker?: ParallelExecutionTracker;
  private config: Required<ClaudeCodeStrategyConfig>;

  // 备用策略（延迟初始化）
  private functionCallingStrategy?: FunctionCallingStrategy;
  private subAgentStrategy?: SubAgentStrategy;

  constructor(config?: ClaudeCodeStrategyConfig) {
    this.config = {
      enableComplexityCheck: true,
      complexityThreshold: 70,
      enableParallelSubagent: true,
      maxSubagents: 5,
      taskTimeout: 60000,
      userExplicit: false,
      ...config
    };

    this.complexityAnalyzer = new ComplexityAnalyzer({
      claudeCodeThreshold: this.config.complexityThreshold
    });
  }

  /**
   * 判断是否可以处理当前上下文
   */
  async canHandle(context: ExecutionContext): Promise<boolean> {
    // 如果用户显式指定，总是可以处理
    if (this.config.userExplicit) {
      return true;
    }

    // 如果未启用复杂度检测，则不处理
    if (!this.config.enableComplexityCheck) {
      return false;
    }

    // 如果未启用并行 subagent，则不处理
    if (!this.config.enableParallelSubagent) {
      return false;
    }

    // 快速检查：是否包含复杂操作关键词
    const quickCheck = this.complexityAnalyzer.quickCheck(
      context.requirement
    );

    if (quickCheck) {
      return true;
    }

    // 完整复杂度分析
    try {
      const projectInfo = await scanDirectory(context.session.getProjectRoot());
      const result = await this.complexityAnalyzer.analyze({
        requirement: context.requirement,
        projectRoot: context.session.getProjectRoot(),
        projectInfo
      });

      return result.shouldUseClaudeCode;
    } catch {
      // 如果分析失败，默认不处理
      return false;
    }
  }

  /**
   * 执行策略
   */
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // 1. 分析复杂度
      const analysisResult = await this.analyzeComplexity(context);

      // 2. 根据复杂度选择执行方式
      if (analysisResult.shouldUseClaudeCode) {
        // 复杂任务：使用并行 subagent
        return await this.executeWithParallelSubagents(context, analysisResult);
      } else {
        // 简单任务：委托给现有策略
        return await this.delegateToSimpleStrategy(context, analysisResult);
      }

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 分析任务复杂度
   */
  private async analyzeComplexity(context: ExecutionContext): Promise<any> {
    const projectInfo = await scanDirectory(context.session.getProjectRoot());

    const result = await this.complexityAnalyzer.analyze({
      requirement: context.requirement,
      projectRoot: context.session.getProjectRoot(),
      projectInfo
    });

    return result;
  }

  /**
   * 使用并行 subagent 执行
   */
  private async executeWithParallelSubagents(
    context: ExecutionContext,
    analysisResult: any
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // 初始化 tracker
      if (!this.parallelTracker) {
        this.parallelTracker = new ParallelExecutionTracker(context.session.getProjectRoot());
      }

      // 1. 分解任务为子任务
      const decomposer = new DefaultTaskDecomposer();
      const subTasks = await decomposer.decompose(
        context.requirement,
        analysisResult.suggestedAgentTypes || [
          AgentType.CODE_ANALYSIS,
          AgentType.IMPLEMENTATION,
          AgentType.TESTING
        ],
        {
          projectRoot: context.session.getProjectRoot(),
          requirement: context.requirement
        }
      );

      // 2. 开始跟踪执行
      const executionId = await this.parallelTracker.startExecution(
        context.requirement,
        context.session.getProjectRoot(),
        subTasks
      );

      // 3. 创建协调器并执行
      const coordinator = new ParallelSubAgentCoordinator(
        context.session,
        {
          maxSubagents: this.config.maxSubagents,
          taskTimeout: this.config.taskTimeout,
          totalTimeout: 300000, // 5 分钟
          enableDependencies: true,
          continueOnFailure: true
        }
      );

      const summary = await coordinator.execute(context.requirement, subTasks);

      // 4. 完成跟踪
      await this.parallelTracker.completeExecution();

      // 5. 返回结果
      return {
        success: summary.failedTasks === 0,
        data: {
          executionId,
          summary,
          parallelExecution: true
        },
        duration: Date.now() - startTime
      };

    } catch (error: any) {
      // 记录失败
      if (this.parallelTracker) {
        await this.parallelTracker.failExecution(error.message);
      }

      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 委托给简单策略
   */
  private async delegateToSimpleStrategy(
    context: ExecutionContext,
    analysisResult: any
  ): Promise<ExecutionResult> {
    // 根据推荐策略选择
    const recommendedStrategy = analysisResult.score.recommendedStrategy;

    switch (recommendedStrategy) {
      case 'fft':
        // 使用 FFT（通过现有的 sub-agent strategy）
        return await this.getSubAgentStrategy().execute(context);

      case 'function-calling':
        // 使用 Function Calling
        return await this.getFunctionCallingStrategy().execute(context);

      case 'subagent':
        // 使用现有 SubAgent
        return await this.getSubAgentStrategy().execute(context);

      default:
        // 默认使用 Function Calling
        return await this.getFunctionCallingStrategy().execute(context);
    }
  }

  /**
   * 获取 Function Calling 策略（延迟初始化）
   */
  private getFunctionCallingStrategy(): FunctionCallingStrategy {
    if (!this.functionCallingStrategy) {
      this.functionCallingStrategy = new FunctionCallingStrategy();
    }
    return this.functionCallingStrategy;
  }

  /**
   * 获取 SubAgent 策略（延迟初始化）
   */
  private getSubAgentStrategy(): SubAgentStrategy {
    if (!this.subAgentStrategy) {
      this.subAgentStrategy = new SubAgentStrategy();
    }
    return this.subAgentStrategy;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ClaudeCodeStrategyConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };

    // 同步更新 complexity analyzer 配置
    if (config.complexityThreshold) {
      this.complexityAnalyzer.updateConfig({
        claudeCodeThreshold: config.complexityThreshold
      });
    }
  }

  /**
   * 获取配置
   */
  getConfig(): Required<ClaudeCodeStrategyConfig> {
    return { ...this.config };
  }

  /**
   * 获取并行执行统计信息
   */
  getParallelStats() {
    if (!this.parallelTracker) {
      return null;
    }

    return this.parallelTracker.getStats();
  }

  /**
   * 获取最近的并行执行记录
   */
  getRecentParallelRecords(count: number = 10) {
    if (!this.parallelTracker) {
      return [];
    }

    const allRecords = this.parallelTracker.getAllRecords();
    return allRecords
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, count);
  }
}
