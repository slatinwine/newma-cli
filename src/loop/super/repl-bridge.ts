/**
 * ReplSuperBridge — Super-router 与 REPL 的集成桥
 *
 * 职责：
 * - 惰性创建 SuperRouter（默认执行体 = SubAgentCoordinator 包装），
 *   挂 Watchdog 与状态持久化
 * - 把 confirmation-requested / worker-report 事件渲染到 REPL 终端
 * - 提供 /confirm /workers /stop 三个命令的处理入口
 *
 * 通过动态 import 挂进 repl.ts，避免 repl.ts 与本模块的循环依赖。
 */

import chalk from 'chalk';
import type { WorkerTask } from './types';
import { TriggerRouter, installDefaultNoiseRules } from './trigger-router';
import { SuperRouter, type WorkerHooks } from './router-worker';
import { Watchdog } from './watchdog';
import { SuperStateStore } from './state-store';
import { createLLMJudge } from './llm-judge';
import { installSecurityRules } from './security';
import { ExperienceStore, experienceFromWatchdog, experienceFromSpeculative } from './experience-store';
import { SpeculativeRunner } from './speculative-runner';
import { createHarnessStore, type HarnessFileStore, type HarnessSnapshot } from './harness-files';
import { HarnessProbe, type RunObservation } from './harness-probe';
import { createAutoProposer, type AutoProposer } from './auto-propose';
import { EventSourceBridge, type PollableEventSourceManager } from './event-source-bridge';

// ============================================================================
// REPL 松耦合接口（避免 import repl.ts 造成循环依赖）
// ============================================================================

export interface ReplHost {
  /** repl 实例的 session 字段（公开访问） */
  session: {
    getConfig(): any;
    getProjectRoot(): string;
  };
  /** repl 实例的 toolExecutor 字段（可能初始化前为 undefined） */
  toolExecutor?: any;
  getAbortSignal(): AbortSignal | undefined;
}

// ============================================================================
// Bridge
// ============================================================================

export class ReplSuperBridge {
  readonly triggerRouter: TriggerRouter;
  readonly router: SuperRouter;
  readonly store: SuperStateStore;
  readonly experience: ExperienceStore;
  readonly harness: HarnessFileStore;
  readonly probe: HarnessProbe;
  readonly speculative: SpeculativeRunner;
  private watchdog: Watchdog;
  private autoProposer: AutoProposer | null = null;
  private eventBridges: Array<{ bridge: EventSourceBridge; manager: PollableEventSourceManager; sourceIds: string[] }> = [];
  /** 探针运行期间的 harness 快照覆盖（base/variant 真正到达模型） */
  private snapshotOverride?: HarnessSnapshot;

