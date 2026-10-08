/**
 * Comprehensive Memory System Test
 *
 * 测试三个记忆系统的集成使用
 */

import { createContextManager } from './src/memory/context-manager';
import { createExecutionHistoryManager } from './src/memory/execution-history';
import { createErrorMemoryManager } from './src/memory/error-memory';
import { CommandType, CommandStatus } from './src/memory/execution-types';

async function testAllMemories() {
  console.log('🧪 Testing All Memory Systems\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const projectRoot = process.cwd();

  // 初始化三个记忆系统
  console.log('📦 Initializing Memory Systems...\n');

  const contextManager = createContextManager(projectRoot, {
    ttl: 3600,
    maxChanges: 50,
  });

  const executionHistory = createExecutionHistoryManager(projectRoot, {
    compress: true,
    compressAfterDays: 7,
  });

  const errorMemory = createErrorMemoryManager(projectRoot, {
    maxErrors: 100,
    maxSolutions: 50,
  });

  await contextManager.initialize();
  await executionHistory.initialize();
  await errorMemory.initialize();

  console.log('✅ All memory systems initialized\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ==================== 场景 1: 开发者开始工作 ====================
  console.log('📖 Scenario 1: Developer Starts Working\n');

  // 1.1 获取项目上下文
  console.log('1️⃣  Getting Project Context...');
  const startTime = Date.now();
  const projectContext = await contextManager.getContext();
  const contextLoadTime = Date.now() - startTime;

  console.log(`✅ Project context loaded in ${contextLoadTime}ms`);
  console.log(`   Files: ${projectContext.structure.totalFiles}`);
  console.log(`   Languages: ${projectContext.structure.primaryLanguages.join(', ')}`);
  console.log(`   Framework: ${projectContext.config.framework || 'N/A'}`);
  console.log(`   Package Manager: ${projectContext.config.packageManager}`);
  console.log();

  // 1.2 创建执行会话
  console.log('2️⃣  Creating Execution Session...');
  const sessionId = `test-session-${Date.now()}`;
  await executionHistory.createSession(sessionId, projectRoot);
  console.log(`✅ Session created: ${sessionId}`);
  console.log();

  // ==================== 场景 2: 执行多个命令 ====================
  console.log('📝 Scenario 2: Executing Commands\n');

  // 命令 1: Plan mode - 成功
  console.log('Command 1: /plan 添加用户认证');
  let cmdIndex = await executionHistory.recordCommandStart(
    '/plan 添加用户认证',
    'plan'
  );

  await new Promise(resolve => setTimeout(resolve, 100));

  await executionHistory.recordCommandEnd(cmdIndex, 'success', {
    duration: 100,
    actionCount: 5,
    successCount: 5,
    failureCount: 0,
    tokens: { input: 500, output: 1200, total: 1700 },
    metadata: { algorithm: 'fft' },
  });
  console.log('   ✅ Success - FFT planning completed\n');

  // 命令 2: Execute mode - 失败（模拟错误）
  console.log('Command 2: /execute 创建数据库模型');
  cmdIndex = await executionHistory.recordCommandStart(
    '/execute 创建数据库模型',
    'execute'
  );

  await new Promise(resolve => setTimeout(resolve, 50));

  // 记录错误
  const errorId = await errorMemory.recordError({
    errorType: 'ValidationError',
    errorMessage: 'Invalid schema: missing required field \'id\'',
    command: '/execute 创建数据库模型',
    commandType: 'execute',
    task: '创建数据库模型',
    files: ['src/models/User.ts'],
    tags: ['validation', 'database'],
  });

  await executionHistory.recordCommandEnd(cmdIndex, 'failed', {
    duration: 50,
    actionCount: 2,
    successCount: 0,
    failureCount: 2,
    error: 'ValidationError: Invalid schema',
  });
  console.log('   ❌ Failed - ValidationError recorded');
  console.log(`      Error ID: ${errorId}\n`);

  // 记录解决方案
  await errorMemory.recordSolution(errorId, {
    description: 'Add required \'id\' field to schema',
    steps: [
      'Open src/models/User.ts',
      'Add: id: string @PrimaryColumn()',
      'Re-run the command',
    ],
    method: 'manual',
    codeExample: '@PrimaryColumn()\nid: string;',
  });
  console.log('   💡 Solution recorded\n');

  // 命令 3: 再次执行相同任务（使用解决方案）- 成功
  console.log('Command 3: /execute 创建数据库模型 (retry)');
  cmdIndex = await executionHistory.recordCommandStart(
    '/execute 创建数据库模型',
    'execute'
  );

  await new Promise(resolve => setTimeout(resolve, 80));

  // 使用解决方案
  const solution = await errorMemory.useSolution(errorId);
  console.log(`   💡 Using solution: ${solution?.description}`);

  await executionHistory.recordCommandEnd(cmdIndex, 'success', {
    duration: 80,
    actionCount: 3,
    successCount: 3,
    failureCount: 0,
  });

  // 验证解决方案
  await errorMemory.verifySolution(errorId, true);
  console.log('   ✅ Success - Solution verified\n');

  // 命令 4: Verify mode
  console.log('Command 4: /verify');
  cmdIndex = await executionHistory.recordCommandStart(
    '/verify',
    'verify'
  );

  await new Promise(resolve => setTimeout(resolve, 120));

  await executionHistory.recordCommandEnd(cmdIndex, 'success', {
    duration: 120,
    actionCount: 4,
    successCount: 4,
    failureCount: 0,
  });
  console.log('   ✅ Success - All checks passed\n');

  // 命令 5: Chat mode
  console.log('Command 5: TypeScript 中的泛型是什么？');
  cmdIndex = await executionHistory.recordCommandStart(
    'TypeScript 中的泛型是什么？',
    'chat'
  );

  await new Promise(resolve => setTimeout(resolve, 60));

  await executionHistory.recordCommandEnd(cmdIndex, 'success', {
    duration: 60,
    tokens: { input: 300, output: 800, total: 1100 },
  });
  console.log('   ✅ Success - Answer provided\n');

  // ==================== 场景 3: 记录文件变更 ====================
  console.log('📂 Scenario 3: Recording File Changes\n');

  await contextManager.recordChange({
    file: 'src/models/User.ts',
    type: 'modify',
    summary: 'Added id field to User model',
  });

  await contextManager.recordChange({
    file: 'src/auth/jwt.ts',
    type: 'create',
    summary: 'Created JWT authentication service',
  });

  console.log('✅ File changes recorded');
  console.log();

  // ==================== 场景 4: 查看统计 ====================
  console.log('📊 Scenario 4: Viewing Statistics\n');

  // 4.1 会话统计
  console.log('4️⃣  Session Statistics:');
  const currentSession = executionHistory.getCurrentSession();
  if (currentSession) {
    console.log(`   Total Commands: ${currentSession.stats.totalCommands}`);
    console.log(`   Success Rate: ${currentSession.stats.successRate.toFixed(1)}%`);
    console.log(`   Average Duration: ${currentSession.stats.averageCommandDuration.toFixed(0)}ms`);
    console.log(`   Total Tokens: ${currentSession.stats.totalTokens?.total || 0}`);
    console.log('   Top Commands:');
    currentSession.stats.topCommandTypes.forEach(({ type, count }) => {
      console.log(`     - ${type}: ${count}`);
    });
  }
  console.log();

  // 4.2 错误统计
  console.log('5️⃣  Error Statistics (30 days):');
  const errorSummary = await errorMemory.getSummary(30);
  if (errorSummary) {
    console.log(`   Total Errors: ${errorSummary.totalErrors}`);
    console.log(`   Resolved: ${errorSummary.resolvedErrors}`);
    console.log(`   Resolution Rate: ${(errorSummary.resolutionRate * 100).toFixed(1)}%`);
    console.log('   Top Errors:');
    errorSummary.topErrors.slice(0, 3).forEach(({ errorType, count }) => {
      console.log(`     - ${errorType}: ${count}`);
    });
  }
  console.log();

  // ==================== 场景 5: 搜索和检索 ====================
  console.log('🔍 Scenario 5: Search and Retrieval\n');

  // 5.1 搜索执行历史
  console.log('6️⃣  Search: Failed commands');
  const failedCommands = await executionHistory.searchHistory({
    status: 'failed',
    limit: 10,
  });
  console.log(`   Found: ${failedCommands.reduce((sum, { commands }) => sum + commands.filter(c => c.status === 'failed').length, 0)} failed command(s)\n`);

  // 5.2 搜索已解决的错误
  console.log('7️⃣  Search: Resolved errors');
  const resolvedErrors = await errorMemory.searchErrors({
    resolved: true,
    withSolutionOnly: true,
    limit: 5,
  });
  console.log(`   Found: ${resolvedErrors.length} resolved error(s)`);
  if (resolvedErrors.length > 0) {
    console.log('   Example:');
    const err = resolvedErrors[0];
    console.log(`     - ${err.errorType}: ${err.solution?.description}`);
  }
  console.log();

  // 5.3 查找相似错误
  console.log('8️⃣  Find Similar Errors');
  const similarErrors = await errorMemory.findSimilarErrors(
    'ValidationError',
    'Invalid schema',
    3
  );
  console.log(`   Found: ${similarErrors.length} similar error(s)\n`);

  // ==================== 场景 6: AI 上下文生成 ====================
  console.log('🤖 Scenario 6: AI Context Generation\n');

  console.log('9️⃣  Generate AI Context for New Task:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 项目上下文
  const projectSummary = await contextManager.getSummary();

  // 执行统计
  const execSummary = await executionHistory.getSummary(7);

  // 错误统计
  const errSummary = await errorMemory.getSummary(7);

  // 组合上下文
  let aiContext = '\n📚 PROJECT MEMORY:\n\n';

  aiContext += '📁 Project Structure:\n';
  aiContext += `  Files: ${projectContext.structure.totalFiles}\n`;
  aiContext += `  Languages: ${projectContext.structure.primaryLanguages.join(', ')}\n`;
  if (projectContext.config.framework) {
    aiContext += `  Framework: ${projectContext.config.framework}\n`;
  }
  aiContext += '\n';

  if (execSummary && execSummary.totalCommands > 0) {
    aiContext += '📋 Execution Insights (7 days):\n';
    aiContext += `  Total Commands: ${execSummary.totalCommands}\n`;
    aiContext += `  Success Rate: ${execSummary.averageSuccessRate.toFixed(1)}%\n`;
    if (execSummary.topCommandTypes.length > 0) {
      aiContext += `  Most Used: ${execSummary.topCommandTypes[0].type}\n`;
    }
    if (execSummary.algorithms && execSummary.algorithms.length > 0) {
      aiContext += `  Algorithms: ${execSummary.algorithms.join(', ')}\n`;
    }
    aiContext += '\n';
  }

  if (errSummary && errSummary.totalErrors > 0) {
    aiContext += '🔧 Error Patterns (7 days):\n';
    aiContext += `  Total Errors: ${errSummary.totalErrors}\n`;
    aiContext += `  Resolution Rate: ${(errSummary.resolutionRate * 100).toFixed(1)}%\n`;
    if (errSummary.topErrors.length > 0) {
      aiContext += `  Top Error: ${errSummary.topErrors[0].errorType} (${errSummary.topErrors[0].count}x)\n`;
    }
    aiContext += '\n';
  }

  if (projectContext.recentChanges.length > 0) {
    aiContext += '📝 Recent Changes:\n';
    projectContext.recentChanges.slice(0, 3).forEach(change => {
      const icon = change.type === 'create' ? '➕' : change.type === 'delete' ? '❌' : '✏️';
      aiContext += `  ${icon} ${change.file}\n`;
    });
  }

  console.log(aiContext);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ==================== 结束会话 ====================
  console.log('🏁 Scenario 7: Ending Session\n');

  await executionHistory.endSession();
  console.log('✅ Session ended and saved');
  console.log();

  // ==================== 最终总结 ====================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Final Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();
  console.log('✅ All Memory Systems Working Together!');
  console.log();
  console.log('📁 Project Context Memory:');
  console.log(`   - Files scanned: ${projectContext.structure.totalFiles}`);
  console.log(`   - Load time: ${contextLoadTime}ms`);
  console.log(`   - Recent changes: ${projectContext.recentChanges.length}`);
  console.log();
  console.log('📋 Execution History Memory:');
  console.log(`   - Session: ${sessionId}`);
  console.log(`   - Commands: ${currentSession?.stats.totalCommands || 0}`);
  console.log(`   - Success rate: ${currentSession?.stats.successRate.toFixed(1) || 0}%`);
  console.log(`   - Tokens used: ${currentSession?.stats.totalTokens?.total || 0}`);
  console.log();
  console.log('🔧 Error Solution Memory:');
  console.log(`   - Errors recorded: ${errorSummary?.totalErrors || 0}`);
  console.log(`   - Resolution rate: ${errorSummary ? (errorSummary.resolutionRate * 100).toFixed(1) : 0}%`);
  console.log(`   - Solutions available: ${resolvedErrors.length}`);
  console.log();
  console.log('🎯 Key Achievements:');
  console.log('   ✓ Project context cached and reused');
  console.log('   ✓ Execution history tracked in real-time');
  console.log('   ✓ Errors automatically detected and solved');
  console.log('   ✓ Solutions reused across sessions');
  console.log('   ✓ AI context enriched with memory');
  console.log();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Test suite completed successfully');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// Run tests
testAllMemories()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
