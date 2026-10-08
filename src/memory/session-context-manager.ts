/**
 * Session Context Memory Manager
 *
 * 管理跨会话的对话历史和上下文
 * Enhanced with sharded storage for better performance
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';
import { logger } from '../logger';
import {
  SessionContextStorage,
  SessionRecord,
  SessionMessage,
  ContextSearchOptions,
  ContextSearchResult,
  SessionMessageType,
} from './session-context-types';

/**
 * Session index entry for sharded storage
 */
interface SessionIndexEntry {
  id: string;
  date: string;
  topic: string;
  summary: string;
  messageCount: number;
  keyDecisions: string[];
  filePath: string;
  startTime: string;
  endTime?: string;
  status: string;
  tags: string[];
  techStack: string[];
  compressed: boolean;
}

/**
 * Session index structure
 */
interface SessionIndex {
  sessions: SessionIndexEntry[];
  lastUpdated: string;
  version: string;
}

/**
 * 会话上下文管理器 - Enhanced with sharded storage
 */
export class SessionContextManager {
  private projectRoot: string;
  private storageFile: string;
  private sessionsDir: string;
  private indexFile: string;
  private storage: SessionContextStorage;
  private currentSession: SessionRecord | null = null;
  private sessionIndex: SessionIndex;
  private useShardedStorage: boolean = true;
  /**
   * 索引是派生数据（计数/主题），不必随每条消息同步落盘——
   * 标脏 + 防抖合并（消息文件本身仍逐条持久化，崩溃不丢消息）
   */
  private indexDirty = false;
  private indexFlushTimer: NodeJS.Timeout | null = null;
  private static readonly INDEX_FLUSH_DELAY_MS = 2000;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.storageFile = join(projectRoot, '.memo', 'sessions.json');
    this.sessionsDir = join(projectRoot, '.memo', 'sessions');
    this.indexFile = join(this.sessionsDir, 'index.json');
    this.storage = {
      sessions: [],
      lastUpdated: new Date().toISOString(),
      stats: {
        totalSessions: 0,
        totalMessages: 0,
        totalTokens: 0,
        averageSessionLength: 0,
      },
    };
    this.sessionIndex = {
      sessions: [],
      lastUpdated: new Date().toISOString(),
      version: '2.0',
    };
  }

  /**
   * 初始化管理器
   */
  async initialize(): Promise<void> {
    const dir = join(this.projectRoot, '.memo');
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Create sessions directory
    if (!existsSync(this.sessionsDir)) {
      await fs.mkdir(this.sessionsDir, { recursive: true });
    }

    // Check if we need to migrate from old storage
    if (existsSync(this.storageFile) && !existsSync(this.indexFile)) {
      logger.debug('[SessionContext] Migrating to sharded storage...');
      await this.migrateToShardedStorage();
    }

    if (this.useShardedStorage) {
      await this.loadSessionIndex();
    } else {
      await this.loadStorage();
    }
  }

  /**
   * Migrate from old single-file storage to sharded storage
   */
  private async migrateToShardedStorage(): Promise<void> {
    try {
      // Load old storage
      const content = await fs.readFile(this.storageFile, 'utf-8');
      const oldStorage: SessionContextStorage = JSON.parse(content);

      logger.debug(`[SessionContext] Migrating ${oldStorage.sessions.length} sessions...`);

      // Migrate each session to a separate file
      for (const session of oldStorage.sessions) {
        await this.saveSessionToFile(session);
      }

      // Build index
      const indexEntries: SessionIndexEntry[] = oldStorage.sessions.map(session => ({
        id: session.id,
        date: session.startTime.split('T')[0],
        topic: session.title,
        summary: session.summary || '',
        messageCount: session.stats.messageCount,
        keyDecisions: session.contextVector?.topics || [],
        filePath: this.getSessionFilePath(session.id),
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
        tags: session.tags,
        techStack: session.contextVector?.techStack || [],
        compressed: false,
      }));

      // Save index
      this.sessionIndex = {
        sessions: indexEntries,
        lastUpdated: new Date().toISOString(),
        version: '2.0',
      };
      await this.saveSessionIndex();

      // Backup old file
      const backupFile = this.storageFile + '.backup';
      await fs.rename(this.storageFile, backupFile);

      logger.debug('[SessionContext] Migration complete. Old file backed up to:', backupFile);
    } catch (error) {
      logger.error('[SessionContext] Migration failed:', error);
      // Continue with old storage if migration fails
      this.useShardedStorage = false;
    }
  }

  /**
   * Load session index
   */
  private async loadSessionIndex(): Promise<void> {
    try {
      if (!existsSync(this.indexFile)) {
        return;
      }

      const content = await fs.readFile(this.indexFile, 'utf-8');
      this.sessionIndex = JSON.parse(content);

      // Update storage stats from index
      this.storage.stats.totalSessions = this.sessionIndex.sessions.length;
      this.storage.stats.totalMessages = this.sessionIndex.sessions.reduce(
        (sum, s) => sum + s.messageCount, 0
      );

    } catch (error) {
      logger.error(`[SessionContext] Failed to load index: ${error}`);
    }
  }

  /**
   * Save session index
   */
  private async saveSessionIndex(): Promise<void> {
    try {
      this.sessionIndex.lastUpdated = new Date().toISOString();
      const content = JSON.stringify(this.sessionIndex, null, 2);
      await fs.writeFile(this.indexFile, content, 'utf-8');
    } catch (error) {
      logger.error(`[SessionContext] Failed to save index: ${error}`);
    }
  }

  /**
   * Get file path for a session
   */
  private getSessionFilePath(sessionId: string): string {
    // Extract date from session index entry or fall back to current date
    const indexEntry = this.sessionIndex.sessions.find(s => s.id === sessionId);
    const date = indexEntry ? new Date(indexEntry.startTime) : new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    return join(this.sessionsDir, `${year}-${month}`, `${sessionId}.json`);
  }

  /**
   * Save session to individual file
   */
  private async saveSessionToFile(session: SessionRecord): Promise<void> {
    try {
      const filePath = this.getSessionFilePath(session.id);
      const dir = join(filePath, '..');

      // Create directory if it doesn't exist
      if (!existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
      }

      const content = JSON.stringify(session, null, 2);
      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      logger.error(`[SessionContext] Failed to save session file: ${error}`);
    }
  }

  /**
   * Load session from file
   *
   * 容错：其他进程（或同进程的其它实例）可能已把会话写入磁盘但本实例
   * 的内存索引是旧的——先重载索引，仍无条目则直接扫描会话目录。
   */
  private async loadSessionFromFile(sessionId: string): Promise<SessionRecord | null> {
    try {
      let indexEntry = this.sessionIndex.sessions.find(s => s.id === sessionId);

      if (!indexEntry) {
        // 重载磁盘索引（跨实例读档场景）
        await this.loadSessionIndex();
        indexEntry = this.sessionIndex.sessions.find(s => s.id === sessionId);
      }

      let filePath: string | undefined = indexEntry
        ? join(this.sessionsDir, indexEntry.filePath)
        : undefined;

      if (!filePath || !existsSync(filePath)) {
        // 索引也找不到：扫描目录兜底（sessions/YYYY-MM/<id>.json）
        filePath = (await this.scanForSessionFile(sessionId)) ?? undefined;
      }

      if (!filePath || !existsSync(filePath)) {
        return null;
      }

      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.error(`[SessionContext] Failed to load session file: ${error}`);
      return null;
    }
  }

  /**
   * 在会话目录中扫描指定 ID 的会话文件（索引缺失时的兜底）
   */
  private async scanForSessionFile(sessionId: string): Promise<string | null> {
    try {
      if (!existsSync(this.sessionsDir)) return null;

      const months = await fs.readdir(this.sessionsDir);
      for (const month of months) {
        const monthDir = join(this.sessionsDir, month);
        const stat = await fs.stat(monthDir).catch(() => null);
        if (!stat?.isDirectory()) continue;

        const files = await fs.readdir(monthDir);
        const match = files.find(f => f === `${sessionId}.json`);
        if (match) {
          return join(monthDir, match);
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 加载存储 (legacy method for backward compatibility)
   */
  private async loadStorage(): Promise<void> {
    try {
      if (!existsSync(this.storageFile)) {
        return;
      }

      const content = await fs.readFile(this.storageFile, 'utf-8');
      this.storage = JSON.parse(content);
    } catch (error) {
      logger.error(`[SessionContext] Failed to load: ${error}`);
    }
  }

  /**
   * 保存存储 (legacy method for backward compatibility)
   */
  private async saveStorage(): Promise<void> {
    try {
      this.storage.lastUpdated = new Date().toISOString();
      const content = JSON.stringify(this.storage, null, 2);
      await fs.writeFile(this.storageFile, content, 'utf-8');
    } catch (error) {
      logger.error(`[SessionContext] Failed to save: ${error}`);
    }
  }

  /**
   * 创建新会话
   *
   * sessionId 可选：传入则使用（session.ts 用 SessionManager 的会话 ID
   * 保持两侧一致），缺省自动生成。
   */
  async createSession(sessionId?: string): Promise<string> {
    const finalId = sessionId || this.generateSessionId();
    const session: SessionRecord = {
      id: finalId,
      startTime: new Date().toISOString(),
      title: 'New Session',
      messages: [],
      tags: [],
      status: 'active',
      projectRoot: this.projectRoot,
      stats: {
        messageCount: 0,
        totalTokens: 0,
        userMessageCount: 0,
        assistantMessageCount: 0,
      },
      contextVector: {
        keywords: [],
        topics: [],
        techStack: [],
      },
    };

    if (this.useShardedStorage) {
      // Add to index
      const indexEntry: SessionIndexEntry = {
        id: session.id,
        date: session.startTime.split('T')[0],
        topic: session.title,
        summary: '',
        messageCount: 0,
        keyDecisions: [],
        filePath: this.getSessionFilePath(session.id),
        startTime: session.startTime,
        status: session.status,
        tags: session.tags,
        techStack: [],
        compressed: false,
      };

      this.sessionIndex.sessions.push(indexEntry);
      await this.saveSessionToFile(session);
      await this.saveSessionIndex();
    } else {
      this.storage.sessions.push(session);
      this.storage.activeSessionId = finalId;
      await this.saveStorage();
    }

    this.currentSession = session;
    return finalId;
  }

  /**
   * 添加消息到当前会话
   *
   * parentMessageId 缺省时链接到上一条消息（线性语义）；
   * 时间旅行后由调用方传入回跳目标消息 ID（分支语义）。
   */
  async addMessage(
    role: SessionMessageType,
    content: string,
    metadata?: SessionMessage['metadata'],
    parentMessageId?: string
  ): Promise<void> {
    if (!this.currentSession) {
      logger.warn('[SessionContext] No active session');
      return;
    }

    const activeMessages = this.getActiveMessages();
    const message: SessionMessage = {
      id: this.generateMessageId(),
      role,
      content,
      timestamp: new Date().toISOString(),
      sessionId: this.currentSession.id,
      parentMessageId: parentMessageId ?? activeMessages[activeMessages.length - 1]?.id,
      metadata,
    };

    this.currentSession.messages.push(message);
    this.updateSessionStats(this.currentSession, message);

    if (this.useShardedStorage) {
      // Update index entry
      const indexEntry = this.sessionIndex.sessions.find(s => s.id === this.currentSession!.id);
      if (indexEntry) {
        indexEntry.messageCount = this.currentSession.stats.messageCount;
        indexEntry.techStack = this.currentSession.contextVector?.techStack || [];
        indexEntry.keyDecisions = this.currentSession.contextVector?.topics || [];
      }
      await this.saveSessionToFile(this.currentSession);
      // 热路径：索引标脏防抖（见 flushSessionIndex）
      this.scheduleIndexFlush();
    } else {
      await this.saveStorage();
    }
  }

  /**
   * 索引防抖：合并短时间内的多次标脏，一次落盘
   */
  private scheduleIndexFlush(): void {
    this.indexDirty = true;
    if (this.indexFlushTimer) return;
    this.indexFlushTimer = setTimeout(() => {
      this.indexFlushTimer = null;
      void this.flushSessionIndex();
    }, SessionContextManager.INDEX_FLUSH_DELAY_MS);
    // 不阻止进程退出
    this.indexFlushTimer.unref?.();
  }

  /**
   * 立即落盘脏索引（读路径与退出前调用，保证对外一致）
   */
  async flushSessionIndex(): Promise<void> {
    if (this.indexFlushTimer) {
      clearTimeout(this.indexFlushTimer);
      this.indexFlushTimer = null;
    }
    if (!this.indexDirty) return;
    this.indexDirty = false;
    await this.saveSessionIndex();
  }

  /**
   * 获取当前活跃路径上的消息（剔除废弃分支区间的消息）
   */
  getActiveMessages(): SessionMessage[] {
    return filterActiveMessages(this.currentSession);
  }

  /**
   * 按会话 ID 获取活跃路径消息（跨实例：从磁盘加载）
   * 供对话回放/续聊使用——读档后 AI 能"记得"恢复回来的对话
   */
  async getActiveMessagesById(sessionId: string): Promise<SessionMessage[]> {
    const session = await this.getSession(sessionId);
    if (!session) return [];
    return filterActiveMessages(session);
  }

  /**
   * 获取当前会话最后一条消息
   */
  getLastMessage(): SessionMessage | null {
    if (!this.currentSession || this.currentSession.messages.length === 0) {
      return null;
    }
    const messages = this.currentSession.messages;
    return messages[messages.length - 1];
  }

  /**
   * 时间旅行：把 fromMessageId 之后至末尾的消息标记为废弃分支
   * （消息保留在文件里，但不再进入 AI 上下文）
   */
  async markAbandonedFrom(fromMessageId: string, reason?: string): Promise<boolean> {
    if (!this.currentSession) return false;

    const messages = this.currentSession.messages;
    const fromIndex = messages.findIndex((m) => m.id === fromMessageId);
    if (fromIndex === -1 || fromIndex === messages.length - 1) {
      return false;
    }

    this.currentSession.abandonedRanges = this.currentSession.abandonedRanges ?? [];
    this.currentSession.abandonedRanges.push({
      fromMessageId: messages[fromIndex + 1].id,
      toMessageId: messages[messages.length - 1].id,
      reason,
    });

    await this.saveSessionToFile(this.currentSession);
    return true;
  }

  /**
   * 读档：把历史会话加载为当前会话（消息上下文随之恢复）
   */
  async restoreSession(sessionId: string): Promise<SessionRecord | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    // 恢复为活跃状态继续对话
    session.status = 'active';
    session.endTime = undefined;
    this.currentSession = session;

    if (this.useShardedStorage) {
      // 索引里若无此会话则补一条（跨进程读档的容错）
      if (!this.sessionIndex.sessions.find((s) => s.id === sessionId)) {
        this.sessionIndex.sessions.push({
          id: session.id,
          date: session.startTime.split('T')[0],
          topic: session.title,
          summary: session.summary || '',
          messageCount: session.stats.messageCount,
          keyDecisions: session.contextVector?.topics || [],
          filePath: this.getSessionFilePath(session.id),
          startTime: session.startTime,
          status: session.status,
          tags: session.tags,
          techStack: session.contextVector?.techStack || [],
          compressed: false,
        });
      }
      await this.saveSessionToFile(session);
      await this.saveSessionIndex();
    } else {
      this.storage.activeSessionId = sessionId;
      await this.saveStorage();
    }

    return session;
  }

  /**
   * 更新会话统计
   */
  private updateSessionStats(session: SessionRecord, message: SessionMessage): void {
    session.stats.messageCount++;
    session.stats.totalTokens += message.metadata?.tokens || message.tokens || 0;

    if (message.role === 'user') {
      session.stats.userMessageCount++;
    } else if (message.role === 'assistant') {
      session.stats.assistantMessageCount++;
    }

    // 更新上下文向量
    this.updateContextVector(session, message);
  }

  /**
   * 更新上下文向量
   */
  private updateContextVector(session: SessionRecord, message: SessionMessage): void {
    const content = message.content.toLowerCase();

    // 提取技术栈关键词
    const techKeywords = [
      'typescript', 'javascript', 'python', 'rust', 'go', 'java',
      'react', 'vue', 'angular', 'svelte', 'next', 'nuxt',
      'node', 'express', 'fastapi', 'django', 'flask',
      'mysql', 'postgresql', 'mongodb', 'redis',
      'docker', 'kubernetes', 'aws', 'azure',
    ];

    techKeywords.forEach(tech => {
      if (content.includes(tech) && !session.contextVector!.techStack.includes(tech)) {
        session.contextVector!.techStack.push(tech);
      }
    });

    // 提取主题关键词
    const topicKeywords = [
      'authentication', 'authorization', 'api', 'database', 'frontend', 'backend',
      'testing', 'deployment', 'performance', 'security', 'ui', 'ux',
      'refactor', 'optimization', 'bug', 'feature', 'documentation',
    ];

    topicKeywords.forEach(topic => {
      if (content.includes(topic) && !session.contextVector!.topics.includes(topic)) {
        session.contextVector!.topics.push(topic);
      }
    });

    // 提取一般关键词（简单的词频统计）
    const words = content.split(/\s+/).filter(w => w.length > 4);
    words.forEach(word => {
      if (!session.contextVector!.keywords.includes(word)) {
        session.contextVector!.keywords.push(word);
      }
    });

    // 限制关键词数量
    if (session.contextVector!.keywords.length > 50) {
      session.contextVector!.keywords = session.contextVector!.keywords.slice(0, 50);
    }
  }

  /**
   * 结束会话
   */
  async endSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    // 退出前把防抖中的索引落盘
    await this.flushSessionIndex();

    this.currentSession.endTime = new Date().toISOString();
    this.currentSession.status = 'completed';

    // 计算持续时间
    const start = new Date(this.currentSession.startTime).getTime();
    const end = new Date(this.currentSession.endTime).getTime();
    this.currentSession.stats.duration = end - start;

    // 生成会话标题和摘要
    this.currentSession.title = this.generateSessionTitle(this.currentSession);
    this.currentSession.summary = this.generateSessionSummary(this.currentSession);

    if (this.useShardedStorage) {
      // Update index entry
      const indexEntry = this.sessionIndex.sessions.find(s => s.id === this.currentSession!.id);
      if (indexEntry) {
        indexEntry.topic = this.currentSession.title;
        indexEntry.summary = this.currentSession.summary || '';
        indexEntry.endTime = this.currentSession.endTime;
        indexEntry.status = this.currentSession.status;
      }
      await this.saveSessionToFile(this.currentSession);
      await this.saveSessionIndex();
    } else {
      this.storage.activeSessionId = undefined;
      await this.saveStorage();
    }

    this.currentSession = null;
  }

  /**
   * 生成会话标题
   */
  private generateSessionTitle(session: SessionRecord): string {
    const userMessages = session.messages.filter(m => m.role === 'user');

    if (userMessages.length === 0) {
      return 'Empty Session';
    }

    // 使用第一条用户消息的前 50 个字符
    const firstMessage = userMessages[0].content;
    return firstMessage.length > 50
      ? firstMessage.substring(0, 47) + '...'
      : firstMessage;
  }

  /**
   * 生成会话摘要
   */
  private generateSessionSummary(session: SessionRecord): string {
    const topics = session.contextVector?.topics.slice(0, 3).join(', ') || 'N/A';
    const tech = session.contextVector?.techStack.slice(0, 3).join(', ') || 'N/A';

    return `Topics: ${topics}. Tech: ${tech}. Messages: ${session.stats.messageCount}.`;
  }

  /**
   * 搜索相关上下文
   */
  async searchContext(options: ContextSearchOptions): Promise<ContextSearchResult[]> {
    await this.flushSessionIndex();
    const results: ContextSearchResult[] = [];
    const limit = options.limit || 10;

    let sessionsToSearch: SessionRecord[] = [];

    if (this.useShardedStorage) {
      // Fast path: search using index first, then load only relevant sessions
      const matchingIndexEntries = this.sessionIndex.sessions.filter(indexEntry => {
        // Quick filter using index data
        if (options.status && indexEntry.status !== options.status) {
          return false;
        }

        if (options.tags && options.tags.length > 0) {
          const hasMatchingTag = options.tags.some(tag => indexEntry.tags.includes(tag));
          if (!hasMatchingTag) return false;
        }

        if (options.techStack && options.techStack.length > 0) {
          const hasMatchingTech = options.techStack.some(tech =>
            indexEntry.techStack.some(t => t.toLowerCase().includes(tech.toLowerCase()))
          );
          if (!hasMatchingTech) return false;
        }

        return true;
      });

      // Load only the sessions that passed the index filter
      for (const indexEntry of matchingIndexEntries) {
        const session = await this.loadSessionFromFile(indexEntry.id);
        if (session) {
          sessionsToSearch.push(session);
        }
      }
    } else {
      sessionsToSearch = [...this.storage.sessions];
    }

    // Calculate relevance for each session
    for (const session of sessionsToSearch) {
      const score = this.calculateRelevance(session, options);
      if (score > 0) {
        results.push({
          session: options.includeMessages ? session : this.sanitizeSession(session),
          relevanceScore: score,
          matchReasons: this.getMatchReasons(session, options),
        });
      }
    }

    // 按相关性排序
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return results.slice(0, limit);
  }

  /**
   * 计算相关性分数
   */
  private calculateRelevance(session: SessionRecord, options: ContextSearchOptions): number {
    let score = 0;
    const maxScore = 1.0;

    // 关键词匹配（40%）
    if (options.keywords && options.keywords.length > 0) {
      const matchCount = options.keywords.filter(keyword =>
        session.messages.some(msg => msg.content.toLowerCase().includes(keyword.toLowerCase()))
      ).length;
      score += (matchCount / options.keywords.length) * 0.4;
    }

    // 标签匹配（30%）
    if (options.tags && options.tags.length > 0) {
      const matchCount = options.tags.filter(tag =>
        session.tags.includes(tag)
      ).length;
      score += (matchCount / options.tags.length) * 0.3;
    }

    // 技术栈匹配（20%）
    if (options.techStack && options.techStack.length > 0) {
      const matchCount = options.techStack.filter(tech =>
        session.contextVector?.techStack.includes(tech.toLowerCase())
      ).length;
      score += (matchCount / options.techStack.length) * 0.2;
    }

    // 时间范围（10%）
    if (options.timeRange) {
      const sessionTime = new Date(session.startTime).getTime();
      const start = options.timeRange.start ? new Date(options.timeRange.start).getTime() : 0;
      const end = options.timeRange.end ? new Date(options.timeRange.end).getTime() : Date.now();

      if (sessionTime >= start && sessionTime <= end) {
        score += 0.1;
      }
    }

    // 状态匹配
    if (options.status && session.status !== options.status) {
      score = 0;
    }

    return Math.min(score, maxScore);
  }

  /**
   * 获取匹配原因
   */
  private getMatchReasons(session: SessionRecord, options: ContextSearchOptions): string[] {
    const reasons: string[] = [];

    if (options.keywords) {
      const matched = options.keywords.filter(keyword =>
        session.messages.some(msg => msg.content.toLowerCase().includes(keyword.toLowerCase()))
      );
      if (matched.length > 0) {
        reasons.push(`Keywords: ${matched.join(', ')}`);
      }
    }

    if (options.tags) {
      const matched = options.tags.filter(tag => session.tags.includes(tag));
      if (matched.length > 0) {
        reasons.push(`Tags: ${matched.join(', ')}`);
      }
    }

    if (options.techStack && session.contextVector?.techStack) {
      const matched = options.techStack.filter(tech =>
        session.contextVector!.techStack.includes(tech.toLowerCase())
      );
      if (matched.length > 0) {
        reasons.push(`Tech: ${matched.join(', ')}`);
      }
    }

    return reasons;
  }

  /**
   * 清理会话（移除完整消息）
   */
  private sanitizeSession(session: SessionRecord): SessionRecord {
    return {
      ...session,
      messages: session.messages.map(msg => ({
        ...msg,
        content: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
      })),
    };
  }

  /**
   * 获取当前会话
   */
  getCurrentSession(): SessionRecord | null {
    return this.currentSession;
  }

  /**
   * 获取会话统计
   */
  getStats() {
    return this.storage.stats;
  }

  /**
   * 生成会话 ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 生成消息 ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 获取最近的会话
   */
  async getRecentSessions(limit = 10): Promise<SessionRecord[]> {
    await this.flushSessionIndex();
    let sessions: SessionRecord[] = [];

    if (this.useShardedStorage) {
      // Get session IDs from index, sort by date
      const sortedIndex = [...this.sessionIndex.sessions].sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );

      // Load sessions from files (limit to requested number)
      const sessionIds = sortedIndex.slice(0, limit).map(s => s.id);

      for (const sessionId of sessionIds) {
        const session = await this.loadSessionFromFile(sessionId);
        if (session) {
          sessions.push(session);
        }
      }
    } else {
      const sorted = [...this.storage.sessions].sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
      sessions = sorted.slice(0, limit);
    }

    return sessions.map(s => this.sanitizeSession(s));
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionRecord | null> {
    await this.flushSessionIndex();
    if (this.useShardedStorage) {
      return await this.loadSessionFromFile(sessionId);
    } else {
      return this.storage.sessions.find(s => s.id === sessionId) || null;
    }
  }

  /**
   * Get all sessions (used by search engine)
   */
  async getAllSessions(): Promise<SessionRecord[]> {
    await this.flushSessionIndex();
    if (this.useShardedStorage) {
      const sessions: SessionRecord[] = [];

      for (const indexEntry of this.sessionIndex.sessions) {
        const session = await this.loadSessionFromFile(indexEntry.id);
        if (session) {
          sessions.push(session);
        }
      }

      return sessions;
    } else {
      return [...this.storage.sessions];
    }
  }

  /**
   * 获取 AI 上下文摘要（用于注入到 AI）
   */
  async getAIContextSummary(options?: ContextSearchOptions): Promise<string> {
    let summary = '💬 Session Context:\n\n';

    if (options) {
      // 搜索相关上下文
      const results = await this.searchContext({
        ...options,
        includeMessages: false,
        limit: 5,
      });

      if (results.length > 0) {
        summary += '📋 Relevant Past Sessions:\n';
        results.forEach((result, index) => {
          summary += `  ${index + 1}. ${result.session.title}\n`;
          summary += `     Topics: ${result.session.contextVector?.topics.join(', ') || 'N/A'}\n`;
          summary += `     Relevance: ${(result.relevanceScore * 100).toFixed(0)}%\n`;
        });
        summary += '\n';
      }
    }

    // 当前会话
    if (this.currentSession) {
      summary += '📍 Current Session:\n';
      summary += `  Messages: ${this.currentSession.stats.messageCount}\n`;
      summary += `  Topics: ${this.currentSession.contextVector?.topics.join(', ') || 'N/A'}\n`;
      summary += `  Tech: ${this.currentSession.contextVector?.techStack.join(', ') || 'N/A'}\n`;
    }

    return summary;
  }
}

/**
 * 创建会话上下文管理器实例
 */
export function createSessionContextManager(projectRoot: string): SessionContextManager {
  return new SessionContextManager(projectRoot);
}

/**
 * 纯函数：过滤会话记录的活跃路径消息（剔除废弃分支区间）
 */
export function filterActiveMessages(
  session: SessionRecord | null
): SessionMessage[] {
  if (!session) return [];
  const ranges = session.abandonedRanges ?? [];
  if (ranges.length === 0) {
    return session.messages;
  }

  const messages = session.messages;
  // 预计算每个区间的索引边界（[fromIdx, toIdx] 闭区间）
  const bounds = ranges
    .map((r) => ({
      from: messages.findIndex((m) => m.id === r.fromMessageId),
      to: messages.findIndex((m) => m.id === r.toMessageId),
    }))
    .filter((b) => b.from !== -1 && b.to !== -1 && b.to >= b.from);

  if (bounds.length === 0) return messages;

  return messages.filter((msg, idx) => {
    return !bounds.some((b) => idx >= b.from && idx <= b.to);
  });
}
