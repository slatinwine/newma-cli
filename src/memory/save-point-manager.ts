/**
 * Save Point Manager
 *
 * 游戏存档系统的管理器（Phase 1）
 *
 * - 快速存档（quick save）：无名称，自动滚动保留最近 N 个
 * - 命名存档（named save）：用户显式命名，长期保留
 * - 跨会话列档：像游戏的存档槽列表一样展示所有会话的存档
 *
 * 存储：.memo/saves/index.json（存档只是指针元组，无内容拷贝，天然轻量）
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';
import { SavePoint, SaveIndex } from './save-point-types';

export interface CreateSavePointOptions {
  sessionId: string;
  name?: string;
  auto?: boolean;
  reason?: string;
  gitHash?: string;
  gitBranch?: string;
  messageId?: string;
  messageCount?: number;
  taskId?: string;
  flags?: Record<string, string>;
  decisionNodeId?: string;
  summary?: string;
}

export class SavePointManager {
  private projectRoot: string;
  private savesDir: string;
  private indexFile: string;
  private index: SaveIndex | null = null;
  /** 创建序号（同毫秒排序用）：初始化时从已有存档恢复最大值 */
  private nextSeq = 1;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.savesDir = join(projectRoot, '.memo', 'saves');
    this.indexFile = join(this.savesDir, 'index.json');
  }

  /**
   * 初始化（幂等）
   */
  async initialize(): Promise<void> {
    if (!existsSync(this.savesDir)) {
      await fs.mkdir(this.savesDir, { recursive: true });
    }

    let loaded: SaveIndex;
    if (existsSync(this.indexFile)) {
      try {
        loaded = JSON.parse(await fs.readFile(this.indexFile, 'utf-8'));
      } catch {
        // 索引损坏时重建（存档本身是可再生的还原点，损毁可接受）
        loaded = this.createEmptyIndex();
      }
    } else {
      loaded = this.createEmptyIndex();
    }
    this.index = loaded;

    // 恢复序号（跨进程单调）
    this.nextSeq =
      loaded.saves.reduce((max, s) => Math.max(max, s.seq ?? 0), 0) + 1;

    if (!existsSync(this.indexFile)) {
      await this.persist();
    }
  }

  private createEmptyIndex(): SaveIndex {
    return {
      saves: [],
      maxAutoSaves: 20,
      maxNamedSaves: 100,
      lastUpdated: new Date().toISOString(),
    };
  }

  private async ensureInitialized(): Promise<SaveIndex> {
    if (!this.index) {
      await this.initialize();
    }
    return this.index!;
  }

  private async persist(): Promise<void> {
    if (!this.index) return;
    this.index.lastUpdated = new Date().toISOString();
    await fs.writeFile(
      this.indexFile,
      JSON.stringify(this.index, null, 2),
      'utf-8'
    );
  }

  /**
   * 创建存档点
   */
  async createSavePoint(options: CreateSavePointOptions): Promise<SavePoint> {
    const index = await this.ensureInitialized();

    const savePoint: SavePoint = {
      id: `save-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .substring(2, 8)}`,
      seq: this.nextSeq++,
      sessionId: options.sessionId,
      name: options.name,
      auto: options.auto ?? !options.name,
      reason: options.reason,
      gitHash: options.gitHash,
      gitBranch: options.gitBranch,
      messageId: options.messageId,
      messageCount: options.messageCount ?? 0,
      taskId: options.taskId,
      flags: options.flags ?? {},
      decisionNodeId: options.decisionNodeId,
      summary: options.summary,
      createdAt: new Date().toISOString(),
    };

    index.saves.push(savePoint);

    // 滚动清理：快速存档超出上限删最旧，命名存档同理
    await this.pruneOld('auto', index.maxAutoSaves);
    await this.pruneOld('named', index.maxNamedSaves);

    // 按时间倒序维护（seq 保证同毫秒创建时的确定性）
    index.saves.sort((a, b) => this.compareDesc(a, b));

    await this.persist();
    return savePoint;
  }

  /** 倒序比较器：createdAt 降序，同毫秒按 seq 降序 */
  private compareDesc(a: SavePoint, b: SavePoint): number {
    const timeDiff =
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return (b.seq ?? 0) - (a.seq ?? 0);
  }

  private async pruneOld(kind: 'auto' | 'named', max: number): Promise<void> {
    if (!this.index) return;
    const mine = this.index.saves.filter(
      (s) => (kind === 'auto' ? s.auto : !s.auto)
    );
    if (mine.length > max) {
      // mine 按加入顺序，最旧的在前
      const toRemove = new Set(mine.slice(0, mine.length - max).map((s) => s.id));
      this.index.saves = this.index.saves.filter((s) => !toRemove.has(s.id));
    }
  }

  /**
   * 列出全部存档（跨会话，最新的在前；同毫秒按创建序号）
   */
  async listSavePoints(sessionId?: string): Promise<SavePoint[]> {
    const index = await this.ensureInitialized();
    const saves = sessionId
      ? index.saves.filter((s) => s.sessionId === sessionId)
      : index.saves;
    return [...saves].sort((a, b) => this.compareDesc(a, b));
  }

  /**
   * 按 ID 或名称查找存档（/load 支持两种寻址）
   */
  async getSavePoint(idOrName: string): Promise<SavePoint | null> {
    const saves = await this.listSavePoints();
    return (
      saves.find((s) => s.id === idOrName) ??
      saves.find((s) => s.name === idOrName) ??
      null
    );
  }

  /**
   * 删除存档
   */
  async deleteSavePoint(id: string): Promise<boolean> {
    const index = await this.ensureInitialized();
    const before = index.saves.length;
    index.saves = index.saves.filter((s) => s.id !== id);
    if (index.saves.length === before) return false;
    await this.persist();
    return true;
  }

  /**
   * 获取某会话最近的存档（自动存档兜底用）
   */
  async getLatestSavePoint(sessionId: string): Promise<SavePoint | null> {
    const saves = await this.listSavePoints(sessionId);
    return saves.length > 0 ? saves[0] : null;
  }

  /**
   * 格式化存档列表（存档槽界面）
   */
  formatSaveList(saves: SavePoint[]): string {
    if (saves.length === 0) {
      return 'No save points yet. Use /save [name] to create one.';
    }

    const lines: string[] = [];
    lines.push(`Found ${saves.length} save point(s):\n`);

    saves.forEach((s, i) => {
      const time = new Date(s.createdAt).toLocaleString();
      const kind = s.name ? `"${s.name}"` : '(auto)';
      const git = s.gitHash ? `git:${s.gitHash.substring(0, 7)}` : 'no-git';
      const msgs = `${s.messageCount} msgs`;
      const summary = s.summary ? ` - ${truncate(s.summary, 40)}` : '';
      lines.push(
        `${String(i + 1).padStart(2)}. ${s.id}  ${kind}\n` +
          `    ${time} | ${git} | ${msgs}${summary}`
      );
    });

    return lines.join('\n');
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.substring(0, max - 3) + '...' : text;
}

/**
 * 创建存档管理器实例
 */
export function createSavePointManager(
  projectRoot: string
): SavePointManager {
  return new SavePointManager(projectRoot);
}
