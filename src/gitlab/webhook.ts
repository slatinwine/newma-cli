// src/gitlab/webhook.ts
/**
 * GitLab Webhook Handler
 * Processes incoming webhook events from GitLab
 */

import http from 'http';
import chalk from 'chalk';
import { MergeRequestEvent } from './types';

/**
 * Webhook event handler type
 */
export type WebhookEventHandler = (event: MergeRequestEvent) => Promise<void>;

/**
 * Webhook server configuration
 */
export interface WebhookServerConfig {
  port: number;
  host: string;
  path: string;
  secret?: string;
}

/**
 * GitLab Webhook Server
 */
export class GitLabWebhookServer {
  private config: WebhookServerConfig;
  private handlers: Map<string, WebhookEventHandler[]>;
  private server: http.Server | null;

  constructor(config: WebhookServerConfig) {
    this.config = config;
    this.handlers = new Map();
    this.server = null;
  }

  /**
   * Register event handler
   */
  on(eventType: string, handler: WebhookEventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }

  /**
   * Start webhook server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        try {
          await this.handleRequest(req, res);
        } catch (error: any) {
          console.error(chalk.red(`❌ Webhook error: ${error.message}`));
          res.writeHead(500);
          res.end('Internal Server Error');
        }
      });

      this.server.on('error', (error) => {
        console.error(chalk.red(`❌ Server error: ${error.message}`));
        reject(error);
      });

      this.server.listen(this.config.port, this.config.host, () => {
        console.log(chalk.green(`✅ GitLab webhook server listening on ${this.config.host}:${this.config.port}`));
        console.log(chalk.gray(`   Webhook URL: http://${this.config.host}:${this.config.port}${this.config.path}`));
        resolve();
      });
    });
  }

  /**
   * Stop webhook server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((error) => {
          if (error) {
            reject(error);
          } else {
            console.log(chalk.yellow('🛑 GitLab webhook server stopped'));
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle incoming webhook request
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Check request method
    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end('Method Not Allowed');
      return;
    }

    // Check URL path
    if (req.url !== this.config.path) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    // Verify webhook secret if configured
    if (this.config.secret) {
      const signature = req.headers['x-gitlab-token'];
      if (signature !== this.config.secret) {
        console.log(chalk.yellow('⚠️  Invalid webhook signature'));
        res.writeHead(401);
        res.end('Unauthorized');
        return;
      }
    }

    // Read request body
    const body = await this.readRequestBody(req);

    try {
      // Parse event
      const event = JSON.parse(body) as MergeRequestEvent;

      // Log event
      console.log(chalk.cyan(`📩 Received ${event.object_kind} event`));

      // Trigger handlers
      await this.triggerHandlers(event);

      // Send success response
      res.writeHead(200);
      res.end('OK');
    } catch (error: any) {
      console.error(chalk.red(`❌ Failed to process webhook: ${error.message}`));
      res.writeHead(400);
      res.end('Bad Request');
    }
  }

  /**
   * Read request body
   */
  private readRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';

      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', () => {
        resolve(body);
      });

      req.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Trigger event handlers
   */
  private async triggerHandlers(event: MergeRequestEvent): Promise<void> {
    const eventType = event.object_kind;
    const handlers = this.handlers.get(eventType) || [];

    if (handlers.length === 0) {
      console.log(chalk.yellow(`⚠️  No handlers registered for ${eventType} event`));
      return;
    }

    console.log(chalk.gray(`🔄 Triggering ${handlers.length} handler(s) for ${eventType} event`));

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error: any) {
        console.error(chalk.red(`❌ Handler failed: ${error.message}`));
      }
    }
  }

  /**
   * Get registered event types
   */
  getRegisteredEvents(): string[] {
    return Array.from(this.handlers.keys());
  }
}

/**
 * Merge request event handler helper
 */
export class MergeRequestEventHandler {
  private handler: (event: MergeRequestEvent) => Promise<void>;

  constructor(handler: (event: MergeRequestEvent) => Promise<void>) {
    this.handler = handler;
  }

  /**
   * Handle merge request events
   */
  async handle(event: MergeRequestEvent): Promise<void> {
    // Only process merge request events
    if (event.object_kind !== 'merge_request') {
      return;
    }

    // Only process opened or updated MRs
    const action = event.object_attributes.action;
    if (!['open', 'update', 'reopen'].includes(action)) {
      console.log(chalk.gray(`ℹ️  Ignoring ${action} action for MR !${event.object_attributes.iid}`));
      return;
    }

    // Process the event
    await this.handler(event);
  }

  /**
   * Extract MR info from event
   */
  static extractMRInfo(event: MergeRequestEvent): {
    projectId: number;
    mrIid: number;
    title: string;
    sourceBranch: string;
    targetBranch: string;
    author: string;
  } {
    return {
      projectId: event.project.id,
      mrIid: event.object_attributes.iid,
      title: event.object_attributes.title,
      sourceBranch: event.object_attributes.source_branch,
      targetBranch: event.object_attributes.target_branch,
      author: event.user.name,
    };
  }
}

/**
 * Create webhook server for merge request events
 */
export function createMergeRequestWebhookServer(
  config: WebhookServerConfig,
  handler: (event: MergeRequestEvent) => Promise<void>
): GitLabWebhookServer {
  const server = new GitLabWebhookServer(config);
  const mrHandler = new MergeRequestEventHandler(handler);

  server.on('merge_request', (event) => mrHandler.handle(event));

  return server;
}