# Super-agent 子系统（v3.5 增量）

> 参照 DeepSeek Harness《Super-agent 设计探索：迈向更自主的 Agent 系统》五模块的最小可用实现。
> 代码位置：`src/loop/super/`，测试：`test-super-agent.test.ts`（65 个用例全过）。
>
> v3.6 增量：吸收 Google Research **Harness²**（arXiv 2610.14224，Recursive Agent
> Harnessing）与 **RRSI**（正则化递归自我改进）的思想，补上自我改进四件套：
> harness 文件化、经验层、行为对比探针、防过拟合闸门。

## 模块总览

| 文件 | 对应文章章节 | 职责 |
|---|---|---|
| `types.ts` | — | Trigger / Thread / WorkerTask / WatchdogVerdict 共享类型 |
| `async-task-runner.ts` | 4.1 异步 ReAct Loop | `start()/stop()` 全双工：长耗时任务后台跑，完成事件投递回会话 |
| `confirmation-queue.ts` | 4.1 全双工交互 | 非阻塞确认队列，替代 inquirer 阻塞确认 |
| `trigger-router.ts` | 3.1 / 3.2 事件驱动 | 程序层 Fast Path + 语义层 Slow Path 两级过滤；Thread 订阅直通 |
| `router-worker.ts` | 2.1 / 2.2 双层架构 | Router 只分派不执行；Worker 隔离并发；忙时 Trigger 批量积压（Batching） |
| `watchdog.ts` | 第 6 节 Watchdog | 外部 Control Loop：无实质进展检测 + 可选 LLM 精判，判定落盘 `.kode/watchdog/` |
| `context-injector.ts` | 3.3 上下文组织 | Inline & Spill + 链式召回：窗口当 Cache 管理，超预算截断留续读引用 |
| `state-store.ts` | 5.1 计算状态分离 | 任务/Thread 状态持久化到 `.kode/super/state.json`（原子写 + 防抖），重启恢复 |
| `speculative-runner.ts` | 3.4 投机执行 | 静默复现并修复：后台先干，成功且干净才交付，否则保持安静 |
| `security.ts` | 8.4 安全与隐私 | Trigger 任务权限降档 + 外部内容不可信边界（提示词注入缓解）+ 凭据路径拦截 |
| `llm-judge.ts` | 3.1 语义层 | chatAI 适配为 SemanticJudge，JSON 解析容错 + 超时降级 candidate |
| `worker-adapter.ts` | 2.2 Worker 层 | SubAgentCoordinator 包装为 WorkerExecutor（确认走非阻塞队列） |
| `repl-bridge.ts` | 4.2 多信道 | REPL 集成桥：/confirm /workers /stop 三命令 + 事件终端渲染 + Watchdog/持久化自动挂载 |
| `harness-files.ts` | Harness²: 8 类可编辑组件 | harness 文件化：`.kode/harness/` 下 8 个组件文件，覆盖自动留档 `.history/` 可回滚；快照哈希与 diff |
| `experience-store.ts` | Harness²: Improvement Harness Library | 经验层：Watchdog 判定/投机丢弃/harness 采纳拒绝沉淀为 append-only JSONL，`summarize()` 可 Inline 进上下文 |
| `harness-probe.ts` | Harness²: Propose–Probe–Compose | 行为对比探针：同一任务在 base/variant harness 下各跑一次，只有可观察正向差异才采纳落盘，全部结论入经验库 |
| `overfit-guard.ts` | RRSI | 防过拟合闸门：编辑预算递减、critic 拒绝 benchmark 硬编码/背题/复杂度膨胀、行为对比三路判定 |
| `event-source-bridge.ts` | 3.2 事件驱动 | EventSourceManager → Trigger 桥：后台泵 + 三来源转换 + 去重窗口 + 每分钟限流，`/watch <path>` 一键启用 |
| `auto-propose.ts` | Harness² 全自动 | LLM 自动提案：任务+经验+harness 快照 → chatAI 出 JSON 提案 → 解析校验 → 自动走完 Gate/Probe/Compose |

