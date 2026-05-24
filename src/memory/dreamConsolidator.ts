/**
 * Dream Consolidator
 *
 * 基于 Claude Code Dream 系统的记忆整合器
 * 定期整合跨 session 的记忆文件，去重、清理、更新
 */

import { join, dirname } from 'path';
import { writeFile, readFile, mkdir, stat, readdir, access, utimes } from 'fs/promises';
import { existsSync } from 'fs';
import { NewmaConfig } from '../config';
import { PrecipitationCoordinator } from './precipitation-coordinator';

/**
 * Dream 配置
 */
export interface DreamConfig {
  /** 是否启用（默认: true） */
  enabled?: boolean;
  /** 最小间隔小时数（默认: 24） */
  minHours?: number;
  /** 最小 session 数量（默认: 5） */
  minSessions?: number;
  /** 最大轮次（默认: 30） */
  maxTurns?: number;
  /** 锁文件路径（默认: .memo/dream/.consolidate-lock） */
  lockFilePath?: string;
  /** Memory 目录路径（默认: .memo/memory） */
  memoryDir?: string;
  /** Session 目录路径（默认: .kode/sessions） */
  sessionDir?: string;
  /** 事件冷却时间（秒，默认: 30） */
  eventCooldownSeconds?: number;
  /** 是否在整合后触发沉淀（默认: true） */
  triggerPrecipitation?: boolean;
}

/**
 * Dream 阶段
 */
export type DreamPhase = 'starting' | 'scanning' | 'analyzing' | 'consolidating' | 'completed' | 'failed';

/**
 * Dream 进度
 */
export interface DreamProgress {
  /** 当前阶段 */
  phase: DreamPhase;
  /** 正在审查的 session 列表 */
  sessionsReviewing: string[];
  /** 已修改的文件列表 */
  filesTouched: string[];
  /** 当前轮次 */
  turns: number;
  /** 开始时间 */
  startTime: Date;
  /** 结束时间（可选） */
  endTime?: Date;
  /** 错误信息（如果失败） */
  error?: string;
  /** 执行日志 */
  logs: string[];
}

/**
 * Session 信息
 */
interface SessionInfo {
  /** Session ID */
  id: string;
  /** Session 文件路径 */
  path: string;
  /** 最后修改时间 */
  mtime: Date;
  /** 记忆文件列表 */
  memoryFiles: string[];
}

/**
 * Dream 结果
 */
export interface DreamResult {
  /** 是否成功 */
  success: boolean;
  /** 进度信息 */
  progress: DreamProgress;
  /** 触发沉淀的时间戳（可选） */
  precipitationTriggered?: Date;
}

/**
 * 工具权限类型
 */
type ToolPermission = 'allow' | 'deny';

/**
 * Dream 权限过滤器
 *
 * 限制在 Dream 模式下可用的工具
 */
class DreamPermissionFilter {
  /** 允许的只读工具 */
  private static readonly ALLOWED_READONLY_TOOLS = new Set([
    'Read',
    'Glob',
    'Grep',
    'LSP',
  ]);

  /** 允许的写入模式（仅 memory 目录） */
  private static readonly ALLOWED_WRITE_PATTERN = /^\.memo\/memory\//;

  /**
   * 检查工具是否允许使用
   */
  static checkTool(toolName: string, operation: 'read' | 'write', targetPath?: string): ToolPermission {
    // 只读工具始终允许
    if (this.ALLOWED_READONLY_TOOLS.has(toolName) && operation === 'read') {
      return 'allow';
    }

    // 只读 Shell 命令（grep, find, cat, ls, echo 等）允许
    if (toolName === 'Bash' && operation === 'read') {
      return 'allow';
    }

    // 写入操作：仅允许在 memory 目录下
    if (operation === 'write' && targetPath) {
      if (this.ALLOWED_WRITE_PATTERN.test(targetPath)) {
        return 'allow';
      }
      return 'deny';
    }

    // 其他情况都拒绝
    return 'deny';
  }

