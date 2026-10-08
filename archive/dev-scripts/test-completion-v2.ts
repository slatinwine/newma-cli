#!/usr/bin/env node
/**
 * Tab Completion Test V2
 *
 * 更详细的测试，显示实际补全逻辑
 */

import { AutoCompleter, createDefaultCompletionConfig } from './src/completion';

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
  red: '\x1b[31m',
};

function log(message: string, color = colors.cyan) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testDetailed() {
  log('\n🧪 Detailed Completion Tests', colors.cyan);
  log('═'.repeat(70), colors.gray);

  const config = createDefaultCompletionConfig(process.cwd());
  const completer = new AutoCompleter(config);

  // 测试用例
  const tests = [
    { input: '', desc: 'Empty line - should show all commands' },
    { input: '/', desc: 'Just slash - should show all commands' },
    { input: '/h', desc: '/h prefix - should show /help, /history, /hooks' },
    { input: '/he', desc: '/he prefix - should show /help' },
    { input: '/set', desc: '/set (no space) - should show /set command' },
    { input: '/set ', desc: '/set with space - should show options' },
    { input: '/set u', desc: '/set u - should show ultrathink, useTools' },
    { input: '/set ultrathink', desc: '/set ultrathink (no space) - show option' },
    { input: '/set ultrathink ', desc: '/set ultrathink with space - show values' },
    { input: '/set ultrathink t', desc: '/set ultrathink t - should show true' },
    { input: '/help', desc: '/help (no space) - show command' },
    { input: '/help ', desc: '/help with space - show categories' },
    { input: '/help g', desc: '/help g - should show general' },
    { input: '?', desc: '? alias - should show /help' },
  ];

  for (const test of tests) {
    const result = completer.complete(test.input);

    log(`\n📝 ${test.desc}`, colors.green);
    log(`   Input: "${test.input}"`, colors.gray);
    log(`   Type: ${result.type}`, colors.yellow);

    if (result.candidates.length === 0) {
      log(`   Candidates: (none)`, colors.red);
    } else {
      log(`   Candidates (${result.candidates.length}):`, colors.gray);
      result.candidates.slice(0, 5).forEach(c => console.log(`     - ${c}`));
      if (result.candidates.length > 5) {
        console.log(`     ... and ${result.candidates.length - 5} more`);
      }
    }
  }

  log('\n' + '═'.repeat(70), colors.gray);
  log('✅ Tests completed!\n', colors.green);
}

testDetailed().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
