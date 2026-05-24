/**
 * Complexity Analyzer
 * 分析任务复杂度，决定是否触发 Claude Code Subagent 系统
 */

import fg from 'fast-glob';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  TaskContext,
  ComplexityScore,
  ComplexityLevel,
  AnalysisResult,
  ComplexityAnalyzerConfig
} from './types';

export class ComplexityAnalyzer {
  private config: Required<ComplexityAnalyzerConfig>;

  // 默认权重
  private readonly DEFAULT_WEIGHTS = {
    fileCount: 1.0,
    techStack: 1.0,
    dependencies: 1.0,
    estimatedSteps: 1.0,
    codeScope: 1.0
  };

  // 关键词映射：技术栈识别
  private readonly TECH_KEYWORDS = {
    frontend: ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt', 'frontend', 'ui', 'component'],
    backend: ['api', 'server', 'backend', 'express', 'fastify', 'nest', 'koa', 'controller'],
    database: ['database', 'db', 'sql', 'mongodb', 'postgres', 'mysql', 'redis', 'prisma'],
    auth: ['auth', 'login', 'oauth', 'jwt', 'session', 'permission', 'role'],
    testing: ['test', 'spec', 'mock', 'jest', 'vitest', 'cypress', 'playwright'],
    devops: ['docker', 'deploy', 'ci', 'cd', 'pipeline', 'github actions', 'gitlab'],
    styling: ['css', 'scss', 'tailwind', 'styled', 'theme', 'design'],
    state: ['state', 'store', 'redux', 'zustand', 'mobx', 'context'],
  };

  // 复杂操作关键词
  private readonly COMPLEX_OPS = [
    'refactor', '重构', 'architecture', '架构', 'migration', '迁移',
    'integration', '集成', 'microservice', '微服务', 'optimization', '优化',
    'parallel', '并行', 'distributed', '分布式', 'pipeline', '管道'
  ];

  constructor(config?: ComplexityAnalyzerConfig) {
    this.config = {
      claudeCodeThreshold: config?.claudeCodeThreshold ?? 70,
      subagentThreshold: config?.subagentThreshold ?? 50,
      functionCallingThreshold: config?.functionCallingThreshold ?? 30,
      detailedAnalysis: config?.detailedAnalysis ?? true,
      weights: {
        ...this.DEFAULT_WEIGHTS,
        ...config?.weights
      }
    };
  }

  /**
   * 分析任务复杂度
   */
  async analyze(context: TaskContext): Promise<AnalysisResult> {
    const dimensions = await this.analyzeDimensions(context);
    const total = this.calculateTotalScore(dimensions);
    const level = this.determineLevel(total);
    const reasons = this.generateReasons(dimensions, level);
    const strategy = this.recommendStrategy(total);

    const score: ComplexityScore = {
      total,
      level,
      dimensions,
      reasons,
      recommendedStrategy: strategy,
      analyzedAt: new Date()
    };

    const shouldUseClaudeCode = total >= this.config.claudeCodeThreshold;
    const suggestedSubagentCount = shouldUseClaudeCode
      ? this.calculateSubagentCount(score)
      : undefined;

    const suggestedAgentTypes = shouldUseClaudeCode
      ? this.suggestAgentTypes(context, dimensions)
      : undefined;

    return {
      score,
      shouldUseClaudeCode,
      suggestedSubagentCount,
      suggestedAgentTypes
    };
  }

  /**
   * 分析各个维度
   */
  private async analyzeDimensions(context: TaskContext): Promise<ComplexityScore['dimensions']> {
    const { requirement, projectRoot, projectInfo } = context;

    // 1. 文件数量评分
    const fileCountScore = await this.analyzeFileCount(context);

    // 2. 技术栈数量评分
    const techStackScore = this.analyzeTechStack(requirement, projectInfo);

    // 3. 依赖关系评分
    const dependenciesScore = this.analyzeDependencies(requirement);

    // 4. 预估步骤数评分
    const estimatedStepsScore = this.analyzeEstimatedSteps(requirement);

    // 5. 代码改动范围评分
    const codeScopeScore = await this.analyzeCodeScope(requirement, projectRoot);

    return {
      fileCount: fileCountScore,
      techStack: techStackScore,
      dependencies: dependenciesScore,
      estimatedSteps: estimatedStepsScore,
      codeScope: codeScopeScore
    };
  }

