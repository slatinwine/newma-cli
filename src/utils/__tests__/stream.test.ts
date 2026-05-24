// src/utils/__tests__/stream.test.ts
/**
 * Stream 泛型类单元测试
 * 测试 Stream<T>、StreamPipelineBuilder 和 JsonStreamGuard
 */

import { Stream } from '../stream';
import {
  StreamPipelineBuilder,
  pipeline,
  from,
} from '../streamTransform';
import {
  JsonStreamGuard,
  guardJsonStream,
  guardJsonArrayStream,
  guardJsonLinesStream,
  jsonToTextStream,
  jsonToLinesStream,
  collectJsonChunks,
  collectSingleJson,
} from '../streamJsonGuard';

// ─── Stream 基础测试 ───

describe('Stream 基础功能', () => {
  test('push 和 end 应该正确工作', async () => {
    const stream = new Stream<number>();
    stream.push(1);
    stream.push(2);
    stream.push(3);
    stream.end();

    const results = await stream.collect();
    expect(results).toEqual([1, 2, 3]);
  });

  test('应该支持异步迭代', async () => {
    const stream = new Stream<string>();
    stream.push('a');
    stream.push('b');
    stream.end();

    const results: string[] = [];
    for await (const item of stream) {
      results.push(item);
    }
    expect(results).toEqual(['a', 'b']);
  });

  test('应该支持错误传播', async () => {
    const stream = new Stream<number>();
    stream.error(new Error('测试错误'));

    await expect(stream.collect()).rejects.toThrow('测试错误');
  });

  test('应该只能迭代一次', () => {
    const stream = new Stream<number>();
    stream.push(1);
    stream.end();

    // 第一次迭代应该成功
    expect(async () => {
      for await (const _ of stream) {
        break;
      }
    }).not.toThrow();

    // 第二次迭代应该抛出错误
    expect(async () => {
      for await (const _ of stream) {
        // 不会执行到这里
      }
    }).rejects.toThrow('Stream can only be iterated once');
  });

  test('collectString 应该正确工作', async () => {
    const stream = new Stream<string>();
    stream.push('hello');
    stream.push(' ');
    stream.push('world');
    stream.end();

    const text = await stream.collectString();
    expect(text).toBe('hello world');
  });
});

// ─── Stream 变换测试 ───

