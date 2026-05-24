/**
 * MCP (Model Context Protocol) 客户端
 *
 * 实现 Model Context Protocol 客户端功能：
 * - 连接 MCP 服务器（stdio 和 SSE 两种传输方式）
 * - 发现服务器提供的工具、资源、提示词
 * - 调用 MCP 工具并转发结果
 * - 心跳检测和自动重连
 * - 与 newma 工具系统集成
 *
 * @author Newma (牛码) Development Team
 * @version 1.0.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

/**
 * MCP 传输协议类型
 */
export type MCPTransportType = 'stdio' | 'sse';

/**
 * MCP 服务器配置
 */
export interface MCPServerConfig {
  /** 服务器唯一标识 */
  id: string;
  /** 传输协议类型 */
  transport: MCPTransportType;
  /** 服务器名称 */
  name: string;
  /** 服务器描述 */
  description?: string;

  // stdio 配置
  /** 命令行（stdio 模式） */
  command?: string;
  /** 命令参数（stdio 模式） */
  args?: string[];
  /** 工作目录（stdio 模式） */
  cwd?: string;
  /** 环境变量（stdio 模式） */
  env?: Record<string, string>;

  // SSE 配置
  /** SSE 端点 URL（sse 模式） */
  url?: string;
  /** SSE 连接超时（毫秒） */
  timeout?: number;

  /** 是否启用 */
  enabled?: boolean;
  /** 心跳间隔（秒） */
  heartbeatInterval?: number;
  /** 重连间隔（毫秒） */
  reconnectInterval?: number;
  /** 最大重连次数 */
  maxReconnectAttempts?: number;
}

/**
 * MCP 配置文件
 */
export interface MCPConfig {
  version: string;
  servers: MCPServerConfig[];
}

/**
 * MCP 工具定义
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

/**
 * MCP 资源定义
 */
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * MCP 提示词定义
 */
export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

/**
 * MCP 工具调用参数
 */
export interface MCPToolCallParams extends Record<string, unknown> {
  name: string;
  arguments?: Record<string, unknown>;
}

/**
 * MCP 工具调用结果
 */
export interface MCPToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    uri?: string;
  }>;
  isError?: boolean;
}

/**
 * MCP JSON-RPC 请求
 */
interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * MCP JSON-RPC 响应
 */
interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * MCP 传输层接口
 */
abstract class MCPTransport extends EventEmitter {
  abstract send(request: JSONRPCRequest): Promise<JSONRPCResponse>;
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract isConnected(): boolean;
}

/**
 * stdio 传输实现
 */
class StdioTransport extends MCPTransport {
  private process?: ChildProcess;
  private messageId = 0;
  private pendingRequests: Map<number | string, {
    resolve: (value: JSONRPCResponse) => void;
    reject: (reason: Error) => void;
  }> = new Map();

  constructor(private config: MCPServerConfig) {
    super();
  }

  async connect(): Promise<void> {
    if (!this.config.command) {
      throw new Error('stdio 模式需要配置 command');
    }

    return new Promise((resolve, reject) => {
      this.process = spawn(this.config.command!, this.config.args || [], {
        cwd: this.config.cwd,
        env: { ...process.env, ...this.config.env },
        stdio: ['pipe', 'pipe', 'inherit'],
      });

      let buffer = '';

      this.process.stdout?.on('data', (data: Buffer) => {
        buffer += data.toString();

        // 处理完整的 JSON-RPC 响应
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const response: JSONRPCResponse = JSON.parse(line);
              this.handleResponse(response);
            } catch (error) {
              this.emit('error', new Error(`解析响应失败: ${error}`));
            }
          }
        }
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        this.emit('error', new Error(`stderr: ${data.toString()}`));
      });

      this.process.on('error', (error) => {
        reject(error);
      });

      this.process.on('exit', (code, signal) => {
        this.emit('disconnected', { code, signal });
      });

