/**
 * TUI (Terminal User Interface) Frontend
 *
 * Full-screen terminal interface with multiple panels
 */

import blessed from 'blessed';
import { LoopFrontend, OutputStyle } from '../interfaces/frontend';
import { LoopStatus, ProgressInfo, FrontendConfig } from '../interfaces/frontend';

/**
 * TUI Frontend 配置
 */
export interface TuiFrontendConfig {
  prompt?: string;
  mouse?: boolean;
  debug?: boolean;
  colors?: {
    primary?: string;
    secondary?: string;
    success?: string;
    error?: string;
    warning?: string;
  };
}

/**
 * TUI Frontend 实现
 */
export class TuiFrontend implements LoopFrontend {
  readonly type = 'tui' as const;

  private screen: any;
  private config: TuiFrontendConfig;
  private isRunningFlag: boolean = false;
  private inputHandler: ((input: string) => void) | null = null;

  // UI Components
  private headerBox!: any;
  private outputBox!: any;
  private inputBox!: any;
  private statusBar!: any;
  private sidePanel!: any;

  constructor(config: TuiFrontendConfig = {}) {
    this.config = {
      prompt: config.prompt || '[newma] ❯ ',
      mouse: config.mouse || false,
      debug: config.debug || false,
      colors: {
        primary: config.colors?.primary || 'blue',
        secondary: config.colors?.secondary || 'cyan',
        success: config.colors?.success || 'green',
        error: config.colors?.error || 'red',
        warning: config.colors?.warning || 'yellow',
      },
    };

    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Kode AI Assistant',
      fullUnicode: true,
      mouse: this.config.mouse,
    } as any);

    this.createUI();
    this.setupKeyBindings();
  }

  private createUI(): void {
    // Claude-style 风格配色：柔和的灰色系
    const colors = this.config.colors || {
      primary: 'white',
      secondary: 'gray',
      success: 'green',
      error: 'red',
      warning: 'yellow',
    };

    // 简洁的头部 - 细线分隔
    this.headerBox = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 2,
      content: ' {bold}{white-fg}Kode{/white-fg}{/bold} {gray-fg}AI Assistant{/gray-fg} ',
      tags: true,
      style: {
        bg: '#1a1a1a',
        fg: '#e0e0e0',
      },
    } as any);

    // 侧边栏 - 状态信息，细边框
    this.sidePanel = blessed.box({
      top: 2,
      left: 0,
      width: '25%' as any,
      height: '100%-5' as any,
      border: {
        type: 'line',
        fg: '#333333' as any,
      },
      style: {
        border: { fg: '#333333' as any },
        fg: '#a0a0a0',
        bg: '#0d0d0d',
      } as any,
      scrollable: true,
    } as any);

    // 主输出区 - 无边框，使用空白分隔
    this.outputBox = blessed.box({
      top: 2,
      left: '25%' as any,
      width: '75%' as any,
      height: '100%-5' as any,
      border: {
        type: 'line',
        fg: '#333333' as any,
      },
      style: {
        border: { fg: '#333333' as any },
        fg: '#e0e0e0',
        bg: '#0d0d0d',
      } as any,
      scrollable: true,
      alwaysScroll: true,
      tags: true,
      padding: { left: 1, right: 1 },
    } as any);

    // 输入框 - 简洁设计
    this.inputBox = blessed.textbox({
      bottom: 2,
      left: 1,
      height: 3,
      width: '100%-2' as any,
      inputOnFocus: true,
      style: {
        fg: '#e0e0e0',
        bg: '#1a1a1a',
        border: { fg: '#333333' },
      },
      label: ' {gray-fg}›{/gray-fg} ',
      tags: true,
    } as any);

    // 状态栏 - 细线分隔，低调显示
    this.statusBar = blessed.box({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 2,
      content: ' {gray-fg}Ctrl+C: Exit{/gray-fg}  {gray-fg}Ctrl+L: Clear{/gray-fg}  {gray-fg}Enter: Submit{/gray-fg} ',
      tags: true,
      style: {
        bg: '#1a1a1a',
        fg: '#606060',
      },
    } as any);

    this.screen.append(this.headerBox);
    this.screen.append(this.sidePanel);
    this.screen.append(this.outputBox);
    this.screen.append(this.inputBox);
    this.screen.append(this.statusBar);

    this.inputBox.focus();
  }

  private setupKeyBindings(): void {
    this.screen.key(['C-c'], () => {
      if (this.inputHandler) {
        this.inputHandler(String.fromCharCode(3));
      } else {
        process.exit(0);
      }
    });

    this.screen.key(['C-l'], () => {
      this.outputBox.setContent('');
      this.screen.render();
    });

    this.inputBox.key('enter', () => {
      const input = this.inputBox.getValue();
      if (input && this.inputHandler) {
        this.inputHandler(input);
      }
      this.inputBox.clearValue();
      this.screen.render();
    });
  }

  async start(): Promise<void> {
    if (this.isRunningFlag) {
      return;
    }
    this.isRunningFlag = true;
    this.screen.render();
  }

  async stop(): Promise<void> {
    if (!this.isRunningFlag) {
      return;
    }
    this.isRunningFlag = false;
    this.screen.destroy();
  }

  isRunning(): boolean {
    return this.isRunningFlag;
  }

  async readInput(_prompt?: string): Promise<string> {
    return new Promise((resolve) => {
      this.inputHandler = (input: string) => {
        resolve(input);
      };
    });
  }

  writeOutput(content: string, style: OutputStyle = OutputStyle.DEFAULT): void {
    let formattedContent = content;

    // Claude-style 柔和配色方案
    switch (style) {
      case OutputStyle.SUCCESS:
        // 柔和的绿色
        formattedContent = `{#7ec850-fg}${content}{/#7ec850-fg}`;
        break;
      case OutputStyle.ERROR:
        // 柔和的红色，不过于刺眼
        formattedContent = `{#ff6b6b-fg}${content}{/#ff6b6b-fg}`;
        break;
      case OutputStyle.WARNING:
        // 柔和的黄色/橙色
        formattedContent = `{#ffa500-fg}${content}{/#ffa500-fg}`;
        break;
      case OutputStyle.INFO:
        // 柔和的蓝色
        formattedContent = `{#64b5f6-fg}${content}{/#64b5f6-fg}`;
        break;
      case OutputStyle.DEBUG:
        if (!this.config.debug) return;
        // 深灰色用于调试信息
        formattedContent = `{#606060-fg}[DEBUG] ${content}{/#606060-fg}`;
        break;
      case OutputStyle.CODE:
        // 代码使用稍微亮一点的灰色
        formattedContent = `{#c0c0c0-fg}${content}{/#c0c0c0-fg}`;
        break;
      default:
        // 默认使用柔和的白色
        formattedContent = `{#e0e0e0-fg}${content}{/#e0e0e0-fg}`;
    }

    const currentContent = this.outputBox.getContent() || '';
    this.outputBox.setContent(currentContent + '\n' + formattedContent);
    this.outputBox.setScrollPerc(100);
    this.screen.render();
  }

  writeError(content: string): void {
    this.writeOutput(content, OutputStyle.ERROR);
  }

  clearScreen(): void {
    this.outputBox.setContent('');
    this.sidePanel.setContent('');
    this.screen.render();
  }

  showStatus(status: LoopStatus): void {
    // Claude-style 柔和色调的状态显示
    const modeColors: Record<string, string> = {
      chat: '#64b5f6',    // 柔和的蓝色
      plan: '#ba68c8',    // 柔和的紫色
      execute: '#7ec850', // 柔和的绿色
      verify: '#ffa726',  // 柔和的橙色
      loop: '#4dd0e1',    // 柔和的青色
    };

    const color = modeColors[status.mode] || '#e0e0e0';
    let statusText = `{${color}-fg}{bold}${status.mode.toUpperCase()}{/bold}{/${color}-fg}\n`;

    if (status.isRunning && status.iteration !== undefined && status.maxIterations) {
      statusText += `\n{#a0a0a0-fg}Iteration: {${color}-fg}${status.iteration}{/${color}-fg} / {#a0a0a0-fg}${status.maxIterations}{/#a0a0a0-fg}{/#a0a0a0-fg}`;
    }

    this.sidePanel.setContent(statusText);
    this.screen.render();
  }

  showProgress(progress: ProgressInfo): void {
    // Claude-style 简洁的进度条
    let progressText = `{#e0e0e0-fg}${progress.message}{/#e0e0e0-fg}\n`;

    if (progress.percentage !== undefined) {
      const filled = Math.floor(progress.percentage / 5);
      const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
      progressText += `\n{#7ec850-fg}${bar}{/#7ec850-fg} {#a0a0a0-fg}${progress.percentage}%{/#a0a0a0-fg}`;
    }

    this.sidePanel.setContent(progressText);
    this.screen.render();
  }

  setInterruptHandler(handler: () => void): void {
    this.screen.key(['C-c'], () => {
      handler();
    });
  }

  setPrompt(_prompt: string): void {
    // TUI doesn't use prompts
  }
}
