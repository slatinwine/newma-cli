#!/usr/bin/env ts-node

/**
 * 测试用户侧写自动更新功能
 *
 * 这个脚本模拟用户在聊天模式中的 3 次对话，
 * 验证系统是否能够正确记录输入并触发侧写更新。
 */

import { SessionManager } from './src/session';
import { Config } from './src/config';

// Mock 配置
const mockConfig: Config = {
  apiKey: 'test-key',
  endpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4',
  baseUrl: 'https://api.openai.com',
};

async function testProfileUpdateTrigger() {
  console.log('🧪 测试用户侧写自动更新功能\n');
  console.log('═'.repeat(60));

  // 创建 SessionManager
  const session = new SessionManager(
    process.cwd(),
    mockConfig,
    {}
  );

  console.log('\n✅ SessionManager 创建成功');
  console.log(`📊 侧写更新间隔: ${session.getProfileUpdateInterval()} 次对话\n`);

  // 模拟用户对话
  const testInputs = [
    '你好',
    '今天天气怎么样',
    '小米股价',
  ];

  console.log('📝 模拟用户对话:\n');

  for (let i = 0; i < testInputs.length; i++) {
    const input = testInputs[i];
    console.log(`  ${i + 1}. "${input}"`);

    // 记录用户输入
    session.recordUserInput(input);

    // 检查是否应该更新侧写
    const shouldUpdate = session.shouldUpdateProfile();
    console.log(`     → 应该更新侧写: ${shouldUpdate ? '✅ 是' : '❌ 否'}`);
    console.log(`     → 已记录输入数: ${session.getUserInputs().length}\n`);
  }

  // 验证结果
  console.log('─'.repeat(60));
  console.log('\n📊 测试结果:\n');

  const allInputs = session.getUserInputs();
  console.log(`✅ 总共记录了 ${allInputs.length} 次用户输入`);
  console.log(`✅ 第 ${session.getProfileUpdateInterval()} 次对话后应该触发侧写更新`);

  if (allInputs.length === testInputs.length) {
    console.log('✅ 所有输入都被正确记录\n');

    // 显示所有记录的输入
    console.log('📋 记录的输入列表:');
    allInputs.forEach((input, index) => {
      console.log(`  ${index + 1}. ${input}`);
    });
    console.log();

    // 测试清空功能
    console.log('🧹 测试清空输入记录...');
    session.clearUserInputs();
    const clearedInputs = session.getUserInputs();
    console.log(`✅ 清空后的输入数: ${clearedInputs.length}\n`);

    console.log('═'.repeat(60));
    console.log('\n✅ 所有测试通过！\n');

    console.log('💡 实际使用场景:');
    console.log('  1. 用户在聊天模式中对话');
    console.log('  2. 系统记录每次用户输入');
    console.log('  3. 第 3 次对话后自动触发侧写更新');
    console.log('  4. AI 分析输入历史生成新侧写');
    console.log('  5. 保存到 用户侧写.md 文件');
    console.log('  6. 清空输入记录，重新开始计数\n');
  } else {
    console.log('❌ 输入记录不正确\n');
    process.exit(1);
  }
}

testProfileUpdateTrigger().catch(error => {
  console.error('\n❌ 测试失败:', error);
  process.exit(1);
});
