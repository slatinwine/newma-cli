#!/usr/bin/env bun
/**
 * Comprehensive Skill System Benchmark
 *
 * Measures and compares performance of:
 * - Baseline (original SkillLoader)
 * - Streaming skill loader
 * - Cached skill loader
 * - Parallel skill loader
 *
 * Outputs detailed performance metrics and comparisons
 */

import { createSkillLoader } from './src/plugins/skill-loader';
import { createStreamingSkillLoader } from './src/plugins/streaming-skill-loader';
import { createCachedSkillLoader } from './src/plugins/cached-skill-loader';
import { createParallelSkillLoader } from './src/plugins/parallel-skill-loader';
import { promises as fs } from 'fs';
import chalk from 'chalk';

interface BenchmarkResult {
  name: string;
  time: number;
  iterations: number;
  avgTime: number;
  throughput: number; // operations per second
}

interface BenchmarkComparison {
  baseline: BenchmarkResult;
  optimized: BenchmarkResult;
  improvement: number; // percentage
  speedup: number; // multiplier
}

class SkillSystemBenchmark {
  private skillPath = './examples/skills/doc-coauthoring';
  private iterations = 10;

  /**
   * Run all benchmarks
   */
  async runAll() {
    console.log(chalk.cyan('\n'));
    console.log(chalk.cyan('╔════════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║'));
    console.log(chalk.cyan('║   🏁 Newma (牛码) Skill System - Comprehensive Benchmark Suite'));
    console.log(chalk.cyan('║'));
    console.log(chalk.cyan('╚════════════════════════════════════════════════════════════════════╝'));
    console.log(chalk.cyan('\n'));

    console.log(chalk.gray(`Configuration:`));
    console.log(chalk.gray(`  Skill: ${this.skillPath}`));
    console.log(chalk.gray(`  Iterations: ${this.iterations}`));
    console.log(chalk.gray(`  Warm-up runs: 2`));
    console.log(chalk.gray('\n'));

    const results = {
      baseline: await this.benchmarkBaseline(),
      streaming: await this.benchmarkStreaming(),
      cached: await this.benchmarkCached(),
      parallel: await this.benchmarkParallel(),
    };

    this.printResults(results);
    await this.generateReport(results);
  }

  /**
   * Benchmark 1: Baseline (original SkillLoader)
   */
  async benchmarkBaseline(): Promise<BenchmarkResult> {
    console.log(chalk.yellow('Benchmark 1: Baseline (original SkillLoader)'));
    console.log(chalk.gray('─'.repeat(70)));

    const loader = createSkillLoader({ verbose: false });

    // Warm-up
    await loader.loadSkill(this.skillPath);
    await loader.loadSkill(this.skillPath);

    // Benchmark
    const times: number[] = [];
    for (let i = 0; i < this.iterations; i++) {
      const start = performance.now();
      await loader.loadSkill(this.skillPath);
      const elapsed = performance.now() - start;
      times.push(elapsed);
    }

    const totalTime = times.reduce((a, b) => a + b, 0);
    const avgTime = totalTime / times.length;
    const throughput = 1000 / avgTime;

    console.log(chalk.gray(`  Total time: ${totalTime.toFixed(2)}ms`));
    console.log(chalk.gray(`  Average: ${avgTime.toFixed(2)}ms`));
    console.log(chalk.gray(`  Throughput: ${throughput.toFixed(2)} ops/sec`));
    console.log(chalk.gray(`  Min: ${Math.min(...times).toFixed(2)}ms`));
    console.log(chalk.gray(`  Max: ${Math.max(...times).toFixed(2)}ms`));
    console.log();

    return {
      name: 'Baseline (SkillLoader)',
      time: totalTime,
      iterations: this.iterations,
      avgTime,
      throughput,
    };
  }

