// src/execution/strategy/multi-agent-strategy.ts
/**
 * Multi-Agent 执行策略
 * 使用多个专业化 Agent 协作完成任务
 */

import chalk from 'chalk';
import { IExecutionStrategy, ExecutionContext, ExecutionResult, ExecutionMode } from './types';

export class MultiAgentStrategy implements IExecutionStrategy {
  readonly name = ExecutionMode.MULTI_AGENT;
  readonly priority = 40; // 较低优先级（复杂任务）

  /**
   * 判断是否应该使用 Multi-Agent
   */
  canHandle(context: ExecutionContext): boolean {
    // Multi-Agent 必须显式启用
    if (context.config.executionMode !== 'multi-agent') {
      return false;
    }

    // 检测是否为复杂任务
    const requirement = context.requirement.toLowerCase();
    return this.isComplexTask(requirement);
  }

  /**
   * 检测是否为复杂任务
   */
  private isComplexTask(requirement: string): boolean {
    // 复杂任务特征
    const complexKeywords = [
      '实现', '开发', '重构', '系统', '架构',
      'implement', 'develop', 'refactor', 'system', 'architecture'
    ];

    return complexKeywords.some(kw => requirement.includes(kw));
  }

  /**
   * 执行 Multi-Agent 策略
   */
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    console.log(chalk.cyan('🤖 [Multi-Agent Strategy] 使用多 Agent 协作\n'));

    try {
      // 动态导入需要的模块
      const { callAI } = await import('../../ai');
      const { scanDirectory } = await import('../../scanner');

      // 扫描项目
      const projectRoot = context.session.getProjectRoot();
      const projectInfo = await scanDirectory(projectRoot);

      // 调用 AI 进行多 Agent 规划
      const startTime = Date.now();
      const response = await callAI(
        context.config,
        projectInfo,
        context.requirement,
        'plan',
        context.session.getTracker().getHistory(),
        undefined,
        undefined,
        undefined,
        projectRoot,
        context.signal
      );

      console.log(chalk.cyan(`\n🤖 Multi-Agent 规划完成\n`));

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: { strategy: 'multi-agent', response },
        duration,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Multi-Agent execution failed: ${error.message}`,
      };
    }
  }
}
