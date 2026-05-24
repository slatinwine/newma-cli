/**
 * Performance Benchmarking Framework
 * Benchmarks skill performance and resource usage
 */

import { AnySkill } from './types';
import { ProgressiveSkillLoader } from './loader';
import { estimateTokens } from './tokens';

export interface BenchmarkConfig {
  iterations?: number; // Number of iterations (default: 100)
  warmupIterations?: number; // Warmup iterations (default: 10)
  duration?: number; // Max duration in ms (default: 10000)
  memory?: boolean; // Track memory usage
  cache?: boolean; // Test with cache
}

export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  throughput: number; // Operations per second
  memory?: MemoryStats;
  cache?: CacheStats;
}

export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

export interface SkillBenchmarkResult {
  skillId: string;
  skillName: string;
  load: BenchmarkResult;
  validation?: BenchmarkResult;
  execution?: BenchmarkResult;
  overall: {
    totalTime: number;
    avgTime: number;
    throughput: number;
  };
}

/**
 * Benchmark a function
 */
export async function benchmark(
  name: string,
  fn: () => Promise<any> | any,
  config: BenchmarkConfig = {}
): Promise<BenchmarkResult> {
  const {
    iterations = 100,
    warmupIterations = 10,
    duration = 10000,
    memory = false,
    cache = false,
  } = config;

  // Warmup
  for (let i = 0; i < warmupIterations; i++) {
    await fn();
  }

  // Benchmark
  const times: number[] = [];
  const startTime = Date.now();
  let cacheHits = 0;
  let cacheMisses = 0;

  for (let i = 0; i < iterations; i++) {
    const iterStart = Date.now();

    await fn();

    const iterTime = Date.now() - iterStart;
    times.push(iterTime);

    // Check time limit
    if (Date.now() - startTime > duration) {
      break;
    }
  }

  const totalTime = times.reduce((a, b) => a + b, 0);
  const avgTime = totalTime / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const throughput = 1000 / avgTime;

  const result: BenchmarkResult = {
    name,
    iterations: times.length,
    totalTime,
    avgTime,
    minTime,
    maxTime,
    throughput,
  };

  // Memory stats
  if (memory) {
    result.memory = getMemoryStats();
  }

  // Cache stats
  if (cache) {
    result.cache = { hits: cacheHits, misses: cacheMisses, hitRate: cacheHits / (cacheHits + cacheMisses) };
  }

  return result;
}

/**
 * Benchmark skill loading
 */
export async function benchmarkSkillLoad(
  skill: AnySkill,
  loader: ProgressiveSkillLoader,
  config: BenchmarkConfig = {}
): Promise<BenchmarkResult> {
  return benchmark(
    `Load ${skill.metadata.name}`,
    async () => {
      await loader.loadSkill(skill, config as any); // Type cast: BenchmarkConfig to ProgressiveLoadingOptions
    },
    config
  );
}

/**
 * Benchmark skill validation
 */
export async function benchmarkSkillValidation(
  skill: AnySkill,
  input: any,
  output: any,
  config: BenchmarkConfig = {}
): Promise<BenchmarkResult> {
  const { validateSkillInput, validateSkillOutput } = await import('./validation');

  return benchmark(
    `Validate ${skill.metadata.name}`,
    async () => {
      validateSkillInput(skill.metadata, input);
      validateSkillOutput(skill.metadata, output);
    },
    config
  );
}

/**
 * Benchmark skill execution
 */
export async function benchmarkSkillExecution(
  skill: AnySkill,
  executor: (input: any) => Promise<any>,
  input: any,
  config: BenchmarkConfig = {}
): Promise<BenchmarkResult> {
  return benchmark(
    `Execute ${skill.metadata.name}`,
    async () => {
      await executor(input);
    },
    config
  );
}

/**
 * Comprehensive skill benchmark
 */