describe('Stream 变换操作', () => {
  test('map 应该正确映射值', async () => {
    const stream = Stream.from([1, 2, 3]);
    const mapped = stream.map((x) => x * 2);

    const results = await mapped.collect();
    expect(results).toEqual([2, 4, 6]);
  });

  test('filter 应该正确过滤值', async () => {
    const stream = Stream.from([1, 2, 3, 4, 5]);
    const filtered = stream.filter((x) => x % 2 === 0);

    const results = await filtered.collect();
    expect(results).toEqual([2, 4]);
  });

  test('flatMap 应该正确扁平化', async () => {
    const stream = Stream.from([[1, 2], [3, 4], [5]]);
    const flatMapped = stream.flatMap((x) => x);

    const results = await flatMapped.collect();
    expect(results).toEqual([1, 2, 3, 4, 5]);
  });

  test('distinct 应该去重', async () => {
    const stream = Stream.from([1, 2, 2, 3, 3, 3, 4]);
    const distinct = stream.distinct();

    const results = await distinct.collect();
    expect(results).toEqual([1, 2, 3, 4]);
  });

  test('batch 应该按时间窗口批量发出', async () => {
    const stream = new Stream<number>();
    const batched = stream.batch(50); // 50ms 窗口

    // 快速推入多个值
    stream.push(1);
    stream.push(2);
    stream.push(3);
    stream.push(4);
    stream.push(5);
    stream.end();

    const results = await batched.collect();
    // 由于推入很快，应该在同一个批次中
    expect(results.length).toBeGreaterThan(0);
    expect(results.flat()).toEqual([1, 2, 3, 4, 5]);
  }, 10000);

  test('enumerate 应该添加索引', async () => {
    const stream = Stream.from(['a', 'b', 'c']);
    const enumerated = stream.enumerate();

    const results = await enumerated.collect();
    expect(results).toEqual([
      [0, 'a'],
      [1, 'b'],
      [2, 'c'],
    ]);
  });

  test('merge 应该合并多个流', async () => {
    const stream1 = Stream.from([1, 2, 3]);
    const stream2 = Stream.from([4, 5, 6]);
    const merged = Stream.merge(stream1, stream2);

    const results = await merged.collect();
    expect(results).toHaveLength(6);
    expect(new Set(results)).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  test('from 应该从可迭代对象创建流', async () => {
    const stream = Stream.from([1, 2, 3]);
    const results = await stream.collect();
    expect(results).toEqual([1, 2, 3]);
  });

  test('from 应该从异步可迭代对象创建流', async () => {
    async function* gen(): AsyncIterable<number> {
      yield 1;
      yield 2;
      yield 3;
    }

    const stream = Stream.from(gen());
    const results = await stream.collect();
    expect(results).toEqual([1, 2, 3]);
  });
});

// ─── StreamPipelineBuilder 测试 ───

describe('StreamPipelineBuilder 链式变换', () => {
  test('应该支持链式 map 和 filter', async () => {
    const source = Stream.from([1, 2, 3, 4, 5]);
    const result = await from(source)
      .map((x) => x * 2)
      .filter((x) => x > 5)
      .collect();

    expect(result).toEqual([6, 8, 10]);
  });

  test('buffer 应该按数量批量发出', async () => {
    const source = Stream.from([1, 2, 3, 4, 5, 6, 7]);
    const result = await from(source)
      .buffer(3)
      .collect();

    expect(result).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7],
    ]);
  });

  test('bufferTime 应该按时间窗口批量发出', async () => {
    const stream = new Stream<number>();
    const batchedPromise = from(stream)
      .bufferTime(50)
      .collect();

    // 推入数据
    stream.push(1);
    stream.push(2);
    await new Promise((resolve) => setTimeout(resolve, 30));
    stream.push(3);
    stream.push(4);
    await new Promise((resolve) => setTimeout(resolve, 30));
    stream.push(5);
    stream.end();

    const result = await batchedPromise;
    expect(result.length).toBeGreaterThan(0);
    expect(result.flat()).toEqual([1, 2, 3, 4, 5]);
  }, 10000);

  test('take 应该只取前 N 个值', async () => {
    const source = Stream.from([1, 2, 3, 4, 5]);
    const result = await from(source)
      .take(3)
      .collect();

    expect(result).toEqual([1, 2, 3]);
  });

  test('skip 应该跳过前 N 个值', async () => {
    const source = Stream.from([1, 2, 3, 4, 5]);
    const result = await from(source)
      .skip(2)
      .collect();

    expect(result).toEqual([3, 4, 5]);
  });

  test('concat 应该连接两个流', async () => {
    const source1 = Stream.from([1, 2, 3]);
    const source2 = Stream.from([4, 5, 6]);
    const result = await from(source1)
      .concat(source2)
      .collect();

    expect(result).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test('scan 应该累积状态', async () => {
    const source = Stream.from([1, 2, 3, 4, 5]);
    const result = await from(source)
      .scan(0, (acc, x) => acc + x)
      .collect();

    expect(result).toEqual([0, 1, 3, 6, 10, 15]);
  });

  test('tap 应该执行副作用但不改变流', async () => {
    const source = Stream.from([1, 2, 3]);
    const effects: number[] = [];
    const result = await from(source)
      .tap((x) => {
        effects.push(x);
      })
      .map((x) => x * 2)
      .collect();

    expect(result).toEqual([2, 4, 6]);
    expect(effects).toEqual([1, 2, 3]);
  });

  test('reduce 应该归约为单个值', async () => {
    const source = Stream.from([1, 2, 3, 4, 5]);
    const result = await from(source).reduce(0, (acc, x) => acc + x);

    expect(result).toBe(15);
  });

  test('count 应该计数', async () => {
    const source = Stream.from([1, 2, 3, 4, 5]);
    const result = await from(source).count();

    expect(result).toBe(5);
  });

  test('every 应该检查所有值是否满足条件', async () => {
    const source1 = Stream.from([2, 4, 6, 8]);
    const result1 = await from(source1).every((x) => x % 2 === 0);
    expect(result1).toBe(true);

    const source2 = Stream.from([2, 4, 5, 8]);
    const result2 = await from(source2).every((x) => x % 2 === 0);
    expect(result2).toBe(false);
  });

  test('some 应该检查是否有任意值满足条件', async () => {
    const source1 = Stream.from([1, 3, 5, 7]);
    const result1 = await from(source1).some((x) => x % 2 === 0);
    expect(result1).toBe(false);

    const source2 = Stream.from([1, 2, 3, 5]);
    const result2 = await from(source2).some((x) => x % 2 === 0);
    expect(result2).toBe(true);
  });

  test('find 应该查找第一个满足条件的值', async () => {
    const source = Stream.from([1, 2, 3, 4, 5]);
    const result = await from(source).find((x) => x > 3);

    expect(result).toBe(4);
  });

  test('first 应该获取第一个值', async () => {
    const source = Stream.from([1, 2, 3, 4, 5]);
    const result = await from(source).first();

    expect(result).toBe(1);
  });

  test('last 应该获取最后一个值', async () => {
    const source = Stream.from([1, 2, 3, 4, 5]);
    const result = await from(source).last();

    expect(result).toBe(5);
  });

  test('toStream 应该转换回 Stream', async () => {
    const source = Stream.from([1, 2, 3]);
    const stream = from(source)
      .map((x) => x * 2)
      .toStream();

    const result = await stream.collect();
    expect(result).toEqual([2, 4, 6]);
  });

  test('pipeline 函数应该创建管道', async () => {
    const source = Stream.from([1, 2, 3, 4, 5]);
    const result = await pipeline(source)
      .map((x) => x * 2)
      .filter((x) => x > 5)
      .collect();

    expect(result).toEqual([6, 8, 10]);
  });
});

// ─── JsonStreamGuard 测试 ───

describe('JsonStreamGuard JSON 守卫', () => {
  test('process 应该正确处理完整的 JSON', () => {
    const guard = new JsonStreamGuard();
    const results = guard.process('{"name":"test"}');

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('complete');
    expect(results[0].data).toEqual({ name: 'test' });
  });

  test('process 应该正确处理多个 JSON 对象', () => {
    const guard = new JsonStreamGuard();
    const chunk1 = guard.process('{"name":"test1"}{"name":"test2"}');

    expect(chunk1).toHaveLength(2);
    expect(chunk1[0].data).toEqual({ name: 'test1' });
    expect(chunk1[1].data).toEqual({ name: 'test2' });
  });

  test('process 应该正确处理分块的 JSON', () => {
    const guard = new JsonStreamGuard();
    const chunk1 = guard.process('{"name":');
    expect(chunk1).toHaveLength(0);

    const chunk2 = guard.process('"test"}');
    expect(chunk2).toHaveLength(1);
    expect(chunk2[0].status).toBe('complete');
    expect(chunk2[0].data).toEqual({ name: 'test' });
  });

  test('process 应该正确处理嵌套的 JSON', () => {
    const guard = new JsonStreamGuard();
    const results = guard.process('{"user":{"name":"test","age":30}}');

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('complete');
    expect(results[0].data).toEqual({
      user: { name: 'test', age: 30 },
    });
  });

  test('process 应该正确处理 JSON 数组', () => {
    const guard = new JsonStreamGuard();
    const results = guard.process('[1,2,3,4,5]');

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('complete');
    expect(results[0].data).toEqual([1, 2, 3, 4, 5]);
  });

  test('finalize 应该处理剩余的部分 JSON', () => {
    const guard = new JsonStreamGuard();
    guard.process('{"name":');

    const final = guard.finalize();
    expect(final).not.toBeNull();
    expect(final?.status).toBe('partial');
  });

  test('reset 应该重置守卫状态', () => {
    const guard = new JsonStreamGuard();
    guard.process('{"name":');
    guard.reset();

    const results = guard.process('{"name":"test"}');
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('complete');
  });
});

describe('JSON 流包装器', () => {
  test('guardJsonStream 应该转换文本流为 JSON 块流', async () => {
    const textStream = Stream.from(['{"name":"test1"}', '{"name":"test2"}']);
    const jsonStream = guardJsonStream(textStream);

    const results = await jsonStream.collect();
    expect(results).toHaveLength(2);
    expect(results[0].data).toEqual({ name: 'test1' });
    expect(results[1].data).toEqual({ name: 'test2' });
  });

  test('guardJsonArrayStream 应该解析数组元素', async () => {
    const textStream = Stream.from(['[1,2,3]']);
    const jsonStream = guardJsonArrayStream<number>(textStream);

    const results = await jsonStream.collect();
    expect(results).toEqual([1, 2, 3]);
  });

  test('guardJsonLinesStream 应该解析 NDJSON', async () => {
    const textStream = Stream.from(['{"a":1}\n{"b":2}\n{"c":3}\n']);
    const jsonStream = guardJsonLinesStream<Record<string, number>>(textStream);

    const results = await jsonStream.collect();
    expect(results).toEqual([
      { a: 1 },
      { b: 2 },
      { c: 3 },
    ]);
  });

  test('jsonToTextStream 应该转换 JSON 对象流为文本流', async () => {
    const jsonStream = Stream.from([{ name: 'test1' }, { name: 'test2' }]);
    const textStream = jsonToTextStream(jsonStream, false);

    const results = await textStream.collect();
    expect(results).toEqual(['{"name":"test1"}', '{"name":"test2"}']);
  });

  test('jsonToTextStream 应该支持格式化输出', async () => {
    const jsonStream = Stream.from([{ name: 'test' }]);
    const textStream = jsonToTextStream(jsonStream, true);

    const results = await textStream.collect();
    expect(results[0]).toContain('{\n  "name": "test"\n}');
  });

  test('jsonToLinesStream 应该转换 JSON 对象流为 JSON Lines', async () => {
    const jsonStream = Stream.from([{ a: 1 }, { b: 2 }, { c: 3 }]);
    const textStream = jsonToLinesStream(jsonStream);

    const results = await textStream.collect();
    expect(results).toEqual(['{"a":1}\n', '{"b":2}\n', '{"c":3}\n']);
  });

  test('collectJsonChunks 应该收集 JSON 块为对象数组', async () => {
    const chunkStream = Stream.from([
      { text: '{"a":1}', status: 'complete', data: { a: 1 } },
      { text: '{"b":2}', status: 'complete', data: { b: 2 } },
      { text: '{"c":3}', status: 'complete', data: { c: 3 } },
    ] as const);

    const results = await collectJsonChunks(chunkStream);
    expect(results).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
  });

  test('collectSingleJson 应该收集单个 JSON 对象', async () => {
    const chunkStream = Stream.from([
      { text: '{"name":"test"}', status: 'complete', data: { name: 'test' } },
    ] as const);

    const result = await collectSingleJson(chunkStream);
    expect(result).toEqual({ name: 'test' });
  });

  test('collectSingleJson 应该在流为空时返回 undefined', async () => {
    const chunkStream = Stream.from([]);
    const result = await collectSingleJson(chunkStream);
    expect(result).toBeUndefined();
  });
});

// ─── 复杂场景测试 ───

describe('复杂流式场景', () => {
  test('应该支持复杂的链式变换', async () => {
    const source = Stream.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const result = await from(source)
      .map((x) => x * 2)
      .filter((x) => x > 5)
      .take(5)
      .map((x) => x + 1)
      .collect();

    // map(x*2) -> [2,4,6,8,10,12,14,16,18,20]
    // filter(x>5) -> [6,8,10,12,14,16,18,20]
    // take(5) -> [6,8,10,12,14]
    // map(x+1) -> [7,9,11,13,15]
    expect(result).toEqual([7, 9, 11, 13, 15]);
  });

  test('应该支持背压（大量数据）', async () => {
    const stream = new Stream<number>();
    const resultPromise = from(stream)
      .map((x) => x * 2)
      .filter((x) => x % 3 === 0)
      .collect();

    // 快速推入大量数据
    for (let i = 0; i < 10000; i++) {
      stream.push(i);
    }
    stream.end();

    const result = await resultPromise;
    expect(result.length).toBeGreaterThan(0);
  });

  test('应该正确处理错误传播', async () => {
    const source = Stream.from([1, 2, 3, 4, 5]);
    const resultPromise = from(source)
      .map((x) => {
        if (x === 3) throw new Error('测试错误');
        return x * 2;
      })
      .collect();

    await expect(resultPromise).rejects.toThrow('测试错误');
  });

  test('应该支持 merge 和 concat 组合', async () => {
    const source1 = Stream.from([1, 2, 3]);
    const source2 = Stream.from([4, 5, 6]);
    const source3 = Stream.from([7, 8, 9]);

    const result = await from(source1)
      .concat(source2)
      .concat(source3)
      .collect();

    expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test('应该支持 scan 和 collect 组合', async () => {
    const source1 = Stream.from([1, 2, 3, 4, 5]);
    const runningSum = await from(source1)
      .scan(0, (acc, x) => acc + x)
      .collect();

    expect(runningSum).toEqual([0, 1, 3, 6, 10, 15]);

    const source2 = Stream.from([1, 2, 3, 4, 5]);
    const finalSum = await from(source2).reduce(0, (acc, x) => acc + x);
    expect(finalSum).toBe(15);
  });
});
