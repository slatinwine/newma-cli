// src/compressor/structuredSummary.ts
/**
 * 9 节结构化上下文压缩摘要
 * 参考 Claude Code 的 CompactSummary 实现
 *
 * 功能：
 * 1. 提取对话历史中的关键信息（9 个维度）
 * 2. 格式化为结构化 markdown
 * 3. 与 TokenBudgetManager 集成自动压缩
 * 4. 支持增量更新和差异追踪
 */

import { ExecutionRecord } from '../history';
import { TokenBudgetManager } from '../context/tokenBudget';

/**
 * 消息接口（兼容 OpenAI API）
 */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
}

/**
 * 紧凑摘要接口（9 节结构）
 */
export interface CompactSummary {
  primaryRequest: string;       // 1. 用户主要请求和意图
  keyConcepts: string;          // 2. 技术概念、框架、模式
  filesAndCode: string;         // 3. 文件和代码段（含完整代码片段）
  errorsAndFixes: string;       // 4. 所有错误及修复方式
  problemSolving: string;       // 5. 已解决问题和持续排查
  userMessages: string;         // 6. 所有非工具结果的用户消息
  pendingTasks: string;         // 7. 待完成任务
  currentWork: string;          // 8. 最近正在做的工作
  optionalNextStep?: string;    // 9. 下一步（必须直接对应用户最近请求）
}

/**
 * 摘要提取选项
 */
export interface SummaryExtractionOptions {
  maxCodeSnippets?: number;     // 最大代码片段数量
  maxErrors?: number;           // 最大错误记录数
  includeUserMessages?: boolean; // 是否包含用户消息
  includeThoughts?: boolean;    // 是否包含思考过程
}

/**
 * 摘要提取结果
 */
export interface SummaryExtractionResult {
  summary: CompactSummary;
  metadata: {
    originalMessageCount: number;
    originalTokenEstimate: number;
    compressedTokenEstimate: number;
    compressionRatio: number;
    extractedAt: Date;
  };
}

/**
 * 紧凑摘要格式化器
 */
export class CompactSummaryFormatter {
  /**
   * 格式化为 markdown
   */
  static formatCompact(summary: CompactSummary): string {
    const sections: string[] = [];

    sections.push('# Conversation Summary\n');
    sections.push('## 1. Primary Request and Intent');
    sections.push(summary.primaryRequest || 'No primary request recorded.\n');

    sections.push('## 2. Key Technical Concepts');
    sections.push(summary.keyConcepts || 'No key concepts identified.\n');

    sections.push('## 3. Files and Code Sections');
    sections.push(summary.filesAndCode || 'No files or code sections referenced.\n');

    sections.push('## 4. Errors and Fixes');
    sections.push(summary.errorsAndFixes || 'No errors encountered.\n');

    sections.push('## 5. Problem Solving');
    sections.push(summary.problemSolving || 'No problems solved yet.\n');

    sections.push('## 6. All User Messages');
    sections.push(summary.userMessages || 'No user messages recorded.\n');

    sections.push('## 7. Pending Tasks');
    sections.push(summary.pendingTasks || 'No pending tasks.\n');

    sections.push('## 8. Current Work');
    sections.push(summary.currentWork || 'No current work in progress.\n');

    if (summary.optionalNextStep) {
      sections.push('## 9. Optional Next Step');
      sections.push(summary.optionalNextStep);
    }

    return sections.join('\n');
  }

  /**
   * 格式化为 JSON（用于调试和存储）
   */
  static toJSON(summary: CompactSummary): string {
    return JSON.stringify(summary, null, 2);
  }

  /**
   * 从 JSON 解析
   */
  static fromJSON(json: string): CompactSummary {
    return JSON.parse(json);
  }
}

/**
 * 摘要提取器
 * 从对话历史中提取结构化信息
 */
export class SummaryExtractor {
  private tokenManager: TokenBudgetManager;

  constructor(tokenManager?: TokenBudgetManager) {
    this.tokenManager = tokenManager || new TokenBudgetManager();
  }

