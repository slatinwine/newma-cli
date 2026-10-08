#!/usr/bin/env ts-node
/**
 * Test input validation for /plan command
 */

interface TestCase {
  input: string;
  shouldPass: boolean;
  description: string;
}

// 模拟 repl.ts 中的验证逻辑
function isValidTaskRequirement(requirement: string): boolean {
  // 检查长度 - 太短的要求通常是问候或无效输入
  if (requirement.length < 3) {
    return false;
  }

  const lowerReq = requirement.toLowerCase().trim();

  // 优先检查：如果包含编程相关的关键词，认为是有效任务
  const programmingKeywords = [
    'add', 'create', 'make', 'build', 'implement', 'write',
    'fix', 'debug', 'resolve', 'solve',
    'update', 'modify', 'change', 'refactor', 'improve',
    'delete', 'remove', 'clean',
    'test', 'check', 'verify', 'validate',
    'deploy', 'setup', 'configure', 'install',
    'api', 'function', 'class', 'component', 'page', 'feature',
    'bug', 'error', 'issue', 'problem',
    'user', 'auth', 'login', 'signup', 'database',
    '添加', '创建', '实现', '修复', '更新', '删除', '测试',
    '功能', '页面', '接口', '组件'
  ];

  // 如果包含编程关键词，直接接受
  if (programmingKeywords.some(keyword => lowerReq.includes(keyword))) {
    return true;
  }

  // 如果不包含编程关键词，检查是否是纯问候语
  const greetings = [
    'hi', 'hello', 'hey', '你好', '您好', '嗨',
    '早上好', '下午好', '晚上好', 'greetings'
  ];

  // 如果是纯问候语，拒绝
  if (greetings.some(g => lowerReq === g)) {
    return false;
  }

  // 其他情况：太短且不含关键词的输入也拒绝
  return false;
}

// 测试用例
const testCases: TestCase[] = [
  // 应该拒绝的输入（问候语）
  { input: '你好', shouldPass: false, description: '简单中文问候' },
  { input: 'hello', shouldPass: false, description: '简单英文问候' },
  { input: 'hi', shouldPass: false, description: '简短问候' },
  { input: '你好吗', shouldPass: false, description: '问候问句' },
  { input: '早上好', shouldPass: false, description: '时间问候' },

  // 应该拒绝的输入（太短）
  { input: 'a', shouldPass: false, description: '单字符' },
  { input: 'ab', shouldPass: false, description: '两个字符' },

  // 应该接受的输入（有效编程任务）
  { input: 'Add user authentication', shouldPass: true, description: '添加用户认证' },
  { input: 'Create a REST API', shouldPass: true, description: '创建 REST API' },
  { input: 'Fix the login bug', shouldPass: true, description: '修复登录 bug' },
  { input: 'Implement a search feature', shouldPass: true, description: '实现搜索功能' },
  { input: '添加登录功能', shouldPass: true, description: '中文：添加登录功能' },
  { input: '创建新的页面', shouldPass: true, description: '中文：创建新页面' },
  { input: '修复这个bug', shouldPass: true, description: '中文：修复 bug' },
  { input: 'update the database schema', shouldPass: true, description: '更新数据库模式' },
  { input: 'test the authentication flow', shouldPass: true, description: '测试认证流程' },
  { input: 'delete unused files', shouldPass: true, description: '删除未使用的文件' },

  // 边界情况
  { input: 'hello world add feature', shouldPass: true, description: '包含编程关键词（虽然有hello）' },
  { input: 'fix this', shouldPass: true, description: '简短但有效的任务' },
];

// 运行测试
function runTests() {
  console.log('🧪 Testing input validation for /plan command\n');
  console.log('═'.repeat(70));

  let passed = 0;
  let failed = 0;

  for (const test of testCases) {
    const result = isValidTaskRequirement(test.input);
    const success = result === test.shouldPass;

    if (success) {
      passed++;
      console.log(`✅ PASS: ${test.description}`);
      console.log(`   Input: "${test.input}"`);
      console.log(`   Expected: ${test.shouldPass ? 'ACCEPT' : 'REJECT'}, Got: ${result ? 'ACCEPT' : 'REJECT'}\n`);
    } else {
      failed++;
      console.log(`❌ FAIL: ${test.description}`);
      console.log(`   Input: "${test.input}"`);
      console.log(`   Expected: ${test.shouldPass ? 'ACCEPT' : 'REJECT'}, Got: ${result ? 'ACCEPT' : 'REJECT'}\n`);
    }
  }

  console.log('═'.repeat(70));
  console.log(`\n📊 Test Results:`);
  console.log(`   Total: ${testCases.length}`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);

  if (failed === 0) {
    console.log(`\n🎉 All tests passed!\n`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  Some tests failed!\n`);
    process.exit(1);
  }
}

// 执行测试
runTests();
