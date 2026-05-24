#!/usr/bin/env node
/**
 * Newma Daemon - 沉淀系统和自主探索后台服务
 *
 * 独立运行沉淀系统和自主探索，不依赖 REPL
 */

import { PrecipitationCoordinator } from './memory/precipitation-coordinator';
import { AutonomousExplorer } from './agents/autonomous-explorer';
import { ExplorationLogManager } from './memory/exploration-log';
import { IssueTracker } from './memory/issue-tracker';
import { getPrecipitationConfig, getExplorationConfig, getDefaultConfig, NewmaConfig } from './config';
import path from 'path';

class NewmaDaemon {
  private coordinator?: PrecipitationCoordinator;
  private explorer?: AutonomousExplorer;
  private logManager?: ExplorationLogManager;
  private issueTracker?: IssueTracker;
  private running: boolean = false;
  private keepAliveTimer?: NodeJS.Timeout;

  constructor() {
    // 处理退出信号
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
  }

  async start(): Promise<void> {
    console.log('🚀 Starting Newma Daemon...\n');

    // 1. 获取配置
    const precipitationConfig = getPrecipitationConfig();
    const explorationConfig = getExplorationConfig();
    const config: NewmaConfig = {
      apiKey: process.env.OPENAI_API_KEY || '',
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      precipitation: precipitationConfig,
      exploration: explorationConfig,
    };

    // 2. 验证必要配置
    if (!config.apiKey) {
      console.error('❌ OPENAI_API_KEY is required!');
      console.log('Set it with: export OPENAI_API_KEY=your-key-here\n');
      process.exit(1);
    }

    // 3. 创建协调器
    const projectRoot = process.cwd();
    this.coordinator = new PrecipitationCoordinator(
      {
        projectRoot,
        precipitationConfig,
        explorationConfig,
        initOnStart: true,
      },
      config
    );

    // 4. 准备自主探索系统（如果启用）
    if (explorationConfig && explorationConfig.enabled !== false) {
      console.log('[Exploration] Preparing autonomous exploration system...');

      // 创建日志管理器
      this.logManager = new ExplorationLogManager({
        logDir: path.join(projectRoot, '.kode', 'exploration-logs'),
        retentionDays: explorationConfig.logRetentionDays || 30,
        maxLogSize: explorationConfig.maxLogSize || 100,
      });

      // 创建问题追踪器
      this.issueTracker = new IssueTracker({
        issuesDir: path.join(projectRoot, '.kode', 'issues'),
        retentionDays: 30,
      });

      // 创建探索器
      const runtimeConfig = getDefaultConfig(); // 获取完整运行时配置
      this.explorer = new AutonomousExplorer(
        runtimeConfig,
        {
          projectRoot,
          domains: (explorationConfig.domains || ['system_maintenance', 'code_analysis']) as any,
          maxActionsPerDomain: explorationConfig.maxActionsPerDomain || 3,
          timeout: explorationConfig.actionTimeout || 30000,
        },
        this.logManager
      );

      console.log('[Exploration] ✓ Autonomous exploration initialized\n');
    }

    // 5. 启动系统（沉淀系统和自主探索）
    await this.coordinator.start(
      async () => {
        // 沉淀系统回调
        console.log('[Precipitation] Running precipitation...');
      },
      this.explorer ? async () => {
        // 自主探索回调
        try {
          console.log('[Exploration] Running autonomous exploration...');
          const result = await this.explorer!.explore();
          await this.logManager!.logExploration(result);
          console.log('[Exploration] ✓ Exploration completed');

          // 提取并记录问题
          if (this.issueTracker) {
            console.log('[Issue Tracker] Analyzing exploration results for issues...');
            const issues = await this.issueTracker.extractIssues(result);

            if (issues.length > 0) {
              await this.issueTracker.recordIssues(issues);
              console.log(`[Issue Tracker] ✓ Found ${issues.length} issue(s)`);
              this.showIssuesSummary(issues);
            } else {
              console.log('[Issue Tracker] ✓ No new issues found');
            }
          }
        } catch (error: any) {
          console.error('[Exploration] ✗ Exploration failed:', error.message);
        }
      } : undefined
    );

    this.running = true;
    console.log('✅ Newma Daemon started successfully!\n');
    console.log(`📅 Precipitation Schedule: ${precipitationConfig?.schedule || '0 2 * * *'}`);
    if (explorationConfig && explorationConfig.schedule) {
      console.log(`🔍 Exploration Schedule: ${explorationConfig.schedule}`);
    }
    console.log(`📂 Project: ${projectRoot}\n`);

    this.showStatus();
    console.log('💡 Press Ctrl+C to stop\n');

    // 6. 保持进程运行
    this.keepAlive();
  }