      // 等待一小段时间确保进程启动
      setTimeout(resolve, 100);
    });
  }

  async send(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(request.id, { resolve, reject });

      const message = JSON.stringify(request) + '\n';
      this.process?.stdin?.write(message);

      // 设置超时
      setTimeout(() => {
        if (this.pendingRequests.has(request.id)) {
          this.pendingRequests.delete(request.id);
          reject(new Error('请求超时'));
        }
      }, this.config.timeout || 30000);
    });
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = undefined;
    }
    this.pendingRequests.clear();
  }

  isConnected(): boolean {
    return this.process !== undefined && !this.process.killed;
  }

  private handleResponse(response: JSONRPCResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      this.pendingRequests.delete(response.id);
      pending.resolve(response);
    }
  }
}

/**
 * SSE 传输实现（简化版）
 */
class SSETransport extends MCPTransport {
  private messageId = 0;
  private pendingRequests: Map<number | string, {
    resolve: (value: JSONRPCResponse) => void;
    reject: (reason: Error) => void;
  }> = new Map();
  private connected = false;

  constructor(private config: MCPServerConfig) {
    super();
  }

  async connect(): Promise<void> {
    if (!this.config.url) {
      throw new Error('sse 模式需要配置 url');
    }

    // SSE 实现需要使用 SSE 客户端库
    // 这里提供简化版接口，实际实现需要根据具体库调整
    this.connected = true;
    this.emit('connected');
  }

  async send(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    // SSE 实现需要通过 HTTP POST 发送请求
    // 这里提供简化版接口
    throw new Error('SSE 传输暂未完全实现');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.pendingRequests.clear();
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * MCP 客户端类
 */
export class MCPClient extends EventEmitter {
  /** 服务器配置 */
  private config: MCPServerConfig;
  /** 传输层 */
  private transport?: MCPTransport;
  /** 是否已连接 */
  private connected = false;
  /** 心跳定时器 */
  private heartbeatTimer?: NodeJS.Timeout;
  /** 重连计数 */
  private reconnectCount = 0;

  constructor(config: MCPServerConfig) {
    super();
    this.config = { ...config };
  }

  /**
   * 连接到 MCP 服务器
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      // 创建传输层
      if (this.config.transport === 'stdio') {
        this.transport = new StdioTransport(this.config);
      } else if (this.config.transport === 'sse') {
        this.transport = new SSETransport(this.config);
      } else {
        throw new Error(`不支持的传输类型: ${this.config.transport}`);
      }

      // 监听传输层事件
      this.transport.on('disconnected', () => {
        this.connected = false;
        this.handleDisconnect();
      });

      this.transport.on('error', (error: Error) => {
        this.emit('error', error);
      });

      // 连接
      await this.transport.connect();
      this.connected = true;
      this.reconnectCount = 0;

      // 初始化
      await this.initialize();

      // 启动心跳
      this.startHeartbeat();

      this.emit('connected');
    } catch (error) {
      this.handleDisconnect();
      throw error;
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.stopHeartbeat();

    if (this.transport) {
      await this.transport.disconnect();
      this.transport = undefined;
    }

    this.connected = false;
    this.emit('disconnected');
  }

  /**
   * 初始化（握手）
   */
  private async initialize(): Promise<void> {
    // 发送 initialize 请求
    const response = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'newma',
        version: '3.4.0',
      },
    });

