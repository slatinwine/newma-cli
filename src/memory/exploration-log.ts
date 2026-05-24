/**
 * Exploration Log System
 *
 * 自主探索任务日志系统 - 记录每次探索的详细信息
 */

import * as fs from 'fs';
import * as path from 'path';
import { ExplorationResult } from '../agents/autonomous-explorer';

/**
 * 日志条目
 */
export interface ExplorationLogEntry {
  taskId: string;
  timestamp: string;
  duration: number;
  status: 'completed' | 'failed' | 'partial';
  summary: {
    total: number;
    completed: number;
    failed: number;
    byDomain: Record<string, number>;
  };
  insights: string[];
  recommendations: string[];
  logPath: string; // 详细日志文件路径
}

/**
 * 日志配置
 */
export interface ExplorationLogConfig {
  logDir: string; // 日志目录
  retentionDays?: number; // 保留天数（默认30）
  maxLogSize?: number; // 最大日志大小（MB，默认100）
}

/**
 * 探索日志管理器
 */
export class ExplorationLogManager {
  private config: Required<ExplorationLogConfig>;

  constructor(config: ExplorationLogConfig) {
    this.config = {
      logDir: config.logDir,
      retentionDays: config.retentionDays || 30,
      maxLogSize: config.maxLogSize || 100,
    };

    // 确保日志目录存在
    this.ensureLogDirectory();
  }

  /**
   * 记录探索结果
   */
  async logExploration(result: ExplorationResult): Promise<ExplorationLogEntry> {
    const logPath = this.getLogPath(result.taskId);

    // 1. 保存详细日志（JSON）
    await this.saveDetailedLog(result, logPath);

    // 2. 创建摘要条目
    const entry: ExplorationLogEntry = {
      taskId: result.taskId,
      timestamp: result.startTime,
      duration: result.duration,
      status: this.determineStatus(result),
      summary: result.summary,
      insights: result.insights,
      recommendations: result.recommendations,
      logPath,
    };

    // 3. 更新索引
    await this.updateIndex(entry);

    // 4. 清理旧日志
    await this.cleanupOldLogs();

    console.log(`✓ Exploration logged to: ${logPath}`);
    return entry;
  }

  /**
   * 获取日志历史
   */
  async getHistory(limit: number = 50): Promise<ExplorationLogEntry[]> {
    const indexPath = this.getIndexPath();

    if (!fs.existsSync(indexPath)) {
      return [];
    }

    try {
      const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      const entries = index.entries || [];

      // 按时间倒序排序，限制数量
      return entries
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    } catch (error: any) {
      console.error(`Failed to read exploration index: ${error.message}`);
      return [];
    }
  }

  /**
   * 获取最近一次探索结果（包含洞察和建议）
   */
  async getLastExploration(): Promise<{
    insights: string[];
    recommendations: string[];
    timestamp: string;
    taskId: string;
  } | null> {
    const history = await this.getHistory(1);

    if (history.length === 0) {
      return null;
    }

    const lastEntry = history[0];
    return {
      insights: lastEntry.insights || [],
      recommendations: lastEntry.recommendations || [],
      timestamp: lastEntry.timestamp,
      taskId: lastEntry.taskId,
    };
  }

