// src/context/tokenBudget.ts
/**
 * 动态 Token 预算管理器
 * 参考 Claude Code 的 contextAnalysis.ts 实现
 *
 * 功能：
 * 1. 分层预算分配（system prompt / 工具结果 / 对话历史 / 上下文 / 预留）
 * 2. 智能历史截断（从最近消息向前保留）
 * 3. Token 快速估算（中英文混合）
 * 4. 上下文使用分析（使用率、截断建议）
 */

import { ExecutionRecord } from '../history';

/**
 * 消息接口（兼容 OpenAI API）
 */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
}

/**
 * Token 预算分配
 */
export interface TokenAllocation {
  systemPrompt: number;      // System prompt 预算
  toolResults: number;        // 工具结果预算
  history: number;            // 对话历史预算
  context: number;            // 项目上下文预算
  reserve: number;            // 预留缓冲
  available: number;          // 可用总额
}

/**
 * Token 使用统计
 */
export interface TokenUsage {
  total: number;              // 总使用量
  systemPrompt: number;       // System prompt 使用
  toolResults: number;        // 工具结果使用
  history: number;            // 历史使用
  context: number;            // 上下文使用
  utilizationRate: number;    // 利用率 (0-1)
}

/**
 * 截断策略建议
 */
export interface TruncationStrategy {
  shouldTruncate: boolean;    // 是否需要截断
  targetReduction: number;    // 目标减少量 (tokens)
  strategies: string[];       // 建议策略列表
  priority: string[];           // 优先保留内容
}

/**
 * Token 预算分析结果
 */
export interface BudgetAnalysis {
  allocation: TokenAllocation;
  usage: TokenUsage;
  truncation: TruncationStrategy;
  warnings: string[];         // 警告信息
}

/**
 * Token 预算管理器
 */
export class TokenBudgetManager {
  private readonly totalBudget: number;

  // 预算分配比例（总计 1.0）
  private readonly ALLOCATION_RATIOS = {
    systemPrompt: 0.15,   // 15% for system prompt
    toolResults: 0.25,    // 25% for tool results
    history: 0.35,        // 35% for conversation history
    context: 0.15,        // 15% for project context
    reserve: 0.10,        // 10% reserve buffer
  };

  // 中文/英文字符估算比例
  private readonly CHARS_PER_TOKEN_ZH = 1.5;   // 中文约 1.5 字/token
  private readonly CHARS_PER_TOKEN_EN = 4.0;   // 英文约 4 字/token
  private readonly CHARS_PER_TOKEN_MIXED = 2.5; // 混合约 2.5 字/token

  constructor(totalBudget: number = 8000) {
    if (totalBudget <= 0) {
      throw new Error(`Invalid token budget: ${totalBudget}. Must be positive.`);
    }
    this.totalBudget = totalBudget;
  }

  /**
   * 获取总预算
   */
  getTotalBudget(): number {
    return this.totalBudget;
  }

  /**
   * 计算 Token 分配
   */
  allocate(systemPromptTokens: number = 0, toolResultsTokens: number = 0): TokenAllocation {
    // 计算剩余可用预算
    const used = systemPromptTokens + toolResultsTokens;
    const remaining = Math.max(0, this.totalBudget - used);

    return {
      systemPrompt: systemPromptTokens,
      toolResults: toolResultsTokens,
      history: Math.floor(remaining * this.ALLOCATION_RATIOS.history),
      context: Math.floor(remaining * this.ALLOCATION_RATIOS.context),
      reserve: Math.floor(remaining * this.ALLOCATION_RATIOS.reserve),
      available: this.totalBudget,
    };
  }

  /**
   * 截断历史消息（从最近向前保留）
   *
   * 策略：
   * 1. 从最新消息开始向前遍历
   * 2. 保留系统消息和最新用户消息
   * 3. 尽可能保留完整对话轮次
   *
   * @param messages 消息数组
   * @param budget 历史预算（tokens）
   * @returns 截断后的消息数组
   */
  truncateHistory(messages: Message[], budget: number): Message[] {
    if (messages.length === 0) {
      return [];
    }

    let totalTokens = 0;
    const result: Message[] = [];

    // 从最新消息向前遍历
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgTokens = this.estimateTokens(msg);

      // 系统消息必须保留（如果存在）
      if (msg.role === 'system') {
        result.unshift(msg);
        totalTokens += msgTokens;
        continue;
      }

      // 检查是否超出预算
      if (totalTokens + msgTokens > budget) {
        // 尝试保留最新用户消息（即使超出预算）
        if (msg.role === 'user' && result.length > 0) {
          // 检查是否已有用户消息
          const hasUserMessage = result.some(m => m.role === 'user');
          if (!hasUserMessage) {
            result.unshift(msg);
          }
        }
        break;
      }

      result.unshift(msg);
      totalTokens += msgTokens;
    }

