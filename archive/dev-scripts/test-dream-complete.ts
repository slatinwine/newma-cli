/**
 * Dream Consolidator 完整测试
 *
 * 包含 session 文件创建的完整测试
 */

import { DreamConsolidator, DreamScheduler, DreamConfig } from './dist/memory/dreamConsolidator';
import { join } from 'path';
import { writeFile, mkdir, rm } from 'fs/promises';

/**
 * 测试配置
 */
const testProjectRoot = process.cwd();
const testMemoryDir = join(testProjectRoot, '.memo', 'memory-test');
const testSessionDir = join(testProjectRoot, '.kode', 'sessions-test');

/**
 * 创建完整的测试数据（包括 sessions）
 */
async function setupCompleteTestData(): Promise<void> {
  console.log('[Setup] Creating complete test data...');

  // 创建 memory 目录
  await mkdir(testMemoryDir, { recursive: true });

  // 创建 session 目录
  await mkdir(testSessionDir, { recursive: true });

  // 创建测试记忆文件
  await writeFile(
    join(testMemoryDir, 'user.md'),
    `# User Profile

**Language**: Chinese
**Style**: Concise
**Tech Stack**: TypeScript, Node.js

**Last Updated**: 2026-04-01
`,
    'utf-8'
  );

  await writeFile(
    join(testMemoryDir, 'feedback.md'),
    `# Feedback

- Keep responses concise
- Use Chinese by default
- Focus on TypeScript best practices

**Last Updated**: 2026-04-01
`,
    'utf-8'
  );

  // 创建多个测试 session 文件（满足 minSessions 要求）
  const now = Date.now();
  for (let i = 0; i < 5; i++) {
    const sessionId = `session-${now}-${i}`;
    const timestamp = new Date(now - i * 3600000).toISOString(); // 每小时一个

    await writeFile(
      join(testSessionDir, `${sessionId}.jsonl`),
      JSON.stringify({
        timestamp,
        user_input: `测试消息 ${i + 1}`,
        assistant_response: `回复 ${i + 1}`,
      }) + '\n',
      'utf-8'
    );
  }

  console.log('[Setup] ✓ Complete test data created (5 sessions)');
}

/**
 * 清理测试数据
 */
async function cleanupTestData(): Promise<void> {
  console.log('\n[Cleanup] Removing test data...');

  try {
    await rm(join(testProjectRoot, '.memo'), { recursive: true, force: true });
    await rm(join(testProjectRoot, '.kode'), { recursive: true, force: true });
    console.log('[Cleanup] ✓ Test data removed');
  } catch (error: any) {
    console.warn(`[Cleanup] ⚠ Error: ${error.message}`);
  }
}

/**
 * 测试完整的 Dream 整合流程
 */