## 自我改进回路（v3.6，Harness²/RRSI 思想）

```
Propose（人/LLM 出 HarnessEditProposal）
  → Gate（OverfitGuard：预算递减 + 拒背题/硬编码/膨胀）
  → Probe（HarnessProbe：base 与 variant 同任务各跑一次，行为对比）
  → Compose（judgeContrast 三路判定：adopt 落盘 .kode/harness/，
            no-effect/regression 保持安静）
  → Experience（全程结论沉淀 .kode/super/experience.jsonl，
               summarize() 可注入上下文指导下次任务）
```

关键纪律（与两条研究线一致）：
- **安全边界在代码层**：`.kode/harness/` 里的 guardrails 是提示层软护栏，不是安全边界（Harness² 同样警告）。
- **无证据不采纳**：修改必须产生可观察的正向行为差异，否则不落盘。
- **拒绝不静默**：critic 拒绝总是给出 reasons，并记入经验库供人工 override。
- **注入到达模型**：经验摘要与 harness 快照每次任务经 `mergeWorkerContextExtras` 注入 Worker 的 projectInfo——探针的 base/variant 差异真正到达模型，对比的是行为不是噪声。
- **探针不等确认**：probe 运行期间确认自动拒绝（保守路径），不阻塞会话。

```typescript
import { createHarnessStore, createExperienceStore, HarnessProbe } from './loop/super';

const harness = createHarnessStore(projectRoot);
harness.scaffold(); // 初始化 .kode/harness/ 的 8 个组件文件
const experience = createExperienceStore(projectRoot);
const probe = new HarnessProbe(harness, experience);

const outcome = await probe.proposeProbeCompose('修登录页空指针', [{
  name: '先测试后提交',
  edits: [{ kind: 'tool-guidance', oldContent, newContent }],
  declaredEffect: 'tool-sequencing',
}], { runTask: (task, harnessSnapshot, signal) => runWorker(task, harnessSnapshot, signal) });
// outcome.verdict: 'adopted' | 'rejected-by-critic' | 'no-effect' | 'regression' | 'probe-failed'
```

## 快速上手

```typescript
import { TriggerRouter, SuperRouter, installDefaultNoiseRules } from './loop/super';

// 1. 事件路由：程序层噪音滤除 + LLM 语义判断
const triggerRouter = new TriggerRouter(async (trigger) => {
  // Slow Path：交给 LLM 判断是否需要行动（返回 'act' | 'candidate' | 'ignore'）
  return llmJudgeTrigger(trigger);
}, { debug: true });
installDefaultNoiseRules(triggerRouter); // node_modules/.git/dist 等噪音直接滤除

// 2. 双层架构：Router 分派，Worker 执行
const router = new SuperRouter(triggerRouter, async (task, hooks) => {
  hooks.reportProgress('开始分析需求');
  const ok = await hooks.requestConfirmation('要修改文件吗？', diffPreview);
  // ...调用 ExecutionSubAgent / 子进程执行...
  return { success: true, summary: '完成了xxx' };
}, {
  maxConcurrentWorkers: 4,        // Worker 并发上限
  confirmationPolicy: 'wait',     // wait | auto-approve | deny
  actOnTriggers: true,            // 环境事件可自动创建任务（文章 3.4 入口）
});

// 3. 挂载 Watchdog（外部控制回路）
const watchdog = router.attachWatchdog({
  intervalMs: 10 * 60 * 1000,     // 10 分钟查一次
  stalledAfterMs: 15 * 60 * 1000, // 15 分钟无实质进展 → stalled
  llmJudge,                        // 可选：LLM 精判是否真的卡死
});

// 4. 交互侧（REPL/Web 前端）
router.on('worker-report', ({ taskId, summary, success }) => {
  // Worker 的结论只经这里对外输出（Router 统一交互，文章 2.2）
});
router.on('confirmation-requested', ({ id, title }) => {
  // 显示待确认项，用户决定后：router.resolveConfirmation(id, true/false)
});

// 5. 两个入口
router.submitUserTask('写一个登录页');          // 人类指令
await triggerRouter.route(fileChangeEvent);    // 环境事件（Trigger）
await router.drainTriggers();                  // 批量处理积压 Trigger（Batching）
```

