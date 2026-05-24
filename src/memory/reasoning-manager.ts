/**
 * Reasoning Process Memory Manager
 *
 * 管理推理过程和思维模式学习
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  ReasoningStorage,
  ReasoningChain,
  ReasoningStep,
  ReasoningPattern,
  ReasoningStepType,
  ReasoningStepStatus,
} from './reasoning-types';

/**
 * 推理过程管理器
 */
export class ReasoningManager {
  private projectRoot: string;
  private storageFile: string;
  private storage: ReasoningStorage;
  private currentChain: ReasoningChain | null = null;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.storageFile = join(projectRoot, '.memo', 'reasoning.json');
    this.storage = {
      chains: [],
      patterns: [],
      lastUpdated: new Date().toISOString(),
      stats: {
        totalChains: 0,
        totalSteps: 0,
        totalPatterns: 0,
        averageChainLength: 0,
        overallSuccessRate: 0,
      },
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

    await this.loadStorage();
  }

  /**
   * 加载存储
   */
  private async loadStorage(): Promise<void> {
    try {
      if (!existsSync(this.storageFile)) {
        return;
      }

      const content = await fs.readFile(this.storageFile, 'utf-8');
      this.storage = JSON.parse(content);
    } catch (error) {
      console.error(`[Reasoning] Failed to load: ${error}`);
    }
  }

  /**
   * 保存存储
   */
  private async saveStorage(): Promise<void> {
    try {
      this.storage.lastUpdated = new Date().toISOString();
      const content = JSON.stringify(this.storage, null, 2);
      await fs.writeFile(this.storageFile, content, 'utf-8');
    } catch (error) {
      console.error(`[Reasoning] Failed to save: ${error}`);
    }
  }

  /**
   * 创建新的推理链
   */
  async createChain(task: string, taskType: string): Promise<string> {
    const chainId = this.generateChainId();
    const chain: ReasoningChain = {
      id: chainId,
      task,
      taskType,
      startTime: new Date().toISOString(),
      status: 'in_progress',
      steps: [],
      stepIndex: {},
      stats: {
        totalSteps: 0,
        completedSteps: 0,
        failedSteps: 0,
        totalDuration: 0,
        averageStepDuration: 0,
        totalTokens: 0,
      },
      reasoningVector: {
        taskType,
        algorithms: [],
        patterns: [],
        approaches: [],
      },
    };

    this.storage.chains.push(chain);
    this.currentChain = chain;
    await this.saveStorage();

    return chainId;
  }

  /**
   * 添加推理步骤
   */
  async addStep(
    type: ReasoningStepType,
    description: string,
    content: string,
    parentId?: string,
    metadata?: ReasoningStep['metadata']
  ): Promise<string> {
    if (!this.currentChain) {
      console.warn('[Reasoning] No active chain');
      return '';
    }

    const stepId = this.generateStepId();
    const step: ReasoningStep = {
      id: stepId,
      type,
      description,
      content,
      status: 'in_progress',
      timestamp: new Date().toISOString(),
      parentId,
      childIds: [],
      dependencies: [],
      metadata,
    };

    // 添加到步骤列表
    this.currentChain.steps.push(step);
    this.currentChain.stepIndex[stepId] = step;

    // 更新父步骤的子步骤列表
    if (parentId && this.currentChain.stepIndex[parentId]) {
      this.currentChain.stepIndex[parentId].childIds.push(stepId);
    }

    // 更新推理向量
    this.updateReasoningVector(this.currentChain, step);

    await this.saveStorage();
    return stepId;
  }

  /**
   * 更新推理步骤状态
   */
  async updateStep(
    stepId: string,
    status: ReasoningStepStatus,
    result?: ReasoningStep['result']
  ): Promise<void> {
    if (!this.currentChain) {
      return;
    }

    const step = this.currentChain.stepIndex[stepId];
    if (!step) {
      return;
    }

    step.status = status;
    if (result) {
      step.result = result;
    }

    // 更新统计
    if (status === 'completed') {
      this.currentChain.stats.completedSteps++;
    } else if (status === 'failed') {
      this.currentChain.stats.failedSteps++;
    }

    await this.saveStorage();
  }

