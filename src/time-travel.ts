// src/time-travel.ts
/**
 * Time Travel Manager（Phase 3）
 *
 * Galgame 式无损回跳：回到任意决策点/存档点重新走。
 *
 * 与破坏性回滚的区别——galgame 的旧剧情永远不会丢：
 * 1. git：当前工作先提交到 kode/branch-<ts> 保全（旧分支保留），
 *    再从目标 commit 切出 kode/rewind-<ts> 新分支检出
 * 2. 会话：旧分支消息标记进 abandonedRanges（保留在文件中，退出 AI 上下文）
 * 3. 分支树：旧节点标记 abandoned + 记录结局，新增 back-to 节点
 * 4. 前世记忆：被弃分支的结论通过 BranchTreeManager 注入新分支
 */

import { RollbackManager } from './rollback';
import {
  BranchTreeManager,
  SavePointManager,
  SessionContextManager,
} from './memory';
import { SavePoint } from './memory/save-point-types';

export interface BackToTarget {
  /** 目标 git commit（可选：会话存档可能无 git 部分） */
  gitHash?: string;
  /** 目标消息 ID（会话回退锚点） */
  messageId?: string;
  /** 人类可读的目标描述 */
  label: string;
  /** 目标决策节点 ID（若来自决策树） */
  decisionNodeId?: string;
}

export interface BackToResult {
  success: boolean;
  /** 保全旧分支的 git 分支名（空 = 无需保全） */
  preservedBranch?: string;
  /** 新检出的 git 分支名 */
  rewindBranch?: string;
  /** 标记废弃的决策节点数 */
  abandonedDecisions: number;
  /** 标记废弃的消息数 */
  abandonedMessages: number;
  /** git 侧被跳过的原因（如决策点无 git 锚点、非 git 仓库） */
  gitSkipped?: string;
  error?: string;
}

export class TimeTravelManager {
  private rollbackManager: RollbackManager;
  private branchTree: BranchTreeManager;
  private savePoints: SavePointManager;
  private sessionContext: SessionContextManager;

  constructor(
    projectRoot: string,
    sessionContext: SessionContextManager,
    rollbackManager?: RollbackManager,
    branchTree?: BranchTreeManager,
    savePoints?: SavePointManager
  ) {
    this.sessionContext = sessionContext;
    this.rollbackManager =
      rollbackManager ?? new RollbackManager(projectRoot);
    this.branchTree = branchTree ?? new BranchTreeManager(projectRoot);
    this.savePoints = savePoints ?? new SavePointManager(projectRoot);
  }

  /**
   * 从存档点解析回跳目标
   */
  targetFromSave(save: SavePoint): BackToTarget {
    return {
      gitHash: save.gitHash,
      messageId: save.messageId,
      label: save.name ? `save "${save.name}"` : `save ${save.id}`,
      decisionNodeId: save.decisionNodeId,
    };
  }

  /**
   * 从决策节点解析回跳目标
   *
   * 决策节点可能没有 git 锚点（记录时未传 hash）——
   * 兜底取该决策点之前最近的存档 gitHash，尽量保证 git 侧可回退。
   */
  async targetFromDecision(
    sessionId: string,
    nodeId: string
  ): Promise<BackToTarget | null> {
    const node = await this.branchTree.getNode(sessionId, nodeId);
    if (!node) return null;

    let gitHash = node.gitHash;
    if (!gitHash) {
      await this.savePoints.initialize();
      const saves = await this.savePoints.listSavePoints(sessionId);
      const anchor = saves.find(
        (s) =>
          s.gitHash &&
          new Date(s.createdAt).getTime() <= new Date(node.createdAt).getTime()
      );
      gitHash = anchor?.gitHash;
    }

    return {
      gitHash,
      messageId: node.messageId,
      label: `decision "${node.prompt.slice(0, 40)}"`,
      decisionNodeId: node.id,
    };
  }