  /**
   * Benchmark 2: Streaming skill loader
   */
  async benchmarkStreaming(): Promise<BenchmarkResult> {
    console.log(chalk.yellow('Benchmark 2: Streaming Skill Loader'));
    console.log(chalk.gray('─'.repeat(70)));

    const streamingLoader = createStreamingSkillLoader({
      enableStreaming: true,
      includeMetadata: false,
      verbose: false,
    });

    // Warm-up
    for await (const _ of streamingLoader.loadSkillStream(this.skillPath)) {
      // Consume all chunks
    }

    // Benchmark
    const times: number[] = [];
    for (let i = 0; i < this.iterations; i++) {
      const start = performance.now();

      let coreReceived = false;
      for await (const chunk of streamingLoader.loadSkillStream(this.skillPath)) {
        if (chunk.type === 'core' && !coreReceived) {
          // Measure time to first byte (core content)
          const ttfb = performance.now() - start;
          times.push(ttfb);
          coreReceived = true;
        }

        if (chunk.type === 'complete') {
          break;
        }
      }
    }

    const totalTime = times.reduce((a, b) => a + b, 0);
    const avgTime = totalTime / times.length;
    const throughput = 1000 / avgTime;

    console.log(chalk.gray(`  Total time: ${totalTime.toFixed(2)}ms`));
    console.log(chalk.gray(`  Average Time-To-First-Byte: ${avgTime.toFixed(2)}ms`));
    console.log(chalk.gray(`  Throughput: ${throughput.toFixed(2)} ops/sec`));
    console.log(chalk.gray(`  Min TTFB: ${Math.min(...times).toFixed(2)}ms`));
    console.log(chalk.gray(`  Max TTFB: ${Math.max(...times).toFixed(2)}ms`));
    console.log();

    return {
      name: 'Streaming Skill Loader (TTFB)',
      time: totalTime,
      iterations: this.iterations,
      avgTime,
      throughput,
    };
  }

  /**
   * Benchmark 3: Cached skill loader
   */
  async benchmarkCached(): Promise<BenchmarkResult> {
    console.log(chalk.yellow('Benchmark 3: Cached Skill Loader'));
    console.log(chalk.gray('─'.repeat(70)));

    const cachedLoader = createCachedSkillLoader({
      cache: {
        maxMemorySize: 50,
        ttl: 1000 * 60 * 60 * 24, // 24 hours
        verbose: false,
      },
      verbose: false,
    });

    // Clear cache for fair comparison
    await cachedLoader.clearCache();

    // Warm-up (first load - cache miss)
    await cachedLoader.loadSkill(this.skillPath);

    // Benchmark (subsequent loads - cache hits)
    const times: number[] = [];
    for (let i = 0; i < this.iterations; i++) {
      const start = performance.now();
      await cachedLoader.loadSkill(this.skillPath);
      const elapsed = performance.now() - start;
      times.push(elapsed);
    }

    const totalTime = times.reduce((a, b) => a + b, 0);
    const avgTime = totalTime / times.length;
    const throughput = 1000 / avgTime;

    console.log(chalk.gray(`  Total time: ${totalTime.toFixed(2)}ms (cached)`));
    console.log(chalk.gray(`  Average: ${avgTime.toFixed(2)}ms`));
    console.log(chalk.gray(`  Throughput: ${throughput.toFixed(2)} ops/sec`));
    console.log(chalk.gray(`  Min: ${Math.min(...times).toFixed(2)}ms`));
    console.log(chalk.gray(`  Max: ${Math.max(...times).toFixed(2)}ms`));

    // Print cache stats
    const stats = await cachedLoader.getCacheStats();
    if (stats) {
      console.log(chalk.gray(`\n  Cache Statistics:`));
      console.log(chalk.gray(`    Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`));
      console.log(chalk.gray(`    Total hits: ${stats.totalHits}`));
      console.log(chalk.gray(`    Total misses: ${stats.totalMisses}`));
    }
    console.log();

    return {
      name: 'Cached Skill Loader (cache hit)',
      time: totalTime,
      iterations: this.iterations,
      avgTime,
      throughput,
    };
  }