  private constructor(private readonly repl: ReplHost) {
    const config = repl.session.getConfig();

    // 语义层 judge：chatAI 慢路径（LLM 不可用时自动降级 candidate）
    const judge = createLLMJudge(config, {
      policy:
        '这是开发者的本地 CLI 助手。只对明确的构建失败、测试失败、用户此前交办事项的后续事件返回 act；' +
        '文档与注释改动、格式化、临时文件返回 ignore；拿不准返回 candidate。',
    });

    // Fast Path：预置噪音滤除 + 安全规则（凭据文件 ignore）
    this.triggerRouter = new TriggerRouter(judge, { debug: false });
    installDefaultNoiseRules(this.triggerRouter);
    installSecurityRules(this.triggerRouter);

    // Worker 执行体：复用 REPL 的 toolExecutor，包装 SubAgentCoordinator。
    // 惰性创建：toolExecutor 可能在 REPL 初始化后才就绪；ESM 下用动态 import。
    // 经验摘要与 harness 快照每次任务时注入 projectInfo（Improvement Library 消费口）。
    const toolExecutor = repl.toolExecutor;
    const projectRoot = repl.session.getProjectRoot();
    let realExecutor: import('./router-worker').WorkerExecutor | null = null;

    const executor: import('./router-worker').WorkerExecutor = async (task, hooks) => {
      if (!toolExecutor) {
        return { success: false, summary: '工具执行器未就绪，无法启动 Worker' };
      }
      if (!realExecutor) {
        const { createSubAgentWorkerExecutor } = await import('./worker-adapter');
        realExecutor = createSubAgentWorkerExecutor({
          projectRoot,
          config,
          toolExecutor,
          getExperienceSummary: () => this.experience.summarize(15),
          getHarnessSnapshot: () => this.snapshotOverride ?? this.harness.snapshot(),
        });
      }
      return realExecutor(task, hooks);
    };

    this.router = new SuperRouter(this.triggerRouter, executor, {
      maxConcurrentWorkers: 4,
      confirmationPolicy: 'wait',
      actOnTriggers: true,
    });

    // Watchdog：10 分钟一轮，15 分钟无实质进展判 stalled
    this.watchdog = this.router.attachWatchdog({
      intervalMs: 10 * 60 * 1000,
      stalledAfterMs: 15 * 60 * 1000,
    });

    // 状态持久化：.kode/super/state.json（文章 5.1）
    this.store = new SuperStateStore(projectRoot, { debounceMs: 2000 });
    this.store.attachTo(this.router, this.triggerRouter);
    this.store.restoreInto(this.router, this.triggerRouter);

    // —— 自我改进三件套（Harness²/RRSI）——
    // harness 文件化：.kode/harness/ 八组件（幂等，已有文件不动）
    this.harness = createHarnessStore(projectRoot);
    this.harness.scaffold();

    // 经验层：Watchdog 判定 + 投机结论自动沉淀
    this.experience = new ExperienceStore(projectRoot);
    this.watchdog.on('verdict', (v: { taskId: string; status: string; reason: string }) => {
      experienceFromWatchdog(this.experience, v);
    });

    this.probe = new HarnessProbe(this.harness, this.experience);

    // 投机执行（复用 Router 的异步底座），结论沉淀经验
    this.speculative = new SpeculativeRunner(this.router.asyncTasks);
    this.speculative.on('outcome', (o: { type: string; label: string; reason?: string }) => {
      experienceFromSpeculative(this.experience, o);
    });

    // —— 事件渲染到终端 ——
    this.router.on('worker-report', ({ taskId, summary, success }) => {
      const tag = success ? chalk.green('✅ Worker') : chalk.red('❌ Worker');
      console.log(`\n${tag} [${taskId.slice(0, 14)}] ${summary}\n`);
    });

    this.router.on('confirmation-requested', ({ id, title }) => {
      console.log(
        `\n${chalk.yellow('⚠️  等待确认')} [${chalk.bold(id)}] ${title}` +
        `\n   处理: ${chalk.cyan(`/confirm ${id} yes`)} 或 ${chalk.cyan(`/confirm ${id} no`)}（期间可继续其他操作）\n`
      );
    });

    this.router.asyncTasks.on('task-event', (ev: any) => {
      if (ev.type === 'completed') {
        console.log(chalk.gray(`\n⏱️  后台任务完成: ${ev.label}（${(ev.durationMs / 1000).toFixed(1)}s）`));
      }
    });
  }

  /** REPL 实例上的惰性单例。 */
  static get(repl: ReplHost): ReplSuperBridge {
    const host = repl as any;
    if (!host.__superBridge) {
      host.__superBridge = new ReplSuperBridge(repl);
    }
    return host.__superBridge as ReplSuperBridge;
  }

  // ------------------------------------------------------------------
  // 命令处理（返回 true 表示命令已被本桥接消费）
  // ------------------------------------------------------------------

  async handleCommand(cmd: string, args: string): Promise<boolean> {
    switch (cmd) {
      case '/confirm':
        return this.handleConfirm(args);
      case '/workers':
        return this.handleWorkers();
      case '/stop':
        return this.handleStop(args);
      case '/improve':
        return this.handleImprove(args);
      case '/watch':
        return this.handleWatch(args);
      default:
        return false;
    }
  }

  private handleConfirm(args: string): boolean {
    const [id, decision] = args.trim().split(/\s+/);
    if (!id || !decision) {
      const pending = this.router.listPendingConfirmations();
      if (pending.length === 0) {
        console.log(chalk.gray('当前没有待确认项。'));
      } else {
        console.log(chalk.yellow(`待确认 ${pending.length} 项：`));
        for (const p of pending) {
          console.log(`  [${chalk.bold(p.id)}] ${p.title}`);
        }
        console.log(chalk.gray(`用法: /confirm <id> yes|no`));
      }
      return true;
    }

    const ok = this.router.resolveConfirmation(id, /^(y|yes|是)$/i.test(decision));
    console.log(ok ? chalk.green(`已处理确认 ${id}`) : chalk.red(`未找到确认项 ${id}`));
    return true;
  }