  /**
   * 分析文件数量
   */
  private async analyzeFileCount(context: TaskContext): Promise<number> {
    const { projectRoot, relatedFiles, projectInfo } = context;

    // 如果已提供相关文件，直接使用
    if (relatedFiles && relatedFiles.length > 0) {
      return Math.min(20, relatedFiles.length * 2);
    }

    // 如果有项目信息，使用 totalFiles
    if (projectInfo?.totalFiles) {
      const files = Math.min(projectInfo.totalFiles, 100); // 上限
      return Math.min(20, Math.round(files / 5));
    }

    // 否则扫描项目（限制在 100 个文件内）
    try {
      const files = await fg('**/*.{ts,js,tsx,jsx,py,go,rs,java}', {
        cwd: projectRoot,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**'],
        absolute: false
      });

      const count = Math.min(files.length, 100);
      return Math.min(20, Math.round(count / 5));
    } catch {
      return 5; // 默认中等评分
    }
  }

  /**
   * 分析技术栈数量
   */
  private analyzeTechStack(requirement: string, projectInfo?: any): number {
    let techStackCount = 0;
    const lowerReq = requirement.toLowerCase();

    // 检测关键词
    for (const [category, keywords] of Object.entries(this.TECH_KEYWORDS)) {
      const hasKeyword = keywords.some(kw =>
        lowerReq.includes(kw) ||
        projectInfo?.frameworks?.some((f: string) => f.toLowerCase().includes(kw))
      );
      if (hasKeyword) techStackCount++;
    }

    // 每个技术栈 4 分，最多 20 分
    return Math.min(20, techStackCount * 4);
  }

  /**
   * 分析依赖关系复杂度
   */
  private analyzeDependencies(requirement: string): number {
    const lowerReq = requirement.toLowerCase();
    let score = 0;

    // 检测依赖关键词
    const depKeywords = [
      'depends on', '依赖', 'requires', '需要',
      'integrate with', '集成', 'connect to', '连接',
      'communicate with', '通信', 'interact', '交互'
    ];

    const depCount = depKeywords.filter(kw => lowerReq.includes(kw)).length;
    score += Math.min(10, depCount * 2);

    // 检测复杂操作
    const complexOpCount = this.COMPLEX_OPS.filter(op => lowerReq.includes(op)).length;
    score += Math.min(10, complexOpCount * 3);

    return Math.min(20, score);
  }

  /**
   * 分析预估步骤数
   */
  private analyzeEstimatedSteps(requirement: string): number {
    const lowerReq = requirement.toLowerCase();

    // 常见步骤关键词
    const stepIndicators = [
      'then', 'after', 'next', 'finally', 'before',
      '然后', '之后', '接下来', '最后', '之前',
      'step', 'phase', 'stage', '步骤', '阶段'
    ];

    let steps = 1; // 基础步骤
    for (const indicator of stepIndicators) {
      const matches = (lowerReq.match(new RegExp(indicator, 'g')) || []).length;
      steps += matches;
    }

    // 根据步骤数评分
    if (steps <= 2) return 5;
    if (steps <= 4) return 10;
    if (steps <= 6) return 15;
    return 20;
  }

  /**
   * 分析代码改动范围
   */
  private async analyzeCodeScope(requirement: string, projectRoot: string): Promise<number> {
    const lowerReq = requirement.toLowerCase();

    // 检测是否涉及多个文件
    const multiFileKeywords = [
      'multiple files', '多个文件',
      'all files', '所有文件',
      'refactor', '重构',
      'migration', '迁移',
      'globally', '全局'
    ];

    let score = 5; // 基础分

    if (multiFileKeywords.some(kw => lowerReq.includes(kw))) {
      score += 10;
    }

    // 检测是否涉及配置文件
    const configKeywords = ['config', '配置', 'settings', 'env', '.env'];
    if (configKeywords.some(kw => lowerReq.includes(kw))) {
      score += 3;
    }

    // 检测是否涉及数据库
    const dbKeywords = ['database', 'db', 'schema', 'migration', '数据库'];
    if (dbKeywords.some(kw => lowerReq.includes(kw))) {
      score += 5;
    }

    return Math.min(20, score);
  }

  /**
   * 计算总分
   */
  private calculateTotalScore(dimensions: ComplexityScore['dimensions']): number {
    const { weights } = this.config;

    return Math.round(
      dimensions.fileCount * (weights.fileCount || 1.0) +
      dimensions.techStack * (weights.techStack || 1.0) +
      dimensions.dependencies * (weights.dependencies || 1.0) +
      dimensions.estimatedSteps * (weights.estimatedSteps || 1.0) +
      dimensions.codeScope * (weights.codeScope || 1.0)
    );
  }

  /**
   * 确定复杂度等级
   */
  private determineLevel(total: number): ComplexityLevel {
    if (total >= 80) return ComplexityLevel.VERY_COMPLEX;
    if (total >= 60) return ComplexityLevel.COMPLEX;
    if (total >= 40) return ComplexityLevel.MEDIUM;
    return ComplexityLevel.SIMPLE;
  }

