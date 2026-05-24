/**
 * Error Solution Memory Manager
 *
 * 管理错误和解决方案的记忆系统
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  ErrorRecord,
  Solution,
  ErrorPattern,
  ErrorQueryOptions,
  ErrorMemoryOptions,
  ErrorCategory,
  ErrorSeverity,
} from './error-types';

/**
 * 错误记忆管理器
 */
export class ErrorMemoryManager {
  private dataDir: string;
  private errorsFile: string;
  private patternsFile: string;
  private maxErrors: number;
  private maxSolutions: number;
  private errors: ErrorRecord[] = [];
  private patterns: Map<string, ErrorPattern> = new Map();

  constructor(projectRoot: string, options: ErrorMemoryOptions = {}) {
    this.dataDir = options.dataDir || join(projectRoot, '.memo', 'errors');
    this.errorsFile = join(this.dataDir, 'errors.json');
    this.patternsFile = join(this.dataDir, 'patterns.json');
    this.maxErrors = options.maxErrors || 1000;
    this.maxSolutions = options.maxSolutions || 500;
  }

  /**
   * 初始化错误记忆管理器
   */
  async initialize(): Promise<void> {
    if (!existsSync(this.dataDir)) {
      await fs.mkdir(this.dataDir, { recursive: true });
    }

    // 加载错误记录
    await this.loadErrors();

    // 加载错误模式
    await this.loadPatterns();

    console.log(`[ErrorMemory] Loaded ${this.errors.length} error records`);
  }

  /**
   * 加载错误记录
   */
  private async loadErrors(): Promise<void> {
    try {
      if (!existsSync(this.errorsFile)) {
        this.errors = [];
        return;
      }

      const content = await fs.readFile(this.errorsFile, 'utf-8');
      this.errors = JSON.parse(content);
    } catch (error) {
      console.error(`[ErrorMemory] Failed to load errors: ${error}`);
      this.errors = [];
    }
  }

  /**
   * 保存错误记录
   */
  private async saveErrors(): Promise<void> {
    try {
      const content = JSON.stringify(this.errors, null, 2);
      await fs.writeFile(this.errorsFile, content, 'utf-8');
    } catch (error) {
      console.error(`[ErrorMemory] Failed to save errors: ${error}`);
    }
  }

  /**
   * 加载错误模式
   */
  private async loadPatterns(): Promise<void> {
    try {
      if (!existsSync(this.patternsFile)) {
        return;
      }

      const content = await fs.readFile(this.patternsFile, 'utf-8');
      const patternsArray: ErrorPattern[] = JSON.parse(content);

      this.patterns.clear();
      for (const pattern of patternsArray) {
        this.patterns.set(pattern.errorType, pattern);
      }
    } catch (error) {
      console.error(`[ErrorMemory] Failed to load patterns: ${error}`);
    }
  }

  /**
   * 保存错误模式
   */
  private async savePatterns(): Promise<void> {
    try {
      const patternsArray = Array.from(this.patterns.values());
      const content = JSON.stringify(patternsArray, null, 2);
      await fs.writeFile(this.patternsFile, content, 'utf-8');
    } catch (error) {
      console.error(`[ErrorMemory] Failed to save patterns: ${error}`);
    }
  }

  /**
   * 生成错误 ID
   */
  private generateErrorId(errorType: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    const hash = errorType.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    return `err-${hash}-${timestamp}-${random}`;
  }

  /**
   * 分析错误类型
   */
  private analyzeError(errorMessage: string): { category: ErrorCategory; severity: ErrorSeverity } {
    const msg = errorMessage.toLowerCase();

    // 分类
    let category: ErrorCategory = 'other';
    if (msg.includes('syntax') || msg.includes('parse')) category = 'syntax';
    else if (msg.includes('type')) category = 'type';
    else if (msg.includes('network') || msg.includes('fetch') || msg.includes('request')) category = 'network';
    else if (msg.includes('enoent') || msg.includes('file not found')) category = 'file';
    else if (msg.includes('permission') || msg.includes('unauthorized')) category = 'permission';
    else if (msg.includes('cannot find module')) category = 'dependency';
    else if (msg.includes('config') || msg.includes('.env')) category = 'configuration';
    else if (msg.includes('api') || msg.includes('endpoint')) category = 'api';
    else if (msg.includes('build') || msg.includes('compile')) category = 'build';
    else if (msg.includes('test')) category = 'test';

    // 严重程度
    let severity: ErrorSeverity = 'medium';
    if (msg.includes('critical') || msg.includes('fatal')) severity = 'critical';
    else if (msg.includes('error') && !msg.includes('warning')) severity = 'high';
    else if (msg.includes('warn')) severity = 'low';

    return { category, severity };
  }

