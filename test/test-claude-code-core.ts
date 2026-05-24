/**
 * Claude Code Subagent System - 核心功能演示
 */

import { ComplexityAnalyzer } from '../src/complexity/analyzer';
import { ComplexityLevel } from '../src/complexity/types';

async function testComplexityAnalysis() {
  console.log('🧪 Testing Complexity Analysis\n');
  console.log('═'.repeat(60));

  const analyzer = new ComplexityAnalyzer();

  // 测试案例 1: 简单任务
  console.log('\n📝 Test 1: Simple Task');
  const result1 = await analyzer.analyze({
    requirement: '创建一个登录页面',
    projectRoot: '/tmp/test',
    projectInfo: {
      totalFiles: 10,
      languages: ['TypeScript'],
      frameworks: ['React']
    }
  });

  console.log(`Requirement: 创建一个登录页面`);
  console.log(`Score: ${result1.score.total}/100`);
  console.log(`Level: ${result1.score.level}`);
  console.log(`Should use Claude Code: ${result1.shouldUseClaudeCode}`);
  console.log(`Recommended: ${result1.score.recommendedStrategy}`);
  console.log(`Reasons: ${result1.score.reasons.join(', ')}`);

  // 测试案例 2: 复杂任务
  console.log('\n📝 Test 2: Complex Task');
  const result2 = await analyzer.analyze({
    requirement: '重构用户认证系统，添加 OAuth2 和 JWT 支持，实现微服务架构',
    projectRoot: '/tmp/test',
    projectInfo: {
      totalFiles: 80,
      languages: ['TypeScript', 'Python', 'Go'],
      frameworks: ['React', 'Express', 'Redis', 'PostgreSQL']
    }
  });

  console.log(`Requirement: 重构用户认证系统，添加 OAuth2 和 JWT 支持，实现微服务架构`);
  console.log(`Score: ${result2.score.total}/100`);
  console.log(`Level: ${result2.score.level}`);
  console.log(`Should use Claude Code: ${result2.shouldUseClaudeCode}`);
  console.log(`Recommended: ${result2.score.recommendedStrategy}`);
  console.log(`Suggested Agents: ${result2.suggestedAgentTypes?.join(', ') || 'N/A'}`);
  console.log(`Suggested Subagent Count: ${result2.suggestedSubagentCount || 'N/A'}`);

  // 测试案例 3: 快速检测
  console.log('\n📝 Test 3: Quick Check');
  const quickCheck = analyzer.quickCheck('设计分布式系统架构，实现微服务通信');
  console.log(`Requirement: 设计分布式系统架构，实现微服务通信`);
  console.log(`Quick Check Result: ${quickCheck ? 'Complex' : 'Simple'}`);

  console.log('\n✅ Complexity Analysis Tests Completed!\n');
}

async function testComplexityDimensions() {
  console.log('\n🧪 Testing Complexity Dimensions\n');
  console.log('═'.repeat(60));

  const analyzer = new ComplexityAnalyzer();

  const result = await analyzer.analyze({
    requirement: '创建一个完整的电商系统，包含用户管理、商品展示、购物车、支付、订单管理、库存管理和物流跟踪',
    projectRoot: '/tmp/test',
    projectInfo: {
      totalFiles: 150,
      languages: ['TypeScript', 'Python', 'SQL'],
      frameworks: ['React', 'Node.js', 'PostgreSQL', 'Redis', 'Docker']
    }
  });

  console.log(`Requirement: 创建一个完整的电商系统...`);
  console.log('\n📊 Dimension Scores:');
  console.log(`  File Count:       ${result.score.dimensions.fileCount}/20`);
  console.log(`  Tech Stack:       ${result.score.dimensions.techStack}/20`);
  console.log(`  Dependencies:     ${result.score.dimensions.dependencies}/20`);
  console.log(`  Estimated Steps:  ${result.score.dimensions.estimatedSteps}/20`);
  console.log(`  Code Scope:       ${result.score.dimensions.codeScope}/20`);

  console.log(`\n🎯 Total Score: ${result.score.total}/100`);
  console.log(`📈 Level: ${result.score.level}`);

  console.log('\n💡 Reasons:');
  result.score.reasons.forEach(reason => {
    console.log(`  - ${reason}`);
  });

  console.log('\n✅ Complexity Dimensions Tests Completed!\n');
}

async function runAllTests() {
  console.log('\n' + '█'.repeat(60));
  console.log('█' + ' '.repeat(58) + '█');
  console.log('█' + '  Claude Code Subagent System - Core Functionality  '.padEnd(58) + '█');
  console.log('█' + ' '.repeat(58) + '█');
  console.log('█'.repeat(60) + '\n');

  try {
    await testComplexityAnalysis();
    await testComplexityDimensions();

    console.log('\n' + '█'.repeat(60));
    console.log('█' + ' '.repeat(58) + '█');
    console.log('█' + '  ✅ All Tests Passed!  '.padEnd(58) + '█');
    console.log('█' + ' '.repeat(58) + '█');
    console.log('█'.repeat(60) + '\n');

    console.log('📚 Next Steps:');
    console.log('  1. Fix remaining compilation errors');
    console.log('  2. Implement ParallelSubAgentCoordinator');
    console.log('  3. Create specialized agents');
    console.log('  4. Integrate with REPL commands');
    console.log('  5. Add integration tests\n');

  } catch (error: any) {
    console.error('\n❌ Test Failed:', error.message);
    console.error(error.stack);
  }
}

// 运行测试
runAllTests();
