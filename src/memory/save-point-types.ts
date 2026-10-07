/**
 * Save Point System - Type Definitions
 *
 * 游戏存档模式的类型定义（Phase 1）
 *
 * 核心思想：存档不是内容拷贝，而是多系统状态的原子指针绑定。
 * 一个 SavePoint 把 git commit、会话消息位置、任务文档、分支树
 * 四套已经各自持久化的状态绑定成一个可恢复的还原点。
 */

/**
 * 存档点（游戏里的 Quick Save / 命名存档槽）
 */
export interface SavePoint {
  /** 存档 ID（save-<ts36>-<rand>） */
  id: string;

  /** 创建序号（同一毫秒内的确定性排序用，跨进程单调） */
  seq: number;

  /** 所属会话 ID */
  sessionId: string;

  /** 用户命名（快速存档无名称） */
  name?: string;

  /** 是否自动存档（review-mode 批准 / 执行前等系统触发） */
  auto: boolean;

  /** 创建原因（如 "before execution" / "review approve"） */
  reason?: string;

  /** 存档时的 git commit hash（非 git 仓库时为空） */
  gitHash?: string;

  /** 存档时的 git 分支名 */
  gitBranch?: string;

  /** 存档时会话最后一条消息 ID */
  messageId?: string;

  /** 存档时的消息总数（显示用） */
  messageCount: number;

  /** 存档时的任务文档 ID（TaskTracker） */
  taskId?: string;

  /** 存档时的会话 flags 快照（galgame 的事件标记） */
  flags: Record<string, string>;

  /** 关联的决策节点 ID（若存档发生在某个决策点） */
  decisionNodeId?: string;

  /** 存档摘要（存档槽显示用，类似游戏存档的章节名） */
  summary?: string;

  /** 创建时间 */
  createdAt: string;
}

/**
 * 存档索引文件结构（.memo/saves/index.json）
 */
export interface SaveIndex {
  /** 全部存档（跨会话，按时间倒序维护） */
  saves: SavePoint[];

  /** 快速存档保留数量上限（超出删最旧的 auto 存档） */
  maxAutoSaves: number;

  /** 命名存档保留数量上限 */
  maxNamedSaves: number;

  lastUpdated: string;
}