export async function benchmarkSkill(
  skill: AnySkill,
  options: {
    loader?: ProgressiveSkillLoader;
    executor?: (input: any) => Promise<any>;
    input?: any;
    output?: any;
    config?: BenchmarkConfig;
  } = {}
): Promise<SkillBenchmarkResult> {
  const { loader = new ProgressiveSkillLoader(), executor, input, output, config = {} } = options;

  const results: SkillBenchmarkResult = {
    skillId: skill.id,
    skillName: skill.metadata.name,
    load: await benchmarkSkillLoad(skill, loader, config),
    overall: {
      totalTime: 0,
      avgTime: 0,
      throughput: 0,
    },
  };

  let totalTime = results.load.totalTime;
  let count = 1;

  // Benchmark validation if schemas available
  if (skill.metadata.inputSchema && skill.metadata.outputSchema && input && output) {
    results.validation = await benchmarkSkillValidation(skill, input, output, config);
    totalTime += results.validation.totalTime;
    count++;
  }

  // Benchmark execution if executor provided
  if (executor && input) {
    results.execution = await benchmarkSkillExecution(skill, executor, input, config);
    totalTime += results.execution.totalTime;
    count++;
  }

  // Calculate overall stats
  results.overall = {
    totalTime,
    avgTime: totalTime / count,
    throughput: 1000 / (totalTime / count),
  };

  return results;
}

/**
 * Benchmark multiple skills
 */
export async function benchmarkSkills(
  skills: AnySkill[],
  options: {
    loader?: ProgressiveSkillLoader;
    executor?: (skill: AnySkill, input: any) => Promise<any>;
    input?: any;
    output?: any;
    config?: BenchmarkConfig;
  } = {}
): Promise<SkillBenchmarkResult[]> {
  const results: SkillBenchmarkResult[] = [];

  for (const skill of skills) {
    // Adapt executor type for benchmarkSkill
    const adaptedOptions = {
      ...options,
      executor: options.executor
        ? (input: any) => options.executor!(skill, input)
        : undefined,
    } as any; // Type cast to handle executor type mismatch

    const result = await benchmarkSkill(skill, adaptedOptions);
    results.push(result);
  }

  return results;
}

/**
 * Get memory statistics
 */
export function getMemoryStats(): MemoryStats {
  const usage = process.memoryUsage();

  return {
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    rss: usage.rss,
  };
}

/**
 * Format benchmark results
 */
