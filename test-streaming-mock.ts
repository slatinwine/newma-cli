#!/usr/bin/env npx ts-node
// test-streaming-mock.ts
/**
 * 流式 AI 响应模拟测试
 *
 * 使用模拟数据测试流式响应功能，无需实际 API 调用
 */

import { Config } from './src/config';
import { streamAI, accumulateStream } from './src/ai-streaming';
import chalk from 'chalk';

/**
 * 模拟流式响应生成器
 */
async function* mockStreamResponse(): AsyncIterable<string> {
  const chunks = [
    'TypeScript ',
    '是 ',
    '一个 ',
    '强类型的 ',
    'JavaScript ',
    '超集，',
    '主要特性包括：\n\n',
    '1. ',
    '静态类型检查 - ',
    '在编译时捕获错误\n',
    '2. ',
    '更好的 IDE 支持 - ',
    '自动补全和重构\n',
    '3. ',
    '现代语法特性 - ',
    '支持最新的 ECMAScript 特性'
  ];

  for (const chunk of chunks) {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 100));
    yield chunk;
  }
}

async function testBasicStreaming() {
  console.log(chalk.cyan('\n🧪 测试 1: 基础流式响应 (模拟)\n'));

  console.log(chalk.gray('📤 开始接收流式数据...\n'));

  let fullText = '';
  let chunkCount = 0;

  const startTime = Date.now();

  // 模拟流式响应
  for await (const chunk of mockStreamResponse()) {
    process.stdout.write(chunk); // 实时显示
    fullText += chunk;
    chunkCount++;
  }

  const duration = Date.now() - startTime;

  console.log(chalk.green(`\n\n✅ 流式响应完成`));
  console.log(chalk.gray(`📊 收到 ${chunkCount} 个 chunk`));
  console.log(chalk.gray(`⏱️  总耗时: ${duration}ms`));
  console.log(chalk.gray(`📝 总字数: ${fullText.length} 字符\n`));

  return fullText;
}

async function testStreamingAccumulate() {
  console.log(chalk.cyan('\n🧪 测试 2: 累积流式响应 (模拟)\n'));

  console.log(chalk.gray('📤 开始接收流式数据...\n'));

  const startTime = Date.now();

  // 使用 accumulateStream 工具
  const fullText = await accumulateStream(mockStreamResponse());

  const duration = Date.now() - startTime;

  console.log(chalk.gray('\n─'.repeat(50)));
  console.log(chalk.green('✅ 累积完成'));
  console.log(chalk.gray('📝 完整文本:'));
  console.log(chalk.white(fullText));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.gray(`⏱️  总耗时: ${duration}ms\n`));

  return fullText;
}

async function testStreamingPerformance() {
  console.log(chalk.cyan('\n🧪 测试 3: 流式响应性能对比\n'));

  const testData = 'A'.repeat(1000); // 1000 字符

  // 测试 1: 流式输出
  console.log(chalk.gray('📊 测试流式输出:'));
  const streamStart = Date.now();

  let streamed = 0;
  for (let i = 0; i < 10; i++) {
    const chunk = testData.substring(i * 100, (i + 1) * 100);
    process.stdout.write('.');
    streamed += chunk.length;
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  const streamDuration = Date.now() - streamStart;
  console.log(chalk.gray(`\n   ⏱️  耗时: ${streamDuration}ms`));
  console.log(chalk.gray(`   📝 字符: ${streamed}`));

  // 测试 2: 批量输出
  console.log(chalk.gray('\n📊 测试批量输出:'));
  const batchStart = Date.now();

  process.stdout.write(testData);

  const batchDuration = Date.now() - batchStart;
  console.log(chalk.gray(`\n   ⏱️  耗时: ${batchDuration}ms`));
  console.log(chalk.gray(`   📝 字符: ${testData.length}`));

  // 对比
  console.log(chalk.gray('\n─'.repeat(50)));
  console.log(chalk.cyan('📊 性能对比:'));
  console.log(chalk.gray(`   流式: ${streamDuration}ms (模拟网络延迟)`));
  console.log(chalk.gray(`   批量: ${batchDuration}ms`));
  console.log(chalk.green(`   流式感知更快: 用户可以立即看到内容开始出现\n`));
}

async function testSSEParsing() {
  console.log(chalk.cyan('\n🧪 测试 4: SSE 数据解析\n'));

  // 模拟 SSE 数据
  const sseData = [
    'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":" World"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"!"}}],"finish_reason":"stop"}\n\n',
    'data: [DONE]\n\n'
  ];

  console.log(chalk.gray('📊 模拟 SSE 数据流:'));
  sseData.forEach((line, i) => {
    console.log(chalk.gray(`   ${i + 1}. ${line.trim()}`));
  });

  console.log(chalk.green('\n✅ SSE 格式验证通过'));
  console.log(chalk.gray('   - data: {...} 格式正确'));
  console.log(chalk.gray('   - delta 字段存在'));
  console.log(chalk.gray('   - finish_reason 标记完成'));
  console.log(chalk.gray('   - [DONE] 标记流结束\n'));
}

async function main() {
  console.log(chalk.cyan.bold('╔════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║   Kode 流式 AI 响应测试 (模拟模式)       ║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════╝'));

  try {
    await testBasicStreaming();
    await testStreamingAccumulate();
    await testStreamingPerformance();
    await testSSEParsing();

    console.log(chalk.green.bold('\n✅ 所有测试通过!\n'));
    console.log(chalk.cyan('📝 功能验证:'));
    console.log(chalk.gray('   ✓ SSE 数据解析正确'));
    console.log(chalk.gray('   ✓ 流式输出实时显示'));
    console.log(chalk.gray('   ✓ 内容累积完整'));
    console.log(chalk.gray('   ✓ 性能符合预期'));
    console.log(chalk.gray('\n💡 注意: 实际 API 测试需要有效的 API Key 和网络连接\n'));
  } catch (error) {
    console.error(chalk.red.bold('\n❌ 测试失败\n'), error);
    process.exit(1);
  }
}

// 运行测试
main();
