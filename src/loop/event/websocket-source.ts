// src/loop/event/websocket-source.ts
/**
 * WebSocket Event Source
 *
 * Connects to a WebSocket server and receives events in real-time.
 * Useful for remote event streaming, collaborative editing, etc.
 */

import { EventEmitter } from 'events';
import * as WebSocket from 'ws'; // Import ws library

// Extract WebSocket class for easier use
const WebSocketClass = WebSocket.default || WebSocket;

// Type for WebSocket instance
type WebSocketInstance = InstanceType<typeof WebSocketClass>;

import {
  IEventSource,
  UIEvent,
  UIEventType,
  EventSourceState,
  WebSocketEvent,
  EventPollResult,
} from './types';

export interface WebSocketSourceConfig {
  /**
   * WebSocket server URL
   */
  url: string;

  /**
   * Connection timeout in milliseconds
   */
  connectionTimeout?: number;

  /**
   * Reconnection settings
   */
  reconnection?: {
    /**
     * Enable automatic reconnection
     */
    enabled: boolean;
    /**
     * Maximum reconnection attempts
     */
    maxAttempts?: number;
    /**
     * Initial delay in milliseconds
     */
    initialDelay?: number;
    /**
     * Maximum delay in milliseconds
     */
    maxDelay?: number;
  };

  /**
   * WebSocket protocols
   */
  protocols?: string | string[];

  /**
   * Custom headers
   */
  headers?: Record<string, string>;
}

/**
 * WebSocket Event Source
 *
 * Connects to a WebSocket server and converts incoming messages to UI events.
 *
 * Example:
 * ```typescript
 * const wsSource = new WebSocketEventSource({
 *   url: 'ws://localhost:8080/events',
 *   reconnection: { enabled: true },
 * });
 *
 * await wsSource.connect();
 *
 * while (running) {
 *   const event = await wsSource.pollNext();
 *   if (event) {
 *     console.log('Received event:', event.data);
 *   }
 * }
 * ```
 */
export class WebSocketEventSource extends EventEmitter implements IEventSource {
  private config: WebSocketSourceConfig;
  private state: EventSourceState = EventSourceState.Start;
  private ws: WebSocketInstance | null = null;
  private eventQueue: WebSocketEvent[] = [];
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(config: WebSocketSourceConfig) {
    super();
    this.config = {
      connectionTimeout: 10000,
      reconnection: {
        enabled: true,
        maxAttempts: 5,
        initialDelay: 1000,
        maxDelay: 30000,
      },
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
   * Check if the source is paused
   */
  isPaused(): boolean {
    return this.state === EventSourceState.Paused;
  }

  /**
   * Check if connected to WebSocket server
   */
  isConnected(): boolean {
    return this.ws?.readyState === (WebSocket as any).OPEN;
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.state !== EventSourceState.Start) {
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
        if (this.ws) {
          this.ws.close();
        }
      }, this.config.connectionTimeout);

      try {
        this.ws = new WebSocketClass(this.config.url, this.config.protocols, {
          headers: this.config.headers,
        }) as WebSocketInstance;

        if (!this.ws) {
          reject(new Error('Failed to create WebSocket'));
          return;
        }

        this.ws.on('open', () => {
          clearTimeout(timeout);
          this.state = EventSourceState.Running;
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data: any) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error: Error) => {
          clearTimeout(timeout);
          this.emit('error', error);
          reject(error);
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          clearTimeout(timeout);
          this.handleDisconnect(code, reason.toString());
          if (this.state === EventSourceState.Start) {
            reject(new Error(`WebSocket closed: ${reason}`));
          }
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Start receiving events (alias for connect)
   */
  start(): void {
    this.connect().catch(error => {
      this.emit('error', error);
    });
  }

  /**
   * Stop receiving events and close connection
   */
  stop(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.state = EventSourceState.Start;
  }

  /**
   * Pause receiving events (keep connection alive)
   */
  pause(): void {
    if (this.state === EventSourceState.Paused) {
      return;
    }
    this.state = EventSourceState.Paused;
    this.emit('paused');
  }

  /**
   * Resume receiving events
   */
  resume(): void {
    if (this.state !== EventSourceState.Paused) {
      return;
    }
    this.state = EventSourceState.Running;
    this.emit('resumed');
  }

  /**
   * Poll for the next event
   */
  async pollNext(): Promise<EventPollResult> {
    if (this.state === EventSourceState.Paused) {
      return null;
    }

    if (!this.ws || this.ws.readyState !== (WebSocketClass as any).OPEN) {
      // Try to reconnect if not connected
      if (this.config.reconnection?.enabled) {
        this.scheduleReconnect();
      }
      return null;
    }

    if (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;

      // Convert to UIEvent
      const uiEvent: UIEvent = {
        type: UIEventType.Focus, // Use Focus for WebSocket events
        focused: true,
        timestamp: event.timestamp,
        source: 'websocket',
        data: event,
      };

      return uiEvent;
    }

    return null;
  }

  /**
   * Send a message to the WebSocket server
   */
  send(data: string | Buffer): void {
    if (this.ws && this.ws.readyState === (WebSocketClass as any).OPEN) {
      this.ws.send(data);
    } else {
      throw new Error('WebSocket is not connected');
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: any): void {
    if (this.state === EventSourceState.Paused) {
      return;
    }

    let message: string;
    if (Buffer.isBuffer(data)) {
      message = data.toString('utf-8');
    } else if (typeof data === 'string') {
      message = data;
    } else {
      return; // Unsupported data type
    }

    const event: WebSocketEvent = {
      type: 'message',
      data: message,
      timestamp: Date.now(),
      origin: this.config.url,
    };

    this.eventQueue.push(event);
    this.emit('message', event);
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnect(code: number, reason: string): void {
    this.state = EventSourceState.Start;
    this.emit('disconnected', { code, reason });

    // Attempt reconnection if enabled
    if (this.config.reconnection?.enabled && code !== 1000) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    const reconnection = this.config.reconnection!;
    if (
      reconnection.maxAttempts &&
      this.reconnectAttempts >= reconnection.maxAttempts
    ) {
      this.emit('reconnectFailed');
      return;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      reconnection.initialDelay! * Math.pow(2, this.reconnectAttempts),
      reconnection.maxDelay!
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      this.emit('reconnecting', this.reconnectAttempts);

      this.connect().catch(error => {
        this.emit('reconnectError', error);
      });
    }, delay);
  }

  /**
   * Get statistics about the WebSocket connection
   */
  getStats(): {
    isConnected: boolean;
    queuedEvents: number;
    reconnectAttempts: number;
    state: EventSourceState;
  } {
    return {
      isConnected: this.isConnected(),
      queuedEvents: this.eventQueue.length,
      reconnectAttempts: this.reconnectAttempts,
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