  /**
   * 获取单个日志条目
   */
  async getLogEntry(taskId: string): Promise<ExplorationResult | null> {
    const logPath = this.getLogPath(taskId);

    if (!fs.existsSync(logPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(logPath, 'utf-8');
      return JSON.parse(content) as ExplorationResult;
    } catch (error: any) {
      console.error(`Failed to read exploration log: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取统计信息
   */
  async getStatistics(): Promise<{
    totalExplorations: number;
    successfulExplorations: number;
    failedExplorations: number;
    averageDuration: number;
    totalDuration: number;
    lastExploration?: string;
    domainCounts: Record<string, number>;
  }> {
    const entries = await this.getHistory(1000); // 获取所有历史用于统计

    const stats: any = {
      totalExplorations: entries.length,
      successfulExplorations: entries.filter((e: any) => e.status === 'completed').length,
      failedExplorations: entries.filter((e: any) => e.status === 'failed').length,
      averageDuration: 0,
      totalDuration: 0,
      lastExploration: entries.length > 0 ? entries[0].timestamp : undefined,
      domainCounts: {},
    };

    if (entries.length > 0) {
      const totalDuration = entries.reduce((sum: number, e: any) => sum + e.duration, 0);
      stats.totalDuration = totalDuration;
      stats.averageDuration = Math.floor(totalDuration / entries.length);

      // 统计领域
      entries.forEach((entry: any) => {
        if (entry.summary && entry.summary.byDomain) {
          Object.entries(entry.summary.byDomain).forEach(([domain, count]: [string, any]) => {
            stats.domainCounts[domain] = (stats.domainCounts[domain] || 0) + count;
          });
        }
      });
    }

    return stats;
  }

  /**
   * 删除日志条目
   */
  async deleteLogEntry(taskId: string): Promise<boolean> {
    const logPath = this.getLogPath(taskId);

    // 删除详细日志
    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath);
    }

    // 从索引中移除
    const indexPath = this.getIndexPath();
    if (fs.existsSync(indexPath)) {
      try {
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        index.entries = (index.entries || []).filter((e: any) => e.taskId !== taskId);
        fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
        return true;
      } catch (error: any) {
        console.error(`Failed to update index: ${error.message}`);
        return false;
      }
    }

    return false;
  }

  /**
   * 清理旧日志
   */
  async cleanupOldLogs(): Promise<void> {
    const entries = await this.getHistory(10000); // 获取所有条目
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    let deletedCount = 0;

    for (const entry of entries as any) {
      const entryDate = new Date(entry.timestamp);
      if (entryDate < cutoffDate) {
        await this.deleteLogEntry(entry.taskId);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`🧹 Cleaned up ${deletedCount} old exploration logs`);
    }
  }

  /**
   * 生成可读报告
   */
  async generateReport(): Promise<string> {
    const stats = await this.getStatistics();
    const recentEntries = await this.getHistory(10);

    const report = `
# Autonomous Exploration Report

Generated: ${new Date().toISOString()}

## Summary Statistics
- Total Explorations: ${stats.totalExplorations}
- Successful: ${stats.successfulExplorations}
- Failed: ${stats.failedExplorations}
- Average Duration: ${this.formatDuration(stats.averageDuration)}
- Total Exploration Time: ${this.formatDuration(stats.totalDuration)}
- Last Exploration: ${stats.lastExploration || 'N/A'}

## Domain Activity
${Object.entries(stats.domainCounts)
  .map(([domain, count]) => `- ${domain}: ${count} actions`)
  .join('\n')}

## Recent Explorations (Last 10)
${recentEntries
  .map(
    (entry: any, i) => `
${i + 1}. **${entry.taskId}** (${new Date(entry.timestamp).toLocaleString()})
   - Status: ${entry.status}
   - Duration: ${this.formatDuration(entry.duration)}
   - Actions: ${entry.summary?.total || 0} (${entry.summary?.completed || 0} completed)
   - Insights: ${entry.insights?.length || 0}
`
  )
  .join('\n')}
`.trim();

    return report;
  }

  // ========== Private Methods ==========

  /**
   * 保存详细日志
   */
  private async saveDetailedLog(result: ExplorationResult, logPath: string): Promise<void> {
    const content = JSON.stringify(result, null, 2);
    fs.writeFileSync(logPath, content, 'utf-8');
  }

  /**
   * 更新索引
   */
  private async updateIndex(entry: ExplorationLogEntry): Promise<void> {
    const indexPath = this.getIndexPath();
    let index: any = { entries: [] };

    // 读取现有索引
    if (fs.existsSync(indexPath)) {
      try {
        index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      } catch (error: any) {
        console.warn(`Failed to read index, creating new: ${error.message}`);
      }
    }

    // 添加新条目
    index.entries = index.entries || [];
    index.entries.push(entry);

    // 保存索引
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }

  /**
   * 确定状态
   */
  private determineStatus(result: ExplorationResult): 'completed' | 'failed' | 'partial' {
    if (result.summary.failed === 0) {
      return 'completed';
    } else if (result.summary.completed === 0) {
      return 'failed';
    } else {
      return 'partial';
    }
  }

  /**
   * 获取日志文件路径
   */
  private getLogPath(taskId: string): string {
    const date = new Date();
    const dateDir = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`;
    const dir = path.join(this.config.logDir, dateDir);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    return path.join(dir, `${taskId}.json`);
  }

  /**
   * 获取索引文件路径
   */
  private getIndexPath(): string {
    return path.join(this.config.logDir, 'exploration-index.json');
  }

  /**
   * 确保日志目录存在
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.config.logDir)) {
      fs.mkdirSync(this.config.logDir, { recursive: true });
    }
  }

  /**
   * 格式化持续时间
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}