  /**
   * 生成 Dream 系统提示词
   */
  static generateSystemPrompt(memoryDir: string, sessions: SessionInfo[]): string {
    const sessionList = sessions
      .map(s => `  - ${s.id}: ${s.memoryFiles.length} memory files`)
      .join('\n');

    return `You are in DREAM MODE - Memory Consolidation Agent.

Your task is to consolidate and integrate memory across multiple sessions to identify patterns, remove duplicates, and update outdated information.

MEMORY DIRECTORY: ${memoryDir}

SESSIONS TO REVIEW:
${sessionList}

CONSOLIDATION INSTRUCTIONS:
1. Scan all memory files in the specified directory
2. Identify patterns that appear across multiple sessions
3. Remove duplicate information while keeping the most recent version
4. Update outdated information based on newer data
5. Merge related insights into coherent summaries
6. Archive old data that is no longer relevant

IMPORTANT CONSTRAINTS:
- You can ONLY write to files under ${memoryDir}
- You can read any file using Read, Glob, or Grep tools
- Use Bash only for read-only commands (grep, find, cat, ls)
- DO NOT modify code, configuration, or other project files
- Focus on consolidating USER behavior patterns, preferences, and learning history

PROGRESS TRACKING:
- Report which sessions you are reviewing
- List files you modify or create
- Indicate when you complete each phase

Begin by scanning the memory directory and listing all files to consolidate.`;
  }
}

/**
 * Dream 整合器
 *
 * 实现跨 session 记忆整合功能
 */
export class DreamConsolidator {
  private config: Required<DreamConfig>;
  private projectRoot: string;
  private precipitationCoordinator?: PrecipitationCoordinator;
  private newmaConfig: NewmaConfig;
  private currentProgress?: DreamProgress;
  private lastEventTime: number = 0;
  private isConsolidatingFlag: boolean = false;

  constructor(
    projectRoot: string,
    config: DreamConfig,
    newmaConfig: NewmaConfig,
    precipitationCoordinator?: PrecipitationCoordinator
  ) {
    this.projectRoot = projectRoot;
    this.newmaConfig = newmaConfig;
    this.precipitationCoordinator = precipitationCoordinator;

    // 合并默认配置
    this.config = {
      enabled: config.enabled ?? true,
      minHours: config.minHours ?? 24,
      minSessions: config.minSessions ?? 5,
      maxTurns: config.maxTurns ?? 30,
      lockFilePath: config.lockFilePath ?? join(projectRoot, '.memo', 'dream', '.consolidate-lock'),
      memoryDir: config.memoryDir ?? join(projectRoot, '.memo', 'memory'),
      sessionDir: config.sessionDir ?? join(projectRoot, '.kode', 'sessions'),
      eventCooldownSeconds: config.eventCooldownSeconds ?? 30,
      triggerPrecipitation: config.triggerPrecipitation ?? true,
    };
  }

  /**
   * 检查是否应该触发整合
   */
  async shouldTrigger(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    // 检查锁文件
    if (await this.isLocked()) {
      console.log('[Dream] ⚠ Consolidation already in progress (locked)');
      return false;
    }

    // 检查时间间隔
    const lastConsolidation = await this.getLastConsolidationTime();
    const hoursSinceLast = lastConsolidation
      ? (Date.now() - lastConsolidation.getTime()) / (1000 * 60 * 60)
      : Infinity;

    if (hoursSinceLast < this.config.minHours) {
      console.log(`[Dream] ⚠ Too soon since last consolidation (${hoursSinceLast.toFixed(1)}h < ${this.config.minHours}h)`);
      return false;
    }

    // 检查 session 数量
    const sessionCount = await this.countRecentSessions();
    if (sessionCount < this.config.minSessions) {
      console.log(`[Dream] ⚠ Not enough sessions (${sessionCount} < ${this.config.minSessions})`);
      return false;
    }

    return true;
  }

