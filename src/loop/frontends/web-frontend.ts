/**
 * Web Frontend
 *
 * HTTP API 服务模式，允许外部调用
 * 不使用思维树，直接执行任务
 */

import http from 'http';
import { URL } from 'url';
import {
  LoopFrontend,
  FrontendConfig,
  OutputStyle,
  LoopStatus,
  ProgressInfo,
} from '../interfaces/frontend';

/**
 * HTTP 请求处理函数类型
 */
type RequestHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  body?: any
) => Promise<void>;

/**
 * 执行请求接口
 */
export interface ExecuteRequest {
  requirement: string;
  mode?: string;
  images?: Array<{
    data: string; // base64 数据（data URL 或纯 base64）
    type?: string; // 可选：图片类型
  }>;
}

/**
 * Web Frontend 配置
 */
export interface WebFrontendConfig extends FrontendConfig {
  /**
   * 服务器端口
   */
  port?: number;

  /**
   * 服务器主机
   */
  host?: string;

  /**
   * CORS 允许的来源
   */
  corsOrigin?: string | string[];

  /**
   * 是否启用 API 密钥验证
   */
  requireAuth?: boolean;

  /**
   * 允许的 API 密钥
   */
  apiKeys?: string[];
}

/**
 * HTTP 响应
 */
interface HttpResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: any;
}

/**
 * Web Frontend
 *
 * 实现 HTTP API 服务，允许外部通过 REST API 调用
 */
export class WebFrontend implements LoopFrontend {
  readonly type = 'web' as const;

  private server: http.Server | null = null;
  private config: Required<WebFrontendConfig>;
  private isRunningFlag: boolean = false;
  private interruptHandler: (() => void) | null = null;
  private outputBuffer: string[] = [];
  private currentInputResolver: ((value: string) => void) | null = null;

  // API 路由
  private routes: Map<string, RequestHandler> = new Map();

  constructor(config: WebFrontendConfig = {}) {
    this.config = {
      prompt: config.prompt || 'newma-web',
      colors: config.colors !== false,
      debug: config.debug || false,
      port: config.port || 3000,
      host: config.host || '0.0.0.0',
      corsOrigin: config.corsOrigin || '*',
      requireAuth: config.requireAuth || false,
      apiKeys: config.apiKeys || [],
    };

    this.setupRoutes();
  }

  /**
   * 设置 API 路由
   */
  private setupRoutes(): void {
    // 主页 - HTML 界面
    this.routes.set('/', async (req, res) => {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const htmlPath = path.join(process.cwd(), 'public', 'index.html');

        // 检查文件是否存在
        if (fs.existsSync(htmlPath)) {
          const html = fs.readFileSync(htmlPath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
        } else {
          // 如果文件不存在，返回 JSON 提示
          this.sendJson(res, {
            message: 'Newma Web API Server',
            version: '1.0.0',
            endpoints: {
              web: 'http://localhost:3000/',
              api: {
                execute: 'POST /api/execute',
                status: 'GET /api/status',
                health: 'GET /health',
                clear: 'POST /api/clear',
                stop: 'POST /api/stop'
              }
            }
          });
        }
      } catch (error: any) {
        this.log(`Error serving index.html: ${error.message}`);
        this.sendError(res, 500, 'Failed to load page');
      }
    });

    // 健康检查
    this.routes.set('/health', async (req, res) => {
      this.sendJson(res, {
        status: 'ok',
        type: 'newma-web',
        timestamp: Date.now(),
      });
    });

    // 执行任务
    this.routes.set('/api/execute', async (req, res, body) => {
      try {
        const { requirement, mode = 'chat', images } = body as ExecuteRequest;

        if (!requirement) {
          this.sendError(res, 400, 'Missing required field: requirement');
          return;
        }

        // 将输入放入缓冲区，等待 LoopEngine 读取
        this.log(`Received task: ${mode} - ${requirement}`);

        // 处理图像
        let inputText = requirement;
        if (images && images.length > 0) {
          this.log(`Received ${images.length} image(s)`);

          // 将图像数据作为标记添加到文本中
          // 图像会在 AI 处理时被提取
          const imageMarkers = images.map((img, idx) => {
            if (img.data.startsWith('data:')) {
              // data URL 格式，直接使用
              return `[IMAGE_${idx}:DATA_URL]`;
            } else {
              // 纯 base64 格式
              return `[IMAGE_${idx}:BASE64]`;
            }
          });

          inputText = `${requirement}\n\nAttached images: ${imageMarkers.join(', ')}`;
        }

        // 返回任务已接收
        this.sendJson(res, {
          status: 'received',
          requirement: inputText,
          mode,
          imagesCount: images?.length || 0,
          timestamp: Date.now(),
        });

        // 触发输入处理（如果有等待的 resolver）
        if (this.currentInputResolver) {
          // 将图像数据附加到输入中，供后续处理
          const input = mode === 'chat'
            ? inputText
            : `/${mode} ${inputText}`;

          // 将图像数据存储到临时属性中，供 AI 处理时使用
          if (images && images.length > 0) {
            (input as any).__images = images;
          }

          this.currentInputResolver(input);
          this.currentInputResolver = null;
        }
      } catch (error: any) {
        this.sendError(res, 500, error.message);
      }
    });

    // 获取状态
    this.routes.set('/api/status', async (req, res) => {
      this.sendJson(res, {
        status: 'running',
        type: 'newma-web',
        outputBuffer: this.outputBuffer,
        timestamp: Date.now(),
      });
    });

    // 清空输出缓冲区
    this.routes.set('/api/clear', async (req, res) => {
      this.outputBuffer = [];
      this.sendJson(res, {
        status: 'cleared',
        timestamp: Date.now(),
      });
    });

    // 停止服务器
    this.routes.set('/api/stop', async (req, res) => {
      this.sendJson(res, {
        status: 'stopping',
        timestamp: Date.now(),
      });

      setTimeout(() => this.stop(), 100);
    });
  }

