/**
 * Newma Core Event Stream
 *
 * 事件流 - 用于订阅和消费事件
 * 参考 pi-mono 的 EventStream 设计
 */

import { CoreEvent } from './types';
import { EventEmitter } from 'events';

// ============================================================================
// 事件流接口
// ============================================================================

/**
 * 事件订阅器
 */
export type EventSubscriber<E = CoreEvent> = (event: E) => void;

/**
 * 事件流结束器
 */
export type EventFinalizer<TEvent = CoreEvent, TResult = unknown> = (events: TEvent[]) => TResult;

// ============================================================================
// 事件流类
// ============================================================================

/**
 * 事件流 - 同步事件分发
 */
export class EventStream<TEvent = CoreEvent, TResult = void> {
  private events: TEvent[] = [];
  private subscribers: Set<EventSubscriber<TEvent>> = new Set();
  private completed = false;
  private result?: TResult;
  private emitter = new EventEmitter();

  constructor(
    private isTerminal: (event: TEvent) => boolean,
    private finalizer: EventFinalizer<TEvent, TResult>
  ) {}

  /**
   * 推送事件
   */
  push(event: TEvent): void {
    if (this.completed) {
      throw new Error('EventStream is already completed');
    }

    this.events.push(event);

    // 通知所有订阅者（使用 Array.from 避免迭代器问题）
    const subscriberList = Array.from(this.subscribers);
    for (const subscriber of subscriberList) {
      try {
        subscriber(event);
      } catch (error) {
        console.error('Event subscriber error:', error);
      }
    }

    // 发送事件
    this.emitter.emit('event', event);

    // 检查是否是终止事件
    if (this.isTerminal(event)) {
      this.complete();
    }
  }

  /**
   * 订阅事件
   */
  subscribe(subscriber: EventSubscriber<TEvent>): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  /**
   * 监听事件（一次性）
   */
  once(listener: EventSubscriber<TEvent>): void {
    this.emitter.once('event', listener);
  }

  /**
   * 完成事件流
   */
  complete(): void {
    if (this.completed) return;
    this.completed = true;
    this.result = this.finalizer(this.events);
    this.emitter.emit('complete', this.result);
  }

  /**
   * 获取结果
   */
  getResult(): TResult | undefined {
    return this.result;
  }

  /**
   * 是否已完成
   */
  isCompleted(): boolean {
    return this.completed;
  }

  /**
   * 获取所有事件
   */
  getEvents(): TEvent[] {
    return [...this.events];
  }

  /**
   * 等待完成
   */
  async wait(): Promise<TResult> {
    if (this.completed) {
      return this.result!;
    }

    return new Promise((resolve) => {
      this.emitter.once('complete', resolve);
    });
  }

  /**
   * 转换为异步迭代器
   */
  async *[Symbol.asyncIterator](): AsyncIterableIterator<TEvent> {
    const queue: TEvent[] = [];
    let resolveNext: ((value: IteratorResult<TEvent>) => void) | null = null;

    const subscriber = (event: TEvent) => {
      if (resolveNext) {
        resolveNext({ value: event, done: false });
        resolveNext = null;
      } else {
        queue.push(event);
      }
    };

    this.subscribe(subscriber);

    try {
      while (!this.completed || queue.length > 0) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else {
          yield new Promise<TEvent>((resolve) => {
            resolveNext = (result) => {
              if (result.done) {
                // 流结束
              } else {
                resolve(result.value);
              }
            };
          });
        }
      }
    } finally {
      this.subscribers.delete(subscriber);
    }
  }
}

// ============================================================================
// 事件流工具函数
// ============================================================================

/**
 * 创建简单事件流
 */
export function createEventStream<TEvent = CoreEvent>(): EventStream<TEvent, TEvent[]> {
  return new EventStream<TEvent, TEvent[]>(
    () => false, // 不自动终止
    (events) => events
  );
}

/**
 * 创建终端事件流
 */
export function createTerminalEventStream<TEvent = CoreEvent>(
  isTerminal: (event: TEvent) => boolean
): EventStream<TEvent, TEvent[]> {
  return new EventStream<TEvent, TEvent[]>(isTerminal, (events) => events);
}

/**
 * 合并事件流
 */
export function mergeEventStreams<TEvent = CoreEvent>(
  ...streams: EventStream<TEvent, unknown>[]
): EventStream<TEvent, TEvent[]> {
  const merged = createEventStream<TEvent>();

  for (const stream of streams) {
    stream.subscribe((event) => merged.push(event));
  }

  return merged;
}