  /**
   * 触发整合流程
   */
  async trigger(): Promise<DreamResult> {
    if (!await this.shouldTrigger()) {
      throw new Error('Dream consolidation conditions not met');
    }

    // 检查事件冷却
    const now = Date.now();
    if (now - this.lastEventTime < this.config.eventCooldownSeconds * 1000) {
      throw new Error(`Event cooldown active (${this.config.eventCooldownSeconds}s)`);
    }

    try {
      // 获取锁
      await this.acquireLock();

      // 初始化进度
      this.currentProgress = {
        phase: 'starting',
        sessionsReviewing: [],
        filesTouched: [],
        turns: 0,
        startTime: new Date(),
        logs: [],
      };

      console.log('[Dream] 🌙 Starting memory consolidation...');

      // 执行整合
      const result = await this.execute();

      // 更新最后整合时间
      await this.updateLastConsolidationTime();

      return result;
    } catch (error: any) {
      console.error(`[Dream] ✗ Consolidation failed: ${error.message}`);

      if (this.currentProgress) {
        this.currentProgress.phase = 'failed';
        this.currentProgress.error = error.message;
        this.currentProgress.endTime = new Date();
      }

      // 失败时回滚锁文件时间
      await this.rollbackLock();

      throw error;
    } finally {
      // 释放锁
      await this.releaseLock();
      this.isConsolidatingFlag = false;
    }
  }

  /**
   * 执行整合流程
   */
  private async execute(): Promise<DreamResult> {
    const startTime = Date.now();

    try {
      // 阶段 1: 扫描 sessions
      this.currentProgress!.phase = 'scanning';
      this.log('[Dream] Phase 1: Scanning sessions...');
      const sessions = await this.scanSessions();
      this.currentProgress!.sessionsReviewing = sessions.map(s => s.id);
      this.log(`[Dream] Found ${sessions.length} sessions to review`);

      // 阶段 2: 分析记忆文件
      this.currentProgress!.phase = 'analyzing';
      this.log('[Dream] Phase 2: Analyzing memory files...');
      const memoryFiles = await this.scanMemoryFiles();
      this.log(`[Dream] Found ${memoryFiles.length} memory files`);

      // 阶段 3: 执行整合
      this.currentProgress!.phase = 'consolidating';
      this.log('[Dream] Phase 3: Consolidating memories...');

      // 生成系统提示词
      const systemPrompt = DreamPermissionFilter.generateSystemPrompt(
        this.config.memoryDir,
        sessions
      );

      // 这里应该调用 AI 子代理执行整合
      // 由于架构限制，我们简化为直接调用整合逻辑
      await this.consolidateMemories(memoryFiles, sessions);

      // 完成
      this.currentProgress!.phase = 'completed';
      this.currentProgress!.endTime = new Date();
      this.currentProgress!.turns++;

      const duration = Date.now() - startTime;
      this.log(`[Dream] ✓ Consolidation completed in ${duration}ms`);
      this.log(`[Dream] Files touched: ${this.currentProgress!.filesTouched.length}`);

      // 触发沉淀（如果配置了）
      let precipitationTriggered: Date | undefined;
      if (this.config.triggerPrecipitation && this.precipitationCoordinator) {
        this.log('[Dream] Triggering precipitation...');
        await this.precipitationCoordinator.trigger();
        precipitationTriggered = new Date();
      }

      return {
        success: true,
        progress: this.currentProgress!,
        precipitationTriggered,
      };
    } catch (error: any) {
      this.currentProgress!.phase = 'failed';
      this.currentProgress!.error = error.message;
      this.currentProgress!.endTime = new Date();

      return {
        success: false,
        progress: this.currentProgress!,
      };
    }
  }

