/**
 * Precipitation Coordinator
 *
 * 经验沉淀协调器，协调整个沉淀流程
 */

import { join } from 'path';
import { mkdir } from 'fs/promises';
import { NewmaConfig } from '../config';
import { MemoryScheduler } from './scheduler';
import { ExperienceAnalyzer } from './experience-analyzer';
import { SkillGenerator } from './skill-generator';
import { SkillDraftManager } from './skill-draft-manager';
import { ExplorationConfig } from './types-exploration';
import { logger } from '../logger';
import {
  PrecipitationConfig,
  PrecipitationResult,
  AnalyzerOptions,
  GeneratorOptions,
} from './types-precipitation';

/**
 * 协调器选项
 */
export interface CoordinatorOptions {
  /** 项目根目录 */
  projectRoot: string;
  /** 沉淀系统配置 */
  precipitationConfig?: PrecipitationConfig;
  /** 自主探索配置 */
  explorationConfig?: ExplorationConfig;
  /** 是否在启动时初始化目录 */
  initOnStart?: boolean;
}

/**
 * 经验沉淀协调器
 */
export class PrecipitationCoordinator {
  private projectRoot: string;
  private config: PrecipitationConfig;
  private explorationConfig?: ExplorationConfig;
  private scheduler: MemoryScheduler;
  private analyzer: ExperienceAnalyzer;
  private generator: SkillGenerator;
  private draftManager: SkillDraftManager;
  private newmaConfig: NewmaConfig;

  constructor(options: CoordinatorOptions, newmaConfig: NewmaConfig) {
    this.projectRoot = options.projectRoot;
    this.config = options.precipitationConfig || {};
    this.explorationConfig = options.explorationConfig;
    this.newmaConfig = newmaConfig;

    // 初始化各组件
    this.scheduler = new MemoryScheduler({
      config: this.config,
      explorationConfig: this.explorationConfig,
      runOnStart: false,
    });

    this.analyzer = new ExperienceAnalyzer(this.projectRoot, this.buildAnalyzerOptions());

    this.generator = new SkillGenerator(this.projectRoot, this.buildGeneratorOptions());

    this.draftManager = new SkillDraftManager(this.projectRoot);
  }

  /**
   * 启动沉淀系统
   */
  async start(
    precipitationCallback?: () => Promise<void>,
    explorationCallback?: () => Promise<void>
  ): Promise<void> {
    logger.info('[Precipitation] Starting precipitation system...');

    // 检查是否启用
    if (this.config.enabled === false) {
      logger.info('[Precipitation] ⚠ Precipitation system disabled');
      return;
    }

    // 初始化目录结构
    if (this.config.initOnStart !== false) {
      await this.draftManager.initialize();
      await this.ensurePrecipitationDir();
    }

    // 启动定时任务
    this.scheduler.start(
      precipitationCallback || (async () => {
        await this.executePrecipitation();
      }),
      explorationCallback
    );

    logger.info('[Precipitation] ✓ Precipitation system started');
    this.logScheduleInfo();
  }

  /**
   * 停止沉淀系统
   */
  async stop(): Promise<void> {
    logger.info('[Precipitation] Stopping precipitation system...');

    this.scheduler.stop();

    logger.info('[Precipitation] ✓ Precipitation system stopped');
  }

  /**
   * 手动触发沉淀
   */
  async trigger(): Promise<PrecipitationResult> {
    logger.info('[Precipitation] 🔹 Manually triggering precipitation...');

    return await this.executePrecipitation();
  }

  /**
   * 获取状态
   */
  getStatus(): {
    scheduler: any;
    drafts: any;
    config: PrecipitationConfig;
  } {
    return {
      scheduler: this.scheduler.getStatus(),
      drafts: this.draftManager.getStats(),
      config: this.config,
    };
  }

  /**
   * 执行沉淀流程
   */
  private async executePrecipitation(): Promise<PrecipitationResult> {
    const startTime = new Date();
    const logs: string[] = [];

    logs.push(`[${startTime.toISOString()}] Starting precipitation`);

    try {
      // 1. 分析经验
      logs.push('[Step 1] Analyzing experiences...');
      const analysisResult = await this.analyzer.analyze(this.newmaConfig);
      logs.push(`✓ Analysis complete: ${analysisResult.suggestionsPassed} suggestions generated`);

      // 2. 加载建议（从临时文件）
      const suggestions = await this.loadSuggestions();
      logs.push(`✓ Loaded ${suggestions.length} suggestions from temp file`);

      // 3. 自动审批（如果配置了）
      let autoApproved = 0;
      let autoRejected = 0;

      if (this.config.autoApproveBelow || this.config.autoRejectAbove) {
        const autoResult = await this.autoApproveOrReject(suggestions);
        autoApproved = autoResult.approved;
        autoRejected = autoResult.rejected;
        logs.push(`✓ Auto-approved: ${autoApproved}, Auto-rejected: ${autoRejected}`);
      }

      // 4. 生成技能文件
      logs.push('[Step 2] Generating skill files...');
      const generationResult = await this.generator.generate(suggestions);
      logs.push(`✓ Generated ${generationResult.skillsGenerated} skill files`);

      // 5. 清理旧草稿
      if (this.config.draftRetentionDays) {
        const cleaned = await this.draftManager.cleanupOldDrafts();
        logs.push(`✓ Cleaned up ${cleaned} old drafts`);
      }

      const endTime = new Date();
      logs.push(`[${endTime.toISOString()}] Precipitation complete`);

      return {
        success: true,
        startTime,
        endTime,
        suggestionsGenerated: analysisResult.suggestionsGenerated,
        draftsSaved: generationResult.skillsGenerated,
        autoApproved,
        autoRejected,
        logs,
      };
    } catch (error: any) {
      const endTime = new Date();
      logs.push(`[${endTime.toISOString()}] Precipitation failed: ${error.message}`);

      return {
        success: false,
        startTime,
        endTime,
        suggestionsGenerated: 0,
        draftsSaved: 0,
        autoApproved: 0,
        autoRejected: 0,
        error: error.message,
        logs,
      };
    }
  }