  /**
   * 启动 Web 服务器
   */
  async start(): Promise<void> {
    if (this.isRunningFlag) {
      throw new Error('Web server is already running');
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        try {
          await this.handleRequest(req, res);
        } catch (error: any) {
          this.log(`Request error: ${error.message}`);
          this.sendError(res, 500, 'Internal server error');
        }
      });

      this.server.on('error', (error) => {
        this.log(`Server error: ${error.message}`);
        reject(error);
      });

      this.server.listen(
        this.config.port,
        this.config.host,
        () => {
          this.isRunningFlag = true;
          this.log(`Web server started at http://${this.config.host}:${this.config.port}`);
          this.log('');
          this.log('API Endpoints:');
          this.log(`  GET  /health           - Health check`);
          this.log(`  POST /api/execute      - Execute task`);
          this.log(`  GET  /api/status       - Get status`);
          this.log(`  POST /api/clear        - Clear output buffer`);
          this.log(`  POST /api/stop         - Stop server`);
          this.log('');
          this.log('Example usage:');
          this.log(`  curl -X POST http://localhost:${this.config.port}/api/execute \\`);
          this.log(`    -H "Content-Type: application/json" \\`);
          this.log(`    -d '{"requirement":"创建一个测试文件","mode":"chat"}'`);
          this.log('');
          resolve();
        }
      );
    });
  }

  /**
   * 停止 Web 服务器
   */
  async stop(): Promise<void> {
    if (!this.isRunningFlag || !this.server) {
      return;
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.isRunningFlag = false;
        this.server = null;
        this.log('Web server stopped');
        resolve();
      });
    });
  }

  /**
   * 处理 HTTP 请求
   */
  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const parsedUrl = new URL(req.url || '', `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    // CORS 处理
    this.setCorsHeaders(res);

    // OPTIONS 请求
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 验证 API 密钥
    if (this.config.requireAuth && !this.validateAuth(req)) {
      this.sendError(res, 401, 'Unauthorized');
      return;
    }

    // 查找路由
    const handler = this.routes.get(pathname);

    if (!handler) {
      this.sendError(res, 404, 'Not found');
      return;
    }

    // 读取请求体
    if (req.method === 'POST') {
      const body = await this.readBody(req);
      await handler(req, res, body);
    } else {
      await handler(req, res);
    }
  }

  /**
   * 读取请求体
   */
  private async readBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';

      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (error) {
          reject(new Error('Invalid JSON'));
        }
      });

      req.on('error', reject);
    });
  }

  /**
   * 验证 API 密钥
   */
  private validateAuth(req: http.IncomingMessage): boolean {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return false;
    }

    const apiKey = authHeader.replace('Bearer ', '');

    return this.config.apiKeys.includes(apiKey);
  }

  /**
   * 设置 CORS 头
   */
  private setCorsHeaders(res: http.ServerResponse): void {
    const corsOrigin = this.config.corsOrigin;

    if (typeof corsOrigin === 'string') {
      res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    } else if (Array.isArray(corsOrigin)) {
      const origin = res.getHeader('origin');
      const originStr = typeof origin === 'string' ? origin : undefined;
      res.setHeader(
        'Access-Control-Allow-Origin',
        originStr && corsOrigin.includes(originStr) ? originStr : corsOrigin[0]
      );
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Content-Type', 'application/json');
  }

  /**
   * 发送 JSON 响应
   */
  private sendJson(res: http.ServerResponse, data: any): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }

  /**
   * 发送错误响应
   */
  private sendError(res: http.ServerResponse, statusCode: number, message: string): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify(
        {
          error: {
            statusCode,
            message,
            timestamp: Date.now(),
          },
        },
        null,
        2
      )
    );
  }

  /**
   * 读取用户输入
   *
   * Web 模式下，这个方法会阻塞等待外部 API 调用
   */
  async readInput(prompt?: string): Promise<string> {
    this.log(`Waiting for input...`);

    return new Promise((resolve) => {
      this.currentInputResolver = resolve;

      // Web 模式下不设置超时，无限期等待 HTTP 请求
    });
  }

  /**
   * 输出内容
   */
  writeOutput(content: string, style?: OutputStyle): void {
    const timestamp = new Date().toISOString();
    const output = {
      type: 'output',
      style: style || OutputStyle.DEFAULT,
      content,
      timestamp,
    };

    this.outputBuffer.push(JSON.stringify(output));

    // 如果输出缓冲区太大，保留最近的 1000 条
    if (this.outputBuffer.length > 1000) {
      this.outputBuffer = this.outputBuffer.slice(-1000);
    }

    // 在服务器日志中显示
    if (this.config.debug) {
      const stylePrefix = this.getStylePrefix(style);
      this.log(`${stylePrefix}${content}`);
    }
  }

  /**
   * 输出错误信息
   */
  writeError(content: string): void {
    const timestamp = new Date().toISOString();
    const output = {
      type: 'error',
      content,
      timestamp,
    };

    this.outputBuffer.push(JSON.stringify(output));

    if (this.config.debug) {
      this.log(`[ERROR] ${content}`);
    }
  }

  /**
   * 清空屏幕（Web 模式下清空输出缓冲区）
   */
  clearScreen(): void {
    this.outputBuffer = [];
    this.log('Output buffer cleared');
  }

  /**
   * 显示状态信息
   */
  showStatus(status: LoopStatus): void {
    const timestamp = new Date().toISOString();
    const output = {
      type: 'status',
      status,
      timestamp,
    };

    this.outputBuffer.push(JSON.stringify(output));

    if (this.config.debug) {
      this.log(`[STATUS] ${status.mode} - ${status.isRunning ? 'running' : 'stopped'}`);
    }
  }

  /**
   * 显示进度信息
   */
  showProgress(progress: ProgressInfo): void {
    const timestamp = new Date().toISOString();
    const output = {
      type: 'progress',
      progress,
      timestamp,
    };

    this.outputBuffer.push(JSON.stringify(output));

    if (this.config.debug) {
      const percentage = progress.percentage
        ? `${progress.percentage}%`
        : progress.current && progress.total
        ? `${progress.current}/${progress.total}`
        : '';
      this.log(`[PROGRESS] ${progress.message}${percentage ? ` - ${percentage}` : ''}`);
    }
  }

  /**
   * 检查是否正在运行
   */
  isRunning(): boolean {
    return this.isRunningFlag;
  }

  /**
   * 设置中断处理器
   */
  setInterruptHandler(handler: () => void): void {
    this.interruptHandler = handler;

    // 监听进程信号
    process.on('SIGINT', handler);
    process.on('SIGTERM', handler);
  }

  /**
   * 获取输出缓冲区
   */
  getOutputBuffer(): string[] {
    return [...this.outputBuffer];
  }

  /**
   * 获取样式前缀
   */
  private getStylePrefix(style?: OutputStyle): string {
    if (!style || style === OutputStyle.DEFAULT) return '';

    switch (style) {
      case OutputStyle.SUCCESS:
        return '[✓] ';
      case OutputStyle.ERROR:
        return '[✗] ';
      case OutputStyle.WARNING:
        return '[⚠] ';
      case OutputStyle.INFO:
        return '[i] ';
      case OutputStyle.DEBUG:
        return '[D] ';
      case OutputStyle.CODE:
        return '[Code] ';
      default:
        return '';
    }
  }

  /**
   * 记录日志
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString().substring(0, 19);
    console.log(`[${timestamp}] ${message}`);
  }
}