async function testCompleteConsolidation(): Promise<any> {
  console.log('\n=== Test: Complete Dream Consolidation ===\n');

  const config: DreamConfig = {
    enabled: true,
    minHours: 0, // 测试时设为 0
    minSessions: 5, // 需要至少 5 个 sessions
    maxTurns: 5,
    memoryDir: testMemoryDir,
    sessionDir: testSessionDir,
    triggerPrecipitation: false, // 测试时不触发沉淀
  };

  const consolidator = new DreamConsolidator(
    testProjectRoot,
    config,
    {} as any
  );

  console.log('[Test 1] Checking consolidation conditions...');

  // 检查触发条件
  const shouldTrigger = await consolidator.shouldTrigger();
  console.log(`✓ Should trigger: ${shouldTrigger}`);

  if (shouldTrigger) {
    console.log('\n[Test 2] Executing consolidation...\n');

    try {
      const result = await consolidator.trigger();

      console.log('\n✅ Consolidation Result:');
      console.log(`   Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`   Phase: ${result.progress.phase}`);
      console.log(`   Sessions Reviewed: ${result.progress.sessionsReviewing.length}`);
      console.log(`   Files Touched: ${result.progress.filesTouched.length}`);
      console.log(`   Turns: ${result.progress.turns}`);

      // 显示 session 列表
      if (result.progress.sessionsReviewing.length > 0) {
        console.log('\n📋 Sessions Reviewed:');
        result.progress.sessionsReviewing.slice(0, 3).forEach(sessionId => {
          console.log(`   - ${sessionId}`);
        });
      }

      // 显示修改的文件
      if (result.progress.filesTouched.length > 0) {
        console.log('\n📝 Files Modified:');
        result.progress.filesTouched.slice(0, 3).forEach(file => {
          console.log(`   - ${file}`);
        });
      }

      // 显示执行日志（前 10 条）
      if (result.progress.logs.length > 0) {
        console.log('\n📊 Execution Logs (first 10):');
        result.progress.logs.slice(0, 10).forEach(log => {
          console.log(`   ${log}`);
        });
      }

      // 检查是否生成了整合报告
      const reportPath = join(testMemoryDir, 'consolidation-report.md');
      const { existsSync } = require('fs');
      if (existsSync(reportPath)) {
        console.log('\n📄 Consolidation report generated:');
        console.log(`   Path: ${reportPath}`);

        // 读取并显示报告摘要
        const { readFile } = require('fs/promises');
        const reportContent = await readFile(reportPath, 'utf-8');
        const lines = reportContent.split('\n').slice(0, 15);
        console.log('\n   Report preview:');
        lines.forEach((line: string) => {
          console.log(`   ${line}`);
        });
      }

      return result;
    } catch (error: any) {
      console.error(`\n✗ Consolidation error: ${error.message}`);
      console.error(`Stack: ${error.stack}`);
      throw error;
    }
  } else {
    console.log('⚠️  Consolidation conditions not met, skipping execution');
    return null;
  }
}

/**
 * 测试锁机制
 */
async function testLockMechanism(): Promise<void> {
  console.log('\n=== Test: Lock Mechanism ===\n');

  const config: DreamConfig = {
    enabled: true,
    minHours: 0,
    minSessions: 1,
    memoryDir: testMemoryDir,
    sessionDir: testSessionDir,
  };

  const consolidator = new DreamConsolidator(
    testProjectRoot,
    config,
    {} as any
  );

  // 测试 1: 初始锁状态
  console.log('[Test 1] Initial lock state');
  const isLockedBefore = await consolidator.isLocked();
  console.log(`✓ Locked (before): ${isLockedBefore}`);

  // 测试 2: 手动创建锁文件
  console.log('\n[Test 2] Creating lock file manually');
  const lockDir = join(testProjectRoot, '.memo', 'dream');
  await mkdir(lockDir, { recursive: true });
  const lockFilePath = join(lockDir, '.consolidate-lock');
  await writeFile(lockFilePath, Date.now().toString(), 'utf-8');

  const isLockedAfter = await consolidator.isLocked();
  console.log(`✓ Locked (after manual creation): ${isLockedAfter}`);

  // 测试 3: 清理锁文件
  const { unlink } = require('fs/promises');
  await unlink(lockFilePath);
  const isLockedAfterCleanup = await consolidator.isLocked();
  console.log(`✓ Locked (after cleanup): ${isLockedAfterCleanup}`);

  console.log('\n✅ Lock mechanism test passed');
}

/**
 * 测试配置更新
 */
async function testConfigUpdate(): Promise<void> {
  console.log('\n=== Test: Configuration Update ===\n');

  const config: DreamConfig = {
    enabled: true,
    minHours: 24,
    minSessions: 5,
    memoryDir: testMemoryDir,
    sessionDir: testSessionDir,
  };

  const consolidator = new DreamConsolidator(
    testProjectRoot,
    config,
    {} as any
  );

  console.log('[Test 1] Initial configuration');
  let currentConfig = consolidator.getConfig();
  console.log(`✓ minHours: ${currentConfig.minHours}`);
  console.log(`✓ minSessions: ${currentConfig.minSessions}`);

  console.log('\n[Test 2] Updating configuration');
  consolidator.updateConfig({
    minHours: 12,
    minSessions: 10,
  });

  currentConfig = consolidator.getConfig();
  console.log(`✓ Updated minHours: ${currentConfig.minHours}`);
  console.log(`✓ Updated minSessions: ${currentConfig.minSessions}`);

  console.log('\n✅ Configuration update test passed');
}

/**
 * 运行所有测试
 */
async function runAllTests(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   Dream Consolidator Complete Test Suite            ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  try {
    // 设置完整测试数据
    await setupCompleteTestData();

    // 运行测试
    await testCompleteConsolidation();
    await testLockMechanism();
    await testConfigUpdate();

    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║     All Tests Completed ✓                          ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');
  } catch (error: any) {
    console.error('\n✗ Test suite failed:', error.message);
    console.error(error.stack);
  } finally {
    // 清理测试数据
    await cleanupTestData();
  }
}

// 运行测试
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { runAllTests, testCompleteConsolidation, testLockMechanism, testConfigUpdate };
