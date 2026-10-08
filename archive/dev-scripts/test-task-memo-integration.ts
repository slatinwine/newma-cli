/**
 * TaskTracker + Memo Integration Test
 *
 * 测试 TaskTracker 与 Memo 的集成功能：
 * 1. 存储统一到 .memo/tasks/ 目录
 * 2. MemoPlugin 可以搜索任务
 * 3. AI 上下文包含历史任务
 */

import { MemoCliPlugin } from './src/loop/plugins/memo-cli-plugin';
import { createTaskTracker } from './src/task-tracker';
import chalk from 'chalk';

const PROJECT_ROOT = process.cwd();
const MEMO_PATH = '/Users/mac/freedomking/memo';

/**
 * 测试 1: 验证存储路径
 */
async function testStoragePath() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Test 1: Verify TaskTracker Storage Path');
  console.log('='.repeat(60));

  const { tracker, storage } = await createTaskTracker(PROJECT_ROOT);

  // 创建测试任务
  const task = tracker.startTask(
    '测试任务：集成 Memo',
    'plan',
    'test-session-1',
    PROJECT_ROOT
  );

  await tracker.updateTask({
    status: 'completed',
    reasoning: {
      plan: ['测试计划'],
      thoughts: '测试分析',
    },
  });

  console.log(`✅ Task created with ID: ${task.id}`);
  console.log(`✅ Task stored in: .memo/tasks/${task.id}.json`);

  // 验证文件存在
  const fs = await import('fs/promises');
  const path = await import('path');
  const taskPath = path.join(PROJECT_ROOT, '.memo', 'tasks', `${task.id}.json`);

  try {
    await fs.access(taskPath);
    console.log(`✅ Task file exists at: ${taskPath}`);
    return true;
  } catch {
    console.log(`❌ Task file NOT found at: ${taskPath}`);
    return false;
  }
}

/**
 * 测试 2: 验证 MemoPlugin.searchTasks()
 */
async function testMemoPluginSearchTasks() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Test 2: MemoPlugin.searchTasks()');
  console.log('='.repeat(60));

  const memoPlugin = new MemoCliPlugin(PROJECT_ROOT, MEMO_PATH);
  const { tracker } = await createTaskTracker(PROJECT_ROOT);

  // 创建几个测试任务
  const task1 = tracker.startTask('实现用户认证', 'plan', 'session-1', PROJECT_ROOT);
  await tracker.updateTask({ status: 'completed' });

  const task2 = tracker.startTask('添加数据库连接', 'execute', 'session-2', PROJECT_ROOT);
  await tracker.updateTask({ status: 'failed' });

  const task3 = tracker.startTask('优化 API 性能', 'plan', 'session-3', PROJECT_ROOT);
  await tracker.updateTask({ status: 'running' });

  console.log('✅ Created 3 test tasks');

  // 测试搜索
  const results1 = await memoPlugin.searchTasks('认证');
  console.log(`\n🔍 Search "认证": Found ${results1.length} result(s)`);
  results1.forEach((t) => {
    console.log(`  - ${t.requirement} (${t.status})`);
  });

  const results2 = await memoPlugin.searchTasks('API');
  console.log(`\n🔍 Search "API": Found ${results2.length} result(s)`);
  results2.forEach((t) => {
    console.log(`  - ${t.requirement} (${t.status})`);
  });

  // 验证：至少找到 1 个结果
  const passed = results1.length > 0 || results2.length > 0;

  if (passed) {
    console.log('\n✅ Task search works correctly');
  } else {
    console.log('\n❌ Task search failed - no results found');
  }

  return passed;
}

/**
 * 测试 3: 验证 MemoPlugin 任务搜索与上下文匹配
 */
async function testMemoContextWithTasks() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Test 3: Task Search with Context Matching');
  console.log('='.repeat(60));

  const memoPlugin = new MemoCliPlugin(PROJECT_ROOT, MEMO_PATH);
  const { tracker } = await createTaskTracker(PROJECT_ROOT);

  // 创建测试任务
  const task1 = tracker.startTask('重构认证系统', 'plan', 'session-1', PROJECT_ROOT);
  await tracker.updateTask({ status: 'completed' });

  const task2 = tracker.startTask('添加用户注册功能', 'execute', 'session-2', PROJECT_ROOT);
  await tracker.updateTask({ status: 'completed' });

  console.log('✅ Created 2 test tasks');

  // 测试搜索与上下文匹配
  const results = await memoPlugin.searchTasks('认证');
  console.log(`\n🔍 Search "认证": Found ${results.length} result(s)`);

  results.forEach((t) => {
    console.log(`  - [${new Date(t.createdAt).toLocaleDateString()}] ${t.status.toUpperCase()} | ${t.mode}`);
    console.log(`    ${t.requirement.substring(0, 60)}...`);
  });

  // 验证：找到至少一个相关任务
  const passed = results.length > 0;

  if (passed) {
    console.log('\n✅ Task context matching works correctly');
    return true;
  } else {
    console.log('\n❌ Task context matching failed');
    return false;
  }
}

/**
 * 测试 4: 验证压缩任务读取
 */
async function testCompressedTaskReading() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Test 4: Reading Compressed Tasks');
  console.log('='.repeat(60));

  const memoPlugin = new MemoCliPlugin(PROJECT_ROOT, MEMO_PATH);
  const { tracker, storage } = await createTaskTracker(PROJECT_ROOT);

  // 创建一个任务
  const task = tracker.startTask('压缩测试任务', 'plan', 'session-compressed', PROJECT_ROOT);
  await tracker.updateTask({ status: 'completed' });

  console.log('✅ Created test task');

  // 强制压缩任务
  await storage.compressOldTasks();

  console.log('✅ Compressed task');

  // 搜索压缩的任务
  const results = await memoPlugin.searchTasks('压缩测试');
  console.log(`\n🔍 Search found ${results.length} compressed task(s)`);

  if (results.length > 0) {
    console.log('✅ Successfully read compressed tasks');
    return true;
  } else {
    console.log('❌ Failed to read compressed tasks');
    return false;
  }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log(chalk.cyan.bold('\n🚀 TaskTracker + Memo Integration Tests\n'));

  const results = {
    storagePath: false,
    searchTasks: false,
    contextWithTasks: false,
    compressedTasks: false,
  };

  try {
    results.storagePath = await testStoragePath();
    results.searchTasks = await testMemoPluginSearchTasks();
    results.contextWithTasks = await testMemoContextWithTasks();
    results.compressedTasks = await testCompressedTaskReading();
  } catch (error) {
    console.error('\n❌ Test error:', error);
  }

  // 打印总结
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`  Storage Path:      ${results.storagePath ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Task Search:       ${results.searchTasks ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Context with Tasks: ${results.contextWithTasks ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Compressed Tasks:  ${results.compressedTasks ? '✅ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(60));

  const allPassed = Object.values(results).every((v) => v);

  if (allPassed) {
    console.log(chalk.green('\n🎉 All tests passed!\n'));
    process.exit(0);
  } else {
    console.log(chalk.red('\n⚠️  Some tests failed\n'));
    process.exit(1);
  }
}

// 运行测试
runAllTests();
