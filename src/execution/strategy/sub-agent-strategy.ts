// src/execution/strategy/sub-agent-strategy.ts
/**
 * Sub-Agent 执行策略
 * 使用子 Agent 进行探索性任务
 */

import chalk from 'chalk';
import { IExecutionStrategy, ExecutionContext, ExecutionResult, ExecutionMode } from './types';

export class SubAgentStrategy implements IExecutionStrategy {
  readonly name = ExecutionMode.SUB_AGENT;
  readonly priority = 45; // 较低优先级（探索任务）

  canHandle(context: ExecutionContext): boolean {
    // Sub-Agent 模式需要显式启用或特殊需求
    if (context.config.executionMode === 'subagent') {
      return true;
    }

    // 检测是否为探索性任务
    const requirement = context.requirement.toLowerCase();
    const exploratoryKeywords = ['探索', '分析', '研究', 'explore', 'analyze', 'research', 'investigate'];
    return exploratoryKeywords.some(kw => requirement.includes(kw));
  }

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    console.log(chalk.cyan('🔍 [Sub-Agent Strategy] 使用子 Agent 探索\n'));

    try {
      // 动态导入需要的模块
      const { callAI } = await import('../../ai');
      const { scanDirectory } = await import('../../scanner');

      // 扫描项目
      const projectRoot = context.session.getProjectRoot();
      const projectInfo = await scanDirectory(projectRoot);

      // Sub-Agent 模式：使用更深度探索的 AI 调用
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

      console.log(chalk.cyan(`\n🔍 Sub-Agent 探索完成\n`));

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: { strategy: 'sub-agent', response },
        duration,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Sub-Agent execution failed: ${error.message}`,
      };
    }
  }
}