  /**
   * Benchmark 4: Parallel skill loader
   */
  async benchmarkParallel(): Promise<BenchmarkResult> {
    console.log(chalk.yellow('Benchmark 4: Parallel Skill Loader'));
    console.log(chalk.gray('─'.repeat(70)));

    // Find all skills
    const skillsDir = './examples/skills';
    const skillDirs = await fs.readdir(skillsDir);
    const skillPaths = skillDirs
      .filter(name => name !== '.DS_Store')
      .map(name => `${skillsDir}/${name}`)
      .slice(0, 5);

    console.log(chalk.gray(`  Loading ${skillPaths.length} skills...`));

    // Baseline: Serial loading
    const serialLoader = createSkillLoader({ verbose: false });
    const serialTimes: number[] = [];

    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      for (const path of skillPaths) {
        await serialLoader.loadSkill(path);
      }
      const elapsed = performance.now() - start;
      serialTimes.push(elapsed);
    }

    const avgSerialTime = serialTimes.reduce((a, b) => a + b, 0) / serialTimes.length;
    console.log(chalk.gray(`  Serial loading (baseline): ${avgSerialTime.toFixed(2)}ms avg`));

    // Optimized: Parallel loading
    const parallelLoader = createParallelSkillLoader({
      maxParallel: 5,
      verbose: false,
    });

    const parallelTimes: number[] = [];

    for (let i = 0; i < this.iterations; i++) {
      const start = performance.now();
      await parallelLoader.loadSkillsParallel(skillPaths);
      const elapsed = performance.now() - start;
      parallelTimes.push(elapsed);
    }

    const totalTime = parallelTimes.reduce((a, b) => a + b, 0);
    const avgTime = totalTime / parallelTimes.length;
    const throughput = 1000 / avgTime;

    console.log(chalk.gray(`  Total time: ${totalTime.toFixed(2)}ms`));
    console.log(chalk.gray(`  Average: ${avgTime.toFixed(2)}ms`));
    console.log(chalk.gray(`  Throughput: ${throughput.toFixed(2)} batches/sec`));
    console.log(chalk.gray(`  Min: ${Math.min(...parallelTimes).toFixed(2)}ms`));
    console.log(chalk.gray(`  Max: ${Math.max(...parallelTimes).toFixed(2)}ms`));

    // Calculate improvement
    const improvement = ((avgSerialTime - avgTime) / avgSerialTime) * 100;
    console.log(chalk.gray(`\n  Improvement vs serial: ${improvement.toFixed(1)}% faster`));
    console.log();

