#!/bin/bash

# 测试 memory 命令的 tab 补全

echo "🔍 Testing memory commands tab completion..."
echo ""

# 创建测试脚本来测试 AutoCompleter
cat > /tmp/test-memory-completion.js << EOF
const { AutoCompleter, createDefaultCompletionConfig } = require('/Users/mac/kode/dist/completion');

// 创建 completer
const config = createDefaultCompletionConfig('/Users/mac/kode');
const completer = new AutoCompleter(config);

// 测试的 memory 命令
const memoryCommands = [
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
];

console.log('✅ Testing memory commands in completer...\n');

let passed = 0;
let failed = 0;

memoryCommands.forEach(cmd => {
  // 测试命令名补全
  const result = completer.complete(cmd);
  if (result.candidates.includes(cmd) || result.type === 'command') {
    console.log(`✓ ${cmd} - found in completion`);
    passed++;
  } else {
    console.log(`✗ ${cmd} - NOT found in completion`);
    failed++;
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

// 测试部分输入补全
console.log('\n🔍 Testing partial input completion...\n');

const tests = [
  { input: '/de', expected: ['/decision', '/decisions'] },
  { input: '/memo-', expected: ['/memo-index', '/memo-doc', '/memo-stats'] },
  { input: '/memory-', expected: ['/memory-history', '/memory-errors', '/memory-prefs', '/memory-sessions', '/memory-reasoning', '/memory-stats'] },
  { input: '/tas', expected: ['/tasks'] },
  { input: '/task-', expected: ['/task-search'] },
];

tests.forEach(test => {
  const result = completer.complete(test.input);
  const found = test.expected.filter(cmd => result.candidates.includes(cmd));
  if (found.length === test.expected.length) {
    console.log(`✓ "${test.input}" → ${found.join(', ')}`);
  } else {
    console.log(`✗ "${test.input}" → expected ${test.expected.join(', ')}, got ${result.candidates.join(', ') || 'none'}`);
  }
});

process.exit(failed > 0 ? 1 : 0);
EOF

# 运行测试
node /tmp/test-memory-completion.js

echo ""
echo "✅ Memory tab completion test completed!"