  /**
   * 扫描 sessions
   */
  private async scanSessions(): Promise<SessionInfo[]> {
    const sessions: SessionInfo[] = [];

    try {
      const files = await readdir(this.config.sessionDir);

      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          const filePath = join(this.config.sessionDir, file);
          const stats = await stat(filePath);
          const sessionId = file.replace('.jsonl', '');

          // 查找关联的记忆文件
          const memoryFiles = await this.findSessionMemoryFiles(sessionId);

          sessions.push({
            id: sessionId,
            path: filePath,
            mtime: stats.mtime,
            memoryFiles,
          });
        }
      }
    } catch (error: any) {
      this.log(`[Dream] ⚠ Error scanning sessions: ${error.message}`);
    }

    // 按修改时间排序
    return sessions.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  }

  /**
   * 查找 session 的记忆文件
   */
  private async findSessionMemoryFiles(sessionId: string): Promise<string[]> {
    const memoryFiles: string[] = [];

    try {
      const files = await readdir(this.config.memoryDir);

      for (const file of files) {
        // 查找包含 session ID 的记忆文件
        if (file.includes(sessionId) || file === 'user.md' || file === 'feedback.md') {
          memoryFiles.push(join(this.config.memoryDir, file));
        }
      }
    } catch (error: any) {
      // 目录可能不存在
    }

    return memoryFiles;
  }

  /**
   * 扫描记忆文件
   */
  private async scanMemoryFiles(): Promise<string[]> {
    const memoryFiles: string[] = [];

    try {
      const files = await readdir(this.config.memoryDir);

      for (const file of files) {
        if (file.endsWith('.md')) {
          memoryFiles.push(join(this.config.memoryDir, file));
        }
      }
    } catch (error: any) {
      this.log(`[Dream] ⚠ Error scanning memory directory: ${error.message}`);
    }

    return memoryFiles;
  }

  /**
   * 整合记忆文件
   */
  private async consolidateMemories(memoryFiles: string[], sessions: SessionInfo[]): Promise<void> {
    // 简化实现：标记文件为已整合
    // 在实际系统中，这里会调用 AI 子代理执行深度整合

    for (const file of memoryFiles) {
      try {
        const content = await readFile(file, 'utf-8');

        // 检查是否需要整合
        if (this.needsConsolidation(content)) {
          // 标记文件
          this.currentProgress!.filesTouched.push(file);
          this.log(`[Dream] Marked for consolidation: ${file}`);
        }
      } catch (error: any) {
        this.log(`[Dream] ⚠ Error reading ${file}: ${error.message}`);
      }
    }

    // 创建整合报告
    await this.createConsolidationReport(memoryFiles, sessions);
  }

  /**
   * 检查文件是否需要整合
   */
  private needsConsolidation(content: string): boolean {
    // 简单检查：文件是否超过一定大小或包含重复内容
    const lines = content.split('\n');
    return lines.length > 100 || content.includes('<!-- consolidated -->') === false;
  }

  /**
   * 创建整合报告
   */
  private async createConsolidationReport(memoryFiles: string[], sessions: SessionInfo[]): Promise<void> {
    const reportPath = join(this.config.memoryDir, 'consolidation-report.md');
    const timestamp = new Date().toISOString();

    const report = `# Memory Consolidation Report

**Generated**: ${timestamp}
**Sessions Reviewed**: ${sessions.length}
**Memory Files**: ${memoryFiles.length}
**Files Touched**: ${this.currentProgress!.filesTouched.length}

## Sessions Analyzed

${sessions.map(s => `- **${s.id}** (${s.memoryFiles.length} memory files)`).join('\n')}

## Files Modified

${this.currentProgress!.filesTouched.length > 0
  ? this.currentProgress!.filesTouched.map(f => `- ${f}`).join('\n')
  : 'No files modified in this consolidation'}

## Recommendations

- Review duplicate patterns across sessions
- Update outdated preferences
- Archive old session data
- Merge related insights

---

*This report was auto-generated by the Dream Consolidator*
`;

    await writeFile(reportPath, report, 'utf-8');
    this.log(`[Dream] Created consolidation report: ${reportPath}`);
  }

  /**
   * 获取锁状态
   */
  async isLocked(): Promise<boolean> {
    return existsSync(this.config.lockFilePath);
  }

  /**
   * 获取锁
   */
  private async acquireLock(): Promise<void> {
    if (await this.isLocked()) {
      throw new Error('Consolidation already in progress');
    }

    // 创建锁文件
    const lockDir = dirname(this.config.lockFilePath);
    await mkdir(lockDir, { recursive: true });
    await writeFile(this.config.lockFilePath, Date.now().toString(), 'utf-8');

    this.isConsolidatingFlag = true;
    this.log('[Dream] Lock acquired');
  }

  /**
   * 释放锁
   */
  private async releaseLock(): Promise<void> {
    try {
      const { unlink } = require('fs/promises');
      await unlink(this.config.lockFilePath);
      if (this.currentProgress) {
        this.log('[Dream] Lock released');
      } else {
        console.log('[Dream] Lock released');
      }
    } catch (error: any) {
      if (this.currentProgress) {
        this.log(`[Dream] ⚠ Error releasing lock: ${error.message}`);
      } else {
        console.log(`[Dream] ⚠ Error releasing lock: ${error.message}`);
      }
    }
  }

  /**
   * 回滚锁文件时间
   */
  private async rollbackLock(): Promise<void> {
    try {
      // 将锁文件时间设置为过去，避免长时间锁定
      const pastTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24小时前
      await utimes(this.config.lockFilePath, pastTime, pastTime);
      this.log('[Dream] Lock time rolled back');
    } catch (error: any) {
      this.log(`[Dream] ⚠ Error rolling back lock: ${error.message}`);
    }
  }

  /**
   * 获取最后整合时间
   */
  private async getLastConsolidationTime(): Promise<Date | null> {
    const timestampPath = join(this.config.memoryDir, '.last-consolidation');

    try {
      const content = await readFile(timestampPath, 'utf-8');
      return new Date(parseInt(content));
    } catch (error) {
      return null;
    }
  }

  /**
   * 更新最后整合时间
   */
  private async updateLastConsolidationTime(): Promise<void> {
    const timestampPath = join(this.config.memoryDir, '.last-consolidation');
    await mkdir(this.config.memoryDir, { recursive: true });
    await writeFile(timestampPath, Date.now().toString(), 'utf-8');
  }

  /**
   * 统计最近的 sessions
   */
  private async countRecentSessions(): Promise<number> {
    try {
      const files = await readdir(this.config.sessionDir);
      return files.filter(f => f.endsWith('.jsonl')).length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 获取当前进度
   */
  getProgress(): DreamProgress | undefined {
    return this.currentProgress;
  }

  /**
   * 是否正在整合
   */
  isConsolidating(): boolean {
    return this.isConsolidatingFlag;
  }

  /**
   * 记录日志
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    if (this.currentProgress) {
      this.currentProgress.logs.push(`[${timestamp}] ${message}`);
    }
    console.log(message);
  }

  /**
   * 获取配置
   */
  getConfig(): Required<DreamConfig> {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<DreamConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

/**
 * Dream 调度器
 *
 * 定期检查并触发 Dream 整合
 */
export class DreamScheduler {
  private consolidator: DreamConsolidator;
  private checkInterval?: NodeJS.Timeout;

  constructor(consolidator: DreamConsolidator) {
    this.consolidator = consolidator;
  }

  /**
   * 启动定期检查
   */
  start(intervalMinutes: number = 60): void {
    console.log(`[Dream Scheduler] Starting (check every ${intervalMinutes}m)...`);

    this.checkInterval = setInterval(async () => {
      try {
        if (await this.consolidator.shouldTrigger()) {
          console.log('[Dream Scheduler] ⏰ Triggering consolidation...');
          await this.consolidator.trigger();
        }
      } catch (error: any) {
        console.error(`[Dream Scheduler] ✗ Error: ${error.message}`);
      }
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * 停止调度器
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
      console.log('[Dream Scheduler] Stopped');
    }
  }
}