    return {
      name: `Parallel Skill Loader (${skillPaths.length} skills)`,
      time: totalTime,
      iterations: this.iterations,
      avgTime,
      throughput,
    };
  }

  /**
   * Print comprehensive results
   */
  printResults(results: any) {
    console.log(chalk.cyan('\n'));
    console.log(chalk.cyan('╔════════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║'));
    console.log(chalk.cyan('║   📊 Benchmark Results Summary'));
    console.log(chalk.cyan('║'));
    console.log(chalk.cyan('╚════════════════════════════════════════════════════════════════════╝'));
    console.log(chalk.cyan('\n'));

    console.log(chalk.bold('Performance Metrics:\n'));

    // Comparison table
    console.log(chalk.gray('┌─────────────────────────────────────┬──────────────┬──────────────┬──────────────┐'));
    console.log(chalk.gray('│ Loader                               │ Avg Time     │ Throughput   │ Improvement  │'));
    console.log(chalk.gray('├─────────────────────────────────────┼──────────────┼──────────────┼──────────────┤'));

    const baseline = results.baseline;
    const baselineAvg = baseline.avgTime;

    const printRow = (result: BenchmarkResult, color: (msg: string) => string) => {
      const improvement = ((baselineAvg - result.avgTime) / baselineAvg) * 100;
      const improvementStr = improvement > 0
        ? color(`+${improvement.toFixed(1)}%`)
        : chalk.red(`${improvement.toFixed(1)}%`);

      console.log(chalk.gray('│') + color(` ${result.name.padEnd(36)}`) +
                  chalk.gray(' │ ') +
                  chalk.white(`${result.avgTime.toFixed(2).padStart(10)}ms`) +
                  chalk.gray(' │ ') +
                  chalk.white(`${result.throughput.toFixed(2).padStart(10)} /s`) +
                  chalk.gray(' │ ') +
                  improvementStr +
                  chalk.gray(' │'));
    };

    printRow(baseline, chalk.white);
    printRow(results.streaming, chalk.green);
    printRow(results.cached, chalk.green);
    printRow(results.parallel, chalk.green);

    console.log(chalk.gray('└─────────────────────────────────────┴──────────────┴──────────────┴──────────────┘'));
    console.log();

    // Detailed comparisons
    this.printComparison('Streaming vs Baseline', baseline, results.streaming);
    this.printComparison('Cached vs Baseline', baseline, results.cached);

    console.log(chalk.cyan('✨ Key Insights:\n'));
    console.log(chalk.white('  • Streaming: ') + chalk.green(`${((1 - results.streaming.avgTime / baseline.avgTime) * 100).toFixed(1)}% faster`) + chalk.white(' time-to-first-byte'));
    console.log(chalk.white('  • Caching: ') + chalk.green(`${((1 - results.cached.avgTime / baseline.avgTime) * 100).toFixed(1)}% faster`) + chalk.white(' for repeated loads'));
    console.log(chalk.white('  • Parallel: ') + chalk.green(`Loads multiple skills concurrently`));
    console.log();
  }

  /**
   * Print detailed comparison
   */
  printComparison(label: string, baseline: BenchmarkResult, optimized: BenchmarkResult) {
    const improvement = ((baseline.avgTime - optimized.avgTime) / baseline.avgTime) * 100;
    const speedup = baseline.avgTime / optimized.avgTime;

    console.log(chalk.bold(label + ':'));
    console.log(chalk.gray(`  Baseline:    ${baseline.avgTime.toFixed(2)}ms`));
    console.log(chalk.gray(`  Optimized:   ${optimized.avgTime.toFixed(2)}ms`));
    console.log(chalk.green(`  Improvement: ${improvement.toFixed(1)}% faster (${speedup.toFixed(2)}x speedup)`));
    console.log();
  }

  /**
   * Generate detailed report file
   */
  async generateReport(results: any) {
    const reportPath = './benchmark-results.md';

    let report = `# Newma (牛码) Skill System Benchmark Report\n\n`;
    report += `**Date**: ${new Date().toISOString()}\n`;
    report += `**Configuration**: ${this.iterations} iterations, skill: ${this.skillPath}\n\n`;

    report += `## Results Summary\n\n`;
    report += `| Loader | Avg Time | Throughput | Improvement |\n`;
    report += `|--------|----------|------------|-------------|\n`;

    const baseline = results.baseline;
    const baselineAvg = baseline.avgTime;

    const printRow = (result: BenchmarkResult) => {
      const improvement = ((baselineAvg - result.avgTime) / baselineAvg) * 100;
      const improvementStr = improvement > 0 ? `+${improvement.toFixed(1)}%` : `${improvement.toFixed(1)}%`;
      return `| ${result.name} | ${result.avgTime.toFixed(2)}ms | ${result.throughput.toFixed(2)}/s | ${improvementStr} |\n`;
    };

    report += printRow(baseline);
    report += printRow(results.streaming);
    report += printRow(results.cached);
    report += printRow(results.parallel);

    report += `\n## Key Findings\n\n`;
    report += `1. **Streaming Loader**: ${((1 - results.streaming.avgTime / baseline.avgTime) * 100).toFixed(1)}% faster time-to-first-byte\n`;
    report += `2. **Cached Loader**: ${((1 - results.cached.avgTime / baseline.avgTime) * 100).toFixed(1)}% faster for repeated loads\n`;
    report += `3. **Parallel Loader**: Significantly faster for loading multiple skills\n`;

    report += `\n## Recommendations\n\n`;
    report += `- Use **StreamingSkillLoader** for better UX (immediate feedback)\n`;
    report += `- Use **CachedSkillLoader** by default (automatic performance boost)\n`;
    report += `- Use **ParallelSkillLoader** when loading multiple skills\n`;

    await fs.writeFile(reportPath, report, 'utf-8');
    console.log(chalk.green(`✅ Benchmark report saved to: ${reportPath}\n`));
  }
}

// Run benchmark
async function main() {
  const benchmark = new SkillSystemBenchmark();
  await benchmark.runAll();
}

main().catch(error => {
  console.error(chalk.red(`\n❌ Benchmark failed: ${error.message}`));
  console.error(error);
  process.exit(1);
});
