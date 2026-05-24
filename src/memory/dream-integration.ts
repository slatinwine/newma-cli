/**
 * Dream 系统集成示例
 *
 * 展示如何将 DreamConsolidator 集成到现有的 precipitation-coordinator 中
 */

import { DreamConsolidator, DreamScheduler } from './dreamConsolidator';
import { PrecipitationCoordinator } from './precipitation-coordinator';
import { NewmaConfig } from '../config';

/**
 * 增强的沉淀协调器（集成 Dream 系统）
 */
export class EnhancedPrecipitationCoordinator extends PrecipitationCoordinator {
  private dreamConsolidator?: DreamConsolidator;
  private dreamScheduler?: DreamScheduler;

  constructor(
    options: any,
    newmaConfig: NewmaConfig
  ) {
    super(options, newmaConfig);

    // 初始化 Dream 整合器
    this.initializeDreamConsolidator(options.projectRoot);
  }

  /**
   * 初始化 Dream 整合器
   */
  private initializeDreamConsolidator(projectRoot: string): void {
    // 从配置中读取 Dream 配置
    const dreamConfig = (this as any).newmaConfig?.precipitation?.dream || {};

    this.dreamConsolidator = new DreamConsolidator(
      projectRoot,
      {
        enabled: dreamConfig.enabled !== false,
        minHours: dreamConfig.minHours || 24,
        minSessions: dreamConfig.minSessions || 5,
        maxTurns: dreamConfig.maxTurns || 30,
        triggerPrecipitation: true, // 整合后自动触发沉淀
      },
      (this as any).newmaConfig,
      this as any // 传入自己，以便 Dream 可以触发沉淀
    );

    console.log('[Enhanced Coordinator] Dream Consolidator initialized');
  }

  /**
   * 启动增强的沉淀系统
   */
  async start(
    precipitationCallback?: () => Promise<void>,
    explorationCallback?: () => Promise<void>
  ): Promise<void> {
    // 启动基础沉淀系统
    await super.start(precipitationCallback, explorationCallback);

    // 启动 Dream 调度器
    if (this.dreamConsolidator) {
      this.dreamScheduler = new DreamScheduler(this.dreamConsolidator);

      // 每 60 分钟检查一次是否需要整合
      this.dreamScheduler.start(60);

      console.log('[Enhanced Coordinator] Dream Scheduler started');
    }
  }

  /**
   * 停止增强的沉淀系统
   */
  async stop(): Promise<void> {
    // 停止 Dream 调度器
    if (this.dreamScheduler) {
      this.dreamScheduler.stop();
    }

    // 停止基础沉淀系统
    await super.stop();
  }

  /**
   * 手动触发 Dream 整合
   */
  async triggerDream(): Promise<any> {
    if (!this.dreamConsolidator) {
      throw new Error('Dream Consolidator not initialized');
    }

    console.log('[Enhanced Coordinator] 🌙 Manually triggering Dream consolidation...');
    return await this.dreamConsolidator.trigger();
  }

  /**
   * 获取 Dream 进度
   */
  getDreamProgress(): any {
    return this.dreamConsolidator?.getProgress();
  }

  /**
   * 获取完整状态（包括 Dream）
   */
  getEnhancedStatus(): any {
    const baseStatus = this.getStatus();

    return {
      ...baseStatus,
      dream: {
        config: this.dreamConsolidator?.getConfig(),
        progress: this.dreamConsolidator?.getProgress(),
        isConsolidating: this.dreamConsolidator?.isConsolidating(),
      },
    };
  }
}

/**
 * 使用示例
 */
export async function setupEnhancedPrecipitation(
  projectRoot: string,
  newmaConfig: NewmaConfig
): Promise<EnhancedPrecipitationCoordinator> {
  // 创建增强的协调器
  const coordinator = new EnhancedPrecipitationCoordinator(
    {
      projectRoot,
      precipitationConfig: {
        enabled: true,
        schedule: '0 2 * * *', // 每天凌晨 2 点
        confidenceThreshold: 0.6,
        maxDailySkills: 5,
      },
    },
    newmaConfig
  );

  // 启动系统
  await coordinator.start(
    // 沉淀回调（可选，协调器会自动处理）
    async () => {
      console.log('[Precipitation] Executing scheduled precipitation...');
    },
    // 探索回调（可选）
    undefined
  );

  console.log('[Setup] ✓ Enhanced precipitation system started');

  return coordinator;
}

/**
 * 配置示例
 */
export const dreamConfigExample = {
  precipitation: {
    // 基础沉淀配置
    enabled: true,
    schedule: '0 2 * * *',
    confidenceThreshold: 0.6,
    maxDailySkills: 5,

    // Dream 系统配置
    dream: {
      enabled: true,
      minHours: 24,           // 至少 24 小时间隔
      minSessions: 5,         // 至少 5 个新 session
      maxTurns: 30,           // 最多 30 轮整合
      lockFilePath: '.memo/dream/.consolidate-lock',
      memoryDir: '.memo/memory',
      sessionDir: '.kode/sessions',
      eventCooldownSeconds: 30,
      triggerPrecipitation: true,  // 整合后触发沉淀
    },
  },
};
