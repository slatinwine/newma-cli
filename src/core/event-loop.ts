/**
 * Newma Core Event Loop
 *
 * 事件循环 - 核心调度器
 * 基于 π (pi-mono) 的 agent-loop 设计
 */

import {
  CoreEvent,
  CoreEventType,
  LoopState,
  AgentContext,
  ExecutorResult,
  ExecutorContext,
} from './types';
import { EventStream, createTerminalEventStream } from './event-stream';
import { generateEventId, createErrorEvent, createStateChangeEvent } from './event';
import { EventEmitter } from 'events';

// ============================================================================
// 事件处理器类型
// ============================================================================

/**
 * 事件处理器
 */
export type EventHandler<TEvent extends CoreEvent = CoreEvent> = (
  event: TEvent,
  context: LoopContext
) => Promise<ExecutorResult | void>;

/**
 * 事件中间件
 */
export type EventMiddleware = (
  event: CoreEvent,
  context: LoopContext,
  next: (event: CoreEvent) => Promise<ExecutorResult | void>
) => Promise<ExecutorResult | void>;

// ============================================================================
// 循环上下文
// ============================================================================

/**
 * 循环上下文
 */
export interface LoopContext {
  /** 当前状态 */
  state: LoopState;
  /** Agent 上下文 */
  agentContext: AgentContext;
  /** 已处理的事件 */
  processedEvents: CoreEvent[];
  /** Steering 队列 */
  steeringQueue: CoreEvent[];
  /** Follow-up 队列 */
  followUpQueue: CoreEvent[];
  /** 循环计数 */
  iteration: number;
  /** 最大迭代次数 */
  maxIterations: number;
  /** 中断信号 */
  signal?: AbortSignal;
  /** 用户数据 */
  userData?: Record<string, unknown>;
}

/**
 * 创建默认循环上下文
 */
export function createLoopContext(
  agentContext: AgentContext,
  options?: {
    maxIterations?: number;
    signal?: AbortSignal;
  }
): LoopContext {
  return {
    state: LoopState.IDLE,
    agentContext,
    processedEvents: [],
    steeringQueue: [],
    followUpQueue: [],
    iteration: 0,
    maxIterations: options?.maxIterations ?? 10,
    signal: options?.signal,
  };
}

// ============================================================================
// 事件循环类
// ============================================================================

/**
 * 事件循环配置
 */
export interface EventLoopConfig {
  /** 是否启用调试日志 */
  debug?: boolean;
  /** 最大事件队列长度 */
  maxQueueLength?: number;
  /** 事件处理超时（毫秒） */
  timeout?: number;
}

/**
 * 事件循环
 */
export class EventLoop {
  private eventQueue: CoreEvent[] = [];
  private handlers: Map<CoreEventType, Set<EventHandler>> = new Map();
  private middlewares: EventMiddleware[] = [];
  private context: LoopContext;
  private emitter = new EventEmitter();
  private running = false;
  private paused = false;
  private abortController?: AbortController;
  private config: EventLoopConfig;

  constructor(
    agentContext: AgentContext,
    config: EventLoopConfig = {}
  ) {
    this.context = createLoopContext(agentContext);
    this.config = {
      debug: false,
      maxQueueLength: 1000,
      timeout: 300000, // 5 分钟
      ...config,
    };
  }

  // ============================================================================
  // 事件推送
  // ============================================================================

  /**
   * 推送事件到队列
   */
  push(event: CoreEvent): void {
    if (this.eventQueue.length >= (this.config.maxQueueLength || 1000)) {
      this.log('Event queue is full, dropping oldest event');
      this.eventQueue.shift();
    }
    this.eventQueue.push(event);
    this.emitter.emit('queued', event);
  }

  /**
   * 批量推送事件
   */
  pushAll(events: CoreEvent[]): void {
    for (const event of events) {
      this.push(event);
    }
  }

  /**
   * 推送 Steering 事件（高优先级）
   */
  steer(event: CoreEvent): void {
    this.context.steeringQueue.push(event);
    this.emitter.emit('steer', event);
  }

  /**
   * 推送 Follow-up 事件（低优先级）
   */
  followUp(event: CoreEvent): void {
    this.context.followUpQueue.push(event);
    this.emitter.emit('follow-up', event);
  }

  // ============================================================================
  // 处理器注册
  // ============================================================================

  /**
   * 注册事件处理器
   */
  on<E extends CoreEvent>(
    eventType: CoreEventType,
    handler: EventHandler<E>
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as EventHandler);

