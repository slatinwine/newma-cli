// src/utils/streamTransform.ts
/**
 * 流式变换管道 - 链式变换构建器
 * 提供流式数据的链式变换操作
 */

import { Stream } from './stream';

// ─── 管道构建器 ───

/**
 * 流式管道构建器
 * 支持链式调用 map/filter/buffer/take/merge 等操作
 */
export class StreamPipelineBuilder<T> {
  constructor(private readonly source: AsyncIterable<T>) {}

  /** 映射变换 */
  map<U>(fn: (value: T) => U | Promise<U>): StreamPipelineBuilder<U> {
    const stream = new Stream<U>();
    (async () => {
      try {
        for await (const item of this.source) {
          stream.push(await fn(item));
        }
        stream.end();
      } catch (e) {
        stream.error(e);
      }
    })();
    return new StreamPipelineBuilder(stream);
  }

  /** 过滤 */
  filter(fn: (value: T) => boolean | Promise<boolean>): StreamPipelineBuilder<T> {
    const stream = new Stream<T>();
    (async () => {
      try {
        for await (const item of this.source) {
          if (await fn(item)) {
            stream.push(item);
          }
        }
        stream.end();
      } catch (e) {
        stream.error(e);
      }
    })();
    return new StreamPipelineBuilder(stream);
  }

  /** 缓冲：累积 N 个值后批量发出 */
  buffer(count: number): StreamPipelineBuilder<T[]> {
    const stream = new Stream<T[]>();
    let buffer: T[] = [];

    (async () => {
      try {
        for await (const item of this.source) {
          buffer.push(item);
          if (buffer.length >= count) {
            stream.push(buffer);
            buffer = [];
          }
        }
        // 发送剩余数据
        if (buffer.length > 0) {
          stream.push(buffer);
        }
        stream.end();
      } catch (e) {
        stream.error(e);
      }
    })();

    return new StreamPipelineBuilder(stream);
  }

  /** 时间窗口缓冲：在指定时间内累积数据 */
  bufferTime(windowMs: number): StreamPipelineBuilder<T[]> {
    const stream = new Stream<T[]>();
    let buffer: T[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      if (buffer.length > 0) {
        stream.push(buffer);
        buffer = [];
      }
      timer = undefined;
    };

    (async () => {
      try {
        for await (const item of this.source) {
          buffer.push(item);
          if (!timer) {
            timer = setTimeout(flush, windowMs);
          }
        }
        // 流结束后刷新剩余数据
        if (timer) {
          clearTimeout(timer);
        }
        if (buffer.length > 0) {
          stream.push(buffer);
        }
        stream.end();
      } catch (e) {
        if (timer) clearTimeout(timer);
        stream.error(e);
      }
    })();

    return new StreamPipelineBuilder(stream);
  }

  /** 取前 N 个值 */
  take(count: number): StreamPipelineBuilder<T> {
    const stream = new Stream<T>();
    let taken = 0;

    (async () => {
      try {
        for await (const item of this.source) {
          if (taken >= count) {
            stream.end();
            break;
          }
          stream.push(item);
          taken++;
        }
        stream.end();
      } catch (e) {
        stream.error(e);
      }
    })();

    return new StreamPipelineBuilder(stream);
  }

  /** 跳过前 N 个值 */
  skip(count: number): StreamPipelineBuilder<T> {
    const stream = new Stream<T>();
    let skipped = 0;

    (async () => {
      try {
        for await (const item of this.source) {
          if (skipped < count) {
            skipped++;
            continue;
          }
          stream.push(item);
        }
        stream.end();
      } catch (e) {
        stream.error(e);
      }
    })();

    return new StreamPipelineBuilder(stream);
  }

  /** 扁平映射 */
  flatMap<U>(fn: (value: T) => AsyncIterable<U> | Iterable<U>): StreamPipelineBuilder<U> {
    const stream = new Stream<U>();

    (async () => {
      try {
        for await (const item of this.source) {
          for await (const sub of fn(item)) {
            stream.push(sub);
          }
        }
        stream.end();
      } catch (e) {
        stream.error(e);
      }
    })();

    return new StreamPipelineBuilder(stream);
  }

  /** 去重 */
  distinct(): StreamPipelineBuilder<T> {
    const stream = new Stream<T>();
    const seen = new Set<T>();

    (async () => {
      try {
        for await (const item of this.source) {
          if (!seen.has(item)) {
            seen.add(item);
            stream.push(item);
          }
        }
        stream.end();
      } catch (e) {
        stream.error(e);
      }
    })();

    return new StreamPipelineBuilder(stream);
  }

