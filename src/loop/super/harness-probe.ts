/**
 * HarnessProbe — 行为对比探针（Harness² Propose–Probe–Compose 的任务级精简版）
 *
 * Harness² 的做法：同一任务在 base 与 variant harness 下各执行一次，
 * 对比行为差异（不依赖 ground truth），只有证据支持的修改才组合采纳。
 *
 * 牛码精简版流程：
 *   Propose  调用方（人/LLM）产出 HarnessEditProposal[]
 *   Gate     OverfitGuard.critic 审查（RRSI 三闸门）→ 拒绝的记入经验库
 *   Probe    同一任务分别跑 base 与通过审查的 variant（runTask 由调用方注入，
 *            内部可以是 SubAgentCoordinator / WorkerExecutor / 任意执行体）
 *   Compose  OverfitGuard.judgeContrast 判定 → adopt 的走 HarnessFileStore
 *            落盘，全部结论记入 ExperienceStore（下次任务的路由素材）
 *
 * 探针是「运行时里的一次实验」，不影响正常任务流；失败实验保持安静
 * （与 speculative-runner 的纪律一致），只留经验记录。
 */

import type { HarnessFileStore, HarnessSnapshot, HarnessComponentKind } from './harness-files';
import type { ExperienceStore } from './experience-store';
import { OverfitGuard, type HarnessEditProposal, type CriticResult } from './overfit-guard';

// ============================================================================
// Types
// ============================================================================

/** 一次任务执行的行为观察（对比的单位） */
export interface RunObservation {
  success: boolean;
  /** 输出摘要（行为签名的一部分：同样的输入摘要在两个 harness 下是否一致） */
  summary: string;
  /** 结构化指标（对比优先用指标，无指标时退化为成功率+摘要变化） */
  metrics?: Record<string, number>;
  tokensUsed?: number;
}

/** 一次探针实验的完整结论 */
export interface ProbeOutcome {
  task: string;
  /** 审查结果（Gate 阶段） */
  critic: CriticResult | null;
  base: RunObservation | null;
  variant: RunObservation | null;
  verdict: 'adopted' | 'rejected-by-critic' | 'no-effect' | 'regression' | 'probe-failed';
  notes: string[];
  /** 采纳时实际落盘的组件 */
  adoptedKinds?: HarnessComponentKind[];
}

export interface ProbeOptions {
  /** 探针运行器：用给定 harness 快照执行任务。由调用方注入执行体。 */
  runTask: (task: string, harness: HarnessSnapshot, signal: AbortSignal) => Promise<RunObservation>;
  /** 单次执行超时毫秒（默认 5 分钟） */
  timeoutMs?: number;
}

// ============================================================================
// Probe
// ============================================================================

export class HarnessProbe {
  private readonly guard: OverfitGuard;

  constructor(
    private readonly harness: HarnessFileStore,
    private readonly experience: ExperienceStore | undefined,
    options: { guard?: OverfitGuard } = {}
  ) {
    this.guard = options.guard ?? new OverfitGuard();
  }

  get overfitGuard(): OverfitGuard {
    return this.guard;
  }

