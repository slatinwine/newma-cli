/**
 * TriggerRouter — 事件两级过滤 + Thread 订阅直通（文章 3.1 / 3.2 节）
 *
 * 问题：接入真实事件源后，事件流「高噪音、低触发率」。
 * 对每条事件都调 LLM 判断，延迟和成本都不可承受；
 * 而已归属任务的后续事件若都经 Router 转发，Router 会成为瓶颈。
 *
 * 方案（Fast Path / Slow Path + 订阅直通）：
 * 1. 程序层 Fast Path：确定性规则（来源白名单、路径匹配、噪音滤除）先筛掉大部分
 * 2. 语义层 Slow Path：候选事件交给注入的 LLM judge 判断是否行动
 * 3. Thread 登记：事件按 threadKey 归入事件流；已被 Worker 订阅的 Thread，
 *    后续事件【直通】该 Worker，不再请求 Router 决策
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import {
  TriggerEvent,
  TriggerSourceKind,
  TriggerVerdict,
  ProgramRule,
  SemanticJudge,
  Thread,
} from './types';

// ============================================================================
// Types
// ============================================================================

export interface TriggerRouterConfig {
  /** Thread 内保留的 Trigger ID 数量上限（环形） */
  maxTriggersPerThread?: number;
  /** 判定为 act 时是否自动登记 Thread（默认 true） */
  autoCreateThreadOnAct?: boolean;
  /** 调试日志 */
  debug?: boolean;
}

/** 路由结果 */
export interface RouteResult {
  verdict: TriggerVerdict;
  /** 由谁判定：program（Fast Path）| semantic（Slow Path）| passthrough（订阅直通） */
  decidedBy: 'program' | 'semantic' | 'passthrough';
  /** 命中的规则 ID（program 判定时） */
  ruleId?: string;
  /** 直通目标 Worker（订阅直通时） */
  directWorkerIds?: string[];
  /** 事件归入的 Thread key */
  threadKey?: string;
  /** 事件 ID（链式召回入口） */
  triggerId: string;
  /** 命中的 Thread 是否为已存在（用于区分新/旧任务） */
  threadExisted: boolean;
}

// ============================================================================
// Router
// ============================================================================

export class TriggerRouter extends EventEmitter {
  private rules: ProgramRule[] = [];
  private threads = new Map<string, Thread>();
  private readonly maxTriggersPerThread: number;
  private readonly autoCreateThreadOnAct: boolean;
  private readonly debug: boolean;

  constructor(
    private readonly semanticJudge?: SemanticJudge,
    config: TriggerRouterConfig = {}
  ) {
    super();
    this.maxTriggersPerThread = config.maxTriggersPerThread ?? 64;
    this.autoCreateThreadOnAct = config.autoCreateThreadOnAct ?? true;
    this.debug = config.debug ?? false;
  }

  // ------------------------------------------------------------------
  // 规则管理（程序层 Fast Path）
  // ------------------------------------------------------------------

  /** 添加程序层规则。规则按添加顺序匹配，先命中先赢。 */
  addRule(rule: ProgramRule): void {
    this.rules.push(rule);
  }

  /** 快捷方式：来源白名单规则 */
  allowSource(kinds: TriggerSourceKind[], verdict: TriggerVerdict = 'candidate', note?: string): void {
    this.addRule({
      ruleId: `allow-source-${kinds.join('+')}`,
      match: (t) => kinds.includes(t.source),
      verdict,
      note,
    });
  }

  /** 快捷方式：噪音路径滤除（如 node_modules、.git、dist） */
  ignorePathPatterns(patterns: RegExp[], note = 'noise path'): void {
    this.addRule({
      ruleId: `ignore-path-${patterns.length}`,
      match: (t) => patterns.some((p) => p.test(t.origin)),
      verdict: 'ignore',
      note,
    });
  }

  // ------------------------------------------------------------------
  // Thread 与订阅
  // ------------------------------------------------------------------

  getThread(key: string): Thread | undefined {
    return this.threads.get(key);
  }

  /** Worker 订阅某个 Thread：之后该 Thread 的所有事件直通该 Worker。 */
  subscribe(threadKey: string, workerId: string): void {
    const thread = this.threads.get(threadKey) ?? this.createThread(threadKey);
    thread.subscriberWorkerIds.add(workerId);
  }

  /** Worker 取消订阅（任务完成或事件超出任务范围时）。 */
  unsubscribe(threadKey: string, workerId: string): void {
    const thread = this.threads.get(threadKey);
    if (!thread) return;
    thread.subscriberWorkerIds.delete(workerId);
    // 空的 Thread 保留（链式召回仍需要历史 Trigger ID），不删除
  }

  /** 生成一个 Thread key 的快捷方式：同一路径/来源的连续事件归同一条流。 */
  static defaultThreadKey(trigger: TriggerEvent): string {
    return trigger.threadKey ?? `${trigger.source}:${trigger.origin}`;
  }