    return () => {
      this.handlers.get(eventType)?.delete(handler as EventHandler);
    };
  }

  /**
   * 注册一次性处理器
   */
  once<E extends CoreEvent>(
    eventType: CoreEventType,
    handler: EventHandler<E>
  ): void {
    const wrappedHandler: EventHandler<E> = async (event, context) => {
      this.off(eventType, wrappedHandler as EventHandler);
      return handler(event, context);
    };
    this.on(eventType, wrappedHandler);
  }

  /**
   * 移除处理器
   */
  off(eventType: CoreEventType, handler: EventHandler): void {
    this.handlers.get(eventType)?.delete(handler);
  }

  /**
   * 使用中间件
   */
  use(middleware: EventMiddleware): void {
    this.middlewares.push(middleware);
  }

  // ============================================================================
  // 循环控制
  // ============================================================================

  /**
   * 启动事件循环
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Event loop is already running');
    }

    this.running = true;
    this.abortController = new AbortController();
    this.context.signal = this.abortController.signal;

    this.log('Event loop started');
    this.emitter.emit('start');

    try {
      await this.runLoop();
    } finally {
      this.running = false;
      this.emitter.emit('stop');
    }
  }

  /**
   * 停止事件循环
   */
  stop(): void {
    this.running = false;
    this.abortController?.abort();
    this.log('Event loop stopped');
  }

  /**
   * 暂停事件循环
   */
  pause(): void {
    this.paused = true;
    this.log('Event loop paused');
  }

  /**
   * 恢复事件循环
   */
  resume(): void {
    this.paused = false;
    this.log('Event loop resumed');
  }

  /**
   * 中断当前执行
   */
  abort(): void {
    this.abortController?.abort();
    this.push(createErrorEvent(new Error('Aborted by user'), false));
  }

  // ============================================================================
  // 内部实现
  // ============================================================================

  /**
   * 主循环
   */
  private async runLoop(): Promise<void> {
    while (this.running) {
      // 检查暂停
      if (this.paused) {
        await this.sleep(100);
        continue;
      }

      // 检查中断
      if (this.context.signal?.aborted) {
        this.log('Event loop aborted');
        break;
      }

      // 优先处理 Steering 事件
      if (this.context.steeringQueue.length > 0) {
        const event = this.context.steeringQueue.shift()!;
        await this.processEvent(event);
        continue;
      }

      // 处理普通事件队列
      if (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;
        await this.processEvent(event);
        continue;
      }

      // 处理 Follow-up 事件
      if (this.context.followUpQueue.length > 0) {
        const event = this.context.followUpQueue.shift()!;
        await this.processEvent(event);
        continue;
      }

      // 无事件，等待
      await this.sleep(50);
    }
  }

  /**
   * 处理单个事件
   */
  private async processEvent(event: CoreEvent): Promise<void> {
    this.log(`Processing event: ${event.type}`);
    this.context.processedEvents.push(event);
    this.emitter.emit('process', event);

    try {
      // 应用中间件
      let result: ExecutorResult | void;
      if (this.middlewares.length > 0) {
        result = await this.applyMiddlewares(event);
      } else {
        result = await this.executeHandlers(event);
      }

      // 处理结果
      if (result && result.nextEvents) {
        this.pushAll(result.nextEvents);
      }

      this.emitter.emit('processed', event, result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.log(`Error processing event ${event.type}:`, err.message);
      this.emitter.emit('error', err, event);

      // 推送错误事件
      this.push(createErrorEvent(err, true, { originalEvent: event }));
    }
  }

  /**
   * 应用中间件链
   */
  private async applyMiddlewares(event: CoreEvent): Promise<ExecutorResult | void> {
    let index = 0;

    const next = async (evt: CoreEvent): Promise<ExecutorResult | void> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        return middleware(evt, this.context, next);
      }
      return this.executeHandlers(evt);
    };

    return next(event);
  }

  /**
   * 执行事件处理器
   */
  private async executeHandlers(event: CoreEvent): Promise<ExecutorResult | void> {
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.size === 0) {
      this.log(`No handlers for event type: ${event.type}`);
      return;
    }

    let lastResult: ExecutorResult | void = undefined;
    // 使用 Array.from 避免迭代器问题
    const handlerList = Array.from(handlers);
    for (const handler of handlerList) {
      lastResult = await handler(event, this.context);
    }
    return lastResult;
  }

  // ============================================================================
  // 状态管理
  // ============================================================================

  /**
   * 获取当前状态
   */
  getState(): LoopState {
    return this.context.state;
  }

  /**
   * 设置状态
   */
  setState(newState: LoopState, trigger: string = 'manual'): void {
    const previousState = this.context.state;
    if (previousState === newState) return;

    this.context.state = newState;
    this.push(createStateChangeEvent(previousState, newState, trigger));
    this.emitter.emit('state-change', previousState, newState);
  }

  /**
   * 获取上下文
   */
  getContext(): LoopContext {
    return this.context;
  }

  // ============================================================================
  // 事件订阅
  // ============================================================================

  /**
   * 订阅事件
   */
  subscribe(event: 'process' | 'processed' | 'error' | 'state-change' | 'start' | 'stop', listener: (...args: any[]) => void): () => void {
    this.emitter.on(event, listener);
    return () => this.emitter.off(event, listener);
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[EventLoop]', ...args);
    }
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建事件循环
 */
export function createEventLoop(
  agentContext: AgentContext,
  config?: EventLoopConfig
): EventLoop {
  return new EventLoop(agentContext, config);
}

/**
 * 创建事件流并绑定到事件循环
 */
export function createBoundEventStream(
  loop: EventLoop,
  isTerminal?: (event: CoreEvent) => boolean
): EventStream<CoreEvent, CoreEvent[]> {
  const stream = createTerminalEventStream<CoreEvent>(
    isTerminal ?? ((e) => e.type === CoreEventType.LOOP_END)
  );

  loop.subscribe('process', (event) => stream.push(event));

  return stream;
}