  /** 扫描：累积状态 */
  scan<U>(initial: U, fn: (acc: U, value: T) => U | Promise<U>): StreamPipelineBuilder<U> {
    const stream = new Stream<U>();
    let acc = initial;

    (async () => {
      try {
        // 发出初始值
        stream.push(acc);
        for await (const item of this.source) {
          acc = await fn(acc, item);
          stream.push(acc);
        }
        stream.end();
      } catch (e) {
        stream.error(e);
      }
    })();

    return new StreamPipelineBuilder(stream);
  }

  /** 合并另一个流 */
  merge(other: AsyncIterable<T>): StreamPipelineBuilder<T> {
    const stream = new Stream<T>();
    let doneCount = 0;
    const total = 2;

    const drain = async (source: AsyncIterable<T>) => {
      try {
        for await (const item of source) {
          stream.push(item);
        }
      } catch (e) {
        stream.error(e);
        return;
      }
      doneCount++;
      if (doneCount === total) {
        stream.end();
      }
    };

    drain(this.source);
    drain(other);

    return new StreamPipelineBuilder(stream);
  }

  /** 连接另一个流（当前流结束后才开始下一个） */
  concat(other: AsyncIterable<T>): StreamPipelineBuilder<T> {
    const stream = new Stream<T>();

    (async () => {
      try {
        for await (const item of this.source) {
          stream.push(item);
        }
        for await (const item of other) {
          stream.push(item);
        }
        stream.end();
      } catch (e) {
        stream.error(e);
      }
    })();

    return new StreamPipelineBuilder(stream);
  }

  /** 侧效应：对每个值执行操作，但不改变流 */
  tap(fn: (value: T) => void | Promise<void>): StreamPipelineBuilder<T> {
    const stream = new Stream<T>();

    (async () => {
      try {
        for await (const item of this.source) {
          await fn(item);
          stream.push(item);
        }
        stream.end();
      } catch (e) {
        stream.error(e);
      }
    })();

    return new StreamPipelineBuilder(stream);
  }

  /** 收集为结果 */
  async collect(): Promise<T[]> {
    const results: T[] = [];
    for await (const item of this.source) {
      results.push(item);
    }
    return results;
  }

  /** 收集为字符串（T 必须是 string） */
  async collectString(): Promise<string> {
    const results: string[] = [];
    for await (const item of this.source) {
      results.push(item as unknown as string);
    }
    return results.join('');
  }

  /** 收集为单个值（使用归约函数） */
  async reduce<U>(initial: U, fn: (acc: U, value: T) => U | Promise<U>): Promise<U> {
    let acc = initial;
    for await (const item of this.source) {
      acc = await fn(acc, item);
    }
    return acc;
  }

  /** 计数 */
  async count(): Promise<number> {
    let count = 0;
    for await (const _ of this.source) {
      count++;
    }
    return count;
  }

  /** 检查是否所有值都满足条件 */
  async every(fn: (value: T) => boolean | Promise<boolean>): Promise<boolean> {
    for await (const item of this.source) {
      if (!(await fn(item))) {
        return false;
      }
    }
    return true;
  }

  /** 检查是否有任意值满足条件 */
  async some(fn: (value: T) => boolean | Promise<boolean>): Promise<boolean> {
    for await (const item of this.source) {
      if (await fn(item)) {
        return true;
      }
    }
    return false;
  }

  /** 查找第一个满足条件的值 */
  async find(fn: (value: T) => boolean | Promise<boolean>): Promise<T | undefined> {
    for await (const item of this.source) {
      if (await fn(item)) {
        return item;
      }
    }
    return undefined;
  }

  /** 获取第一个值 */
  async first(): Promise<T | undefined> {
    for await (const item of this.source) {
      return item;
    }
    return undefined;
  }

  /** 获取最后一个值 */
  async last(): Promise<T | undefined> {
    let last: T | undefined;
    for await (const item of this.source) {
      last = item;
    }
    return last;
  }

  /** 转换回 Stream */
  toStream(): Stream<T> {
    return Stream.from(this.source);
  }
}

// ─── 工厂函数 ───

/**
 * 创建流式管道
 * @example
 * ```ts
 * const result = await pipeline
 *   .from(sourceStream)
 *   .map(x => x * 2)
 *   .filter(x => x > 10)
 *   .buffer(100)
 *   .collect();
 * ```
 */
export function pipeline<T>(source: AsyncIterable<T>): StreamPipelineBuilder<T> {
  return new StreamPipelineBuilder(source);
}

/**
 * 从可迭代对象创建管道
 */
export function from<T>(iterable: AsyncIterable<T> | Iterable<T>): StreamPipelineBuilder<T> {
  // 使用 Stream.from 统一转换为 AsyncIterable<T>
  return new StreamPipelineBuilder(Stream.from(iterable));
}