  /**
   * 从消息历史中提取摘要
   */
  extractFromMessages(
    messages: Message[],
    options: SummaryExtractionOptions = {}
  ): SummaryExtractionResult {
    const {
      maxCodeSnippets = 10,
      maxErrors = 5,
      includeUserMessages = true,
      includeThoughts = false,
    } = options;

    // 提取各部分内容
    const primaryRequest = this.extractPrimaryRequest(messages);
    const keyConcepts = this.extractKeyConcepts(messages);
    const filesAndCode = this.extractFilesAndCode(messages, maxCodeSnippets);
    const errorsAndFixes = this.extractErrorsAndFixes(messages, maxErrors);
    const problemSolving = this.extractProblemSolving(messages);
    const userMessages = includeUserMessages ? this.extractUserMessages(messages) : '';
    const pendingTasks = this.extractPendingTasks(messages);
    const currentWork = this.extractCurrentWork(messages);
    const optionalNextStep = this.extractNextStep(messages);

    const summary: CompactSummary = {
      primaryRequest,
      keyConcepts,
      filesAndCode,
      errorsAndFixes,
      problemSolving,
      userMessages,
      pendingTasks,
      currentWork,
      optionalNextStep,
    };

    // 计算元数据
    const originalTokens = this.estimateOriginalTokens(messages);
    const compressedTokens = this.tokenManager.estimateTokens(CompactSummaryFormatter.formatCompact(summary));

    const metadata = {
      originalMessageCount: messages.length,
      originalTokenEstimate: originalTokens,
      compressedTokenEstimate: compressedTokens,
      compressionRatio: originalTokens > 0 ? compressedTokens / originalTokens : 1,
      extractedAt: new Date(),
    };

    return { summary, metadata };
  }

  /**
   * 从执行记录中提取摘要
   */
  extractFromHistory(
    records: ExecutionRecord[],
    messages: Message[],
    options: SummaryExtractionOptions = {}
  ): SummaryExtractionResult {
    // 合并消息和记录信息
    const enhancedMessages = this.enrichMessagesWithRecords(messages, records);
    return this.extractFromMessages(enhancedMessages, options);
  }

  /**
   * 提取主要请求
   */
  private extractPrimaryRequest(messages: Message[]): string {
    // 提取用户消息中的明确请求
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) return '';

    // 收集所有用户输入
    const requests = userMessages.map(msg => {
      const content = typeof msg.content === 'string' ? msg.content : 'Multimodal content';
      return content.trim();
    });

