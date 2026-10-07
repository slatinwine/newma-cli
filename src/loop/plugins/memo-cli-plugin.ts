/**
 * Memo CLI Plugin
 *
 * 集成 Python memo CLI 工具到 Newma
 * 直接调用系统 memo 命令，读取 .memo/ JSON 数据
 */

import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { LoopPlugin, LoopPluginContext, BeforeInputResult, AfterInputResult } from '../interfaces/plugin';
import { FlowResult } from '../interfaces/flow-controller'; // 🔥 修复：导入 FlowResult
import { ContextManager, createContextManager } from '../../memory/context-manager';
import { ExecutionHistoryManager, createExecutionHistoryManager } from '../../memory/execution-history';
import { CommandType, CommandStatus } from '../../memory/execution-types';
import { ErrorMemoryManager, createErrorMemoryManager } from '../../memory/error-memory';
import { PreferencesManager, createPreferencesManager } from '../../memory/preferences-manager';
import { SessionContextManager, createSessionContextManager } from '../../memory/session-context-manager';
import { SessionMessageType } from '../../memory/session-context-types';
import { ReasoningManager, createReasoningManager } from '../../memory/reasoning-manager';
import { ReasoningStepType, ReasoningStepStatus } from '../../memory/reasoning-types';
import { MemorySearchEngine, MemorySearchResult, MemorySearchOptions } from '../../memory/search';
import { MemoryContextInjector } from '../../memory/injection';
import {
  BranchTreeManager,
  createBranchTreeManager,
  RecordDecisionOptions,
} from '../../memory/branch-tree-manager';
import { DecisionNode } from '../../memory/branch-tree-types';

/**
 * 决策记录（兼容 Memo 格式）
 */
export interface Decision {
  id: number;
  timestamp: string;
  title: string;
  content: string;
  tags: string[];
  context?: string;
  file: string;
}

/**
 * 代码文件信息（兼容 Memo 格式）
 */
export interface FileInfo {
  lines: number;
  classes: string[];
  functions: string[];
  imports: string[];
  last_modified: string;
}

/**
 * 代码索引（兼容 Memo 格式）
 */
export interface CodeIndex {
  files: Record<string, FileInfo>;
  updated: string | null;
}

/**
 * 搜索选项
 */
export interface SearchOptions {
  tag?: string;
  before?: string;
  after?: string;
}

/**
 * Memo CLI Plugin
 *
 * 通过 Loop Plugin 接口集成 memo 工具
 */
export class MemoCliPlugin implements LoopPlugin {
  id = 'memo-cli';
  name = 'Memo CLI Integration';
  version = '1.0.0';
  type = 'loop' as const;
  description = 'Memo CLI integration for project memory';
  tools: any[] = []; // Memo plugin doesn't provide tools

  private projectRoot: string;
  private memoPath: string;
  private memoDir: string;
  private contextManager: ContextManager; // 新增：上下文管理器
  private executionHistory: ExecutionHistoryManager; // 新增：执行历史管理器
  private errorMemory: ErrorMemoryManager; // 新增：错误记忆管理器
  private preferencesManager: PreferencesManager; // 新增：用户偏好管理器
  private sessionContextManager: SessionContextManager; // 新增：会话上下文管理器
  private reasoningManager: ReasoningManager; // 新增：推理过程管理器
  private searchEngine?: MemorySearchEngine; // Phase 1: BM25 Semantic Search Engine
  private contextInjector?: MemoryContextInjector; // Phase 5: Context Injector
  private branchTreeManager: BranchTreeManager; // 🎮 Galgame branch tree manager

  /**
   * 构造函数
   *
   * @param projectRoot 项目根目录
   * @param memoPath memo 脚本路径（可选，默认查找系统路径）
   */
  constructor(projectRoot: string, memoPath?: string) {
    this.projectRoot = projectRoot;
    this.memoDir = join(projectRoot, '.memo');
    this.memoPath = memoPath || this.findMemoPath();
    this.contextManager = createContextManager(projectRoot); // 初始化上下文管理器
    this.executionHistory = createExecutionHistoryManager(projectRoot); // 初始化执行历史
    this.errorMemory = createErrorMemoryManager(projectRoot); // 初始化错误记忆
    this.preferencesManager = createPreferencesManager(projectRoot); // 初始化用户偏好
    this.sessionContextManager = createSessionContextManager(projectRoot); // 初始化会话上下文
    this.reasoningManager = createReasoningManager(projectRoot); // 初始化推理过程
    this.branchTreeManager = createBranchTreeManager(projectRoot); // 🎮 初始化分支树

    // Phase 1: Initialize MemorySearchEngine (lazy initialization in initialize())
    try {
      this.searchEngine = new MemorySearchEngine({
        projectRoot,
        autoIndex: false, // We'll index manually after initialization
      });
    } catch (error) {
      // Lazy initialization failed - will retry in initialize()
      console.warn(`[Memo] MemorySearchEngine initialization deferred: ${error}`);
    }
  }