  /**
   * 执行时间旅行
   */
  async backTo(sessionId: string, target: BackToTarget): Promise<BackToResult> {
    const result: BackToResult = {
      success: false,
      abandonedDecisions: 0,
      abandonedMessages: 0,
    };

    try {
      // ── 1. git 侧：保全当前状态，检出目标版本 ──────────────
      if (target.gitHash && this.rollbackManager.isAvailable()) {
        const currentBranch = this.rollbackManager.getCurrentBranch();
        const stamp = Date.now().toString(36);

        // 有未提交修改时先提交保全（否则切分支会带着工作区走）
        if (this.rollbackManager.hasUncommittedChanges()) {
          this.rollbackManager.commitPending(
            'kode: checkpoint: preserve before rewind'
          );
        }

        // 旧分支保全（当前 HEAD 若非目标，则留一个分支指向它）
        const currentHash = this.rollbackManager.getCurrentHash();
        if (currentHash && currentHash !== target.gitHash) {
          const preserveName = `kode/branch-${stamp}`;
          this.rollbackManager.createBranch(preserveName, currentHash);
          result.preservedBranch = preserveName;
        }

        // 新分支检出目标状态（不 reset，无损）
        const rewindName = `kode/rewind-${stamp}`;
        if (!this.rollbackManager.checkoutBranch(rewindName, target.gitHash)) {
          // 目标 hash 在当前分支历史上：checkout -b 可能因分支已存在失败，重试唯一名
          const retry = `kode/rewind-${stamp}-${Math.random()
            .toString(36)
            .substring(2, 6)}`;
          if (!this.rollbackManager.checkoutBranch(retry, target.gitHash)) {
            result.error = `git checkout failed for ${target.gitHash}`;
            return result;
          }
          result.rewindBranch = retry;
        } else {
          result.rewindBranch = rewindName;
        }

        void currentBranch; // 供日志/后续扩展使用
      } else if (target.gitHash) {
        result.gitSkipped = 'not a git repository';
      } else {
        result.gitSkipped =
          'target has no git anchor (decision was recorded without a commit)';
      }

      // ── 2. 会话侧：旧消息标记废弃（保留但不进上下文） ──────
      if (target.messageId) {
        const session = this.sessionContext.getCurrentSession();
        const messages = session?.messages ?? [];
        const targetIdx = messages.findIndex((m) => m.id === target.messageId);
        if (targetIdx >= 0 && targetIdx < messages.length - 1) {
          const abandonedCount = messages.length - 1 - targetIdx;
          const marked = await this.sessionContext.markAbandonedFrom(
            target.messageId,
            `rewind to ${target.label}`
          );
          if (marked) {
            result.abandonedMessages = abandonedCount;
          }
        }
      }

      // ── 3. 分支树侧：旧节点标记 abandoned，新增 back-to 节点 ─
      if (target.decisionNodeId) {
        result.abandonedDecisions = await this.branchTree.abandonSubsequent(
          sessionId,
          target.decisionNodeId,
          `rewound to ${target.label}`
        );
      }

      // 记录 back-to 决策节点（当前节点移动到回跳目标之后）
      const lastMessage = this.sessionContext.getLastMessage();
      await this.branchTree.recordDecision({
        sessionId,
        type: 'back-to',
        prompt: `⏪ Rewound to ${target.label}`,
        options: [
          { id: 'continue', label: 'continue from here with prior memory' },
        ],
        selectedOptionId: 'continue',
        selectionReason: 'time travel',
        parentDecisionId: target.decisionNodeId,
        messageId: lastMessage?.id,
        gitHash: this.rollbackManager.getCurrentHash() ?? undefined,
      });

      // ── 4. 写入时间旅行标记消息（进入新分支的 AI 上下文） ──
      await this.sessionContext.addMessage(
        'system',
        `⏪ [Time Travel] Rewound to ${target.label}. ` +
          `The previous branch was preserved (see /tree). ` +
          `Prior attempts are listed in PRIOR BRANCH MEMORY — avoid repeating them.`,
        { commandType: 'time-travel' },
        target.messageId
      );

      result.success = true;
      return result;
    } catch (error) {
      result.error = (error as Error).message;
      return result;
    }
  }