    // 去重并合并
    const uniqueRequests = [...new Set(requests)];
    return uniqueRequests.join('\n- ');
  }

  /**
   * 提取关键技术概念
   */
  private extractKeyConcepts(messages: Message[]): string {
    const concepts: string[] = [];

    // 技术关键词模式
    const techPatterns = [
      /\b(TypeScript|JavaScript|Node\.js|React|Vue|Angular|Express|Next\.js)\b/g,
      /\b(API|REST|GraphQL|WebSocket|gRPC)\b/g,
      /\b(Docker|Kubernetes|CI\/CD|Git|GitHub)\b/g,
      /\b(Test|Testing|Jest|Mocha|Chai)\b/g,
      /\b(Database|SQL|NoSQL|MongoDB|PostgreSQL)\b/g,
    ];

    messages.forEach(msg => {
      const content = typeof msg.content === 'string' ? msg.content : '';
      techPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          concepts.push(...matches);
        }
      });
    });

    // 去重
    const uniqueConcepts = [...new Set(concepts)];
    return uniqueConcepts.join(', ');
  }

  /**
   * 提取文件和代码段
   */
  private extractFilesAndCode(messages: Message[], maxSnippets: number): string {
    const files: string[] = [];
    const codeSnippets: string[] = [];

    messages.forEach(msg => {
      const content = typeof msg.content === 'string' ? msg.content : '';

      // 提取文件路径
      const filePaths = content.match(/[\w\-\.\/]+\.(ts|js|tsx|jsx|json|md|py|go|rs)/g);
      if (filePaths) {
        files.push(...filePaths);
      }

      // 提取代码块（markdown 格式）
      const codeBlocks = content.match(/```[\s\S]*?```/g);
      if (codeBlocks) {
        codeSnippets.push(...codeBlocks);
      }
    });

    // 去重文件
    const uniqueFiles = [...new Set(files)].slice(0, maxSnippets);

    // 限制代码片段数量
    const limitedSnippets = codeSnippets.slice(0, maxSnippets);

    // 格式化输出
    let result = '';
    if (uniqueFiles.length > 0) {
      result += '**Files Referenced:**\n';
      uniqueFiles.forEach(file => {
        result += `- ${file}\n`;
      });
      result += '\n';
    }

    if (limitedSnippets.length > 0) {
      result += '**Code Snippets:**\n';
      limitedSnippets.forEach((snippet, index) => {
        result += `${index + 1}. ${snippet}\n\n`;
      });
    }

    return result;
  }

  /**
   * 提取错误和修复
   */
  private extractErrorsAndFixes(messages: Message[], maxErrors: number): string {
    const errors: Array<{ error: string; fix?: string }> = [];

    messages.forEach(msg => {
      const content = typeof msg.content === 'string' ? msg.content : '';

      // 查找错误模式
      const errorPatterns = [
        /Error:\s*(.+)/gi,
        /错误:\s*(.+)/gi,
        /Failed to\s*(.+)/gi,
        /失败:\s*(.+)/gi,
      ];

      errorPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach((match: string) => {
            errors.push({ error: match });
          });
        }
      });

      // 查找修复模式
      const fixPatterns = [
        /Fixed\s*(.+)/gi,
        /修复:\s*(.+)/gi,
        /Solution:\s*(.+)/gi,
        /解决方案:\s*(.+)/gi,
      ];

      fixPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches && errors.length > 0) {
          // 将修复关联到最后一个错误
          errors[errors.length - 1].fix = matches[0];
        }
      });
    });

    // 格式化输出
    if (errors.length === 0) return '';

    const limitedErrors = errors.slice(0, maxErrors);
    return limitedErrors
      .map((item, index) => {
        let result = `${index + 1}. ${item.error}`;
        if (item.fix) {
          result += `\n   Fix: ${item.fix}`;
        }
        return result;
      })
      .join('\n');
  }

  /**
   * 提取问题解决过程
   */
  private extractProblemSolving(messages: Message[]): string {
    const steps: string[] = [];

    messages.forEach(msg => {
      const content = typeof msg.content === 'string' ? msg.content : '';

      // 查找问题解决关键词
      const problemKeywords = [
        'analyzed', 'investigated', 'debugged', 'tested', 'verified',
        '分析', '调查', '调试', '测试', '验证',
      ];

      problemKeywords.forEach(keyword => {
        if (content.toLowerCase().includes(keyword)) {
          steps.push(`- ${content.trim().substring(0, 100)}...`);
        }
      });
    });

    return steps.slice(0, 10).join('\n');
  }

  /**
   * 提取用户消息
   */
  private extractUserMessages(messages: Message[]): string {
    const userMessages = messages.filter(m => m.role === 'user');

    return userMessages
      .map((msg, index) => {
        const content = typeof msg.content === 'string' ? msg.content : 'Multimodal content';
        return `${index + 1}. ${content.trim()}`;
      })
      .join('\n');
  }

  /**
   * 提取待完成任务
   */
  private extractPendingTasks(messages: Message[]): string {
    const tasks: string[] = [];

    messages.forEach(msg => {
      const content = typeof msg.content === 'string' ? msg.content : '';

      // 查找待办模式
      const todoPatterns = [
        /TODO:\s*(.+)/gi,
        /待办:\s*(.+)/gi,
        /Pending:\s*(.+)/gi,
        /待完成:\s*(.+)/gi,
      ];

      todoPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          tasks.push(...matches);
        }
      });
    });

    return tasks.length > 0 ? tasks.join('\n- ') : 'No explicit pending tasks found.';
  }

  /**
   * 提取当前工作
   */
  private extractCurrentWork(messages: Message[]): string {
    // 获取最近的几条消息
    const recentMessages = messages.slice(-5);

    // 查找最近的工作内容
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const msg = recentMessages[i];
      if (msg.role === 'assistant') {
        const content = typeof msg.content === 'string' ? msg.content : '';
        if (content.length > 50) {
          return `Last working on: ${content.substring(0, 200)}...`;
        }
      }
    }

    return 'Current work not identified.';
  }

  /**
   * 提取下一步建议
   */
  private extractNextStep(messages: Message[]): string | undefined {
    // 获取最近的用户消息
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');

    if (!lastUserMessage) {
      return undefined;
    }

    const content = typeof lastUserMessage.content === 'string' ? lastUserMessage.content : '';
    return `Next step should address: "${content.trim().substring(0, 100)}..."`;
  }

  /**
   * 用执行记录增强消息
   */
  private enrichMessagesWithRecords(messages: Message[], records: ExecutionRecord[]): Message[] {
    // 简化实现：直接返回原消息
    // 完整实现可以将执行记录插入到消息流中
    return messages;
  }

  /**
   * 估算原始消息的 token 数量
   */
  private estimateOriginalTokens(messages: Message[]): number {
    return messages.reduce((sum, msg) => sum + this.tokenManager.estimateTokens(msg), 0);
  }
}