  /**
   * 生成评分理由
   */
  private generateReasons(
    dimensions: ComplexityScore['dimensions'],
    level: ComplexityLevel
  ): string[] {
    const reasons: string[] = [];

    if (dimensions.fileCount >= 15) {
      reasons.push(`涉及大量文件 (${dimensions.fileCount / 2}+ 个)`);
    }
    if (dimensions.techStack >= 12) {
      reasons.push(`涉及多个技术栈 (${dimensions.techStack / 4} 个以上)`);
    }
    if (dimensions.dependencies >= 15) {
      reasons.push(`依赖关系复杂`);
    }
    if (dimensions.estimatedSteps >= 15) {
      reasons.push(`需要多个执行步骤`);
    }
    if (dimensions.codeScope >= 15) {
      reasons.push(`代码改动范围大`);
    }

    if (reasons.length === 0) {
      reasons.push('相对简单的任务');
    }

    return reasons;
  }

  /**
   * 推荐执行策略
   */
  private recommendStrategy(total: number): ComplexityScore['recommendedStrategy'] {
    if (total >= this.config.claudeCodeThreshold) return 'claude-code';
    if (total >= this.config.subagentThreshold) return 'subagent';
    if (total >= this.config.functionCallingThreshold) return 'function-calling';
    return 'fft';
  }

  /**
   * 计算建议的 subagent 数量
   */
  private calculateSubagentCount(score: ComplexityScore): number {
    const { total, dimensions } = score;

    // 根据总分和维度确定
    if (total >= 90) return 5;
    if (total >= 80) return 4;
    if (total >= 70) return 3;

    // 根据具体维度调整
    let count = 2;
    if (dimensions.techStack >= 12) count++;
    if (dimensions.dependencies >= 15) count++;

    return Math.min(5, count);
  }

  /**
   * 建议的 agent 类型
   */
  private suggestAgentTypes(
    context: TaskContext,
    dimensions: ComplexityScore['dimensions']
  ): string[] {
    const types: string[] = [];
    const { requirement } = context;
    const lowerReq = requirement.toLowerCase();

    // 基于需求内容建议
    if (lowerReq.includes('test') || lowerReq.includes('测试')) {
      types.push('testing');
    }
    if (lowerReq.includes('document') || lowerReq.includes('文档')) {
      types.push('documentation');
    }
    if (lowerReq.includes('architecture') || lowerReq.includes('架构')) {
      types.push('architecture');
    }
    if (lowerReq.includes('implement') || lowerReq.includes('实现') || lowerReq.includes('create')) {
      types.push('implementation');
    }

    // 基于维度建议
    if (dimensions.techStack >= 12 || dimensions.dependencies >= 15) {
      if (!types.includes('code-analysis')) {
        types.unshift('code-analysis');
      }
    }

    // 确保至少有 3 个基本类型
    if (types.length < 3) {
      const defaults = ['code-analysis', 'implementation', 'testing'];
      for (const def of defaults) {
        if (!types.includes(def)) {
          types.push(def);
        }
      }
    }

    return types.slice(0, 5);
  }

  /**
   * 快速检测（不访问文件系统）
   */
  quickCheck(requirement: string, projectInfo?: any): boolean {
    const lowerReq = requirement.toLowerCase();

    // 快速检查：是否包含复杂操作关键词
    const hasComplexOp = this.COMPLEX_OPS.some(op => lowerReq.includes(op));
    if (hasComplexOp) return true;

    // 快速检查：技术栈数量
    let techCount = 0;
    for (const keywords of Object.values(this.TECH_KEYWORDS)) {
      if (keywords.some(kw => lowerReq.includes(kw))) {
        techCount++;
      }
    }
    if (techCount >= 3) return true;

    return false;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ComplexityAnalyzerConfig>): void {
    if (config.claudeCodeThreshold !== undefined) {
      this.config.claudeCodeThreshold = config.claudeCodeThreshold;
    }
    if (config.subagentThreshold !== undefined) {
      this.config.subagentThreshold = config.subagentThreshold;
    }
    if (config.functionCallingThreshold !== undefined) {
      this.config.functionCallingThreshold = config.functionCallingThreshold;
    }
    if (config.detailedAnalysis !== undefined) {
      this.config.detailedAnalysis = config.detailedAnalysis;
    }
    if (config.weights) {
      this.config.weights = { ...this.config.weights, ...config.weights };
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): Required<ComplexityAnalyzerConfig> {
    return { ...this.config };
  }
}
