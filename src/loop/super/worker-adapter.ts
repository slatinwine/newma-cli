/**
 * SubAgent Worker Adapter — 把现有 SubAgent 体系包装成 WorkerExecutor（文章 2.2）
 *
 * Worker 层的默认执行体：每个任务一个独立的 SubAgentCoordinator 实例
 * （上下文隔离），Planning → 确认（经 Router 的非阻塞队列）→ Execution。
 *
 * 与 REPL 的 executeWithSubAgent 的区别：
 * - REPL 版：阻塞主会话、inquirer 确认、结果直接 console.log
 * - 本版：由 Router 调度、确认走 WorkerHooks（ConfirmationQueue）、
 *   结论以 WorkerTaskResult 返回给 Router 统一输出
 */

import type { Config } from '../../config';
import type { ToolExecutor } from '../../executor-v2';
import type { WorkerTask, WorkerTaskResult } from './types';
import type { WorkerExecutor, WorkerHooks } from './router-worker';
import type { HarnessSnapshot, HarnessComponentKind } from './harness-files';

// ============================================================================
// Types
// ============================================================================

export interface SubAgentWorkerFactoryOptions {
  projectRoot: string;
  /** 项目信息（文件树等，与 REPL 的 projectInfo 同构） */
  projectInfo?: Record<string, string>;
  config: Config;
  /** 工具执行器（复用 REPL 的实例，包含注册表） */
  toolExecutor: ToolExecutor;
  /** 跳过规划直接执行（小任务提速） */
  skipPlanning?: boolean;
  /**
   * 经验摘要 getter（每次任务调用时取最新）。返回值注入 Worker 的
   * projectInfo（「历史经验」条目）——Improvement Harness Library 的消费口。
   */
  getExperienceSummary?: () => string | undefined;
  /**
   * harness 快照 getter。返回的 8 类组件内容注入 projectInfo，
   * Worker 的提示词随 harness 文件变化——Harness² 行为对比的生效前提：
   * 探针的 base/variant 快照差异必须真正到达模型。
   */
  getHarnessSnapshot?: () => HarnessSnapshot | undefined;
}

// ============================================================================
// Factory
// ============================================================================

/**
 * 创建基于 SubAgentCoordinator 的 WorkerExecutor。
 * 每次调用新建 coordinator（Worker 上下文隔离），确认请求经 hooks 上抛给 Router。
 */
export function createSubAgentWorkerExecutor(
  factoryOptions: SubAgentWorkerFactoryOptions
): WorkerExecutor {
  const { projectRoot, config, toolExecutor } = factoryOptions;

  return async (task: WorkerTask, hooks: WorkerHooks): Promise<WorkerTaskResult> => {
    hooks.reportProgress(`开始执行: ${task.requirement.slice(0, 60)}`, true);

    const { SubAgentCoordinator } = await import('../../agents/subagent');

    // 经验摘要 + harness 快照 → projectInfo 注入（每次调用取最新值）
    const context = {
      projectRoot,
      projectInfo: mergeWorkerContextExtras(
        factoryOptions.projectInfo ?? {},
        factoryOptions.getExperienceSummary?.(),
        factoryOptions.getHarnessSnapshot?.()
      ),
      config,
      toolRegistry: toolExecutor.getRegistry(),
      toolExecutor,
      signal: hooks.signal,
    };

    const coordinator = new SubAgentCoordinator(context as any);

    hooks.reportProgress('规划中…', false);

    const result = await coordinator.execute(task.requirement, {
      skipConfirmation: false,
      // 确认请求上抛：经 Router 的 ConfirmationQueue，等待期间会话不阻塞
      confirmationResolver: (title, detail) => hooks.requestConfirmation(title, detail),
    });

    const success = !!(
      result.planningResult.success &&
      (!result.executionResult || result.executionResult.success)
    );

    // Inline 最小结论 + Spill 详细输出（文章 3.3）
    const summaryParts: string[] = [];
    if (result.executionResult) {
      summaryParts.push(
        `执行${result.executionResult.success ? '成功' : '异常'}`,
        `${result.executionResult.toolCallsExecuted} 次工具调用`
      );
    } else if (!result.planningResult.success) {
      summaryParts.push('规划阶段失败');
    }
    summaryParts.push(`总计 ${(result.totalDuration / 1000).toFixed(1)}s`);

    return {
      success,
      summary: summaryParts.join('，'),
      detail: result.executionResult?.output || result.planningResult.output,
      tokensUsed:
        (result.planningResult.tokensUsed?.total ?? 0) +
        (result.executionResult?.tokensUsed?.total ?? 0),
    };
  };
}

// ============================================================================
// 上下文注入（经验 + harness → projectInfo）
// ============================================================================

/** 注入 projectInfo 的 harness 组件（全部、限量）；其余组件不在 Worker 提示词里。 */
const INJECTED_COMPONENTS: readonly HarnessComponentKind[] = [
  'system-prompt',
  'guardrails',
  'tool-guidance',
  'subagents',
  'memory-policy',
];

const COMPONENT_LABELS: Record<HarnessComponentKind, string> = {
  'system-prompt': '系统提示词（harness）',
  guardrails: '护栏约定（harness）',
  'memory-policy': '记忆策略（harness）',
  'tool-guidance': '工具使用指导（harness）',
  subagents: '子代理分工（harness）',
  skills: 'Skills（harness）',
  scripts: 'Scripts（harness）',
  plugins: 'Plugins（harness）',
};

/**
 * 把经验摘要与 harness 快照合并进 projectInfo（纯函数，可单测）。
 * 条目均为可选：没有经验/harness 时不产生空条目。
 */
export function mergeWorkerContextExtras(
  base: Record<string, string>,
  experienceSummary?: string,
  harnessSnapshot?: HarnessSnapshot
): Record<string, string> {
  const out = { ...base };
  if (experienceSummary && experienceSummary.trim() !== '') {
    out['历史经验（有执行证据支持，行动前参考）'] = truncateText(experienceSummary, 1600);
  }
  if (harnessSnapshot) {
    for (const kind of INJECTED_COMPONENTS) {
      const content = harnessSnapshot.files[kind]?.trim();
      // 只注入有实质内容的组件（默认脚手架占位不占上下文）
      if (content && !content.startsWith('# ' + COMPONENT_LABELS[kind].split('（')[0])) {
        out[COMPONENT_LABELS[kind]] = truncateText(content, 1200);
      }
    }
  }
  return out;
}

function truncateText(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}\n…（已截断，全文见 .kode/ 对应文件）`;
}