  /**
   * 自动批准或拒绝
   */
  private async autoApproveOrReject(suggestions: any[]): Promise<{
    approved: number;
    rejected: number;
  }> {
    let approved = 0;
    let rejected = 0;

    for (const suggestion of suggestions) {
      const id = this.extractDraftId(suggestion);

      const action = decideAutoAction(suggestion.confidence, {
        autoApproveBelow: this.config.autoApproveBelow,
        autoRejectAbove: this.config.autoRejectAbove,
      });

      if (action === 'approve') {
        try {
          await this.draftManager.approve(id, 'Auto-approved by system');
          approved++;
        } catch (error) {
          logger.warn(`Failed to auto-approve ${id}`);
        }
      } else if (action === 'reject') {
        try {
          await this.draftManager.reject(id, 'Auto-rejected by system');
          rejected++;
        } catch (error) {
          logger.warn(`Failed to auto-reject ${id}`);
        }
      }
    }

    return { approved, rejected };
  }

  /**
   * 从临时文件加载建议
   */
  private async loadSuggestions(): Promise<any[]> {
    const precipitationDir = join(this.projectRoot, '.memo', 'precipitation');
    const { readdir, readFile } = require('fs/promises');

    const files = await readdir(precipitationDir);
    const tempFiles = files.filter((f: string) => f.startsWith('suggestions-') && f.endsWith('.json'));

    if (tempFiles.length === 0) {
      return [];
    }

    // 读取最新的临时文件
    const latestFile = tempFiles.sort().reverse()[0];
    const content = await readFile(join(precipitationDir, latestFile), 'utf-8');

    return JSON.parse(content);
  }

  /**
   * 提取草稿 ID
   */
  private extractDraftId(suggestion: any): string {
    // 使用 suggestion.id 或生成一个
    return suggestion.id || `skill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 构建分析器选项
   */
  private buildAnalyzerOptions(): AnalyzerOptions {
    return {
      confidenceThreshold: this.config.confidenceThreshold || 0.6,
      maxSkills: this.config.maxDailySkills || 5,
      analysisDays: this.config.analysisDays || 7,
      weights: {
        errors: 0.4,
        history: 0.3,
        preferences: 0.2,
        others: 0.1,
      },
    };
  }

  /**
   * 构建生成器选项
   */
  private buildGeneratorOptions(): GeneratorOptions {
    return {
      saveAsDraft: true,
      targetDir: join(this.projectRoot, '.kode', 'skills', 'drafts'),
      includeMetadata: true,
    };
  }

  /**
   * 确保沉淀目录存在
   */
  private async ensurePrecipitationDir(): Promise<void> {
    const dir = join(this.projectRoot, '.memo', 'precipitation');
    await mkdir(dir, { recursive: true });
  }

  /**
   * 记录调度信息
   */
  private logScheduleInfo(): void {
    const schedule = this.config.schedule || '0 2 * * *';
    const description = MemoryScheduler.describeCronExpression(schedule);
    const nextRun = this.scheduler.getNextExecution();

    logger.info(`[Precipitation] Schedule: ${description} (${schedule})`);
    if (nextRun) {
      logger.info(`[Precipitation] Next run: ${nextRun.toISOString()}`);
    }
  }

  /**
   * 获取草稿管理器实例
   */
  getDraftManager(): SkillDraftManager {
    return this.draftManager;
  }

  /**
   * 获取调度器实例
   */
  getScheduler(): MemoryScheduler {
    return this.scheduler;
  }
}

/**
 * 自动审批决策（纯函数，供测试）
 *
 * 语义与字段名一致：
 * - autoApproveBelow：置信度低于此阈值 → 自动批准（低风险建议无需打扰用户）
 * - autoRejectAbove：置信度高于此阈值 → 自动拒绝（字段语义是"高于阈值说明
 *   AI 过度自信/过于泛化，不值得沉淀"——沿用字段原意，只修比较方向）
 *
 * 注意：原实现的比较方向恰好写反（批准高置信、拒绝低置信），
 * 且 approve/reject 可同时触发——此处一并修正。
 */
export function decideAutoAction(
  confidence: number,
  thresholds: { autoApproveBelow?: number; autoRejectAbove?: number }
): 'approve' | 'reject' | null {
  if (
    thresholds.autoRejectAbove !== undefined &&
    confidence > thresholds.autoRejectAbove
  ) {
    return 'reject';
  }
  if (
    thresholds.autoApproveBelow !== undefined &&
    confidence < thresholds.autoApproveBelow
  ) {
    return 'approve';
  }
  return null;
}