/**
 * 自动压缩安全配置
 * 教训来源：Claude Code 源码泄露事件中发现 autoCompact 无限重试 bug，
 * 曾有会话连续失败 3272 次疯狂消耗 token
 */
export const AUTO_COMPACT_SAFETY = {
  /** 连续失败上限，超过后停止重试 */
  MAX_CONSECUTIVE_FAILURES: 3,
  /** 指数退避基础延迟（ms） */
  BASE_RETRY_DELAY_MS: 1000,
  /** 最大退避延迟（ms） */
  MAX_RETRY_DELAY_MS: 30000,
  /** 单次压缩超时（ms） */
  COMPRESS_TIMEOUT_MS: 30000,
} as const;

/**
 * 压缩失败记录
 */
export interface CompactFailureRecord {
  timestamp: number;
  error: string;
  consecutiveFailures: number;
}

/**
 * 紧凑摘要管理器
 * 与 TokenBudgetManager 集成，实现自动压缩
 * 内置失败保护：连续失败超过上限自动停止，避免无限重试烧 token
 */
export class CompactSummaryManager {
  private tokenManager: TokenBudgetManager;
  private extractor: SummaryExtractor;

  /** 连续压缩失败计数 */
  private consecutiveFailures = 0;
  /** 失败记录（用于调试） */
  private failureLog: CompactFailureRecord[] = [];
  /** 是否因连续失败被禁用 */
  private compactDisabled = false;

  constructor(tokenManager?: TokenBudgetManager) {
    this.tokenManager = tokenManager || new TokenBudgetManager();
    this.extractor = new SummaryExtractor(this.tokenManager);
  }

  /**
   * 检查自动压缩是否可用
   * 连续失败超过上限时返回 false
   */
  isCompactAvailable(): boolean {
    return !this.compactDisabled;
  }

  /**
   * 获取连续失败次数
   */
  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /**
   * 获取失败日志
   */
  getFailureLog(): CompactFailureRecord[] {
    return [...this.failureLog];
  }

  /**
   * 记录一次压缩失败
   * 超过上限自动禁用压缩
   */
  private recordFailure(error: string): void {
    this.consecutiveFailures++;
    this.failureLog.push({
      timestamp: Date.now(),
      error,
      consecutiveFailures: this.consecutiveFailures,
    });

    if (this.consecutiveFailures >= AUTO_COMPACT_SAFETY.MAX_CONSECUTIVE_FAILURES) {
      this.compactDisabled = true;
      console.error(
        `🚨 自动压缩已禁用：连续失败 ${this.consecutiveFailures} 次（上限 ${AUTO_COMPACT_SAFETY.MAX_CONSECUTIVE_FAILURES}）` +
        `\n最近错误: ${error}` +
        `\n手动恢复: manager.resetFailureState()`
      );
    }
  }

