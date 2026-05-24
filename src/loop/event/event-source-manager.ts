/**
 * Event Source Manager
 *
 * Manages multiple event sources in the Loop system.
 * Integrates File Watcher, WebSocket, and HTTP sources.
 */

import { EventEmitter } from 'events';
import chalk from 'chalk';
import {
  IEventSource,
  EventSourceState,
  UIEvent,
} from './types';
import {
  FileWatcherEventSource,
  FileWatcherConfig,
} from './file-watcher-source';
import {
  WebSocketEventSource,
  WebSocketSourceConfig,
} from './websocket-source';
import {
  HTTPEventSource,
  HTTPSourceConfig,
} from './http-source';

/**
 * Event source type
 */
export enum EventSourceType {
  Readline = 'readline',
  FileWatcher = 'file-watcher',
  WebSocket = 'websocket',
  HTTP = 'http',
}

/**
 * Managed event source
 */
interface ManagedEventSource {
  id: string;
  type: EventSourceType;
  source: IEventSource;
  config: any;
  state: EventSourceState;
  createdAt: Date;
}

/**
 * Event source manager configuration
 */
export interface EventSourceManagerConfig {
  /**
   * Maximum number of sources
   */
  maxSources?: number;

  /**
   * Enable debug logging
   */
  debug?: boolean;
}

/**
 * Event Source Manager
 *
 * Manages lifecycle of multiple event sources:
 * - Add/remove sources
 * - Start/stop sources
 * - Poll events from all sources
 * - Aggregate statistics
 */
export class EventSourceManager extends EventEmitter {
  private sources: Map<string, ManagedEventSource> = new Map();
  private config: Required<EventSourceManagerConfig>;
  private nextId: number = 1;

  constructor(config: EventSourceManagerConfig = {}) {
    super();
    this.config = {
      maxSources: config.maxSources || 10,
      debug: config.debug || false,
    };
  }

  /**
   * Add a file watcher source
   */
  addFileWatcher(config: FileWatcherConfig): string {
    const id = `fw-${this.nextId++}`;
    const source = new FileWatcherEventSource(config);

    return this.addSource(id, EventSourceType.FileWatcher, source, config);
  }

  /**
   * Add a WebSocket source
   */
  addWebSocket(config: WebSocketSourceConfig): string {
    const id = `ws-${this.nextId++}`;
    const source = new WebSocketEventSource(config);

    return this.addSource(id, EventSourceType.WebSocket, source, config);
  }

  /**
   * Add an HTTP source
   */
  addHTTP(config: HTTPSourceConfig): string {
    const id = `http-${this.nextId++}`;
    const source = new HTTPEventSource(config);

    return this.addSource(id, EventSourceType.HTTP, source, config);
  }

  /**
   * Add a source
   */
  private addSource(
    id: string,
    type: EventSourceType,
    source: IEventSource,
    config: any
  ): string {
    // Check max sources
    if (this.sources.size >= this.config.maxSources) {
      throw new Error(`Maximum number of sources (${this.config.maxSources}) reached`);
    }

    // Create managed source
    const managed: ManagedEventSource = {
      id,
      type,
      source,
      config,
      state: EventSourceState.Start,
      createdAt: new Date(),
    };

    // Add to map
    this.sources.set(id, managed);

    // Setup event handlers
    this.setupSourceEventHandlers(managed);

    // Emit event
    this.emit('source-added', managed);
    this.log(`Added ${type} source: ${id}`);

    return id;
  }

  /**
   * Remove a source
   */
  removeSource(id: string): boolean {
    const managed = this.sources.get(id);
    if (!managed) {
      return false;
    }

    // Stop if running
    if (managed.state === EventSourceState.Running) {
      managed.source.pause();
    }

    // Dispose
    if (managed.source.dispose) {
      managed.source.dispose();
    }

    // Remove from map
    this.sources.delete(id);

    // Emit event
    this.emit('source-removed', managed);
    this.log(`Removed source: ${id}`);

    return true;
  }