  /**
   * 读档（/load）：与 backTo 的区别是跨会话——恢复消息上下文 + flags + git
   */
  async loadSave(
    sessionId: string,
    save: SavePoint
  ): Promise<BackToResult> {
    const result: BackToResult = {
      success: false,
      abandonedDecisions: 0,
      abandonedMessages: 0,
    };

    try {
      // 恢复会话消息上下文
      const restored = await this.sessionContext.restoreSession(
        save.sessionId
      );
      if (!restored) {
        result.error = `session ${save.sessionId} not found`;
        return result;
      }

      // 恢复 flags 快照
      if (Object.keys(save.flags).length > 0) {
        await this.branchTree.restoreFlags(save.sessionId, save.flags);
      }

      // git 侧：同样走无损分支模型（保全当前 → 检出存档点）
      const target = this.targetFromSave(save);
      if (target.gitHash && this.rollbackManager.isAvailable()) {
        const stamp = Date.now().toString(36);
        if (this.rollbackManager.hasUncommittedChanges()) {
          this.rollbackManager.commitPending(
            'kode: checkpoint: preserve before load'
          );
        }
        const currentHash = this.rollbackManager.getCurrentHash();
        if (currentHash && currentHash !== target.gitHash) {
          const preserveName = `kode/branch-${stamp}`;
          this.rollbackManager.createBranch(preserveName, currentHash);
          result.preservedBranch = preserveName;
        }
        const rewindName = `kode/load-${stamp}`;
        if (
          this.rollbackManager.checkoutBranch(rewindName, target.gitHash)
        ) {
          result.rewindBranch = rewindName;
        }
      } else if (target.gitHash) {
        result.gitSkipped = 'not a git repository';
      } else {
        result.gitSkipped = 'save point has no git anchor';
      }

      // 记录读档决策节点
      await this.branchTree.recordDecision({
        sessionId: save.sessionId,
        type: 'save',
        prompt: `📥 Loaded ${target.label}`,
        options: [{ id: 'load', label: 'load save point' }],
        selectedOptionId: 'load',
        selectionReason: 'user load',
      });

      await this.sessionContext.addMessage(
        'system',
        `📥 [Load] Restored save ${target.label} ` +
          `(${save.messageCount} messages, flags restored).`,
        { commandType: 'load-save' }
      );

      await this.branchTree.setActiveSession(save.sessionId);

      result.success = true;
      return result;
    } catch (error) {
      result.error = (error as Error).message;
      return result;
    }
  }

  /**
   * 创建存档点（快速/命名），绑定 git + 消息 + flags + 任务
   *
   * gitHashOverride：调用方已创建 checkpoint 时直接复用（避免重复提交）
   */
  async createSave(options: {
    sessionId: string;
    name?: string;
    reason?: string;
    taskId?: string;
    summary?: string;
    gitHashOverride?: string;
  }): Promise<SavePoint> {
    await this.savePoints.initialize();

    // git 侧：有未提交修改时先建 checkpoint（完整还原点），否则记当前 HEAD
    let gitHash: string | undefined = options.gitHashOverride;
    let gitBranch: string | undefined;
    if (!gitHash && this.rollbackManager.isAvailable()) {
      if (this.rollbackManager.hasUncommittedChanges()) {
        gitHash =
          (await this.rollbackManager.createRestorePoint(
            options.name ? `save:${options.name}` : 'save'
          )) ?? undefined;
      }
      gitHash = gitHash ?? this.rollbackManager.getCurrentHash() ?? undefined;
    }
    if (this.rollbackManager.isAvailable()) {
      gitBranch = this.rollbackManager.getCurrentBranch() ?? undefined;
    }

    const lastMessage = this.sessionContext.getLastMessage();
    const flags: Record<string, string> = {};
    for (const f of await this.branchTree.getFlags(options.sessionId)) {
      flags[f.key] = f.value;
    }

    const save = await this.savePoints.createSavePoint({
      sessionId: options.sessionId,
      name: options.name,
      auto: !options.name,
      reason: options.reason ?? (options.name ? 'manual save' : 'quick save'),
      gitHash,
      gitBranch,
      messageId: lastMessage?.id,
      messageCount: this.sessionContext.getCurrentSession()?.stats.messageCount ?? 0,
      taskId: options.taskId,
      flags,
      summary:
        options.summary ??
        (lastMessage
          ? lastMessage.content.slice(0, 60)
          : undefined),
    });

    // 存档同时记录为决策树节点（galgame：存档点出现在流程图上）
    await this.branchTree.recordDecision({
      sessionId: options.sessionId,
      type: 'save',
      prompt: options.name
        ? `💾 Save "${options.name}"`
        : '💾 Quick save',
      options: [{ id: 'save', label: 'save point' }],
      selectedOptionId: 'save',
      messageId: lastMessage?.id,
      gitHash,
    });

    return save;
  }

  /**
   * 获取存档管理器（REPL 命令直接用）
   */
  getSavePointManager(): SavePointManager {
    return this.savePoints;
  }

  /**
   * 获取分支树管理器
   */
  getBranchTreeManager(): BranchTreeManager {
    return this.branchTree;
  }
}
