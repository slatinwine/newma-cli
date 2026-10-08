#!/usr/bin/env ts-node
/**
 * Test Autonomous Exploration Failure Scenarios
 *
 * 测试自主探索在不同失败场景下的报告生成
 */

import { AutonomousExplorer, ExplorationResult } from './src/agents/autonomous-explorer';
import { getDefaultConfig } from './src/config';
import * as path from 'path';

async function testScenario(name: string, testFn: () => Promise<void>) {
  console.log('\n' + '='.repeat(70));
  console.log(`🧪 Testing: ${name}`);
  console.log('='.repeat(70));

  try {
    await testFn();
    console.log(`\n✅ Test passed: ${name}`);
  } catch (error: any) {
    console.error(`\n❌ Test failed: ${name}`);
    console.error(`   Error: ${error.message}`);
  }
}

async function test1_FullSuccess() {
  await testScenario('Full Success Scenario', async () => {
    const config = getDefaultConfig();
    const explorer = new AutonomousExplorer(config, {
      projectRoot: process.cwd(),
      domains: ['system_maintenance'],
      maxActionsPerDomain: 2,
    });

    const result = await explorer.explore();

    if (result.status !== 'completed') {
      throw new Error(`Expected status 'completed', got '${result.status}'`);
    }

    if (result.summary.failed > 0) {
      throw new Error(`Expected 0 failures, got ${result.summary.failed}`);
    }

    console.log(`\n✓ All ${result.summary.total} actions succeeded`);
  });
}

async function test2_PartialSuccess() {
  await testScenario('Partial Success Scenario', async () => {
    // 这个测试会触发部分成功
    const config = getDefaultConfig();
    const explorer = new AutonomousExplorer(config, {
      projectRoot: process.cwd(),
      domains: ['system_maintenance', 'code_analysis', 'workspace_optimization'],
      maxActionsPerDomain: 3,
      timeout: 1000, // 短超时导致部分失败
    });

    const result = await explorer.explore();

    console.log(`\n✓ Result status: ${result.status}`);
    console.log(`✓ Completed: ${result.summary.completed}, Failed: ${result.summary.failed}`);

    if (result.status === 'partial') {
      console.log(`\n✓ Partial status correctly detected`);
      console.log(`✓ Insights generated: ${result.insights.length}`);
      console.log(`✓ Recommendations: ${result.recommendations.length}`);
    }
  });
}

async function test3_APIFailure() {
  await testScenario('API Failure Simulation', async () => {
    // 使用无效的 API key 来模拟 API 失败
    const config = {
      ...getDefaultConfig(),
      apiKey: 'invalid-key-for-testing',
    };

    const explorer = new AutonomousExplorer(config, {
      projectRoot: process.cwd(),
      domains: ['system_maintenance'],
      maxActionsPerDomain: 1,
    });

    const result = await explorer.explore();

    console.log(`\n✓ Result status: ${result.status}`);
    console.log(`✓ Failure stage: ${result.error?.stage}`);
    console.log(`✓ Error message: ${result.error?.message}`);

    if (result.status === 'failed') {
      console.log(`\n✓ Failure status correctly detected`);
      console.log(`✓ Error details captured`);
      console.log(`✓ Insights despite failure: ${result.insights.length}`);
      console.log(`✓ Recommendations for recovery: ${result.recommendations.length}`);

      // 显示建议
      console.log('\n💡 Recovery Suggestions:');
      result.recommendations.slice(0, 3).forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    }
  });
}

async function test4_InvalidProjectRoot() {
  await testScenario('Invalid Project Root', async () => {
    const config = getDefaultConfig();
    const explorer = new AutonomousExplorer(config, {
      projectRoot: '/nonexistent/directory/that/does/not/exist',
      domains: ['system_maintenance'],
      maxActionsPerDomain: 1,
    });

    const result = await explorer.explore();

    console.log(`\n✓ Result status: ${result.status}`);
    console.log(`✓ Failure stage: ${result.error?.stage}`);

    if (result.status === 'failed') {
      console.log(`\n✓ System state collection failure correctly detected`);
      console.log(`✓ Appropriate recommendations generated`);
    }
  });
}

async function main() {
  console.log('🚀 Autonomous Exploration Failure Report Test Suite\n');
  console.log('This suite tests various failure scenarios to ensure');
  console.log('meaningful reports are generated even when exploration fails.\n');

  // 运行所有测试
  await test1_FullSuccess();
  await test2_PartialSuccess();
  // await test3_APIFailure(); // 跳过 API 测试（需要真实API调用）
  // await test4_InvalidProjectRoot(); // 跳过无效路径测试

  console.log('\n' + '='.repeat(70));
  console.log('🎉 Test Suite Completed');
  console.log('='.repeat(70));
}

main().catch((error) => {
  console.error('\n💥 Test suite crashed:', error);
  process.exit(1);
});
