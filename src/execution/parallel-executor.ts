// src/execution/parallel-executor.ts
/**
 * 并行执行器模块
 *
 * 实现操作的并行执行，基于依赖图自动识别可并行操作
 */

import { Action } from '../types';
import { buildDependencyGraph, topologicalSort, analyzeParallelism, printExecutionPlan } from './dependency-graph';
import chalk from 'chalk';

/**
 * 并行执行选项
 */
export interface ParallelExecutionOptions {
  verbose?: boolean;      // 是否显示详细日志
  dryRun?: boolean;       // 是否只分析不执行
  showPlan?: boolean;     // 是否显示执行计划
}

/**
 * 执行函数类型
 */
type ExecuteFunction = (action: Action) => Promise<void>;

/**
 * 并行执行操作
 *
 * @param actions - 操作列表
 * @param execute - 执行函数
 * @param options - 选项
 * @returns Promise<void>
 */
export async function executeActionsParallel(
  actions: Action[],
  execute: ExecuteFunction,
  options: ParallelExecutionOptions = {}
): Promise<void> {
  if (actions.length === 0) {
    console.log(chalk.yellow('⚠️  没有需要执行的操作'));
    return;
  }

  // 显示执行计划
  if (options.showPlan || options.verbose) {
    printExecutionPlan(actions);
  }

  // 干运行模式
  if (options.dryRun) {
    console.log(chalk.yellow('⚠️  干运行模式 - 不实际执行操作\n'));
    return;
  }

  // 构建依赖图
  const { graph } = buildDependencyGraph(actions);

  // 拓扑排序获取可并行层
  const layers = topologicalSort(graph);

  console.log(chalk.cyan(`\n🚀 开始并行执行 ${actions.length} 个操作 (${layers.length} 层)\n`));

  const startTime = Date.now();

  try {
    // 逐层执行
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
      const layer = layers[layerIndex];
      const layerNum = layerIndex + 1;

      if (options.verbose) {
        console.log(chalk.gray(`\n📍 层 ${layerNum}/${layers.length} - 并行执行 ${layer.length} 个操作\n`));
      }

      // 并行执行当前层的所有操作
      const promises = layer.map(async (action, actionIndex) => {
        const actionNum = actionIndex + 1;

        try {
          if (options.verbose) {
            console.log(chalk.gray(`   [${layerNum}.${actionNum}] 开始: ${action.type}`));
          }

          await execute(action);

          if (options.verbose) {
            console.log(chalk.green(`   [${layerNum}.${actionNum}] 完成: ${action.type}\n`));
          }
        } catch (error) {
          console.error(chalk.red(`   [${layerNum}.${actionNum}] 失败: ${action.type}`));
          console.error(chalk.red(`      错误: ${error}\n`));
          throw error; // 重新抛出错误
        }
      });

      // 等待当前层所有操作完成
      await Promise.all(promises);

      if (options.verbose) {
        console.log(chalk.green(`✅ 层 ${layerNum} 完成\n`));
      }
    }

    const duration = Date.now() - startTime;

    console.log(chalk.green.bold(`\n✅ 所有操作完成!`));
    console.log(chalk.gray(`   总耗时: ${duration}ms`));

    // 显示性能分析
    const analysis = analyzeParallelism(actions);
    if (analysis.speedup > 1) {
      console.log(chalk.cyan(`   理论加速: ${analysis.speedup}x`));
      console.log(chalk.cyan(`   最大并行: ${analysis.maxParallel} 个操作\n`));
    } else {
      console.log(chalk.gray(`   无法并行执行（操作间存在依赖）\n`));
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(chalk.red.bold(`\n❌ 执行失败`));
    console.error(chalk.gray(`   已运行时间: ${duration}ms`));
    console.error(chalk.red(`   错误: ${error}\n`));
    throw error;
  }
}

/**
 * 串行执行操作（用于对比）
 *
 * @param actions - 操作列表
 * @param execute - 执行函数
 * @param options - 选项
 * @returns Promise<void>
 */
export async function executeActionsSerial(
  actions: Action[],
  execute: ExecuteFunction,
  options: ParallelExecutionOptions = {}
): Promise<void> {
  if (actions.length === 0) {
    console.log(chalk.yellow('⚠️  没有需要执行的操作'));
    return;
  }

  console.log(chalk.cyan(`\n🚀 开始串行执行 ${actions.length} 个操作\n`));

  const startTime = Date.now();

  try {
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const num = i + 1;

      if (options.verbose) {
        console.log(chalk.gray(`\n[${num}/${actions.length}] 执行: ${action.type}`));
      }

      await execute(action);

      if (options.verbose) {
        console.log(chalk.green(`[${num}/${actions.length}] 完成: ${action.type}\n`));
      }
    }

    const duration = Date.now() - startTime;

    console.log(chalk.green.bold(`\n✅ 所有操作完成!`));
    console.log(chalk.gray(`   总耗时: ${duration}ms\n`));
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(chalk.red.bold(`\n❌ 执行失败`));
    console.error(chalk.gray(`   已完成: ${actions.length} 个操作中的 ${Math.max(0, actions.length - 1)} 个`));
    console.error(chalk.gray(`   已运行时间: ${duration}ms`));
    console.error(chalk.red(`   错误: ${error}\n`));
    throw error;
  }
}

/**
 * 对比并行和串行执行的性能
 *
 * @param actions - 操作列表
 * @param execute - 执行函数
 * @returns Promise<{parallel: number; serial: number; speedup: number}>
 */
export async function benchmarkExecution(
  actions: Action[],
  execute: ExecuteFunction
): Promise<{
  parallel: number;
  serial: number;
  speedup: number;
}> {
  console.log(chalk.cyan.bold('\n📊 性能基准测试\n'));

  // 并行执行
  const parallelStart = Date.now();
  await executeActionsParallel(actions, execute, { verbose: false });
  const parallelTime = Date.now() - parallelStart;

  // 串行执行
  const serialStart = Date.now();
  await executeActionsSerial(actions, execute, { verbose: false });
  const serialTime = Date.now() - serialStart;

  // 计算加速比
  const speedup = serialTime / parallelTime;

  console.log(chalk.cyan('\n📊 性能对比:'));
  console.log(chalk.gray(`   并行执行: ${parallelTime}ms`));
  console.log(chalk.gray(`   串行执行: ${serialTime}ms`));
  console.log(chalk.green(`   加速比: ${speedup.toFixed(2)}x\n`));

  return {
    parallel: parallelTime,
    serial: serialTime,
    speedup: Math.round(speedup * 100) / 100,
  };
}
