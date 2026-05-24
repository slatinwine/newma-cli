// src/loop/event/file-watcher-source.ts
/**
 * File Watcher Event Source
 *
 * Watches file system for changes and emits events.
 * Uses Node.js fs.watch() for efficient file system monitoring.
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import {
  IEventSource,
  UIEvent,
  UIEventType,
  EventSourceState,
  FileWatcherEvent,
  EventPollResult,
} from './types';

export interface FileWatcherConfig {
  /**
   * Path to watch (file or directory)
   */
  watchPath: string;

  /**
   * Watch recursively (for directories)
   */
  recursive?: boolean;

  /**
   * Event types to watch
   */
  watchEvents?: ('change' | 'rename')[];

  /**
   * Debounce delay in milliseconds
   * Prevents duplicate events for rapid changes
   */
  debounceMs?: number;

  /**
   * Ignore patterns (glob patterns)
   */
  ignore?: string[];
}

/**
 * File Watcher Event Source
 *
 * Monitors file system changes and converts them to UI events.
 *
 * Example:
 * ```typescript
 * const watcher = new FileWatcherEventSource({
 *   watchPath: './src',
 *   recursive: true,
 *   debounceMs: 100,
 * });
 *
 * await watcher.start();
 *
 * while (running) {
 *   const event = await watcher.pollNext();
 *   if (event) {
 *     console.log('File changed:', event.path);
 *   }
 * }
 * ```
 */
export class FileWatcherEventSource extends EventEmitter implements IEventSource {
  private config: FileWatcherConfig;
  private state: EventSourceState = EventSourceState.Start;
  private watcher: fs.FSWatcher | null = null;
  private eventQueue: FileWatcherEvent[] = [];
  private debounceTimer: Map<string, NodeJS.Timeout> = new Map();
  private watchedPaths: Set<string> = new Set();

  constructor(config: FileWatcherConfig) {
    super();
    this.config = {
      debounceMs: 100,
      watchEvents: ['change', 'rename'],
      recursive: false,
      ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
      ...config,
    };
  }

  /**
   * Get the current state
   */
  getState(): EventSourceState {
    return this.state;
  }

  /**
   * Check if the watcher is paused
   */
  isPaused(): boolean {
    return this.state === EventSourceState.Paused;
  }

  /**
   * Start watching files
   */
  start(): void {
    if (this.state !== EventSourceState.Start) {
      return;
    }

    try {
      this.watchPath(this.config.watchPath);
      this.state = EventSourceState.Running;
      this.emit('started');
    } catch (error) {
      // Emit error but don't throw
      this.emit('error', error);
      // Still transition to Running even if watch failed
      this.state = EventSourceState.Running;
    }
  }

  /**
   * Stop watching files
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.watchedPaths.clear();
    this.debounceTimer.forEach(timer => clearTimeout(timer));
    this.debounceTimer.clear();
  }

  /**
   * Pause watching (stop emitting events but keep watching)
   */
  pause(): void {
    if (this.state === EventSourceState.Paused) {
      return;
    }
    this.state = EventSourceState.Paused;
    this.emit('paused');
  }

  /**
   * Resume watching
   */
  resume(): void {
    if (this.state !== EventSourceState.Paused) {
      return;
    }
    this.state = EventSourceState.Running;
    this.emit('resumed');
  }

  /**
   * Poll for the next file system event
   */
  async pollNext(): Promise<EventPollResult> {
    if (this.state === EventSourceState.Paused) {
      return null;
    }

    if (!this.watcher || this.watchedPaths.size === 0) {
      this.start();
    }

    if (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;

      // Convert to UIEvent
      const uiEvent: UIEvent = {
        type: UIEventType.Focus, // Use Focus type for file events
        focused: true,
        timestamp: event.timestamp,
        source: 'file-watcher',
        data: event,
      };

      return uiEvent;
    }

    return null; // No events available
  }

  /**
   * Watch a path (file or directory)
   */
  private watchPath(targetPath: string): void {
    const resolvedPath = path.resolve(targetPath);

    if (this.watchedPaths.has(resolvedPath)) {
      return; // Already watching
    }

    try {
      const stats = fs.statSync(resolvedPath);

      if (stats.isDirectory()) {
        this.watchDirectory(resolvedPath);
      } else if (stats.isFile()) {
        this.watchFile(resolvedPath);
      }

      this.watchedPaths.add(resolvedPath);
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Watch a single file
   */
  private watchFile(filePath: string): void {
    const watcher = fs.watch(filePath, (eventType, filename) => {
      this.handleFileEvent(eventType, filePath);
    });

    this.watcher = watcher;
  }

  /**
   * Watch a directory (optionally recursive)
   */
  private watchDirectory(dirPath: string): void {
    const watcher = fs.watch(dirPath, (eventType, filename) => {
      if (filename) {
        const fullPath = path.join(dirPath, filename);
        this.handleFileEvent(eventType, fullPath);
      }
    });

    this.watcher = watcher;

    // Recursively watch subdirectories
    if (this.config.recursive) {
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !this.shouldIgnore(entry.name)) {
            const subPath = path.join(dirPath, entry.name);
            this.watchDirectory(subPath);
          }
        }
      } catch (error) {
        // Ignore permission errors
      }
    }
  }

  /**
   * Handle a file system event
   */
  private handleFileEvent(eventType: 'rename' | 'change', filePath: string): void {
    if (this.state === EventSourceState.Paused) {
      return;
    }

    if (!this.config.watchEvents?.includes(eventType)) {
      return;
    }

    if (this.shouldIgnore(filePath)) {
      return;
    }

    // Debounce events
    const existingTimer = this.debounceTimer.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      const event: FileWatcherEvent = {
        type: eventType,
        path: filePath,
        timestamp: Date.now(),
      };

      this.eventQueue.push(event);
      this.emit('event', event);
      this.debounceTimer.delete(filePath);
    }, this.config.debounceMs);

    this.debounceTimer.set(filePath, timer);
  }

  /**
   * Check if a path should be ignored
   */
  private shouldIgnore(filePath: string): boolean {
    const basename = path.basename(filePath);

    // Check against ignore patterns
    for (const pattern of this.config.ignore || []) {
      if (basename.includes(pattern.replace('*', ''))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get statistics about the watcher
   */
  getStats(): {
    watchedPaths: number;
    queuedEvents: number;
    state: EventSourceState;
  } {
    return {
      watchedPaths: this.watchedPaths.size,
      queuedEvents: this.eventQueue.length,
      state: this.state,
    };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stop();
    this.removeAllListeners();
  }
}