    return result;
  }

  /**
   * 估算 Token 数量（基于字符数）
   *
   * 策略：
   * - 检测文本中中英文比例
   * - 中文约 1.5 字/token
   * - 英文约 4 字/token
   * - 混合文本约 2.5 字/token
   *
   * @param text 文本内容
   * @returns 估算的 token 数量
   */
  estimateTokens(text: string | Message): number {
    let content: string;

    if (typeof text === 'string') {
      content = text;
    } else if (typeof text.content === 'string') {
      content = text.content;
    } else {
      // 多模态内容（文本 + 图片）
      // 简化处理：只计算文本部分，图片忽略
      const contentArray = text.content as Array<{ type: string; text?: string }>;
      content = contentArray
        .filter((item): item is { type: string; text: string } => item.type === 'text' && !!item.text)
        .map(item => item.text)
        .join(' ');
    }

    if (!content || content.length === 0) {
      return 0;
    }

    // 检测中文字符比例
    const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const totalChars = content.length;
    const chineseRatio = chineseChars / totalChars;

    // 根据中英文比例选择估算方法
    let charsPerToken: number;
    if (chineseRatio > 0.7) {
      // 主导中文
      charsPerToken = this.CHARS_PER_TOKEN_ZH;
    } else if (chineseRatio < 0.3) {
      // 主导英文
      charsPerToken = this.CHARS_PER_TOKEN_EN;
    } else {
      // 中英混合
      charsPerToken = this.CHARS_PER_TOKEN_MIXED;
    }

    return Math.ceil(totalChars / charsPerToken);
  }

  /**
   * 估算 ExecutionRecord 的 token 数量
   */
  estimateRecordTokens(record: ExecutionRecord): number {
    let tokens = 0;

    // Action tokens
    tokens += this.estimateTokens(JSON.stringify(record.action));

    // Error message tokens
    if (record.error) {
      tokens += this.estimateTokens(record.error);
    }

    // Rollback data tokens (简化处理)
    if (record.rollbackData) {
      tokens += 50; // 固定估算
    }

    return tokens;
  }

  /**
   * 估算历史记录的总 token 数量
   */
  estimateHistoryTokens(records: ExecutionRecord[]): number {
    return records.reduce((sum, record) => sum + this.estimateRecordTokens(record), 0);
  }

  /**
   * 分析 Token 使用情况
   */
  analyzeUsage(params: {
    systemPrompt?: string;
    messages?: Message[];
    toolResults?: any[];
    context?: string;
    history?: ExecutionRecord[];
  }): BudgetAnalysis {
    const {
      systemPrompt = '',
      messages = [],
      toolResults = [],
      context = '',
      history = [],
    } = params;

    // 估算各部分 token 使用
    const systemPromptTokens = this.estimateTokens(systemPrompt);
    const historyTokens = messages.reduce((sum, msg) => sum + this.estimateTokens(msg), 0);
    const toolResultsTokens = toolResults.reduce(
      (sum, result) => sum + this.estimateTokens(JSON.stringify(result)),
      0
    );
    const contextTokens = this.estimateTokens(context);
    const historyRecordsTokens = this.estimateHistoryTokens(history);

    // 总使用量
    const total = systemPromptTokens + historyTokens + toolResultsTokens + contextTokens + historyRecordsTokens;

    // 计算分配
    const allocation = this.allocate(systemPromptTokens, toolResultsTokens);

    // 使用统计
    const usage: TokenUsage = {
      total,
      systemPrompt: systemPromptTokens,
      toolResults: toolResultsTokens,
      history: historyTokens + historyRecordsTokens,
      context: contextTokens,
      utilizationRate: total / this.totalBudget,
    };

    // 生成截断策略
    const truncation = this.generateTruncationStrategy(usage, allocation);

    // 生成警告
    const warnings = this.generateWarnings(usage, allocation);

    return {
      allocation,
      usage,
      truncation,
      warnings,
    };
  }

  /**
   * 生成截断策略建议
   */
  private generateTruncationStrategy(usage: TokenUsage, allocation: TokenAllocation): TruncationStrategy {
    const shouldTruncate = usage.total > this.totalBudget;
    const targetReduction = shouldTruncate ? usage.total - this.totalBudget : 0;

    const strategies: string[] = [];
    const priority: string[] = ['Latest user message', 'System prompt', 'Recent actions'];

    if (shouldTruncate) {
      // 按优先级建议截断策略
      if (usage.history > allocation.history) {
        strategies.push(
          `截断对话历史（保留最近 ${Math.floor(allocation.history / 100)} 轮）`
        );
      }

      if (usage.context > allocation.context) {
        strategies.push('压缩项目上下文（移除非核心文件）');
      }

      if (usage.toolResults > allocation.toolResults) {
        strategies.push('截断工具结果（保留最新和失败的工具调用）');
      }

      if (strategies.length === 0) {
        strategies.push('全面压缩（所有部分按比例缩减）');
      }
    }

    return {
      shouldTruncate,
      targetReduction,
      strategies,
      priority,
    };
  }

  /**
   * 生成警告信息
   */
  private generateWarnings(usage: TokenUsage, allocation: TokenAllocation): string[] {
    const warnings: string[] = [];
    const utilizationRate = usage.utilizationRate;

    if (utilizationRate > 0.95) {
      warnings.push('⚠️  Token 使用率超过 95%，可能触发 API 限制');
    } else if (utilizationRate > 0.85) {
      warnings.push('⚠️  Token 使用率超过 85%，建议启用压缩');
    } else if (utilizationRate > 0.7) {
      warnings.push('ℹ️  Token 使用率超过 70%，考虑优化上下文');
    }

    // 各部分警告
    if (usage.history > allocation.history) {
      const overage = ((usage.history / allocation.history - 1) * 100).toFixed(0);
      warnings.push(`对话历史超出预算 ${overage}%`);
    }

    if (usage.context > allocation.context) {
      const overage = ((usage.context / allocation.context - 1) * 100).toFixed(0);
      warnings.push(`项目上下文超出预算 ${overage}%`);
    }

    if (usage.toolResults > allocation.toolResults) {
      const overage = ((usage.toolResults / allocation.toolResults - 1) * 100).toFixed(0);
      warnings.push(`工具结果超出预算 ${overage}%`);
    }

    return warnings;
  }

  /**
   * 打印分析报告
   */
  printAnalysis(analysis: BudgetAnalysis): void {
    console.log('\n📊 Token Budget Analysis');
    console.log('='.repeat(50));

    // 打印分配
    console.log('\n📋 Allocation:');
    console.log(`  System Prompt: ${analysis.allocation.systemPrompt} tokens`);
    console.log(`  Tool Results:  ${analysis.allocation.toolResults} tokens`);
    console.log(`  History:       ${analysis.allocation.history} tokens`);
    console.log(`  Context:       ${analysis.allocation.context} tokens`);
    console.log(`  Reserve:       ${analysis.allocation.reserve} tokens`);
    console.log(`  Total:         ${analysis.allocation.available} tokens`);

    // 打印使用
    console.log('\n📈 Usage:');
    console.log(`  System Prompt: ${analysis.usage.systemPrompt} tokens`);
    console.log(`  Tool Results:  ${analysis.usage.toolResults} tokens`);
    console.log(`  History:       ${analysis.usage.history} tokens`);
    console.log(`  Context:       ${analysis.usage.context} tokens`);
    console.log(`  Total:         ${analysis.usage.total} tokens`);
    console.log(`  Utilization:   ${(analysis.usage.utilizationRate * 100).toFixed(1)}%`);

    // 打印警告
    if (analysis.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      analysis.warnings.forEach(warning => console.log(`  ${warning}`));
    }

    // 打印截断策略
    if (analysis.truncation.shouldTruncate) {
      console.log('\n✂️  Truncation Strategy:');
      console.log(`  Target Reduction: ${analysis.truncation.targetReduction} tokens`);
      console.log('  Strategies:');
      analysis.truncation.strategies.forEach(strategy => console.log(`    - ${strategy}`));
      console.log('  Priority:');
      analysis.truncation.priority.forEach(p => console.log(`    ${p}`));
    }

    console.log('='.repeat(50) + '\n');
  }

  /**
   * 调整总预算
   */
  adjustBudget(newBudget: number): TokenBudgetManager {
    return new TokenBudgetManager(newBudget);
  }

  /**
   * 获取预算分配比例
   */
  getAllocationRatios(): typeof TokenBudgetManager.prototype.ALLOCATION_RATIOS {
    return { ...this.ALLOCATION_RATIOS };
  }
}
