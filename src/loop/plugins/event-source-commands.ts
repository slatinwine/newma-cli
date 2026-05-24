/**
 * Event Source Commands Plugin
 *
 * Provides commands for managing event sources in Loop REPL.
 */

import { Command, CommandContext } from '../commands/types';
import { CommandManager } from '../commands/command-manager';
import { EventSourceManager, EventSourceType } from '../event/event-source-manager';

/**
 * Command handler type
 */
type CommandHandler = (args: string[], context: any) => Promise<any>;

/**
 * Event Source Commands
 */
export class EventSourceCommands {
  /**
   * Get all commands
   */
  static getAllCommands(
    eventSourceManager: EventSourceManager
  ): Command[] {
    return [
      {
        name: 'event-source',
        description: 'Manage event sources (file watcher, WebSocket, HTTP)',
        handler: async (context: CommandContext) => {
          const args = context.args || [];
          const subCommand = args[0];

          switch (subCommand) {
            case 'add':
              return await this.handleAdd(args.slice(1), eventSourceManager, context);
            case 'remove':
              return await this.handleRemove(args.slice(1), eventSourceManager);
            case 'list':
              return await this.handleList(eventSourceManager);
            case 'start':
              return await this.handleStart(args.slice(1), eventSourceManager);
            case 'stop':
              return await this.handleStop(args.slice(1), eventSourceManager);
            case 'clear':
              return await this.handleClear(eventSourceManager);
            case 'stats':
              return await this.handleStats(eventSourceManager);
            default:
              return {
                status: 'error',
                message: 'Unknown subcommand. Available: add, remove, list, start, stop, clear, stats',
                metadata: { exit: false },
              };
          }
        },
      },
    ];
  }

  /**
   * Handle add command
   */
  private static async handleAdd(
    args: string[],
    manager: EventSourceManager,
    context: any
  ): Promise<any> {
    const type = args[0];
    const configStr = args[1];

    if (!type || !configStr) {
      return {
        status: 'error',
        message: 'Usage: /event-source add <type> <config>',
        metadata: { exit: false },
      };
    }

    try {
      let id: string;

      switch (type) {
        case 'file':
        case 'file-watcher':
        case 'fw': {
          const config = { watchPath: configStr, recursive: false, debounceMs: 100 };
          id = manager.addFileWatcher(config);
          break;
        }

        case 'websocket':
        case 'ws': {
          const config = { url: configStr };
          id = manager.addWebSocket(config);
          break;
        }

        case 'http': {
          const [port, path] = configStr.split(':');
          const config = { port: parseInt(port) || 8080, path: path || '/' };
          id = manager.addHTTP(config);
          break;
        }

        default:
          return {
            status: 'error',
            message: 'Unknown type. Available: file-watcher (fw), websocket (ws), http',
            metadata: { exit: false },
          };
      }

      manager.startSource(id);

      return {
        status: 'success',
        message: 'Added source ' + id + ' (auto-started)',
        metadata: { exit: false },
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: 'Failed to add source: ' + error.message,
        metadata: { exit: false },
      };
    }
  }

  /**
   * Handle remove command
   */
  private static async handleRemove(
    args: string[],
    manager: EventSourceManager
  ): Promise<any> {
    const id = args[0];

    if (!id) {
      return {
        status: 'error',
        message: 'Usage: /event-source remove <id>',
        metadata: { exit: false },
      };
    }

    const success = manager.removeSource(id);

    if (success) {
      return {
        status: 'success',
        message: 'Removed source: ' + id,
        metadata: { exit: false },
      };
    } else {
      return {
        status: 'error',
        message: 'Source not found: ' + id,
        metadata: { exit: false },
      };
    }
  }

  /**
   * Handle list command
   */
  private static async handleList(
    manager: EventSourceManager
  ): Promise<any> {
    const sources = manager.getAllSources();

    if (sources.length === 0) {
      return {
        status: 'success',
        message: 'No event sources configured',
        metadata: { exit: false },
      };
    }

    let output = '\nEvent Sources:\n';
    output += '─'.repeat(50) + '\n';

    for (const source of sources) {
      const statusText = source.state === 'running' ? 'Running' : 'Stopped';

      output += '\n' + source.id;
      output += '\n  Type: ' + source.type;
      output += '\n  Status: ' + statusText;
      output += '\n  Created: ' + source.createdAt.toISOString();
      output += '\n';
    }

    output += '\n' + '─'.repeat(50) + '\n';

    return {
      status: 'success',
      message: output,
      metadata: { exit: false },
    };
  }

  /**
   * Handle start command
   */
  private static async handleStart(
    args: string[],
    manager: EventSourceManager
  ): Promise<any> {
    const id = args[0];

    if (!id) {
      return {
        status: 'error',
        message: 'Usage: /event-source start <id>',
        metadata: { exit: false },
      };
    }

    const success = manager.startSource(id);

    if (success) {
      return {
        status: 'success',
        message: 'Started source: ' + id,
        metadata: { exit: false },
      };
    } else {
      return {
        status: 'error',
        message: 'Source not found or already running: ' + id,
        metadata: { exit: false },
      };
    }
  }

  /**
   * Handle stop command
   */
  private static async handleStop(
    args: string[],
    manager: EventSourceManager
  ): Promise<any> {
    const id = args[0];

    if (!id) {
      return {
        status: 'error',
        message: 'Usage: /event-source stop <id>',
        metadata: { exit: false },
      };
    }

    const success = manager.stopSource(id);

    if (success) {
      return {
        status: 'success',
        message: 'Stopped source: ' + id,
        metadata: { exit: false },
      };
    } else {
      return {
        status: 'error',
        message: 'Source not found or not running: ' + id,
        metadata: { exit: false },
      };
    }
  }

  /**
   * Handle clear command
   */
  private static async handleClear(
    manager: EventSourceManager
  ): Promise<any> {
    manager.clearAll();

    return {
      status: 'success',
      message: 'Cleared all event sources',
      metadata: { exit: false },
    };
  }

  /**
   * Handle stats command
   */
  private static async handleStats(
    manager: EventSourceManager
  ): Promise<any> {
    const stats = manager.getStats();

    let output = '\nEvent Source Statistics:\n';
    output += '─'.repeat(50) + '\n';
    output += '\nTotal: ' + stats.total;
    output += '\nRunning: ' + stats.running;
    output += '\nStopped: ' + stats.stopped;

    if (Object.keys(stats.byType).length > 0) {
      output += '\n\nBy Type:';
      for (const [type, count] of Object.entries(stats.byType)) {
        output += '\n  ' + type + ': ' + count;
      }
    }

    output += '\n\n' + '─'.repeat(50) + '\n';

    return {
      status: 'success',
      message: output,
      metadata: { exit: false },
    };
  }
}
