/**
 * FFT Engine - Fast and Frugal Tree decision engine
 *
 * Evaluates FFT trees to make quick decisions with minimal information processing.
 *
 * Phase 9.2: Added decision path recording and Memo integration
 */

import chalk from 'chalk';
import { ChatInput, FFTNode, FFTAction, FFTResult, FFTConfig, isTerminalAction } from './types';
import { MemoCliPlugin } from '../loop/plugins/memo-cli-plugin';

export interface FFTEngineOptions extends FFTConfig {
  memoPlugin?: MemoCliPlugin;
  requirement?: string;  // Original user requirement for context
}

export class FFTEngine {
  private config: FFTConfig;
  private memoPlugin?: MemoCliPlugin;
  private requirement?: string;
  private decisionChainId?: string;
  private nodeDecisions: Array<{nodeId: string; cue: string; result: boolean; depth: number}> = [];

  constructor(config: FFTEngineOptions = {}) {
    this.config = {
      maxDepth: config.maxDepth ?? 3,
      enableFallback: config.enableFallback ?? true,
      verbose: config.verbose ?? false,
    };
    this.memoPlugin = config.memoPlugin;
    this.requirement = config.requirement;
  }

  /**
   * Evaluate an FFT tree
   *
   * Phase 9.2: Added decision path recording for Memo
   *
   * @param tree - The FFT tree to evaluate
   * @param input - Chat input context
   * @returns FFTResult with action and decision path
   */
  async evaluate(tree: FFTNode, input: ChatInput): Promise<FFTResult> {
    // Phase 9.2: Reset decision tracking and create reasoning chain
    this.nodeDecisions = [];
    if (this.memoPlugin && this.requirement) {
      try {
        this.decisionChainId = await this.memoPlugin.createReasoningChain(
          this.requirement,
          'decision'
        );
        if (this.decisionChainId) {
          console.log(chalk.gray('📝 FFT decision chain: ' + this.decisionChainId.substring(0, 8) + '...'));
        }
      } catch (error) {
        console.debug(chalk.gray(`FFT: Failed to create decision chain: ${error}`));
      }
    }

    const path: string[] = [];
    let currentNode: FFTNode | FFTAction = tree;
    let depth = 0;

    while (!isTerminalAction(currentNode) && depth < (this.config.maxDepth || 3)) {
      const node = currentNode as FFTNode;
      path.push(node.id);

      if (this.config.verbose) {
        console.log(chalk.gray(`  [FFT] Node: ${node.cue}`));
      }

      // Evaluate the cue (test function)
      const testResult = await node.test(input);

      // Phase 9.2: Record decision
      this.nodeDecisions.push({
        nodeId: node.id,
        cue: node.cue,
        result: testResult,
        depth
      });

      if (this.config.verbose) {
        const resultStr = testResult ? chalk.green('YES') : chalk.red('NO');
        console.log(chalk.gray(`  [FFT] Result: ${resultStr}`));
      }

      // Follow the appropriate exit
      currentNode = testResult ? node.exitIfTrue : node.exitIfFalse;
      depth++;
    }

    // If we exceeded max depth without reaching a terminal action, use fallback
    if (!isTerminalAction(currentNode)) {
      if (this.config.verbose) {
        console.log(chalk.yellow(`  [FFT] Max depth reached, using fallback`));
      }

      // Phase 9.2: Save decision chain to Memo
      await this.saveDecisionChain({
        action: {
          type: 'fallback',
          reason: 'Max depth exceeded without reaching terminal action',
        },
        path,
        depth,
      }, false);

      return {
        action: {
          type: 'fallback',
          reason: 'Max depth exceeded without reaching terminal action',
        },
        path,
        depth,
      };
    }

    if (this.config.verbose) {
      console.log(chalk.gray(`  [FFT] Action: ${chalk.cyan(currentNode.type)}`));
      console.log(chalk.gray(`  [FFT] Path: ${path.join(' → ')}`));
    }

    const result = {
      action: currentNode as FFTAction,
      path,
      depth,
    };

    // Phase 9.2: Save decision chain to Memo
    await this.saveDecisionChain(result, true);

    return result;
  }

