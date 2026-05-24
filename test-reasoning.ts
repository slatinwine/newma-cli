/**
 * Reasoning Process Memory Test
 *
 * 测试推理过程记忆系统
 */

import { createReasoningManager } from './src/memory/reasoning-manager';
import { ReasoningStepType, ReasoningStepStatus } from './src/memory/reasoning-types';

async function testReasoning() {
  console.log('Testing Reasoning Process Memory System\n');
  console.log('========================================\n');

  const projectRoot = process.cwd();
  const manager = createReasoningManager(projectRoot);

  // ==================== Test 1: Initialize ====================
  console.log('Test 1: Initialize Reasoning Manager');
  console.log('-------------------------------------');

  await manager.initialize();
  console.log('Reasoning manager initialized\n');

  // ==================== Test 2: Create Chain ====================
  console.log('Test 2: Create Reasoning Chain');
  console.log('-------------------------------');

  const chainId1 = await manager.createChain('实现用户认证系统', 'plan');
  console.log(`Chain created: ${chainId1}`);

  let currentChain = manager.getCurrentChain();
  console.log(`Task: ${currentChain?.task}`);
  console.log(`Type: ${currentChain?.taskType}`);
  console.log(`Status: ${currentChain?.status}\n`);

  // ==================== Test 3: Add Steps ====================
  console.log('Test 3: Add Reasoning Steps');
  console.log('---------------------------');

  const step1 = await manager.addStep(
    'analysis',
    '需求分析',
    '分析用户认证系统的需求，包括登录、注册、密码重置等功能',
    undefined,
    { algorithm: 'fft', confidence: 0.9 }
  );
  console.log(`Step 1 added: ${step1}`);

  const step2 = await manager.addStep(
    'planning',
    '方案设计',
    '选择 JWT 作为认证方式，使用 TypeScript 和 Express 实现',
    step1,
    { algorithm: 'landmark' }
  );
  console.log(`Step 2 added: ${step2} (child of ${step1})`);

  const step3 = await manager.addStep(
    'execution',
    '实现登录功能',
    '创建登录 API，验证用户凭证，生成 JWT token',
    step2
  );
  console.log(`Step 3 added: ${step3} (child of ${step2})`);

  const step4 = await manager.addStep(
    'verification',
    '测试登录功能',
    '编写单元测试，验证登录流程的正确性',
    step3
  );
  console.log(`Step 4 added: ${step4} (child of ${step3})\n`);

  // ==================== Test 4: Update Steps ====================
  console.log('Test 4: Update Step Status');
  console.log('-------------------------');

  await manager.updateStep(step1, 'completed', {
    success: true,
    duration: 100,
  });
  console.log('Step 1: completed');

  await manager.updateStep(step2, 'completed', {
    success: true,
    duration: 200,
  });
  console.log('Step 2: completed');

  await manager.updateStep(step3, 'completed', {
    success: true,
    duration: 500,
  });
  console.log('Step 3: completed');

  await manager.updateStep(step4, 'completed', {
    success: true,
    duration: 300,
  });
  console.log('Step 4: completed\n');

  // ==================== Test 5: Check Reasoning Vector ====================
  console.log('Test 5: Check Reasoning Vector');
  console.log('-------------------------------');

  currentChain = manager.getCurrentChain();
  console.log('Algorithms:', currentChain?.reasoningVector?.algorithms.join(', ') || 'N/A');
  console.log('Patterns:', currentChain?.reasoningVector?.patterns.join(', ') || 'N/A');
  console.log('Approaches:', currentChain?.reasoningVector?.approaches.join(', ') || 'N/A');
  console.log();

  // ==================== Test 6: Complete Chain ====================
  console.log('Test 6: Complete Reasoning Chain');
  console.log('---------------------------------');

  await manager.completeChain(
    true,
    '成功实现用户认证系统，包括登录、注册和密码重置功能'
  );
  console.log('Chain completed');

  const stats = manager.getStats();
  console.log(`Total chains: ${stats.totalChains}`);
  console.log(`Total steps: ${stats.totalSteps}\n`);

  // ==================== Test 7: Create Another Chain ====================
  console.log('Test 7: Create Another Chain (Similar Task)');
  console.log('--------------------------------------------');

  const chainId2 = await manager.createChain('添加登录和注册功能', 'plan');
  console.log(`Chain created: ${chainId2}`);

  await manager.addStep(
    'analysis',
    '需求分析',
    '分析登录注册需求，决定使用 JWT 认证',
    undefined,
    { algorithm: 'fft' }
  );

  await manager.addStep(
    'planning',
    '技术选型',
    '使用 TypeScript 和 Express 框架',
    undefined,
    { algorithm: 'landmark' }
  );

  await manager.completeChain(true, '完成登录注册功能开发');
  console.log('Second chain completed\n');

  // ==================== Test 8: Search Similar Chains ====================
  console.log('Test 8: Search Similar Reasoning Chains');
  console.log('----------------------------------------');

  const similar = await manager.searchSimilarChains('实现用户登录', 'plan', 5);
  console.log(`Found ${similar.length} similar chains`);
  similar.forEach((result, index) => {
    console.log(`  ${index + 1}. ${result.chain.task}`);
    console.log(`     Similarity: ${(result.similarity * 100).toFixed(0)}%`);
    console.log(`     Success: ${result.chain.finalResult?.success ? 'Yes' : 'No'}`);
    if (result.chain.learnedPatterns?.preferredAlgorithm) {
      console.log(`     Algorithm: ${result.chain.learnedPatterns.preferredAlgorithm}`);
    }
  });
  console.log();

  // ==================== Test 9: Failed Chain ====================
  console.log('Test 9: Test Failed Chain');
  console.log('-------------------------');

  const chainId3 = await manager.createChain('实现微服务架构', 'plan');

  await manager.addStep(
    'analysis',
    '架构分析',
    '分析微服务架构的复杂性和挑战'
  );

  await manager.addStep(
    'planning',
    '设计方案',
    '设计服务拆分和通信方案'
  );

  await manager.updateStep(
    (await manager.addStep('execution', '实现服务', '开始实现微服务')),
    'failed',
    { success: false, error: '服务通信失败' }
  );

  await manager.completeChain(false, undefined, '微服务通信过于复杂');
  console.log('Failed chain created\n');

  // ==================== Test 10: Get AI Context ====================
  console.log('Test 10: Get AI Context Summary');
  console.log('-------------------------------');

  const aiContext = await manager.getAIContextSummary('实现用户登录功能', 'plan');

  console.log('AI Context Summary:');
  console.log('--------------------');
  console.log(aiContext);
  console.log('--------------------\n');

  // ==================== Test 11: Complex Reasoning Tree ====================
  console.log('Test 11: Complex Reasoning Tree');
  console.log('-------------------------------');

  const chainId4 = await manager.createChain('优化数据库性能', 'execute');

  const rootStep = await manager.addStep(
    'analysis',
    '性能分析',
    '分析数据库查询性能瓶颈'
  );

  const child1 = await manager.addStep(
    'planning',
    '优化索引',
    '为常用查询字段添加索引',
    rootStep
  );

  const child2 = await manager.addStep(
    'execution',
    '添加 Redis 缓存',
    '实现查询结果缓存',
    rootStep
  );

  const grandchild1 = await manager.addStep(
    'verification',
    '测试索引效果',
    '验证索引是否提升查询性能',
    child1
  );

  const grandchild2 = await manager.addStep(
    'verification',
    '测试缓存效果',
    '验证缓存是否减少数据库负载',
    child2
  );

  // Complete all steps
  await manager.updateStep(rootStep, 'completed', { success: true });
  await manager.updateStep(child1, 'completed', { success: true });
  await manager.updateStep(child2, 'completed', { success: true });
  await manager.updateStep(grandchild1, 'completed', { success: true });
  await manager.updateStep(grandchild2, 'completed', { success: true });

  await manager.completeChain(true, '数据库性能优化完成，查询速度提升 80%');

  const treeChain = manager.getCurrentChain();
  console.log(`Complex chain: ${treeChain?.task}`);
  console.log(`Total steps: ${treeChain?.stats.totalSteps}`);
  console.log(`Completed steps: ${treeChain?.stats.completedSteps}\n`);

  // ==================== Test 12: Final Statistics ====================
  console.log('Test 12: Final Statistics');
  console.log('-------------------------');

  const finalStats = manager.getStats();
  console.log(`Total chains: ${finalStats.totalChains}`);
  console.log(`Total steps: ${finalStats.totalSteps}`);
  console.log(`Total patterns: ${finalStats.totalPatterns}`);
  console.log(`Average chain length: ${finalStats.averageChainLength.toFixed(1)} steps`);
  console.log(`Overall success rate: ${(finalStats.overallSuccessRate * 100).toFixed(0)}%\n`);

  // ==================== Final Summary ====================
  console.log('========================================');
  console.log('All Tests Completed Successfully!');
  console.log('========================================\n');
  console.log('Summary:');
  console.log('  Create and manage reasoning chains');
  console.log('  Add and track reasoning steps');
  console.log('  Build reasoning trees (parent-child relationships)');
  console.log('  Extract reasoning vectors (algorithms, patterns)');
  console.log('  Learn from completed chains');
  console.log('  Search similar reasoning chains');
  console.log('  Generate AI context summaries');
  console.log('  Track reasoning statistics\n');
}

// Run tests
testReasoning()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
