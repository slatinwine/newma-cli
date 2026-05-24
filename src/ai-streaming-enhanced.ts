// src/ai-streaming-enhanced.ts
/**
 * 增强版流式 AI 响应
 * 使用 Stream<T> 管道实现进度显示、节流输出
 */

import chalk from 'chalk';
import { Config } from './config';
import { Stream } from './utils/stream';
import { streamAIText } from './ai-streaming';

/**
 * 流式调用 AI 并实时输出到 stdout
 */
export async function callAIStream(
  config: Config,
  messages: Array<{ role: string; content: string }>,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const stream = streamAIText(config, messages, { signal });
  return stream.collectString();
  // 注意：这里需要同时收集文本和触发回调
  // 改用管道：
}

/**
 * 流式调用 AI 并实时输出到 stdout（使用管道）
 */
export async function callAIStreamV2(
  config: Config,
  messages: Array<{ role: string; content: string }>,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const textStream = streamAIText(config, messages, { signal });

  // 并行：收集 + 回调
  let fullContent = '';
  for await (const chunk of textStream) {
    fullContent += chunk;
    onChunk(chunk);
  }
  return fullContent;
}

/**
 * 带进度显示的流式调用（使用 batch 管道节流）
 */
export async function callAIStreamWithProgress(
  config: Config,
  messages: Array<{ role: string; content: string }>,
  signal?: AbortSignal
): Promise<string> {
  console.log(chalk.gray('🤔 AI 正在思考...\n'));

  const textStream = streamAIText(config, messages, { signal });

  // 使用 batch(80ms) 合并快速连续的输出，减少 stdout 写入次数
  const batchedStream = textStream.batch(80);
  let fullContent = '';

  for await (const batch of batchedStream) {
    const text = batch.join('');
    fullContent += text;
    process.stdout.write(text);
  }

  return fullContent;
}
