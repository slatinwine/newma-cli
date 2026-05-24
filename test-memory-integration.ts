/**
 * 记忆系统集成测试脚本
 */

import { SessionManager } from './src/session';
import { Config } from './src/config';

async function testMemoryIntegration() {
  console.log('🧠 开始测试记忆系统集成...\n');

  // 1. 创建配置
  const config: Config = {
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.com',
    model: 'gpt-4',
  };

  // 2. 创建 SessionManager
  console.log('✓ 创建 SessionManager...');
  const session = new SessionManager(process.cwd(), config, {
    permissionLevel: 'safe' as any,
    useTools: false,
    useVerify: false,
  });

  // 3. 初始化记忆系统
  console.log('✓ 初始化记忆系统...');
  await session.initializeMemory();

  // 4. 检查记忆系统是否已初始化
  if (session.isMemoryInitialized()) {
    console.log('✅ 记忆系统初始化成功！');
  } else {
    console.log('❌ 记忆系统初始化失败！');
    return;
  }

  // 5. 测试记忆管理器
  console.log('\n📊 测试记忆管理器:');

  try {
    const sessionContext = session.getSessionContextManager();
    const executionHistory = session.getExecutionHistoryManager();
    const preferences = session.getPreferencesManager();
    const errorMemory = session.getErrorMemory();

    console.log('✓ SessionContextManager: OK');
    console.log('✓ ExecutionHistoryManager: OK');
    console.log('✓ PreferencesManager: OK');
    console.log('✓ ErrorMemoryManager: OK');

    // 6. 测试记录会话消息
    console.log('\n📝 测试记录会话消息...');
    await sessionContext.addMessage('user', '测试消息 1');
    await sessionContext.addMessage('assistant', '测试回复 1');
    await sessionContext.addMessage('user', '测试消息 2');
    console.log('✓ 添加了 3 条消息');

    // 7. 测试记录命令
    console.log('\n⚡ 测试记录命令...');
    const cmdIndex1 = await executionHistory.recordCommandStart('/help', 'special');
    await executionHistory.recordCommandEnd(cmdIndex1, 'success', { duration: 100 });
    console.log(`✓ 记录命令 /help (index: ${cmdIndex1})`);

    const cmdIndex2 = await executionHistory.recordCommandStart('你好', 'chat');
    await executionHistory.recordCommandEnd(cmdIndex2, 'success', { duration: 200 });
    console.log(`✓ 记录命令 "你好" (index: ${cmdIndex2})`);

    // 8. 测试统计信息
    console.log('\n📈 测试统计信息...');
    const stats = await executionHistory.getStats();
    console.log(`✓ 总命令数: ${stats.totalCommands}`);
    console.log(`✓ 成功率: ${stats.successRate.toFixed(1)}%`);
    console.log(`✓ 平均耗时: ${stats.averageCommandDuration.toFixed(0)}ms`);

    // 9. 测试会话历史
    console.log('\n📋 测试会话历史...');
    const sessions = await sessionContext.getRecentSessions(10);
    console.log(`✓ 找到 ${sessions.length} 个会话`);

    // 10. 保存记忆
    console.log('\n💾 保存记忆系统...');
    await session.saveMemory();
    console.log('✅ 记忆保存成功！');

  } catch (error: any) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
    return;
  }

  console.log('\n✅ 所有测试通过！');
}

// 运行测试
testMemoryIntegration()
  .then(() => {
    console.log('\n🎉 测试完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 测试失败:', error);
    process.exit(1);
  });