  /**
   * 查找 memo 可执行文件
   * 优先级：MEMO_CLI_PATH 环境变量 > 项目内 memo > PATH 中的 memo
   */
  private findMemoPath(): string {
    // 环境变量显式指定优先
    const envPath = process.env.MEMO_CLI_PATH;
    if (envPath && existsSync(envPath)) {
      return envPath;
    }

    const commonPaths = [
      '/usr/local/bin/memo',
      join(this.projectRoot, 'memo'),
    ];

    for (const path of commonPaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    // 默认路径（假设在 PATH 中）
    return 'memo';
  }

  /**
   * Python 解释器命令（Windows 上通常是 python 而非 python3）
   */
  private get pythonCommand(): string {
    return process.platform === 'win32' ? 'python' : 'python3';
  }

  /**
   * 调用 memo CLI
   *
   * @param args 命令行参数
   * @returns 命令输出
   */
  private async callMemo(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const memo = spawn(this.pythonCommand, [this.memoPath, ...args], {
        cwd: this.projectRoot,
        env: { ...process.env },
        shell: process.platform === 'win32',
      });

      let output = '';
      let error = '';

      memo.stdout.on('data', (data) => {
        output += data.toString();
      });

      memo.stderr.on('data', (data) => {
        error += data.toString();
      });

      memo.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Memo CLI failed: ${error}`));
        }
      });

      memo.on('error', (err) => {
        reject(new Error(`Failed to spawn memo: ${err.message}`));
      });
    });
  }

  /**
   * 读取 decisions.json
   */
  private async readDecisionsFile(): Promise<{ decisions: Decision[] }> {
    const filePath = join(this.memoDir, 'decisions.json');

    if (!existsSync(filePath)) {
      return { decisions: [] };
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Failed to read decisions.json: ${error}`);
      return { decisions: [] };
    }
  }

  /**
   * 读取 index.json
   */
  private async readIndexFile(): Promise<CodeIndex> {
    const filePath = join(this.memoDir, 'index.json');

    if (!existsSync(filePath)) {
      return { files: {}, updated: null };
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Failed to read index.json: ${error}`);
      return { files: {}, updated: null };
    }
  }

  /**
   * 记录决策
   *
   * @param title 决策标题
   * @param content 决策内容
   * @param tags 标签数组
   * @param context 上下文（可选）
   * @returns 决策 ID
   */
  async recordDecision(
    title: string,
    content: string,
    tags: string[] = [],
    context?: string
  ): Promise<number> {
    try {
      const args = ['record', title, content];

      // 修复：正确格式 --tags tag1 tag2 tag3
      // memo record "title" "content" --tags tag1 tag2 tag3
      if (tags.length > 0) {
        args.push('--tags', ...tags);
      }

      if (context) {
        args.push('--context', context);
      }

      await this.callMemo(args);

      // 读取返回的决策 ID
      const data = await this.readDecisionsFile();
      return data.decisions[data.decisions.length - 1].id;
    } catch (error) {
      console.error(`Failed to record decision: ${error}`);
      throw error;
    }
  }

  /**
   * 搜索决策（直接读取 JSON，性能更好）
   *
   * @param query 搜索查询
   * @param options 搜索选项
   * @returns 匹配的决策列表
   */
  async searchDecisions(query: string, options?: SearchOptions): Promise<Decision[]> {
    try {
      const data = await this.readDecisionsFile();
      const results: Decision[] = [];

      for (const decision of data.decisions) {
        // 标签过滤
        if (options?.tag) {
          const requiredTags = options.tag.split(',').map(t => t.trim().toLowerCase());

          // 修复：正确处理 decision.tags（可能是数组或字符串）
          let decisionTags: string[] = [];
          if (Array.isArray(decision.tags)) {
            decisionTags = decision.tags.map((t: string) => t.toLowerCase());
          } else if (typeof decision.tags === 'string') {
            // 兼容旧格式：tags 是逗号分隔的字符串
            decisionTags = (decision.tags as string).split(',').map((t: string) => t.trim().toLowerCase());
          }

          if (!requiredTags.some(rt => decisionTags.includes(rt))) {
            continue;
          }
        }

        // 日期过滤
        if (options?.before || options?.after) {
          const decisionDate = new Date(decision.timestamp);

          if (options.before) {
            const beforeDate = new Date(options.before);
            if (decisionDate > beforeDate) continue;
          }

          if (options.after) {
            const afterDate = new Date(options.after);
            if (decisionDate < afterDate) continue;
          }
        }

        // 查询匹配
        const queryLower = query.toLowerCase();
        const titleMatch = decision.title.toLowerCase().includes(queryLower);
        const contentMatch = decision.content.toLowerCase().includes(queryLower);

        if (titleMatch || contentMatch || query === '') {
          results.push(decision);
        }
      }

      return results;
    } catch (error) {
      console.error(`Failed to search decisions: ${error}`);
      return [];
    }
  }

  /**
   * 查找相关代码
   *
   * @param keyword 关键词
   * @returns 匹配的文件列表
   */
  async findRelated(keyword: string): Promise<Array<{ file: string; info: FileInfo }>> {
    try {
      const index = await this.readIndexFile();
      const results: Array<{ file: string; info: FileInfo }> = [];
      const keywordLower = keyword.toLowerCase();

      for (const [file, info] of Object.entries(index.files)) {
        // 匹配文件名
        if (file.toLowerCase().includes(keywordLower)) {
          results.push({ file, info });
          continue;
        }

        // 匹配类名
        if (info.classes.some((c: string) => c.toLowerCase().includes(keywordLower))) {
          results.push({ file, info });
          continue;
        }

        // 匹配函数名
        if (info.functions.some((f: string) => f.toLowerCase().includes(keywordLower))) {
          results.push({ file, info });
          continue;
        }
      }

      return results;
    } catch (error) {
      console.error(`Failed to find related code: ${error}`);
      return [];
    }
  }

  /**
   * 🔥 搜索历史任务
   *
   * @param query 搜索查询
   * @returns 匹配的任务列表
   */
  async searchTasks(query: string): Promise<Array<{
    id: string;
    requirement: string;
    status: string;
    mode: string;
    createdAt: string;
  }>> {
    try {
      const tasksDir = join(this.memoDir, 'tasks');
      const { readdir } = await import('fs/promises');

      // 检查目录是否存在
      try {
        await readdir(tasksDir);
      } catch {
        // 目录不存在，返回空结果
        return [];
      }

      const files = await readdir(tasksDir);
      const tasks: Array<{
        id: string;
        requirement: string;
        status: string;
        mode: string;
        createdAt: string;
      }> = [];
      const queryLower = query.toLowerCase();

      for (const file of files) {
        // 只处理 JSON 文件（包括压缩的）
        if (!file.endsWith('.json') && !file.endsWith('.json.gz')) {
          continue;
        }

        // 提取任务 ID
        const taskId = file.replace('.json', '').replace('.gz', '');

        // 读取任务文件
        let task: any;
        try {
          if (file.endsWith('.gz')) {
            // 压缩文件
            const { gunzipSync } = await import('zlib');
            const { readFile } = await import('fs/promises');
            const compressed = await readFile(join(tasksDir, file));
            const decompressed = gunzipSync(compressed);
            task = JSON.parse(decompressed.toString());
          } else {
            // 普通文件
            const { readFile } = await import('fs/promises');
            const content = await readFile(join(tasksDir, file), 'utf-8');
            task = JSON.parse(content);
          }
        } catch {
          // 读取失败，跳过
          continue;
        }

        // 搜索匹配
        const requirementMatch = task.requirement?.toLowerCase().includes(queryLower);
        const idMatch = task.id?.toLowerCase().includes(queryLower);

        if (requirementMatch || idMatch) {
          tasks.push({
            id: task.id,
            requirement: task.requirement,
            status: task.metadata?.status || task.status || 'unknown',
            mode: task.mode,
            createdAt: task.createdAt,
          });
        }
      }

      // 按创建时间排序（最新的在前）
      tasks.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // 限制返回数量（最多 10 个）
      return tasks.slice(0, 10);
    } catch (error) {
      console.error(`Failed to search tasks: ${error}`);
      return [];
    }
  }

  /**
   * 索引项目
   */
  async indexProject(): Promise<void> {
    try {
      await this.callMemo(['index']);
    } catch (error) {
      console.error(`Failed to index project: ${error}`);
      throw error;
    }
  }

  /**
   * 生成项目文档
   */
  async generateDoc(): Promise<string> {
    try {
      return await this.callMemo(['doc']);
    } catch (error) {
      console.error(`Failed to generate doc: ${error}`);
      throw error;
    }
  }

  /**
   * 获取项目统计
   */
  async getStats(): Promise<{ files: number; decisions: number }> {
    try {
      const index = await this.readIndexFile();
      const decisions = await this.readDecisionsFile();

      return {
        files: Object.keys(index.files).length,
        decisions: decisions.decisions.length,
      };
    } catch (error) {
      console.error(`Failed to get stats: ${error}`);
      return { files: 0, decisions: 0 };
    }
  }

  /**
   * 初始化 .memo/ 目录
   */
  async initialize(): Promise<void> {
    if (!existsSync(this.memoDir)) {
      console.log('Initializing .memo/ directory...');
      await this.callMemo(['stats']);
      console.log('✓ .memo/ directory initialized');
    }

    // 🔥 初始化上下文管理器
    await this.contextManager.initialize();

    // 🔥 初始化执行历史管理器
    await this.executionHistory.initialize();

    // 🔥 初始化错误记忆管理器
    await this.errorMemory.initialize();

    // 初始化用户偏好管理器
    await this.preferencesManager.initialize();

    // 从用户侧写文件导入偏好（如果存在）
    await this.preferencesManager.importFromUserProfile();

    // 初始化会话上下文管理器
    await this.sessionContextManager.initialize();

    // 初始化推理过程管理器
    await this.reasoningManager.initialize();

    // Phase 1: Initialize MemorySearchEngine
    if (this.searchEngine) {
      try {
        await this.searchEngine.initialize();
        // Lazy index all memory sources
        await this.searchEngine.indexAll();
        console.log('✓ Memory search engine initialized');
        // Initialize context injector
        this.contextInjector = new MemoryContextInjector(this.searchEngine);
      } catch (error) {
        console.warn(`[Memo] Failed to initialize memory search engine: ${error}`);
      }
    }
  }

  // ==================== 🔥 新增：项目上下文方法 ====================

  /**
   * 获取项目上下文
   */
  async getProjectContext(forceRefresh = false) {
    try {
      return await this.contextManager.getContext(forceRefresh);
    } catch (error) {
      console.error(`Failed to get project context: ${error}`);
      return null;
    }
  }

  /**
   * 更新项目上下文
   */
  async updateProjectContext() {
    try {
      return await this.contextManager.updateContext();
    } catch (error) {
      console.error(`Failed to update project context: ${error}`);
      return null;
    }
  }

  /**
   * 获取项目摘要（用于 AI 上下文）
   */
  async getProjectSummary(): Promise<string> {
    try {
      return await this.contextManager.getSummary();
    } catch (error) {
      console.error(`Failed to get project summary: ${error}`);
      return '';
    }
  }

  /**
   * 记录文件变更
   */
  async recordFileChange(change: { file: string; type: 'create' | 'modify' | 'delete'; summary?: string }) {
    try {
      await this.contextManager.recordChange(change);
    } catch (error) {
      console.error(`Failed to record file change: ${error}`);
    }
  }

  /**
   * 清除上下文缓存
   */
  async clearContextCache() {
    try {
      await this.contextManager.clearCache();
      console.log('✓ Context cache cleared');
    } catch (error) {
      console.error(`Failed to clear context cache: ${error}`);
    }
  }

  // ==================== 🔥 新增：执行历史方法 ====================

  /**
   * 创建执行会话
   */
  async createExecutionSession(sessionId: string) {
    try {
      await this.executionHistory.createSession(sessionId, this.projectRoot);
    } catch (error) {
      console.error(`Failed to create execution session: ${error}`);
    }
  }

  /**
   * 记录命令开始
   */
  async recordCommandStart(input: string, type: CommandType): Promise<number> {
    try {
      return await this.executionHistory.recordCommandStart(input, type);
    } catch (error) {
      console.error(`Failed to record command start: ${error}`);
      return -1;
    }
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
    }
  ) {
    try {
      await this.executionHistory.recordCommandEnd(index, status, result);
    } catch (error) {
      console.error(`Failed to record command end: ${error}`);
    }
  }

  /**
   * 结束执行会话
   */
  async endExecutionSession() {
    try {
      await this.executionHistory.endSession();
    } catch (error) {
      console.error(`Failed to end execution session: ${error}`);
    }
  }

  /**
   * 搜索执行历史
   */
  async searchExecutionHistory(options: {
    sessionId?: string;
    commandType?: CommandType;
    status?: CommandStatus;
    keyword?: string;
    limit?: number;
  }) {
    try {
      return await this.executionHistory.searchHistory(options);
    } catch (error) {
      console.error(`Failed to search execution history: ${error}`);
      return [];
    }
  }

  /**
   * 获取执行统计摘要
   */
  async getExecutionSummary(days = 30) {
    try {
      return await this.executionHistory.getSummary(days);
    } catch (error) {
      console.error(`Failed to get execution summary: ${error}`);
      return null;
    }
  }

  // ==================== 🔥 新增：错误记忆方法 ====================

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
  }) {
    try {
      return await this.errorMemory.recordError(error);
    } catch (error) {
      console.error(`Failed to record error: ${error}`);
      return '';
    }
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
  ) {
    try {
      await this.errorMemory.recordSolution(errorId, solution);
    } catch (error) {
      console.error(`Failed to record solution: ${error}`);
    }
  }

  /**
   * 搜索错误
   */
  async searchErrors(options: {
    errorType?: string;
    category?: any; // Use any to accept string or ErrorCategory
    severity?: any; // Use any to accept string or ErrorSeverity
    resolved?: boolean;
    keyword?: string;
    tags?: string[];
    limit?: number;
    withSolutionOnly?: boolean;
  }) {
    try {
      return await this.errorMemory.searchErrors(options as any);
    } catch (error) {
      console.error(`Failed to search errors: ${error}`);
      return [];
    }
  }

  /**
   * 查找相似错误
   */
  async findSimilarErrors(errorType: string, errorMessage: string, limit = 5) {
    try {
      return await this.errorMemory.findSimilarErrors(errorType, errorMessage, limit);
    } catch (error) {
      console.error(`Failed to find similar errors: ${error}`);
      return [];
    }
  }

  /**
   * 获取错误统计
   */
  async getErrorSummary(days = 30) {
    try {
      return await this.errorMemory.getSummary(days);
    } catch (error) {
      console.error(`Failed to get error summary: ${error}`);
      return null;
    }
  }

  // ==================== User Preferences Methods ====================

  /**
   * 获取用户偏好
   */
  async getUserPreferences() {
    try {
      return await this.preferencesManager.getPreferences();
    } catch (error) {
      console.error(`Failed to get user preferences: ${error}`);
      return null;
    }
  }

  /**
   * 获取代码风格偏好
   */
  async getCodeStylePreferences() {
    try {
      return await this.preferencesManager.getCodeStylePreferences();
    } catch (error) {
      console.error(`Failed to get code style preferences: ${error}`);
      return null;
    }
  }

  /**
   * 获取 AI 交互偏好
   */
  async getAIInteractionPreferences() {
    try {
      return await this.preferencesManager.getAIInteractionPreferences();
    } catch (error) {
      console.error(`Failed to get AI interaction preferences: ${error}`);
      return null;
    }
  }

  /**
   * 更新用户偏好
   */
  async updateUserPreferences(updates: any, options?: any) {
    try {
      await this.preferencesManager.updatePreferences(updates, options);
    } catch (error) {
      console.error(`Failed to update user preferences: ${error}`);
    }
  }

  /**
   * 学习用户行为
   */
  async learnUserBehavior(behavior: {
    commandType?: string;
    language?: string;
    verbosity?: string;
    framework?: string;
    tool?: string;
  }) {
    try {
      await this.preferencesManager.learnFromBehavior(behavior);
    } catch (error) {
      console.error(`Failed to learn from behavior: ${error}`);
    }
  }

  /**
   * 导出用户侧写
   */
  async exportUserProfile() {
    try {
      return await this.preferencesManager.exportToUserProfile();
    } catch (error) {
      console.error(`Failed to export user profile: ${error}`);
      return '';
    }
  }

  /**
   * 获取格式化的偏好摘要（用于 AI 上下文）
   */
  async getPreferencesSummary() {
    try {
      return await this.preferencesManager.getFormattedSummary();
    } catch (error) {
      console.error(`Failed to get preferences summary: ${error}`);
      return '';
    }
  }

  /**
   * 验证偏好设置
   */
  async validatePreferences() {
    try {
      return await this.preferencesManager.validatePreferences();
    } catch (error) {
      console.error(`Failed to validate preferences: ${error}`);
      return { valid: false, errors: ['Validation failed'] };
    }
  }

  /**
   * 重置为默认偏好
   */
  async resetPreferences() {
    try {
      await this.preferencesManager.resetToDefaults();
      console.log('✓ Preferences reset to defaults');
    } catch (error) {
      console.error(`Failed to reset preferences: ${error}`);
    }
  }

  // ==================== Session Context Methods ====================

  /**
   * 创建新会话
   */
  async createSession(sessionId?: string) {
    try {
      return await this.sessionContextManager.createSession(sessionId);
    } catch (error) {
      console.error(`Failed to create session: ${error}`);
      return '';
    }
  }

  /**
   * 添加消息到当前会话
   */
  async addSessionMessage(
    role: SessionMessageType,
    content: string,
    metadata?: { mode?: string; commandType?: string; tokens?: number; }
  ) {
    try {
      await this.sessionContextManager.addMessage(role, content, metadata);
    } catch (error) {
      console.error(`Failed to add session message: ${error}`);
    }
  }

  /**
   * 结束当前会话
   */
  async endSession() {
    try {
      await this.sessionContextManager.endSession();
    } catch (error) {
      console.error(`Failed to end session: ${error}`);
    }
  }

  /**
   * 搜索相关上下文
   */
  async searchSessionContext(options: {
    keywords?: string[];
    tags?: string[];
    techStack?: string[];
    limit?: number;
    includeMessages?: boolean;
  }) {
    try {
      return await this.sessionContextManager.searchContext(options);
    } catch (error) {
      console.error(`Failed to search session context: ${error}`);
      return [];
    }
  }

  /**
   * 获取最近会话
   */
  async getRecentSessions(limit = 10) {
    try {
      return await this.sessionContextManager.getRecentSessions(limit);
    } catch (error) {
      console.error(`Failed to get recent sessions: ${error}`);
      return [];
    }
  }

  /**
   * 获取当前会话
   */
  getCurrentSession() {
    return this.sessionContextManager.getCurrentSession();
  }

  /**
   * 获取会话统计
   */
  getSessionStats() {
    return this.sessionContextManager.getStats();
  }

  /**
   * 获取 AI 上下文摘要
   */
  async getSessionAIContext(options?: {
    keywords?: string[];
    tags?: string[];
    techStack?: string[];
  }) {
    try {
      return await this.sessionContextManager.getAIContextSummary(options);
    } catch (error) {
      console.error(`Failed to get session AI context: ${error}`);
      return '';
    }
  }

  // ==================== Reasoning Process Methods ====================

  /**
   * 创建推理链
   */
  async createReasoningChain(task: string, taskType: string) {
    try {
      return await this.reasoningManager.createChain(task, taskType);
    } catch (error) {
      console.error(`Failed to create reasoning chain: ${error}`);
      return '';
    }
  }

  /**
   * 添加推理步骤
   */
  async addReasoningStep(
    type: ReasoningStepType,
    description: string,
    content: string,
    parentId?: string,
    metadata?: { algorithm?: string; confidence?: number; tokens?: number; [key: string]: any }
  ) {
    try {
      return await this.reasoningManager.addStep(type, description, content, parentId, metadata);
    } catch (error) {
      console.error(`Failed to add reasoning step: ${error}`);
      return '';
    }
  }

  /**
   * 更新推理步骤状态
   */
  async updateReasoningStep(
    stepId: string,
    status: ReasoningStepStatus,
    result?: { success: boolean; output?: string; error?: string; duration?: number; }
  ) {
    try {
      await this.reasoningManager.updateStep(stepId, status, result);
    } catch (error) {
      console.error(`Failed to update reasoning step: ${error}`);
    }
  }

  /**
   * 完成推理链
   */
  async completeReasoningChain(success: boolean, output?: string, error?: string) {
    try {
      await this.reasoningManager.completeChain(success, output, error);
    } catch (error) {
      console.error(`Failed to complete reasoning chain: ${error}`);
    }
  }

  /**
   * 获取当前推理链
   */
  getCurrentReasoningChain() {
    return this.reasoningManager.getCurrentChain();
  }

  /**
   * 搜索相似推理链
   */
  async searchSimilarReasoning(task: string, taskType: string, limit = 5) {
    try {
      return await this.reasoningManager.searchSimilarChains(task, taskType, limit);
    } catch (error) {
      console.error(`Failed to search similar reasoning: ${error}`);
      return [];
    }
  }

  /**
   * 获取推理统计
   */
  getReasoningStats() {
    return this.reasoningManager.getStats();
  }

  /**
   * 获取推理 AI 上下文摘要
   */
  async getReasoningAIContext(task?: string, taskType?: string) {
    try {
      return await this.reasoningManager.getAIContextSummary(task, taskType);
    } catch (error) {
      console.error(`Failed to get reasoning AI context: ${error}`);
      return '';
    }
  }

  // ==================== Phase 1-5: Memory Search Methods ====================

  /**
   * Search across all memory sources using BM25 semantic search
   *
   * @param query Search query string
   * @param options Optional search parameters (sources, limit, threshold, etc.)
   * @returns Array of memory search results ranked by relevance
   */
  async searchMemory(query: string, options?: MemorySearchOptions): Promise<MemorySearchResult[]> {
    if (!this.searchEngine) {
      console.warn('[Memo] Search engine not initialized');
      return [];
    }

    try {
      return await this.searchEngine.search(query, options);
    } catch (error) {
      console.error(`Failed to search memory: ${error}`);
      return [];
    }
  }

  /**
   * Get memory context for AI consumption
   * Uses MemoryContextInjector to format and rank results
   *
   * @param query Query string for relevant memory retrieval
   * @param maxTokens Maximum tokens for the formatted context (default: 1500)
   * @returns Formatted context string ready for AI prompt injection
   */
  async getMemoryContext(query: string, maxTokens: number = 1500): Promise<string> {
    if (!this.contextInjector) {
      // Fallback: return empty string if injector not available
      return '';
    }

    try {
      const injection = await this.contextInjector.getRelevantContext(query, {
        maxTokens,
        sources: ['error', 'execution', 'reasoning', 'session'],
        includeFormattedContext: true,
      });

      return injection.formattedContext;
    } catch (error) {
      console.warn(`[Memo] Failed to get memory context: ${error}`);
      return '';
    }
  }

  /**
   * Get quick memory context (errors and reasoning only, faster)
   *
   * @param query Query string
   * @param maxTokens Maximum tokens (default: 500)
   * @returns Formatted context string
   */
  async getQuickMemoryContext(query: string, maxTokens: number = 500): Promise<string> {
    if (!this.contextInjector) {
      return '';
    }

    try {
      const injection = await this.contextInjector.getQuickContext(query, maxTokens);
      return injection.formattedContext;
    } catch (error) {
      console.warn(`[Memo] Failed to get quick memory context: ${error}`);
      return '';
    }
  }

  /**
   * Get memory search engine instance
   * Useful for direct access to search capabilities
   */
  getSearchEngine(): MemorySearchEngine | undefined {
    return this.searchEngine;
  }

  // ==================== 🎮 Branch Tree Methods (Galgame) ====================

  /**
   * 获取分支树管理器（REPL 的 TimeTravelManager 共享同一实例）
   */
  getBranchTreeManager(): BranchTreeManager {
    return this.branchTreeManager;
  }

  /**
   * 记录决策点到分支树（选项快照 + 未选项 + 选择理由）
   * 注意与 recordDecision（外部 memo CLI）区分
   */
  async recordBranchDecision(options: RecordDecisionOptions): Promise<DecisionNode | null> {
    try {
      return await this.branchTreeManager.recordDecision(options);
    } catch (error) {
      console.error(`[Memo] Failed to record decision: ${error}`);
      return null;
    }
  }

  /**
   * 设置分支结局
   */
  async setBranchOutcome(
    sessionId: string,
    nodeId: string,
    outcome: 'active' | 'succeeded' | 'failed' | 'abandoned',
    note?: string
  ): Promise<boolean> {
    try {
      return await this.branchTreeManager.setOutcome(sessionId, nodeId, outcome, note);
    } catch (error) {
      console.error(`[Memo] Failed to set branch outcome: ${error}`);
      return false;
    }
  }

  /**
   * 设置会话 flag（galgame 事件标记）
   */
  async setSessionFlag(
    sessionId: string,
    key: string,
    value: string,
    source: 'user' | 'ai' = 'user'
  ): Promise<void> {
    try {
      await this.branchTreeManager.setFlag(sessionId, key, value, source);
    } catch (error) {
      console.error(`[Memo] Failed to set flag: ${error}`);
    }
  }

  /**
   * 清除会话 flag
   */
  async clearSessionFlag(sessionId: string, key: string): Promise<boolean> {
    try {
      return await this.branchTreeManager.clearFlag(sessionId, key);
    } catch (error) {
      console.error(`[Memo] Failed to clear flag: ${error}`);
      return false;
    }
  }

  /**
   * 设置活跃会话（ai.ts 注入管道据此定位当前分支树）
   */
  async setActiveBranchSession(sessionId: string): Promise<void> {
    try {
      await this.branchTreeManager.setActiveSession(sessionId);
    } catch (error) {
      console.error(`[Memo] Failed to set active session: ${error}`);
    }
  }

  /**
   * 获取活跃会话的分支上下文（flags + 前世记忆 + MCTS 推荐统计），注入 AI
   */
  async getActiveBranchContext(): Promise<string> {
    try {
      const sessionId = await this.branchTreeManager.getActiveSessionId();
      if (!sessionId) return '';

      const flagContext = await this.branchTreeManager.getFlagContext(sessionId);
      const abandonedContext = await this.branchTreeManager.getAbandonedBranchContext(sessionId);
      const mctsContext = await this.branchTreeManager.getRecommendationContext(sessionId);
      return flagContext + abandonedContext + mctsContext;
    } catch (error) {
      console.warn(`[Memo] Failed to get branch context: ${error}`);
      return '';
    }
  }

  /**
   * 活跃对话回放：把当前活跃会话的消息流（剔除废弃分支）格式化注入 AI。
   *
   * 这是"读档后对话真正续上"的关键一环——/load 或 /continue 恢复的
   * 消息历史通过这里进入后续每一次 AI 请求的上下文。
   */
  async getActiveConversationContext(maxMessages: number = 12): Promise<string> {
    try {
      const sessionId = await this.branchTreeManager.getActiveSessionId();
      if (!sessionId) return '';

      const messages = await this.sessionContextManager.getActiveMessagesById(sessionId);
      // 至少要有一轮完整的问答才有回放价值
      if (messages.filter((m) => m.role === 'user').length < 1) return '';

      const recent = messages.slice(-maxMessages);
      const lines = recent.map((m) => {
        const who = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'System';
        const text = m.content.length > 400 ? m.content.slice(0, 397) + '...' : m.content;
        return `${who}: ${text.replace(/\n+/g, ' ').trim()}`;
      });

      const truncatedNote =
        messages.length > maxMessages ? ` (last ${maxMessages} of ${messages.length})` : '';

      return (
        `\n\n🕘 CURRENT SESSION CONVERSATION${truncatedNote}:\n` +
        `The following is the ongoing conversation in this session ` +
        `(restored/continued context — respond consistently with it):\n` +
        lines.join('\n') +
        '\n'
      );
    } catch (error) {
      console.warn(`[Memo] Failed to get conversation context: ${error}`);
      return '';
    }
  }

  /**
   * 🎲 MCTS 探索推荐（/next 命令）
   */
  async getMctsRecommendation(sessionId: string) {
    try {
      return await this.branchTreeManager.getRecommendation(sessionId);
    } catch (error) {
      console.error(`[Memo] Failed to get recommendation: ${error}`);
      return null;
    }
  }

  /**
   * 渲染决策树（/tree 命令）
   */
  async renderDecisionTree(sessionId: string): Promise<string> {
    try {
      return await this.branchTreeManager.renderTree(sessionId);
    } catch (error) {
      return `Failed to render tree: ${error}`;
    }
  }

  /**
   * Get memory context injector instance
   * Useful for custom context injection logic
   */
  getContextInjector(): MemoryContextInjector | undefined {
    return this.contextInjector;
  }

  /**
   * 输入处理前钩子 - 可选：自动注入记忆上下文
   */
  async onBeforeInput(input: string, context: LoopPluginContext): Promise<BeforeInputResult> {
    // 可以在这里实现自动搜索相关决策
    // 但为了避免过多干扰，暂时留空
    return {
      shouldContinue: true,
    };
  }

  /**
   * 输入处理后钩子 - 可选：自动记录重要决策
   */
  async onAfterInput(result: FlowResult, context: LoopPluginContext): Promise<AfterInputResult> {
    // 可以在这里实现自动提取决策
    // 但为了避免过多干扰，暂时留空
    return {
      shouldContinue: true,
    };
  }
}

/**
 * 创建 Memo CLI Plugin 实例
 *
 * @param projectRoot 项目根目录
 * @param memoPath memo 路径（可选）
 * @returns MemoCliPlugin 实例
 */
export function createMemoPlugin(projectRoot: string, memoPath?: string): MemoCliPlugin {
  return new MemoCliPlugin(projectRoot, memoPath);
}
