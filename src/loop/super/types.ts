/**
 * Super-agent Subsystem — Shared Types
 *
 * 参照 DeepSeek Harness《Super-agent 设计探索》的五模块设计，
 * 为 Newma 提供 Trigger / Thread / Worker / Watchdog 的最小类型基础。
 *
 * 设计原则：
 * - 事件（Trigger）是驱动 Agent 的第一输入，人类指令只是其中一种来源
 * - Thread 是同一任务的事件流，Worker 直接订阅，后续事件直通不过 Router
 * - Router 只做分派与对外交互，不亲自执行具体任务
 */

// ============================================================================
// Trigger — 环境事件
// ============================================================================

/** Trigger 来源类型 */
export type TriggerSourceKind = 'file-watcher' | 'http' | 'websocket' | 'cli' | 'schedule' | 'custom';

/** 进入系统的环境事件（文章第 3 节的 Trigger） */
export interface TriggerEvent {
  /** 唯一 ID，用于链式召回的引用图 */
  id: string;
  /** 事件来源 */
  source: TriggerSourceKind;
  /** 来源标识（如文件路径、URL、频道名） */
  origin: string;
  /** 事件类型（如 change / request / message） */
  kind: string;
  /** 事件载荷摘要（Inline 用，控制长度） */
  summary: string;
  /** 完整载荷（Spill 在窗口外，按需读取） */
  payload?: unknown;
  /** 所属 Thread 的提示键（同一 PR、同一文件、同一话题共享一个 key） */
  threadKey?: string;
  /** 到达时间 */
  timestamp: number;
}

/** 两级过滤的判定结果 */
export type TriggerVerdict = 'ignore' | 'candidate' | 'act';

/** 程序层过滤规则（Fast Path，确定性、零 LLM 开销） */
export interface ProgramRule {
  ruleId: string;
  /** 命中即按 verdict 处理；未命中交给下一条规则 */
  match: (trigger: TriggerEvent) => boolean;
  verdict: TriggerVerdict;
  /** 说明（调试/审计用） */
  note?: string;
}

/** 语义层判定器（Slow Path，由 LLM 充当） */
export type SemanticJudge = (trigger: TriggerEvent) => Promise<TriggerVerdict>;

// ============================================================================
// Thread — 事件流与订阅
// ============================================================================

/** 一条事件流（同一任务相关 Trigger 的容器） */
export interface Thread {
  key: string;
  createdAt: number;
  /** 当前订阅该 Thread 的 Worker ID（多对多） */
  subscriberWorkerIds: Set<string>;
  /** Thread 内的 Trigger ID 环形记录（链式召回入口） */
  triggerIds: string[];
}

// ============================================================================
// Worker — 执行层
// ============================================================================

/** Worker 任务状态 */
export type WorkerTaskState = 'queued' | 'running' | 'awaiting-confirmation' | 'done' | 'failed' | 'cancelled';

/** 一个分派给 Worker 的任务 */
export interface WorkerTask {
  id: string;
  /** 任务描述（来自人类指令或触发任务的 Trigger） */
  requirement: string;
  /** 创建来源：用户指令或某条 Trigger */
  origin: 'user' | 'trigger';
  /** 若来自 Trigger，关联的 Thread key 与 Trigger ID（链式召回） */
  threadKey?: string;
  triggerId?: string;
  state: WorkerTaskState;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  /** 最近一次进展记录（Watchdog 依据） */
  lastProgress?: ProgressRecord;
  result?: WorkerTaskResult;
  error?: string;
}

/** 进展记录（由 Worker 汇报，Watchdog 判断「是否有实质进展」的依据） */
export interface ProgressRecord {
  at: number;
  /** 人类可读的一行进展 */
  note: string;
  /** 自上次记录以来是否有新产出（如文件变更、测试通过） */
  substantive: boolean;
}

/** Worker 任务结果（Worker 不直接对外输出，统一汇报给 Router） */
export interface WorkerTaskResult {
  success: boolean;
  /** 给用户的简短结论（Router 负责转发到交互信道） */
  summary: string;
  /** 详细输出（长内容，Spill 侧） */
  detail?: string;
  tokensUsed?: number;
}

// ============================================================================
// Router — 全局协调层
// ============================================================================

/** Router 配置 */
export interface SuperRouterConfig {
  /** 单个 Router 决策批量注入的最大 Trigger 数（文章 2.1 的 Batching 上限） */
  maxBatchSize?: number;
  /** Worker 并发上限 */
  maxConcurrentWorkers?: number;
  /** 确认策略：等待用户 / 自动批准 / 直接拒绝 */
  confirmationPolicy?: 'wait' | 'auto-approve' | 'deny';
  /** 是否允许由 Trigger 自动创建任务（事件驱动的「主动」开关） */
  actOnTriggers?: boolean;
}

// ============================================================================
// Watchdog — 外部控制回路
// ============================================================================

/** Watchdog 判定结果 */
export interface WatchdogVerdict {
  taskId: string;
  /** healthy: 有实质进展；stalled: 停滞；off-track: 偏离目标；failed: 应终止 */
  status: 'healthy' | 'stalled' | 'off-track' | 'failed';
  reason: string;
  /** 建议动作：继续观察 / 提醒用户 / 终止任务 */
  action: 'none' | 'notify' | 'terminate';
}
