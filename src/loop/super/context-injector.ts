/**
 * ContextInjector — 把上下文窗口当 Cache 管理（文章 3.3：Inline & Spill）
 *
 * 问题：事件驱动后，系统输入从有限的人类提示词变成持续的环境事件流。
 * 注入过多挤占窗口、稀释注意力；注入过少迫使模型反复调工具读取。
 * 浪费上下文窗口，就是浪费模型的智能。
 *
 * 方案（借鉴编译优化与局部性思想）：
 * - Inline：近期很可能用到的信息直接内联进窗口，省去工具调用往返
 * - Spill：超出预算或低频的内容留在窗口外，只留引用 ID + 摘要，按需读取
 * - 链式召回（Chain of Recall）：每次召回的对象同样带下一跳的 ID，
 *   模型顺着引用关系逐跳按需展开
 *
 * 纯内存逻辑，无外部依赖，可独立单测。
 */

import { randomUUID } from 'crypto';

// ============================================================================
// Types
// ============================================================================

/** 注入预算的计量单位：按字符估算 token（中文 ~1 token/字，英文 ~4 char/token，取保守值） */
export interface InjectorOptions {
  /** 单轮注入的字符预算（默认 ~30k 字符 ≈ 15k token） */
  budgetChars?: number;
  /** Inline 关联对象时的预览长度（文章建议内容前 50 字） */
  previewChars?: number;
}

/** 内联进窗口的内容块 */
export interface InlinedBlock {
  id: string;
  kind: 'full' | 'preview' | 'stub';
  /** full: 完整内容；preview: 前 N 字 + 续读入口；stub: 仅 ID + 摘要 */
  text: string;
  /** 若被 Spill，指向窗口外完整内容的引用 */
  readRef?: string;
}

/** 窗口外登记的完整对象（Spill 侧） */
interface SpilledObject {
  refId: string;
  content: string;
  /** 关联的下一跳对象 ID（链式召回的边） */
  linkedRefIds: string[];
  createdAt: number;
}

// ============================================================================
// Injector
// ============================================================================

export class ContextInjector {
  private spilled = new Map<string, SpilledObject>();
  private readonly budgetChars: number;
  private readonly previewChars: number;
  private usedChars = 0;

  constructor(options: InjectorOptions = {}) {
    this.budgetChars = options.budgetChars ?? 30_000;
    this.previewChars = options.previewChars ?? 50;
  }

  // ------------------------------------------------------------------
  // Inline 侧
  // ------------------------------------------------------------------

  /**
   * 请求内联一段内容。预算内 → full；超预算 → preview + Spill。
   * 返回的块总是可以直接放进窗口（full 或 preview 文本）。
   */
  inline(content: string, opts?: { id?: string; maxChars?: number }): InlinedBlock {
    const id = opts?.id ?? `obj-${randomUUID().slice(0, 8)}`;
    const limit = opts?.maxChars ?? Infinity;

    const fitsBudget = this.usedChars + content.length <= this.budgetChars;
    const fitsLimit = content.length <= limit;

    if (fitsBudget && fitsLimit) {
      this.usedChars += content.length;
      return { id, kind: 'full', text: content };
    }

    // Spill：窗口内留 preview + 续读入口
    const preview = content.slice(0, this.previewChars);
    const remaining = fitsBudget
      ? Math.min(content.length - preview.length, limit - preview.length)
      : 0;
    const inlineText = preview + (remaining > 0 ? content.slice(preview.length, preview.length + remaining) : '');
    this.usedChars += inlineText.length;

    const readRef = this.spill(content, id);
    return {
      id,
      kind: 'preview',
      text: `${inlineText}\n[已截断，完整内容引用: ${readRef}]`,
      readRef,
    };
  }

  /** 只登记引用不占预算（stub：ID + 一行摘要，链式召回的起始点） */
  stub(content: string, summary: string): InlinedBlock {
    const id = `obj-${randomUUID().slice(0, 8)}`;
    const refId = this.spill(content, id);
    return {
      id,
      kind: 'stub',
      text: `[${summary}] (完整内容引用: ${refId})`,
      readRef: refId,
    };
  }

  // ------------------------------------------------------------------
  // Spill 侧（链式召回）
  // ------------------------------------------------------------------

  /**
   * 按引用读取 Spill 内容，返回值内联下一跳引用（链式召回的关键约定：
   * 每次召回的结果本身也遵循 Inline & Spill）。
   */
  readThrough(refId: string, opts?: { offset?: number; length?: number }): string {
    const obj = this.spilled.get(refId);
    if (!obj) return `[引用不存在: ${refId}]`;

    const offset = opts?.offset ?? 0;
    const chunk = obj.content.slice(offset, opts?.length ? offset + opts.length : undefined);

    // 每次召回附下一跳引用 + 续读入口
    const parts = [chunk];
    if (offset + chunk.length < obj.content.length) {
      parts.push(`\n[续读: readThrough("${refId}", { offset: ${offset + chunk.length} })]`);
    }
    if (obj.linkedRefIds.length > 0) {
      parts.push(`\n[关联引用: ${obj.linkedRefIds.join(', ')}]`);
    }
    return parts.join('');
  }

  /** 为已 Spill 的对象建立引用边（如：Trigger → Thread → Worker Session）。 */
  link(fromRefId: string, toRefId: string): void {
    const obj = this.spilled.get(fromRefId);
    if (obj && !obj.linkedRefIds.includes(toRefId)) {
      obj.linkedRefIds.push(toRefId);
    }
  }

  /** 当前预算占用（调试/观测）。 */
  getUsage(): { usedChars: number; budgetChars: number; spilledCount: number } {
    return {
      usedChars: this.usedChars,
      budgetChars: this.budgetChars,
      spilledCount: this.spilled.size,
    };
  }

  /** 会话结束清理。 */
  dispose(): void {
    this.spilled.clear();
    this.usedChars = 0;
  }

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------

  private spill(content: string, id: string): string {
    const refId = `ref-${randomUUID().slice(0, 8)}`;
    this.spilled.set(refId, {
      refId,
      content,
      linkedRefIds: [],
      createdAt: Date.now(),
    });
    return refId;
  }
}

/**
 * 局部性展开辅助：为中心对象构建 Inline 上下文。
 * 顺序（文章 3.3 的三步）：ID+摘要起步 → 时空相邻内容 → 超限 Spill。
 */
export function buildLocalizedContext(
  injector: ContextInjector,
  center: { id: string; content: string },
  related: Array<{ id: string; content: string }>,
  opts?: { maxRelated?: number }
): { center: InlinedBlock; relatedBlocks: InlinedBlock[] } {
  const centerBlock = injector.inline(center.content, { id: center.id });

  const maxRelated = opts?.maxRelated ?? 3; // 紧密关联对象优先，宁少勿滥
  const relatedBlocks = related.slice(0, maxRelated).map((r) =>
    injector.inline(r.content, { id: r.id, maxChars: 200 }) // 关联对象只带前 200 字
  );

  // 建立 center → related 的引用边（链式召回）
  if (centerBlock.readRef) {
    for (const rb of relatedBlocks) {
      if (rb.readRef) injector.link(centerBlock.readRef, rb.readRef);
    }
  }

  return { center: centerBlock, relatedBlocks };
}
