/**
 * MCP Tool Adapter
 *
 * Adapts MCP tools to Kode's Tool interface, allowing MCP tools
 * to be used in the Kode executor.
 */

import {
  Tool,
  ToolCategory,
  ToolResult,
  ToolContext,
  Permission,
} from '../../tools/types';
import {
  MCPTool,
  IMCPClient,
  AdaptedTool,
  MCPToolAdapterConfig,
  CallToolRequest,
  MCPToolError,
} from '../types';

// ============================================================================
// Tool Adapter
// ============================================================================

/**
 * Adapt an MCP tool to a Kode tool
 */
export function adaptMCPTool(
  mcpTool: MCPTool,
  serverName: string,
  client: IMCPClient,
  config: MCPToolAdapterConfig = {}
): AdaptedTool {
  const {
    prefix = 'mcp',
    includeServerName = true,
    permissionLevel = [Permission.READ_FILES],
  } = config;

  // Build tool name with prefix and server name
  const parts = [prefix];
  if (includeServerName) {
    parts.push(serverName);
  }
  parts.push(mcpTool.name);
  const toolName = parts.join('.');

  // Determine category based on tool name
  const category = inferCategory(mcpTool.name, mcpTool.description);

  // Build full description
  const description = includeServerName
    ? `[MCP:${serverName}] ${mcpTool.description}`
    : mcpTool.description;

  // Create the adapted tool
  const adaptedTool: AdaptedTool = {
    name: toolName,
    description,
    category,
    permissions: permissionLevel,
    mcpToolName: mcpTool.name,
    serverName,
    client,
    parameters: [], // MCP tools define their own parameters in inputSchema
    handler: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
      try {
        const request: CallToolRequest = {
          name: mcpTool.name,
          arguments: params,
        };

        const response = await client.callTool(request);

        if (response.isError) {
          return {
            success: false,
            error: response.content
              .map(c => c.text || '')
              .join('\n'),
          };
        }

        // Extract text content
        const output = response.content
          .map(c => c.type === 'text' ? c.text : `[${c.type} content]`)
          .join('\n');

        return {
          success: true,
          output,
        };
      } catch (error) {
        if (error instanceof MCPToolError) {
          return {
            success: false,
            error: error.message,
          };
        }

        return {
          success: false,
          error: `Tool execution failed: ${error}`,
        };
      }
    },
  };

  return adaptedTool;
}

/**
 * Adapt multiple MCP tools from multiple servers
 */
export function adaptAllMCPTools(
  toolsByServer: Map<string, MCPTool[]>,
  clients: Map<string, IMCPClient>,
  config: MCPToolAdapterConfig = {}
): AdaptedTool[] {
  const adaptedTools: AdaptedTool[] = [];

  for (const [serverName, tools] of toolsByServer) {
    const client = clients.get(serverName);
    if (!client) {
      console.warn(`No client found for server: ${serverName}`);
      continue;
    }

    for (const tool of tools) {
      try {
        const adapted = adaptMCPTool(tool, serverName, client, config);
        adaptedTools.push(adapted);
      } catch (error) {
        console.error(`Failed to adapt tool ${tool.name} from ${serverName}:`, error);
      }
    }
  }

  return adaptedTools;
}

// ============================================================================
// Category Inference
// ============================================================================

/**
 * Infer tool category from name and description
 */
function inferCategory(name: string, description: string): ToolCategory {
  const lowerName = name.toLowerCase();
  const lowerDesc = description.toLowerCase();

  // File operations
  if (lowerName.includes('file') || lowerName.includes('read') || lowerName.includes('write')) {
    return ToolCategory.FILE;
  }

  // Git operations
  if (lowerName.includes('git') || lowerDesc.includes('git')) {
    return ToolCategory.VERSION_CONTROL;
  }

  // Search operations
  if (lowerName.includes('search') || lowerName.includes('find') || lowerName.includes('query')) {
    return ToolCategory.SEARCH;
  }

  // Execution operations
  if (lowerName.includes('run') || lowerName.includes('exec') || lowerName.includes('command')) {
    return ToolCategory.EXECUTION;
  }

  // Analysis operations
  if (lowerName.includes('analyze') || lowerName.includes('parse') || lowerName.includes('lint')) {
    return ToolCategory.ANALYSIS;
  }

  // Database operations
  if (lowerName.includes('database') || lowerName.includes('db') || lowerName.includes('sql')) {
    return ToolCategory.DATABASE;
  }

  // Network operations
  if (lowerName.includes('http') || lowerName.includes('fetch') || lowerName.includes('request')) {
    return ToolCategory.NETWORK;
  }

  // Default to system
  return ToolCategory.SYSTEM;
}

// ============================================================================
// Tool Registry Helpers
// ============================================================================

/**
 * Group adapted tools by server
 */
export function groupToolsByServer(tools: AdaptedTool[]): Map<string, AdaptedTool[]> {
  const grouped = new Map<string, AdaptedTool[]>();

  for (const tool of tools) {
    const serverTools = grouped.get(tool.serverName) || [];
    serverTools.push(tool);
    grouped.set(tool.serverName, serverTools);
  }

  return grouped;
}

/**
 * Get tool statistics
 */
export function getToolStats(tools: AdaptedTool[]): {
  total: number;
  byServer: Map<string, number>;
  byCategory: Map<ToolCategory, number>;
} {
  const byServer = new Map<string, number>();
  const byCategory = new Map<ToolCategory, number>();

  for (const tool of tools) {
    // Count by server
    byServer.set(tool.serverName, (byServer.get(tool.serverName) || 0) + 1);

    // Count by category
    byCategory.set(tool.category, (byCategory.get(tool.category) || 0) + 1);
  }

  return {
    total: tools.length,
    byServer,
    byCategory,
  };
}
