// src/execution/strategy/function-calling-strategy.ts
/**
 * Function Calling 执行策略
 * 使用 OpenAI Function Calling API 的默认策略
 */

import chalk from 'chalk';
import { IExecutionStrategy, ExecutionContext, ExecutionResult, ExecutionMode } from './types';

export class FunctionCallingStrategy implements IExecutionStrategy {
  readonly name = ExecutionMode.FUNCTION_CALLING;
  readonly priority = 50; // 中等优先级（默认策略）

  /**
   * 判断是否可以使用 Function Calling
   */
  canHandle(context: ExecutionContext): boolean {
    // Function Calling 是默认策略，总是可以处理
    return true;
  }

  /**
   * 执行 Function Calling 策略
   */
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    console.log(chalk.cyan('🔧 [Function Calling Strategy] 使用 Function Calling API\n'));

    try {
      // 动态导入需要的模块
      const { callAI } = await import('../../ai');
      const { scanDirectory } = await import('../../scanner');

      // 扫描项目
      const projectRoot = context.session.getProjectRoot();
      const projectInfo = await scanDirectory(projectRoot);

      // 调用 AI（使用 plan 模式获取规划）
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

      console.log(chalk.cyan(`\n🔧 Function Calling 规划完成\n`));

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: { strategy: 'function-calling', response },
        duration,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Function Calling execution failed: ${error.message}`,
      };
    }
  }
}
