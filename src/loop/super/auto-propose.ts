/**
 * AutoProposer — LLM 自动出 harness 修改提案（自动化回路的最后一环）
 *
 * 之前的 Propose 靠人写 HarnessEditProposal；本模块让 chatAI 来做：
 *
 *   任务上下文 + 经验库摘要 + 当前 harness 快照
 *     → LLM 生成候选修改（JSON，带声明效果）
 *     → 解析/校验（组件名白名单、oldContent 回填）
 *     → probe.proposeProbeCompose（Gate → Probe → Compose 自动走完）
 *
 * 容错设计（与 llm-judge 同纪律）：
 * - LLM 输出非法 JSON / 超时 → 返回 null（不产生任何 harness 变更）
 * - 非法组件名、缺失字段 → 逐条过滤，合法的仍可用
 * - critic 拒绝不是错误——是结论，照常入经验库
 */

import type { Config } from '../../config';
import type { HarnessFileStore, HarnessSnapshot } from './harness-files';
import { HARNESS_COMPONENT_KINDS, type HarnessComponentKind } from './harness-files';
import type { HarnessProbe, ProbeOutcome, RunObservation } from './harness-probe';
import type { HarnessEditProposal } from './overfit-guard';
import type { ExperienceStore } from './experience-store';

// ============================================================================
// Types
// ============================================================================

export interface AutoProposeOptions {
  /** LLM 调用超时毫秒（默认 60s：出提案比判定重） */
  timeoutMs?: number;
  /** 最多让 LLM 出几个提案（默认 2） */
  maxProposals?: number;
  /** 探针单次执行超时毫秒（透传 probe，默认 5 分钟） */
  probeTimeoutMs?: number;
  /** 每个组件文件给 LLM 看的最大字符数（默认 800） */
  componentPreviewChars?: number;
  /**
   * LLM 调用（默认 chatAI 动态 import；测试注入 fake）。
   * 返回原始模型输出文本。
   */
  chat?: (prompt: string) => Promise<string>;
  /** 额外策略提示（自然语言，用户可定制优化方向） */
  policy?: string;
}

export interface AutoProposer {
  /**
   * 全自动一轮：出提案 → 过闸门 → 行为对比 → 采纳/拒绝。
   * 返回 null 表示 LLM 阶段失败（网络/超时/格式），无任何副作用。
   */
  proposeAndProbe(
    task: string,
    runTask: (task: string, harnessSnapshot: HarnessSnapshot, signal: AbortSignal) => Promise<RunObservation>,
    signal?: AbortSignal
  ): Promise<ProbeOutcome | null>;
}

const DEFAULT_POLICY = `你在优化一个常驻编码 Agent 的 harness（模型外的一切）。
只提「能改变可观察行为」的修改：行为方式、流程顺序、检查点、记忆策略。
禁止：修改与任务无关的内容、堆砌复杂度、针对当前任务特判（会被 critic 拒绝）。`;

// ============================================================================
// Factory
// ============================================================================

export function createAutoProposer(
  config: Config,
  harness: HarnessFileStore,
  experience: ExperienceStore | undefined,
  probe: HarnessProbe,
  options: AutoProposeOptions = {}
): AutoProposer {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const maxProposals = options.maxProposals ?? 2;
  const previewChars = options.componentPreviewChars ?? 800;
  const policy = options.policy ?? DEFAULT_POLICY;

  const chat =
    options.chat ??
    (async (prompt: string) => {
      const { chatAI } = await import('../../ai');
      return chatAI(config, prompt);
    });

  return {
    async proposeAndProbe(task, runTask, signal = new AbortController().signal): Promise<ProbeOutcome | null> {
      const snapshot = harness.snapshot();
      const prompt = buildPrompt(task, snapshot, experience?.summarize(15), policy, previewChars);

      let raw: string;
      try {
        raw = await withTimeout(chat(prompt), timeoutMs, 'propose timeout');
      } catch {
        return null;
      }

      const proposals = parseProposals(raw, harness, maxProposals);
      if (proposals.length === 0) return null;

      return probe.proposeProbeCompose(
        task,
        proposals,
        { runTask, timeoutMs: options.probeTimeoutMs },
        signal
      );
    },
  };
}

// ============================================================================
// Prompt 构造与解析
// ============================================================================

function buildPrompt(
  task: string,
  snapshot: import('./harness-files').HarnessSnapshot,
  experienceSummary: string | undefined,
  policy: string,
  previewChars: number
): string {
  const components = HARNESS_COMPONENT_KINDS.map((kind) => {
    const content = snapshot.files[kind]?.trim() ?? '';
    const body = content === '' ? '（空）' : content.length > previewChars ? content.slice(0, previewChars) + '…' : content;
    return `### ${kind}\n${body}`;
  }).join('\n\n');

  return [
    '【任务】',
    '针对下面这个（类）任务，提出最多 2 个 harness 修改提案，让 Agent 以后做同类任务时表现更好。',
    '',
    policy,
    '',
    '【任务描述】',
    task,
    '',
    experienceSummary ? `${experienceSummary}\n` : '',
    '【当前 harness 组件（可编辑，kind 为组件名）】',
    components,
    '',
    '只输出一个 JSON 对象，格式：',
    '{"proposals":[{"name":"提案名","declaredEffect":"预期改变的可观察行为维度","edits":[{"kind":"组件名","newContent":"该组件的完整新内容"}]}]}',
    '注意：newContent 必须是组件的完整新内容（会整体覆盖）；最多 2 个提案。',
  ].filter(Boolean).join('\n');
}

/** 解析 LLM 输出为合法提案（逐条校验，非法的丢弃）。 */
export function parseProposals(
  raw: string,
  harness: HarnessFileStore,
  maxProposals: number
): HarnessEditProposal[] {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
  const container = parsed as { proposals?: unknown };
  if (!Array.isArray(container.proposals)) return [];

  const out: HarnessEditProposal[] = [];
  for (const item of container.proposals) {
    if (out.length >= maxProposals) break;
    const p = item as {
      name?: unknown;
      declaredEffect?: unknown;
      edits?: unknown;
    };
    if (typeof p.name !== 'string' || typeof p.declaredEffect !== 'string' || !Array.isArray(p.edits)) {
      continue;
    }
    const edits: HarnessEditProposal['edits'] = [];
    let valid = true;
    for (const e of p.edits as Array<{ kind?: unknown; newContent?: unknown }>) {
      const kind = String(e.kind ?? '') as HarnessComponentKind;
      if (!HARNESS_COMPONENT_KINDS.includes(kind) || typeof e.newContent !== 'string') {
        valid = false;
        break;
      }
      edits.push({
        kind,
        oldContent: harness.read(kind) ?? '',
        newContent: e.newContent,
      });
    }
    if (!valid || edits.length === 0) continue;
    out.push({ name: p.name, declaredEffect: p.declaredEffect, edits });
  }
  return out;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    timer.unref?.();
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}
