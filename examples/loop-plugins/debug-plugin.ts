/**
 * Debug Loop Plugin
 *
 * 调试插件示例
 * 展示如何创建 Loop 插件来控制和监控执行流程
 */

import chalk from 'chalk';
import { LoopPlugin, LoopPluginContext, BeforeInputResult, AfterInputResult } from '../../src/loop/interfaces/plugin';
import { FlowResult } from '../../src/loop/interfaces/flow-controller';

/**
 * 调试插件
 *
 * 功能：
 * 1. 记录所有用户输入
 * 2. 记录所有处理结果
 * 3. 显示执行时长
 * 4. 统计命令使用情况
 */
export class DebugPlugin implements LoopPlugin {
  id = 'debug-loop-plugin';
  name = 'Debug Loop Plugin';
  description = 'Debug plugin for loop system';
  version = '1.0.0';
  type = 'loop' as const;

  // 插件统计
  private stats = {
    totalInputs: 0,
    commandCounts: new Map<string, number>(),
    modeChanges: 0,
    errors: 0,
  };

  // 插件配置
  config = {
    enabled: true,
    logInputs: true,
    logResults: true,
    showTiming: true,
  };

  // 工具和钩子（标准插件接口）
  tools = [];
  configSchema = undefined;
  dependencies = [];
  metadata = {
    author: 'Kode Team',
    license: 'MIT',
    homepage: 'https://github.com/kode-team/debug-plugin',
  };

  /**
   * 初始化插件
   */
  async initialize(context: any): Promise<void> {
    console.log(chalk.gray('[Debug Plugin] Initialized'));
  }

  /**
   * 清理插件
   */
  async cleanup(context: any): Promise<void> {
    this.printStats();
  }

  /**
   * 输入处理前钩子
   */
  async onBeforeInput(
    input: string,
    context: LoopPluginContext
  ): Promise<BeforeInputResult> {
    if (!this.config.enabled) {
      return { shouldContinue: true };
    }

    const startTime = Date.now();

    // 保存开始时间到上下文
    context.config._debugStartTime = startTime;

    if (this.config.logInputs) {
      console.log(chalk.gray(`[Debug] Input: "${input}"`));
    }

    // 统计命令
    if (input.startsWith('/')) {
      const command = input.split(/\s+/)[0];
      const count = this.stats.commandCounts.get(command) || 0;
      this.stats.commandCounts.set(command, count + 1);
    }

    this.stats.totalInputs++;

    return {
      shouldContinue: true,
    };
  }

  /**
   * 输入处理后钩子
   */
  async onAfterInput(
    result: FlowResult,
    context: LoopPluginContext
  ): Promise<AfterInputResult> {
    if (!this.config.enabled) {
      return { shouldContinue: true };
    }

    const startTime = context.config._debugStartTime;
    const duration = startTime ? Date.now() - startTime : 0;

    if (this.config.logResults) {
      console.log(
        chalk.gray(`[Debug] Result: type=${result.type}, `) +
        chalk.gray(`shouldContinue=${result.shouldContinue}`)
      );

      if (result.error) {
        console.log(chalk.red(`[Debug] Error: ${result.error}`));
        this.stats.errors++;
      }
    }

    if (this.config.showTiming && duration > 0) {
      const timingText = duration > 1000
        ? `${(duration / 1000).toFixed(2)}s`
        : `${duration}ms`;

      const color = duration > 5000 ? 'red' : duration > 1000 ? 'yellow' : 'gray';
      console.log(chalk[color](`[Debug] Timing: ${timingText}`));
    }

    return {
      shouldContinue: true,
    };
  }

  /**
   * 模式切换钩子
   */
  async onModeChange(
    oldMode: string,
    newMode: string,
    context: LoopPluginContext
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    this.stats.modeChanges++;

    console.log(
      chalk.cyan(`[Debug] Mode change: ${oldMode} → ${newMode}`)
    );
  }

  /**
   * 错误处理钩子
   */
  async onError(
    error: Error,
    context: LoopPluginContext
  ): Promise<boolean> {
    console.log(chalk.red(`[Debug] Error: ${error.message}`));
    console.log(chalk.gray(error.stack || ''));

    // 返回 true 表示错误已处理，不需要继续传播
    return false;
  }

  /**
   * 打印统计信息
   */
  private printStats(): void {
    console.log(chalk.cyan('\n📊 Debug Plugin Statistics'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(chalk.white('Total Inputs:   ') + chalk.yellow(this.stats.totalInputs.toString()));
    console.log(chalk.white('Mode Changes:   ') + chalk.yellow(this.stats.modeChanges.toString()));
    console.log(chalk.white('Errors:         ') + chalk.red(this.stats.errors.toString()));

    if (this.stats.commandCounts.size > 0) {
      console.log(chalk.white('\nCommand Usage:'));
      const sorted = Array.from(this.stats.commandCounts.entries())
        .sort((a, b) => b[1] - a[1]);

      for (const [cmd, count] of sorted) {
        console.log(`  ${chalk.white(cmd)}: ${chalk.yellow(count.toString())}`);
      }
    }

    console.log(chalk.cyan('═'.repeat(50)) + '\n');
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      commandCounts: Object.fromEntries(this.stats.commandCounts),
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalInputs: 0,
      commandCounts: new Map(),
      modeChanges: 0,
      errors: 0,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...updates };
  }
}

/**
 * 导出插件实例
 */
export default new DebugPlugin();
