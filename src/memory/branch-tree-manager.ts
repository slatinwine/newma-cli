/**
 * Branch Tree Manager
 *
 * Galgame 分支决策树管理器（Phase 2/3）
 *
 * - 记录决策点：选项快照（含未选项）+ 选择理由
 * - 维护分支结局：succeeded/failed/abandoned
 * - 管理会话 flags（事件标记）
 * - 渲染 ASCII 决策流程图（galgame flowchart）
 * - 生成"前世记忆"：被弃分支的结论，读档后注入新分支上下文
 *
 * 存储：.memo/branches/<sessionId>.json + active.json（活跃会话标记）
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  DecisionNode,
  DecisionNodeType,
  DecisionOption,
  BranchOutcome,
  SessionFlag,
  BranchTreeRecord,
  ActiveSessionMarker,
  outcomeReward,
} from './branch-tree-types';

export interface RecordDecisionOptions {
  sessionId: string;
  type: DecisionNodeType;
  prompt: string;
  options: DecisionOption[];
  selectedOptionId?: string;
  selectionReason?: string;
  messageId?: string;
  gitHash?: string;
  /** 挂到指定父节点下；缺省为当前节点 */
  parentDecisionId?: string;
  /** 🎲 MCTS 先验概率（选项ID → 0-1，来自 AI 评估如 ToT 评分；缺省均匀） */
  priors?: Record<string, number>;
}