export function formatBenchmarkResults(results: SkillBenchmarkResult[]): string {
  const lines: string[] = [];

  lines.push('\n📊 Performance Benchmark Results');
  lines.push('=' .repeat(80));

  for (const result of results) {
    lines.push(`\n${result.skillName}`);
    lines.push('-'.repeat(80));

    // Load performance
    lines.push(`\n  Load:`);
    lines.push(`    Iterations: ${result.load.iterations}`);
    lines.push(`    Total: ${result.load.totalTime}ms`);
    lines.push(`    Avg: ${result.load.avgTime.toFixed(2)}ms`);
    lines.push(`    Min: ${result.load.minTime}ms`);
    lines.push(`    Max: ${result.load.maxTime}ms`);
    lines.push(`    Throughput: ${result.load.throughput.toFixed(2)} ops/sec`);

    if (result.load.memory) {
      lines.push(`    Memory:`);
      lines.push(`      Heap: ${(result.load.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      lines.push(`      RSS: ${(result.load.memory.rss / 1024 / 1024).toFixed(2)}MB`);
    }

    if (result.load.cache) {
      lines.push(`    Cache:`);
      lines.push(`      Hit rate: ${(result.load.cache.hitRate * 100).toFixed(1)}%`);
    }

    // Validation performance
    if (result.validation) {
      lines.push(`\n  Validation:`);
      lines.push(`    Avg: ${result.validation.avgTime.toFixed(2)}ms`);
      lines.push(`    Throughput: ${result.validation.throughput.toFixed(2)} ops/sec`);
    }

    // Execution performance
    if (result.execution) {
      lines.push(`\n  Execution:`);
      lines.push(`    Avg: ${result.execution.avgTime.toFixed(2)}ms`);
      lines.push(`    Throughput: ${result.execution.throughput.toFixed(2)} ops/sec`);
    }

    // Overall
    lines.push(`\n  Overall:`);
    lines.push(`    Total: ${result.overall.totalTime}ms`);
    lines.push(`    Avg: ${result.overall.avgTime.toFixed(2)}ms`);
    lines.push(`    Throughput: ${result.overall.throughput.toFixed(2)} ops/sec`);
  }

  // Summary
  lines.push('\n' + '='.repeat(80));
  lines.push('\nSummary:');
  lines.push(`  Total skills: ${results.length}`);
  lines.push(`  Avg load time: ${(results.reduce((a, b) => a + b.load.avgTime, 0) / results.length).toFixed(2)}ms`);
  lines.push(`  Avg throughput: ${(results.reduce((a, b) => a + b.load.throughput, 0) / results.length).toFixed(2)} ops/sec`);

  return lines.join('\n');
}

/**
 * Compare benchmark results
 */
export function compareBenchmarkResults(
  before: SkillBenchmarkResult[],
  after: SkillBenchmarkResult[]
): Array<{
  skillId: string;
  skillName: string;
  loadImprovement: number;
  overallImprovement: number;
}> {
  return before.map((beforeResult, index) => {
    const afterResult = after[index];

    const loadImprovement =
      ((beforeResult.load.avgTime - afterResult.load.avgTime) / beforeResult.load.avgTime) * 100;

    const overallImprovement =
      ((beforeResult.overall.avgTime - afterResult.overall.avgTime) / beforeResult.overall.avgTime) * 100;

    return {
      skillId: beforeResult.skillId,
      skillName: beforeResult.skillName,
      loadImprovement,
      overallImprovement,
    };
  });
}

/**
 * Detect performance regressions
 */
export function detectRegressions(
  baseline: SkillBenchmarkResult[],
  current: SkillBenchmarkResult[],
  threshold: number = 10 // 10% degradation threshold
): Array<{
  skillId: string;
  skillName: string;
  regression: number;
  severity: 'low' | 'medium' | 'high';
}> {
  const regressions: Array<{
    skillId: string;
    skillName: string;
    regression: number;
    severity: 'low' | 'medium' | 'high';
  }> = [];

  for (let i = 0; i < baseline.length; i++) {
    const base = baseline[i];
    const curr = current[i];

    const regression =
      ((curr.load.avgTime - base.load.avgTime) / base.load.avgTime) * 100;

    if (regression > threshold) {
      let severity: 'low' | 'medium' | 'high' = 'low';
      if (regression > threshold * 2) {
        severity = 'high';
      } else if (regression > threshold * 1.5) {
        severity = 'medium';
      }

      regressions.push({
        skillId: base.skillId,
        skillName: base.skillName,
        regression,
        severity,
      });
    }
  }

  return regressions;
}

/**
 * Create benchmark report
 */
export function createBenchmarkReport(
  results: SkillBenchmarkResult[],
  options?: {
    includeMemory?: boolean;
    includeCache?: boolean;
    format?: 'text' | 'json';
  }
): string {
  const format = options?.format || 'text';

  if (format === 'json') {
    return JSON.stringify(results, null, 2);
  }

  return formatBenchmarkResults(results);
}

/**
 * Save benchmark results to file
 */
export async function saveBenchmarkResults(
  results: SkillBenchmarkResult[],
  filepath: string,
  format: 'json' | 'csv' = 'json'
): Promise<void> {
  const fs = await import('fs/promises');

  let content: string;

  if (format === 'json') {
    content = JSON.stringify(results, null, 2);
  } else {
    // CSV format
    const headers = ['skillId', 'skillName', 'loadAvgTime', 'loadThroughput', 'overallAvgTime', 'overallThroughput'];
    const rows = results.map(r => [
      r.skillId,
      r.skillName,
      r.load.avgTime.toFixed(2),
      r.load.throughput.toFixed(2),
      r.overall.avgTime.toFixed(2),
      r.overall.throughput.toFixed(2),
    ]);

    content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  await fs.writeFile(filepath, content, 'utf-8');
}

/**
 * Load benchmark results from file
 */
export async function loadBenchmarkResults(
  filepath: string,
  format: 'json' | 'csv' = 'json'
): Promise<SkillBenchmarkResult[]> {
  const fs = await import('fs/promises');
  const content = await fs.readFile(filepath, 'utf-8');

  if (format === 'json') {
    return JSON.parse(content);
  }

  // CSV format
  const lines = content.split('\n');
  const headers = lines[0].split(',');

  return lines.slice(1).map(line => {
    const values = line.split(',');
    return {
      skillId: values[0],
      skillName: values[1],
      load: {
        name: 'load',
        iterations: 0,
        totalTime: 0,
        avgTime: parseFloat(values[2]),
        minTime: 0,
        maxTime: 0,
        throughput: parseFloat(values[3]),
      },
      overall: {
        totalTime: 0,
        avgTime: parseFloat(values[4]),
        throughput: parseFloat(values[5]),
      },
    };
  });
}
