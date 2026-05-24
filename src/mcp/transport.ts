/**
 * MCP Transport Layer
 *
 * Handles communication with MCP servers over stdio or WebSocket.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import {
  JSONRPCRequest,
  JSONRPCResponse,
  MCPServerConfig,
  MCPConnectionError,
} from './types';

// ============================================================================
// Abstract Transport
// ============================================================================

/**
 * Abstract base class for MCP transports
 */
export abstract class MCPTransport extends EventEmitter {
  protected _connected = false;

  get connected(): boolean {
    return this._connected;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract send(request: JSONRPCRequest): Promise<JSONRPCResponse>;
}

// ============================================================================
// stdio Transport
// ============================================================================

/**
 * stdio transport for spawning MCP server processes
 */
export class StdioTransport extends MCPTransport {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number | string, {
    resolve: (value: JSONRPCResponse) => void;
    reject: (error: Error) => void;
  }>();

  constructor(private config: MCPServerConfig) {
    super();
  }

  async connect(): Promise<void> {
    if (this._connected) {
      return;
    }

    try {
      // Spawn the server process
      this.process = spawn(this.config.command, this.config.args, {
        env: { ...process.env, ...this.config.env },
        stdio: ['pipe', 'pipe', 'inherit'], // inherit stderr for debugging
      });

      // Set up stdout handler
      this.process.stdout?.on('data', (data: Buffer) => {
        this.handleMessage(data);
      });

      // Set up error handler
      this.process.on('error', (error) => {
        this.emit('error', error);
        this.rejectAllPending(error);
      });

      // Set up close handler
      this.process.on('close', (code) => {
        this._connected = false;
        this.emit('disconnect', { code });
        this.rejectAllPending(new MCPConnectionError(`Process closed with code ${code}`));
      });

      this._connected = true;
      this.emit('connect');
    } catch (error) {
      throw new MCPConnectionError(
        `Failed to spawn MCP server: ${error}`,
        error as Error
      );
    }
  }

  async disconnect(): Promise<void> {
    if (!this._connected || !this.process) {
      return;
    }

    this._connected = false;
    this.process.kill();
    this.process = null;
    this.emit('disconnect');
  }

  async send(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    if (!this._connected || !this.process) {
      throw new MCPConnectionError('Not connected to MCP server');
    }

    return new Promise((resolve, reject) => {
      const id = request.id || this.requestId++;
      const requestWithId = { ...request, id };

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject });

      // Send request
      const message = JSON.stringify(requestWithId) + '\n';
      this.process!.stdin?.write(message);

      // Set timeout (default 30 seconds)
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new MCPConnectionError(`Request timeout: ${request.method}`));
        }
      }, 30000);
    });
  }

  private handleMessage(data: Buffer): void {
    try {
      const lines = data.toString().split('\n').filter(Boolean);

      for (const line of lines) {
        const response: JSONRPCResponse = JSON.parse(line);

        // Handle response
        if (response.id !== undefined && this.pendingRequests.has(response.id)) {
          const pending = this.pendingRequests.get(response.id)!;
          this.pendingRequests.delete(response.id);

          if (response.error) {
            pending.reject(new Error(response.error.message));
          } else {
            pending.resolve(response);
          }
        } else {
          // Handle notification (no id)
          this.emit('notification', response);
        }
      }
    } catch (error) {
      this.emit('error', new MCPConnectionError(`Failed to parse message: ${error}`));
    }
  }

  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }
}

// ============================================================================
// WebSocket Transport (future implementation)
// ============================================================================

/**
 * WebSocket transport for remote MCP servers
 *
 * Note: This is a placeholder for future implementation.
 * To implement, you'll need to install 'ws' package:
 * npm install ws
 * npm install --save-dev @types/ws
 */
export class WebSocketTransport extends MCPTransport {
  private ws: WebSocket | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number | string, {
    resolve: (value: JSONRPCResponse) => void;
    reject: (error: Error) => void;
  }>();

  constructor(private url: string) {
    super();
  }

  async connect(): Promise<void> {
    throw new Error('WebSocket transport not yet implemented');
  }

  async disconnect(): Promise<void> {
    throw new Error('WebSocket transport not yet implemented');
  }

  async send(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    throw new Error('WebSocket transport not yet implemented');
  }
}

// ============================================================================
// Transport Factory
// ============================================================================

/**
 * Create appropriate transport based on config
 */
export function createTransport(config: MCPServerConfig): MCPTransport {
  switch (config.transport || 'stdio') {
    case 'stdio':
      return new StdioTransport(config);
    case 'websocket':
      if (!config.url) {
        throw new Error('WebSocket transport requires url in config');
      }
      return new WebSocketTransport(config.url);
    default:
      throw new Error(`Unknown transport type: ${(config as any).transport}`);
  }
}
