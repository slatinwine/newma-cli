/**
 * OverfitGuard — 防过拟合闸门（RRSI：Regularized Recursive Self-Improvement）
 *
 * RRSI 的核心发现：agent 持续优化自己的 harness 会「背题」——训练任务涨分、
 * 新任务归零甚至低于 baseline。对策三件套（本模块实现前两件 + 复杂度闸门）：
 *
 * 1. 编辑预算递减：每轮允许的独立编辑数随轮次收缩——早期允许大改，
 *    后期只允许能明确归因的小改。
 * 2. Critic 审查：拒绝硬编码任务名/benchmark 特例的修改；要求每次修改
 *    声明预期影响的行为维度，声明缺失或与修改内容无关则拒绝。
 * 3. 复杂度闸门：内容体积膨胀超过阈值且没有缩减说明的，拒绝。
 *
 * 产线化注意：hardcode 检测是启发式（模式匹配），误杀可由人工 override——
 * 所以 critic 返回 reasons 而不是静默丢弃。
 */

import { hashContent } from './harness-files';

// ============================================================================
// Types
// ============================================================================

/** 一次 harness 编辑提案（Propose 阶段的产物，Probe 前先过闸门） */
export interface HarnessEditProposal {
  /** 变体名（审计用） */
  name: string;
  edits: Array<{
    kind: import('./harness-files').HarnessComponentKind;
    oldContent: string;
    newContent: string;
  }>;
  /**
   * 声明的预期行为维度（必须可观察）：如 "planning"、"tool-choice"、
   * "memory-recall"。RRSI 规则：声明不了可观察差异的修改不采纳。
   */
  declaredEffect: string;
  /** 提案针对的任务上下文（用于检测硬编码任务名） */
  taskHint?: string;
}

export interface CriticResult {
  accepted: boolean;
  /** 拒绝/警告的具体原因（人工可读，供 override 与经验沉淀） */
  reasons: string[];
  /** 警告级问题：不拒绝但记入经验库 */
  warnings: string[];
  /** 使用的编辑预算点数 */
  budgetCost: number;
}

export interface OverfitGuardOptions {
  /** 首轮编辑预算（独立编辑数上限，默认 5） */
  initialBudget?: number;
  /** 每轮预算收缩比例（0-1，默认 0.7：5 → 3 → 2 → 1 → 1） */
  decay?: number;
  /** 预算下限（默认 1，永远允许最小修改） */
  minBudget?: number;
  /** 复杂度膨胀容忍倍数（new/old 超过此值拒绝，默认 2） */
  maxGrowthFactor?: number;
}

// ============================================================================
// 硬编码检测模式（启发式）
// ============================================================================

/**
 * 疑似「背题」的内容模式。命中即拒绝（warning 级别的单独标注）。
 * - benchmark 名称直接写进 harness
 * - 具体任务的引语/答案片段
 * - 「当看到 X 就输出 Y」式的特判（针对单一刺激的规则）
 */
const HARDCODE_PATTERNS: Array<{ pattern: RegExp; note: string; severity: 'reject' | 'warn' }> = [
  { pattern: /\b(WorkBuddy-Bench|JobBench|LAB|SWE-bench|Terminal-bench|HumanEval)\b/i, note: 'harness 内容中出现 benchmark 名称（背题风险）', severity: 'reject' },
  { pattern: /当(用户|任务|输入)(提到|包含|说)[^\n]{0,30}(就|则|直接)(输出|回复|返回)/, note: '「当 X 就 Y」式特判规则，疑似针对单一刺激硬编码', severity: 'warn' },
  { pattern: /(expected answer|标准答案是|正确答案为)/i, note: 'harness 中出现答案性内容', severity: 'reject' },
];

// ============================================================================
// Guard
// ============================================================================

export class OverfitGuard {
  private round = 0;
  private readonly initialBudget: number;
  private readonly decay: number;
  private readonly minBudget: number;
  private readonly maxGrowthFactor: number;
  /** 已被拒绝过的提案哈希 → 不重复追同一败因（RRSI 的尝试记忆） */
  private rejectedHashes = new Set<string>();

  constructor(options: OverfitGuardOptions = {}) {
    this.initialBudget = options.initialBudget ?? 5;
    this.decay = options.decay ?? 0.7;
    this.minBudget = options.minBudget ?? 1;
    this.maxGrowthFactor = options.maxGrowthFactor ?? 2;
  }

  get currentRound(): number {
    return this.round;
  }

  /** 当前轮次的编辑预算。 */
  budget(): number {
    const b = Math.max(this.minBudget, Math.round(this.initialBudget * Math.pow(this.decay, this.round)));
    return b;
  }

  /** 推进一轮（每完成一次完整的 Propose–Probe–Compose 后调用）。 */
  nextRound(): void {
    this.round++;
  }

  /** 记录被拒绝的提案（同提案重复提交直接拒，防止循环追同一败因）。 */
  private proposalFingerprint(p: HarnessEditProposal): string {
    const body = p.edits.map((e) => `${e.kind}:${hashContent(e.newContent)}`).join('|');
    return hashContent(`${p.declaredEffect}|${body}`);
  }

