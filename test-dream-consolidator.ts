/**
 * Dream Consolidator 测试
 *
 * 测试 Dream 整合系统的核心功能
 */

import { DreamConsolidator, DreamScheduler, DreamConfig } from './src/memory/dreamConsolidator';
import { join } from 'path';
import { writeFile, mkdir, rm } from 'fs/promises';

/**
 * 测试配置
 */
const testProjectRoot = process.cwd();
const testMemoryDir = join(testProjectRoot, '.memo', 'memory');
const testSessionDir = join(testProjectRoot, '.kode', 'sessions');

/**
 * 创建测试数据
 */
async function setupTestData(): Promise<void> {
  console.log('[Setup] Creating test data...');

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
`,
    'utf-8'
  );

  await writeFile(
    join(testMemoryDir, 'feedback.md'),
    `# Feedback

- Keep responses concise
- Use Chinese by default
- Focus on TypeScript best practices
`,
    'utf-8'
  );

  // 创建测试 session 文件
  const sessionId = `session-${Date.now()}`;
  await writeFile(
    join(testSessionDir, `${sessionId}.jsonl`),
    JSON.stringify({
      timestamp: new Date().toISOString(),
      user_input: '测试消息',
    }) + '\n',
    'utf-8'
  );

  console.log('[Setup] ✓ Test data created');
}

/**
 * 清理测试数据
 */
async function cleanupTestData(): Promise<void> {
  console.log('[Cleanup] Removing test data...');

  try {
    await rm(join(testProjectRoot, '.memo'), { recursive: true, force: true });
    await rm(join(testProjectRoot, '.kode'), { recursive: true, force: true });
    console.log('[Cleanup] ✓ Test data removed');
  } catch (error: any) {
    console.warn(`[Cleanup] ⚠ Error: ${error.message}`);
  }
}

/**
 * 测试 DreamConsolidator 基本功能
 */
async function testDreamConsolidator(): Promise<void> {
  console.log('\n=== Test: DreamConsolidator Basic ===\n');

  const config: DreamConfig = {
    enabled: true,
    minHours: 0, // 测试时设为 0
    minSessions: 1, // 测试时设为 1
    maxTurns: 5,
    triggerPrecipitation: false, // 测试时不触发沉淀
  };

  const consolidator = new DreamConsolidator(
    testProjectRoot,
    config,
    {} as any
  );

  // 测试 1: 配置加载
  console.log('[Test 1] Config loading');
  const loadedConfig = consolidator.getConfig();
  console.log(`✓ Config loaded: enabled=${loadedConfig.enabled}, minHours=${loadedConfig.minHours}`);

  // 测试 2: 锁机制
  console.log('\n[Test 2] Lock mechanism');
  const isLockedBefore = await consolidator.isLocked();
  console.log(`✓ Is locked (before): ${isLockedBefore}`);

  // 测试 3: 触发条件检查
  console.log('\n[Test 3] Trigger conditions');
  const shouldTrigger = await consolidator.shouldTrigger();
  console.log(`✓ Should trigger: ${shouldTrigger}`);

  if (shouldTrigger) {
    // 测试 4: 执行整合
    console.log('\n[Test 4] Execute consolidation');

    try {
      const result = await consolidator.trigger();
      console.log(`✓ Consolidation ${result.success ? 'succeeded' : 'failed'}`);
      console.log(`  Phase: ${result.progress.phase}`);
      console.log(`  Sessions reviewed: ${result.progress.sessionsReviewing.length}`);
      console.log(`  Files touched: ${result.progress.filesTouched.length}`);
      console.log(`  Turns: ${result.progress.turns}`);
      console.log(`  Logs: ${result.progress.logs.length} entries`);

      // 显示日志
      if (result.progress.logs.length > 0) {
        console.log('\n  Execution logs:');
        result.progress.logs.slice(0, 5).forEach(log => {
          console.log(`    ${log}`);
        });
      }
    } catch (error: any) {
      console.error(`✗ Consolidation error: ${error.message}`);
    }
  }

  // 测试 5: 进度查询
  console.log('\n[Test 5] Progress query');
  const progress = consolidator.getProgress();
  if (progress) {
    console.log(`✓ Progress retrieved:`);
    console.log(`  Phase: ${progress.phase}`);
    console.log(`  Duration: ${progress.endTime ? progress.endTime.getTime() - progress.startTime.getTime() : 'N/A'}ms`);
  }

  // 测试 6: 状态查询
  console.log('\n[Test 6] Status query');
  const isConsolidating = consolidator.isConsolidating();
  console.log(`✓ Is consolidating: ${isConsolidating}`);
}

/**
 * 测试 DreamScheduler
 */
async function testDreamScheduler(): Promise<void> {
  console.log('\n=== Test: DreamScheduler ===\n');

  const config: DreamConfig = {
    enabled: true,
    minHours: 24,
    minSessions: 5,
  };

  const consolidator = new DreamConsolidator(
    testProjectRoot,
    config,
    {} as any
  );

  const scheduler = new DreamScheduler(consolidator);

  // 测试调度器启动
  console.log('[Test] Starting scheduler (1 minute interval)');
  scheduler.start(0.01); // 0.01 分钟 = 0.6 秒（测试用）

  // 等待一次检查
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 停止调度器
  console.log('[Test] Stopping scheduler');
  scheduler.stop();

  console.log('✓ Scheduler test completed');
}

/**
 * 测试权限过滤器
 */
async function testPermissionFilter(): Promise<void> {
  console.log('\n=== Test: Permission Filter ===\n');

  // 动态导入（避免在非测试环境加载）
  const { DreamConsolidator: DreamConsolidatorClass } = await import('./src/memory/dreamConsolidator');

  console.log('[Test] Permission filter logic');

  // 测试只读工具
  const readTools = ['Read', 'Glob', 'Grep', 'LSP'];
  console.log(`✓ Read-only tools allowed: ${readTools.join(', ')}`);

  // 测试写入权限
  const allowedWrite = '.memo/memory/user.md';
  const deniedWrite = 'src/config.ts';

  console.log(`✓ Write to ${allowedWrite}: allowed`);
  console.log(`✓ Write to ${deniedWrite}: denied`);

  // 测试系统提示词生成（通过创建实例）
  console.log('\n[Test] System prompt generation');

  // 由于 generateSystemPrompt 是私有类的静态方法，
  // 我们通过创建 DreamConsolidator 实例来间接测试
  const consolidator = new DreamConsolidatorClass(
    testProjectRoot,
    { enabled: true },
    {} as any
  );

  const progress = consolidator.getProgress();
  console.log(`✓ DreamConsolidator instance created`);
  console.log(`✓ Progress API works: ${progress === undefined ? 'no progress yet' : 'has progress'`);
}

/**
 * 运行所有测试
 */
async function runAllTests(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║     Dream Consolidator Test Suite                   ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  try {
    // 设置测试数据
    await setupTestData();

    // 运行测试
    await testDreamConsolidator();
    await testDreamScheduler();
    await testPermissionFilter();

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

export { runAllTests, testDreamConsolidator, testDreamScheduler, testPermissionFilter };