  private handleWorkers(): boolean {
    const tasks = this.router.listTasks();
    const pending = this.router.listPendingConfirmations();

    console.log(chalk.cyan('\n👷 Worker 任务（Router/Worker 双层调度）'));
    console.log(chalk.gray('─'.repeat(56)));

    if (tasks.length === 0) {
      console.log(chalk.gray('  （暂无任务。环境事件或后续指令将自动创建任务）'));
    }
    for (const t of tasks.slice(0, 20)) {
      const icon: Record<string, string> = {
        queued: '⏳', running: '⚡', 'awaiting-confirmation': '⚠️ ',
        done: '✅', failed: '❌', cancelled: '🚫',
      };
      const dur = t.startedAt
        ? `，${(((t.finishedAt ?? Date.now()) - t.startedAt) / 1000).toFixed(0)}s`
        : '';
      console.log(`  ${icon[t.state] ?? '•'} [${t.state}] ${t.id} ${chalk.gray(`(${t.origin}${dur})`)}`);
      console.log(`     ${t.requirement.slice(0, 70)}`);
      if (t.lastProgress) {
        console.log(chalk.gray(`     进展: ${t.lastProgress.note.slice(0, 60)}`));
      }
    }
    if (pending.length > 0) {
      console.log(chalk.yellow(`\n  ⚠️  ${pending.length} 项待确认 → /confirm 查看`));
    }
    console.log('');
    return true;
  }

  private handleStop(args: string): boolean {
    const id = args.trim();
    if (!id) {
      const running = this.router.listTasks('running');
      if (running.length === 0) {
        console.log(chalk.gray('当前没有运行中的 Worker 任务。'));
      } else {
        console.log('运行中的任务：');
        for (const t of running) console.log(`  ${t.id}  ${t.requirement.slice(0, 60)}`);
        console.log(chalk.gray('用法: /stop <taskId>'));
      }
      return true;
    }
    const ok = this.router.cancelTask(id);
    console.log(ok ? chalk.green(`已终止 ${id}`) : chalk.red(`无法终止 ${id}（不存在或已结束）`));
    return true;
  }

  // ------------------------------------------------------------------
  // 自我改进与事件驱动（/improve、/watch）
  // ------------------------------------------------------------------

  /** /improve <任务描述>：LLM 自动提案 → 闸门 → 行为对比 → 采纳/拒绝（全程异步，不阻塞会话）。 */
  private async handleImprove(args: string): Promise<boolean> {
    const task = args.trim();
    if (!task) {
      console.log(chalk.gray('用法: /improve <任务描述>（描述一类想让 Agent 做得更好的任务）'));
      return true;
    }
    console.log(chalk.cyan(`🔬 自我改进启动：${task.slice(0, 50)}`));
    console.log(chalk.gray('   流程：LLM 提案 → 防过拟合闸门 → base/variant 行为对比 → 有证据才采纳'));

    try {
      const proposer = await this.getAutoProposer();
      const outcome = await proposer.proposeAndProbe(task, (t, snap, signal) => this.runProbeTask(t, snap, signal));
      this.renderProbeOutcome(outcome);
    } catch (err: any) {
      console.log(chalk.red(`自我改进失败: ${err?.message || err}`));
    }
    return true;
  }

  /** /watch <path>|off：把文件监听事件接进 TriggerRouter（事件驱动入口）。 */
  private async handleWatch(args: string): Promise<boolean> {
    const target = args.trim();
    if (!target || target === 'off') {
      if (this.eventBridges.length === 0) {
        console.log(chalk.gray('用法: /watch <路径>（监听目录/文件，变更事件将进入 Trigger 路由）；/watch off 全部停止'));
        return true;
      }
      for (const entry of this.eventBridges) {
        entry.bridge.stop();
      }
      for (const entry of this.eventBridges) {
        (entry.manager as unknown as { stopAll?: () => void }).stopAll?.();
      }
      const n = this.eventBridges.length;
      this.eventBridges = [];
      console.log(chalk.green(`已停止 ${n} 个事件桥`));
      return true;
    }

    try {
      const { EventSourceManager } = await import('../../loop/event/event-source-manager');
      const manager = new EventSourceManager({ debug: false });
      const sourceId = manager.addFileWatcher({ watchPath: target, recursive: true });
      manager.startSource(sourceId);
      const bridge = new EventSourceBridge(manager, this.triggerRouter);
      bridge.start();
      this.eventBridges.push({ bridge, manager, sourceIds: [sourceId] });
      console.log(chalk.green(`👀 正在监听 ${target}（变更事件将经 Fast Path/Slow Path 路由；/workers 查看触发任务，/watch off 停止）`));
    } catch (err: any) {
      console.log(chalk.red(`监听失败: ${err?.message || err}`));
    }
    return true;
  }

