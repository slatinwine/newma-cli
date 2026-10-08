#!/usr/bin/env node

/**
 * 测试计划模式修复
 * 验证 /plan 命令是否能正常工作
 */

const { callAI } = require('./dist/ai.js');

// 加载配置
require('dotenv').config();

const config = {
  apiKey: process.env.OPENAI_API_KEY,
  baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
  endpoint: process.env.OPENAI_ENDPOINT,
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
};

async function testPlanMode() {
  console.log('🧪 测试计划模式修复\n');
  console.log('─'.repeat(60));

  try {
    // 测试 1: 使用 tools（新逻辑）
    console.log('\n📋 测试 1: 计划模式 + 工具调用');
    console.log('─'.repeat(60));

    const projectInfo = {
      'test.txt': 'This is a test file',
    };

    const availableTools = ['list_files', 'read_file', 'write_file'];

    const response1 = await callAI(
      config,
      projectInfo,
      'List all files in the project',
      'plan',
      undefined,
      availableTools
    );

    console.log('\n✅ 响应类型:', response1.type);
    console.log('✅ 是否有 tool_calls:', !!response1.toolCalls);

    if (response1.type === 'tool_calls') {
      console.log('✅ 成功：AI 返回了 tool_calls');
      console.log('   工具数量:', response1.toolCalls.length);
    } else if (response1.actions && response1.actions.length > 0) {
      console.log('✅ 成功：AI 返回了 actions');
      console.log('   Action 数量:', response1.actions.length);
    } else {
      console.log('⚠️  警告：AI 返回了意外的响应');
      console.log('   Content:', response1.content?.substring(0, 200));
    }

    // 测试 2: 不使用 tools（回退到 JSON 模式）
    console.log('\n\n📋 测试 2: 计划模式 + JSON 模式（无工具）');
    console.log('─'.repeat(60));

    const response2 = await callAI(
      config,
      projectInfo,
      'Create a simple test plan',
      'plan',
      undefined,
      undefined // No tools
    );

    console.log('\n✅ 响应类型:', response2.type);
    console.log('✅ 是否有 actions:', response2.actions && response2.actions.length > 0);

    if (response2.actions && response2.actions.length > 0) {
      console.log('✅ 成功：AI 返回了 JSON actions');
      console.log('   Action 数量:', response2.actions.length);
    } else {
      console.log('⚠️  警告：AI 返回了意外的响应');
      console.log('   Content:', response2.content?.substring(0, 200));
    }

    console.log('\n\n' + '='.repeat(60));
    console.log('✅ 测试完成！');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('   错误详情:', error);
    process.exit(1);
  }
}

testPlanMode();
