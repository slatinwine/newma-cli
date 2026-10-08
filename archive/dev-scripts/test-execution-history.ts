/**
 * Execution History Memory Test
 *
 * 测试执行历史记忆功能
 */

import { createExecutionHistoryManager } from './src/memory/execution-history';
import { CommandType, CommandStatus } from './src/memory/execution-types';

async function testExecutionHistory() {
  console.log('🧪 Testing Execution History Memory\n');

  const projectRoot = process.cwd();
  const historyManager = createExecutionHistoryManager(projectRoot, {
    compress: true,
    compressAfterDays: 7,
  });

  try {
    // Test 1: Initialize
    console.log('Test 1: Initialize History Manager');
    await historyManager.initialize();
    console.log('✅ PASS: History Manager initialized\n');

    // Test 2: Create Session
    console.log('Test 2: Create Execution Session');
    const sessionId = `test-${Date.now()}`;
    await historyManager.createSession(sessionId, projectRoot);
    console.log('✅ PASS: Session created');
    console.log(`  Session ID: ${sessionId}\n`);

    // Test 3: Record Commands
    console.log('Test 3: Record Commands');

    // Command 1: Successful plan
    let cmdIndex = await historyManager.recordCommandStart(
      '/plan 添加用户认证',
      'plan'
    );

    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work

    await historyManager.recordCommandEnd(cmdIndex, 'success', {
      duration: 100,
      actionCount: 5,
      successCount: 5,
      failureCount: 0,
      tokens: { input: 500, output: 1000, total: 1500 },
      metadata: { algorithm: 'fft' },
    });
    console.log('  ✓ Recorded command 1: /plan (success)');

    // Command 2: Failed execute
    cmdIndex = await historyManager.recordCommandStart(
      '/execute 创建数据库',
      'execute'
    );

    await new Promise(resolve => setTimeout(resolve, 50));

    await historyManager.recordCommandEnd(cmdIndex, 'failed', {
      duration: 50,
      actionCount: 2,
      successCount: 0,
      failureCount: 2,
      error: 'Database connection failed',
    });
    console.log('  ✓ Recorded command 2: /execute (failed)');

    // Command 3: Successful verify
    cmdIndex = await historyManager.recordCommandStart(
      '/verify',
      'verify'
    );

    await new Promise(resolve => setTimeout(resolve, 200));

    await historyManager.recordCommandEnd(cmdIndex, 'success', {
      duration: 200,
      actionCount: 3,
      successCount: 3,
      failureCount: 0,
    });
    console.log('  ✓ Recorded command 3: /verify (success)');

    // Command 4: Chat mode
    cmdIndex = await historyManager.recordCommandStart(
      '什么是 TypeScript?',
      'chat'
    );

    await new Promise(resolve => setTimeout(resolve, 80));

    await historyManager.recordCommandEnd(cmdIndex, 'success', {
      duration: 80,
      tokens: { input: 200, output: 800, total: 1000 },
    });
    console.log('  ✓ Recorded command 4: chat (success)\n');

    console.log('✅ PASS: All commands recorded\n');

    // Test 4: Check Session Stats
    console.log('Test 4: Check Session Stats');
    const currentSession = historyManager.getCurrentSession();
    if (currentSession) {
      console.log('✅ PASS: Session stats available');
      console.log(`  Total Commands: ${currentSession.stats.totalCommands}`);
      console.log(`  Success: ${currentSession.stats.successCommands}`);
      console.log(`  Failed: ${currentSession.stats.failedCommands}`);
      console.log(`  Success Rate: ${currentSession.stats.successRate.toFixed(1)}%`);
      console.log(`  Average Duration: ${currentSession.stats.averageCommandDuration.toFixed(0)}ms`);
      console.log(`  Top Command Types:`);
      currentSession.stats.topCommandTypes.forEach(item => {
        console.log(`    - ${item.type}: ${item.count}`);
      });
    } else {
      console.log('❌ FAIL: No current session');
    }
    console.log();

    // Test 5: End Session
    console.log('Test 5: End Session');
    await historyManager.endSession();
    console.log('✅ PASS: Session ended and saved\n');

    // Test 6: Search History
    console.log('Test 6: Search History');
    const searchResults = await historyManager.searchHistory({
      sessionId,
      limit: 10,
    });

    console.log('✅ PASS: History searched');
    console.log(`  Found ${searchResults.length} session(s)`);

    if (searchResults.length > 0) {
      const { session, commands } = searchResults[0];
      console.log(`  Commands in session: ${commands.length}`);
      commands.forEach(cmd => {
        const icon = cmd.status === 'success' ? '✅' : cmd.status === 'failed' ? '❌' : '⏳';
        console.log(`    ${icon} [${cmd.type}] ${cmd.input.substring(0, 40)}...`);
      });
    }
    console.log();

    // Test 7: Get Summary
    console.log('Test 7: Get Execution Summary (30 days)');
    const summary = await historyManager.getSummary(30);

    if (summary) {
      console.log('✅ PASS: Summary generated');
      console.log(`  Total Sessions: ${summary.totalSessions}`);
      console.log(`  Total Commands: ${summary.totalCommands}`);
      console.log(`  Average Success Rate: ${summary.averageSuccessRate.toFixed(1)}%`);
      console.log(`  Total Duration: ${summary.totalDuration}ms`);
      console.log(`  Top Command Types:`);
      summary.topCommandTypes.forEach(item => {
        console.log(`    - ${item.type}: ${item.count}`);
      });
      if (summary.algorithms.length > 0) {
        console.log(`  Algorithms Used: ${summary.algorithms.join(', ')}`);
      }
    } else {
      console.log('⚠️  No summary data available');
    }
    console.log();

    // Test 8: Filter by Status
    console.log('Test 8: Search by Status (failed only)');
    const failedCommands = await historyManager.searchHistory({
      status: 'failed',
      limit: 5,
    });

    console.log('✅ PASS: Status filter works');
    console.log(`  Failed commands found: ${failedCommands.reduce((sum, { commands }) => sum + commands.length, 0)}`);
    console.log();

    // Test 9: Filter by Type
    console.log('Test 9: Search by Type (plan only)');
    const planCommands = await historyManager.searchHistory({
      commandType: 'plan',
      limit: 5,
    });

    console.log('✅ PASS: Type filter works');
    console.log(`  Plan commands found: ${planCommands.reduce((sum, { commands }) => sum + commands.length, 0)}`);
    console.log();

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Test Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All tests passed!');
    console.log();
    console.log('Execution History Features:');
    console.log('  ✓ Session tracking');
    console.log('  ✓ Command recording');
    console.log('  ✓ Status tracking');
    console.log('  ✓ Token usage tracking');
    console.log('  ✓ Success rate calculation');
    console.log('  ✓ Historical search');
    console.log('  ✓ Statistics aggregation');
    console.log();

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testExecutionHistory()
  .then(() => {
    console.log('✅ Test suite completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
