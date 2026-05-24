#!/usr/bin/env npx ts-node
// bench/run-bench.ts
/**
 * Newma (牛码) 统一基准测试系统
 *
 * 整合所有优化功能的性能测试，建立统一基准
 */

import { performance } from 'perf_hooks';
import chalk from 'chalk';

/**
 * 基准测试结果
 */
interface BenchmarkResult {
  name: string;
  duration: number;
  ops: number;
  opsPerSec: number;
  memory: NodeJS.MemoryUsage;
  success: boolean;
  error?: string;
}

/**
 * 基准测试套件
 */
interface BenchmarkSuite {
  name: string;
  benchmarks: BenchmarkResult[];
  totalDuration: number;
  totalOps: number;
}

/**
 * 基准测试运行器
 */
class BenchmarkRunner {
  private suites: Map<string, BenchmarkSuite> = new Map();
  private results: BenchmarkResult[] = [];

  /**
   * 运行单个基准测试
   */
  async run(
    name: string,
    fn: () => Promise<void> | void,
    iterations: number = 1
  ): Promise<BenchmarkResult> {
    // 强制垃圾回收（如果可用）
    if (global.gc) {
      global.gc();
    }

    const startMemory = process.memoryUsage();
    const startTime = performance.now();

    try {
      // 执行测试
      for (let i = 0; i < iterations; i++) {
        await fn();
      }

      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      const duration = endTime - startTime;

      return {
        name,
        duration,
        ops: iterations,
        opsPerSec: (iterations / duration) * 1000,
        memory: {
          rss: endMemory.rss - startMemory.rss,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          external: endMemory.external - startMemory.external,
          arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
        },
        success: true,
      };
    } catch (error) {
      return {
        name,
        duration: 0,
        ops: 0,
        opsPerSec: 0,
        memory: process.memoryUsage(),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 添加测试到套件
   */
  async add(
    suiteName: string,
    testName: string,
    fn: () => Promise<void> | void,
    iterations: number = 1
  ): Promise<void> {
    const result = await this.run(testName, fn, iterations);

    if (!this.suites.has(suiteName)) {
      this.suites.set(suiteName, {
        name: suiteName,
        benchmarks: [],
        totalDuration: 0,
        totalOps: 0,
      });
    }

    const suite = this.suites.get(suiteName)!;
    suite.benchmarks.push(result);
    suite.totalDuration += result.duration;
    suite.totalOps += result.ops;
    this.results.push(result);
  }

  /**
   * 获取结果摘要
   */
  getSummary(): BenchmarkSuite[] {
    return Array.from(this.suites.values());
  }

  /**
   * 打印结果
   */
  printResults(): void {
    console.log(chalk.cyan.bold('\n╔══════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║          Newma (牛码) 统一基准测试系统 - 结果报告                  ║'));
    console.log(chalk.cyan.bold('╚══════════════════════════════════════════════════════════╝\n'));

    for (const suite of this.suites.values()) {
      this.printSuite(suite);
    }

    this.printSummary();
  }

  /**
   * 打印套件结果
   */
  private printSuite(suite: BenchmarkSuite): void {
    console.log(chalk.cyan.bold(`\n📊 ${suite.name}`));
    console.log(chalk.gray('─'.repeat(60)));

    for (const result of suite.benchmarks) {
      if (result.success) {
        const duration = result.duration.toFixed(2);
        const opsPerSec = result.opsPerSec.toFixed(2);
        const memoryMB = (result.memory.heapUsed / 1024 / 1024).toFixed(2);

        console.log(
          chalk.green(`✓ ${result.name}`) +
          chalk.gray(`\n   耗时: ${duration}ms  `) +
          chalk.cyan(`速度: ${opsPerSec} ops/s  `) +
          chalk.yellow(`内存: ${memoryMB}MB\n`)
        );
      } else {
        console.log(
          chalk.red(`✗ ${result.name}`) +
          chalk.gray(`\n   错误: ${result.error}\n`)
        );
      }
    }

    const totalDuration = suite.totalDuration.toFixed(2);
    const avgOpsPerSec = ((suite.totalOps / suite.totalDuration) * 1000).toFixed(2);

    console.log(chalk.gray('─'.repeat(60)));
    console.log(
      chalk.gray(`套件总计: `) +
      chalk.cyan(`${suite.benchmarks.length} 个测试  `) +
      chalk.gray(`总耗时: ${totalDuration}ms  `) +
      chalk.gray(`平均速度: ${avgOpsPerSec} ops/s\n`)
    );
  }

  /**
   * 打印总体摘要
   */
  private printSummary(): void {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    const totalOps = this.results.reduce((sum, r) => sum + r.ops, 0);
    const avgOpsPerSec = ((totalOps / totalDuration) * 1000).toFixed(2);

    console.log(chalk.cyan.bold('\n📈 总体摘要'));
    console.log(chalk.gray('═'.repeat(60)));
    console.log(
      chalk.gray(`总测试数: `) +
      chalk.cyan(`${totalTests}  `) +
      chalk.green(`通过: ${passedTests}  `) +
      (failedTests > 0 ? chalk.red(`失败: ${failedTests}`) : chalk.green(`失败: 0`))
    );
    console.log(
      chalk.gray(`总耗时: `) +
      chalk.cyan(`${totalDuration.toFixed(2)}ms  `) +
      chalk.gray(`总操作数: ${totalOps}  `) +
      chalk.gray(`平均速度: ${avgOpsPerSec} ops/s`)
    );
    console.log(chalk.gray('═'.repeat(60)));

    if (failedTests === 0) {
      console.log(chalk.green.bold('\n✅ 所有基准测试通过!\n'));
    } else {
      console.log(chalk.red.bold('\n❌ 部分基准测试失败\n'));
    }
  }

  /**
   * 导出为 JSON
   */
  exportJSON(): string {
    const data = {
      timestamp: new Date().toISOString(),
      suites: Array.from(this.suites.values()),
      summary: {
        totalTests: this.results.length,
        passedTests: this.results.filter(r => r.success).length,
        failedTests: this.results.filter(r => !r.success).length,
        totalDuration: this.results.reduce((sum, r) => sum + r.duration, 0),
        totalOps: this.results.reduce((sum, r) => sum + r.ops, 0),
      },
    };

    return JSON.stringify(data, null, 2);
  }
}

/**
 * 基准测试套件
 */
export class Benchmarks {
  private runner: BenchmarkRunner;

  constructor() {
    this.runner = new BenchmarkRunner();
  }

  /**
   * 流式响应基准测试
   */
  async benchmarkStreaming(): Promise<void> {
    console.log(chalk.cyan('\n🧪 运行流式响应基准测试...\n'));

    // 模拟流式数据处理
    const testData = 'A'.repeat(1000);
    const chunks = 50;

    await this.runner.add(
      '流式响应',
      '增量处理',
      async () => {
        for (let i = 0; i < chunks; i++) {
          const chunk = testData.substring(i * 20, (i + 1) * 20);
          // 模拟处理
          chunk.toUpperCase();
        }
      },
      100
    );

    await this.runner.add(
      '流式响应',
      '批量处理',
      async () => {
        // 模拟批量处理
        testData.toUpperCase();
      },
      100
    );
  }

  /**
   * 并发执行基准测试
   */
  async benchmarkParallel(): Promise<void> {
    console.log(chalk.cyan('\n🧪 运行并发执行基准测试...\n'));

    // 模拟独立操作
    const independentOps = 5;
    const delay = 50;

    await this.runner.add(
      '并发执行',
      '串行执行',
      async () => {
        for (let i = 0; i < independentOps; i++) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      },
      10
    );

    await this.runner.add(
      '并发执行',
      '并行执行',
      async () => {
        await Promise.all(
          Array.from({ length: independentOps }, () =>
            new Promise(resolve => setTimeout(resolve, delay))
          )
        );
      },
      10
    );
  }

  /**
   * 缓存系统基准测试
   */
  async benchmarkCache(): Promise<void> {
    console.log(chalk.cyan('\n🧪 运行缓存系统基准测试...\n'));

    // 动态导入缓存模块
    const { CacheManager } = await import('../src/cache/cache-manager');
    const cache = new CacheManager({ diskEnabled: false });

    // 预热缓存
    await cache.set('key1', 'value1');
    await cache.set('key2', 'value2');
    await cache.set('key3', 'value3');

    await this.runner.add(
      '缓存系统',
      '缓存命中',
      async () => {
        await cache.get('key1');
        await cache.get('key2');
        await cache.get('key3');
      },
      1000
    );

    await this.runner.add(
      '缓存系统',
      '缓存未命中',
      async () => {
        await cache.get('nonexistent-key');
      },
      1000
    );

    await this.runner.add(
      '缓存系统',
      '缓存写入',
      async () => {
        await cache.set('new-key', 'new-value');
      },
      100
    );
  }

  /**
   * 依赖分析基准测试
   */
  async benchmarkDependencyAnalysis(): Promise<void> {
    console.log(chalk.cyan('\n🧪 运行依赖分析基准测试...\n'));

    // 动态导入依赖分析模块
    const { buildDependencyGraph, topologicalSort } = await import(
      '../src/execution/dependency-graph'
    );

    // 创建测试操作 (使用 any 绕过类型检查)
    const actions: any[] = Array.from({ length: 20 }, (_, i) => ({
      type: i % 2 === 0 ? 'create' : 'modify',
      path: `/tmp/file${i}.txt`,
      content: `content${i}`,
    }));

    await this.runner.add(
      '依赖分析',
      '构建依赖图',
      () => {
        buildDependencyGraph(actions);
      },
      100
    );

    await this.runner.add(
      '依赖分析',
      '拓扑排序',
      () => {
        const { graph } = buildDependencyGraph(actions);
        topologicalSort(graph);
      },
      100
    );
  }

  /**
   * 运行所有基准测试
   */
  async runAll(): Promise<void> {
    const startTime = performance.now();

    try {
      await this.benchmarkStreaming();
      await this.benchmarkParallel();
      await this.benchmarkCache();
      await this.benchmarkDependencyAnalysis();
    } catch (error) {
      console.error(chalk.red('\n❌ 基准测试执行失败:'), error);
    }

    const totalTime = performance.now() - startTime;

    // 打印结果
    this.runner.printResults();

    console.log(chalk.gray(`\n⏱️  基准测试总耗时: ${totalTime.toFixed(2)}ms\n`));

    // 导出 JSON
    const json = this.runner.exportJSON();
    console.log(chalk.gray('📄 JSON 结果:'));
    console.log(chalk.gray(json));
  }

  /**
   * 保存结果到文件
   */
  async saveResults(filename: string = 'bench-results.json'): Promise<void> {
    const json = this.runner.exportJSON();
    const fs = await import('fs/promises');
    await fs.writeFile(filename, json, 'utf-8');
    console.log(chalk.green(`\n💾 结果已保存到: ${filename}\n`));
  }
}

/**
 * 主函数
 */
async function main() {
  console.log(chalk.cyan.bold('╔══════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║          Newma (牛码) 统一基准测试系统                              ║'));
  console.log(chalk.cyan.bold('║          Newma Unified Benchmark System                     ║'));
  console.log(chalk.cyan.bold('╚══════════════════════════════════════════════════════════╝'));

  const benchmarks = new Benchmarks();

  // 运行所有基准测试
  await benchmarks.runAll();

  // 保存结果
  await benchmarks.saveResults();
}

// 运行
main().catch(error => {
  console.error(chalk.red('\n❌ 错误:'), error);
  process.exit(1);
});
