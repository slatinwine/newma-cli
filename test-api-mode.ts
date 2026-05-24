#!/usr/bin/env ts-node
/**
 * API Mode Test Suite
 *
 * 测试新添加的 API 模式功能
 * 验证输出纯净度、响应正确性和性能
 */

import { runApiMode, readStdin, formatOutput } from './src/api';
import { getDefaultConfig } from './src/config';
import * as path from 'path';

// 测试结果统计
interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  outputLength: number;
  error?: string;
}

const results: TestResult[] = [];

/**
 * 运行单个测试
 */
async function runTest(
  name: string,
  input: string,
  mode: 'chat' | 'plan' = 'chat'
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`   Input: "${input.substring(0, 50)}${input.length > 50 ? '...' : ''}"`);
    console.log(`   Mode: ${mode}`);

    const config = getDefaultConfig();
    const response = await runApiMode(config, process.cwd(), input, { mode, silent: true });

    const duration = Date.now() - startTime;
    const outputLength = response.length;

    console.log(`   ✅ Passed`);
    console.log(`   ⏱️  Duration: ${duration}ms`);
    console.log(`   📏 Output length: ${outputLength} chars`);
    console.log(`   📄 Output preview: ${response.substring(0, 100)}...`);

    // 验证输出不为空
    if (!response || response.trim().length === 0) {
      throw new Error('Response is empty');
    }

    // 验证没有启动噪音
    const noisePatterns = [
      /NEWMA\s+AI\s+Assistant/i,
      /Session:\s+\w+/i,
      /Project:\s+\w+/i,
      /\[PLUGIN\].*Loading plugins/i,
      /Precipitation.*Starting/i,
      /DraftManager.*Initializing/i,
    ];

    for (const pattern of noisePatterns) {
      if (pattern.test(response)) {
        throw new Error(`Found noise pattern: ${pattern}`);
      }
    }

    return {
      name,
      passed: true,
      duration,
      outputLength,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.log(`   ❌ Failed: ${error.message}`);

    return {
      name,
      passed: false,
      duration,
      outputLength: 0,
      error: error.message,
    };
  }
}

/**
 * 测试套件
 */
async function runTests() {
  console.log('═'.repeat(60));
  console.log('🚀 Newma API Mode Test Suite');
  console.log('═'.repeat(60));

  // 测试1: 简单问答
  results.push(await runTest(
    'Simple Q&A',
    'What is 2+2?',
    'chat'
  ));

  // 测试2: 代码解释
  results.push(await runTest(
    'Code Explanation',
    'Explain what map() does in JavaScript',
    'chat'
  ));

  // 测试3: 规则理解
  results.push(await runTest(
    'Rule Understanding',
    'What are the phases in a round of Twisted Cryptids?',
    'chat'
  ));

  // 测试4: Plan 模式
  results.push(await runTest(
    'Plan Mode',
    'Plan how to add a login page',
    'plan'
  ));

  // 测试5: 长文本输入
  results.push(await runTest(
    'Long Input',
    'Explain the difference between const, let, and var in JavaScript with examples',
    'chat'
  ));

  // 测试6: 短输入
  results.push(await runTest(
    'Short Input',
    'Hello',
    'chat'
  ));

  // 测试7: 特殊字符
  results.push(await runTest(
    'Special Characters',
    'What does $ mean in regex?',
    'chat'
  ));

  // 测试8: 多行输入
  results.push(await runTest(
    'Multi-line Input',
    'Here is a code snippet:\n\nconst x = 5;\nconsole.log(x);\n\nWhat does this do?',
    'chat'
  ));

  // 打印统计
  printSummary();
}

/**
 * 打印测试总结
 */
function printSummary() {
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Test Summary');
  console.log('═'.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => r.passed === false).length;
  const total = results.length;

  console.log(`\nTotal Tests: ${total}`);
  console.log(`✅ Passed: ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failed} (${((failed / total) * 100).toFixed(1)}%)`);

  // 平均性能
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / total;
  const avgLength = results.reduce((sum, r) => sum + r.outputLength, 0) / total;

  console.log(`\n⏱️  Average Duration: ${avgDuration.toFixed(0)}ms`);
  console.log(`📏 Average Output Length: ${avgLength.toFixed(0)} chars`);

  // 失败的测试
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`   - ${r.name}: ${r.error}`);
      });
  }

  // 成功的测试（最短和最长）
  console.log('\n🏆 Performance Rankings:');
  const sortedByDuration = [...results].sort((a, b) => a.duration - b.duration);
  console.log(`   Fastest: ${sortedByDuration[0].name} (${sortedByDuration[0].duration}ms)`);
  console.log(`   Slowest: ${sortedByDuration[sortedByDuration.length - 1].name} (${sortedByDuration[sortedByDuration.length - 1].duration}ms)`);

  const sortedByLength = [...results].sort((a, b) => a.outputLength - b.outputLength);
  console.log(`   Shortest Output: ${sortedByLength[0].name} (${sortedByLength[0].outputLength} chars)`);
  console.log(`   Longest Output: ${sortedByLength[sortedByLength.length - 1].name} (${sortedByLength[sortedByLength.length - 1].outputLength} chars)`);

  console.log('\n' + '═'.repeat(60));

  // 退出码
  process.exit(failed > 0 ? 1 : 0);
}

// 运行测试
runTests().catch((error) => {
  console.error('\n💥 Test suite crashed:', error);
  process.exit(1);
});
