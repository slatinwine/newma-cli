/**
 * MCP (Model Context Protocol) Type Definitions
 *
 * This file defines the types for MCP client and server implementation,
 * based on the MCP specification and @modelcontextprotocol/sdk.
 */

import { Tool, Permission } from '../tools/types';

// ============================================================================
// MCP Server Configuration
// ============================================================================

/**
 * Configuration for an MCP server
 */
export interface MCPServerConfig {
  /** Unique identifier for this server */
  name: string;
  /** Command to start the server process */
  command: string;
  /** Arguments to pass to the command */
  args: string[];
  /** Environment variables to set (optional) */
  env?: Record<string, string>;
  /** Whether this server is disabled */
  disabled?: boolean;
  /** Transport type (stdio or websocket) */
  transport?: 'stdio' | 'websocket';
  /** WebSocket URL (required if transport is 'websocket') */
  url?: string;
}

/**
 * MCP configuration in .koderc.json
 */
export interface MCPConfig {
  /** Map of server name to configuration */
  mcpServers: Record<string, MCPServerConfig>;
}

// ============================================================================
// MCP Protocol Types (based on MCP specification)
// ============================================================================

/**
 * JSON-RPC request format
 */
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC response format
 */
export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: JSONRPCError;
}

/**
 * JSON-RPC error format
 */
export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * MCP tool definition (from server)
 */
export interface MCPTool {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** JSON schema for input parameters */
  inputSchema: Record<string, unknown>;
}

/**
 * MCP resource definition (from server)
 */
export interface MCPResource {
  /** Resource URI */
  uri: string;
  /** Resource name */
  name: string;
  /** Resource description */
  description?: string;
  /** MIME type */
  mimeType?: string;
}

/**
 * MCP prompt definition (from server)
 */
export interface MCPPrompt {
  /** Prompt name */
  name: string;
  /** Prompt description */
  description?: string;
  /** Prompt arguments */
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

/**
 * MCP server capabilities
 */
export interface MCPServerCapabilities {
  /** Server supports tools */
  tools?: {};
  /** Server supports resources */
  resources?: {};
  /** Server supports prompts */
  prompts?: {};
  /** Experimental capabilities */
  experimental?: Record<string, unknown>;
}

/**
 * Initialize request from client
 */
export interface InitializeRequest {
  protocolVersion: string;
  capabilities: {
    roots?: {
      listChanged?: boolean;
    };
    sampling?: {};
  };
  clientInfo: {
    name: string;
    version: string;
  };
}

/**
 * Initialize response from server
 */
export interface InitializeResponse {
  protocolVersion: string;
  capabilities: MCPServerCapabilities;
  serverInfo: {
    name: string;
    version: string;
  };
}

// ============================================================================
// MCP Tool Execution Types
// ============================================================================

/**
 * Request to call a tool
 */
export interface CallToolRequest {
  name: string;
  arguments?: Record<string, unknown>;
}

/**
 * Response from calling a tool
 */
export interface CallToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// ============================================================================
// MCP Client Types
// ============================================================================

/**
 * MCP client state
 */
export type MCPClientState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * MCP client interface
 */
export interface IMCPClient {
  /** Client state */
  readonly state: MCPClientState;
  /** Server capabilities */
  readonly capabilities: MCPServerCapabilities | null;
  /** Connect to the server */
  connect(): Promise<void>;
  /** Disconnect from the server */
  disconnect(): Promise<void>;
  /** List available tools */
  listTools(): Promise<MCPTool[]>;
  /** Call a tool */
  callTool(request: CallToolRequest): Promise<CallToolResponse>;
  /** List available resources */
  listResources(): Promise<MCPResource[]>;
  /** Read a resource */
  readResource(uri: string): Promise<string>;
  /** List available prompts */
  listPrompts(): Promise<MCPPrompt[]>;
  /** Get a prompt */
  getPrompt(name: string, args?: Record<string, unknown>): Promise<string>;
}

// ============================================================================
// MCP Server Types
// ============================================================================

/**
 * MCP server handler context
 */
export interface MCPContext {
  /** Request ID */
  requestId: number | string;
}

/**
 * MCP server handlers
 */
export interface MCPServerHandlers {
  /** Handle tool list request */
  listTools?: () => Promise<MCPTool[]>;
  /** Handle tool call request */
  callTool?: (request: CallToolRequest, context: MCPContext) => Promise<CallToolResponse>;
  /** Handle resource list request */
  listResources?: () => Promise<MCPResource[]>;
  /** Handle resource read request */
  readResource?: (uri: string, context: MCPContext) => Promise<string>;
  /** Handle prompt list request */
  listPrompts?: () => Promise<MCPPrompt[]>;
  /** Handle get prompt request */
  getPrompt?: (name: string, args: Record<string, unknown>, context: MCPContext) => Promise<string>;
}

// ============================================================================
// MCP to Kode Tool Adapter Types
// ============================================================================

/**
 * Adapter configuration
 */
export interface MCPToolAdapterConfig {
  /** Prefix to add to tool names (e.g., 'mcp', 'filesystem') */
  prefix?: string;
  /** Permission level for adapted tools (default: safe operations) */
  permissionLevel?: Permission[];
  /** Whether to include server name in tool name */
  includeServerName?: boolean;
}

/**
 * Adapted Kode tool from MCP tool
 */
export interface AdaptedTool extends Tool {
  /** Original MCP tool name */
  mcpToolName: string;
  /** MCP server name */
  serverName: string;
  /** MCP client that provides this tool */
  client: IMCPClient;
}

// ============================================================================
// Codex-Specific Types (for compatibility)
// ============================================================================

/**
 * Codex sandbox state capability
 * Based on Codex's experimental codex/sandbox-state capability
 */
export interface CodexSandboxState {
  /** Version of the capability */
  version: string;
  /** Current sandbox state */
  state: 'enabled' | 'disabled' | 'partial';
  /** Allowed operations */
  allowedOperations: string[];
  /** Blocked operations */
  blockedOperations: string[];
}

/**
 * Experimental capabilities (Codex-compatible)
 */
export interface ExperimentalCapabilities {
  /** Codex sandbox state capability */
  'codex/sandbox-state'?: CodexSandboxState;
}

// ============================================================================
// Errors
// ============================================================================

/**
 * MCP error types
 */
export class MCPError extends Error {
  constructor(
    message: string,
    public code: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

/**
 * MCP connection error
 */
export class MCPConnectionError extends MCPError {
  constructor(message: string, public cause?: Error) {
    super(message, -32603); // Internal error
    this.name = 'MCPConnectionError';
  }
}

/**
 * MCP tool execution error
 */
export class MCPToolError extends MCPError {
  constructor(
    message: string,
    public toolName: string,
    public cause?: Error
  ) {
    super(message, -32603); // Internal error
    this.name = 'MCPToolError';
  }
}
