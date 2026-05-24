#!/usr/bin/env bun
/**
 * Comprehensive test for Sprint 1 performance improvements
 *
 * Tests:
 * 1. Streaming skill loader (1.1)
 * 2. Intelligent skill caching (1.2)
 * 3. Parallel skill loading (1.3)
 */

import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runTest(script: string, name: string): Promise<boolean> {
  console.log(chalk.cyan(`\n${'='.repeat(70)}`));
  console.log(chalk.cyan(`  Running: ${name}`));
  console.log(chalk.cyan(`${'='.repeat(70)}\n`));

  try {
    const { stdout, stderr } = await execAsync(`bun ${script}`, {
      cwd: process.cwd(),
    });

    if (stdout) {
      console.log(stdout);
    }

    if (stderr) {
      console.error(chalk.red(stderr));
    }

    console.log(chalk.green(`\n✅ ${name} - PASSED\n`));
    return true;
  } catch (error: any) {
    console.error(chalk.red(`\n❌ ${name} - FAILED`));
    console.error(chalk.red(error.message));
    if (error.stderr) {
      console.error(chalk.red(error.stderr));
    }
    console.log();
    return false;
  }
}

async function main() {
  console.log(chalk.cyan('\n'));
  console.log(chalk.cyan('╔════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║'));
  console.log(chalk.cyan('║   🚀 Kode Skill System - Sprint 1 Performance Tests'));
  console.log(chalk.cyan('║'));
  console.log(chalk.cyan('╚════════════════════════════════════════════════════════════════════╝'));
  console.log(chalk.cyan('\n'));

  const tests = [
    { script: 'test-streaming-skill-loader.ts', name: '1.1 Streaming Skill Loader' },
    { script: 'test-skill-cache.ts', name: '1.2 Intelligent Skill Caching' },
    { script: 'test-parallel-skill-loader.ts', name: '1.3 Parallel Skill Loading' },
  ];

  const results: Array<{ name: string; passed: boolean }> = [];

  for (const test of tests) {
    const passed = await runTest(test.script, test.name);
    results.push({ name: test.name, passed: passed });
  }

  // Print summary
  console.log(chalk.cyan('\n'));
  console.log(chalk.cyan('╔════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║'));
  console.log(chalk.cyan('║   📊 Test Summary'));
  console.log(chalk.cyan('║'));
  console.log(chalk.cyan('╚════════════════════════════════════════════════════════════════════╝'));
  console.log(chalk.cyan('\n'));

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const status = result.passed ? chalk.green('✅ PASS') : chalk.red('❌ FAIL');
    console.log(`${status} ${result.name}`);

    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log(chalk.cyan('\n' + '─'.repeat(70) + '\n'));

  console.log(`Total: ${results.length} tests`);
  console.log(chalk.green(`Passed: ${passed}`));
  if (failed > 0) {
    console.log(chalk.red(`Failed: ${failed}`));
  }

  // Performance improvements summary
  console.log(chalk.cyan('\n'));
  console.log(chalk.cyan('╔════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║'));
  console.log(chalk.cyan('║   📈 Expected Performance Improvements (Sprint 1)'));
  console.log(chalk.cyan('║'));
  console.log(chalk.cyan('╚════════════════════════════════════════════════════════════════════╝'));
  console.log(chalk.cyan('\n'));

  console.log('1. Streaming Skill Loader:');
  console.log(chalk.gray('   - 60-80% reduction in time-to-first-byte'));
  console.log(chalk.gray('   - Core content available immediately'));
  console.log(chalk.gray('   - Progressive loading of sections\n'));

  console.log('2. Intelligent Skill Caching:');
  console.log(chalk.gray('   - 90% time reduction for repeated loads'));
  console.log(chalk.gray('   - 70-80% disk cache hit rate'));
  console.log(chalk.gray('   - Automatic invalidation on file changes\n'));

  console.log('3. Parallel Skill Loading:');
  console.log(chalk.gray('   - 75% time reduction for 5+ skills'));
  console.log(chalk.gray('   - Automatic dependency analysis'));
  console.log(chalk.gray('   - Topological sort for execution order\n'));

  console.log(chalk.cyan('─'.repeat(70) + '\n'));

  if (failed === 0) {
    console.log(chalk.green('✨ All tests passed! Sprint 1 is complete!\n'));
    process.exit(0);
  } else {
    console.log(chalk.red('⚠️  Some tests failed. Please review the errors above.\n'));
    process.exit(1);
  }
}

main().catch(error => {
  console.error(chalk.red(`\n❌ Fatal error: ${error.message}`));
  console.error(error);
  process.exit(1);
});
