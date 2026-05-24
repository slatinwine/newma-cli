/**
 * MCP Client Implementation
 *
 * Client for connecting to MCP servers and using their tools/resources.
 */

import {
  IMCPClient,
  MCPClientState,
  MCPServerConfig,
  MCPServerCapabilities,
  MCPTool,
  MCPResource,
  MCPPrompt,
  CallToolRequest,
  CallToolResponse,
  InitializeRequest,
  InitializeResponse,
  MCPConnectionError,
  MCPToolError,
  MCPError,
  JSONRPCRequest,
  JSONRPCResponse,
} from './types';
import { createTransport, MCPTransport } from './transport';

// ============================================================================
// MCP Client
// ============================================================================

/**
 * MCP client implementation
 */
export class MCPClient implements IMCPClient {
  private _state: MCPClientState = 'disconnected';
  private _capabilities: MCPServerCapabilities | null = null;
  private transport: MCPTransport;
  private serverInfo: { name: string; version: string } | null = null;

  constructor(private config: MCPServerConfig) {
    this.transport = createTransport(config);

    // Forward transport events
    this.transport.on('connect', () => {
      this._state = 'connected';
    });

    this.transport.on('disconnect', () => {
      this._state = 'disconnected';
    });

    this.transport.on('error', (error: Error) => {
      this._state = 'error';
      console.error(`MCP client error (${this.config.name}):`, error.message);
    });
  }

  get state(): MCPClientState {
    return this._state;
  }

  get capabilities(): MCPServerCapabilities | null {
    return this._capabilities;
  }

  async connect(): Promise<void> {
    if (this._state === 'connected') {
      return;
    }

    try {
      this._state = 'connecting';
      await this.transport.connect();

      // Send initialize request
      const initRequest: InitializeRequest = {
        protocolVersion: '2024-11-05',
        capabilities: {
          sampling: {},
        },
        clientInfo: {
          name: 'newma-cli',
          version: '1.0.0',
        },
      };

      const response = await this.sendRequest('initialize', initRequest);
      const initResponse = (response as unknown) as InitializeResponse;
      this._capabilities = initResponse.capabilities;
      this.serverInfo = initResponse.serverInfo;

      console.log(`Connected to MCP server: ${this.config.name}`);
      console.log(`  Server: ${this.serverInfo.name} v${this.serverInfo.version}`);
      console.log(`  Protocol: ${initResponse.protocolVersion}`);
    } catch (error) {
      this._state = 'error';
      throw new MCPConnectionError(
        `Failed to connect to MCP server ${this.config.name}: ${error}`,
        error as Error
      );
    }
  }

  async disconnect(): Promise<void> {
    if (this._state === 'disconnected') {
      return;
    }

    await this.transport.disconnect();
    this._state = 'disconnected';
    this._capabilities = null;
    this.serverInfo = null;
  }

  async listTools(): Promise<MCPTool[]> {
    this.ensureConnected();
    const response = await this.sendRequest('tools/list');
    return (response as any).tools || [];
  }

  async callTool(request: CallToolRequest): Promise<CallToolResponse> {
    this.ensureConnected();

    try {
      const response = await this.sendRequest('tools/call', request);
      return (response as unknown) as CallToolResponse;
    } catch (error) {
      throw new MCPToolError(
        `Failed to call tool ${request.name}: ${error}`,
        request.name,
        error as Error
      );
    }
  }

  async listResources(): Promise<MCPResource[]> {
    this.ensureConnected();
    const response = await this.sendRequest('resources/list');
    return (response as any).resources || [];
  }

  async readResource(uri: string): Promise<string> {
    this.ensureConnected();

    try {
      const response = await this.sendRequest('resources/read', { uri });
      const contents = (response as any).contents;
      return Array.isArray(contents) && contents.length > 0
        ? contents[0].text || ''
        : '';
    } catch (error) {
      throw new MCPError(`Failed to read resource ${uri}: ${error}`, -32603);
    }
  }

  async listPrompts(): Promise<MCPPrompt[]> {
    this.ensureConnected();
    const response = await this.sendRequest('prompts/list');
    return (response as any).prompts || [];
  }

  async getPrompt(name: string, args?: Record<string, unknown>): Promise<string> {
    this.ensureConnected();

    try {
      const response = await this.sendRequest('prompts/get', { name, arguments: args });
      const messages = (response as any).messages || [];
      return messages.map((m: any) => m.content?.text || '').join('\n');
    } catch (error) {
      throw new MCPError(`Failed to get prompt ${name}: ${error}`, -32603);
    }
  }

  private async sendRequest(method: string, params?: unknown): Promise<JSONRPCResponse> {
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    };

    return this.transport.send(request);
  }

  private ensureConnected(): void {
    if (this._state !== 'connected') {
      throw new MCPConnectionError(
        `MCP client ${this.config.name} is not connected (state: ${this._state})`
      );
    }
  }
}

// ============================================================================
// MCP Client Manager
// ============================================================================

/**
 * Manages multiple MCP clients
 */
export class MCPClientManager {
  private clients = new Map<string, MCPClient>();

  async addClient(name: string, config: MCPServerConfig): Promise<void> {
    if (config.disabled) {
      console.log(`Skipping disabled MCP server: ${name}`);
      return;
    }

    const client = new MCPClient(config);
    await client.connect();
    this.clients.set(name, client);
  }

  async removeClient(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      await client.disconnect();
      this.clients.delete(name);
    }
  }

  getClient(name: string): MCPClient | undefined {
    return this.clients.get(name);
  }

  getAllClients(): Map<string, MCPClient> {
    return this.clients;
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.values()).map(client => client.disconnect());
    await Promise.all(disconnectPromises);
    this.clients.clear();
  }

  async getAllTools(): Promise<Map<string, MCPTool[]>> {
    const tools = new Map<string, MCPTool[]>();

    for (const [name, client] of this.clients) {
      if (client.state === 'connected') {
        try {
          const clientTools = await client.listTools();
          tools.set(name, clientTools);
        } catch (error) {
          console.error(`Failed to list tools for ${name}:`, error);
        }
      }
    }

    return tools;
  }
}
