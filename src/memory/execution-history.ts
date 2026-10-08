/**
 * Execution History Manager
 *
 * 管理执行历史记忆，记录每次会话的命令和结果
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { gunzipSync, gzipSync } from 'zlib';
import { logger } from '../logger';
import {
  ExecutionSession,
  CommandRecord,
  SessionStats,
  CommandType,
  CommandStatus,
  HistoryQueryOptions,
  ExecutionHistoryOptions,
} from './execution-types';

/**
 * 执行历史管理器
 */
export class ExecutionHistoryManager {
  private dataDir: string;
  private compress: boolean;
  private compressAfterDays: number;
  private compressionLevel: number;
  private currentSession: ExecutionSession | null = null;

  constructor(projectRoot: string, options: ExecutionHistoryOptions = {}) {
    this.dataDir = options.dataDir || join(projectRoot, '.memo', 'executions');
    this.compress = options.compress !== false;
    this.compressAfterDays = options.compressAfterDays || 7;
    this.compressionLevel = options.compressionLevel || 9;
  }

  /**
   * 初始化历史管理器
   */
  async initialize(): Promise<void> {
    if (!existsSync(this.dataDir)) {
      await fs.mkdir(this.dataDir, { recursive: true });
    }
  }

  /**
   * 创建新会话
   */
  async createSession(sessionId: string, projectRoot: string): Promise<void> {
    const now = new Date().toISOString();

    this.currentSession = {
      sessionId,
      projectRoot,
      stats: {
        sessionId,
        startTime: now,
        endTime: now,
        totalDuration: 0,
        totalCommands: 0,
        successCommands: 0,
        failedCommands: 0,
        abortedCommands: 0,
        successRate: 100,
        averageCommandDuration: 0,
        topCommandTypes: [],
      },
      commands: [],
      version: '1.0',
    };

    logger.info(`[ExecutionHistory] Created session: ${sessionId}`);
  }

  /**
   * 记录命令开始
   */
  async recordCommandStart(
    input: string,
    type: CommandType
  ): Promise<number> {
    if (!this.currentSession) {
      logger.warn('[ExecutionHistory] No active session');
      return -1;
    }

    const index = this.currentSession.commands.length;

    const command: CommandRecord = {
      index,
      input,
      type,
      status: 'running',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: 0,
    };

    this.currentSession.commands.push(command);
    return index;
  }

  /**
   * 记录命令完成
   */
  async recordCommandEnd(
    index: number,
    status: CommandStatus,
    result: {
      duration: number;
      actionCount?: number;
      successCount?: number;
      failureCount?: number;
      tokens?: { input: number; output: number; total: number };
      error?: string;
      metadata?: any;
    } = { duration: 0 }
  ): Promise<void> {
    if (!this.currentSession) {
      logger.warn('[ExecutionHistory] No active session');
      return;
    }

    if (index < 0 || index >= this.currentSession.commands.length) {
      logger.warn(`[ExecutionHistory] Invalid command index: ${index}`);
      return;
    }

    const command = this.currentSession.commands[index];
    command.status = status;
    command.endTime = new Date().toISOString();
    command.duration = result.duration;

    if (result.actionCount !== undefined) command.actionCount = result.actionCount;
    if (result.successCount !== undefined) command.successCount = result.successCount;
    if (result.failureCount !== undefined) command.failureCount = result.failureCount;
    if (result.tokens) command.tokens = result.tokens;
    if (result.error) command.error = result.error;
    if (result.metadata) command.metadata = result.metadata;

    // 更新会话统计
    this.updateSessionStats();
  }