  /**
   * 记录错误
   */
  async recordError(error: {
    errorType: string;
    errorMessage: string;
    command: string;
    commandType: string;
    task?: string;
    files?: string[];
    stackTrace?: string;
    metadata?: Record<string, any>;
    tags?: string[];
  }): Promise<string> {
    const { category, severity } = this.analyzeError(error.errorMessage);

    // 检查是否已存在相同错误
    const existingError = this.errors.find(
      e => e.errorType === error.errorType && e.errorMessage === error.errorMessage
    );

    if (existingError) {
      // 更新出现次数
      existingError.occurrenceCount++;
      existingError.lastOccurrence = new Date().toISOString();
      await this.saveErrors();
      await this.updatePattern(existingError);
      return existingError.id;
    }

    // 创建新错误记录
    const errorRecord: ErrorRecord = {
      id: this.generateErrorId(error.errorType),
      errorType: error.errorType,
      errorMessage: error.errorMessage,
      category,
      severity,
      timestamp: new Date().toISOString(),
      context: {
        command: error.command,
        commandType: error.commandType,
        task: error.task,
        files: error.files,
        stackTrace: error.stackTrace,
        metadata: error.metadata,
      },
      resolved: false,
      occurrenceCount: 1,
      lastOccurrence: new Date().toISOString(),
      tags: error.tags || [],
    };

    // 添加到错误列表
    this.errors.unshift(errorRecord);

    // 限制数量
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }

    await this.saveErrors();
    await this.updatePattern(errorRecord);

