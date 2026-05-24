// src/execution/strategy/state-machine-strategy.ts
/**
 * State Machine 执行策略
 * 使用状态机进行规划
 */

import chalk from 'chalk';
import { IExecutionStrategy, ExecutionContext, ExecutionResult, ExecutionMode } from './types';

export class StateMachineStrategy implements IExecutionStrategy {
  readonly name = ExecutionMode.STATE_MACHINE;
  readonly priority = 42; // 较低优先级（规划任务）

  canHandle(context: ExecutionContext): boolean {
    // State Machine 需要显式启用（检查使用 Landmark Counting）
    return context.config.useLandmark === true;
  }

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    console.log(chalk.cyan('🔄 [State Machine Strategy] 使用状态机规划\n'));

    try {
      // 动态导入需要的模块
      const { callAI } = await import('../../ai');
      const { scanDirectory } = await import('../../scanner');

      // 扫描项目
      const projectRoot = context.session.getProjectRoot();
      const projectInfo = await scanDirectory(projectRoot);

      // State Machine 模式：使用 Landmark Counting 规划
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

      console.log(chalk.cyan(`\n🔄 State Machine 规划完成\n`));

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: { strategy: 'state-machine', response },
        duration,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `State Machine execution failed: ${error.message}`,
      };
    }
  }
}
