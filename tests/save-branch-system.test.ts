/**
 * 🎮 存档 + 分支树 + 时间旅行系统测试
 *
 * 验证：
 * - SavePointManager：创建/列出/查找/滚动清理
 * - BranchTreeManager：决策记录/结局/flags/废弃分支/前世记忆/树渲染
 * - SessionContextManager：parentMessageId/废弃区间/活跃消息过滤
 * - TimeTravelManager：真实 git 仓库中的存档与无损回跳
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { SavePointManager } from '../src/memory/save-point-manager';
import { BranchTreeManager } from '../src/memory/branch-tree-manager';
import { SessionContextManager } from '../src/memory/session-context-manager';
import { TimeTravelManager } from '../src/time-travel';
import { RollbackManager } from '../src/rollback';

function makeTempProject(withGit: boolean): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'newma-test-'));
  if (withGit) {
    execFileSync('git', ['init'], { cwd: dir });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
    execFileSync('git', ['config', 'user.name', 'test'], { cwd: dir });
    fs.writeFileSync(path.join(dir, 'a.txt'), 'v1\n');
    execFileSync('git', ['add', '-A'], { cwd: dir });
    execFileSync('git', ['commit', '-m', 'init'], { cwd: dir });
  }
  return dir;
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('🎮 SavePointManager', () => {
  let dir: string;
  let mgr: SavePointManager;

  beforeEach(async () => {
    dir = makeTempProject(false);
    mgr = new SavePointManager(dir);
    await mgr.initialize();
  });

  afterEach(() => cleanup(dir));

  test('创建快速存档与命名存档，可按 id/名称查找', async () => {
    const quick = await mgr.createSavePoint({ sessionId: 's1', messageCount: 3 });
    const named = await mgr.createSavePoint({ sessionId: 's1', name: 'before-refactor', messageCount: 5 });

    expect(quick.auto).toBe(true);
    expect(named.auto).toBe(false);

    const byId = await mgr.getSavePoint(named.id);
    const byName = await mgr.getSavePoint('before-refactor');
    expect(byId?.id).toBe(named.id);
    expect(byName?.id).toBe(named.id);

    const all = await mgr.listSavePoints();
    expect(all).toHaveLength(2);
    // 最新在前
    expect(all[0].id).toBe(named.id);
  });

  test('自动存档超出上限时滚动清理最旧的', async () => {
    for (let i = 0; i < 25; i++) {
      await mgr.createSavePoint({ sessionId: 's1', messageCount: i });
    }
    const saves = await mgr.listSavePoints();
    expect(saves.length).toBeLessThanOrEqual(20);
  });

  test('deleteSavePoint 删除指定存档', async () => {
    const sp = await mgr.createSavePoint({ sessionId: 's1' });
    expect(await mgr.deleteSavePoint(sp.id)).toBe(true);
    expect(await mgr.getSavePoint(sp.id)).toBeNull();
    expect(await mgr.deleteSavePoint(sp.id)).toBe(false);
  });
});

describe('🌳 BranchTreeManager', () => {
  let dir: string;
  let mgr: BranchTreeManager;
  const SID = 'sess-test-1';

  beforeEach(async () => {
    dir = makeTempProject(false);
    mgr = new BranchTreeManager(dir);
    await mgr.initialize();
  });

  afterEach(() => cleanup(dir));

  test('记录决策点：选项快照 + 未选项保留 + 父子链', async () => {
    const root = await mgr.recordDecision({
      sessionId: SID,
      type: 'plan-selection',
      prompt: '重构登录模块',
      options: [
        { id: 'execute', label: '执行计划A' },
        { id: 'modify', label: '修改需求' },
        { id: 'cancel', label: '取消' },
      ],
      selectedOptionId: 'execute',
    });

    const child = await mgr.recordDecision({
      sessionId: SID,
      type: 'replan',
      prompt: '执行失败，重规划',
      options: [{ id: 'retry', label: '换方案B' }],
      selectedOptionId: 'retry',
    });

    expect(child.parentDecisionId).toBe(root.id);
    expect(root.options).toHaveLength(3); // 未选项保留为潜在分支
  });

  test('结局回填与废弃标记', async () => {
    const node = await mgr.recordDecision({
      sessionId: SID,
      type: 'plan-selection',
      prompt: '选方案',
      options: [{ id: 'a', label: 'A' }],
      selectedOptionId: 'a',
    });

    expect(await mgr.setOutcome(SID, node.id, 'failed', '依赖冲突')).toBe(true);

    const tree = await mgr.getTree(SID);
    expect(tree.nodes[0].outcome).toBe('failed');
    expect(tree.nodes[0].outcomeNote).toBe('依赖冲突');
  });

  test('abandonSubsequent 把后续 active 节点批量标记废弃', async () => {
    const n1 = await mgr.recordDecision({ sessionId: SID, type: 'plan-selection', prompt: 'p1', options: [] });
    await mgr.recordDecision({ sessionId: SID, type: 'replan', prompt: 'p2', options: [] });
    await mgr.recordDecision({ sessionId: SID, type: 'retry', prompt: 'p3', options: [] });

    const count = await mgr.abandonSubsequent(SID, n1.id, 'rewound');
    expect(count).toBe(2);

    const tree = await mgr.getTree(SID);
    expect(tree.nodes.filter((n) => n.outcome === 'abandoned')).toHaveLength(2);
    expect(tree.nodes.find((n) => n.id === n1.id)!.outcome).toBe('active');
  });

  test('flags：设置/覆盖/清除 + 注入格式', async () => {
    await mgr.setFlag(SID, 'state-lib', 'zustand:confirmed');
    await mgr.setFlag(SID, 'style', 'no-class-components');
    await mgr.setFlag(SID, 'state-lib', 'jotai:updated'); // 覆盖

    let flags = await mgr.getFlags(SID);
    expect(flags).toHaveLength(2);
    expect(flags.find((f) => f.key === 'state-lib')!.value).toBe('jotai:updated');

    const ctx = await mgr.getFlagContext(SID);
    expect(ctx).toContain('SESSION FLAGS');
    expect(ctx).toContain('jotai:updated');

    expect(await mgr.clearFlag(SID, 'style')).toBe(true);
    flags = await mgr.getFlags(SID);
    expect(flags).toHaveLength(1);
  });

  test('前世记忆：被弃分支结论格式化', async () => {
    const n = await mgr.recordDecision({
      sessionId: SID,
      type: 'plan-selection',
      prompt: '升级 webpack 到 v5',
      options: [{ id: 'a', label: '直接升级' }],
      selectedOptionId: 'a',
    });
    await mgr.setOutcome(SID, n.id, 'abandoned', '插件不兼容，回退');

    const ctx = await mgr.getAbandonedBranchContext(SID);
    expect(ctx).toContain('PRIOR BRANCH MEMORY');
    expect(ctx).toContain('升级 webpack');
    expect(ctx).toContain('插件不兼容');
  });

  test('renderTree 输出流程图（含未选项与当前标记）', async () => {
    const n1 = await mgr.recordDecision({
      sessionId: SID,
      type: 'plan-selection',
      prompt: '选状态管理方案',
      options: [
        { id: 'a', label: 'zustand' },
        { id: 'b', label: 'redux' },
      ],
      selectedOptionId: 'a',
    });
    await mgr.recordDecision({
      sessionId: SID,
      type: 'user-choice',
      prompt: '确认风格',
      options: [{ id: 'x', label: '确认' }],
      selectedOptionId: 'x',
    });

    const text = await mgr.renderTree(SID);
    expect(text).toContain('zustand');
    expect(text).toContain(' redux'); // 未选项显示为 untaken
    expect(text).toContain('◀ current');
    expect(text).toContain('◌ [untaken]');
    void n1;
  });

  test('活跃会话标记跨实例可读', async () => {
    await mgr.setActiveSession(SID);
    // 新实例（模拟另一进程）读取
    const other = new BranchTreeManager(dir);
    expect(await other.getActiveSessionId()).toBe(SID);
  });
});

describe('💬 SessionContextManager 分支语义', () => {
  let dir: string;
  let mgr: SessionContextManager;
  const SID = 'sess-ctx-1';

  beforeEach(async () => {
    dir = makeTempProject(false);
    mgr = new SessionContextManager(dir);
    await mgr.initialize();
    await mgr.createSession(SID);
  });

  afterEach(() => cleanup(dir));

  test('消息默认线性链接 parentMessageId', async () => {
    await mgr.addMessage('user', 'hello 1');
    await mgr.addMessage('assistant', 'hi 1');

    const session = mgr.getCurrentSession()!;
    expect(session.messages[0].parentMessageId).toBeUndefined();
    expect(session.messages[1].parentMessageId).toBe(session.messages[0].id);
  });

  test('markAbandonedFrom 后 getActiveMessages 剔除废弃区间', async () => {
    await mgr.addMessage('user', 'm1');
    await mgr.addMessage('user', 'm2');
    await mgr.addMessage('user', 'm3');
    const session = mgr.getCurrentSession()!;
    const [m1] = session.messages;

    const marked = await mgr.markAbandonedFrom(m1.id, 'rewind');
    expect(marked).toBe(true);

    const active = mgr.getActiveMessages();
    expect(active.map((m) => m.content)).toEqual(['m1']);
    expect(session.messages).toHaveLength(3); // 消息保留不删
    expect(session.abandonedRanges).toHaveLength(1);
  });

  test('时间旅行后新消息挂到回跳目标（树语义）', async () => {
    await mgr.addMessage('user', 'm1');
    await mgr.addMessage('user', 'm2');
    const session = mgr.getCurrentSession()!;
    const m1 = session.messages[0];

    await mgr.markAbandonedFrom(m1.id);
    await mgr.addMessage('system', '⏪ rewound', undefined, m1.id);

    const last = mgr.getLastMessage()!;
    expect(last.parentMessageId).toBe(m1.id);
    expect(mgr.getActiveMessages().map((m) => m.content)).toEqual(['m1', '⏪ rewound']);
  });

  test('restoreSession 把历史会话加载为当前', async () => {
    await mgr.addMessage('user', 'old session msg');
    await mgr.endSession();

    const restored = await mgr.restoreSession(SID);
    expect(restored).not.toBeNull();
    expect(restored!.status).toBe('active');
    expect(mgr.getCurrentSession()!.messages[0].content).toBe('old session msg');
  });
});

describe('⏪ TimeTravelManager（真实 git 仓库）', () => {
  let dir: string;
  let sessionCtx: SessionContextManager;
  let rollback: RollbackManager;
  let branchTree: BranchTreeManager;
  let travel: TimeTravelManager;
  const SID = 'sess-tt-1';

  beforeEach(async () => {
    dir = makeTempProject(true);
    sessionCtx = new SessionContextManager(dir);
    await sessionCtx.initialize();
    await sessionCtx.createSession(SID);
    rollback = new RollbackManager(dir);
    branchTree = new BranchTreeManager(dir);
    await branchTree.initialize();
    travel = new TimeTravelManager(dir, sessionCtx, rollback, branchTree);
  });

  afterEach(() => cleanup(dir));

  test('createSave 绑定 git hash + 消息 + flags', async () => {
    await sessionCtx.addMessage('user', 'requirement');
    await branchTree.setFlag(SID, 'lib', 'vue');

    const save = await travel.createSave({ sessionId: SID, name: 'v1' });

    expect(save.gitHash).toBeTruthy();
    expect(save.messageId).toBeTruthy();
    expect(save.flags['lib']).toBe('vue');

    const found = await travel.getSavePointManager().getSavePoint('v1');
    expect(found?.id).toBe(save.id);
  });

  test('backTo 无损回跳：旧分支保全 + 新分支检出 + 会话剔除', async () => {
    // 初始状态存档
    await sessionCtx.addMessage('user', 'start');
    const anchorMsg = sessionCtx.getLastMessage()!;
    const node = await branchTree.recordDecision({
      sessionId: SID,
      type: 'plan-selection',
      prompt: '方案选择',
      options: [{ id: 'a', label: 'A' }],
      selectedOptionId: 'a',
      messageId: anchorMsg.id,
      gitHash: rollback.getCurrentHash() ?? undefined,
    });

    // 模拟执行：新文件 + 新提交 + 新消息 + 后续决策
    fs.writeFileSync(path.join(dir, 'feature.txt'), 'new work\n');
    rollback.commitPending('feature work');
    await sessionCtx.addMessage('assistant', 'feature done');
    await branchTree.recordDecision({ sessionId: SID, type: 'retry', prompt: 'later', options: [] });

    const beforeHash = rollback.getCurrentHash();
    const target = await travel.targetFromDecision(SID, node.id);
    expect(target).not.toBeNull();

    const result = await travel.backTo(SID, target!);

    expect(result.success).toBe(true);
    expect(result.preservedBranch).toMatch(/^kode\/branch-/);
    expect(result.rewindBranch).toMatch(/^kode\/rewind-/);
    expect(result.abandonedDecisions).toBe(1);
    expect(result.abandonedMessages).toBe(1);

    // 旧工作在保全分支上
    const onPreserve = execFileSync(
      'git', ['cat-file', '-p', `${result.preservedBranch}:feature.txt`], { cwd: dir, encoding: 'utf-8' }
    );
    expect(onPreserve).toContain('new work');

    // 工作区回退（feature.txt 消失），但旧 commit 未被删除
    expect(fs.existsSync(path.join(dir, 'feature.txt'))).toBe(false);
    expect(rollback.getCurrentHash()).not.toBe(beforeHash);

    // AI 上下文剔除废弃消息，但文件保留
    const active = sessionCtx.getActiveMessages();
    expect(active.map((m) => m.content)).toEqual(['start', expect.stringContaining('Time Travel')]);
    expect(sessionCtx.getCurrentSession()!.messages.length).toBe(3);

    // 前世记忆包含被弃决策
    const memory = await branchTree.getAbandonedBranchContext(SID);
    expect(memory).toContain('retry');
  });

  test('loadSave 跨会话读档：消息 + flags + git 恢复', async () => {
    // 构造一个历史会话
    const oldCtx = new SessionContextManager(dir);
    await oldCtx.initialize();
    await oldCtx.createSession('sess-old');
    await oldCtx.addMessage('user', 'old requirement');
    const save = await travel.createSave({ sessionId: 'sess-old', name: 'checkpoint-1' });

    // 模拟后续漂移：新提交
    fs.writeFileSync(path.join(dir, 'drift.txt'), 'drift\n');
    rollback.commitPending('drift');

    const result = await travel.loadSave(SID, save);
    expect(result.success).toBe(true);

    // 当前会话切换为旧会话
    expect(sessionCtx.getCurrentSession()!.id).toBe('sess-old');
    expect(rollback.getCurrentHash()).toBe(save.gitHash);
    expect(fs.existsSync(path.join(dir, 'drift.txt'))).toBe(false);
  });
});

describe('🎲 MCTS 引擎（AlphaZero PUCT）', () => {
  let dir: string;
  let mgr: BranchTreeManager;
  const SID = 'sess-mcts-1';

  beforeEach(async () => {
    dir = makeTempProject(false);
    mgr = new BranchTreeManager(dir);
    await mgr.initialize();
  });

  afterEach(() => cleanup(dir));

  test('结局反传：奖励沿父链更新祖先的选项统计与子树统计', async () => {
    const root = await mgr.recordDecision({
      sessionId: SID,
      type: 'plan-selection',
      prompt: 'root choice',
      options: [
        { id: 'a', label: '方案A' },
        { id: 'b', label: '方案B' },
      ],
      selectedOptionId: 'a',
    });
    const child = await mgr.recordDecision({
      sessionId: SID,
      type: 'retry',
      prompt: 'child retry',
      options: [{ id: 'x', label: '重试' }],
      selectedOptionId: 'x',
    });

    // 子节点成功 → reward 1.0 反传到 root
    await mgr.setOutcome(SID, child.id, 'succeeded');

    const tree = await mgr.getTree(SID);
    const rootNode = tree.nodes.find((n) => n.id === root.id)!;
    const optA = rootNode.options.find((o) => o.id === 'a')!;

    expect(optA.stats).toBeDefined();
    expect(optA.stats!.visits).toBe(1);
    expect(optA.stats!.value).toBe(1.0);
    expect(rootNode.visits).toBe(1);
    expect(rootNode.value).toBe(1.0);
    expect(rootNode.outcome).toBe('active'); // 祖先自身结局不被子结算覆盖

    // 未选选项不加统计
    const optB = rootNode.options.find((o) => o.id === 'b')!;
    expect(optB.stats?.visits ?? 0).toBe(0);
  });

  test('奖励映射：succeeded=1 / abandoned=0.25 / failed=0', async () => {
    for (const [outcome, expected] of [
      ['succeeded', 1.0],
      ['abandoned', 0.25],
      ['failed', 0.0],
    ] as const) {
      const n = await mgr.recordDecision({
        sessionId: SID,
        type: 'plan-selection',
        prompt: `p-${outcome}`,
        options: [{ id: 'o', label: 'opt' }],
        selectedOptionId: 'o',
      });
      await mgr.setOutcome(SID, n.id, outcome);
      const tree = await mgr.getTree(SID);
      const node = tree.nodes.find((x) => x.id === n.id)!;
      expect(node.value).toBe(expected);
    }
  });

  test('重复设置结局不重复计数', async () => {
    const n = await mgr.recordDecision({
      sessionId: SID,
      type: 'plan-selection',
      prompt: 'p',
      options: [{ id: 'o', label: 'opt' }],
      selectedOptionId: 'o',
    });
    await mgr.setOutcome(SID, n.id, 'succeeded');
    await mgr.setOutcome(SID, n.id, 'failed'); // 覆盖结局但不重复反传

    const tree = await mgr.getTree(SID);
    const node = tree.nodes.find((x) => x.id === n.id)!;
    expect(node.visits).toBe(1);
    expect(node.value).toBe(1.0); // 首次结算的奖励保留
    expect(node.outcome).toBe('failed'); // 结局标签已更新
  });

  test('PUCT：有先验时，未访问选项按先验排序；访问后高 Q 占优', async () => {
    const node = await mgr.recordDecision({
      sessionId: SID,
      type: 'plan-selection',
      prompt: '选库',
      options: [
        { id: 'solid', label: '成熟库' },
        { id: 'new', label: '新库' },
      ],
      selectedOptionId: 'solid',
      priors: { solid: 0.4, new: 0.6 }, // AI 评估更看好新库
    });

    // 零访问：纯先验探索项主导 → new（P=0.6）应排第一
    let ranked = mgr.scoreOptions(node);
    expect(ranked[0].option.id).toBe('new');

    // solid 被选中且成功一次 → Q=1，parentN=1
    await mgr.setOutcome(SID, node.id, 'succeeded');
    const tree = await mgr.getTree(SID);
    const updated = tree.nodes.find((n) => n.id === node.id)!;
    ranked = mgr.scoreOptions(updated);

    // Q(solid)=1 + 探索项(prior·√1/2 ≈ 0.42) vs new 0 + 探索项(0.6·√1/1 = 0.6)
    // solid ≈ 1.42 > new ≈ 0.6 → 利用主导
    expect(ranked[0].option.id).toBe('solid');
  });

  test('UCB1：无先验时未访问选项优先（sqrt(ln/0) → ∞ 需兜底）', async () => {
    const node = await mgr.recordDecision({
      sessionId: SID,
      type: 'plan-selection',
      prompt: 'p',
      options: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      selectedOptionId: 'a',
    });
    await mgr.setOutcome(SID, node.id, 'succeeded');

    const tree = await mgr.getTree(SID);
    const updated = tree.nodes.find((n) => n.id === node.id)!;
    const ranked = mgr.scoreOptions(updated);

    // 全部有限分数，A（已访问 Q=1）与 B（未访问）都有合理 score
    expect(ranked).toHaveLength(2);
    expect(ranked.every((r) => Number.isFinite(r.score))).toBe(true);
  });

  test('getRecommendation 返回 exploit/explore 与注入文本', async () => {
    const n1 = await mgr.recordDecision({
      sessionId: SID,
      type: 'plan-selection',
      prompt: '方案选择',
      options: [
        { id: 'a', label: '方案A' },
        { id: 'b', label: '方案B' },
        { id: 'c', label: '方案C' },
      ],
      selectedOptionId: 'a',
      priors: { a: 0.5, b: 0.3, c: 0.2 },
    });
    await mgr.setOutcome(SID, n1.id, 'succeeded');

    const rec = await mgr.getRecommendation(SID);
    expect(rec).not.toBeNull();
    expect(rec!.exploit?.option.id).toBe('a'); // Q=1 已知最优
    expect(rec!.explore?.option).toBeDefined(); // B/C 未访问

    const ctx = await mgr.getRecommendationContext(SID);
    expect(ctx).toContain('BRANCH EXPLORATION STATS');
    expect(ctx).toContain('方案A');
    expect(ctx).toContain('Best known');
  });

  test('🎲 树内重访：同签名决策点复用节点，统计正确归属', async () => {
    const opts = [
      { id: 'a', label: '方案A' },
      { id: 'b', label: '方案B' },
    ];

    // 第一次：选 A，失败
    const first = await mgr.recordDecision({
      sessionId: SID, type: 'plan-selection', prompt: '重构登录模块',
      options: opts, selectedOptionId: 'a',
    });
    await mgr.setOutcome(SID, first.id, 'failed', '依赖冲突');

    // 重访：同提示同选项集，改选 B
    const second = await mgr.recordDecision({
      sessionId: SID, type: 'plan-selection', prompt: '重构登录模块',
      options: opts, selectedOptionId: 'b',
    });

    // 复用同一节点，非新建
    expect(second.id).toBe(first.id);
    const tree = await mgr.getTree(SID);
    expect(tree.nodes.filter((n) => n.type === 'plan-selection')).toHaveLength(1);

    const node = tree.nodes[0];
    expect(node.selectedOptionId).toBe('b');       // 切换到新选择
    expect(node.outcome).toBe('active');            // 结局重置待结算
    expect(node.presentedCount).toBe(2);            // 呈现两次
    expect(node.lastRevisitedAt).toBeDefined();
    expect(node.options.find((o) => o.id === 'a')!.stats).toEqual({ visits: 1, value: 0 }); // 统计保留

    // 第二次结算：成功 → 奖励归到本次实际选择的 B
    await mgr.setOutcome(SID, second.id, 'succeeded');

    const final = (await mgr.getTree(SID)).nodes[0];
    const A = final.options.find((o) => o.id === 'a')!.stats!;
    const B = final.options.find((o) => o.id === 'b')!.stats!;
    expect(A).toEqual({ visits: 1, value: 0 });     // A: 1 次失败
    expect(B).toEqual({ visits: 1, value: 1 });     // B: 1 次成功
    expect(final.visits).toBe(2);                   // 节点总结算 2 次
    expect(final.value).toBe(1);                    // Q(node) = 0.5
  });

  test('🎲 选项集不同则不合并（新计划 = 新决策点）', async () => {
    const first = await mgr.recordDecision({
      sessionId: SID, type: 'plan-selection', prompt: 'same prompt',
      options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
      selectedOptionId: 'a',
    });
    await mgr.setOutcome(SID, first.id, 'failed');

    // 不同的选项集（重新生成的计划选项不同）
    const second = await mgr.recordDecision({
      sessionId: SID, type: 'plan-selection', prompt: 'same prompt',
      options: [{ id: 'x', label: 'X' }, { id: 'y', label: 'Y' }, { id: 'z', label: 'Z' }],
      selectedOptionId: 'x',
    });

    expect(second.id).not.toBe(first.id);
    const tree = await mgr.getTree(SID);
    expect(tree.nodes).toHaveLength(2);
  });

  test('🎲 重访更新先验但不覆盖 N/W', async () => {
    const node = await mgr.recordDecision({
      sessionId: SID, type: 'plan-selection', prompt: 'p',
      options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
      selectedOptionId: 'a',
      priors: { a: 0.8, b: 0.2 },
    });
    await mgr.setOutcome(SID, node.id, 'succeeded');

    // 重访带新先验
    await mgr.recordDecision({
      sessionId: SID, type: 'plan-selection', prompt: 'p',
      options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
      selectedOptionId: 'b',
      priors: { a: 0.3, b: 0.7 },
    });

    const tree = await mgr.getTree(SID);
    const A = tree.nodes[0].options.find((o) => o.id === 'a')!.stats!;
    expect(A.visits).toBe(1);        // 统计保留
    expect(A.value).toBe(1);
    expect(A.prior).toBeCloseTo(0.3, 5); // 先验已更新（0.3/(0.3+0.7)）
  });

  test('🎲 重访后 getRecommendation 定位到重访节点（currentNodeId 上溯）', async () => {
    const d1 = await mgr.recordDecision({
      sessionId: SID, type: 'plan-selection', prompt: 'task-1',
      options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
      selectedOptionId: 'a',
    });
    await mgr.setOutcome(SID, d1.id, 'failed');

    // 之后做了别的任务（插入序更新的节点）
    const d2 = await mgr.recordDecision({
      sessionId: SID, type: 'plan-selection', prompt: 'task-2',
      options: [{ id: 'x', label: 'X' }],
      selectedOptionId: 'x',
    });
    await mgr.setOutcome(SID, d2.id, 'succeeded');

    // 回头重访 task-1 → currentNodeId 指回 d1（插入序更早）
    await mgr.recordDecision({
      sessionId: SID, type: 'plan-selection', prompt: 'task-1',
      options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
      selectedOptionId: 'b',
    });

    const rec = await mgr.getRecommendation(SID);
    expect(rec!.node.id).toBe(d1.id); // 不是插入序最新的 d2
    expect(rec!.node.presentedCount).toBe(2);
  });
});

describe('↩️ RollbackManager 修复项', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTempProject(true);
  });

  afterEach(() => cleanup(dir));

  test('rollback 默认不删未跟踪文件', async () => {
    const mgr = new RollbackManager(dir);
    const initial = mgr.getCurrentHash();

    // checkpoint 提交（tracked 修改）
    fs.writeFileSync(path.join(dir, 'tracked.txt'), 'changed\n');
    await mgr.createRestorePoint('test');

    // checkpoint 之后产生的未跟踪文件（不在任何 commit 里）
    fs.writeFileSync(path.join(dir, 'untracked-keep.txt'), 'keep me\n');

    await mgr.rollback(initial!);

    // 未跟踪文件幸存（旧实现 git clean -fd 会删掉它）
    expect(fs.existsSync(path.join(dir, 'untracked-keep.txt'))).toBe(true);
  });

  test('isKodeCheckpoint 区分 kode 与用户提交', () => {
    const mgr = new RollbackManager(dir);
    fs.writeFileSync(path.join(dir, 'b.txt'), 'x\n');
    const kodeHash = mgr.commitPending('kode: checkpoint: test');
    expect(mgr.isKodeCheckpoint(kodeHash!)).toBe(true);

    fs.writeFileSync(path.join(dir, 'c.txt'), 'y\n');
    const userHash = mgr.commitPending('feat: my own commit');
    expect(mgr.isKodeCheckpoint(userHash!)).toBe(false);
  });
});
