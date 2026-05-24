/**
 * TUI REPL Manager
 *
 * 基于 TUI Frontend 的 REPL 实现
 */

import path from 'path';
import chalk from 'chalk';
import { SessionManager } from './session';
import { TuiFrontend } from './loop/frontends/tui-frontend';
import { LoopEngine } from './loop/core/loop-engine';
import { LoopSessionManagerAdapter } from './loop/core/session-adapter';
import { CommandManager } from './loop/commands/command-manager';
import { CorePluginCommands } from './loop/plugins/core-plugin';
import { EventSourceCommands } from './loop/plugins/event-source-commands';
import { EventSourceManager } from './loop/event/event-source-manager';

/**
 * TUI REPL 选项
 */
export interface TuiREPLOptions {
  debug?: boolean;
  enablePlugins?: boolean;
}

/**
 * TUI REPL 管理器
 */
export class TuiREPLManager {
  private session: SessionManager;
  private engine: LoopEngine;
  private options: TuiREPLOptions;
  private eventSourceManager: EventSourceManager;

  constructor(session: SessionManager, options: TuiREPLOptions = {}) {
    this.session = session;
    this.options = {
      debug: options.debug || false,
      enablePlugins: options.enablePlugins !== false,
    };

    this.eventSourceManager = new EventSourceManager({
      maxSources: 10,
      debug: this.options.debug,
    });

    this.engine = this.createLoopEngine();
  }

  private createLoopEngine(): LoopEngine {
    const projectName = path.basename(this.session.getProjectRoot());
    const frontend = new TuiFrontend({
      prompt: `[${projectName}] (tui) ❯ `,
      colors: {
        primary: 'blue',
        secondary: 'cyan',
        success: 'green',
        error: 'red',
        warning: 'yellow',
      },
      debug: this.options.debug,
      mouse: false,
    });

    const { HookSystem } = require('./hooks');
    const { LoopSessionManagerAdapter } = require('./loop/core/session-adapter');
    const hookSystem = new HookSystem({ enabled: false });
    const loopSession = new LoopSessionManagerAdapter(
      this.session,
      frontend,
      hookSystem,
      { maxIterations: 3 }
    );

    const commandManager = new CommandManager();

    const coreCommands = CorePluginCommands.getAllCommands(commandManager);
    coreCommands.forEach(cmd => {
      commandManager.register(cmd, 'core');
    });

    const eventSourceCommands = EventSourceCommands.getAllCommands(
      this.eventSourceManager
    );
    eventSourceCommands.forEach(cmd => {
      commandManager.register(cmd, 'event-sources');
    });

    const { AIFlowController } = require('./loop/core/ai-flow-controller');
    const flowController = new AIFlowController({
      commandManager,
      session: loopSession,
      frontend,
      projectRoot: this.session.getProjectRoot(),
    });

    return new LoopEngine(
      frontend,
      flowController,
      loopSession,
      {
        frontend,
        sessionOptions: { maxIterations: 3 },
        enableCommands: true,
        enablePlugins: this.options.enablePlugins,
        maxRedirects: 10,
      }
    );
  }

  async start(): Promise<void> {
    try {
      this.printWelcome();
      await this.engine.start();
    } catch (error: any) {
      console.error(chalk.red('Failed to start TUI REPL:'), error.message);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await this.engine.stop();
    } catch (error: any) {
      console.error(chalk.red('Failed to stop TUI REPL:'), error.message);
    }
  }

  private printWelcome(): void {
    console.log();
    console.log(chalk.gray('  Kode AI Assistant'));
    console.log(chalk.gray('  ───────────────────'));
    console.log();
    console.log(chalk.gray('  A modern terminal UI with clean design'));
    console.log();
    console.log(chalk.gray('  Starting...'));
    console.log();
  }

  getEngine(): LoopEngine {
    return this.engine;
  }

  getSession(): SessionManager {
    return this.session;
  }
}
