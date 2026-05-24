// src/ai-streaming.ts
/**
 * 流式 AI 响应模块
 *
 * 基于 Stream<T> 泛型类的 SSE 流式响应实现
 * 支持管道变换、背压、错误传播
 */

import fetch from 'node-fetch';
import { Config } from './config';
import { createProxyAgent } from './ai';
import { httpsAgent } from './http-agent';
import { Stream } from './utils/stream';

// ─── 类型定义 ───

export interface StreamChunk {
  delta?: string;
  finishReason?: string;
  toolCalls?: any[];
}

export interface StreamOptions {
  onChunk?: (chunk: StreamChunk) => void;
  onComplete?: (reason: string) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

// ─── SSE 解析 ───

function parseSSELine(line: string): any | null {
  if (!line.startsWith('data: ')) return null;
  const data = line.slice(6);
  if (data.trim() === '[DONE]') return { done: true };
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function extractStreamDelta(data: any): StreamChunk {
  const chunk: StreamChunk = {};
  const delta = data.choices?.[0]?.delta;
  if (delta?.content) chunk.delta = delta.content;
  const finishReason = data.choices?.[0]?.finish_reason;
  if (finishReason) chunk.finishReason = finishReason;
  if (delta?.tool_calls) chunk.toolCalls = delta.tool_calls;
  return chunk;
}

// ─── 核心：SSE → Stream 转换 ───

/**
 * 将 OpenAI SSE 响应转换为 Stream<StreamChunk>
 * 这是所有流式调用的基础
 */
export function sseToStream(
  config: Config,
  messages: Array<{ role: string; content: string }>,
  options: StreamOptions = {}
): Stream<StreamChunk> {
  const stream = new Stream<StreamChunk>();

  const endpoint =
    config.endpoint ||
    `${(config.baseUrl || 'https://api.openai.com').replace(/\/+$/, '')}/v1/chat/completions`;

  const requestBody: any = {
    model: config.model,
    temperature: 0.7,
    max_tokens: 2048,
    messages,
    stream: true,
  };

  (async () => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: options.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        stream.error(new Error(`API error: ${response.status} - ${error}`));
        return;
      }

      const body = response.body as any;
      if (!body) {
        stream.error(new Error('No response body'));
        return;
      }

      const reader = body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const data = parseSSELine(line);
          if (!data) continue;

          if (data.done) {
            if (options.onComplete) options.onComplete('stream_done');
            stream.end();
            return;
          }

          const chunk = extractStreamDelta(data);
          if (options.onChunk) options.onChunk(chunk);

          if (chunk.delta || chunk.toolCalls || chunk.finishReason) {
            stream.push(chunk);
          }

          if (chunk.finishReason) {
            if (options.onComplete) options.onComplete(chunk.finishReason);
            stream.end();
            return;
          }
        }
      }

      if (options.onComplete) options.onComplete('stream_end');
      stream.end();
    } catch (e) {
      if (options.onError) options.onError(e as Error);
      stream.error(e);
    }
  })();

  return stream;
}

// ─── 高级 API ───

/**
 * 流式文本生成 — 返回 Stream<string>
 * 用管道可以轻松 map/filter/batch
 */
export function streamAIText(
  config: Config,
  messages: Array<{ role: string; content: string }>,
  options: StreamOptions = {}
): Stream<string> {
  return sseToStream(config, messages, options)
    .filter((chunk) => !!chunk.delta)
    .map((chunk) => chunk.delta!);
}

/**
 * 流式文本 + 工具调用 — 返回原始 Stream<StreamChunk>
 */
export function streamAI(
  config: Config,
  messages: Array<{ role: string; content: string }>,
  toolDefinitions: any[] | undefined,
  options: StreamOptions = {}
): Stream<StreamChunk> {
  if (!toolDefinitions || toolDefinitions.length === 0) {
    return sseToStream(config, messages, options);
  }

  const endpoint =
    config.endpoint ||
    `${(config.baseUrl || 'https://api.openai.com').replace(/\/+$/, '')}/v1/chat/completions`;

  const stream = new Stream<StreamChunk>();
  const agent = createProxyAgent(config) || httpsAgent;

  const requestBody: any = {
    model: config.model,
    temperature: 0.7,
    max_tokens: 2048,
    messages,
    stream: true,
    tools: toolDefinitions,
  };

  (async () => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        agent,
        signal: options.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        stream.error(new Error(`API error: ${response.status} - ${error}`));
        return;
      }

      const body = response.body as any;
      if (!body) {
        stream.error(new Error('No response body'));
        return;
      }

      const reader = body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const data = parseSSELine(line);
          if (!data || data.done) continue;

          const chunk = extractStreamDelta(data);
          if (options.onChunk) options.onChunk(chunk);
          stream.push(chunk);

          if (chunk.finishReason) {
            if (options.onComplete) options.onComplete(chunk.finishReason);
            stream.end();
            return;
          }
        }
      }

      if (options.onComplete) options.onComplete('stream_end');
      stream.end();
    } catch (e) {
      if (options.onError) options.onError(e as Error);
      stream.error(e);
    }
  })();

  return stream;
}

// ─── 工具调用累积器 ───

/**
 * 将 Stream<StreamChunk> 转换为累积的工具调用结果
 * 返回 { content, toolCalls }
 */
export async function accumulateToolCalls(
  stream: Stream<StreamChunk>
): Promise<{ content: string; toolCalls: any[] }> {
  let fullContent = '';
  const toolCallsMap = new Map<number, any>();

  for await (const chunk of stream) {
    if (chunk.delta) {
      fullContent += chunk.delta;
    }
    if (chunk.toolCalls) {
      for (const tc of chunk.toolCalls) {
        if (!toolCallsMap.has(tc.index)) {
          toolCallsMap.set(tc.index, {
            id: tc.id,
            type: tc.type,
            function: { name: tc.function?.name || '', arguments: tc.function?.arguments || '' },
          });
        } else {
          const existing = toolCallsMap.get(tc.index);
          if (tc.function?.name) existing.function.name += tc.function.name;
          if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
        }
      }
    }
  }

  const toolCalls = Array.from(toolCallsMap.values());
  for (const tc of toolCalls) {
    try {
      tc.function.arguments = JSON.parse(tc.function.arguments);
    } catch {
      // 参数可能不完整
    }
  }

  return { content: fullContent, toolCalls };
}

// ─── 兼容旧 API ───

/**
 * 兼容旧版：流式 AI 调用（仅文本）
 * @deprecated 使用 streamAIText() + 管道替代
 */
export async function* legacyStreamAI(
  config: Config,
  messages: Array<{ role: string; content: string }>,
  options: StreamOptions = {}
): AsyncIterable<string> {
  yield* streamAIText(config, messages, options);
}

/**
 * 兼容旧版：累积流为完整文本
 */
export async function accumulateStream(
  stream: AsyncIterable<string>
): Promise<string> {
  let fullText = '';
  for await (const chunk of stream) {
    fullText += chunk;
  }
  return fullText;
}

/**
 * 兼容旧版：流式调用 + 工具
 * @deprecated 使用 streamAI() + accumulateToolCalls() 替代
 */
export async function streamAIWithTools(
  config: Config,
  messages: Array<{ role: string; content: string }>,
  toolDefinitions: any[] | undefined,
  options: StreamOptions = {}
): Promise<{ content: string; toolCalls: any[] }> {
  return accumulateToolCalls(streamAI(config, messages, toolDefinitions, options));
}