    // 发送 initialized 通知
    await this.sendNotification('notifications/initialized');
  }

  /**
   * 获取服务器提供的工具列表
   */
  async listTools(): Promise<MCPTool[]> {
    const response = await this.sendRequest('tools/list');

    if (response.result && typeof response.result === 'object') {
      const result = response.result as Record<string, unknown>;
      return (result.tools as MCPTool[]) || [];
    }

    return [];
  }

  /**
   * 调用工具
   */
  async callTool(params: MCPToolCallParams): Promise<MCPToolCallResult> {
    const response = await this.sendRequest('tools/call', params);

    if (response.result && typeof response.result === 'object') {
      return response.result as MCPToolCallResult;
    }

    throw new Error('无效的工具调用响应');
  }

  /**
   * 获取服务器提供的资源列表
   */
  async listResources(): Promise<MCPResource[]> {
    const response = await this.sendRequest('resources/list');

    if (response.result && typeof response.result === 'object') {
      const result = response.result as Record<string, unknown>;
      return (result.resources as MCPResource[]) || [];
    }

    return [];
  }

  /**
   * 读取资源内容
   */
  async readResource(uri: string): Promise<string> {
    const response = await this.sendRequest('resources/read', { uri });

    if (response.result && typeof response.result === 'object') {
      const result = response.result as Record<string, unknown>;
      const contents = result.contents as Array<{ text?: string }>;

      if (contents && contents.length > 0 && contents[0].text) {
        return contents[0].text;
      }
    }

    throw new Error('无法读取资源');
  }

  /**
   * 获取服务器提供的提示词列表
   */
  async listPrompts(): Promise<MCPPrompt[]> {
    const response = await this.sendRequest('prompts/list');

    if (response.result && typeof response.result === 'object') {
      const result = response.result as Record<string, unknown>;
      return (result.prompts as MCPPrompt[]) || [];
    }

    return [];
  }

  /**
   * 获取提示词内容
   */
  async getPrompt(name: string, args?: Record<string, unknown>): Promise<string> {
    const response = await this.sendRequest('prompts/get', { name, arguments: args });

    if (response.result && typeof response.result === 'object') {
      const result = response.result as Record<string, unknown>;
      const messages = result.messages as Array<{ content: { text?: string } }>;

      if (messages && messages.length > 0 && messages[0].content?.text) {
        return messages[0].content.text;
      }
    }

    throw new Error('无法获取提示词');
  }

  /**
   * 发送 JSON-RPC 请求
   */
  private async sendRequest(
    method: string,
    params?: Record<string, unknown>
  ): Promise<JSONRPCResponse> {
    if (!this.transport || !this.connected) {
      throw new Error('未连接到 MCP 服务器');
    }

    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: this.generateId(),
      method,
      params,
    };

    const response = await this.transport.send(request);

    if (response.error) {
      throw new Error(`MCP 错误: ${response.error.message}`);
    }

    return response;
  }

  /**
   * 发送 JSON-RPC 通知（无需响应）
   */
  private async sendNotification(
    method: string,
    params?: Record<string, unknown>
  ): Promise<void> {
    if (!this.transport || !this.connected) {
      throw new Error('未连接到 MCP 服务器');
    }

    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: this.generateId(),
      method,
      params,
    };

    await this.transport.send(request);
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): number {
    return Date.now() + Math.random();
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    const interval = (this.config.heartbeatInterval || 30) * 1000;

    this.heartbeatTimer = setInterval(async () => {
      try {
        // 发送 ping 请求
        await this.sendRequest('ping');
      } catch (error) {
        this.emit('error', new Error('心跳失败'));
        this.handleDisconnect();
      }
    }, interval);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * 处理断开连接
   */
  private async handleDisconnect(): Promise<void> {
    this.stopHeartbeat();

    const maxAttempts = this.config.maxReconnectAttempts || 5;
    const interval = this.config.reconnectInterval || 5000;

    if (this.reconnectCount < maxAttempts) {
      this.reconnectCount++;

      this.emit('reconnecting', {
        attempt: this.reconnectCount,
        maxAttempts,
      });

      setTimeout(async () => {
        try {
          await this.connect();
        } catch (error) {
          this.emit('error', new Error(`重连失败: ${error}`));
        }
      }, interval);
    } else {
      this.emit('reconnectFailed');
    }
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connected && this.transport?.isConnected() || false;
  }
}

/**
 * MCP 管理器（管理多个服务器）
 */
export class MCPManager extends EventEmitter {
  /** 配置文件路径 */
  private readonly configPath: string;
  /** MCP 配置 */
  private config?: MCPConfig;
  /** 客户端实例 */
  private readonly clients: Map<string, MCPClient> = new Map();

  constructor() {
    super();
    this.configPath = path.join(os.homedir(), '.newma', 'mcp.json');
  }

