/**
 * CLI Frontend Implementation
 *
 * 基于 readline 的命令行前端实现
 */

import readline from 'readline';
import chalk from 'chalk';
import {
  LoopFrontend,
  OutputStyle,
  LoopStatus,
  ProgressInfo,
  FrontendConfig
} from '../interfaces/frontend';

/**
 * CLI 前端配置
 */
export interface CliFrontendConfig extends FrontendConfig {
  /**
   * 提示符
   */
  prompt?: string;

  /**
   * 是否启用颜色
   */
  colors?: boolean;

  /**
   * 是否启用调试模式
   */
  debug?: boolean;

  /**
   * 输入流（默认为 process.stdin）
   */
  input?: NodeJS.ReadableStream;

  /**
   * 输出流（默认为 process.stdout）
   */
  output?: NodeJS.WritableStream;

  /**
   * 历史记录大小
   */
  historySize?: number;
}

/**
 * CLI 前端实现
 */
export class CliFrontend implements LoopFrontend {
  readonly type = 'cli' as const;

  private rl: readline.Interface;
  private config: Required<CliFrontendConfig>;
  private interruptHandler?: () => void;
  private isRunningFlag: boolean = false;
  private history: string[] = [];

  constructor(config: CliFrontendConfig = {}) {
    this.config = {
      prompt: config.prompt || '[newma] ❯ ',
      colors: config.colors !== false,
      debug: config.debug || false,
      input: config.input || process.stdin,
      output: config.output || process.stdout,
      historySize: config.historySize || 100,
    };

    // 创建 readline 接口
    this.rl = readline.createInterface({
      input: this.config.input,
      output: this.config.output,
      prompt: this.config.prompt,
      historySize: this.config.historySize,
    });

    // 移除 emoji 兼容性（根据项目配置）
    this.setupCompatibility();
  }

  /**
   * 设置兼容性
   */
  private setupCompatibility(): void {
    // 项目中已有 emoji 替换逻辑，这里保持一致
    // 如果需要，可以在这里添加额外处理
  }

  /**
   * 读取用户输入
   */
  async readInput(prompt?: string): Promise<string> {
    return new Promise((resolve) => {
      const actualPrompt = prompt || this.config.prompt;

      this.rl.question(actualPrompt, (answer) => {
        // 保存到历史
        this.history.push(answer.trim());

        // 限制历史大小
        if (this.history.length > this.config.historySize) {
          this.history.shift();
        }

        resolve(answer.trim());
      });
    });
  }

  /**
   * 输出内容
   */
  writeOutput(content: string, style: OutputStyle = OutputStyle.DEFAULT): void {
    if (!this.config.colors) {
      console.log(content);
      return;
    }

    switch (style) {
      case OutputStyle.SUCCESS:
        console.log(chalk.green(content));
        break;
      case OutputStyle.ERROR:
        console.log(chalk.red(content));
        break;
      case OutputStyle.WARNING:
        console.log(chalk.yellow(content));
        break;
      case OutputStyle.INFO:
        console.log(chalk.cyan(content));
        break;
      case OutputStyle.DEBUG:
        if (this.config.debug) {
          console.log(chalk.gray(content));
        }
        break;
      case OutputStyle.CODE:
        console.log(chalk.gray(content));
        break;
      case OutputStyle.DEFAULT:
      default:
        console.log(content);
        break;
    }
  }

  /**
   * 输出错误信息
   */
  writeError(content: string): void {
    this.writeOutput(content, OutputStyle.ERROR);
  }

  /**
   * 清空屏幕
   */
  clearScreen(): void {
    console.clear();
  }

  /**
   * 显示状态信息
   */
  showStatus(status: LoopStatus): void {
    const modeSymbols: Record<string, string> = {
      chat: '💬',
      plan: '📋',
      execute: '⚙️',
      verify: '✅',
      loop: '🔄',
    };

    const symbol = modeSymbols[status.mode] || '📌';
    const modeText = status.mode.toUpperCase();

    if (status.isRunning) {
      let statusText = `${symbol} ${modeText} Mode`;

      if (status.iteration !== undefined && status.maxIterations) {
        statusText += ` (${status.iteration}/${status.maxIterations})`;
      }

      this.writeOutput(statusText, OutputStyle.INFO);
    } else {
      this.writeOutput(`${symbol} ${modeText} Mode (Stopped)`, OutputStyle.WARNING);
    }
  }

  /**
   * 显示进度信息
   */
  showProgress(progress: ProgressInfo): void {
    let progressText = `⏳ ${progress.message}`;

    if (progress.percentage !== undefined) {
      progressText += ` (${progress.percentage}%)`;
    } else if (progress.current !== undefined && progress.total !== undefined) {
      progressText += ` (${progress.current}/${progress.total})`;
    }

    this.writeOutput(progressText, OutputStyle.INFO);
  }

  /**
   * 启动前端
   */
  async start(): Promise<void> {
    if (this.isRunningFlag) {
      return;
    }

    this.isRunningFlag = true;

    // 设置 SIGINT 处理
    this.rl.on('SIGINT', () => {
      if (this.interruptHandler) {
        this.interruptHandler();
      } else {
        this.writeOutput('\n按 Ctrl+C 再次退出', OutputStyle.WARNING);
      }
    });
  }

  /**
   * 停止前端
   */
  async stop(): Promise<void> {
    if (!this.isRunningFlag) {
      return;
    }

    this.isRunningFlag = false;
    this.rl.close();
  }

  /**
   * 检查前端是否正在运行
   */
  isRunning(): boolean {
    return this.isRunningFlag;
  }

  /**
   * 设置中断处理器
   */
  setInterruptHandler(handler: () => void): void {
    this.interruptHandler = handler;
  }

  /**
   * 设置提示符
   */
  setPrompt(prompt: string): void {
    this.config.prompt = prompt;
    this.rl.setPrompt(prompt);
  }

  /**
   * 获取历史记录
   */
  getHistory(): string[] {
    return [...this.history];
  }

  /**
   * 清空历史记录
   */
  clearHistory(): void {
    this.history = [];
  }
}
