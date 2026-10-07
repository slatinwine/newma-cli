/**
 * Branch Tree System - Type Definitions
 *
 * Galgame 分支决策树的类型定义（Phase 2/3）
 *
 * 核心思想：会话历史不是一条线，而是一棵树。
 * - 每个决策点（计划选择/澄清问答/replan/时间旅行）是树上的节点
 * - 未被选择的选项保留为"潜在分支"（galgame 流程图的未解锁路线）
 * - 每条分支有结局状态（active/succeeded/failed/abandoned）
 * - flag 系统记录会话内已确认的约束，影响后续选项生成
 */

/**
 * 决策节点类型
 */
export type DecisionNodeType =
  | 'plan-selection' // AI 生成计划后的 A/B/C 选择
  | 'user-choice' // 用户主动决策（澄清问答等）
  | 'replan' // 执行失败后重规划
  | 'retry' // 重试
  | 'save' // 手动/自动存档
  | 'back-to' // 时间旅行（回到此节点）
  | 'task-outcome'; // 任务结局

/**
 * 分支结局（galgame 的多结局）
 */
export type BranchOutcome = 'active' | 'succeeded' | 'failed' | 'abandoned';

/**
 * 结局 → MCTS 奖励映射
 * succeeded=1.0（明确正收益）；abandoned=0.25（有信息量但未成功）；
 * failed=0.0（明确负收益）；active 不参与反传（未关闭）
 */
export function outcomeReward(outcome: BranchOutcome): number | null {
  switch (outcome) {
    case 'succeeded':
      return 1.0;
    case 'abandoned':
      return 0.25;
    case 'failed':
      return 0.0;
    default:
      return null;
  }
}

/**
 * MCTS 统计（AlphaZero 风格：N 访问数 / W 累计价值 / P 先验）
 * 加在决策选项上：记录"这个选项被走过几次、表现如何"
 */
export interface MCTSStats {
  /** 访问次数 N（该选项被选择并已结算结局的次数） */
  visits: number;
  /** 累计奖励 W（Q = W/N） */
  value: number;
  /** 先验概率 P（AI 评估分，如 ToT 五维评分；缺省均匀分布） */
  prior?: number;
}

/**
 * 决策时的一个选项（含未被选择的）
 */
export interface DecisionOption {
  id: string;
  label: string;
  description?: string;
  /** MCTS 统计（惰性创建） */
  stats?: MCTSStats;
}

/**
 * 决策节点
 */
export interface DecisionNode {
  id: string;

  /** 所属会话 */
  sessionId: string;

  /** 节点类型 */
  type: DecisionNodeType;

  /** 决策的问题/场景描述（galgame 的剧情台词） */
  prompt: string;

  /** 当时可选的全部选项（含未选的——潜在的分支路线） */
  options: DecisionOption[];

  /** 选中的选项 ID */
  selectedOptionId?: string;

  /** 选择理由 */
  selectionReason?: string;

  /** 父决策节点（树结构） */
  parentDecisionId?: string;

  /** 分支结局 */
  outcome: BranchOutcome;

  /** 结局说明（abandoned 时记录"前世记忆"——失败/放弃原因） */
  outcomeNote?: string;

  /** MCTS：该子树总结算次数（含所有后代分支） */
  visits?: number;

  /** MCTS：该子树累计奖励 */
  value?: number;

  /** MCTS：该决策点被呈现过的次数（含重访，初始 1） */
  presentedCount?: number;

  /** MCTS：最近一次重访时间（复用节点时更新，createdAt 保持首次创建） */
  lastRevisitedAt?: string;

  /** 决策时的会话消息 ID */
  messageId?: string;

  /** 决策时的 git commit */
  gitHash?: string;

  createdAt: string;

  /** 结局关闭时间 */
  closedAt?: string;
}

/**
 * 会话 flag（galgame 的事件标记/好感度）
 * 例：key='state-lib', value='zustand:confirmed', source='user'
 */
export interface SessionFlag {
  key: string;
  value: string;
  source: 'user' | 'ai';
  messageId?: string;
  createdAt: string;
}

/**
 * 会话分支树记录（.memo/branches/<sessionId>.json）
 */
export interface BranchTreeRecord {
  sessionId: string;

  /** 全部决策节点 */
  nodes: DecisionNode[];

  /** 会话 flags */
  flags: SessionFlag[];

  /** 当前所在的决策节点（读档/时间旅行后更新） */
  currentNodeId?: string;

  updatedAt: string;
}

/**
 * 活跃会话标记（.memo/branches/active.json）
 * 供跨进程（ai.ts / precipitation daemon）定位当前会话的分支树
 */
export interface ActiveSessionMarker {
  sessionId: string;
  updatedAt: string;
}