  /**
   * 跑一轮完整的 Propose–Gate–Probe–Compose。
   * 返回结论但不抛异常——实验失败也是结论（记入经验，保持安静）。
   */
  async proposeProbeCompose(
    task: string,
    proposals: HarnessEditProposal[],
    options: ProbeOptions,
    signal: AbortSignal = new AbortController().signal
  ): Promise<ProbeOutcome> {
    const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;

    // ---- Gate: 逐提案过防过拟合闸门，取第一个通过的 ----
    let chosen: HarnessEditProposal | null = null;
    let lastCritic: CriticResult | null = null;
    for (const p of proposals) {
      const critic = this.guard.review(p);
      lastCritic = critic;
      if (critic.accepted) {
        chosen = p;
        break;
      }
      // 拒绝也沉淀：为什么这个方向不行
      this.remember('harness-rejected', p, critic);
    }
    if (!chosen) {
      return {
        task,
        critic: lastCritic,
        base: null,
        variant: null,
        verdict: 'rejected-by-critic',
        notes: lastCritic?.reasons ?? ['无可用提案'],
      };
    }

    // ---- Probe: base 与 variant 各跑一次 ----
    const baseSnapshot = this.harness.snapshot();
    const variantSnapshot = snapshotWithEdits(baseSnapshot, chosen.edits);

    const [baseObs, variantObs] = await Promise.all([
      this.runOne(task, baseSnapshot, options.runTask, timeoutMs, signal),
      this.runOne(task, variantSnapshot, options.runTask, timeoutMs, signal),
    ]);

    if (!baseObs || !variantObs) {
      const outcome: ProbeOutcome = {
        task,
        critic: lastCritic,
        base: baseObs,
        variant: variantObs,
        verdict: 'probe-failed',
        notes: ['探针执行失败（超时或中止）——本次不产生任何 harness 变更'],
      };
      this.experience?.record({
        kind: 'lesson',
        label: `探针「${chosen.name}」执行失败（任务: ${truncate(task)}）`,
        detail: 'Probe 阶段超时或被中止，无行为对比结论',
        tags: ['probe', 'failed'],
      });
      return outcome;
    }

    // ---- Compose: 行为对比判定 ----
    const contrast = OverfitGuard.judgeContrast(baseObs, variantObs);

    if (contrast.verdict === 'adopt') {
      const applied = this.harness.applyEdits(
        chosen.edits.map((e) => ({ kind: e.kind, newContent: e.newContent }))
      );
      this.rememberAdopted(chosen, baseObs, variantObs, contrast.notes, applied);
      this.guard.nextRound();
      return {
        task,
        critic: lastCritic,
        base: baseObs,
        variant: variantObs,
        verdict: 'adopted',
        notes: contrast.notes,
        adoptedKinds: applied,
      };
    }

    // no-effect / regression：不落地，只留经验
    this.experience?.record({
      kind: 'lesson',
      label: `变体「${chosen.name}」判定 ${contrast.verdict}（任务: ${truncate(task)}）`,
      detail: contrast.notes.join('; '),
      evidence: `base=${describe(baseObs)}; variant=${describe(variantObs)}`,
      tags: ['probe', contrast.verdict],
    });
    if (contrast.verdict === 'no-effect') this.guard.nextRound();

    return {
      task,
      critic: lastCritic,
      base: baseObs,
      variant: variantObs,
      verdict: contrast.verdict,
      notes: contrast.notes,
    };
  }

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------

  private async runOne(
    task: string,
    harness: HarnessSnapshot,
    runTask: ProbeOptions['runTask'],
    timeoutMs: number,
    signal: AbortSignal
  ): Promise<RunObservation | null> {
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    timer.unref?.();
    try {
      return await runTask(task, harness, ctrl.signal);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    }
  }

  private remember(
    kind: 'harness-rejected',
    proposal: HarnessEditProposal,
    critic: CriticResult
  ): void {
    this.experience?.record({
      kind,
      label: `变体「${proposal.name}」被 critic 拒绝`,
      detail: critic.reasons.join('; ') || '(无理由)',
      evidence: `声明效果: ${proposal.declaredEffect || '(未声明)'}`,
      tags: ['harness', 'critic'],
    });
  }

  private rememberAdopted(
    proposal: HarnessEditProposal,
    base: RunObservation,
    variant: RunObservation,
    notes: string[],
    applied: HarnessComponentKind[]
  ): void {
    this.experience?.record({
      kind: 'harness-adopted',
      label: `变体「${proposal.name}」采纳，落盘组件: ${applied.join(', ') || '(无实际变化)'}`,
      detail: `声明效果: ${proposal.declaredEffect}; 对比: ${notes.join('; ')}`,
      evidence: `base=${describe(base)}; variant=${describe(variant)}`,
      tags: ['harness', 'adopted', ...applied],
    });
  }
}

// ============================================================================
// Helpers
// ============================================================================

/** 在 base 快照上套用编辑，得到 variant 快照（不动磁盘——Probe 用内存态）。 */
function snapshotWithEdits(
  base: HarnessSnapshot,
  edits: ReadonlyArray<{ kind: HarnessComponentKind; newContent: string }>
): HarnessSnapshot {
  const files = { ...base.files };
  for (const e of edits) files[e.kind] = e.newContent;
  return { ...base, files };
}

function describe(o: RunObservation): string {
  const parts = [o.success ? '成功' : '失败'];
  if (o.tokensUsed !== undefined) parts.push(`${o.tokensUsed} tok`);
  return parts.join(', ');
}

function truncate(s: string, n = 40): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
