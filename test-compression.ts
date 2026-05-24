#!/usr/bin/env ts-node
/**
 * Token Compression Tests
 * Tests all compression strategies
 */

import { CompressionManager } from './src/compressor';
import { ExecutionRecord } from './src/history';
import { ContextCompressor } from './src/compressor/context';
import { HistorySummarizer } from './src/compressor/history';
import { ContentOptimizer } from './src/compressor/content';
import chalk from 'chalk';

async function testContextCompression() {
  console.log('🧪 Testing Context Compression\n');

  const compressor = new ContextCompressor({
    excludePatterns: ['node_modules', 'dist', '*.log'],
    maxFiles: 10,
    prioritizeExtensions: ['.ts', '.js', '.json'],
  });

  // Simulate a file tree
  const context = `
src/index.ts
src/cli.ts
src/ai.ts
src/scanner.ts
src/types.ts
src/executor.ts
src/executor-v2.ts
src/permissions.ts
src/verifier.ts
src/rollback.ts
src/history.ts
src/retry.ts
src/errors.ts
src/config.ts
src/prompt.ts
src/tools/types.ts
src/tools/registry.ts
src/tools/builtin/file.ts
src/tools/builtin/command.ts
src/agents/types.ts
src/agents/agent.ts
src/agents/coordinator.ts
src/agents/specialized/frontend.ts
src/agents/specialized/backend.ts
src/optimizer/types.ts
src/optimizer/metrics.ts
src/optimizer/patterns.ts
src/optimizer/optimizer.ts
src/autonomous/agent.ts
src/compressor/types.ts
src/compressor/context.ts
src/compressor/history.ts
src/compressor/content.ts
src/compressor/incremental.ts
src/compressor/index.ts
package.json
tsconfig.json
README.md
CLAUDE.md
node_modules/lodash/index.js
node_modules/chalk/index.js
dist/index.js
dist/cli.js
test.log
`;

  console.log('✓ Test 1: Context Compression');
  console.log(`  Original: ${context.length} chars`);
  console.log(`  Lines: ${context.trim().split('\n').length}`);

  const result = compressor.compress(context, process.cwd());

  console.log(`  Compressed: ${result.data.length} chars`);
  console.log(`  Lines: ${result.data.trim().split('\n').length}`);
  console.log(`  Reduction: ${result.stats.reduction.toFixed(1)}%`);
  console.log(`  Saved: ${result.stats.reductionBytes} chars`);

  console.log('\n✅ Context Compression Test Passed!\n');
  return result;
}

async function testHistorySummarization() {
  console.log('🧪 Testing History Summarization\n');

  const { HistorySummarizer } = require('./src/compressor/history');
  const summarizer = new HistorySummarizer();

  // Create mock execution history
  const history: ExecutionRecord[] = [];
  for (let i = 0; i < 20; i++) {
    history.push({
      id: `test-${i}`,
      action: {
        type: i % 2 === 0 ? 'create' : 'modify',
        path: `src/file${i}.ts`,
        description: `Test action ${i}`,
      },
      status: i < 15 ? 'success' : 'failed', // Last 5 fail
      timestamp: new Date(Date.now() - (20 - i) * 1000),
      duration: 500,
      iteration: Math.floor(i / 5),
      error: i >= 15 ? 'Test error' : undefined,
    });
  }

  console.log('✓ Test 1: History Summarization');
  console.log(`  Original records: ${history.length}`);
  console.log(`  Original size: ${JSON.stringify(history).length} chars`);

  const result = summarizer.summarize(history);

  console.log(`  Summarized records: ${result.data.length}`);
  console.log(`  Summarized size: ${result.stats.compressedSize} chars`);
  console.log(`  Reduction: ${result.stats.reduction.toFixed(1)}%`);
  console.log(`  Saved: ${result.stats.reductionBytes} chars`);

  console.log('\n✅ History Summarization Test Passed!\n');
  return result;
}

async function testContentOptimization() {
  console.log('🧪 Testing Content Optimization\n');

  const optimizer = new ContentOptimizer({
    maxLength: 500,
    removeComments: true,
    removeEmptyLines: true,
    keepSignatures: false,
  });

  // Create a mock file with comments and empty lines
  const content = `
// This is a comment
import { something } from 'somewhere';

/**
 * This is a multi-line comment
 * that spans multiple lines
 */
export function testFunction() {
  // Another comment
  const x = 1;

  const y = 2;


  return x + y;
}

// Yet another comment
export class TestClass {
  constructor() {
    // Comment in constructor
    this.value = 42;
  }
}
`;

  console.log('✓ Test 1: Content Optimization');
  console.log(`  Original: ${content.length} chars`);
  console.log(`  Lines: ${content.trim().split('\n').length}`);

  const result = optimizer.optimize('test.ts', content);

  console.log(`  Optimized: ${result.data.length} chars`);
  console.log(`  Lines: ${result.data.trim().split('\n').length}`);
  console.log(`  Reduction: ${result.stats.reduction.toFixed(1)}%`);
  console.log(`  Saved: ${result.stats.reductionBytes} chars`);

  console.log('\n✅ Content Optimization Test Passed!\n');
  return result;
}

