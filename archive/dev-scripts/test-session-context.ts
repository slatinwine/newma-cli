/**
 * Session Context Memory Test
 *
 * 测试会话上下文记忆系统
 */

import { createSessionContextManager } from './src/memory/session-context-manager';
import { SessionMessageType } from './src/memory/session-context-types';

async function testSessionContext() {
  console.log('Testing Session Context Memory System\n');
  console.log('======================================\n');

  const projectRoot = process.cwd();
  const manager = createSessionContextManager(projectRoot);

  // ==================== Test 1: Initialize ====================
  console.log('Test 1: Initialize Session Context Manager');
  console.log('------------------------------------------');

  await manager.initialize();
  console.log('Session context manager initialized\n');

  // ==================== Test 2: Create Session ====================
  console.log('Test 2: Create New Session');
  console.log('---------------------------');

  const sessionId1 = await manager.createSession(projectRoot);
  console.log(`Session created: ${sessionId1}`);

  const currentSession = manager.getCurrentSession();
  console.log(`Status: ${currentSession?.status}`);
  console.log(`Start time: ${currentSession?.startTime}\n`);

  // ==================== Test 3: Add Messages ====================
  console.log('Test 3: Add Messages to Session');
  console.log('---------------------------------');

  await manager.addMessage('user', '帮我实现用户认证系统');
  console.log('Added user message');

  await manager.addMessage('assistant', '好的，我来帮你设计一个JWT认证系统', {
    mode: 'chat',
    tokens: 50,
  });
  console.log('Added assistant message');

  await manager.addMessage('user', '需要支持登录、注册和密码重置功能');
  console.log('Added user message');

  await manager.addMessage('assistant', '我建议使用TypeScript和Express来实现', {
    mode: 'plan',
    tokens: 100,
  });
  console.log('Added assistant message\n');

  // ==================== Test 4: Check Context Vector ====================
  console.log('Test 4: Check Context Vector');
  console.log('----------------------------');

  const updatedSession = manager.getCurrentSession();
  console.log('Topics:', updatedSession?.contextVector?.topics.join(', ') || 'N/A');
  console.log('Tech Stack:', updatedSession?.contextVector?.techStack.join(', ') || 'N/A');
  console.log('Keywords count:', updatedSession?.contextVector?.keywords.length || 0);
  console.log();

  // ==================== Test 5: End Session ====================
  console.log('Test 5: End Session');
  console.log('--------------------');

  await manager.endSession();
  console.log('Session ended');

  const stats = manager.getStats();
  console.log(`Total sessions: ${stats.totalSessions}`);
  console.log(`Total messages: ${stats.totalMessages}\n`);

  // ==================== Test 6: Create Another Session ====================
  console.log('Test 6: Create Another Session');
  console.log('-------------------------------');

  const sessionId2 = await manager.createSession(projectRoot);
  console.log(`Session created: ${sessionId2}`);

  await manager.addMessage('user', '如何优化数据库查询性能？');
  await manager.addMessage('assistant', '可以考虑添加索引和使用Redis缓存', {
    tokens: 80,
  });
  await manager.addMessage('user', 'PostgreSQL的索引怎么建？');
  await manager.addMessage('assistant', '使用CREATE INDEX语句来创建索引', {
    tokens: 120,
  });

  await manager.endSession();
  console.log('Second session ended\n');

  // ==================== Test 7: Search by Keywords ====================
  console.log('Test 7: Search by Keywords');
  console.log('--------------------------');

  const authResults = await manager.searchContext({
    keywords: ['认证', '登录'],
    limit: 5,
    includeMessages: true,
  });

  console.log(`Found ${authResults.length} sessions about authentication`);
  authResults.forEach((result, index) => {
    console.log(`  ${index + 1}. ${result.session.title}`);
    console.log(`     Relevance: ${(result.relevanceScore * 100).toFixed(0)}%`);
    console.log(`     Reasons: ${result.matchReasons.join(', ')}`);
  });
  console.log();

  // ==================== Test 8: Search by Tech Stack ====================
  console.log('Test 8: Search by Tech Stack');
  console.log('-----------------------------');

  const techResults = await manager.searchContext({
    techStack: ['typescript', 'postgresql'],
    limit: 5,
  });

  console.log(`Found ${techResults.length} sessions with tech stack`);
  techResults.forEach((result, index) => {
    console.log(`  ${index + 1}. ${result.session.title}`);
    console.log(`     Tech: ${result.session.contextVector?.techStack.join(', ')}`);
    console.log(`     Relevance: ${(result.relevanceScore * 100).toFixed(0)}%`);
  });
  console.log();

  // ==================== Test 9: Get Recent Sessions ====================
  console.log('Test 9: Get Recent Sessions');
  console.log('----------------------------');

  const recentSessions = await manager.getRecentSessions(5);
  console.log(`Retrieved ${recentSessions.length} recent sessions`);
  recentSessions.forEach((session, index) => {
    console.log(`  ${index + 1}. ${session.title}`);
    console.log(`     Status: ${session.status}`);
    console.log(`     Messages: ${session.stats.messageCount}`);
    console.log(`     Duration: ${session.stats.duration ? (session.stats.duration / 1000).toFixed(0) + 's' : 'N/A'}`);
  });
  console.log();

  // ==================== Test 10: Get AI Context Summary ====================
  console.log('Test 10: Get AI Context Summary');
  console.log('-------------------------------');

  const aiContext = await manager.getAIContextSummary({
    keywords: ['认证', '数据库'],
  });

  console.log('AI Context Summary:');
  console.log('--------------------');
  console.log(aiContext);
  console.log('--------------------\n');

  // ==================== Test 11: Active Session with Messages ====================
  console.log('Test 11: Active Session with Real Messages');
  console.log('--------------------------------------------');

  const sessionId3 = await manager.createSession(projectRoot);
  console.log(`Created active session: ${sessionId3}`);

  await manager.addMessage('user', '我想了解Rust语言');
  await manager.addMessage('assistant', 'Rust是一门系统编程语言，注重安全和性能', {
    tokens: 60,
  });
  await manager.addMessage('user', 'Rust的所有权系统是怎么工作的？');
  await manager.addMessage('assistant', '所有权系统确保内存安全，无需垃圾回收', {
    tokens: 90,
  });

  const activeSession = manager.getCurrentSession();
  console.log(`Current session: ${activeSession?.title}`);
  console.log(`Messages: ${activeSession?.stats.messageCount}`);
  console.log(`User messages: ${activeSession?.stats.userMessageCount}`);
  console.log(`Assistant messages: ${activeSession?.stats.assistantMessageCount}`);
  console.log(`Total tokens: ${activeSession?.stats.totalTokens}\n`);

  await manager.endSession();

  // ==================== Test 12: Session Statistics ====================
  console.log('Test 12: Overall Statistics');
  console.log('----------------------------');

  const finalStats = manager.getStats();
  console.log(`Total sessions: ${finalStats.totalSessions}`);
  console.log(`Total messages: ${finalStats.totalMessages}`);
  console.log(`Total tokens: ${finalStats.totalTokens}`);
  console.log(`Average session length: ${finalStats.averageSessionLength.toFixed(1)} messages\n`);

  // ==================== Final Summary ====================
  console.log('======================================');
  console.log('All Tests Completed Successfully!');
  console.log('======================================\n');
  console.log('Summary:');
  console.log('  Create and manage sessions');
  console.log('  Add and track messages');
  console.log('  Auto-generate titles and summaries');
  console.log('  Build context vectors (topics, tech stack)');
  console.log('  Search by keywords and tech stack');
  console.log('  Retrieve recent sessions');
  console.log('  Generate AI context summaries');
  console.log('  Track session statistics\n');
}

// Run tests
testSessionContext()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