    console.log(`[ErrorMemory] Recorded error: ${error.errorType}`);
    return errorRecord.id;
  }

  /**
   * 记录解决方案
   */
  async recordSolution(
    errorId: string,
    solution: {
      description: string;
      steps: string[];
      method: 'manual' | 'automatic' | 'retry' | 'workaround';
      codeExample?: string;
      links?: string[];
    }
  ): Promise<void> {
    const error = this.errors.find(e => e.id === errorId);

    if (!error) {
      console.warn(`[ErrorMemory] Error not found: ${errorId}`);
      return;
    }

    const solutionRecord: Solution = {
      description: solution.description,
      steps: solution.steps,
      timestamp: new Date().toISOString(),
      method: solution.method,
      verified: false,
      successRate: 1.0, // 初始成功率为 100%
      usageCount: 0,
      lastUsed: new Date().toISOString(),
      codeExample: solution.codeExample,
      links: solution.links,
    };

    error.solution = solutionRecord;
    error.resolved = true;

    await this.saveErrors();
    await this.updatePattern(error);

    console.log(`[ErrorMemory] Recorded solution for: ${error.errorType}`);
  }

  /**
   * 更新错误模式
   */
  private async updatePattern(error: ErrorRecord): Promise<void> {
    let pattern = this.patterns.get(error.errorType);

    if (!pattern) {
      pattern = {
        errorType: error.errorType,
        category: error.category,
        frequency: 0,
        avgResolutionTime: 0,
        resolutionRate: 0,
        commonContexts: [],
        lastOccurrence: error.lastOccurrence,
      };
      this.patterns.set(error.errorType, pattern);
    }

    // 更新频率
    pattern.frequency = error.occurrenceCount;

    // 更新最后出现时间
    pattern.lastOccurrence = error.lastOccurrence;

    // 更新解决率
    const allErrorsOfType = this.errors.filter(e => e.errorType === error.errorType);
    const resolvedCount = allErrorsOfType.filter(e => e.resolved).length;
    pattern.resolutionRate = allErrorsOfType.length > 0 ? resolvedCount / allErrorsOfType.length : 0;

    // 更新最有效的解决方案
    if (error.solution) {
      if (!pattern.topSolution || error.solution.successRate > pattern.topSolution.successRate) {
        pattern.topSolution = {
          description: error.solution.description,
          successRate: error.solution.successRate,
          usageCount: error.solution.usageCount,
        };
      }
    }

    // 更新常见上下文
    const contextMap = new Map<string, number>();
    allErrorsOfType.forEach(e => {
      const count = contextMap.get(e.context.command) || 0;
      contextMap.set(e.context.command, count + 1);
    });

    pattern.commonContexts = Array.from(contextMap.entries())
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    await this.savePatterns();
  }

  /**
   * 搜索错误
   */
  async searchErrors(options: ErrorQueryOptions = {}): Promise<ErrorRecord[]> {
    let results = this.errors;

    // 过滤错误类型
    if (options.errorType) {
      results = results.filter(e => e.errorType === options.errorType);
    }

    // 过滤分类
    if (options.category) {
      results = results.filter(e => e.category === options.category);
    }

    // 过滤严重程度
    if (options.severity) {
      results = results.filter(e => e.severity === options.severity);
    }

    // 过滤解决状态
    if (options.resolved !== undefined) {
      results = results.filter(e => e.resolved === options.resolved);
    }

    // 关键词搜索
    if (options.keyword) {
      const keywordLower = options.keyword.toLowerCase();
      results = results.filter(e =>
        e.errorType.toLowerCase().includes(keywordLower) ||
        e.errorMessage.toLowerCase().includes(keywordLower) ||
        e.context.command.toLowerCase().includes(keywordLower)
      );
    }

    // 标签过滤
    if (options.tags && options.tags.length > 0) {
      results = results.filter(e =>
        options.tags!.some(tag => e.tags.includes(tag))
      );
    }

    // 日期范围
    if (options.startDate) {
      results = results.filter(e => new Date(e.timestamp) >= options.startDate!);
    }

    if (options.endDate) {
      results = results.filter(e => new Date(e.timestamp) <= options.endDate!);
    }

    // 只包含有解决方案的
    if (options.withSolutionOnly) {
      results = results.filter(e => e.resolved && e.solution);
    }

    // 限制数量
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * 查找相似错误（基于错误类型或消息）
   */
  async findSimilarErrors(errorType: string, errorMessage: string, limit = 5): Promise<ErrorRecord[]> {
    const results: Array<{ error: ErrorRecord; score: number }> = [];

    for (const error of this.errors) {
      let score = 0;

      // 完全匹配类型
      if (error.errorType === errorType) {
        score += 10;
      }

      // 部分匹配类型
      if (error.errorType.includes(errorType) || errorType.includes(error.errorType)) {
        score += 5;
      }

      // 消息相似度
      const msgWords = errorMessage.toLowerCase().split(/\s+/);
      const errorMsgWords = error.errorMessage.toLowerCase().split(/\s+/);
      const commonWords = msgWords.filter(w => errorMsgWords.includes(w));
      score += commonWords.length * 2;

      if (score > 0) {
        results.push({ error, score });
      }
    }

    // 按分数排序
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit).map(r => r.error);
  }

  /**
   * 获取错误模式统计
   */
  async getErrorPatterns(limit = 10): Promise<ErrorPattern[]> {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
  }

  /**
   * 使用解决方案
   */
  async useSolution(errorId: string): Promise<Solution | null> {
    const error = this.errors.find(e => e.id === errorId);

    if (!error || !error.solution) {
      return null;
    }

    // 更新使用统计
    error.solution.usageCount++;
    error.solution.lastUsed = new Date().toISOString();

    await this.saveErrors();

    return error.solution;
  }

  /**
   * 验证解决方案
   */
  async verifySolution(errorId: string, success: boolean): Promise<void> {
    const error = this.errors.find(e => e.id === errorId);

    if (!error || !error.solution) {
      return;
    }

    // 更新验证状态
    error.solution.verified = true;

    // 更新成功率（使用加权平均）
    const currentRate = error.solution.successRate;
    const newRate = success ? 1.0 : 0.0;
    error.solution.successRate = (currentRate * 0.8) + (newRate * 0.2);

    await this.saveErrors();
    await this.updatePattern(error);

    console.log(`[ErrorMemory] Solution ${success ? 'verified' : 'failed'} for: ${error.errorType}`);
  }

  /**
   * 获取统计摘要
   */
  async getSummary(days = 30): Promise<{
    totalErrors: number;
    resolvedErrors: number;
    resolutionRate: number;
    topErrors: Array<{ errorType: string; count: number }>;
    topCategories: Array<{ category: string; count: number }>;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentErrors = this.errors.filter(e => new Date(e.timestamp) >= cutoffDate);

    const totalErrors = recentErrors.length;
    const resolvedErrors = recentErrors.filter(e => e.resolved).length;
    const resolutionRate = totalErrors > 0 ? resolvedErrors / totalErrors : 0;

    // 统计最常见错误
    const errorTypeCounts = new Map<string, number>();
    const categoryCounts = new Map<ErrorCategory, number>();

    recentErrors.forEach(e => {
      errorTypeCounts.set(e.errorType, (errorTypeCounts.get(e.errorType) || 0) + 1);
      categoryCounts.set(e.category, (categoryCounts.get(e.category) || 0) + 1);
    });

    const topErrors = Array.from(errorTypeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([errorType, count]) => ({ errorType, count }));

    const topCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count }));

    return {
      totalErrors,
      resolvedErrors,
      resolutionRate,
      topErrors,
      topCategories,
    };
  }
}

/**
 * 创建错误记忆管理器实例
 */
export function createErrorMemoryManager(
  projectRoot: string,
  options?: ErrorMemoryOptions
): ErrorMemoryManager {
  return new ErrorMemoryManager(projectRoot, options);
}
