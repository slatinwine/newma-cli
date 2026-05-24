// src/utils/streamJsonGuard.ts
/**
 * JSON 输出流安全守卫
 * 确保流式输出的 JSON 数据完整且不被截断
 * 基于 Claude Code streamJsonStdoutGuard.ts 设计
 */

import { Stream } from './stream';

// ─── 类型定义 ───

/**
 * JSON 块状态
 */
export type JsonChunkStatus = 'partial' | 'complete' | 'error';

/**
 * JSON 块结果
 */
export interface JsonChunk {
  /** 原始文本 */
  text: string;
  /** 状态 */
  status: JsonChunkStatus;
  /** 解析后的对象（仅当 status === 'complete' 时有效） */
  data?: unknown;
  /** 错误信息（仅当 status === 'error' 时有效） */
  error?: string;
}

// ─── JSON 守卫 ───

/**
 * JSON 输出流守卫
 * 确保流式输出的 JSON 数据完整性
 */
export class JsonStreamGuard {
  private buffer = '';
  private braceDepth = 0;
  private inString = false;
  private escapeNext = false;

  /**
   * 处理一个文本块，返回完整的 JSON 块
   * @param chunk 输入的文本块
   * @returns 完整的 JSON 块数组（可能为空）
   */
  process(chunk: string): JsonChunk[] {
    const results: JsonChunk[] = [];
    let startIndex = 0;

    for (let i = 0; i < chunk.length; i++) {
      const char = chunk[i];

      // 处理转义字符
      if (this.escapeNext) {
        this.escapeNext = false;
        continue;
      }

      // 处理字符串内字符
      if (this.inString) {
        switch (char) {
          case '\\':
            this.escapeNext = true;
            break;
          case '"':
            this.inString = false;
            break;
        }
        continue;
      }

      // 处理字符串外字符
      switch (char) {
        case '"':
          this.inString = true;
          break;
        case '{':
        case '[':
          this.braceDepth++;
          break;
        case '}':
        case ']':
          this.braceDepth--;
          // 检查是否完成一个 JSON 对象
          if (this.braceDepth === 0) {
            const jsonText = this.buffer + chunk.slice(startIndex, i + 1);
            results.push(this.parseJson(jsonText));
            this.buffer = '';
            startIndex = i + 1;
          }
          break;
      }
    }

    // 保存剩余部分
    this.buffer += chunk.slice(startIndex);

    return results;
  }

  /**
   * 完成流，处理剩余数据
   * @returns 最后的 JSON 块（如果有）
   */
  finalize(): JsonChunk | null {
    if (this.buffer.trim().length > 0) {
      const result = this.parseJson(this.buffer);
      this.buffer = '';
      return result;
    }
    return null;
  }

  /**
   * 重置守卫状态
   */
  reset(): void {
    this.buffer = '';
    this.braceDepth = 0;
    this.inString = false;
    this.escapeNext = false;
  }