  /**
   * 加载配置
   */
  async loadConfig(): Promise<void> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(content);
    } catch (error) {
      // 配置文件不存在，创建默认配置
      this.config = {
        version: '1.0.0',
        servers: [],
      };
      await this.saveConfig();
    }
  }

  /**
   * 保存配置
   */
  async saveConfig(): Promise<void> {
    if (!this.config) {
      throw new Error('配置未加载');
    }

    const configDir = path.dirname(this.configPath);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  /**
   * 添加服务器
   */
  async addServer(server: MCPServerConfig): Promise<void> {
    if (!this.config) {
      await this.loadConfig();
    }

    const existing = this.config!.servers.findIndex(s => s.id === server.id);
    if (existing >= 0) {
      this.config!.servers[existing] = server;
    } else {
      this.config!.servers.push(server);
    }

    await this.saveConfig();
  }

  /**
   * 移除服务器
   */
  async removeServer(id: string): Promise<void> {
    if (!this.config) {
      await this.loadConfig();
    }

    this.config!.servers = this.config!.servers.filter(s => s.id !== id);
    await this.saveConfig();

    // 如果客户端已连接，断开连接
    const client = this.clients.get(id);
    if (client) {
      await client.disconnect();
      this.clients.delete(id);
    }
  }

  /**
   * 连接所有启用的服务器
   */
  async connectAll(): Promise<void> {
    if (!this.config) {
      await this.loadConfig();
    }

    const enabledServers = this.config!.servers.filter(s => s.enabled !== false);

    for (const server of enabledServers) {
      try {
        await this.connectServer(server.id);
      } catch (error) {
        this.emit('error', new Error(`连接服务器 ${server.name} 失败: ${error}`));
      }
    }
  }

  /**
   * 连接单个服务器
   */
  async connectServer(id: string): Promise<MCPClient> {
    if (!this.config) {
      await this.loadConfig();
    }

    const serverConfig = this.config!.servers.find(s => s.id === id);
    if (!serverConfig) {
      throw new Error(`服务器 ${id} 未找到`);
    }

    let client = this.clients.get(id);
    if (!client) {
      client = new MCPClient(serverConfig);
      this.clients.set(id, client);
    }

    await client.connect();
    return client;
  }

  /**
   * 断开所有服务器
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.values()).map(client => client.disconnect());
    await Promise.all(disconnectPromises);
    this.clients.clear();
  }

  /**
   * 获取客户端
   */
  getClient(id: string): MCPClient | undefined {
    return this.clients.get(id);
  }

  /**
   * 获取所有客户端
   */
  getAllClients(): MCPClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * 获取所有工具（从所有连接的服务器）
   */
  async getAllTools(): Promise<Array<{ serverId: string; serverName: string; tool: MCPTool }>> {
    const allTools: Array<{ serverId: string; serverName: string; tool: MCPTool }> = [];

    for (const [id, client] of this.clients.entries()) {
      if (client.isConnected()) {
        try {
          const tools = await client.listTools();
          const serverConfig = this.config?.servers.find(s => s.id === id);

          for (const tool of tools) {
            allTools.push({
              serverId: id,
              serverName: serverConfig?.name || id,
              tool,
            });
          }
        } catch (error) {
          this.emit('error', new Error(`获取 ${id} 工具列表失败: ${error}`));
        }
      }
    }

    return allTools;
  }
}

/**
 * 创建单例管理器实例
 */
export const mcpManager = new MCPManager();

/**
 * 创建默认 MCP 配置文件
 */
export async function createDefaultMCPConfig(): Promise<void> {
  const configPath = path.join(os.homedir(), '.newma', 'mcp.json');
  const defaultConfig: MCPConfig = {
    version: '1.0.0',
    servers: [
      {
        id: 'filesystem',
        transport: 'stdio',
        name: 'Filesystem',
        description: '本地文件系统访问',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/Users/mac/kode'],
        enabled: false,
      },
      {
        id: 'github',
        transport: 'stdio',
        name: 'GitHub',
        description: 'GitHub 仓库访问',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        enabled: false,
      },
    ],
  };

  const configDir = path.dirname(configPath);
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
}
