// src/agents/agent.ts
/**
 * Base Agent Class
 * Provides common functionality for all specialized agents
 */

import {
  Agent,
  AgentCapability,
  AgentContext,
  AgentMessage,
  AgentResult,
  AgentStatus,
  AgentTask,
  AgentSpecialization,
  StreamingCallback,
  AgentExecutionOptions,
} from './types';
import { callAI } from '../ai';
import { Config } from '../config';
import { ToolExecutor } from '../executor-v2';
import { ExecutionTracker } from '../history';

/**
 * Base agent implementation
 */
export abstract class BaseAgent implements Agent {
  id: string;
  name: string;
  description: string;
  capabilities: AgentCapability[];
  status: AgentStatus;

  protected toolExecutor: ToolExecutor;
  protected specialization: AgentSpecialization;
  protected messageHistory: AgentMessage[] = [];
  protected executionTracker: ExecutionTracker;

  constructor(
    id: string,
    name: string,
    description: string,
    capabilities: AgentCapability[],
    specialization: AgentSpecialization,
    toolExecutor: ToolExecutor,
    tracker: ExecutionTracker
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.capabilities = capabilities;
    this.status = AgentStatus.IDLE;
    this.specialization = specialization;
    this.toolExecutor = toolExecutor;
    this.executionTracker = tracker;
  }

  /**
   * Process a task (to be implemented by subclasses)
   */
  abstract process(
    task: AgentTask,
    context: AgentContext,
    options?: AgentExecutionOptions
  ): Promise<AgentResult>;

  /**
   * Handle message from another agent
   */
  async handleMessage(message: AgentMessage): Promise<void> {
    this.messageHistory.push(message);

    // Check if message requires action
    if (message.type === 'request') {
      await this.respondToMessage(message);
    }
  }

  /**
   * Get current status
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Reset agent state
   */
  reset(): void {
    this.status = AgentStatus.IDLE;
    this.messageHistory = [];
  }

  /**
   * Check if this agent can handle a task
   */
  canHandle(task: AgentTask): boolean {
    return task.capabilities.some(cap => this.capabilities.includes(cap));
  }

  /**
   * Check if this agent can handle a file
   */
  canHandleFile(filePath: string): boolean {
    // Check exclusions first
    const isExcluded = this.specialization.exclusions.some(pattern =>
      this.matchPattern(filePath, pattern)
    );
    if (isExcluded) return false;

    // Check if file matches any pattern
    return this.specialization.filePatterns.some(pattern =>
      this.matchPattern(filePath, pattern)
    );
  }

  /**
   * Call LLM with agent-specific system prompt
   */
  protected async callLLM(
    config: Config,
    projectInfo: Record<string, string>,
    task: AgentTask,
    context: AgentContext,
    options?: AgentExecutionOptions
  ): Promise<any> {
    const systemPrompt = this.buildSystemPrompt(context);

    try {
      this.status = AgentStatus.THINKING;

      // For streaming support
      if (options?.streaming && options.callbacks?.onToken) {
        return await this.callLLMStreaming(
          config,
          systemPrompt,
          projectInfo,
          task,
          context,
          options.callbacks
        );
      }

      // Regular non-streaming call
      const result = await callAI(
        config,
        projectInfo,
        `${task.description}\n\nContext: ${JSON.stringify(context.sharedState)}`,
        'plan',
        this.executionTracker.getHistory(),
        this.specialization.tools,
        [] // Permissions handled by toolExecutor
      );

      this.status = AgentStatus.WORKING;
      return result;
    } catch (error) {
      this.status = AgentStatus.FAILED;
      throw error;
    }
  }

  /**
   * Execute tool calls
   */
  protected async executeTools(
    toolCalls: any[],
    callbacks?: StreamingCallback
  ): Promise<any[]> {
    const results: any[] = [];

    for (const call of toolCalls) {
      // Callback before execution
      if (callbacks?.onToolCall) {
        callbacks.onToolCall(call);
      }

      // Execute tool
      const result = await this.toolExecutor.executeToolCall(call);
      results.push(result);

      // Callback after execution
      if (callbacks?.onToolResult) {
        callbacks.onToolResult(result);
      }

      if (!result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * Build system prompt with agent specialization
   */
  protected buildSystemPrompt(context: AgentContext): string {
    let prompt = this.specialization.systemPrompt;

    prompt += `\n\n**AGENT IDENTITY**`;
    prompt += `\nName: ${this.name}`;
    prompt += `\nID: ${this.id}`;
    prompt += `\nCapabilities: ${this.capabilities.join(', ')}`;
    prompt += `\n\n**AVAILABLE TOOLS**`;
    prompt += `\n${this.specialization.tools.join(', ')}`;

    if (this.messageHistory.length > 0) {
      prompt += `\n\n**RECENT MESSAGES**`;
      this.messageHistory.slice(-5).forEach(msg => {
        prompt += `\n[${msg.from} -> ${msg.to}]: ${msg.content}`;
      });
    }

    return prompt;
  }

  /**
   * Respond to a message
   */
  protected async respondToMessage(message: AgentMessage): Promise<void> {
    // Default implementation: send acknowledgment
    // Subclasses can override for custom behavior
  }

  /**
   * Match file path pattern
   */
  private matchPattern(filePath: string, pattern: string): boolean {
    const regex = new RegExp(
      pattern.replace('*', '.*').replace('?', '.'),
      'i'
    );
    return regex.test(filePath);
  }

  /**
   * Streaming LLM call (placeholder for future implementation)
   */
  private async callLLMStreaming(
    config: Config,
    systemPrompt: string,
    projectInfo: Record<string, string>,
    task: AgentTask,
    context: AgentContext,
    callbacks: StreamingCallback
  ): Promise<any> {
    // TODO: Implement streaming in Phase 3
    // For now, fall back to non-streaming
    return await callAI(
      config,
      projectInfo,
      task.description,
      'plan',
      this.executionTracker.getHistory()
    );
  }

  /**
   * Create a response message
   */
  protected createMessage(
    to: string,
    content: string,
    data?: any
  ): AgentMessage {
    return {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from: this.id,
      to,
      timestamp: Date.now(),
      type: 'response',
      content: content,
      data,
    };
  }
}