  /**
   * 尝试解析 JSON
   */
  private parseJson(text: string): JsonChunk {
    const trimmed = text.trim();
    try {
      const data = JSON.parse(trimmed);
      return {
        text: trimmed,
        status: 'complete',
        data,
      };
    } catch (e) {
      // 检查是否是部分 JSON
      if (this.isPartialJson(trimmed)) {
        return {
          text: trimmed,
          status: 'partial',
        };
      }
      // 解析错误
      return {
        text: trimmed,
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  /**
   * 检查是否是部分 JSON
   */
  private isPartialJson(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.length === 0) return false;

    const firstChar = trimmed[0];
    const lastChar = trimmed[trimmed.length - 1];

    // 检查是否以 { 或 [ 开始，但没有对应的 } 或 ]
    if ((firstChar === '{' || firstChar === '[')) {
      if (lastChar !== '}' && lastChar !== ']') {
        return true;
      }
    }

    return false;
  }
}

// ─── 流式包装器 ───

/**
 * 为流添加 JSON 守卫
 * 将文本流转换为 JSON 块流
 * @param textStream 文本流
 * @returns JSON 块流
 */
export function guardJsonStream(textStream: AsyncIterable<string>): Stream<JsonChunk> {
  const output = new Stream<JsonChunk>();
  const guard = new JsonStreamGuard();

  (async () => {
    try {
      for await (const chunk of textStream) {
        const results = guard.process(chunk);
        for (const result of results) {
          // 只输出完整的 JSON 块
          if (result.status === 'complete') {
            output.push(result);
          }
        }
      }

      // 处理剩余数据
      const final = guard.finalize();
      if (final && final.status === 'complete') {
        output.push(final);
      }

      output.end();
    } catch (e) {
      output.error(e);
    }
  })();

  return output;
}

/**
 * 守卫 JSON 数组流
 * 将流式输出的数组元素逐个解析
 * @param textStream 文本流（应该是 JSON 数组）
 * @returns 数组元素流
 */
export function guardJsonArrayStream<T>(textStream: AsyncIterable<string>): Stream<T> {
  const output = new Stream<T>();
  const guard = new JsonStreamGuard();

  (async () => {
    try {
      for await (const chunk of textStream) {
        const results = guard.process(chunk);
        for (const result of results) {
          if (result.status === 'complete' && Array.isArray(result.data)) {
            // 逐个发出数组元素
            for (const item of result.data) {
              output.push(item as T);
            }
          }
        }
      }

      // 处理剩余数据
      const final = guard.finalize();
      if (final && final.status === 'complete' && Array.isArray(final.data)) {
        for (const item of final.data) {
          output.push(item as T);
        }
      }

      output.end();
    } catch (e) {
      output.error(e);
    }
  })();

  return output;
}

/**
 * 守卫 JSON Lines 流（NDJSON）
 * 每行是一个独立的 JSON 对象
 * @param textStream 文本流（每行一个 JSON）
 * @returns JSON 对象流
 */
export function guardJsonLinesStream<T>(textStream: AsyncIterable<string>): Stream<T> {
  const output = new Stream<T>();
  let buffer = '';

  (async () => {
    try {
      for await (const chunk of textStream) {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留最后一行（可能不完整）

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.length === 0) continue;

          try {
            const data = JSON.parse(trimmed);
            output.push(data as T);
          } catch (e) {
            // 跳过无法解析的行
            // 可以选择输出错误或记录日志
          }
        }
      }

      // 处理最后一行
      if (buffer.trim().length > 0) {
        try {
          const data = JSON.parse(buffer.trim());
          output.push(data as T);
        } catch (e) {
          // 跳过无法解析的行
        }
      }

      output.end();
    } catch (e) {
      output.error(e);
    }
  })();

  return output;
}

// ─── 工具函数 ───

/**
 * 将 JSON 对象流转换为文本流
 * @param jsonStream JSON 对象流
 * @param pretty 是否格式化输出
 * @returns 文本流
 */
export function jsonToTextStream<T>(
  jsonStream: AsyncIterable<T>,
  pretty = false
): Stream<string> {
  const output = new Stream<string>();

  (async () => {
    try {
      for await (const item of jsonStream) {
        const text = pretty ? JSON.stringify(item, null, 2) : JSON.stringify(item);
        output.push(text);
      }
      output.end();
    } catch (e) {
      output.error(e);
    }
  })();

  return output;
}

/**
 * 将 JSON 对象流转换为 JSON Lines 流
 * @param jsonStream JSON 对象流
 * @returns JSON Lines 文本流
 */
export function jsonToLinesStream<T>(jsonStream: AsyncIterable<T>): Stream<string> {
  const output = new Stream<string>();

  (async () => {
    try {
      for await (const item of jsonStream) {
        output.push(JSON.stringify(item) + '\n');
      }
      output.end();
    } catch (e) {
      output.error(e);
    }
  })();

  return output;
}

/**
 * 收集 JSON 块流为完整对象
 * @param chunkStream JSON 块流
 * @returns 完整的 JSON 对象数组
 */
export async function collectJsonChunks(
  chunkStream: AsyncIterable<JsonChunk>
): Promise<unknown[]> {
  const results: unknown[] = [];
  for await (const chunk of chunkStream) {
    if (chunk.status === 'complete' && chunk.data !== undefined) {
      results.push(chunk.data);
    }
  }
  return results;
}

/**
 * 收集 JSON 块流为单个对象（假设流中只有一个完整 JSON）
 * @param chunkStream JSON 块流
 * @returns 完整的 JSON 对象或 undefined
 */
export async function collectSingleJson(
  chunkStream: AsyncIterable<JsonChunk>
): Promise<unknown | undefined> {
  for await (const chunk of chunkStream) {
    if (chunk.status === 'complete' && chunk.data !== undefined) {
      return chunk.data;
    }
  }
  return undefined;
}
