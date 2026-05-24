/**
 * Shortcut Plugin
 *
 * 展示如何创建输入预处理插件
 * 添加快捷键和自动替换功能
 */

import chalk from 'chalk';
import { LoopPlugin, LoopPluginContext, BeforeInputResult } from '../../src/loop/interfaces/plugin';

/**
 * 快捷键插件
 *
 * 功能：
 * 1. 快捷命令：! 自动转换为 /plan
 * 2. 快捷命令：?? 自动转换为 /help
 * 3. 自动纠正：常见拼写错误
 * 4. 快捷方式：缩写自动展开
 */
export class ShortcutPlugin implements LoopPlugin {
  id = 'shortcut-plugin';
  name = 'Shortcut Plugin';
  description = 'Keyboard shortcuts and auto-correction';
  version = '1.0.0';
  type = 'loop' as const;

  tools = [];
  config = {
    enabled: true,
    shortcuts: {
      '!': '/plan ',
      '??': '/help',
      'h': '/history',
      's': '/status',
      'c': '/clear',
    },
    autoCorrect: {
      'clea': '/clear',
      'hel': '/help',
      'his': '/history',
      'stat': '/status',
      'exi': '/exit',
    },
  };

  configSchema = undefined;
  dependencies = [];
  metadata = {
    author: 'Kode Team',
    license: 'MIT',
  };

  private stats = {
    shortcutsUsed: 0,
    autoCorrections: 0,
  };

  async initialize(context: any): Promise<void> {
    console.log(chalk.gray('[Shortcut Plugin] Initialized'));
    console.log(chalk.gray('  Shortcuts: ! → /plan, ?? → /help'));
  }

  async cleanup(context: any): Promise<void> {
    console.log(chalk.gray('[Shortcut Plugin] Stats:'));
    console.log(chalk.gray(`  Shortcuts used: ${this.stats.shortcutsUsed}`));
    console.log(chalk.gray(`  Auto-corrections: ${this.stats.autoCorrections}`));
  }

  /**
   * 输入前钩子 - 处理快捷键和自动纠正
   */
  async onBeforeInput(
    input: string,
    context: LoopPluginContext
  ): Promise<BeforeInputResult> {
    if (!this.config.enabled) {
      return { shouldContinue: true };
    }

    let modifiedInput = input;
    let wasModified = false;

    // 1. 检查快捷键
    for (const [shortcut, replacement] of Object.entries(this.config.shortcuts)) {
      if (input.startsWith(shortcut)) {
        modifiedInput = input.replace(shortcut, replacement);
        wasModified = true;
        this.stats.shortcutsUsed++;

        console.log(chalk.gray(`[Shortcut] ${shortcut} → ${replacement}`));

        return {
          shouldContinue: true,
          modifiedInput,
        };
      }
    }

    // 2. 检查自动纠正
    for (const [wrong, correct] of Object.entries(this.config.autoCorrect)) {
      // 检查是否以错误拼写开头
      if (input.toLowerCase().startsWith(wrong.toLowerCase())) {
        modifiedInput = input.substring(wrong.length);
        modifiedInput = correct + ' ' + modifiedInput;
        wasModified = true;
        this.stats.autoCorrections++;

        console.log(chalk.yellow(`[Auto-correct] ${wrong} → ${correct}`));

        return {
          shouldContinue: true,
          modifiedInput,
        };
      }
    }

    // 3. 特殊：! 作为前缀（不在开头）
    if (input.includes('!')) {
      modifiedInput = input.replace(/!/g, '/plan ');
      wasModified = true;
      this.stats.shortcutsUsed++;

      console.log(chalk.gray(`[Shortcut] ! → /plan`));

      return {
        shouldContinue: true,
        modifiedInput,
      };
    }

    return {
      shouldContinue: true,
      modifiedInput: wasModified ? modifiedInput : undefined,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * 添加快捷键
   */
  addShortcut(shortcut: string, replacement: string): void {
    this.config.shortcuts[shortcut] = replacement;
  }

  /**
   * 移除快捷键
   */
  removeShortcut(shortcut: string): void {
    delete this.config.shortcuts[shortcut];
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      shortcutsUsed: 0,
      autoCorrections: 0,
    };
  }
}

/**
 * 导出插件实例
 */
export default new ShortcutPlugin();
