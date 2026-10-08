#!/usr/bin/env npx ts-node
// test-streaming.ts
/**
 * 流式 AI 响应测试脚本
 */

import { Config } from './src/config';
import { streamAI, accumulateStream } from './src/ai-streaming';
import chalk from 'chalk';

async function testBasicStreaming() {
  console.log(chalk.cyan('\n🧪 测试 1: 基础流式响应\n'));

  const config: Config = {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    endpoint: undefined,
  };

  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: '用两句话介绍一下 TypeScript 的主要特性' },
  ];

  try {
    console.log(chalk.gray('📤 发送请求...\n'));

    let fullText = '';
    let chunkCount = 0;

    const startTime = Date.now();

    // 使用流式响应
    for await (const chunk of streamAI(config, messages)) {
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
  } catch (error) {
    console.error(chalk.red('❌ 测试失败:'), error);
    throw error;
  }
}

async function testStreamingWithCallbacks() {
  console.log(chalk.cyan('\n🧪 测试 2: 带回调的流式响应\n'));

  const config: Config = {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    endpoint: undefined,
  };

  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: '列出 JavaScript 的三个优势' },
  ];

  try {
    console.log(chalk.gray('📤 发送请求...\n'));

    let chunkCount = 0;
    let totalDelta = 0;

    const startTime = Date.now();

    // 使用回调
    await accumulateStream(
      streamAI(config, messages, {
        onChunk: (chunk) => {
          chunkCount++;
          if (chunk.delta) {
            totalDelta += chunk.delta.length;
          }
        },
        onComplete: (reason) => {
          console.log(chalk.green(`\n\n✅ 流完成: ${reason}`));
        },
        onError: (error) => {
          console.error(chalk.red('❌ 流错误:'), error);
        },
      })
    );

    const duration = Date.now() - startTime;

    console.log(chalk.gray(`📊 收到 ${chunkCount} 个 chunk`));
    console.log(chalk.gray(`📝 总字数: ${totalDelta} 字符`));
    console.log(chalk.gray(`⏱️  总耗时: ${duration}ms`));
    console.log(chalk.gray(`🚀 平均速度: ${(totalDelta / (duration / 1000)).toFixed(2)} 字符/秒\n`));
  } catch (error) {
    console.error(chalk.red('❌ 测试失败:'), error);
    throw error;
  }
}

async function testStreamingAccumulate() {
  console.log(chalk.cyan('\n🧪 测试 3: 累积流式响应\n'));

  const config: Config = {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    endpoint: undefined,
  };

  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: '什么是 React?' },
  ];

  try {
    console.log(chalk.gray('📤 发送请求...\n'));

    const startTime = Date.now();

    // 使用 accumulateStream 工具
    const fullText = await accumulateStream(streamAI(config, messages));

    const duration = Date.now() - startTime;

    console.log(chalk.gray('\n─'.repeat(50)));
    console.log(chalk.green('✅ 累积完成'));
    console.log(chalk.gray('📝 完整文本:'));
    console.log(chalk.white(fullText));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.gray(`⏱️  总耗时: ${duration}ms\n`));

    return fullText;
  } catch (error) {
    console.error(chalk.red('❌ 测试失败:'), error);
    throw error;
  }
}

async function main() {
  console.log(chalk.cyan.bold('╔════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║   Kode 流式 AI 响应测试                    ║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════╝'));

  try {
    await testBasicStreaming();
    await testStreamingWithCallbacks();
    await testStreamingAccumulate();

    console.log(chalk.green.bold('\n✅ 所有测试通过!\n'));
  } catch (error) {
    console.error(chalk.red.bold('\n❌ 测试失败\n'));
    process.exit(1);
  }
}

// 运行测试
main();
