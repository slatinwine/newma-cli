/**
 * Loop Engine
 *
 * 核心循环引擎，协调前端、流程控制器和会话管理
 */

import { LoopFrontend } from '../interfaces/frontend';
import { FlowController, FlowResult } from '../interfaces/flow-controller';
import { LoopSession, LoopSessionOptions } from '../interfaces/session';
import { CommandManager } from '../commands/command-manager';
import { CorePluginCommands } from '../plugins/core-plugin';
import { LoopPluginManagerImpl } from './loop-plugin-manager';
import { LoopPlugin } from '../interfaces/plugin';
import { MarkdownPluginScanner, loadMarkdownPluginAsCommand } from '../loaders/python-plugin-loader';
import { resolve } from 'path';

/**
 * Loop 引擎配置
 */
export interface LoopEngineConfig {
  /**
   * 前端
   */
  frontend: LoopFrontend;

  /**
   * 会话选项
   */
  sessionOptions?: LoopSessionOptions;

  /**
   * 是否启用命令系统
   */
  enableCommands?: boolean;

  /**
   * 是否启用插件系统
   */
  enablePlugins?: boolean;

  /**
   * 最大重定向次数
   */
  maxRedirects?: number;
}

/**
 * Loop 引擎
 *
 * 核心循环引擎，负责：
 * 1. 管理前端交互
 * 2. 协调流程控制器
 * 3. 管理会话状态
 * 4. 处理命令执行
 * 5. 管理插件系统
 */
export class LoopEngine {
  private frontend: LoopFrontend;
  private session: LoopSession;
  private flowController: FlowController;
  private commandManager: CommandManager;
  private pluginManager: LoopPluginManagerImpl;
  private isRunning: boolean = false;
  private redirectCount: number = 0;
  private config: Required<LoopEngineConfig>;

  constructor(
    frontend: LoopFrontend,
    flowController: FlowController,
    session: LoopSession,
    config: LoopEngineConfig
  ) {
    this.frontend = frontend;
    this.session = session;
    this.flowController = flowController;
    this.config = {
      frontend,
      sessionOptions: config.sessionOptions || {},
      enableCommands: config.enableCommands !== false,
      enablePlugins: config.enablePlugins !== false,
      maxRedirects: config.maxRedirects || 10,
    };

    // 创建插件管理器
    this.pluginManager = new LoopPluginManagerImpl();

    // 创建命令管理器
    this.commandManager = new CommandManager();

    // 注册核心命令
    if (this.config.enableCommands) {
      this.registerCoreCommands();
    }
  }

  /**
   * 注册核心命令
   */
  private registerCoreCommands(): void {
    const commands = CorePluginCommands.getAllCommands(this.commandManager);
    for (const cmd of commands) {
      this.commandManager.register(cmd, 'core');
    }
  }

  /**
   * 启动 Loop 引擎
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // 启动会话
    await this.session.start();

    // 启动前端
    await this.frontend.start();

    // 设置中断处理
    this.frontend.setInterruptHandler(() => {
      this.session.abortCurrent();
    });

    // 进入主循环
    await this.mainLoop();
  }

  /**
   * 停止 Loop 引擎
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // 停止会话
    await this.session.stop();

    // 停止前端
    await this.frontend.stop();
  }

  /**
   * 主循环
   */
  private async mainLoop(): Promise<void> {
    while (this.isRunning && this.frontend.isRunning()) {
      try {
        // 读取用户输入
        const input = await this.frontend.readInput();

        // 检查是否为空
        if (!input.trim()) {
          continue;
        }

        // 处理输入
        const result = await this.processInput(input);

        // 检查是否应该退出
        if (result.metadata?.exit) {
          await this.stop();
          break;
        }

        // 重置重定向计数
        this.redirectCount = 0;
      } catch (error: any) {
        this.frontend.writeError(`Error: ${error.message}`);

        // 如果是严重错误，停止循环
        if (error.fatal) {
          await this.stop();
          break;
        }
      }
    }
  }

  /**
   * 处理输入
   */
  private async processInput(input: string): Promise<FlowResult> {
    // 预处理输入
    const preprocessResult = await this.flowController.preprocessInput(input);

    // 检查是否应该跳过
    if (preprocessResult.shouldSkip) {
      return {
        type: 'skip',
        data: null,
        shouldContinue: true,
      };
    }

    // 检查是否应该重定向
    if (preprocessResult.redirectTo) {
      this.redirectCount++;

      // 防止无限重定向
      if (this.redirectCount > this.config.maxRedirects) {
        this.frontend.writeError('Too many redirects, stopping');
        return {
          type: 'skip',
          data: null,
          shouldContinue: false,
        };
      }

      return await this.processInput(preprocessResult.redirectTo);
    }

    // 使用处理后的输入
    const actualInput = preprocessResult.modifiedInput || input;

    // 处理输入
    let result = await this.flowController.processInput(actualInput);

    // 后处理结果
    result = await this.flowController.postprocessResult(result, input);

    return result;
  }

  /**
   * 处理命令
   */
  private async processCommand(cmd: string, args: string[]): Promise<FlowResult> {
    const result = await this.commandManager.execute(cmd, args, {
      session: this.session,
      rawInput: `/${cmd} ${args.join(' ')}`,
    });

    return {
      type: 'command',
      data: result,
      shouldContinue: !result.metadata?.exit,
    };
  }

  /**
   * 获取命令管理器
   */
  getCommandManager(): CommandManager {
    return this.commandManager;
  }

  /**
   * 获取会话
   */
  getSession(): LoopSession {
    return this.session;
  }

  /**
   * 获取前端
   */
  getFrontend(): LoopFrontend {
    return this.frontend;
  }

  /**
   * 检查是否正在运行
   */
  isEngineRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 获取插件管理器
   */
  getPluginManager(): LoopPluginManagerImpl {
    return this.pluginManager;
  }

  /**
   * 设置插件管理器
   * 用于外部创建的 pluginManager
   */
  setPluginManager(pluginManager: LoopPluginManagerImpl): void {
    this.pluginManager = pluginManager;
  }

  /**
   * 注册插件
   */
  registerPlugin(plugin: LoopPlugin): void {
    if (!this.config.enablePlugins) {
      throw new Error('Plugins are not enabled in this LoopEngine');
    }
    this.pluginManager.registerLoopPlugin(plugin);
  }

  /**
   * 注销插件
   */
  unregisterPlugin(pluginId: string): void {
    this.pluginManager.unregisterLoopPlugin(pluginId);
  }

  /**
   * 加载 Markdown 插件目录
   */
  async loadMarkdownPlugins(directory: string): Promise<void> {
    if (!this.config.enablePlugins) {
      throw new Error('Plugins are not enabled in this LoopEngine');
    }

    const scanner = new MarkdownPluginScanner();
    const commands = await scanner.loadCommandsFromDirectory(directory);

    for (const command of commands) {
      this.commandManager.register(command, 'markdown-plugin');
    }

    console.log(`Loaded ${commands.length} Markdown plugins from ${directory}`);
  }

  /**
   * 加载单个 Markdown 插件
   */
  async loadMarkdownPlugin(pluginPath: string): Promise<void> {
    if (!this.config.enablePlugins) {
      throw new Error('Plugins are not enabled in this LoopEngine');
    }

    const command = await loadMarkdownPluginAsCommand(pluginPath);
    this.commandManager.register(command, 'markdown-plugin');
    console.log(`Loaded Markdown plugin: ${command.name}`);
  }
}
