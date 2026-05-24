// src/execution/strategy/fft-strategy.ts
/**
 * FFT (Fast and Frugal Tree) 执行策略
 * 用于快速决策和简单任务
 */

import chalk from 'chalk';
import { IExecutionStrategy, ExecutionContext, ExecutionResult, ExecutionMode } from './types';

export class FFTStrategy implements IExecutionStrategy {
  readonly name = ExecutionMode.FFT;
  readonly priority = 10; // 最高优先级

  /**
   * 判断是否为简单任务（可以使用 FFT）
   */
  canHandle(context: ExecutionContext): boolean {
    // FFT 已启用
    if (!context.config.useFFT) {
      return false;
    }

    // 简单任务检测（关键启发式）
    const requirement = context.requirement.toLowerCase();

    // 检测是否为简单任务
    const isSimple = this.isSimpleTask(requirement);

    return isSimple;
  }

  /**
   * 检测是否为简单任务
   */
  private isSimpleTask(requirement: string): boolean {
    // 启发式规则
    const simpleKeywords = ['是什么', '如何', '怎么', 'what', 'how', 'explain', '解释'];
    const hasSimpleKeyword = simpleKeywords.some(kw => requirement.includes(kw));

    // 长度检测（简单任务通常较短）
    const isShort = requirement.length < 100;

    // 复杂关键词检测
    const complexKeywords = ['实现', '开发', '重构', '系统', '架构', 'implement', 'develop', 'refactor'];
    const hasComplexKeyword = complexKeywords.some(kw => requirement.includes(kw));

    return hasSimpleKeyword && isShort && !hasComplexKeyword;
  }

  /**
   * 执行 FFT 策略
   */
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    console.log(chalk.cyan('⚡ [FFT Strategy] 使用 FFT 快速决策\n'));

    try {
      // 动态导入 FFT 模块
      const { chatAIWithFFT } = await import('../../fft/chat-fft');

      // 调用 FFT 聊天函数
      const startTime = Date.now();
      const response = await chatAIWithFFT(
        context.config,
        context.requirement,
        context.signal
      );

      console.log(chalk.cyan(`\n⚡ FFT 响应:\n${response}\n`));

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: { strategy: 'fft', response },
        duration,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `FFT execution failed: ${error.message}`,
      };
    }
  }
}
