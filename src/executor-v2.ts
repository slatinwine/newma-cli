// src/executor-v2.ts
/**
 * Tool-based executor
 * Executes tools with permission checking and parallel execution support
 */

import { ToolCall, ToolContext, ToolResult } from './tools/types';
import { ToolRegistry as ToolRegistryClass } from './tools/registry';
import { PermissionManager, PermissionLevel } from './permissions';
import { ExecutionTracker } from './history';
import { RollbackManager } from './rollback';
import { Config } from './config';
import { HookSystem, HookType } from './hooks';
import { PluginSystem } from './plugins';
import chalk from 'chalk';
import { fileTool } from './tools/builtin/file';
import { commandTool } from './tools/builtin/command';
import { unixCommandTools } from './tools/builtin/unix-commands';
import { searchTool } from './tools/builtin/search';
import { webScrapeTool } from './tools/builtin/web-scrape';
import { searchAndFetchTool } from './tools/builtin/search-and-fetch';
import { MCPClientManager } from './mcp/client';
import { adaptAllMCPTools } from './mcp/tools/mcp-tool-adapter';
import { MCPServerConfig } from './mcp/types';

/**
 * Tool-based executor class
 */
export class ToolExecutor {
  private registry: ToolRegistryClass;
  private permissionManager: PermissionManager;
  private tracker: ExecutionTracker;
  private rollbackManager: RollbackManager;
  private context: ToolContext;
  private hookSystem?: HookSystem;
  private pluginSystem?: PluginSystem;
  private mcpManager: MCPClientManager;

  constructor(
    tracker: ExecutionTracker,
    rollbackManager: RollbackManager,
    config: Config,
    initialPermissionLevel: PermissionLevel = PermissionLevel.SAFE,
    hookSystem?: HookSystem,
    pluginSystem?: PluginSystem
  ) {
    this.tracker = tracker;
    this.rollbackManager = rollbackManager;
    this.hookSystem = hookSystem;
    this.pluginSystem = pluginSystem;

    // Create tool registry
    this.registry = new ToolRegistryClass();

    // Initially register builtin tools (plugins will be loaded later via initialize())
    this.registerBuiltinTools();

    // Create permission manager
    this.permissionManager = new PermissionManager(initialPermissionLevel);

    // Create MCP client manager
    this.mcpManager = new MCPClientManager();

    // Create tool context
    this.context = {
      root: process.cwd(),
      history: tracker,
      permissions: new Set(this.permissionManager.getGranted()) as any,
      config,
    };
  }

  /**
   * Initialize MCP clients (call after construction if MCP is enabled)
   */
  async initializeMCP(mcpServersConfig: Record<string, MCPServerConfig>): Promise<void> {
    if (Object.keys(mcpServersConfig).length === 0) {
      console.log(chalk.yellow('[MCP] No MCP servers configured'));
      return;
    }

    try {
      console.log(chalk.cyan('[MCP] Initializing MCP clients...'));

      // Connect to all configured MCP servers
      for (const [name, config] of Object.entries(mcpServersConfig)) {
        try {
          await this.mcpManager.addClient(name, config);
        } catch (error) {
          console.error(chalk.red(`[MCP] ❌ Failed to connect to ${name}:`), error);
        }
      }

      // Get all tools from all servers
      const allTools = await this.mcpManager.getAllTools();

      if (allTools.size === 0) {
        console.log(chalk.yellow('[MCP] No tools available from MCP servers'));
        return;
      }

      // Adapt MCP tools to Kode tools
      const adaptedTools = adaptAllMCPTools(
        allTools,
        this.mcpManager.getAllClients()
      );

      // Register adapted tools
      for (const tool of adaptedTools) {
        this.registry.register(tool);
      }

      console.log(chalk.green(`[MCP] ✅ Loaded ${adaptedTools.length} tool(s) from ${allTools.size} server(s)`));

      // Show tools by server
      for (const [serverName, tools] of allTools) {
        console.log(chalk.gray(`[MCP]    ${serverName}: ${tools.length} tool(s)`));
      }
    } catch (error) {
      console.error(chalk.red('[MCP] ❌ Failed to initialize MCP:'), error);
    }
  }

  /**
   * Get MCP client manager
   */
  getMCPManager(): MCPClientManager {
    return this.mcpManager;
  }

  /**
   * Initialize plugins (call after construction if plugin system is enabled)
   */
  async initializePlugins(config: Config): Promise<void> {
    if (!this.pluginSystem || !this.pluginSystem.isEnabled()) {
      return;
    }

    try {
      console.log(chalk.cyan('[PLUGIN] Loading plugins...'));

      // Initialize plugin system (discovers and loads plugins)
      await this.pluginSystem.initialize();

      const stats = this.pluginSystem.getStats();
      console.log(chalk.green(`[PLUGIN] ✅ Loaded ${stats.total} plugin(s)`));

      // Get plugin registry and register their tools
      const pluginRegistry = this.pluginSystem.getRegistry();
      const plugins = pluginRegistry.list();

      for (const plugin of plugins) {
        for (const tool of plugin.tools) {
          // Re-register tool (plugin tools override builtin tools)
          this.registry.register(tool);
        }
      }

      // Re-register fileTool (still needed)
      this.registry.register(fileTool);
    } catch (error) {
      console.error(chalk.red('[PLUGIN] ❌ Failed to load plugins:', error));
      console.log(chalk.yellow('[PLUGIN] Using builtin tools...'));
    }
  }