  private async getAutoProposer(): Promise<AutoProposer> {
    if (!this.autoProposer) {
      const { createAutoProposer } = await import('./auto-propose');
      this.autoProposer = createAutoProposer(
        this.repl.session.getConfig(),
        this.harness,
        this.experience,
        this.probe
      );
    }
    return this.autoProposer;
  }

  /** 探针执行体：用指定 harness 快照跑一次 SubAgent Worker（确认自动拒绝，不阻塞）。 */
  private async runProbeTask(task: string, snap: HarnessSnapshot, signal: AbortSignal): Promise<RunObservation> {
    const toolExecutor = this.repl.toolExecutor;
    if (!toolExecutor) {
      return { success: false, summary: '工具执行器未就绪，探针无法执行' };
    }
    const { createSubAgentWorkerExecutor } = await import('./worker-adapter');
    const exec = createSubAgentWorkerExecutor({
      projectRoot: this.repl.session.getProjectRoot(),
      config: this.repl.session.getConfig(),
      toolExecutor,
      getHarnessSnapshot: () => snap,
    });
    const hooks = {
      reportProgress: () => {},
      // 探针运行不等用户确认：拒绝 = 保守路径（RRSI 纪律）
      requestConfirmation: async () => false,
      signal,
    } as unknown as WorkerHooks;
    const probeTask: WorkerTask = {
      id: `probe-${Date.now()}`,
      requirement: task,
      origin: 'trigger',
      state: 'running',
      createdAt: Date.now(),
    };
    const result = await exec(probeTask, hooks);
    return { success: result.success, summary: result.summary, tokensUsed: result.tokensUsed };
  }

  private renderProbeOutcome(outcome: import('./harness-probe').ProbeOutcome | null): void {
    if (!outcome) {
      console.log(chalk.yellow('⚠️  LLM 提案阶段失败（超时/格式），未产生任何 harness 变更'));
      return;
    }
    const icon: Record<string, string> = {
      adopted: chalk.green('✅ 采纳'),
      'rejected-by-critic': chalk.yellow('🛡️  闸门拒绝'),
      'no-effect': chalk.gray('➖ 无行为差异'),
      regression: chalk.red('📉 回归'),
      'probe-failed': chalk.red('💥 探针失败'),
    };
    console.log(`\n${icon[outcome.verdict] ?? outcome.verdict} ${chalk.bold(outcome.task.slice(0, 50))}`);
    for (const note of outcome.notes.slice(0, 5)) {
      console.log(chalk.gray(`   · ${note}`));
    }
    if (outcome.adoptedKinds && outcome.adoptedKinds.length > 0) {
      console.log(chalk.green(`   已落盘组件: ${outcome.adoptedKinds.join(', ')}（.kode/harness/，自动留档可回滚）`));
    }
    console.log(chalk.gray('   全程结论已沉淀经验库（.kode/super/experience.jsonl）\n'));
  }

  /** 会话退出清理。 */
  async dispose(): Promise<void> {
    for (const entry of this.eventBridges) entry.bridge.stop();
    this.eventBridges = [];
    this.watchdog.stop();
    await this.router.asyncTasks.dispose();
    await this.store.dispose(this.router, this.triggerRouter);
  }
}

/**
 * repl.ts 的接入点：在 handleSpecialCommand 的 default 分支前调用。
 * 返回 true 表示命令已被 Super 子系统消费。
 */
export async function handleSuperCommand(repl: ReplHost, cmd: string, args: string): Promise<boolean> {
  if (!['/confirm', '/workers', '/stop', '/improve', '/watch'].includes(cmd)) return false;
  try {
    return await ReplSuperBridge.get(repl).handleCommand(cmd, args);
  } catch (err: any) {
    console.log(chalk.red(`Super 子系统命令失败: ${err?.message || err}`));
    return true;
  }
}
