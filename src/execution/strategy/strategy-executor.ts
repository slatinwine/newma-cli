// src/execution/strategy/strategy-executor.ts
/**
 * 策略执行器
 * 根据上下文自动选择并执行合适的策略
 */

import chalk from 'chalk';
import { IExecutionStrategy, ExecutionContext, ExecutionResult, ExecutionMode } from './types';

/**
 * 策略执行器
 */
export class StrategyExecutor {
  private strategies: IExecutionStrategy[];

  constructor() {
    // 延迟导入策略实现，避免循环依赖
    this.strategies = [];
  }

  /**
   * 初始化策略（延迟加载）
   */
  private async initializeStrategies(): Promise<void> {
    if (this.strategies.length > 0) return;

    const {
      FFTStrategy,
    } = await import('./fft-strategy');
    const {
      FunctionCallingStrategy,
    } = await import('./function-calling-strategy');
    const {
      MultiAgentStrategy,
    } = await import('./multi-agent-strategy');
    const {
      SubAgentStrategy,
    } = await import('./sub-agent-strategy');
    const {
      StateMachineStrategy,
    } = await import('./state-machine-strategy');
    const {
      StandardStrategy,
    } = await import('./standard-strategy');

    this.strategies = [
      new FFTStrategy(),
      new FunctionCallingStrategy(),
      new MultiAgentStrategy(),
      new SubAgentStrategy(),
      new StateMachineStrategy(),
      new StandardStrategy(),
    ].sort((a, b) => a.priority - b.priority);
  }

  /**
   * 执行策略
   * 自动选择第一个能处理当前上下文的策略
   */
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    await this.initializeStrategies();

    console.log(chalk.gray(`\n🎯 [Strategy Executor] 选择执行策略...\n`));

    // 按优先级遍历策略
    for (const strategy of this.strategies) {
      try {
        const canHandle = await strategy.canHandle(context);
        if (canHandle) {
          console.log(chalk.cyan(`✓ [Strategy Executor] 选择策略: ${strategy.name} (优先级: ${strategy.priority})\n`));

          const startTime = Date.now();
          const result = await strategy.execute(context);
          const duration = Date.now() - startTime;

          if (result.duration === undefined) {
            result.duration = duration;
          }

          return result;
        }
      } catch (error) {
        // 策略检查失败，继续尝试下一个
        console.log(chalk.gray(`  [Strategy Executor] 策略 ${strategy.name} 检查失败，跳过\n`));
      }
    }

    // 没有找到合适的策略
    return {
      success: false,
      error: '没有找到合适的执行策略',
    };
  }

  /**
   * 强制使用指定策略执行
   */
  async executeWithStrategy(
    context: ExecutionContext,
    mode: ExecutionMode
  ): Promise<ExecutionResult> {
    await this.initializeStrategies();

    const strategy = this.strategies.find(s => s.name === mode);
    if (!strategy) {
      return {
        success: false,
        error: `未找到策略: ${mode}`,
      };
    }

    console.log(chalk.cyan(`✓ [Strategy Executor] 强制使用策略: ${strategy.name}\n`));

    const startTime = Date.now();
    const result = await strategy.execute(context);
    const duration = Date.now() - startTime;

    if (result.duration === undefined) {
      result.duration = duration;
    }

    return result;
  }

  /**
   * 获取所有已注册的策略
   */
  getRegisteredStrategies(): IExecutionStrategy[] {
    return [...this.strategies];
  }
}