  /**
   * Start a source
   */
  startSource(id: string): boolean {
    const managed = this.sources.get(id);
    if (!managed) {
      return false;
    }

    if (managed.state !== EventSourceState.Start) {
      this.log(`Source ${id} already started`);
      return false;
    }

    if (managed.source.start) {
      managed.source.start();
    }
    managed.state = EventSourceState.Running;

    // Emit event
    this.emit('source-started', managed);
    this.log(`Started source: ${id}`);

    return true;
  }

  /**
   * Stop a source
   */
  stopSource(id: string): boolean {
    const managed = this.sources.get(id);
    if (!managed) {
      return false;
    }

    if (managed.state !== EventSourceState.Running) {
      return false;
    }

    managed.source.pause();
    managed.state = EventSourceState.Start;

    // Emit event
    this.emit('source-stopped', managed);
    this.log(`Stopped source: ${id}`);

    return true;
  }

  /**
   * Start all sources
   */
  startAll(): void {
    for (const [id] of this.sources) {
      this.startSource(id);
    }
  }

  /**
   * Stop all sources
   */
  stopAll(): void {
    for (const [id] of this.sources) {
      this.stopSource(id);
    }
  }

  /**
   * Get next event from any source (round-robin)
   */
  async pollNext(timeoutMs: number = 100): Promise<UIEvent | null> {
    const sourceIds = Array.from(this.sources.keys());

    if (sourceIds.length === 0) {
      return null;
    }

    const startTime = Date.now();

    // Round-robin polling
    while (Date.now() - startTime < timeoutMs) {
      for (const id of sourceIds) {
        const managed = this.sources.get(id)!;

        if (managed.state !== EventSourceState.Running) {
          continue;
        }

        try {
          const event = await managed.source.pollNext();
          if (event) {
            // Annotate event with source ID (using type assertion)
            const eventWithSource = event as any;
            if (!eventWithSource.data) {
              eventWithSource.data = {};
            }
            eventWithSource.data.sourceId = id;
            return event;
          }
        } catch (error: any) {
          this.log(`Error polling source ${id}: ${error.message}`);
        }
      }

      // Small delay before next round
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return null;
  }

  /**
   * Get all sources
   */
  getAllSources(): ManagedEventSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * Get source by ID
   */
  getSource(id: string): ManagedEventSource | undefined {
    return this.sources.get(id);
  }

  /**
   * Get source count by type
   */
  getCountByType(type: EventSourceType): number {
    return Array.from(this.sources.values())
      .filter(s => s.type === type)
      .length;
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    byType: Record<string, number>;
    running: number;
    stopped: number;
  } {
    const sources = Array.from(this.sources.values());
    const byType: Record<string, number> = {};

    for (const source of sources) {
      byType[source.type] = (byType[source.type] || 0) + 1;
    }

    const running = sources.filter(s => s.state === EventSourceState.Running).length;
    const stopped = sources.filter(s => s.state === EventSourceState.Start).length;

    return {
      total: sources.length,
      byType,
      running,
      stopped,
    };
  }

  /**
   * Clear all sources
   */
  clearAll(): void {
    this.stopAll();
    this.sources.clear();
    this.emit('sources-cleared');
    this.log('Cleared all sources');
  }

  /**
   * Setup event handlers for a source
   */
  private setupSourceEventHandlers(managed: ManagedEventSource): void {
    // Error handling
    if (managed.source.on) {
      managed.source.on('error', (error: Error) => {
        this.log(`Error in source ${managed.id}: ${error.message}`);
        this.emit('source-error', { source: managed, error });
      });

      // State changes
      managed.source.on('started', () => {
        managed.state = EventSourceState.Running;
      });

      managed.source.on('paused', () => {
        managed.state = EventSourceState.Start;
      });

      managed.source.on('disposed', () => {
        this.emit('source-disposed', managed);
      });
    }
  }

  /**
   * Log message
   */
  private log(message: string): void {
    if (this.config.debug) {
      console.log(chalk.gray(`[EventSourceManager] ${message}`));
    }
  }

  /**
   * Dispose manager
   */
  dispose(): void {
    this.clearAll();
    this.removeAllListeners();
  }
}
