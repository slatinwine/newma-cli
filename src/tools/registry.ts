// src/tools/registry.ts
/**
 * Tool registry for centralized tool management
 */

import {
  Tool,
  ToolCall,
  ToolResult,
  ToolContext,
  Permission,
  ValidationResult,
} from './types';

/**
 * Tool registry class
 */
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * Register a tool
   *
   * override: 插件工具覆盖同名内置工具时使用；
   * 默认重复注册仍抛错（暴露真实的注册冲突）
   */
  register(tool: Tool, options: { override?: boolean } = {}): void {
    if (this.tools.has(tool.name) && !options.override) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Unregister a tool
   */
  unregister(toolId: string): void {
    this.tools.delete(toolId);
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * List all tools or filter by category
   */
  list(category?: string): Tool[] {
    const allTools = Array.from(this.tools.values());
    if (!category) {
      return allTools;
    }
    return allTools.filter(t => t.category === category);
  }

  /**
   * Find tools by capability (search in name/description)
   */
  find(capability: string): Tool[] {
    const search = capability.toLowerCase();
    return Array.from(this.tools.values()).filter(
      tool =>
        tool.name.toLowerCase().includes(search) ||
        tool.description.toLowerCase().includes(search)
    );
  }

  /**
   * Check if a tool has all required permissions
   */
  hasPermission(tool: Tool, granted: Set<Permission>): boolean {
    return tool.permissions.every(p => granted.has(p));
  }

  /**
   * Get missing permissions for a tool
   */
  getMissingPermissions(tool: Tool, granted: Set<Permission>): Permission[] {
    return tool.permissions.filter(p => !granted.has(p));
  }

  /**
   * Convert legacy Action to ToolCall
   */
  actionToToolCall(action: any): ToolCall {
    switch (action.type) {
      case 'create':
      case 'modify':
      case 'delete':
        return {
          tool: 'file',
          id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          parameters: {
            operation: action.type,
            path: action.path,
            content: action.content,
          },
        };

      case 'run':
      case 'verify':
        return {
          tool: 'command',
          id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          parameters: {
            command: action.command,
            timeout: 30000,
          },
        };

      default:
        throw new Error(`Unsupported action type: ${(action as any).type}`);
    }
  }

  /**
   * Validate tool call parameters
   */
  validateCall(call: ToolCall): ValidationResult {
    const tool = this.get(call.tool);
    if (!tool) {
      return {
        valid: false,
        errors: [`Tool not found: ${call.tool}`],
      };
    }

    // Use tool's custom validator if available
    if (tool.validate) {
      return tool.validate(call.parameters);
    }

    // Default validation
    const errors: string[] = [];
    for (const param of tool.parameters) {
      if (param.required && !(param.name in call.parameters)) {
        errors.push(`Missing required parameter: ${param.name}`);
      }

      if (param.type === 'enum' && param.values) {
        const value = call.parameters[param.name];
        if (value !== undefined && !param.values.includes(String(value))) {
          errors.push(
            `Invalid value for ${param.name}: must be one of ${param.values.join(', ')}`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Execute a tool call with permission checking
   */
  async executeToolCall(
    call: ToolCall,
    context: ToolContext,
    permissionManager?: any // Will be PermissionManager when implemented
  ): Promise<ToolResult> {
    const tool = this.get(call.tool);
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${call.tool}`,
      };
    }

    // Validate parameters
    const validation = this.validateCall(call);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`,
      };
    }

    // Check permissions
    const missing = this.getMissingPermissions(tool, context.permissions);
    if (missing.length > 0) {
      return {
        success: false,
        error: `Permission denied: ${missing.join(', ')} required`,
      };
    }

    // Execute tool
    try {
      const result = await tool.handler(call.parameters, context);

      // Post-execution hook
      if (tool.postExecute) {
        await tool.postExecute(result, context);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get tool descriptions for LLM
   */
  getToolDescriptions(): string {
    const tools = this.list();
    return tools
      .map(
        tool => `- ${tool.name}: ${tool.description}\n  Permissions: ${tool.permissions.join(', ')}`
      )
      .join('\n');
  }
}
