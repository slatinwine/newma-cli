/**
 * Memory Scheduler
 *
 * 定时任务调度器，用于管理记忆系统的定时任务
 */

import * as schedule from 'node-schedule';
import { PrecipitationConfig } from './types-precipitation';
import { ExplorationConfig } from './types-exploration';
import { logger } from '../logger';

/**
 * 定时任务类型
 */
type ScheduledJob = {
  name: string;
  job: schedule.Job;
  cronExpression: string;
  lastRun?: Date;
  nextRun?: Date;
};

/**
 * 调度器选项
 */
export interface SchedulerOptions {
  /** 配置 */
  config?: PrecipitationConfig;
  /** 探索配置 */
  explorationConfig?: ExplorationConfig;
  /** 是否在启动时立即执行一次 */
  runOnStart?: boolean;
  /** 时区（默认: 本地时区） */
  timeZone?: string;
}

/**
 * 调度器状态
 */
export interface SchedulerStatus {
  /** 是否运行中 */
  isRunning: boolean;
  /** 已注册的任务 */
  jobs: Array<{
    name: string;
    cronExpression: string;
    lastRun?: Date;
    nextRun?: Date;
  }>;
  /** 下次执行时间 */
  nextExecution?: Date;
}

/**
 * 内存调度器
 */
export class MemoryScheduler {
  private jobs: Map<string, ScheduledJob> = new Map();
  private precipitationJob?: schedule.Job;
  private explorationJob?: schedule.Job;
  private isRunningFlag: boolean = false;
  private config: PrecipitationConfig;
  private explorationConfig: ExplorationConfig;
  private retryTimeouts: NodeJS.Timeout[] = [];

  constructor(options: SchedulerOptions = {}) {
    this.config = options.config || {
      enabled: true,
      schedule: '0 2 * * *', // 默认凌晨 2 点
    };
    this.explorationConfig = options.explorationConfig || {
      enabled: true,
      schedule: '0 */4 * * *', // 默认每4小时
    };
  }

  /**
   * 启动调度器
   */
  start(
    precipitationCallback: () => Promise<void>,
    explorationCallback?: () => Promise<void>
  ): Promise<void> {
    if (this.isRunningFlag) {
      logger.warn('[Scheduler] Already running');
      return Promise.resolve();
    }

    this.isRunningFlag = true;
    logger.info('[Scheduler] Starting memory scheduler...');

    // 注册经验沉淀任务
    if (this.config.enabled !== false) {
      this.schedulePrecipitation(precipitationCallback);
    }

    // 注册自主探索任务
    if (this.explorationConfig.enabled !== false && explorationCallback) {
      this.scheduleExploration(explorationCallback);
    }

    logger.info('[Scheduler] ✓ Scheduler started');
    return Promise.resolve();
  }

  /**
   * 停止调度器
   */
  stop(): void {
    if (!this.isRunningFlag) {
      logger.warn('[Scheduler] Not running');
      return;
    }

    logger.info('[Scheduler] Stopping scheduler...');

    // 清理所有重试超时
    for (const timeout of this.retryTimeouts) {
      clearTimeout(timeout);
    }
    this.retryTimeouts = [];

    // 取消所有任务
    this.jobs.forEach((scheduledJob) => {
      scheduledJob.job.cancel();
    });

    if (this.precipitationJob) {
      this.precipitationJob.cancel();
      this.precipitationJob = undefined;
    }

    if (this.explorationJob) {
      this.explorationJob.cancel();
      this.explorationJob = undefined;
    }

    this.jobs.clear();
    this.isRunningFlag = false;

    logger.info('[Scheduler] ✓ Scheduler stopped');
  }

  /**
   * 调度经验沉淀任务
   */
  schedulePrecipitation(callback: () => Promise<void>): void {
    const cronExpression = this.config.schedule || '0 2 * * *';

    logger.info(`[Scheduler] Scheduling precipitation job: ${cronExpression}`);

    // 创建定时任务
    this.precipitationJob = schedule.scheduleJob(
      cronExpression,
      async () => {
        await this.executePrecipitation(callback);
      }
    );

    // 记录任务信息
    const jobName = 'precipitation';
    this.jobs.set(jobName, {
      name: jobName,
      job: this.precipitationJob,
      cronExpression,
      nextRun: this.precipitationJob.nextInvocation() || undefined,
    });

    logger.info(`[Scheduler] ✓ Next precipitation: ${this.formatDate(this.precipitationJob.nextInvocation() || undefined)}`);
  }

  /**
   * 执行经验沉淀任务
   */
  private async executePrecipitation(callback: () => Promise<void>): Promise<void> {
    const jobName = 'precipitation';
    const startTime = new Date();

    logger.info(`[Scheduler] ⏰ Executing precipitation job at ${this.formatDate(startTime)}`);

    try {
      // 执行回调
      await callback();

      // 更新最后执行时间
      const scheduledJob = this.jobs.get(jobName);
      if (scheduledJob && this.precipitationJob) {
        scheduledJob.lastRun = startTime;
        scheduledJob.nextRun = this.precipitationJob.nextInvocation() || undefined;
      }

      logger.info('[Scheduler] ✓ Precipitation completed');
    } catch (error: any) {
      logger.error(`[Scheduler] ✗ Precipitation failed: ${error.message}`);

      // 失败重试：1 小时后重试
      logger.info('[Scheduler] ⚠ Scheduling retry in 1 hour...');

      const retryTimeout = setTimeout(async () => {
        try {
          logger.info('[Scheduler] 🔄 Retrying precipitation...');
          await callback();
          logger.info('[Scheduler] ✓ Retry succeeded');
        } catch (retryError: any) {
          logger.error(`[Scheduler] ✗ Retry failed: ${retryError.message}`);
        }
      }, 60 * 60 * 1000); // 1 小时
      this.retryTimeouts.push(retryTimeout);
    }
  }

