#!/usr/bin/env node
/**
 * Final Tab Completion Test
 *
 * 使用真实的 readline 输入场景
 */

import { AutoCompleter, createDefaultCompletionConfig } from './src/completion';
import readline from 'readline';

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

async function testCompletion() {
  log('\n🧪 Tab Completion Test Suite (Final)', colors.cyan);
  log('═'.repeat(70), colors.gray);

  const config = createDefaultCompletionConfig(process.cwd());
  const completer = new AutoCompleter(config);

  // 测试用例 - 使用数组来确保尾部空格被保留
  const tests: [string, string][] = [
    ['', 'Empty line'],
    ['/', 'Just slash'],
    ['/h', '/h prefix'],
    ['/set', '/set (no space)'],
    ['/set ', '/set with space'],
    ['/set u', '/set u'],
    ['/set ultrathink ', '/set ultrathink with space'],
    ['/help ', '/help with space'],
    ['?', 'Alias ?'],
  ];

  for (const [input, desc] of tests) {
    const result = completer.complete(input);

    log(`\n📝 ${desc}`, colors.green);
    log(`   Input: "${input}" (${input.length} chars)`, colors.gray);
    log(`   Input bytes: ${Buffer.from(input).toString('hex')}`, colors.gray);
    log(`   Type: ${result.type}`, colors.yellow);

    if (result.candidates.length === 0) {
      log(`   Candidates: (none)`, colors.gray);
    } else {
      log(`   Candidates (${result.candidates.length}):`, colors.gray);
      result.candidates.slice(0, 5).forEach(c => console.log(`     - ${c}`));
      if (result.candidates.length > 5) {
        console.log(`     ... and ${result.candidates.length - 5} more`);
      }
    }
  }

  log('\n' + '═'.repeat(70), colors.gray);
  log('✅ All tests completed!\n', colors.green);
}

testCompletion().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