  /**
   * 记录一次压缩成功，重置失败计数
   */
  private recordSuccess(): void {
    if (this.consecutiveFailures > 0) {
      console.log(`✅ 压缩成功，重置失败计数（之前连续失败 ${this.consecutiveFailures} 次）`);
    }
    this.consecutiveFailures = 0;
  }

  /**
   * 重置失败状态（手动恢复压缩功能）
   */
  resetFailureState(): void {
    this.consecutiveFailures = 0;
    this.compactDisabled = false;
    this.failureLog = [];
    console.log('🔄 自动压缩已重新启用');
  }

  /**
   * 计算退避延迟（指数退避）
   */
  private getRetryDelay(): number {
    const delay = AUTO_COMPACT_SAFETY.BASE_RETRY_DELAY_MS * Math.pow(2, this.consecutiveFailures);
    return Math.min(delay, AUTO_COMPACT_SAFETY.MAX_RETRY_DELAY_MS);
  }

  /**
   * 压缩消息历史（如果超出预算）
   * 内置失败保护：连续失败超过上限自动停止，避免 Claude Code 式的无限重试
   */
  async compressIfNeeded(
    messages: Message[],
    budget: number,
    options?: SummaryExtractionOptions
  ): Promise<{ messages: Message; summary?: string; compressed: boolean; skipped?: boolean }> {
    const currentTokens = messages.reduce((sum, msg) => sum + this.tokenManager.estimateTokens(msg), 0);

    // 如果未超出预算，直接返回
    if (currentTokens <= budget) {
      return {
        messages: messages[messages.length - 1],
        compressed: false,
      };
    }

    // 检查压缩是否被禁用（连续失败过多）
    if (this.compactDisabled) {
      console.warn(
        `⚠️  自动压缩已禁用（连续失败 ${this.consecutiveFailures} 次），跳过压缩。` +
        `历史已超出预算 ${currentTokens - budget} tokens。` +
        `手动恢复: manager.resetFailureState()`
      );
      return {
        messages: messages[messages.length - 1],
        compressed: false,
        skipped: true,
      };
    }

    // 指数退避：如果之前有失败，等待一段时间再重试
    if (this.consecutiveFailures > 0) {
      const delay = this.getRetryDelay();
      console.log(`⏳ 压缩前退避等待 ${delay}ms（第 ${this.consecutiveFailures + 1} 次尝试）`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      console.log(`⚠️  History (${currentTokens} tokens) exceeds budget (${budget} tokens), compressing...`);

      // 带超时的压缩
      const compressPromise = Promise.resolve(
        this.extractor.extractFromMessages(messages, options)
      );
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`压缩超时（${AUTO_COMPACT_SAFETY.COMPRESS_TIMEOUT_MS}ms）`)), AUTO_COMPACT_SAFETY.COMPRESS_TIMEOUT_MS)
      );

      const { summary, metadata } = await Promise.race([compressPromise, timeoutPromise]);

      const summaryText = CompactSummaryFormatter.formatCompact(summary);
      const summaryTokens = this.tokenManager.estimateTokens(summaryText);

      console.log(`✅ Compressed to ${summaryTokens} tokens (${metadata.compressionRatio.toFixed(1)}% reduction)`);
      this.recordSuccess();

      const summaryMessage: Message = {
        role: 'system',
        content: `[Previous conversation summary]\n\n${summaryText}`,
      };

      return {
        messages: summaryMessage,
        summary: summaryText,
        compressed: true,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.recordFailure(errorMsg);
      console.error(`❌ 压缩失败（连续第 ${this.consecutiveFailures} 次）: ${errorMsg}`);

      // 失败时返回原始消息，不截断（宁可超预算也不能丢上下文）
      return {
        messages: messages[messages.length - 1],
        compressed: false,
        skipped: true,
      };
    }
  }

  /**
   * 获取摘要提取器
   */
  getExtractor(): SummaryExtractor {
    return this.extractor;
  }

  /**
   * 获取 Token 管理器
   */
  getTokenManager(): TokenBudgetManager {
    return this.tokenManager;
  }
}