  /**
   * 手动触发经验沉淀
   */
  async triggerPrecipitation(callback: () => Promise<void>): Promise<void> {
    if (!this.isRunningFlag) {
      throw new Error('Scheduler is not running');
    }

    logger.info('[Scheduler] 🔹 Manually triggering precipitation...');

    await this.executePrecipitation(callback);
  }

  /**
   * 调度自主探索任务
   */
  scheduleExploration(callback: () => Promise<void>): void {
    const cronExpression = this.explorationConfig.schedule || '0 */4 * * *';

    logger.info(`[Scheduler] Scheduling exploration job: ${cronExpression}`);

    // 创建定时任务
    this.explorationJob = schedule.scheduleJob(cronExpression, async () => {
      await this.executeExploration(callback);
    });

    // 记录任务信息
    const jobName = 'exploration';
    this.jobs.set(jobName, {
      name: jobName,
      job: this.explorationJob,
      cronExpression,
      nextRun: this.explorationJob.nextInvocation() || undefined,
    });

    logger.info(
      `[Scheduler] ✓ Next exploration: ${this.formatDate(this.explorationJob.nextInvocation() || undefined)}`
    );
  }

  /**
   * 执行自主探索任务
   */
  private async executeExploration(callback: () => Promise<void>): Promise<void> {
    const jobName = 'exploration';
    const startTime = new Date();

    logger.info(`[Scheduler] ⏰ Executing exploration job at ${this.formatDate(startTime)}`);

    try {
      // 执行回调
      await callback();

      // 更新最后执行时间
      const scheduledJob = this.jobs.get(jobName);
      if (scheduledJob && this.explorationJob) {
        scheduledJob.lastRun = startTime;
        scheduledJob.nextRun = this.explorationJob.nextInvocation() || undefined;
      }

      logger.info('[Scheduler] ✓ Exploration completed');
    } catch (error: any) {
      logger.error(`[Scheduler] ✗ Exploration failed: ${error.message}`);

      // 失败重试：30分钟后重试
      logger.info('[Scheduler] ⚠ Scheduling retry in 30 minutes...');

      const retryTimeout = setTimeout(async () => {
        try {
          logger.info('[Scheduler] 🔄 Retrying exploration...');
          await callback();
          logger.info('[Scheduler] ✓ Retry succeeded');
        } catch (retryError: any) {
          logger.error(`[Scheduler] ✗ Retry failed: ${retryError.message}`);
        }
      }, 30 * 60 * 1000); // 30分钟
      this.retryTimeouts.push(retryTimeout);
    }
  }

  /**
   * 手动触发自主探索
   */
  async triggerExploration(callback: () => Promise<void>): Promise<void> {
    if (!this.isRunningFlag) {
      throw new Error('Scheduler is not running');
    }

    logger.info('[Scheduler] 🔹 Manually triggering exploration...');

    await this.executeExploration(callback);
  }

  /**
   * 更新调度配置
   */
  updateSchedule(cronExpression: string): void {
    if (!this.precipitationJob) {
      throw new Error('Precipitation job not scheduled');
    }

    logger.info(`[Scheduler] Updating schedule: ${cronExpression}`);

    // 取消旧任务
    this.precipitationJob.cancel();

    // 重新调度
    const scheduledJob = this.jobs.get('precipitation');
    if (scheduledJob) {
      // 注意：这里需要重新调用 schedulePrecipitation，而不是直接重新调度
      // 因为我们没有保存 callback 引用
      throw new Error('Cannot reschedule without restarting. Use restart() instead.');
    }
  }

  /**
   * 获取调度器状态
   */
  getStatus(): SchedulerStatus {
    const jobsList = Array.from(this.jobs.values()).map((scheduledJob) => ({
      name: scheduledJob.name,
      cronExpression: scheduledJob.cronExpression,
      lastRun: scheduledJob.lastRun,
      nextRun: scheduledJob.nextRun,
    }));

    const nextExecution = this.precipitationJob?.nextInvocation() || undefined;

    return {
      isRunning: this.isRunningFlag,
      jobs: jobsList,
      nextExecution,
    };
  }

  /**
   * 是否运行中
   */
  isRunning(): boolean {
    return this.isRunningFlag;
  }

  /**
   * 获取下次执行时间
   */
  getNextExecution(): Date | undefined {
    // 返回最早的那个任务
    const precipitationNext = this.precipitationJob?.nextInvocation();
    const explorationNext = this.explorationJob?.nextInvocation();

    if (!precipitationNext) return explorationNext || undefined;
    if (!explorationNext) return precipitationNext || undefined;

    return precipitationNext < explorationNext ? precipitationNext : explorationNext;
  }

  /**
   * 格式化日期
   */
  private formatDate(date?: Date): string {
    if (!date) return 'N/A';
    return date.toISOString();
  }

  /**
   * 验证 Cron 表达式
   */
  static validateCronExpression(cronExpression: string): boolean {
    try {
      schedule.scheduleJob(cronExpression, () => {});
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 解析 Cron 表达式（返回人类可读描述）
   */
  static describeCronExpression(cronExpression: string): string {
    // 简单的描述性解析
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) {
      return 'Invalid cron expression';
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    if (minute === '0' && hour === '2' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return '每天凌晨 2:00';
    }

    if (minute === '0' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return '每小时整点';
    }

    if (minute === '0' && hour === '0' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return '每天凌晨 0:00';
    }

    return cronExpression; // 返回原始表达式
  }
}