  /**
   * 更新推理向量
   */
  private updateReasoningVector(chain: ReasoningChain, step: ReasoningStep): void {
    // 提取算法
    if (step.metadata?.algorithm) {
      if (!chain.reasoningVector!.algorithms.includes(step.metadata.algorithm)) {
        chain.reasoningVector!.algorithms.push(step.metadata.algorithm);
      }
    }

    // 提取模式（从描述中提取关键词）
    const patterns = this.extractPatterns(step.description + ' ' + step.content);
    patterns.forEach(pattern => {
      if (!chain.reasoningVector!.patterns.includes(pattern)) {
        chain.reasoningVector!.patterns.push(pattern);
      }
    });

    // 提取方法
    const approaches = this.extractApproaches(step.description, step.content);
    approaches.forEach(approach => {
      if (!chain.reasoningVector!.approaches.includes(approach)) {
        chain.reasoningVector!.approaches.push(approach);
      }
    });
  }

  /**
   * 提取模式关键词
   */
  private extractPatterns(text: string): string[] {
    const patterns = [
      'decomposition', 'abstraction', 'iteration', 'recursion',
      'divide-conquer', 'greedy', 'dynamic-programming',
      'backtracking', 'brute-force', 'optimization',
      'refactoring', 'debugging', 'testing', 'verification',
    ];

    const lowerText = text.toLowerCase();
    return patterns.filter(pattern => lowerText.includes(pattern));
  }

  /**
   * 提取方法关键词
   */
  private extractApproaches(description: string, content: string): string[] {
    const approaches = [
      'top-down', 'bottom-up', 'iterative', 'recursive',
      'parallel', 'sequential', 'incremental', 'comprehensive',
    ];

    const text = (description + ' ' + content).toLowerCase();
    return approaches.filter(approach => text.includes(approach));
  }

  /**
   * 完成推理链
   */
  async completeChain(success: boolean, output?: string, error?: string): Promise<void> {
    if (!this.currentChain) {
      return;
    }

    this.currentChain.endTime = new Date().toISOString();
    this.currentChain.status = success ? 'completed' : 'failed';
    this.currentChain.finalResult = {
      success,
      output,
      error,
      satisfaction: success ? 0.8 : 0.2,
    };

    // 计算持续时间
    const start = new Date(this.currentChain.startTime).getTime();
    const end = new Date(this.currentChain.endTime).getTime();
    this.currentChain.stats.totalDuration = end - start;
    this.currentChain.stats.averageStepDuration =
      this.currentChain.stats.totalDuration / this.currentChain.stats.totalSteps;

    // 学习模式
    this.currentChain.learnedPatterns = this.learnPatterns(this.currentChain);

    this.currentChain = null;
    await this.saveStorage();
  }

  /**
   * 从推理链中学习模式
   */
  private learnPatterns(chain: ReasoningChain): ReasoningChain['learnedPatterns'] {
    const patterns: ReasoningChain['learnedPatterns'] = {
      preferredAlgorithm: undefined,
      commonMistakes: [],
      successfulStrategies: [],
      decisionFactors: [],
    };

    // 找出最常用的算法
    if (chain.reasoningVector && chain.reasoningVector.algorithms.length > 0) {
      // 简单地选择第一个（实际应该统计频率）
      patterns.preferredAlgorithm = chain.reasoningVector.algorithms[0];
    }

    // 找出失败的步骤
    chain.steps
      .filter(step => step.status === 'failed')
      .forEach(step => {
        if (step.description && patterns.commonMistakes) {
          patterns.commonMistakes.push(step.description);
        }
      });

    // 找出成功的策略
    if (chain.finalResult?.success) {
      chain.steps
        .filter(step => step.status === 'completed' && step.result?.success)
        .forEach(step => {
          if (step.description && patterns.successfulStrategies) {
            patterns.successfulStrategies.push(step.description);
          }
        });
    }

    return patterns;
  }

  /**
   * 获取当前推理链
   */
  getCurrentChain(): ReasoningChain | null {
    return this.currentChain;
  }

