/**
 * LLM Judge Adapter — 语义层 Slow Path 的默认实现（文章 3.1）
 *
 * 把 TriggerEvent 的摘要交给 chatAI，按提示词策略判定 act / candidate / ignore。
 * 程序层 Fast Path 已在 TriggerRouter 滤掉大部分噪音，这里只处理候选事件，
 * 因此 LLM 调用频率可控。
 *
 * 容错设计：
 * - LLM 输出非法 JSON → 降级为 'candidate'（不丢事件、不乱触发）
 * - 超时（默认 20s）→ 降级为 'candidate'
 * - 上层 TriggerRouter 的 judge-error 分支兜底
 */

import type { Config } from '../../config';
import type { TriggerEvent, TriggerVerdict, SemanticJudge } from './types';

// ============================================================================
// Types
// ============================================================================

export interface LLMJudgeOptions {
  /** 单次判定的超时毫秒数（默认 20s） */
  timeoutMs?: number;
  /**
   * 语义策略（自然语言，用户可随时增删——文章 3.1 的「面向人类的扩展点」）。
   * 例："只关注 src/ 目录的代码变更；文档改动忽略；测试失败要行动。"
   */
  policy?: string;
  /** 判定历史采样（同一 Thread 之前的事件摘要，帮助 LLM 理解上下文） */
  contextWindow?: number;
}

const DEFAULT_POLICY = `你是一个持续运行的编码助手的守门员。环境事件不断到达，你来判断哪些值得 Agent 主动行动。
判定标准：
- act：事件明确需要 Agent 立即处理（如构建失败、测试挂了、用户明确请求）
- candidate：可能与工作相关，但拿不准，交给上层决定
- ignore：纯噪音（格式化、缓存文件、无关闲聊）`;

// ============================================================================
// Adapter
// ============================================================================

/**
 * 创建基于 chatAI 的 SemanticJudge。
 * chatAI 以动态 import 引入，避免本模块被单元测试（无 AI 环境）加载时拉起网络依赖。
 */
export function createLLMJudge(config: Config, options: LLMJudgeOptions = {}): SemanticJudge {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const policy = options.policy ?? DEFAULT_POLICY;

  return async (trigger: TriggerEvent): Promise<TriggerVerdict> => {
    const prompt = [
      `【语义策略】`,
      policy,
      ``,
      `【事件信息】`,
      `来源: ${trigger.source}`,
      `位置: ${trigger.origin}`,
      `类型: ${trigger.kind}`,
      `摘要: ${trigger.summary}`,
      trigger.payload ? `载荷片段: ${truncate(safeStringify(trigger.payload), 500)}` : '',
      ``,
      `只输出一个 JSON 对象，格式：{"verdict":"act|candidate|ignore","reason":"一句话理由"}`,
    ].filter(Boolean).join('\n');

    try {
      const { chatAI } = await import('../../ai');
      const result = await withTimeout(
        chatAI(config, prompt),
        timeoutMs,
        'judge timeout'
      );

      const verdict = parseVerdict(result);
      return verdict ?? 'candidate'; // 解析失败：保守降级
    } catch {
      return 'candidate'; // 网络/超时/任何异常：保守降级，不丢事件
    }
  };
}

// ============================================================================
// Helpers
// ============================================================================

function parseVerdict(raw: string): TriggerVerdict | null {
  // chatAI 可能带 markdown 代码块，先剥壳再解析
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const v = String(parsed.verdict || '').toLowerCase();
    if (v === 'act' || v === 'candidate' || v === 'ignore') return v;
    return null;
  } catch {
    return null;
  }
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

function safeStringify(value: unknown): string {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + '…';
}