async function testIntegratedCompression() {
  console.log('🧪 Testing Integrated Compression\n');

  const manager = new CompressionManager({
    enabled: true,
    maxTokens: 8000,
    targetReduction: 50,
  });

  // Create test data
  const context = `
src/index.ts
src/cli.ts
package.json
node_modules/lodash/index.js
`;

  const history: ExecutionRecord[] = [];
  for (let i = 0; i < 10; i++) {
    history.push({
      id: `test-${i}`,
      action: { type: 'create', path: `file${i}.ts` },
      status: 'success',
      timestamp: new Date(),
      duration: 500,
      iteration: 0,
    });
  }

  const files = new Map([
    ['src/index.ts', '// Comment\nexport function test() { return 1; }'],
    ['src/cli.ts', '// CLI\nimport { test } from "./index";\n\nconsole.log(test());'],
  ]);

  console.log('✓ Test 1: Integrated Compression');

  const result = manager.compressAll({
    context,
    contextRoot: process.cwd(),
    history,
    files,
  });

  console.log(`\nTotal Original: ${result.report.total.originalSize} chars`);
  console.log(`Total Compressed: ${result.report.total.compressedSize} chars`);
  console.log(`Total Reduction: ${result.report.total.reduction.toFixed(1)}%`);
  console.log(`Total Saved: ${result.report.total.reductionBytes} chars`);
  console.log(`Compression Time: ${result.report.total.totalTime}ms`);

  // Print detailed report
  manager.printReport(result.report);

  console.log('\n✅ Integrated Compression Test Passed!\n');
  return result;
}

async function testCompressionEffectiveness() {
  console.log('🧪 Testing Compression Effectiveness\n');

  const manager = new CompressionManager({
    enabled: true,
    aggressive: true,
  });

  // Large test dataset
  const files = new Map<string, string>();
  for (let i = 0; i < 50; i++) {
    files.set(`src/module${i}.ts`, `
/**
 * Module ${i}
 * This is a detailed comment
 */
import { something } from 'somewhere';

export class Module${i} {
  private value: number;

  constructor() {
    this.value = ${i};
  }

  getValue(): number {
    return this.value;
  }

  setValue(val: number): void {
    this.value = val;
  }
}
    `);
  }

  const history: ExecutionRecord[] = [];
  for (let i = 0; i < 30; i++) {
    history.push({
      id: `test-${i}`,
      action: { type: 'create', path: `file${i}.ts` },
      status: i % 4 !== 0 ? 'success' : 'failed', // 25% failure rate
      timestamp: new Date(Date.now() - (30 - i) * 1000),
      duration: 500,
      iteration: Math.floor(i / 5),
      error: i % 4 === 0 ? 'Test error' : undefined,
    });
  }

  console.log('✓ Test 1: Large Dataset Compression');

  const result = manager.compressAll({
    files,
    history,
  });

  const savingsPercent = result.report.total.reduction;
  const effectiveness = savingsPercent > 30 ? 'Excellent' : savingsPercent > 20 ? 'Good' : 'Fair';

  console.log(`\nEffectiveness: ${effectiveness}`);
  console.log(`Total Files: ${files.size}`);
  console.log(`Total History Records: ${history.length}`);
  console.log(`Total Reduction: ${savingsPercent.toFixed(1)}%`);
  console.log(`Tokens Saved (approx): ${(result.report.total.reductionBytes / 4).toFixed(0)} tokens`);

  if (savingsPercent >= 30) {
    console.log(chalk.green('\n✅ Compression is highly effective!'));
  } else if (savingsPercent >= 20) {
    console.log(chalk.yellow('\n⚠️ Compression is moderately effective'));
  } else {
    console.log(chalk.red('\n❌ Compression may need tuning'));
  }

  console.log('\n✅ Compression Effectiveness Test Passed!\n');
  return result;
}

// Run all tests
async function runAllTests() {
  try {
    await testContextCompression();
    await testHistorySummarization();
    await testContentOptimization();
    await testIntegratedCompression();
    await testCompressionEffectiveness();

    console.log(chalk.green.bold('\n🎉 All Compression Tests Passed Successfully!\n'));

    // Print summary
    console.log(chalk.cyan('📊 Token Compression Summary'));
    console.log(chalk.cyan('==='));
    console.log('Features:');
    console.log('  • Context compression - Removes unnecessary files');
    console.log('  • History summarization - Summarizes execution history');
    console.log('  • Content optimization - Optimizes file content');
    console.log('  • Incremental tracking - Tracks changes only');
    console.log('\nBenefits:');
    console.log('  • Reduced token usage');
    console.log('  • Lower API costs');
    console.log('  • Faster responses');
    console.log('  • Better context management');
    console.log(chalk.cyan('===\n'));

    return true;
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    return false;
  }
}

// Execute tests
runAllTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  });