  // ------------------------------------------------------------------
  // 核心路由
  // ------------------------------------------------------------------

  /**
   * 路由一条 Trigger。判定顺序：
   * 1. 已有订阅者的 Thread → 直通（passthrough），零 LLM 开销
   * 2. 程序层规则（Fast Path）
   * 3. 语义层 judge（Slow Path）
   */
  async route(trigger: TriggerEvent): Promise<RouteResult> {
    const triggerId = trigger.id || `trg-${randomUUID().slice(0, 8)}`;
    const threadKey = TriggerRouter.defaultThreadKey(trigger);
    const existedThread = this.threads.get(threadKey);
    const threadExisted = !!existedThread;

    // 1. 订阅直通（Fast Path 中的 Fast Path）
    if (existedThread && existedThread.subscriberWorkerIds.size > 0) {
      this.recordTrigger(threadKey, triggerId);
      this.debugLog(`passthrough ${triggerId} -> ${[...existedThread.subscriberWorkerIds].join(',')}`);
      return {
        verdict: 'act',
        decidedBy: 'passthrough',
        directWorkerIds: [...existedThread.subscriberWorkerIds],
        threadKey,
        triggerId,
        threadExisted,
      };
    }

    // 2. 程序层 Fast Path
    for (const rule of this.rules) {
      if (rule.match(trigger)) {
        this.debugLog(`program rule ${rule.ruleId} -> ${rule.verdict}`);
        return this.finalize(trigger, triggerId, threadKey, threadExisted, rule.verdict, 'program', rule.ruleId);
      }
    }

    // 3. 语义层 Slow Path
    if (this.semanticJudge) {
      try {
        const verdict = await this.semanticJudge(trigger);
        this.debugLog(`semantic -> ${verdict}`);
        return this.finalize(trigger, triggerId, threadKey, threadExisted, verdict, 'semantic');
      } catch (err: any) {
        // judge 失败时保守处理：当作 candidate 交给上层（不丢事件、不乱触发）
        this.emit('judge-error', { triggerId, error: err?.message });
        return this.finalize(trigger, triggerId, threadKey, threadExisted, 'candidate', 'semantic');
      }
    }

    // 无 judge：默认 candidate
    return this.finalize(trigger, triggerId, threadKey, threadExisted, 'candidate', 'program', 'default-candidate');
  }

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------

  private finalize(
    trigger: TriggerEvent,
    triggerId: string,
    threadKey: string,
    threadExisted: boolean,
    verdict: TriggerVerdict,
    decidedBy: 'program' | 'semantic',
    ruleId?: string
  ): RouteResult {
    if (verdict === 'act' && this.autoCreateThreadOnAct) {
      const thread = this.threads.get(threadKey) ?? this.createThread(threadKey);
      this.recordTrigger(threadKey, triggerId);
      this.emit('act', { trigger: { ...trigger, id: triggerId }, threadKey, decidedBy });
    } else if (verdict === 'candidate') {
      // candidate 也登记进 Thread（若已存在），供链式召回
      if (threadExisted) this.recordTrigger(threadKey, triggerId);
      this.emit('candidate', { trigger: { ...trigger, id: triggerId }, threadKey, decidedBy });
    } else {
      this.emit('ignored', { triggerId, threadKey, decidedBy, ruleId });
    }

    return { verdict, decidedBy, ruleId, threadKey, triggerId, threadExisted };
  }

  private createThread(key: string): Thread {
    const thread: Thread = {
      key,
      createdAt: Date.now(),
      subscriberWorkerIds: new Set(),
      triggerIds: [],
    };
    this.threads.set(key, thread);
    return thread;
  }

  private recordTrigger(threadKey: string, triggerId: string): void {
    const thread = this.threads.get(threadKey);
    if (!thread) return;
    thread.triggerIds.push(triggerId);
    if (thread.triggerIds.length > this.maxTriggersPerThread) {
      thread.triggerIds.splice(0, thread.triggerIds.length - this.maxTriggersPerThread);
    }
  }

  private debugLog(msg: string): void {
    if (this.debug) console.log(`[TriggerRouter] ${msg}`);
  }
}

// ============================================================================
// 内置规则集 — 针对牛码仓库实际噪音特征的预置规则
// ============================================================================

/** 预置一组常见噪音滤除规则（file-watcher 场景开箱即用） */
export function installDefaultNoiseRules(router: TriggerRouter): void {
  router.ignorePathPatterns(
    [
      /(^|[/\\])node_modules([/\\]|$)/,
      /(^|[/\\])\.git([/\\]|$)/,
      /(^|[/\\])dist([/\\]|$)/,
      /(^|[/\\])build([/\\]|$)/,
      /(^|[/\\])coverage([/\\]|$)/,
      /(^|[/\\])\.kode([/\\]|$)/,
      /\.log$/,
      /\.tmp$/,
      /~$/,
    ],
    'common build/cache noise'
  );
}
