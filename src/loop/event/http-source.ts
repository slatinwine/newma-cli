// src/loop/event/http-source.ts
/**
 * HTTP Event Source
 *
 * Creates an HTTP server to receive webhook-style events.
 * Useful for integrating with external services, CI/CD, etc.
 */

import * as http from 'http';
import { EventEmitter } from 'events';
import {
  IEventSource,
  UIEvent,
  UIEventType,
  EventSourceState,
  HTTPEvent,
  EventPollResult,
} from './types';

export interface HTTPSourceConfig {
  /**
   * Port to listen on
   */
  port: number;

  /**
   * Host to bind to
   */
  host?: string;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number;

  /**
   * CORS settings
   */
  cors?: {
    enabled: boolean;
    origin?: string;
    methods?: string[];
    headers?: string[];
  };

  /**
   * Authentication (optional)
   */
  auth?: {
    type: 'bearer' | 'basic';
    token?: string;
    username?: string;
    password?: string;
  };

  /**
   * Response body for successful requests
   */
  successResponse?: {
    statusCode: number;
    body: string;
  };
}

/**
 * HTTP Event Source
 *
 * Creates an HTTP server to receive webhook events.
 *
 * Example:
 * ```typescript
 * const httpSource = new HTTPEventSource({
 *   port: 3000,
 *   cors: { enabled: true },
 * });
 *
 * await httpSource.start();
 *
 * while (running) {
 *   const event = await httpSource.pollNext();
 *   if (event) {
 *     console.log('HTTP request:', event.method, event.path);
 *   }
 * }
 * ```
 */
export class HTTPEventSource extends EventEmitter implements IEventSource {
  private config: HTTPSourceConfig;
  private state: EventSourceState = EventSourceState.Start;
  private server: http.Server | null = null;
  private eventQueue: HTTPEvent[] = [];

  constructor(config: HTTPSourceConfig) {
    super();
    this.config = {
      host: '0.0.0.0',
      timeout: 30000,
      cors: {
        enabled: true,
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        headers: ['Content-Type', 'Authorization'],
      },
      successResponse: {
        statusCode: 200,
        body: JSON.stringify({ success: true }),
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
   * Check if the server is listening
   */
  isListening(): boolean {
    return this.server?.listening || false;
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    if (this.state !== EventSourceState.Start) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.server = http.createServer((req, res) => {
          this.handleRequest(req, res);
        });

        this.server.on('error', (error: Error) => {
          this.emit('error', error);
          reject(error);
        });

        this.server.listen(
          this.config.port,
          this.config.host,
          () => {
            this.state = EventSourceState.Running;
            this.emit('started', {
              port: this.config.port,
              host: this.config.host,
            });
            resolve();
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the HTTP server
   */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.state = EventSourceState.Start;
  }

  /**
   * Pause receiving events (stop processing but keep listening)
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

    if (!this.server || !this.server.listening) {
      return null;
    }

    if (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;

      // Convert to UIEvent
      const uiEvent: UIEvent = {
        type: UIEventType.Focus, // Use Focus for HTTP events
        focused: true,
        timestamp: event.timestamp,
        source: 'http',
        data: event,
      };

      return uiEvent;
    }

    return null;
  }

  /**
   * Handle incoming HTTP request
   */
  private handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    // Check authentication
    if (this.config.auth && !this.isAuthenticated(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    // Handle CORS
    if (this.config.cors?.enabled) {
      this.handleCORS(req, res);
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
    }

    // Collect request body
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      if (this.state === EventSourceState.Paused) {
        // Still respond but don't emit events
        this.sendSuccessResponse(res);
        return;
      }

      // Create event
      const event: HTTPEvent = {
        type: 'request',
        method: req.method || 'GET',
        path: req.url || '/',
        headers: req.headers as Record<string, string>,
        body: body || undefined,
        query: this.parseQuery(req.url || ''),
        timestamp: Date.now(),
        remoteAddress: req.socket.remoteAddress,
      };

      this.eventQueue.push(event);
      this.emit('request', event);

      // Send response
      this.sendSuccessResponse(res);
    });
  }

  /**
   * Check if request is authenticated
   */
  private isAuthenticated(req: http.IncomingMessage): boolean {
    if (!this.config.auth) {
      return true;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return false;
    }

    if (this.config.auth.type === 'bearer') {
      return authHeader === `Bearer ${this.config.auth.token}`;
    } else if (this.config.auth.type === 'basic') {
      const expected = Buffer.from(
        `${this.config.auth.username}:${this.config.auth.password}`
      ).toString('base64');
      return authHeader === `Basic ${expected}`;
    }

    return false;
  }

  /**
   * Handle CORS headers
   */
  private handleCORS(req: http.IncomingMessage, res: http.ServerResponse): void {
    const cors = this.config.cors!;

    if (cors.origin) {
      res.setHeader('Access-Control-Allow-Origin', cors.origin);
    }

    if (cors.methods) {
      res.setHeader('Access-Control-Allow-Methods', cors.methods.join(', '));
    }

    if (cors.headers) {
      res.setHeader('Access-Control-Allow-Headers', cors.headers.join(', '));
    }

    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  /**
   * Parse query string from URL
   */
  private parseQuery(url: string): Record<string, string> {
    const queryStart = url.indexOf('?');
    if (queryStart === -1) {
      return {};
    }

    const queryString = url.slice(queryStart + 1);
    const query: Record<string, string> = {};

    queryString.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      query[decodeURIComponent(key)] = decodeURIComponent(value || '');
    });

    return query;
  }

  /**
   * Send success response
   */
  private sendSuccessResponse(res: http.ServerResponse): void {
    const response = this.config.successResponse!;
    res.writeHead(response.statusCode, { 'Content-Type': 'application/json' });
    res.end(response.body);
  }

  /**
   * Get server URL
   */
  getServerURL(): string {
    return `http://${this.config.host}:${this.config.port}`;
  }

  /**
   * Get statistics about the HTTP server
   */
  getStats(): {
    isListening: boolean;
    queuedEvents: number;
    port: number;
    host: string;
    state: EventSourceState;
  } {
    return {
      isListening: this.isListening(),
      queuedEvents: this.eventQueue.length,
      port: this.config.port,
      host: this.config.host!,
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