  /**
   * Register builtin tools (fallback)
   */
  private registerBuiltinTools(): void {
    if (this.pluginSystem?.isEnabled()) {
      console.log(chalk.yellow('[PLUGIN] ⚠️  Using builtin tools (plugins disabled)'));
    }

    this.registry.register(fileTool);
    this.registry.register(commandTool);
    this.registry.register(searchTool);
    this.registry.register(webScrapeTool);
    this.registry.register(searchAndFetchTool);

    // Register Unix command tools
    unixCommandTools.forEach(tool => this.registry.register(tool));
  }

  /**
   * Register additional tools
   */
  registerTool(tool: any): void {
    this.registry.register(tool);
  }

  /**
   * Get tool registry
   */
  getRegistry(): ToolRegistryClass {
    return this.registry;
  }

  /**
   * Get permission manager
   */
  getPermissionManager(): PermissionManager {
    return this.permissionManager;
  }

  /**
   * Get plugin system
   */
  getPluginSystem(): PluginSystem | undefined {
    return this.pluginSystem;
  }

  /**
   * Execute a single tool call
   */
  async executeToolCall(call: ToolCall): Promise<ToolResult> {
    const startTime = Date.now();

    // Execute beforeToolExecution hooks
    if (this.hookSystem && this.hookSystem.hasHooks(HookType.BEFORE_TOOL_EXECUTION)) {
      await this.hookSystem.execute(HookType.BEFORE_TOOL_EXECUTION, {
        data: {
          toolName: call.tool,
          params: call.parameters,
        },
        session: this.tracker as any, // TODO: Proper session type
        config: this.context.config,
      });
    }

    // Validate parameters
    const validation = this.registry.validateCall(call);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`,
      };
    }

    // Check permissions
    const tool = this.registry.get(call.tool)!;
    const requiredPermissions = tool.permissions;
    const missing = requiredPermissions.filter((p: any) => !(this.context.permissions as any).has(p));

    if (missing.length > 0) {
      // Request permissions from user
      const granted = await this.permissionManager.requestPermissions(missing, {
        action: {
          type: 'run', // Placeholder
          command: `${call.tool} ${JSON.stringify(call.parameters)}`,
        },
        riskLevel: this.assessToolRisk(tool),
        description: tool.description,
      });

      if (!granted) {
        return {
          success: false,
          error: `Permission denied: ${missing.join(', ')}`,
        };
      }

      // Update context with newly granted permissions
      missing.forEach((p: any) => (this.context.permissions as any).add(p));
    }

    // Execute tool
    const result = await this.registry.executeToolCall(call, this.context);
    const duration = Date.now() - startTime;

    // Execute afterToolExecution hooks
    if (this.hookSystem && this.hookSystem.hasHooks(HookType.AFTER_TOOL_EXECUTION)) {
      await this.hookSystem.execute(HookType.AFTER_TOOL_EXECUTION, {
        data: {
          toolName: call.tool,
          params: call.parameters,
          result,
          duration,
          success: result.success,
        },
        session: this.tracker as any, // TODO: Proper session type
        config: this.context.config,
      });
    }

    return result;
  }

  /**
   * Execute multiple tool calls in parallel (for independent actions)
   */
  async executeParallel(calls: ToolCall[]): Promise<ToolResult[]> {
    // Group by dependencies
    const groups = this.groupByDependencies(calls);

    const allResults: ToolResult[] = [];

    for (const group of groups) {
      // Execute group in parallel
      const groupPromises = group.map(call => this.executeToolCall(call));
      const groupResults = await Promise.all(groupPromises);
      allResults.push(...groupResults);

      // Check if any failed
      const hasFailure = groupResults.some(r => !r.success);
      if (hasFailure) {
        // Stop executing remaining groups
        break;
      }
    }

    return allResults;
  }

  /**
   * Execute a legacy action (backward compatibility)
   */
  async executeAction(
    action: any,
    rollbackManager?: RollbackManager
  ): Promise<{ success: boolean; error?: string; rollbackData?: any; duration: number }> {
    // Convert action to tool call
    const call = this.registry.actionToToolCall(action);

    // Execute tool call
    const result = await this.executeToolCall(call);

    return {
      success: result.success,
      error: result.error,
      duration: 0,
    };
  }

  /**
   * Group tool calls by dependencies
   */
  private groupByDependencies(calls: ToolCall[]): ToolCall[][] {
    const groups: ToolCall[][] = [];
    const executed = new Set<string>();
    const pending = new Set(calls.map(c => c.id));

    while (pending.size > 0) {
      const currentGroup: ToolCall[] = [];

      for (const call of calls) {
        if (executed.has(call.id)) continue;

        // Check if all dependencies are satisfied
        const deps = call.dependencies || [];
        const depsSatisfied = deps.every(dep => executed.has(dep));

        if (depsSatisfied) {
          currentGroup.push(call);
          executed.add(call.id);
          pending.delete(call.id);
        }
      }

      if (currentGroup.length === 0) {
        // Circular dependency or missing dependency
        // Execute remaining calls sequentially
        for (const call of calls) {
          if (!executed.has(call.id)) {
            currentGroup.push(call);
            executed.add(call.id);
            pending.delete(call.id);
          }
        }
      }

      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * Assess tool risk level
   */
  private assessToolRisk(tool: any): 'low' | 'medium' | 'high' {
    if (tool.permissions.includes((this.permissionManager as any).Permission?.DELETE_FILES)) {
      return 'high';
    }

    if (tool.name === 'command') {
      return 'medium';
    }

    return 'low';
  }
}
