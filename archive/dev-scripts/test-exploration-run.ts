#!/usr/bin/env ts-node
/**
 * Test Autonomous Exploration Run
 *
 * 手动触发一次自主探索，验证新实现的动作执行器
 */

import { AutonomousExplorer } from './src/agents/autonomous-explorer';
import { getDefaultConfig } from './src/config';
import * as path from 'path';

async function main() {
  console.log('🚀 Starting autonomous exploration test...\n');

  const config = getDefaultConfig();
  const projectRoot = process.cwd();

  const explorer = new AutonomousExplorer(config, {
    projectRoot,
    domains: ['system_maintenance', 'code_analysis'], // 先测试两个领域
    maxActionsPerDomain: 2,
    timeout: 60000,
  });

  try {
    console.log('📊 Running exploration...\n');
    const result = await explorer.explore();

    console.log('\n✅ Exploration completed!\n');
    console.log('📈 Results:');
    console.log(`   Task ID: ${result.taskId}`);
    console.log(`   Duration: ${(result.duration / 1000).toFixed(1)}s`);
    console.log(`   Total Actions: ${result.summary.total}`);
    console.log(`   Completed: ${result.summary.completed}`);
    console.log(`   Failed: ${result.summary.failed}`);
    console.log(`   Success Rate: ${((result.summary.completed / result.summary.total) * 100).toFixed(1)}%`);

    console.log('\n📊 Actions by Domain:');
    Object.entries(result.summary.byDomain).forEach(([domain, count]) => {
      console.log(`   ${domain}: ${count}`);
    });

    console.log('\n💡 Insights:');
    result.insights.slice(0, 3).forEach((insight, i) => {
      console.log(`   ${i + 1}. ${insight}`);
    });

    console.log('\n📋 Recommendations:');
    result.recommendations.slice(0, 3).forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`);
    });

    console.log('\n✅ Test passed!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Exploration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
