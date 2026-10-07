/**
 * 优化轮次测试：对话续接 / 先验回流 / 自动结算 / 存量修复
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { BranchTreeManager } from '../src/memory/branch-tree-manager';
import { filterActiveMessages } from '../src/memory/session-context-manager';
import { SessionRecord } from '../src/memory/session-context-types';
import { decideAutoAction } from '../src/memory/precipitation-coordinator';
import { generateDiff } from '../src/review-mode';
import { RollbackManager } from '../src/rollback';

function makeTempProject(withGit: boolean): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'newma-fix-'));
  if (withGit) {
    execFileSync('git', ['init'], { cwd: dir });
    execFileSync('git', ['config', 'user.email', 't@t.com'], { cwd: dir });
    execFileSync('git', ['config', 'user.name', 't'], { cwd: dir });
    fs.writeFileSync(path.join(dir, 'a.txt'), 'v1\n');
    execFileSync('git', ['add', '-A'], { cwd: dir });
    execFileSync('git', ['commit', '-m', 'init'], { cwd: dir });
  }
  return dir;
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('🎲 跨会话先验回流（价值网络）', () => {
  let dir: string;
  let mgr: BranchTreeManager;

  beforeEach(async () => {
    dir = makeTempProject(false);
    mgr = new BranchTreeManager(dir);
    await mgr.initialize();
  });

  afterEach(() => cleanup(dir));

  test('历史会话同类决策的战绩成为新决策先验', async () => {
    // 历史"周目"：增量方案 3 胜，全量重写 1 负
    const hist = [
      { opt: '增量方案', reward: 'succeeded' as const },
      { opt: '增量方案', reward: 'succeeded' as const },
      { opt: '增量方案', reward: 'succeeded' as const },
      { opt: '全量重写', reward: 'failed' as const },
    ];
    for (const h of hist) {
      const node = await mgr.recordDecision({
        sessionId: 'hist-1',
        type: 'plan-selection',
        prompt: '重构购物车模块',
        options: [
          { id: 'inc', label: '增量方案' },
          { id: 'full', label: '全量重写' },
        ],
        selectedOptionId: h.opt === '增量方案' ? 'inc' : 'full',
      });
      await mgr.setOutcome('hist-1', node.id, h.reward);
    }

    // 新会话遇到相似决策
    const priors = await mgr.getCrossSessionPriors(
      '重构购物车模块',
      [
        { id: 'a', label: '增量方案' },
        { id: 'b', label: '全量重写' },
      ],
      'new-session'
    );

    expect(priors).not.toBeNull();
    // 增量方案胜率高 → 先验更高
    expect(priors!['a']).toBeGreaterThan(priors!['b']);
    // 归一化
    expect(priors!['a'] + priors!['b']).toBeCloseTo(1, 5);
  });

  test('不相似的决策不产生先验（null → 调用方退化为均匀）', async () => {
    const node = await mgr.recordDecision({
      sessionId: 'hist-2',
      type: 'plan-selection',
      prompt: '数据库迁移到 postgres',
      options: [{ id: 'x', label: '蓝绿部署' }, { id: 'y', label: '停机迁移' }],
      selectedOptionId: 'x',
    });
    await mgr.setOutcome('hist-2', node.id, 'succeeded');

    const priors = await mgr.getCrossSessionPriors(
      '给页面加暗色模式',
      [{ id: 'a', label: 'CSS 变量' }, { id: 'b', label: '主题类库' }],
      'new-session'
    );
    expect(priors).toBeNull();
  });

  test('排除当前会话（excludeSessionId）', async () => {
    const node = await mgr.recordDecision({
      sessionId: 'me',
      type: 'plan-selection',
      prompt: '重构购物车模块',
      options: [{ id: 'a', label: '增量方案' }, { id: 'b', label: '全量重写' }],
      selectedOptionId: 'a',
    });
    await mgr.setOutcome('me', node.id, 'failed');

    const priors = await mgr.getCrossSessionPriors(
      '重构购物车模块',
      [{ id: 'a', label: '增量方案' }, { id: 'b', label: '全量重写' }],
      'me' // 排除自己
    );
    expect(priors).toBeNull();
  });
});

describe('🎮 结局自动结算', () => {
  let dir: string;
  let mgr: BranchTreeManager;
  const SID = 'auto-close';

  beforeEach(async () => {
    dir = makeTempProject(false);
    mgr = new BranchTreeManager(dir);
    await mgr.initialize();
  });

  afterEach(() => cleanup(dir));

  test('closeActiveBranches 批量结算并反传', async () => {
    const n1 = await mgr.recordDecision({
      sessionId: SID, type: 'plan-selection', prompt: 'p1',
      options: [{ id: 'a', label: 'A' }], selectedOptionId: 'a',
    });
    const n2 = await mgr.recordDecision({
      sessionId: SID, type: 'replan', prompt: 'p2',
      options: [{ id: 'b', label: 'B' }], selectedOptionId: 'b',
    });
    await mgr.recordDecision({
      sessionId: SID, type: 'save', prompt: 'save',
      options: [{ id: 's', label: 'save' }], selectedOptionId: 's',
    });

    const closed = await mgr.closeActiveBranches(SID, 'session ended');
    expect(closed).toBe(2); // save 节点不算

    const tree = await mgr.getTree(SID);
    // n1 的选项统计收到两次反传：自身结算(0.25) + 子节点 n2 结算(0.25)
    const n1opt = tree.nodes.find((n) => n.id === n1.id)!.options[0].stats;
    expect(n1opt?.visits).toBe(2);
    expect(n1opt?.value).toBe(0.5);
    // n2 自身结局与自身选项统计
    const n2node = tree.nodes.find((n) => n.id === n2.id)!;
    expect(n2node.outcome).toBe('abandoned');
    expect(n2node.visits).toBe(1);
    expect(n2node.options[0].stats?.value).toBe(0.25);
  });
});

describe('🕘 活跃消息过滤（纯函数）', () => {
  const mk = (n: number, ranges: SessionRecord['abandonedRanges']): SessionRecord => ({
    id: 's', startTime: '', title: '', tags: [], status: 'active', projectRoot: '',
    messages: Array.from({ length: n }, (_, i) => ({
      id: `m${i}`, role: 'user' as const, content: `c${i}`,
      timestamp: '', sessionId: 's',
    })),
    stats: { messageCount: n, totalTokens: 0, userMessageCount: n, assistantMessageCount: 0 },
    abandonedRanges: ranges,
  });

  test('剔除废弃区间，保留区间外消息', () => {
    const session = mk(5, [{ fromMessageId: 'm1', toMessageId: 'm3' }]);
    const active = filterActiveMessages(session);
    expect(active.map((m) => m.id)).toEqual(['m0', 'm4']);
  });

  test('多区间与无效区间（找不到的消息 ID）', () => {
    const session = mk(6, [
      { fromMessageId: 'm1', toMessageId: 'm2' },
      { fromMessageId: 'm4', toMessageId: 'm4' },
      { fromMessageId: 'ghost', toMessageId: 'm5' }, // 无效，忽略
    ]);
    expect(filterActiveMessages(session).map((m) => m.id)).toEqual(['m0', 'm3', 'm5']);
  });

  test('null 会话与无区间', () => {
    expect(filterActiveMessages(null)).toEqual([]);
    expect(filterActiveMessages(mk(2, undefined)).map((m) => m.id)).toEqual(['m0', 'm1']);
  });
});

describe('⏰ precipitation 自动审批方向', () => {
  test('低于 autoApproveBelow 批准；高于 autoRejectAbove 拒绝；中间不动', () => {
    const cfg = { autoApproveBelow: 0.4, autoRejectAbove: 0.95 };
    expect(decideAutoAction(0.3, cfg)).toBe('approve');
    expect(decideAutoAction(0.7, cfg)).toBeNull();
    expect(decideAutoAction(0.99, cfg)).toBe('reject');
    // 旧实现在这里会全错：0.3 会 reject、0.99 会 approve
  });

  test('未配置阈值不动；边界值不触发（严格不等号）', () => {
    expect(decideAutoAction(0.9, {})).toBeNull();
    const cfg = { autoApproveBelow: 0.4 };
    expect(decideAutoAction(0.4, cfg)).toBeNull();
    expect(decideAutoAction(0.399, cfg)).toBe('approve');
  });
});

describe('📝 review-mode LCS diff', () => {
  test('头部插入一行只报 1 处新增（旧实现会全线误报）', () => {
    const old = 'line1\nline2\nline3\nline4\nline5';
    const now = 'INSERTED\nline1\nline2\nline3\nline4\nline5';
    const diff = generateDiff('f.txt', old, now);

    expect(diff).toContain('+ INSERTED');
    expect(diff).not.toContain('- line1'); // 未删除任何行
    expect(diff).toContain('+1 / -0');
  });

  test('中间修改一行正确显示 +/- 对', () => {
    const old = 'a\nb\nc\nd';
    const now = 'a\nB\nc\nd';
    const diff = generateDiff('f.txt', old, now);
    expect(diff).toContain('- b');
    expect(diff).toContain('+ B');
    expect(diff).toContain('+1 / -1');
  });

  test('删除尾部行', () => {
    const diff = generateDiff('f.txt', 'a\nb\nc', 'a\nb');
    expect(diff).toContain('- c');
    expect(diff).toContain('+0 / -1');
  });
});

describe('📦 checkpoint 排除运行时目录', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTempProject(true);
  });

  afterEach(() => cleanup(dir));

  test('checkpoint 提交不包含 .memo/.kode，即使有变更', async () => {
    const mgr = new RollbackManager(dir);
    // 源码变更 + 运行时目录变更
    fs.writeFileSync(path.join(dir, 'src-change.txt'), 'code\n');
    fs.mkdirSync(path.join(dir, '.memo'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.memo', 'index.json'), '{}');

    expect(mgr.hasUncommittedChanges()).toBe(true); // src-change.txt 算

    const hash = await mgr.createRestorePoint('test');
    expect(hash).toBeTruthy();

    // checkpoint 只含源码变更
    const files = execFileSync('git', ['show', '--name-only', '--format=', 'HEAD'], {
      cwd: dir, encoding: 'utf-8',
    }).trim().split('\n');
    expect(files).toContain('src-change.txt');
    expect(files.some((f) => f.startsWith('.memo'))).toBe(false);
  });

  test('只有 .memo 变更时不产生空 checkpoint', async () => {
    const mgr = new RollbackManager(dir);
    fs.mkdirSync(path.join(dir, '.memo'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.memo', 'x.json'), '{}');

    expect(mgr.hasUncommittedChanges()).toBe(false); // 运行时数据不算
    const hash = await mgr.createRestorePoint('test');
    expect(hash).toBeNull();
  });
});

describe('📋 TaskStatus running 落地', () => {
  test('updateReasoning 后任务从 pending 变 running', async () => {
    const { TaskTracker } = await import('../src/task-tracker/tracker');
    const { TaskStorage } = await import('../src/task-tracker/storage');
    const dir = makeTempProject(false);
    try {
      const storage = new TaskStorage({
        dataDir: path.join(dir, 'tasks'),
        compressAfterDays: 30,
        compressionLevel: 9,
        algorithm: 'gzip',
      });
      const tracker = new TaskTracker(storage);
      const task = tracker.startTask('demo-req', 'plan', 'sess-1', dir);
      expect(task.status).toBe('pending');

      await tracker.updateReasoning({ algorithm: 'tot', plan: ['step1'] });
      expect(tracker.getCurrentTask()!.status).toBe('running');
      expect(tracker.getCurrentTask()!.metadata.status).toBe('running');
    } finally {
      cleanup(dir);
    }
  });
});