  /**
   * 搜索相似推理链
   */
  async searchSimilarChains(
    task: string,
    taskType: string,
    limit = 5
  ): Promise<Array<{ chain: ReasoningChain; similarity: number }>> {
    const results: Array<{ chain: ReasoningChain; similarity: number }> = [];

    // 提取当前任务的向量
    const currentPatterns = this.extractPatterns(task);
    const currentAlgorithms = this.extractAlgorithms(task);

    for (const chain of this.storage.chains) {
      if (chain.id === this.currentChain?.id) {
        continue; // 跳过当前链
      }

      let similarity = 0;

      // 任务类型匹配（30%）
      if (chain.taskType === taskType) {
        similarity += 0.3;
      }

      // 模式匹配（40%）
      const patternMatches = currentPatterns.filter(p =>
        chain.reasoningVector?.patterns.includes(p)
      ).length;
      if (currentPatterns.length > 0) {
        similarity += (patternMatches / currentPatterns.length) * 0.4;
      }

      // 算法匹配（30%）
      const algorithmMatches = currentAlgorithms.filter(a =>
        chain.reasoningVector?.algorithms.includes(a)
      ).length;
      if (currentAlgorithms.length > 0) {
        similarity += (algorithmMatches / currentAlgorithms.length) * 0.3;
      }

      if (similarity > 0) {
        results.push({ chain, similarity });
      }
    }

    // 按相似度排序
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }

  /**
   * 提取算法关键词
   */
  private extractAlgorithms(text: string): string[] {
    const algorithms = ['fft', 'landmark', 'tot', 'react', 'bfs', 'dfs', 'beam'];
    const lowerText = text.toLowerCase();
    return algorithms.filter(algo => lowerText.includes(algo));
  }

  /**
   * 获取推理统计
   */
  getStats() {
    return this.storage.stats;
  }

  /**
   * 生成 ID
   */
  private generateChainId(): string {
    return `reasoning-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateStepId(): string {
    return `step-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 获取 AI 上下文摘要
   */
  async getAIContextSummary(task?: string, taskType?: string): Promise<string> {
    let summary = '🧠 Reasoning Context:\n\n';

    // 如果指定了任务，搜索相似推理链
    if (task && taskType) {
      const similar = await this.searchSimilarChains(task, taskType, 3);
      if (similar.length > 0) {
        summary += '📋 Similar Past Reasoning:\n';
        similar.forEach((result, index) => {
          summary += `  ${index + 1}. ${result.chain.task}\n`;
          summary += `     Success: ${result.chain.finalResult?.success ? 'Yes' : 'No'}\n`;
          summary += `     Similarity: ${(result.similarity * 100).toFixed(0)}%\n`;
          if (result.chain.learnedPatterns?.preferredAlgorithm) {
            summary += `     Algorithm: ${result.chain.learnedPatterns.preferredAlgorithm}\n`;
          }
        });
        summary += '\n';
      }
    }

    // 当前推理链
    if (this.currentChain) {
      summary += '📍 Current Reasoning:\n';
      summary += `  Task: ${this.currentChain.task}\n`;
      summary += `  Type: ${this.currentChain.taskType}\n`;
      summary += `  Steps: ${this.currentChain.stats.totalSteps}\n`;
      summary += `  Progress: ${this.currentChain.stats.completedSteps}/${this.currentChain.stats.totalSteps}\n`;
      if (this.currentChain.reasoningVector && this.currentChain.reasoningVector.algorithms.length > 0) {
        summary += `  Algorithms: ${this.currentChain.reasoningVector.algorithms.join(', ')}\n`;
      }
    }

    return summary;
  }

  /**
   * 获取推荐模式
   */
  getRecommendedPatterns(taskType: string, keywords: string[]): ReasoningPattern[] {
    return this.storage.patterns.filter(pattern => {
      // 任务类型匹配
      if (!pattern.triggerConditions.taskTypes.includes(taskType)) {
        return false;
      }

      // 关键词匹配
      const hasKeyword = keywords.some(kw =>
        pattern.triggerConditions.keywords.some(pk => pk.toLowerCase().includes(kw.toLowerCase()))
      );

      return hasKeyword;
    });
  }
}

/**
 * 创建推理过程管理器实例
 */
export function createReasoningManager(projectRoot: string): ReasoningManager {
  return new ReasoningManager(projectRoot);
}
