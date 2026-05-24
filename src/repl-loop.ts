/**
 * Loop REPL Manager
 *
 * 基于 Loop 引擎的 REPL 实现
 * 集成了插件化架构、前端抽象和流控制
 */

import path from 'path';
import chalk from 'chalk';
import { SessionManager } from './session';
import { LoopEngine } from './loop/core/loop-engine';
import { CliFrontend } from './loop/frontends/cli-frontend';
import { AIFlowController } from './loop/core/ai-flow-controller';
import { LoopSessionManagerAdapter } from './loop/core/session-adapter';
import { CommandManager } from './loop/commands/command-manager';
import { CorePluginCommands } from './loop/plugins/core-plugin';
import { EventSourceCommands } from './loop/plugins/event-source-commands';
import { EventSourceManager } from './loop/event/event-source-manager';
import { TaskCommands } from './task-tracker/commands';
import { TaskDisplay } from './task-tracker/display';

/**
 * Loop REPL 选项
 */
export interface LoopREPLOptions {
  debug?: boolean;
  enablePlugins?: boolean;
}

/**
 * Loop REPL 管理器
 */
export class LoopREPLManager {
  private session: SessionManager;
  private engine: LoopEngine;
  private options: LoopREPLOptions;
  private eventSourceManager: EventSourceManager;

  constructor(session: SessionManager, options: LoopREPLOptions = {}) {
    this.session = session;
    this.options = {
      debug: options.debug || false,
      enablePlugins: options.enablePlugins !== false,
    };

    // 创建 Event Source Manager
    this.eventSourceManager = new EventSourceManager({
      maxSources: 10,
      debug: this.options.debug,
    });

    // 创建 Loop 组件
    this.engine = this.createLoopEngine();
  }

  /**
   * 创建 Loop 引擎
   */
  private createLoopEngine(): LoopEngine {
    // 1. 创建 CLI Frontend
    const projectName = path.basename(this.session.getProjectRoot());
    const frontend = new CliFrontend({
      prompt: `[${projectName}] (loop) ❯ `,
      colors: true,
      debug: this.options.debug,
      historySize: 100,
    });

    // 2. 创建 Loop Session Adapter
    const { HookSystem } = require('./hooks');
    const { LoopSessionManagerAdapter } = require('./loop/core/session-adapter');
    const hookSystem = new HookSystem({ enabled: false });
    const loopSession = new LoopSessionManagerAdapter(
      this.session,
      frontend,
      hookSystem,
      {
        maxIterations: 3,
      }
    );

    // 3. 创建 Command Manager
    const commandManager = new CommandManager();

    // 注册核心命令
    const coreCommands = CorePluginCommands.getAllCommands(commandManager);
    coreCommands.forEach(cmd => {
      commandManager.register(cmd, 'core');
    });

    // 注册事件源命令
    const eventSourceCommands = EventSourceCommands.getAllCommands(this.eventSourceManager);
    eventSourceCommands.forEach(cmd => {
      commandManager.register(cmd, 'event-sources');
    });

    // 注册任务命令
    const taskTracker = this.session.getTaskTracker();
    const taskDisplay = new TaskDisplay();
    const taskCommands = new TaskCommands(taskTracker, taskDisplay);

    // /tasks - 列出所有任务
    commandManager.register({
      name: 'tasks',
      description: 'List all tasks',
      handler: async (context: any) => {
        await taskCommands.handleListTasks(context.args || []);
        return { success: true };
      }
    }, 'tasks');

    // /task <id> - 查看任务详情
    commandManager.register({
      name: 'task',
      description: 'View task details',
      handler: async (context: any) => {
        await taskCommands.handleViewTask(context.args || []);
        return { success: true };
      }
    }, 'tasks');

    // 4. 创建 Loop Plugin Manager（独立于 LoopEngine）
    const { LoopPluginManagerImpl } = require('./loop/core/loop-plugin-manager');
    const pluginManager = new LoopPluginManagerImpl();

    // 5. 注册 TaskLifecyclePlugin（如果启用）
    if (this.options.enablePlugins) {
      const taskPlugin = this.session.getTaskLifecyclePlugin();
      if (taskPlugin) {
        pluginManager.registerLoopPlugin(taskPlugin);
        console.log('✅ Task Lifecycle Plugin registered');
      }
    }

    // 6. 创建 AI Flow Controller（传递 pluginManager）
    const { AIFlowController } = require('./loop/core/ai-flow-controller');
    const flowController = new AIFlowController({
      commandManager,
      session: loopSession,
      frontend,
      projectRoot: this.session.getProjectRoot(),
      pluginManager,
    });

    // 7. 创建 Loop Engine
    const engine = new LoopEngine(
      frontend,
      flowController,
      loopSession,
      {
        frontend,
        sessionOptions: {
          maxIterations: 3,
        },
        enableCommands: true,
        enablePlugins: this.options.enablePlugins,
        maxRedirects: 10,
      }
    );

    // 8. 将 pluginManager 设置到 engine（以便后续注册插件）
    engine.setPluginManager(pluginManager);

    return engine;
  }

  /**
   * 启动 Loop REPL
   */
  async start(): Promise<void> {
    try {
      // 显示欢迎信息
      this.printWelcome();

      // 启动 Loop 引擎
      await this.engine.start();
    } catch (error: any) {
      console.error(chalk.red('Failed to start Loop REPL:'), error.message);
      throw error;
    }
  }

  /**
   * 停止 Loop REPL
   */
  async stop(): Promise<void> {
    try {
      await this.engine.stop();
    } catch (error: any) {
      console.error(chalk.red('Failed to stop Loop REPL:'), error.message);
    }
  }

  /**
   * 打印欢迎信息
   */
  private printWelcome(): void {
    console.log(chalk.cyan('╔═══════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║                                                       ║'));
    console.log(chalk.cyan('║   Kode AI Assistant - Loop Engine Mode               ║'));
    console.log(chalk.cyan('║   Experimental Plugin-Based Architecture             ║'));
    console.log(chalk.cyan('║                                                       ║'));
    console.log(chalk.cyan('╚═══════════════════════════════════════════════════════╝'));
    console.log();
    console.log(chalk.gray('Features:'));
    console.log(chalk.gray('  • Plugin-based command system'));
    console.log(chalk.gray('  • Frontend abstraction (CLI/Web/IPC)'));
    console.log(chalk.gray('  • Flow control (skip/modify/redirect)'));
    console.log(chalk.gray('  • Multi-mode AI support (chat/plan/execute/verify/loop)'));
    console.log();
    console.log(chalk.cyan('Type /help for available commands'));
    console.log(chalk.cyan('Type /exit to quit'));
    console.log();
  }

  /**
   * 获取 Loop 引擎
   */
  getEngine(): LoopEngine {
    return this.engine;
  }

  /**
   * 获取会话管理器
   */
  getSession(): SessionManager {
    return this.session;
  }
}