## 关键设计决策

1. **Worker 不直接输出**：执行细节隔离在 Worker 内，结论统一经 `worker-report` 出去——为将来接入 IM/GitHub 等多信道留好了口子（文章 4.2）。
2. **订阅直通省 token**：同一 Thread 的后续事件直接投给订阅 Worker，不过 Router。文章消融实验：直通节省约 37% Router token。
3. **Batching**：Router 忙时 Trigger 自动积压，`drainTriggers()` 一轮合并处理；事件越密集，单个决定分摊的调度开销越低。
4. **投机执行友好**：`actOnTriggers: true` + 「确认策略 deny/auto-approve」组合即可实现「静默复现并修复」：先后台干，确认有干净结果才交付。
5. **零外部依赖**：六个模块只用 Node 内置模块，可独立单测（已验证）。

## 与现有代码的集成状态

- ✅ `SubAgentCoordinator` 支持注入 `confirmationResolver`（非阻塞确认），未注入时保持原 inquirer 行为，完全向后兼容
- ✅ `SuperRouter.attachWatchdog()` 一行挂载 Watchdog
- ✅ REPL 集成（repl-bridge.ts）：`/confirm <id> yes|no`、`/workers`、`/stop <taskId>` 三个命令已接入 handleSpecialCommand；`confirmation-requested` / `worker-report` 事件自动渲染到终端；Watchdog 与状态持久化随桥接自动挂载
- ✅ chatAI 语义层 judge（llm-judge.ts，含超时/解析降级）
- ✅ WorkerExecutor 包装 SubAgentCoordinator（worker-adapter.ts）
- ✅ EventSourceManager 的事件源接到 `triggerRouter.route()`（event-source-bridge.ts；REPL `/watch <path>` 启用，`/watch off` 停止）
- ✅ `experience.summarize()` 注入 Worker 上下文（worker-adapter 每次 任务 时取最新值）
- ✅ Watchdog / SpeculativeRunner 结论自动沉淀经验（experienceFromWatchdog / experienceFromSpeculative）
- ✅ LLM 自动提案（auto-propose.ts；REPL `/improve <任务>` 一条命令跑完全回路）
- ⬜ `context-injector` 接入 callAI 的 projectInfo 构建（当前为独立模块，可选接入）
- ⬜ auto-propose 的 LLM 提案质量依赖提示词打磨（默认策略已保守，可用 policy 定向）

## REPL 命令

| 命令 | 作用 |
|---|---|
| `/workers` | 查看 Worker 任务列表与进展（Router/Worker 双层调度状态） |
| `/confirm` | 列出待确认项；`/confirm <id> yes\|no` 批准/拒绝，等待期间会话不阻塞 |
| `/stop <taskId>` | 终止运行中的 Worker 任务 |
| `/improve <任务描述>` | 全自动自我改进：LLM 提案 → 防过拟合闸门 → base/variant 行为对比 → 有证据才采纳落盘（异步不阻塞会话） |
| `/watch <path>` | 监听目录/文件，变更事件进入 Trigger 路由（去重+限流）；`/watch off` 停止 |

## 已知问题（预先存在，与本次改动无关）

- `package.json` 声明 `"type": "module"`，但根目录 `jest.config.js` 是 CommonJS，`npm test` 会报 `module is not defined in ES module scope`。临时绕过：用 `.cjs` 配置文件运行 jest。
- `src/ai.ts` 存在 `@types/node-fetch` 与全局 `AbortSignal` 的类型错配报错（tsc 直编时可见）。