  /**
   * Critic 审查。 accepted=false 时 reasons 说明为什么（不静默丢弃）。
   */
  review(proposal: HarnessEditProposal): CriticResult {
    const reasons: string[] = [];
    const warnings: string[] = [];

    // 0. 重复提案（追同一败因）
    const fp = this.proposalFingerprint(proposal);
    if (this.rejectedHashes.has(fp)) {
      return {
        accepted: false,
        reasons: ['该提案（或内容等价提案）此前已被拒绝，不重复追同一败因'],
        warnings,
        budgetCost: 0,
      };
    }

    // 1. 编辑预算
    const budget = this.budget();
    if (proposal.edits.length > budget) {
      reasons.push(`本轮编辑预算为 ${budget}，提案包含 ${proposal.edits.length} 处独立编辑（预算随轮次递减，先做能明确归因的小改）`);
    }

    // 2. 声明预期行为维度
    const effect = proposal.declaredEffect.trim();
    if (effect === '') {
      reasons.push('未声明 declaredEffect：无可观察差异预期的修改不采纳（RRSI 规则）');
    } else if (effect.length < 4) {
      warnings.push(`declaredEffect 过于笼统："${effect}"——建议声明到可观察的行为维度`);
    }

    // 3. 硬编码检测（逐 edit 扫描新内容）
    for (const edit of proposal.edits) {
      for (const { pattern, note, severity } of HARDCODE_PATTERNS) {
        if (!pattern.test(edit.newContent)) continue;
        if (severity === 'reject') reasons.push(`${edit.kind}: ${note}`);
        else warnings.push(`${edit.kind}: ${note}`);
      }

      // 3b. 任务提示词被原文嵌入（把当前任务的题面写死进 harness）
      if (proposal.taskHint && proposal.taskHint.length >= 8) {
        const hintCore = proposal.taskHint.trim().slice(0, 40);
        if (edit.newContent.includes(hintCore) && !edit.oldContent.includes(hintCore)) {
          reasons.push(`${edit.kind}: 新内容嵌入了当前任务的原文（"${hintCore}…"）——特判单题的修改不采纳`);
        }
      }

      // 4. 复杂度膨胀（且未声明缩减理由）
      const oldLen = edit.oldContent.length;
      const newLen = edit.newContent.length;
      if (oldLen > 200 && newLen > oldLen * this.maxGrowthFactor) {
        reasons.push(
          `${edit.kind}: 内容从 ${oldLen} 膨胀到 ${newLen} 字符（>${this.maxGrowthFactor}x）——复杂度堆高测试分不等于变强，先做减法`
        );
      }
    }

    const accepted = reasons.length === 0;
    if (!accepted) this.rejectedHashes.add(fp);
    return {
      accepted,
      reasons,
      warnings,
      budgetCost: accepted ? proposal.edits.length : 0,
    };
  }

  // ------------------------------------------------------------------
  // 行为对比的判定规则（Probe 之后的 Compose 依据）
  // ------------------------------------------------------------------

  /**
   * 判定一次对比实验是否支持采纳变体。
   * RRSI 规则：只有产生可观察的正向差异才采纳——
   * - 没有行为差异（signature 相同且指标持平）：no-effect，不采纳
   * - 有差异但方向为负：regression，不采纳
   * - 有正向差异：adopt（调用方仍需把本次结论记入经验库）
   */
  static judgeContrast(
    base: { success: boolean; metrics?: Record<string, number> },
    variant: { success: boolean; metrics?: Record<string, number> }
  ): { verdict: 'adopt' | 'no-effect' | 'regression'; notes: string[] } {
    const notes: string[] = [];

    if (base.success === variant.success) {
      const delta = metricDelta(base.metrics, variant.metrics);
      if (delta.length === 0) {
        return { verdict: 'no-effect', notes: ['成功状态相同且无可比指标差异——修改没有产生可观察的行为变化'] };
      }
      const improved = delta.filter((d) => d.delta > 0);
      const worsened = delta.filter((d) => d.delta < 0);
      if (improved.length > 0 && worsened.length === 0) {
        return {
          verdict: 'adopt',
          notes: delta.map((d) => `${d.name}: ${d.before} → ${d.after}（+${d.delta}）`),
        };
      }
      if (worsened.length > 0) {
        return {
          verdict: 'regression',
          notes: [
            ...worsened.map((d) => `${d.name}: ${d.before} → ${d.after}（${d.delta}，变差）`),
            ...improved.map((d) => `${d.name}: ${d.before} → ${d.after}（改善但被其他维度抵消）`),
          ],
        };
      }
      return { verdict: 'no-effect', notes: ['指标持平', ...delta.map((d) => `${d.name}: ${d.before} → ${d.after}`)] };
    }

    if (variant.success && !base.success) {
      return { verdict: 'adopt', notes: ['base 失败而 variant 成功（成功率差异）'] };
    }
    return { verdict: 'regression', notes: ['base 成功而 variant 失败（成功率回退）'] };
  }
}

// ============================================================================
// Helpers
// ============================================================================

function metricDelta(
  base?: Record<string, number>,
  variant?: Record<string, number>
): Array<{ name: string; before: number; after: number; delta: number }> {
  if (!base || !variant) return [];
  const out: Array<{ name: string; before: number; after: number; delta: number }> = [];
  for (const name of Object.keys(base)) {
    if (!(name in variant)) continue;
    const delta = round3(variant[name] - base[name]);
    if (delta !== 0) out.push({ name, before: base[name], after: variant[name], delta });
  }
  return out;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