  async shutdown(signal: string): Promise<void> {
    if (!this.running) return;

    console.log(`\n\n⚠️  Received ${signal}, shutting down gracefully...\n`);

    this.running = false;

    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = undefined;
    }

    if (this.coordinator) {
      await this.coordinator.stop();
      console.log('✅ Precipitation system stopped.\n');
    }

    console.log('✅ Newma Daemon stopped safely.\n');
    process.exit(0);
  }

  showStatus(): void {
    if (!this.coordinator) return;

    const status = this.coordinator.getStatus();
    console.log('⚙️  System Status:');
    console.log(`   Precipitation: ${status.scheduler.isRunning ? '🟢 Running' : '🔴 Stopped'}`);
    console.log(`   Exploration: ${this.explorer ? '🟢 Enabled' : '🔴 Disabled'}`);
    console.log(`   Next precipitation: ${status.scheduler.nextExecution?.toLocaleString() || 'N/A'}`);

    // 显示自主探索的下次执行时间
    if (this.explorer && status.scheduler.jobs) {
      const explorationJob = status.scheduler.jobs.find((j: any) => j.name === 'exploration');
      if (explorationJob?.nextRun) {
        console.log(`   Next exploration: ${explorationJob.nextRun.toLocaleString()}`);
      }
    }
    console.log('');
  }

  keepAlive(): void {
    // 防止进程退出
    // node-schedule 在后台运行
    this.keepAliveTimer = setInterval(async () => {
      try {
        if (this.running && this.coordinator) {
          // 可选：定期检查并显示待处理问题
          if (this.issueTracker) {
            const openIssues = await this.issueTracker.getOpenIssues();
            if (openIssues.length > 0) {
              console.log(`\n⚠️  Reminder: ${openIssues.length} open issue(s) waiting for fix`);
              console.log('Run: npx newma-cli /issues to see details\n');
            }
          }
        }
      } catch (error: any) {
        console.error(`[keepAlive] Error checking issues: ${error.message}`);
      }
    }, 300000); // 每5分钟检查一次
  }

  /**
   * 显示问题摘要
   */
  async showIssuesSummary(issues: any[]): Promise<void> {
    if (issues.length === 0) return;

    const bySeverity: Record<string, number> = {};
    for (const issue of issues) {
      bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
    }

    console.log('\n' + '='.repeat(60));
    console.log('📋 Issues Detected by Autonomous Exploration');
    console.log('='.repeat(60));
    console.log(`Total Issues: ${issues.length}`);

    for (const [severity, count] of Object.entries(bySeverity)) {
      console.log(`  ${severity.toUpperCase()}: ${count}`);
    }

    console.log('\n💡 Tip: These issues can be fixed by Claude Code');
    console.log('   Run: npx newma-cli /issues    (view all issues)');
    console.log('   Run: npx newma-cli /fix <id>  (fix an issue)');
    console.log('='.repeat(60) + '\n');
  }
}

// 启动守护进程
const daemon = new NewmaDaemon();
daemon.start().catch((error) => {
  console.error('❌ Failed to start daemon:', error);
  process.exit(1);
});
