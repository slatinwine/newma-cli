#!/usr/bin/env ts-node
/**
 * 自主探索测试脚本
 *
 * 演示自主探索 Agent 的核心功能
 */

import { AutonomousExplorer } from './src/agents/autonomous-explorer';
import { ExplorationLogManager } from './src/memory/exploration-log';
import { getDefaultConfig } from './src/config';
import * as path from 'path';

async function testExploration() {
  console.log('🚀 Newma 自主探索测试\n');

  // 1. 获取配置
  const config = getDefaultConfig();
  console.log('✓ 配置加载成功');
  console.log(`  API Key: ${config.apiKey ? '***' + config.apiKey.slice(-4) : '未设置'}`);
  console.log(`  模型: ${config.model}\n`);

  // 2. 创建探索 Agent
  const explorer = new AutonomousExplorer(config, {
    projectRoot: process.cwd(),
    domains: ['system_maintenance', 'code_analysis'], // 仅测试两个领域
    maxActionsPerDomain: 2, // 限制动作数量
    timeout: 30000,
  });

  console.log('✓ 自主探索 Agent 创建成功');
  console.log(`  项目根目录: ${process.cwd()}`);
  console.log(`  探索领域: 系统维护、代码分析`);
  console.log(`  每领域最大动作数: 2\n`);

  // 3. 创建日志管理器
  const logManager = new ExplorationLogManager({
    logDir: path.join(process.cwd(), '.kode', 'exploration-logs'),
    retentionDays: 30,
    maxLogSize: 100,
  });

  console.log('✓ 日志管理器创建成功\n');

  // 4. 执行探索
  console.log('🤖 开始自主探索...\n');
  console.log('=' .repeat(60));

  try {
    const result = await explorer.explore();

    console.log('=' .repeat(60));
    console.log('\n✅ 探索完成！\n');

    // 5. 记录日志
    console.log('📝 保存探索日志...');
    await logManager.logExploration(result);
    console.log('✓ 日志已保存\n');

    // 6. 显示统计信息
    console.log('📊 探索统计:');
    console.log(`   任务ID: ${result.taskId}`);
    console.log(`   开始时间: ${result.startTime}`);
    console.log(`   结束时间: ${result.endTime}`);
    console.log(`   执行时长: ${Math.floor(result.duration / 1000)}秒`);
    console.log(`   总动作数: ${result.summary.total}`);
    console.log(`   完成数: ${result.summary.completed}`);
    console.log(`   失败数: ${result.summary.failed}\n`);

    // 7. 显示洞察
    if (result.insights.length > 0) {
      console.log('💡 关键洞察:');
      result.insights.forEach((insight, i) => {
        console.log(`   ${i + 1}. ${insight}`);
      });
      console.log('');
    }

    // 8. 显示建议
    if (result.recommendations.length > 0) {
      console.log('📝 改进建议:');
      result.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
      console.log('');
    }

    // 9. 显示历史记录
    console.log('📜 探索历史:');
    const history = await logManager.getHistory(5);
    console.log(`   最近 ${history.length} 次探索:`);
    history.forEach((entry: any, i) => {
      console.log(
        `   ${i + 1}. ${entry.taskId} - ${entry.status} - ${new Date(entry.timestamp).toLocaleString()}`
      );
    });
    console.log('');

    // 10. 显示统计
    console.log('📈 总体统计:');
    const stats = await logManager.getStatistics();
    console.log(`   总探索次数: ${stats.totalExplorations}`);
    console.log(`   成功: ${stats.successfulExplorations}`);
    console.log(`   失败: ${stats.failedExplorations}`);
    console.log(`   平均时长: ${Math.floor(stats.averageDuration / 1000)}秒`);
    console.log(`   最后探索: ${stats.lastExploration ? new Date(stats.lastExploration).toLocaleString() : 'N/A'}\n`);

    console.log('✅ 测试完成！\n');
  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('   请确保:');
    console.error('   1. OPENAI_API_KEY 环境变量已设置');
    console.error('   2. API Key 有效且有足够的配额');
    console.error('   3. 网络连接正常\n');
    process.exit(1);
  }
}

// 运行测试
testExploration()
  .then(() => {
    console.log('🎉 所有测试通过！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 测试异常:', error);
    process.exit(1);
  });