export class BranchTreeManager {
  private projectRoot: string;
  private branchesDir: string;
  private activeFile: string;
  private cache: Map<string, BranchTreeRecord> = new Map();

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.branchesDir = join(projectRoot, '.memo', 'branches');
    this.activeFile = join(this.branchesDir, 'active.json');
  }

  private recordFile(sessionId: string): string {
    // 防路径注入：sessionId 只允许安全字符
    const safe = sessionId.replace(/[^a-zA-Z0-9._-]/g, '_');
    return join(this.branchesDir, `${safe}.json`);
  }

  async initialize(): Promise<void> {
    if (!existsSync(this.branchesDir)) {
      await fs.mkdir(this.branchesDir, { recursive: true });
    }
  }

  /**
   * 设置活跃会话标记（REPL 启动时调用，供 ai.ts / precipitation 定位）
   */
  async setActiveSession(sessionId: string): Promise<void> {
    await this.initialize();
    const marker: ActiveSessionMarker = {
      sessionId,
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(this.activeFile, JSON.stringify(marker, null, 2), 'utf-8');
  }

  /**
   * 读取活跃会话 ID（无标记时返回 null）
   */
  async getActiveSessionId(): Promise<string | null> {
    try {
      if (!existsSync(this.activeFile)) return null;
      const marker: ActiveSessionMarker = JSON.parse(
        await fs.readFile(this.activeFile, 'utf-8')
      );
      return marker.sessionId;
    } catch {
      return null;
    }
  }

  /**
   * 加载（带缓存）某会话的分支树
   */
  async getTree(sessionId: string): Promise<BranchTreeRecord> {
    const cached = this.cache.get(sessionId);
    if (cached) return cached;

    const file = this.recordFile(sessionId);
    let record: BranchTreeRecord;

    if (existsSync(file)) {
      try {
        record = JSON.parse(await fs.readFile(file, 'utf-8'));
      } catch {
        record = this.emptyRecord(sessionId);
      }
    } else {
      record = this.emptyRecord(sessionId);
    }

    this.cache.set(sessionId, record);
    return record;
  }

  private emptyRecord(sessionId: string): BranchTreeRecord {
    return {
      sessionId,
      nodes: [],
      flags: [],
      currentNodeId: undefined,
      updatedAt: new Date().toISOString(),
    };
  }

  private async saveTree(record: BranchTreeRecord): Promise<void> {
    await this.initialize();
    record.updatedAt = new Date().toISOString();
    await fs.writeFile(
      this.recordFile(record.sessionId),
      JSON.stringify(record, null, 2),
      'utf-8'
    );
  }

  /**
   * 记录一个决策点
   *
   * priors：AlphaZero 的策略先验——AI 生成计划时的评估分可作为
   * 各选项的初始 P 值，让 PUCT 在零样本时就偏向更优选项。
   *
   * 🎲 MCTS 树内重访：同一决策点（同类型+同提示+同选项集）再次呈现时，
   * 不新建节点而是复用原节点——切换 selectedOptionId、重置结局、
   * 保留选项级 N/W 统计。这样重试的收益/失败正确累积到本次
   * 实际选择的选项上（标准 MCTS 的树内重访语义）。
   */
  async recordDecision(options: RecordDecisionOptions): Promise<DecisionNode> {
    const tree = await this.getTree(options.sessionId);

    // 尝试合并到既有决策点
    const existing = this.findRevisitCandidate(tree, options);
    if (existing) {
      existing.presentedCount = (existing.presentedCount ?? 1) + 1;
      existing.lastRevisitedAt = new Date().toISOString();
      existing.selectedOptionId = options.selectedOptionId ?? existing.selectedOptionId;
      existing.selectionReason = options.selectionReason ?? existing.selectionReason;
      existing.messageId = options.messageId ?? existing.messageId;
      existing.gitHash = options.gitHash ?? existing.gitHash;
      // 新一轮尝试进行中：重置结局，待结算后再次反传（统计不重置）
      if (existing.outcome !== 'active') {
        existing.outcome = 'active';
        existing.outcomeNote = undefined;
        existing.closedAt = undefined;
      }
      // 先验可更新，但绝不覆盖已积累的 N/W
      if (options.priors) {
        this.applyPriors(existing, options.priors);
      }
      tree.currentNodeId = existing.id;
      await this.saveTree(tree);
      return existing;
    }

    const optionList = options.options.map((o) => ({ ...o }));
    if (options.priors) {
      this.applyPriorsToOptions(optionList, options.priors);
    }

    const node: DecisionNode = {
      id: `dec-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .substring(2, 8)}`,
      sessionId: options.sessionId,
      type: options.type,
      prompt: options.prompt,
      options: optionList,
      selectedOptionId: options.selectedOptionId,
      selectionReason: options.selectionReason,
      parentDecisionId:
        options.parentDecisionId ?? tree.currentNodeId ?? undefined,
      outcome: 'active',
      messageId: options.messageId,
      gitHash: options.gitHash,
      createdAt: new Date().toISOString(),
      presentedCount: 1,
    };

    tree.nodes.push(node);
    tree.currentNodeId = node.id;
    await this.saveTree(tree);
    return node;
  }

  /**
   * 决策点签名：类型 + 提示 + 选项 ID 集
   * 同签名视为同一决策状态（MCTS 的 same state → same node）
   */
  private decisionSignature(
    type: DecisionNodeType,
    prompt: string,
    optionIds: string[]
  ): string {
    return `${type}|${prompt}|${[...optionIds].sort().join(',')}`;
  }

  /**
   * 查找可重访的既有决策点（同签名）
   */
  private findRevisitCandidate(
    tree: BranchTreeRecord,
    options: RecordDecisionOptions
  ): DecisionNode | null {
    const signature = this.decisionSignature(
      options.type,
      options.prompt,
      options.options.map((o) => o.id)
    );

    return (
      tree.nodes.find(
        (n) =>
          n.id !== options.parentDecisionId &&
          this.decisionSignature(
            n.type,
            n.prompt,
            n.options.map((o) => o.id)
          ) === signature
      ) ?? null
    );
  }

  /**
   * 对已存在节点更新先验（保留 N/W 统计）
   */
  private applyPriors(
    node: DecisionNode,
    priors: Record<string, number>
  ): void {
    for (const opt of node.options) {
      if (priors[opt.id] !== undefined) {
        opt.stats = opt.stats ?? { visits: 0, value: 0 };
        opt.stats.prior = Math.max(0, priors[opt.id]);
      }
    }
    // 归一化
    const total = node.options.reduce(
      (sum, o) => sum + (o.stats?.prior ?? 0),
      0
    );
    if (total > 0) {
      for (const o of node.options) {
        if (o.stats?.prior !== undefined) {
          o.stats.prior = o.stats.prior / total;
        }
      }
    }
  }

  /**
   * 对新建选项列表应用归一化先验
   */
  private applyPriorsToOptions(
    optionList: DecisionOption[],
    priors: Record<string, number>
  ): void {
    const total = optionList.reduce(
      (sum, o) => sum + Math.max(0, priors[o.id] ?? 0),
      0
    );
    const uniform = 1 / Math.max(1, optionList.length);
    for (const o of optionList) {
      const raw = Math.max(0, priors[o.id] ?? 0);
      o.stats = {
        visits: 0,
        value: 0,
        prior: total > 0 ? raw / total : uniform,
      };
    }
  }

  /**
   * 获取节点
   */
  async getNode(sessionId: string, nodeId: string): Promise<DecisionNode | null> {
    const tree = await this.getTree(sessionId);
    return tree.nodes.find((n) => n.id === nodeId) ?? null;
  }

  /**
   * 设置分支结局（galgame 的多结局记录）
   *
   * 🎲 结局结算同时触发 MCTS 反传：奖励沿 parentDecisionId 链上溯，
   * 更新每个祖先节点"当时所选选项"的 (N, W) 统计与节点级子树统计。
   */
  async setOutcome(
    sessionId: string,
    nodeId: string,
    outcome: BranchOutcome,
    note?: string
  ): Promise<boolean> {
    const tree = await this.getTree(sessionId);
    const node = tree.nodes.find((n) => n.id === nodeId);
    if (!node) return false;

    const previousOutcome = node.outcome;
    node.outcome = outcome;
    node.outcomeNote = note ?? node.outcomeNote;
    node.closedAt = new Date().toISOString();

    // 反传：新结算的结局才计入统计（重复设置不重复计数）
    if (previousOutcome === 'active') {
      const reward = outcomeReward(outcome);
      if (reward !== null) {
        this.backpropagate(tree, node, reward);
      }
    }

    await this.saveTree(tree);
    return true;
  }

  /**
   * MCTS 反传：从结算节点沿父链上溯
   * - 路径上每个节点的选中选项：stats.visits++ / stats.value += reward
   * - 路径上每个节点自身：visits++ / value += reward（子树统计）
   */
  private backpropagate(
    tree: BranchTreeRecord,
    from: DecisionNode,
    reward: number
  ): void {
    const byId = new Map(tree.nodes.map((n) => [n.id, n]));
    let cursor: DecisionNode | undefined = from;

    while (cursor) {
      cursor.visits = (cursor.visits ?? 0) + 1;
      cursor.value = (cursor.value ?? 0) + reward;

      if (cursor.selectedOptionId) {
        const opt = cursor.options.find((o) => o.id === cursor!.selectedOptionId);
        if (opt) {
          opt.stats = opt.stats ?? { visits: 0, value: 0 };
          opt.stats.visits += 1;
          opt.stats.value += reward;
        }
      }

      cursor = cursor.parentDecisionId
        ? byId.get(cursor.parentDecisionId)
        : undefined;
    }
  }

  // ─── 🎲 MCTS 推荐引擎（AlphaZero PUCT / 经典 UCB1） ───────────

  /**
   * 跨会话先验回流（AlphaZero 价值网络 analogue）
   *
   * 从历史所有会话的分支树中，找出与当前决策相似的历史决策点
   * （提示词相似 + 选项标签重叠），聚合各选项的 (N, W) 战绩，
   * 经拉普拉斯平滑后作为新决策点的初始先验 P。
   *
   * 这让沉淀系统的"攻略"从文档层面回流到行为层面：
   * 上周"增量方案 3 胜 1 负、全量重写 1 胜 3 负"会自动成为
   * 今天同类决策的先验。
   *
   * @returns 选项ID → 先验；无相似历史时返回 null（调用方跳过先验）
   */
  async getCrossSessionPriors(
    prompt: string,
    options: DecisionOption[],
    excludeSessionId?: string
  ): Promise<Record<string, number> | null> {
    if (options.length === 0) return null;

    // 聚合容器：按归一化选项标签匹配
    const labelStats = new Map<string, { n: number; w: number }>();
    let matchedDecisions = 0;

    const promptTokens = tokenize(prompt);

    const sessions = await this.listSessions();
    for (const sid of sessions) {
      if (sid === excludeSessionId) continue;

      const tree = await this.getTree(sid);
      for (const node of tree.nodes) {
        if (node.type !== 'plan-selection') continue;

        // 提示相似度：词集 Jaccard
        const sim = jaccard(promptTokens, tokenize(node.prompt));
        if (sim < 0.3) continue;

        // 选项标签重叠才可迁移统计
        const optionLabels = new Set(node.options.map((o) => normLabel(o.label)));
        const overlaps = options.filter((o) => optionLabels.has(normLabel(o.label)));
        if (overlaps.length < Math.min(2, options.length)) continue;

        matchedDecisions++;
        for (const opt of node.options) {
          if (!opt.stats || opt.stats.visits === 0) continue;
          const key = normLabel(opt.label);
          const agg = labelStats.get(key) ?? { n: 0, w: 0 };
          agg.n += opt.stats.visits;
          agg.w += opt.stats.value;
          labelStats.set(key, agg);
        }
      }
    }

    if (matchedDecisions === 0) return null;

    // 拉普拉斯平滑 → 归一化为先验分布
    // prior(o) = (W(o) + α·uniform) / (N(o) + α)，α=2（无数据时退化为均匀）
    const ALPHA = 2;
    const uniform = 1 / options.length;
    const raw = options.map((o) => {
      const s = labelStats.get(normLabel(o.label)) ?? { n: 0, w: 0 };
      return (s.w + ALPHA * uniform) / (s.n + ALPHA);
    });
    const total = raw.reduce((a, b) => a + b, 0);
    if (total <= 0) return null;

    const priors: Record<string, number> = {};
    options.forEach((o, i) => {
      priors[o.id] = raw[i] / total;
    });
    return priors;
  }

  /**
   * 从 currentNodeId 沿父链上溯，找最近的未废弃、有选项的计划选择节点
   */
  private nearestPlanSelection(tree: BranchTreeRecord): DecisionNode | null {
    const byId = new Map(tree.nodes.map((n) => [n.id, n]));
    let cursor = tree.currentNodeId
      ? byId.get(tree.currentNodeId)
      : undefined;

    while (cursor) {
      if (
        cursor.type === 'plan-selection' &&
        cursor.outcome !== 'abandoned' &&
        cursor.options.length > 0
      ) {
        return cursor;
      }
      cursor = cursor.parentDecisionId
        ? byId.get(cursor.parentDecisionId)
        : undefined;
    }
    return null;
  }

  /**
   * 计算某决策节点各选项的选择分
   *
   * PUCT（AlphaZero）：
   *   score = Q(s,a) + cPrior · P(a) · √N(s) / (1 + N(s,a))
   * 无先验时退化为 UCB1：
   *   score = Q(s,a) + cExplore · √( ln(N(s)+1) / (1 + N(s,a)) )
   *
   * 未访问选项 Q=0，靠先验/探索项获得高分 → 天然探索；
   * 高 Q 选项随访问增多占据主导 → 利用。
   */
  scoreOptions(
    node: DecisionNode,
    opts: { cPrior?: number; cExplore?: number } = {}
  ): Array<{ option: DecisionOption; score: number; q: number; n: number }> {
    const cPrior = opts.cPrior ?? 1.5;
    const cExplore = opts.cExplore ?? 1.4;
    // 虚拟首访问：父节点零结算时 √N=0 会让所有探索项归零、排序退化为插入序；
    // 按 AlphaZero 实现惯例以 max(N,1) 保证零样本时纯按先验排序
    const parentN = Math.max(node.visits ?? 0, 1);
    const hasPrior = node.options.some((o) => o.stats?.prior !== undefined);
    const uniform = 1 / Math.max(1, node.options.length);

    return node.options
      .map((option) => {
        const n = option.stats?.visits ?? 0;
        const w = option.stats?.value ?? 0;
        const q = n > 0 ? w / n : 0;

        let explore: number;
        if (hasPrior) {
          const p = option.stats?.prior ?? uniform;
          explore = cPrior * p * Math.sqrt(parentN) / (1 + n);
        } else {
          explore = cExplore * Math.sqrt(Math.log(parentN + 1) / (1 + n));
        }

        return { option, score: q + explore, q, n };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * 获取某节点的探索推荐（/next 命令与 AI 注入共用）
   */
  async getRecommendation(
    sessionId: string,
    nodeId?: string,
    opts: { cPrior?: number; cExplore?: number } = {}
  ): Promise<{
    node: DecisionNode;
    ranked: Array<{ option: DecisionOption; score: number; q: number; n: number }>;
    exploit: { option: DecisionOption; q: number } | null;
    explore: { option: DecisionOption } | null;
  } | null> {
    const tree = await this.getTree(sessionId);

    // 显式指定节点；否则从当前位置沿父链上溯找最近的计划选择节点
    // （重访合并后节点保持首次创建的插入序，"最新插入"会找错）；
    // 兜底：任意位置最近的未废弃计划选择节点
    const node = nodeId
      ? tree.nodes.find((n) => n.id === nodeId)
      : this.nearestPlanSelection(tree) ??
        [...tree.nodes]
          .reverse()
          .find(
            (n) =>
              n.type === 'plan-selection' &&
              n.outcome !== 'abandoned' &&
              n.options.length > 0
          );

    if (!node || node.options.length === 0) return null;

    const ranked = this.scoreOptions(node, opts);

    // exploit：访问过且 Q 最高的选项
    const visited = ranked.filter((r) => r.n > 0);
    const exploit = visited.length
      ? { option: visited.reduce((a, b) => (b.q > a.q ? b : a)).option, q: Math.max(...visited.map((v) => v.q)) }
      : null;

    // explore：未访问选项中得分最高的（PUCT 综合了先验）
    const unvisited = ranked.filter((r) => r.n === 0);
    const explore = unvisited.length ? { option: unvisited[0].option } : null;

    return { node, ranked, exploit, explore };
  }

  /**
   * MCTS 推荐的注入格式（进入 plan 生成的上下文）
   */
  async getRecommendationContext(sessionId: string): Promise<string> {
    const rec = await this.getRecommendation(sessionId);
    if (!rec) return '';

    const parts: string[] = [];
    for (const r of rec.ranked.slice(0, 5)) {
      const prior = r.option.stats?.prior !== undefined
        ? ` P=${r.option.stats.prior.toFixed(2)}`
        : '';
      parts.push(
        `- [${r.option.label}] Q=${r.q.toFixed(2)} N=${r.n}${prior} → score ${r.score.toFixed(2)}`
      );
    }

    let advice = '';
    if (rec.exploit && rec.explore) {
      advice =
        `Best known: "${rec.exploit.option.label}" (Q=${rec.exploit.q.toFixed(2)}). ` +
        `Unexplored alternative worth trying: "${rec.explore.option.label}".`;
    } else if (rec.exploit) {
      advice = `Best known: "${rec.exploit.option.label}" (Q=${rec.exploit.q.toFixed(2)}).`;
    } else if (rec.explore) {
      advice = `No option has a settled outcome yet; start with "${rec.explore.option.label}".`;
    }

    return (
      `\n\n🎲 BRANCH EXPLORATION STATS (MCTS over this session's decision tree):\n` +
      `Decision: "${rec.node.prompt.slice(0, 60)}" (tried ${rec.node.visits ?? 0}x)\n` +
      parts.join('\n') +
      `\n${advice}\n` +
      `Balance exploitation (high Q) and exploration (low N) when choosing.\n`
    );
  }

  /**
   * 关闭某节点之后的所有 active 分支（时间旅行时旧分支批量标记 abandoned）
   */
  async abandonSubsequent(
    sessionId: string,
    fromNodeId: string,
    note?: string
  ): Promise<number> {
    const tree = await this.getTree(sessionId);
    const from = tree.nodes.find((n) => n.id === fromNodeId);
    if (!from) return 0;

    let count = 0;
    for (const node of tree.nodes) {
      if (
        node.outcome === 'active' &&
        new Date(node.createdAt).getTime() >=
          new Date(from.createdAt).getTime() &&
        node.id !== fromNodeId
      ) {
        node.outcome = 'abandoned';
        node.outcomeNote = note ?? node.outcomeNote;
        node.closedAt = new Date().toISOString();
        count++;
      }
    }
    if (count > 0) await this.saveTree(tree);
    return count;
  }

  /**
   * 结局自动结算：会话结束时把所有残留 active 的决策分支
   * 批量标记 abandoned（MCTS 统计完整性——未关闭的分支不参与反传，
   * 不结算会漏掉整个会话的战绩）
   */
  async closeActiveBranches(
    sessionId: string,
    note = 'session ended'
  ): Promise<number> {
    const tree = await this.getTree(sessionId);
    let count = 0;

    for (const node of tree.nodes) {
      if (node.outcome === 'active' && node.type !== 'save') {
        node.outcome = 'abandoned';
        node.outcomeNote = note;
        node.closedAt = new Date().toISOString();
        // 结算奖励走反传（abandoned = 0.25，有信息量但未完成）
        const reward = outcomeReward('abandoned');
        if (reward !== null) this.backpropagate(tree, node, reward);
        count++;
      }
    }

    if (count > 0) await this.saveTree(tree);
    return count;
  }

  // ─── Flags（galgame 事件标记） ───────────────────────────────

  /**
   * 设置 flag（同 key 覆盖）
   */
  async setFlag(
    sessionId: string,
    key: string,
    value: string,
    source: 'user' | 'ai' = 'user',
    messageId?: string
  ): Promise<void> {
    const tree = await this.getTree(sessionId);
    const existing = tree.flags.find((f) => f.key === key);
    if (existing) {
      existing.value = value;
      existing.source = source;
      existing.createdAt = new Date().toISOString();
    } else {
      tree.flags.push({
        key,
        value,
        source,
        messageId,
        createdAt: new Date().toISOString(),
      });
    }
    await this.saveTree(tree);
  }

  /**
   * 清除 flag
   */
  async clearFlag(sessionId: string, key: string): Promise<boolean> {
    const tree = await this.getTree(sessionId);
    const before = tree.flags.length;
    tree.flags = tree.flags.filter((f) => f.key !== key);
    if (tree.flags.length === before) return false;
    await this.saveTree(tree);
    return true;
  }

  /**
   * 读取全部 flags（含快照覆盖：读档时传入历史 flags）
   */
  async getFlags(sessionId: string): Promise<SessionFlag[]> {
    const tree = await this.getTree(sessionId);
    return [...tree.flags];
  }

  /**
   * 用存档快照整体覆盖 flags（/load 时用）
   */
  async restoreFlags(
    sessionId: string,
    flags: Record<string, string>
  ): Promise<void> {
    const tree = await this.getTree(sessionId);
    tree.flags = Object.entries(flags).map(([key, value]) => ({
      key,
      value,
      source: 'user' as const,
      createdAt: new Date().toISOString(),
    }));
    await this.saveTree(tree);
  }

  /**
   * flags 注入格式（进入 plan 生成的 system 上下文）
   */
  async getFlagContext(sessionId: string): Promise<string> {
    const flags = await this.getFlags(sessionId);
    if (flags.length === 0) return '';

    const lines = flags.map((f) => `- [${f.source}] ${f.key} = ${f.value}`);
    return (
      '\n\n🎏 SESSION FLAGS (confirmed constraints for this session):\n' +
      'These were explicitly confirmed earlier in this session. ' +
      'Respect them when generating plans:\n' +
      lines.join('\n') +
      '\n'
    );
  }

  // ─── 前世记忆（被弃分支的结论） ──────────────────────────────

  /**
   * 被弃/失败分支的结论摘要——读档后的"前世记忆"
   */
  async getAbandonedBranchContext(sessionId: string): Promise<string> {
    const tree = await this.getTree(sessionId);
    const closed = tree.nodes.filter(
      (n) =>
        (n.outcome === 'abandoned' || n.outcome === 'failed') &&
        n.type !== 'save'
    );

    if (closed.length === 0) return '';

    const lines = closed.slice(-8).map((n) => {
      const chosen = n.options.find((o) => o.id === n.selectedOptionId);
      const label = chosen ? chosen.label : '(no choice)';
      const note = n.outcomeNote ? ` → ${truncate(n.outcomeNote, 120)}` : '';
      return `- [${n.type}] "${truncate(n.prompt, 60)}" chose [${label}] (${n.outcome})${note}`;
    });

    return (
      '\n\n⏪ PRIOR BRANCH MEMORY (paths already tried in this session):\n' +
      'These approaches were tried before and did not work out. ' +
      'Avoid repeating them unless the user explicitly asks:\n' +
      lines.join('\n') +
      '\n'
    );
  }

  // ─── 可视化（galgame flowchart） ─────────────────────────────

  /**
   * 渲染 ASCII 决策树
   */
  async renderTree(sessionId: string): Promise<string> {
    const tree = await this.getTree(sessionId);

    if (tree.nodes.length === 0) {
      return 'No decisions recorded yet in this session.';
    }

    // 建父子索引
    const byId = new Map(tree.nodes.map((n) => [n.id, n]));
    const children = new Map<string, DecisionNode[]>();
    const roots: DecisionNode[] = [];

    for (const node of tree.nodes) {
      if (node.parentDecisionId && byId.has(node.parentDecisionId)) {
        const list = children.get(node.parentDecisionId) ?? [];
        list.push(node);
        children.set(node.parentDecisionId, list);
      } else {
        roots.push(node);
      }
    }

    const lines: string[] = [];
    const outcomeIcon: Record<BranchOutcome, string> = {
      active: '▶',
      succeeded: '✓',
      failed: '✗',
      abandoned: '⊘',
    };

    const walk = (node: DecisionNode, prefix: string, isLast: boolean, isRoot: boolean) => {
      const connector = isRoot ? '' : isLast ? '└─ ' : '├─ ';
      const icon = outcomeIcon[node.outcome];
      const chosen = node.options.find((o) => o.id === node.selectedOptionId);
      const choiceText = chosen ? ` → ${chosen.label}` : '';
      const current = node.id === tree.currentNodeId ? ' ◀ current' : '';
      const note = node.outcomeNote ? ` (${truncate(node.outcomeNote, 40)})` : '';
      const stats =
        node.visits && node.visits > 0
          ? ` [${node.visits} try${node.visits > 1 ? 's' : ''} · Q=${((node.value ?? 0) / node.visits).toFixed(2)}]`
          : '';
      const revisit =
        (node.presentedCount ?? 1) > 1
          ? chalkRevisit(node.presentedCount!)
          : '';

      lines.push(
        `${prefix}${connector}${icon} [${node.id}] ${truncate(node.prompt, 48)}${revisit}${stats}${choiceText}${note}${current}`
      );

      // 未选择的选项作为"未解锁路线"显示（带 N/Q 统计）
      const unchosen = node.options.filter((o) => o.id !== node.selectedOptionId);
      const childPrefix = prefix + (isRoot ? '' : isLast ? '   ' : '│  ');

      unchosen.forEach((o, i) => {
        const lastOpt = i === unchosen.length - 1 && (children.get(node.id) ?? []).length === 0;
        const oStats = o.stats?.visits
          ? ` [${o.stats.visits}x Q=${(o.stats.value / o.stats.visits).toFixed(2)}]`
          : '';
        lines.push(
          `${childPrefix}${lastOpt ? '└─' : '├─'}◌ [untaken] ${truncate(o.label, 40)}${oStats}`
        );
      });

      const kids = children.get(node.id) ?? [];
      kids.forEach((child, i) => {
        walk(child, childPrefix, i === kids.length - 1, false);
      });
    };

    roots.forEach((node, i) => {
      walk(node, '', i === roots.length - 1, true);
    });

    const flagLines = tree.flags.map((f) => `  ${f.key} = ${f.value}`).join('\n');
    const flagsBlock = flagLines ? `\n\n🎏 Flags:\n${flagLines}` : '';

    return (
      `🌳 Decision tree for session ${sessionId} ` +
      `(${tree.nodes.length} nodes, ${tree.nodes.filter((n) => n.outcome === 'abandoned').length} abandoned)` +
      `\n   legend: ▶ active  ✓ succeeded  ✗ failed  ⊘ abandoned  ◌ untaken option\n\n` +
      lines.join('\n') +
      flagsBlock
    );
  }

  /**
   * 获取当前路径（根到当前节点的决策链，供注入或展示）
   */
  async getCurrentPath(sessionId: string): Promise<DecisionNode[]> {
    const tree = await this.getTree(sessionId);
    const path: DecisionNode[] = [];
    let cursor = tree.currentNodeId
      ? tree.nodes.find((n) => n.id === tree.currentNodeId)
      : undefined;

    while (cursor) {
      path.unshift(cursor);
      cursor = cursor.parentDecisionId
        ? tree.nodes.find((n) => n.id === cursor!.parentDecisionId)
        : undefined;
    }
    return path;
  }

  /**
   * 列出项目下全部有分支树的会话（precipitation 采集用）
   */
  async listSessions(): Promise<string[]> {
    await this.initialize();
    try {
      const files = await fs.readdir(this.branchesDir);
      return files
        .filter((f) => f.endsWith('.json') && f !== 'active.json')
        .map((f) => f.replace(/\.json$/, ''));
    } catch {
      return [];
    }
  }
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.substring(0, max - 3) + '...' : clean;
}

/** 重访标记：↻N（该决策点第 N 次呈现） */
function chalkRevisit(count: number): string {
  return ` ↻${count}`;
}

/** 分词（小写、去标点、去停用词）——提示相似度用 */
function tokenize(text: string): Set<string> {
  const STOP = new Set([
    'the', 'a', 'an', 'to', 'of', 'and', 'or', 'for', 'in', 'on', 'with',
    '的', '了', '和', '与', '给', '加上', '一个', '请', '我',
  ]);
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP.has(w))
  );
}

/** 词集 Jaccard 相似度 */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

/** 选项标签归一化（大小写/空白）——跨会话选项匹配用 */
function normLabel(label: string): string {
  return label.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * 创建分支树管理器实例
 */
export function createBranchTreeManager(
  projectRoot: string
): BranchTreeManager {
  return new BranchTreeManager(projectRoot);
}
