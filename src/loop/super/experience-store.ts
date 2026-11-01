/**
 * ExperienceStore — 经验层（Harness² 的 Improvement Harness Library 牛码版）
 *
 * Harness² 维护一个持久「改进经验库」：采纳过的 harness 方案与有执行证据
 * 支持的经验跨任务保留，指导之后的优化。牛码对应物：
 *
 * - Watchdog 判定（stalled/off-track 的原因模式）
 * - 投机执行 discarded 的原因（哪些尝试不值得交付）
 * - harness 修改的采纳/拒绝记录（为什么改、证据是什么）
 * - 自由沉淀的 lesson（人写或 agent 写）
 *
 * append-only JSONL 落盘 .kode/super/experience.jsonl，进程重启不丢。
 * summarize() 生成可注入上下文的经验摘要（配合 context-injector 的 Inline）。
 */

import { mkdirSync, appendFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ============================================================================
// Types
// ============================================================================

export type ExperienceKind =
  | 'watchdog-verdict'
  | 'speculative-discarded'
  | 'speculative-delivered'
  | 'harness-adopted'
  | 'harness-rejected'
  | 'lesson';

export interface ExperienceRecord {
  id: string;
  at: string;
  kind: ExperienceKind;
  /** 一行标题（检索与展示用） */
  label: string;
  /** 证据/细节（为什么得出这个结论） */
  detail?: string;
  /** 事实依据的原始观察（有执行证据支持的经验才值得保留） */
  evidence?: string;
  tags: string[];
}

export interface ExperienceQuery {
  kind?: ExperienceKind;
  /** 任一 tag 命中即返回 */
  anyTag?: string[];
  labelContains?: string;
  limit?: number;
}

export interface ExperienceStoreOptions {
  /** 记录条数上限（超出时最旧的被淘汰，防止无限增长；默认 2000） */
  maxRecords?: number;
}

// ============================================================================
// Store
// ============================================================================

export class ExperienceStore {
  private readonly file: string;
  private readonly maxRecords: number;
  private records: ExperienceRecord[] = [];
  private seq = 0;

  constructor(dir: string, options: ExperienceStoreOptions = {}) {
    this.file = join(dir, 'experience.jsonl');
    this.maxRecords = options.maxRecords ?? 2000;
    this.load();
  }

  get path(): string {
    return this.file;
  }

  // ------------------------------------------------------------------
  // 写入
  // ------------------------------------------------------------------

  /** 追加一条经验（同步落盘——经验量小频低，不值得防抖）。 */
  record(input: {
    kind: ExperienceKind;
    label: string;
    detail?: string;
    evidence?: string;
    tags?: string[];
  }): ExperienceRecord {
    const rec: ExperienceRecord = {
      id: `exp-${Date.now()}-${++this.seq}`,
      at: new Date().toISOString(),
      kind: input.kind,
      label: input.label,
      detail: input.detail,
      evidence: input.evidence,
      tags: input.tags ?? [],
    };
    this.records.push(rec);
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(this.records.length - this.maxRecords);
    }
    this.persist(rec);
    return rec;
  }

  // ------------------------------------------------------------------
  // 查询
  // ------------------------------------------------------------------

  query(q: ExperienceQuery = {}): ExperienceRecord[] {
    let out = this.records;
    if (q.kind) out = out.filter((r) => r.kind === q.kind);
    if (q.anyTag && q.anyTag.length > 0) {
      out = out.filter((r) => r.tags.some((t) => q.anyTag!.includes(t)));
    }
    if (q.labelContains) {
      const needle = q.labelContains.toLowerCase();
      out = out.filter((r) => r.label.toLowerCase().includes(needle));
    }
    const limit = q.limit ?? 50;
    return out.slice(-limit); // 最近的优先
  }

  // ------------------------------------------------------------------
  // 上下文注入（经验 → 提示素材）
  // ------------------------------------------------------------------

  /**
   * 生成经验摘要块：按 kind 分组、每条一行，控制长度可 Inline。
   * 空库返回 undefined（调用方跳过注入，不浪费上下文）。
   */
  summarize(limit = 20): string | undefined {
    if (this.records.length === 0) return undefined;
    const recent = this.query({ limit });
    if (recent.length === 0) return undefined;

    const lines = recent.map((r) => {
      const tags = r.tags.length > 0 ? ` [${r.tags.join(',')}]` : '';
      const evidence = r.evidence ? ` — 证据: ${r.evidence}` : '';
      return `- (${r.kind}) ${r.label}${tags}${evidence}`;
    });
    return [
      `## 历史经验（最近 ${recent.length} 条，来自 .kode/super/experience.jsonl）`,
      '以下是本库沉淀的有执行证据支持的经验，行动前请参考，避免重复踩坑：',
      ...lines,
    ].join('\n');
  }

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------

  private load(): void {
    if (!existsSync(this.file)) return;
    try {
      const lines = readFileSync(this.file, 'utf8').split('\n').filter((l) => l.trim() !== '');
      for (const line of lines) {
        try {
          this.records.push(JSON.parse(line) as ExperienceRecord);
        } catch {
          // 单行损坏跳过，不影响其余
        }
      }
      if (this.records.length > this.maxRecords) {
        this.records = this.records.slice(this.records.length - this.maxRecords);
      }
    } catch {
      // 损坏文件当空库
    }
  }

  private persist(rec: ExperienceRecord): void {
    try {
      mkdirSync(join(this.file, '..'), { recursive: true });
      appendFileSync(this.file, JSON.stringify(rec) + '\n', 'utf8');
    } catch {
      // 落盘失败不阻塞主流程（内存里仍有）
    }
  }
}

// ============================================================================
// 便捷构造：从现有事件沉淀经验
// ============================================================================

/** Watchdog 判定 → 经验。停滞/偏离/失败才记录（healthy 不值得留）。 */
export function experienceFromWatchdog(
  store: ExperienceStore,
  verdict: { taskId: string; status: string; reason: string }
): void {
  if (verdict.status === 'healthy') return;
  store.record({
    kind: 'watchdog-verdict',
    label: `任务 ${verdict.taskId} 判定为 ${verdict.status}`,
    detail: verdict.reason,
    tags: ['watchdog', verdict.status],
  });
}

/** 投机执行结果 → 经验。discarded 的原因模式最有价值（下次别再试）。 */
export function experienceFromSpeculative(
  store: ExperienceStore,
  outcome: { type: string; label: string; reason?: string }
): void {
  if (outcome.type === 'delivered') {
    store.record({
      kind: 'speculative-delivered',
      label: `投机尝试「${outcome.label}」交付成功`,
      tags: ['speculative', 'delivered'],
    });
  } else {
    store.record({
      kind: 'speculative-discarded',
      label: `投机尝试「${outcome.label}」被丢弃`,
      detail: outcome.reason,
      tags: ['speculative', 'discarded'],
    });
  }
}

/** 目录便捷构造。 */
export function createExperienceStore(projectRoot: string, dir?: string): ExperienceStore {
  return new ExperienceStore(dir ?? join(projectRoot, '.kode', 'super'));
}
