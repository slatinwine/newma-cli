// src/execution/strategy/standard-strategy.ts
/**
 * Standard 执行策略
 * 标准的规划-执行-验证循环
 */

import chalk from 'chalk';
import { IExecutionStrategy, ExecutionContext, ExecutionResult, ExecutionMode } from './types';

export class StandardStrategy implements IExecutionStrategy {
  readonly name = ExecutionMode.STANDARD;
  readonly priority = 100; // 最低优先级（兜底策略）

  /**
   * Standard 策略总是可以作为兜底
   */
  canHandle(context: ExecutionContext): boolean {
    return true;
  }

  /**
   * 执行标准策略
   */
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    console.log(chalk.cyan('📋 [Standard Strategy] 使用标准规划-执行-验证循环\n'));

    try {
      // 动态导入需要的模块
      const { callAI } = await import('../../ai');
      const { scanDirectory } = await import('../../scanner');

      // 扫描项目
      const projectRoot = context.session.getProjectRoot();
      const projectInfo = await scanDirectory(projectRoot);

      // 调用 AI 进行规划
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

      console.log(chalk.cyan(`\n📋 标准模式规划完成\n`));

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: { strategy: 'standard', response },
        duration,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Standard execution failed: ${error.message}`,
      };
    }
  }
}
