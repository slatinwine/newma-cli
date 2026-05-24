/**
 * MCP Server Implementation
 *
 * Server implementation that exposes Kode's capabilities via MCP protocol.
 * Allows other applications to use Kode as an MCP server.
 */

import { EventEmitter } from 'events';
import {
  MCPServerHandlers,
  MCPContext,
  JSONRPCRequest,
  JSONRPCResponse,
  MCPServerCapabilities,
  MCPTool,
  MCPResource,
  MCPPrompt,
  InitializeRequest,
  InitializeResponse,
  CallToolRequest,
  CallToolResponse,
} from './types';
import { ToolRegistry } from '../tools/registry';

// ============================================================================
// MCP Server
// ============================================================================

/**
 * MCP server implementation
 */
export class MCPServer extends EventEmitter {
  private initialized = false;
  private serverCapabilities: MCPServerCapabilities;

  constructor(
    private handlers: MCPServerHandlers,
    private serverInfo: { name: string; version: string } = {
      name: 'newma-cli',
      version: '1.0.0',
    }
  ) {
    super();

    // Build capabilities from provided handlers
    this.serverCapabilities = {
      ...(handlers.listTools && { tools: {} }),
      ...(handlers.listResources && { resources: {} }),
      ...(handlers.listPrompts && { prompts: {} }),
    };
  }

  /**
   * Handle incoming JSON-RPC request
   */
  async handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const { method, params, id } = request;

    try {
      // Handle initialize
      if (method === 'initialize') {
        return await this.handleInitialize(params as InitializeRequest, id);
      }

      // Check if initialized
      if (!this.initialized) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32002,
            message: 'Server not initialized',
          },
        };
      }

      // Handle methods
      switch (method) {
        case 'tools/list':
          return await this.handleListTools(id);

        case 'tools/call':
          return await this.handleCallTool(params as CallToolRequest, id);

        case 'resources/list':
          return await this.handleListResources(id);

        case 'resources/read':
          return await this.handleReadResource(params as { uri: string }, id);

        case 'prompts/list':
          return await this.handleListPrompts(id);

        case 'prompts/get':
          return await this.handleGetPrompt(params as { name: string; arguments?: Record<string, unknown> }, id);

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Method not found: ${method}`,
            },
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: `Internal error: ${error}`,
          data: error,
        },
      };
    }
  }

  private async handleInitialize(
    params: InitializeRequest,
    id: number | string
  ): Promise<JSONRPCResponse> {
    const response: InitializeResponse = {
      protocolVersion: '2024-11-05',
      capabilities: this.serverCapabilities,
      serverInfo: this.serverInfo,
    };

    this.initialized = true;
    this.emit('initialized');

    return {
      jsonrpc: '2.0',
      id,
      result: response,
    };
  }

  private async handleListTools(id: number | string): Promise<JSONRPCResponse> {
    if (!this.handlers.listTools) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: 'Tools not supported',
        },
      };
    }

    const tools = await this.handlers.listTools();

    return {
      jsonrpc: '2.0',
      id,
      result: { tools },
    };
  }

  private async handleCallTool(
    params: CallToolRequest,
    id: number | string
  ): Promise<JSONRPCResponse> {
    if (!this.handlers.callTool) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: 'Tool calling not supported',
        },
      };
    }

    const context: MCPContext = { requestId: id };
    const result = await this.handlers.callTool(params, context);

    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  }

  private async handleListResources(id: number | string): Promise<JSONRPCResponse> {
    if (!this.handlers.listResources) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: 'Resources not supported',
        },
      };
    }

    const resources = await this.handlers.listResources();

    return {
      jsonrpc: '2.0',
      id,
      result: { resources },
    };
  }

  private async handleReadResource(
    params: { uri: string },
    id: number | string
  ): Promise<JSONRPCResponse> {
    if (!this.handlers.readResource) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: 'Resource reading not supported',
        },
      };
    }

    const content = await this.handlers.readResource(params.uri, { requestId: id });

    return {
      jsonrpc: '2.0',
      id,
      result: {
        contents: [
          {
            uri: params.uri,
            mimeType: 'text/plain',
            text: content,
          },
        ],
      },
    };
  }

  private async handleListPrompts(id: number | string): Promise<JSONRPCResponse> {
    if (!this.handlers.listPrompts) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: 'Prompts not supported',
        },
      };
    }

    const prompts = await this.handlers.listPrompts();

    return {
      jsonrpc: '2.0',
      id,
      result: { prompts },
    };
  }

  private async handleGetPrompt(
    params: { name: string; arguments?: Record<string, unknown> },
    id: number | string
  ): Promise<JSONRPCResponse> {
    if (!this.handlers.getPrompt) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: 'Prompts not supported',
        },
      };
    }

    const content = await this.handlers.getPrompt(
      params.name,
      params.arguments || {},
      { requestId: id }
    );

    return {
      jsonrpc: '2.0',
      id,
      result: {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: content,
            },
          },
        ],
      },
    };
  }
}

// ============================================================================
// Server Factory (for Kode)
// ============================================================================

/**
 * Create MCP server from Kode's tool registry
 */
export function createMCPServerFromRegistry(registry: ToolRegistry): MCPServer {
  const handlers: MCPServerHandlers = {
    // List all registered tools as MCP tools
    async listTools(): Promise<MCPTool[]> {
      const tools = registry.list();

      return tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: 'object',
          properties: tool.parameters || {},
          required: (tool.parameters || []).filter(p => p.required).map(p => p.name),
        },
      }));
    },

    // Handle tool calls
    async callTool(request: CallToolRequest, context: MCPContext): Promise<CallToolResponse> {
      try {
        const call = {
          id: String(context.requestId),
          tool: request.name,
          parameters: request.arguments || {},
        };

        const result = await registry.executeToolCall(call, {
          root: process.cwd(),
          history: null as any, // TODO: Provide proper history
          permissions: new Set(),
          config: {} as any, // TODO: Provide proper config
        });

        if (result.success) {
          return {
            content: [
              {
                type: 'text',
                text: result.output || '',
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: result.error || 'Unknown error',
              },
            ],
            isError: true,
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error}`,
            },
          ],
          isError: true,
        };
      }
    },
  };

  return new MCPServer(handlers);
}

// ============================================================================
// stdio Server Mode
// ============================================================================

/**
 * Run MCP server in stdio mode
 */
export async function runStdioServer(server: MCPServer): Promise<void> {
  let buffer = '';

  // Read from stdin
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (data: string) => {
    buffer += data;

    // Process complete JSON-RPC messages (one per line)
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const request: JSONRPCRequest = JSON.parse(line);
        server.handleRequest(request).then(response => {
          process.stdout.write(JSON.stringify(response) + '\n');
        });
      } catch (error) {
        const errorResponse: JSONRPCResponse = {
          jsonrpc: '2.0',
          id: -1,
          error: {
            code: -32700,
            message: `Parse error: ${error}`,
          },
        };
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    }
  });

  // Handle shutdown
  process.on('SIGINT', () => {
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    process.exit(0);
  });
}
