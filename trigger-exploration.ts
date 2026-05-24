#!/usr/bin/env ts-node
/**
 * 手动触发自主探索
 */

import { AutonomousExplorer } from './src/agents/autonomous-explorer';
import { ExplorationLogManager } from './src/memory/exploration-log';
import { getDefaultConfig } from './src/config';
import * as path from 'path';

async function triggerExploration() {
  console.log('🚀 手动触发 Newma 自主探索\n');

  const config = getDefaultConfig();

  if (!config.apiKey) {
    console.error('❌ 错误: OPENAI_API_KEY 未设置');
    console.log('\n请设置环境变量:');
    console.log('  export OPENAI_API_KEY=your-key-here\n');
    process.exit(1);
  }

  const logManager = new ExplorationLogManager({
    logDir: path.join(process.cwd(), '.kode', 'exploration-logs'),
    retentionDays: 30,
    maxLogSize: 100,
  });

  const explorer = new AutonomousExplorer(config, {
    projectRoot: process.cwd(),
    domains: ['system_maintenance', 'code_analysis'], // 真实探索2个领域
    maxActionsPerDomain: 2,
    timeout: 30000,
  }, logManager); // 传递 logManager 给 explorer

  console.log('🤖 开始自主探索...\n');
  console.log('='.repeat(60));

  try {
    const result = await explorer.explore();

    console.log('='.repeat(60));
    console.log('\n✅ 探索完成！\n');

    // 保存日志
    await logManager.logExploration(result);
    console.log('📝 日志已保存到: ~/.kode/exploration-logs/\n');

    // 显示结果
    console.log('📊 探索结果:');
    console.log(`   任务ID: ${result.taskId}`);
    console.log(`   执行时长: ${Math.floor(result.duration / 1000)}秒`);
    console.log(`   总动作数: ${result.summary.total}`);
    console.log(`   完成数: ${result.summary.completed}`);
    console.log(`   失败数: ${result.summary.failed}\n`);

    if (result.insights.length > 0) {
      console.log('💡 关键洞察:');
      result.insights.forEach((insight, i) => {
        console.log(`   ${i + 1}. ${insight}`);
      });
      console.log('');
    }

    if (result.recommendations.length > 0) {
      console.log('📝 改进建议:');
      result.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
      console.log('');
    }

    console.log('✅ 自主探索完成！\n');
  } catch (error: any) {
    console.error('\n❌ 探索失败:', error.message);
    process.exit(1);
  }
}

triggerExploration();
