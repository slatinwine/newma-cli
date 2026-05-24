#!/usr/bin/env node
/**
 * Tab Completion Test Script
 *
 * 测试自动补全功能
 */

import { AutoCompleter, createDefaultCompletionConfig, CompletionType } from './src/completion';

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
};

function log(message: string, color = colors.cyan) {
  console.log(`${color}${message}${colors.reset}`);
}

function logResult(testName: string, input: string, results: string[], type: CompletionType) {
  log(`\n✓ ${testName}`, colors.green);
  log(`  Input: "${input}"`, colors.gray);
  log(`  Type: ${type}`, colors.yellow);
  log(`  Candidates:`, colors.gray);
  results.forEach(r => console.log(`    - ${r}`));
}

async function testCompletion() {
  log('\n🧪 Tab Completion Test Suite', colors.cyan);
  log('═'.repeat(60), colors.gray);

  // 创建补全器
  const config = createDefaultCompletionConfig(process.cwd());
  const completer = new AutoCompleter(config);

  // 测试 1: 空行补全（应该返回所有命令）
  const test1 = completer.complete('');
  logResult('Test 1: Empty line', '', test1.candidates, test1.type);

  // 测试 2: 命令名补全
  const test2 = completer.complete('/h');
  logResult('Test 2: Command prefix', '/h', test2.candidates, test2.type);

  // 测试 3: /set 命令选项补全
  const test3 = completer.complete('/set ');
  logResult('Test 3: /set options', '/set ', test3.candidates, test3.type);

  // 测试 4: /set 值补全
  const test4 = completer.complete('/set ultrathink ');
  logResult('Test 4: /set ultrathink values', '/set ultrathink ', test4.candidates, test4.type);

  // 测试 5: 文件路径补全
  const test5 = completer.complete('src');
  logResult('Test 5: File path', 'src', test5.candidates, test5.type);

  // 测试 6: 不完整的命令
  const test6 = completer.complete('/pl');
  logResult('Test 6: Incomplete command', '/pl', test6.candidates, test6.type);

  // 测试 7: 别名补全
  const test7 = completer.complete('?');
  logResult('Test 7: Alias', '?', test7.candidates, test7.type);

  // 测试 8: 非命令输入（应该返回空）
  const test8 = completer.complete('random text');
  logResult('Test 8: Non-command input', 'random text', test8.candidates, test8.type);

  // 测试 9: /help 命令补全
  const test9 = completer.complete('/help ');
  logResult('Test 9: /help categories', '/help ', test9.candidates, test9.type);

  // 测试 10: 历史更新测试
  completer.updateHistory(['/plan test', '/chat hello', '/status']);
  const test10 = completer.complete('');
  log('\n✓ Test 10: History update', colors.green);
  log(`  Added 3 commands to history`, colors.gray);
  log(`  Total candidates: ${test10.candidates.length}`, colors.gray);

  log('\n' + '═'.repeat(60), colors.gray);
  log('✅ All tests completed!\n', colors.green);
}

// 运行测试
testCompletion().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
