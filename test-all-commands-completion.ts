/**
 * Test All Commands Tab Completion
 *
 * 验证所有命令的 tab 补全功能
 */

import { AutoCompleter, createDefaultCompletionConfig } from './src/completion';

// 创建 completer
const config = createDefaultCompletionConfig('/Users/mac/kode');
const completer = new AutoCompleter(config);

// 定义所有预期的命令（按类别分组）
const expectedCommands = {
  core: [
    '/help',
    '/status',
    '/history',
    '/clear',
    '/exit',
    '/time',
    '/skills',
  ],
  mode: [
    '/chat',
    '/plan',
    '/do',
    '/loop',
    '/execute',
    '/verify',
  ],
  settings: [
    '/set',
    '/fft',
    '/landmark',
    '/ultrathink',
    '/profile',
  ],
  system: [
    '/plugins',
    '/hooks',
    '/event-source',
  ],
  memory: [
    '/decision',
    '/decisions',
    '/memo-index',
    '/find',
    '/memo-doc',
    '/memo-stats',
    '/tasks',
    '/task-search',
    '/memory-history',
    '/memory-errors',
    '/memory-prefs',
    '/memory-sessions',
    '/memory-reasoning',
    '/memory-stats',
  ],
};

// 别名测试
const expectedAliases = [
  ['?', '/help'],
  ['h', '/help'],
  ['cls', '/clear'],
  ['quit', '/exit'],
  ['q', '/exit'],
];

console.log('🔍 Tab Completion Test Suite\n');
console.log('═'.repeat(60) + '\n');

// 测试 1: 验证所有命令都在补全列表中
console.log('📋 Test 1: Command Registration\n');
let totalPassed = 0;
let totalFailed = 0;

Object.entries(expectedCommands).forEach(([category, commands]) => {
  console.log(`${category.toUpperCase()} Commands:`);
  commands.forEach(cmd => {
    const result = completer.complete(cmd);
    if (result.candidates.includes(cmd)) {
      console.log(`  ✓ ${cmd}`);
      totalPassed++;
    } else {
      console.log(`  ✗ ${cmd} - MISSING`);
      totalFailed++;
    }
  });
  console.log('');
});

// 测试 2: 验证别名
console.log('\n🔗 Test 2: Command Aliases\n');
expectedAliases.forEach(([alias, target]) => {
  const result = completer.complete(alias);
  if (result.candidates.includes(alias) || result.candidates.includes(target)) {
    console.log(`  ✓ ${alias} → ${target}`);
    totalPassed++;
  } else {
    console.log(`  ✗ ${alias} → ${target} - MISSING`);
    totalFailed++;
  }
});

// 测试 3: 部分输入补全
console.log('\n⚡ Test 3: Partial Input Completion\n');
const partialTests = [
  { input: '/he', expected: ['/help'] },
  { input: '/s', expected: ['/status', '/set'] },
  { input: '/m', expected: ['/memo-index', '/memo-doc', '/memo-stats', '/memory-history', '/memory-errors', '/memory-prefs', '/memory-sessions', '/memory-reasoning', '/memory-stats'] },
  { input: '/e', expected: ['/exit', '/execute', '/event-source'] },
  { input: '/d', expected: ['/decision', '/decisions', '/do'] },
  { input: '/ta', expected: ['/tasks', '/task-search'] },
];

partialTests.forEach(test => {
  const result = completer.complete(test.input);
  const found = test.expected.filter(cmd => result.candidates.includes(cmd));
  if (found.length === test.expected.length) {
    console.log(`  ✓ "${test.input}" → ${found.length} matches`);
    totalPassed++;
  } else {
    console.log(`  ✗ "${test.input}" → expected ${test.expected.length}, found ${found.length}`);
    totalFailed++;
  }
});

// 测试 4: 空输入应该显示所有命令
console.log('\n🌟 Test 4: Empty Input (All Commands)\n');
const allCommands = Object.values(expectedCommands).flat();
const emptyResult = completer.complete('');
if (emptyResult.candidates.length === allCommands.length) {
  console.log(`  ✓ All ${allCommands.length} commands registered`);
  totalPassed++;
} else {
  console.log(`  ✗ Expected ${allCommands.length} commands, got ${emptyResult.candidates.length}`);
  console.log(`    Missing: ${allCommands.filter(cmd => !emptyResult.candidates.includes(cmd)).join(', ')}`);
  totalFailed++;
}

// 测试 5: 无效输入不应该匹配任何命令
console.log('\n❌ Test 5: Invalid Input\n');
const invalidResult = completer.complete('/xyz-nonexistent');
if (invalidResult.candidates.length === 0) {
  console.log(`  ✓ Correctly returns empty for invalid command`);
  totalPassed++;
} else {
  console.log(`  ✗ Expected 0 candidates, got ${invalidResult.candidates.length}`);
  totalFailed++;
}

// 总结
console.log('\n' + '═'.repeat(60));
console.log('\n📊 Test Summary\n');
console.log(`  Total Passed: ${totalPassed}`);
console.log(`  Total Failed: ${totalFailed}`);
console.log(`  Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%\n`);

if (totalFailed === 0) {
  console.log('✅ All tests passed!\n');
  process.exit(0);
} else {
  console.log('❌ Some tests failed!\n');
  process.exit(1);
}
