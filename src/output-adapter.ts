import chalk from 'chalk';
import { LoadingSpinner, createSpinner } from './utils/loading-spinner';

export interface SpinnerController {
  stop(): void;
  succeed(msg?: string): void;
  fail(msg?: string): void;
}

export interface OutputAdapter {
  log(msg: string): void;
  success(msg: string): void;
  error(msg: string): void;
  warn(msg: string): void;
  toolStart(name: string, args: string): void;
  toolResult(name: string, success: boolean, output: string): void;
  spinner(text: string): SpinnerController;
  clear(): void;
  setPrompt(text: string): void;
  write(msg: string): void;
  aiStart(): void;
  aiStream(token: string): void;
  aiEnd(): void;
}

export class ConsoleAdapter implements OutputAdapter {
  log(msg: string): void { console.log(msg); }
  success(msg: string): void { console.log(chalk.green(msg)); }
  error(msg: string): void { console.error(chalk.red(msg)); }
  warn(msg: string): void { console.warn(chalk.yellow(msg)); }

  toolStart(name: string, args: string): void {
    console.log(chalk.dim(`🔧 ${name}${args ? `(${args})` : ''} ...`));
  }

  toolResult(name: string, success: boolean, output: string): void {
    const icon = success ? '✅' : '❌';
    const color = success ? chalk.green : chalk.red;
    console.log(color(`${icon} ${name}: ${output.slice(0, 200)}${output.length > 200 ? '...' : ''}`));
  }

  spinner(text: string): SpinnerController {
    const s = createSpinner(text);
    return {
      stop() { s.stop(); },
      succeed(msg?: string) { s.succeed(msg); },
      fail(msg?: string) { s.fail(msg); },
    };
  }

  clear(): void { console.clear(); }
  setPrompt(_text: string): void { /* no-op in console mode */ }
  write(msg: string): void { process.stdout.write(msg); }
  aiStart(): void { /* no-op */ }
  aiStream(_token: string): void { /* no-op */ }
  aiEnd(): void { /* no-op */ }
}

/**
 * InkAdapter — renders output through Ink TUI components.
 * Uses require() to load ESM UI modules at runtime (avoids tsc cross-module checking).
 */
export class InkAdapter implements OutputAdapter {
  private store: any = null;
  private ready = false;

  constructor() {
    this.init().catch((_e) => { /* output-adapter: init failed */ });
  }

  private async init(): Promise<void> {
    try {
      // Dynamic import of compiled ESM UI module
      const modulePath = require('path').resolve(__dirname, 'ui/state.js');
      const mod = await import(/* webpackIgnore: true */ modulePath);
      this.store = mod.uiStore;
      this.ready = true;
    } catch {
      // Ink UI not compiled yet — will fallback to console
    }
  }

  private withStore(fn: (store: any) => void): void {
    if (this.ready && this.store) {
      fn(this.store);
    }
  }

  log(msg: string): void {
    this.withStore(s => s.addMessage({ role: 'system', content: msg, timestamp: new Date() }));
  }

  success(msg: string): void {
    this.withStore(s => s.addMessage({ role: 'system', content: chalk.green(msg), timestamp: new Date() }));
  }

  error(msg: string): void {
    this.withStore(s => s.addMessage({ role: 'system', content: chalk.red(msg), timestamp: new Date() }));
  }

  warn(msg: string): void {
    this.withStore(s => s.addMessage({ role: 'system', content: chalk.yellow(msg), timestamp: new Date() }));
  }

  toolStart(name: string, args: string): void {
    this.withStore(s => s.addMessage({
      role: 'tool',
      content: args || 'running...',
      toolName: name,
      toolSuccess: undefined,
      timestamp: new Date(),
    }));
  }

  toolResult(name: string, success: boolean, output: string): void {
    this.withStore(s => s.addMessage({
      role: 'tool',
      content: output.slice(0, 500),
      toolName: name,
      toolSuccess: success,
      timestamp: new Date(),
    }));
  }

  spinner(text: string): SpinnerController {
    const s = createSpinner(text);
    const adapter = this;
    this.withStore((store: any) => store.setLoading(true, text));
    return {
      stop() { s.stop(); },
      succeed(msg?: string) {
        s.stop();
        adapter.withStore((store: any) => {
          store.setLoading(false);
          if (msg) store.addMessage({ role: 'system', content: msg, timestamp: new Date() });
        });
      },
      fail(msg?: string) {
        s.stop();
        adapter.withStore((store: any) => {
          store.setLoading(false);
          if (msg) store.addMessage({ role: 'system', content: msg, timestamp: new Date() });
        });
      },
    };
  }

  clear(): void { this.withStore(s => s.clearMessages()); }
  setPrompt(text: string): void { this.withStore(s => s.setPrompt(text)); }
  write(msg: string): void { process.stdout.write(msg); }
  aiStart(): void {
    this.withStore(s => s.addMessage({ role: 'ai', content: '', timestamp: new Date() }));
  }
  aiStream(token: string): void {
    this.withStore(s => s.updateLastMessage(token));
  }
  aiEnd(): void { /* finalize */ }
}

export function createOutputAdapter(ui: 'console' | 'ink'): OutputAdapter {
  return ui === 'ink' ? new InkAdapter() : new ConsoleAdapter();
}