  /**
   * 更新会话统计
   */
  private updateSessionStats(): void {
    if (!this.currentSession) return;

    const commands = this.currentSession.commands;
    const now = new Date().toISOString();

    // 更新时间和命令数
    this.currentSession.stats.endTime = now;
    this.currentSession.stats.totalCommands = commands.length;

    // 统计各状态命令数
    let success = 0;
    let failed = 0;
    let aborted = 0;
    let totalDuration = 0;
    const typeCounts: Record<CommandType, number> = {} as any;
    const algorithms = new Set<string>();

    for (const cmd of commands) {
      switch (cmd.status) {
        case 'success':
          success++;
          break;
        case 'failed':
          failed++;
          break;
        case 'aborted':
          aborted++;
          break;
      }

      totalDuration += cmd.duration;
      typeCounts[cmd.type] = (typeCounts[cmd.type] || 0) + 1;

      if (cmd.metadata?.algorithm) {
        algorithms.add(cmd.metadata.algorithm);
      }
    }

    this.currentSession.stats.successCommands = success;
    this.currentSession.stats.failedCommands = failed;
    this.currentSession.stats.abortedCommands = aborted;
    this.currentSession.stats.totalDuration = totalDuration;
    this.currentSession.stats.averageCommandDuration =
      commands.length > 0 ? totalDuration / commands.length : 0;

    // 计算成功率（排除 pending 和 running）
    const completed = success + failed + aborted;
    this.currentSession.stats.successRate =
      completed > 0 ? (success / completed) * 100 : 100;

    // 统计最常用的命令类型
    this.currentSession.stats.topCommandTypes = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type: type as CommandType, count }));

    // 统计使用的算法
    if (algorithms.size > 0) {
      this.currentSession.stats.algorithms = Array.from(algorithms);
    }

    // 统计 token 使用
    let totalInput = 0;
    let totalOutput = 0;

    for (const cmd of commands) {
      if (cmd.tokens) {
        totalInput += cmd.tokens.input;
        totalOutput += cmd.tokens.output;
      }
    }

    if (totalInput > 0 || totalOutput > 0) {
      this.currentSession.stats.totalTokens = {
        input: totalInput,
        output: totalOutput,
        total: totalInput + totalOutput,
      };
    }
  }

  /**
   * 结束会话并保存
   */
  async endSession(): Promise<void> {
    if (!this.currentSession) {
      logger.warn('[ExecutionHistory] No active session to end');
      return;
    }

    try {
      // 更新最终统计
      this.updateSessionStats();

      // 保存会话
      await this.saveSession(this.currentSession);

      logger.info(`[ExecutionHistory] Saved session: ${this.currentSession.sessionId}`);
      logger.info(`  Commands: ${this.currentSession.stats.totalCommands}`);
      logger.info(`  Success Rate: ${this.currentSession.stats.successRate.toFixed(1)}%`);
      logger.info(`  Duration: ${this.currentSession.stats.totalDuration}ms`);

      this.currentSession = null;
    } catch (error) {
      logger.error(`[ExecutionHistory] Failed to save session: ${error}`);
    }
  }

  /**
   * 保存会话到磁盘
   */
  private async saveSession(session: ExecutionSession): Promise<void> {
    const date = new Date(session.stats.startTime);
    const yearMonth = date.toISOString().substring(0, 7); // YYYY-MM
    const monthDir = join(this.dataDir, yearMonth);

    // 创建月份目录
    if (!existsSync(monthDir)) {
      await fs.mkdir(monthDir, { recursive: true });
    }

    const filename = `${session.sessionId}.json`;
    const filepath = join(monthDir, filename);

    // 序列化
    const content = JSON.stringify(session, null, 2);

    // 写入文件
    await fs.writeFile(filepath, content, 'utf-8');
  }

  /**
   * 读取会话
   */
  private async readSession(sessionId: string): Promise<ExecutionSession | null> {
    try {
      // 尝试从不同月份目录读取
      const yearMonth = sessionId.substring(0, 7); // 假设 sessionId 以日期开头
      const monthDir = join(this.dataDir, yearMonth);
      const filepath = join(monthDir, `${sessionId}.json`);

      if (!existsSync(filepath)) {
        return null;
      }

      // 读取并解压（如果需要）
      let content = await fs.readFile(filepath, 'utf-8');

      // 检查是否是 gzip 压缩
      if (filepath.endsWith('.gz')) {
        const compressed = await fs.readFile(filepath);
        const decompressed = gunzipSync(compressed);
        content = decompressed.toString('utf-8');
      }

      return JSON.parse(content);
    } catch (error) {
      logger.error(`[ExecutionHistory] Failed to read session ${sessionId}: ${error}`);
      return null;
    }
  }

  /**
   * 搜索历史记录
   */
  async searchHistory(options: HistoryQueryOptions = {}): Promise<Array<{
    session: ExecutionSession;
    commands: CommandRecord[];
  }>> {
    const results: Array<{
      session: ExecutionSession;
      commands: CommandRecord[];
    }> = [];

    try {
      // 遍历所有月份目录
      const years = await fs.readdir(this.dataDir, { withFileTypes: true });

      for (const yearEntry of years) {
        if (!yearEntry.isDirectory()) continue;

        const yearMonthPath = join(this.dataDir, yearEntry.name);
        const files = await fs.readdir(yearMonthPath);

        for (const file of files) {
          if (!file.endsWith('.json') && !file.endsWith('.json.gz')) {
            continue;
          }

          const sessionId = file.replace('.json.gz', '').replace('.json', '');
          const session = await this.readSession(sessionId);

          if (!session) continue;

          // 过滤会话
          if (options.sessionId && session.sessionId !== options.sessionId) {
            continue;
          }

          // 过滤日期范围
          if (options.startDate || options.endDate) {
            const sessionDate = new Date(session.stats.startTime);
            if (options.startDate && sessionDate < options.startDate) continue;
            if (options.endDate && sessionDate > options.endDate) continue;
          }

          // 过滤命令
          let commands = session.commands;

          if (options.commandType) {
            commands = commands.filter(cmd => cmd.type === options.commandType);
          }

          if (options.status) {
            commands = commands.filter(cmd => cmd.status === options.status);
          }

          if (options.keyword) {
            const keywordLower = options.keyword.toLowerCase();
            commands = commands.filter(cmd =>
              cmd.input.toLowerCase().includes(keywordLower)
            );
          }

          if (commands.length > 0) {
            results.push({ session, commands });
          }

          // 限制结果数量
          if (options.limit && results.length >= options.limit) {
            break;
          }
        }

        if (options.limit && results.length >= options.limit) {
          break;
        }
      }
    } catch (error) {
      logger.error(`[ExecutionHistory] Failed to search history: ${error}`);
    }

    return results;
  }

  /**
   * 获取统计摘要
   */
  async getSummary(days = 30): Promise<{
    totalSessions: number;
    totalCommands: number;
    averageSuccessRate: number;
    totalDuration: number;
    topCommandTypes: Array<{ type: CommandType; count: number }>;
    algorithms: string[];
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await this.searchHistory({ startDate });

    let totalCommands = 0;
    let totalSuccessRate = 0;
    let totalDuration = 0;
    const typeCounts: Record<CommandType, number> = {} as any;
    const algorithms = new Set<string>();

    for (const { session } of results) {
      totalCommands += session.stats.totalCommands;
      totalSuccessRate += session.stats.successRate;
      totalDuration += session.stats.totalDuration;

      for (const cmd of session.commands) {
        typeCounts[cmd.type] = (typeCounts[cmd.type] || 0) + 1;
        if (cmd.metadata?.algorithm) {
          algorithms.add(cmd.metadata.algorithm);
        }
      }
    }

    const topCommandTypes = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type: type as CommandType, count }));

    return {
      totalSessions: results.length,
      totalCommands,
      averageSuccessRate: results.length > 0 ? totalSuccessRate / results.length : 0,
      totalDuration,
      topCommandTypes,
      algorithms: Array.from(algorithms),
    };
  }

  /**
   * 压缩旧数据
   */
  async compressOldData(): Promise<number> {
    if (!this.compress) {
      return 0;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.compressAfterDays);

    let compressedCount = 0;

    try {
      const years = await fs.readdir(this.dataDir, { withFileTypes: true });

      for (const yearEntry of years) {
        if (!yearEntry.isDirectory()) continue;

        const yearMonthPath = join(this.dataDir, yearEntry.name);
        const files = await fs.readdir(yearMonthPath);

        for (const file of files) {
          if (!file.endsWith('.json') || file.endsWith('.json.gz')) {
            continue;
          }

          const filepath = join(yearMonthPath, file);
          const stats = await fs.stat(filepath);
          const modifiedDate = stats.mtime;

          // 检查是否需要压缩
          if (modifiedDate < cutoffDate) {
            try {
              // 读取文件
              const content = await fs.readFile(filepath, 'utf-8');

              // 压缩
              const compressed = gzipSync(content, { level: this.compressionLevel });

              // 写入压缩文件
              const gzPath = filepath + '.gz';
              await fs.writeFile(gzPath, compressed);

              // 删除原文件
              await fs.unlink(filepath);

              compressedCount++;
              logger.info(`[ExecutionHistory] Compressed: ${file}`);
            } catch (error) {
              logger.error(`[ExecutionHistory] Failed to compress ${file}: ${error}`);
            }
          }
        }
      }

      if (compressedCount > 0) {
        logger.info(`[ExecutionHistory] Compressed ${compressedCount} old session(s)`);
      }
    } catch (error) {
      logger.error(`[ExecutionHistory] Failed to compress old data: ${error}`);
    }

    return compressedCount;
  }

  /**
   * 获取当前会话
   */
  getCurrentSession(): ExecutionSession | null {
    return this.currentSession;
  }

  /**
   * 获取当前会话统计信息
   */
  async getStats(): Promise<SessionStats> {
    if (this.currentSession) {
      this.updateSessionStats();
      return this.currentSession.stats;
    }

    // 如果没有当前会话，返回空统计
    return {
      sessionId: '',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      totalDuration: 0,
      totalCommands: 0,
      successCommands: 0,
      failedCommands: 0,
      abortedCommands: 0,
      successRate: 100,
      averageCommandDuration: 0,
      topCommandTypes: [],
    };
  }
}

/**
 * 创建执行历史管理器实例
 */
export function createExecutionHistoryManager(
  projectRoot: string,
  options?: ExecutionHistoryOptions
): ExecutionHistoryManager {
  return new ExecutionHistoryManager(projectRoot, options);
}
