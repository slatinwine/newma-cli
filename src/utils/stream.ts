// src/utils/stream.ts
/**
 * 泛型异步流类
 * 基于 Claude Code 2.1.88 Stream<T> 设计，支持背压、错误传播、变换管道
 */

export class Stream<T> implements AsyncIterableIterator<T> {
  private readonly queue: T[] = [];
  private readResolve?: (value: IteratorResult<T>) => void;
  private readReject?: (error: unknown) => void;
  private isDone = false;
  private hasError: unknown | undefined;
  private started = false;

  constructor(private readonly onReturned?: () => void) {}

  [Symbol.asyncIterator](): AsyncIterableIterator<T> {
    if (this.started) {
      throw new Error('Stream can only be iterated once');
    }
    this.started = true;
    return this;
  }

  next(): Promise<IteratorResult<T, unknown>> {
    if (this.queue.length > 0) {
      return Promise.resolve({ done: false, value: this.queue.shift()! });
    }
    if (this.isDone) {
      return Promise.resolve({ done: true, value: undefined });
    }
    if (this.hasError) {
      return Promise.reject(this.hasError);
    }
    return new Promise<IteratorResult<T>>((resolve, reject) => {
      this.readResolve = resolve;
      this.readReject = reject;
    });
  }

  /** 向流中推入一个值 */
  push(value: T): void {
    if (this.readResolve) {
      const resolve = this.readResolve;
      this.readResolve = undefined;
      this.readReject = undefined;
      resolve({ done: false, value });
    } else {
      this.queue.push(value);
    }
  }

  /** 标记流结束 */
  end(): void {
    this.isDone = true;
    if (this.readResolve) {
      const resolve = this.readResolve;
      this.readResolve = undefined;
      this.readReject = undefined;
      resolve({ done: true, value: undefined });
    }
  }

  /** 向流中注入错误 */
  error(err: unknown): void {
    this.hasError = err;
    if (this.readReject) {
      const reject = this.readReject;
      this.readResolve = undefined;
      this.readReject = undefined;
      reject(err);
    }
  }

  return(): Promise<IteratorResult<T, unknown>> {
    this.isDone = true;
    if (this.onReturned) {
      this.onReturned();
    }
    return Promise.resolve({ done: true, value: undefined });
  }

  // ─── 变换管道 ───

  /** 映射变换 */
  map<U>(fn: (value: T) => U | Promise<U>): Stream<U> {
    const output = new Stream<U>();
    let errored = false;
    (async () => {
      try {
        for await (const item of this) {
          if (errored) break;
          output.push(await fn(item));
        }
      } catch (e) {
        if (!errored) {
          errored = true;
          output.error(e);
        }
        return;
      }
      if (!errored) output.end();
    })();
    return output;
  }

  /** 过滤 */
  filter(fn: (value: T) => boolean | Promise<boolean>): Stream<T> {
    const output = new Stream<T>();
    let errored = false;
    (async () => {
      try {
        for await (const item of this) {
          if (errored) break;
          if (await fn(item)) {
            output.push(item);
          }
        }
      } catch (e) {
        if (!errored) {
          errored = true;
          output.error(e);
        }
        return;
      }
      if (!errored) output.end();
    })();
    return output;
  }

  /** 扁平映射 */
  flatMap<U>(fn: (value: T) => AsyncIterable<U> | Iterable<U>): Stream<U> {
    const output = new Stream<U>();
    let errored = false;
    (async () => {
      try {
        for await (const item of this) {
          if (errored) break;
          for await (const sub of fn(item)) {
            if (errored) break;
            output.push(sub);
          }
        }
      } catch (e) {
        if (!errored) {
          errored = true;
          output.error(e);
        }
        return;
      }
      if (!errored) output.end();
    })();
    return output;
  }

  /** 去重（基于最近 N 个值） */
  distinct(bufferSize = 64): Stream<T> {
    const output = new Stream<T>();
    const seen = new Set<T>();
    let errored = false;
    (async () => {
      try {
        for await (const item of this) {
          if (errored) break;
          if (!seen.has(item)) {
            seen.add(item);
            output.push(item);
            // 防止内存无限增长
            if (seen.size > bufferSize) {
              const first = seen.values().next().value!;
              seen.delete(first);
            }
          }
        }
      } catch (e) {
        if (!errored) {
          errored = true;
          output.error(e);
        }
        return;
      }
      if (!errored) output.end();
    })();
    return output;
  }

  /** 节流：合并快速连续的值，按时间窗口批量发出 */
  batch(windowMs: number): Stream<T[]> {
    const output = new Stream<T[]>();
    let buffer: T[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let errored = false;

    const flush = () => {
      if (buffer.length > 0) {
        output.push(buffer);
        buffer = [];
      }
      timer = undefined;
    };

    (async () => {
      try {
        for await (const item of this) {
          if (errored) break;
          buffer.push(item);
          if (!timer) {
            timer = setTimeout(flush, windowMs);
          }
        }
        // 流结束后刷新剩余
        if (timer) clearTimeout(timer);
        if (buffer.length > 0) {
          output.push(buffer);
        }
      } catch (e) {
        if (timer) clearTimeout(timer);
        if (!errored) {
          errored = true;
          output.error(e);
        }
        return;
      }
      if (!errored) output.end();
    })();
    return output;
  }

  /** 带索引的映射 */
  enumerate(): Stream<[number, T]> {
    let index = 0;
    return this.map((value) => [index++, value]);
  }

  /** 累积为最终结果 */
  async collect(): Promise<T[]> {
    const results: T[] = [];
    for await (const item of this) {
      results.push(item);
    }
    return results;
  }

  /** 累积为单个字符串（T 必须是 string） */
  async collectString(): Promise<string> {
    const results: T[] = [];
    for await (const item of this) {
      results.push(item);
    }
    return results.join('');
  }

  /** 转换为回调驱动（用于 SSE 等事件源） */
  toSink(): { push: (v: T) => void; end: () => void; error: (e: unknown) => void } {
    return {
      push: (v: T) => this.push(v),
      end: () => this.end(),
      error: (e: unknown) => this.error(e),
    };
  }

  // ─── 静态工厂 ───

  /** 从可迭代对象创建流 */
  static from<U>(iterable: AsyncIterable<U> | Iterable<U>): Stream<U> {
    const stream = new Stream<U>();
    let errored = false;
    (async () => {
      try {
        for await (const item of iterable) {
          if (errored) break;
          stream.push(item);
        }
      } catch (e) {
        if (!errored) {
          errored = true;
          stream.error(e);
        }
        return;
      }
      if (!errored) stream.end();
    })();
    return stream;
  }

  /** 合并多个流 */
  static merge<U>(...streams: Stream<U>[]): Stream<U> {
    const output = new Stream<U>();
    let remaining = streams.length;
    let errored = false;

    for (const stream of streams) {
      (async () => {
        try {
          for await (const item of stream) {
            if (errored) break;
            output.push(item);
          }
        } catch (e) {
          if (!errored) {
            errored = true;
            output.error(e);
          }
          return;
        }
        remaining--;
        if (remaining === 0 && !errored) {
          output.end();
        }
      })();
    }

    return output;
  }
}