  /**
   * Phase 9.2: Save decision chain to Memo
   */
  private async saveDecisionChain(result: FFTResult, success: boolean): Promise<void> {
    if (!this.memoPlugin || !this.decisionChainId) {
      return;
    }

    try {
      // Record each decision as a reasoning step
      for (let i = 0; i < this.nodeDecisions.length; i++) {
        const decision = this.nodeDecisions[i];
        const parentStepId = i > 0 ? `fft-decision-${i-1}` : undefined;

        await this.memoPlugin.addReasoningStep(
          'decision',
          `FFT Node: ${decision.cue}`,
          `Decision: ${decision.result ? 'YES' : 'NO'}\nDepth: ${decision.depth}\nNode ID: ${decision.nodeId}`,
          parentStepId,
          {
            algorithm: 'FFT',
            confidence: 0.8,
            metadata: {
              nodeId: decision.nodeId,
              depth: decision.depth,
              result: decision.result
            }
          }
        );
      }

      // Complete the reasoning chain
      const summary = this.nodeDecisions.map(d =>
        `${d.nodeId}: ${d.result ? 'YES' : 'NO'}`
      ).join(' → ');

      await this.memoPlugin.completeReasoningChain(
        success,
        `FFT decision path: ${result.path.join(' → ')}\n` +
        `Decision sequence: ${summary}\n` +
        `Final action: ${result.action.type}\n` +
        `Depth: ${result.depth}`,
        undefined
      );

      console.log(chalk.gray(`📝 FFT decision saved: ${this.decisionChainId?.substring(0, 8)}...`));
    } catch (error) {
      console.debug(chalk.gray(`FFT: Failed to save decision: ${error}`));
    }
  }

  /**
   * Build a chat-specific FFT tree
   *
   * This tree is optimized for chat mode:
   * 1. Check for time-sensitive keywords (needs search)
   * 2. Check if AI can answer directly (no search needed)
   * 3. Default to search for comprehensive answers
   *
   * @returns FFTNode tree
   */
  buildChatFFT(): FFTNode {
    return {
      id: 'root',
      cue: '检测时间敏感关键词',
      test: (input: ChatInput) => {
        const timeSensitiveKeywords = [
          '最新',
          '当前',
          '近况',
          'recent',
          'latest',
          'current',
          'price',
          'prices',
          '价格',
          '报价',
          'news',
          '新闻',
          'release',
          '发布',
          'announcement',
          '公告',
          'today',
          'today\'s',
          'this week',
          'this month',
          '2025',
          '2026',
        ];

        const lowerMessage = input.message.toLowerCase();
        return timeSensitiveKeywords.some(keyword => lowerMessage.includes(keyword));
      },
      exitIfTrue: {
        type: 'search',
        tool: 'search',
        prompt: 'Search for current and recent information',
        maxResults: 3,
      },
      exitIfFalse: {
        id: 'knowledge_check',
        cue: 'AI知识库充足性检测',
        test: async (input: ChatInput) => {
          // Simple heuristic: if the question is about general knowledge,
          // concepts, explanations, or how-to, we can answer directly
          const directAnswerPatterns = [
            /^(how to|如何|怎么|怎样|什么是|what is|explain|解释)/i,
            /^(describe|描述|summarize|总结|list|列出)/i,
            /^(difference between|区别|比较|compare)/i,
            /(definition|定义|meaning|意思)/i,
            /(example|例子|实例)/i,
          ];

          // Check if message matches direct-answer patterns
          const matchesPattern = directAnswerPatterns.some(pattern =>
            pattern.test(input.message)
          );

          // If it matches a direct-answer pattern, we can answer directly (return true)
          // If not, we need to search (return false)
          return matchesPattern;
        },
        exitIfTrue: {
          type: 'answer',
          prompt: 'Provide a direct answer based on your knowledge',
        },
        exitIfFalse: {
          type: 'search',
          tool: 'search',
          prompt: 'Search for comprehensive information to provide accurate answer',
          maxResults: 3,
        },
      },
    };
  }

  /**
   * Get statistics about the FFT tree
   *
   * @param tree - FFT tree to analyze
   * @returns Object with tree statistics
   */
  analyzeTree(tree: FFTNode): { maxDepth: number; nodeCount: number; terminalActions: number } {
    let maxDepth = 0;
    let nodeCount = 0;
    let terminalActions = 0;

    const traverse = (node: FFTNode | FFTAction, depth: number) => {
      if (depth > maxDepth) {
        maxDepth = depth;
      }

      if (isTerminalAction(node)) {
        terminalActions++;
        return;
      }

      nodeCount++;
      traverse(node.exitIfTrue, depth + 1);
      traverse(node.exitIfFalse, depth + 1);
    };

    traverse(tree, 0);

    return {
      maxDepth: maxDepth + 1,
      nodeCount,
      terminalActions,
    };
  }
}
