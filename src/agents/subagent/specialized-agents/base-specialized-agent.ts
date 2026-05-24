/**
 * Base Specialized Agent
 * 专用 agent 的基类，提供通用功能
 */

import { SubTask, AgentConfig } from '../subtask';

export abstract class BaseSpecializedAgent {
  protected agentConfig: AgentConfig;

  constructor(config: AgentConfig) {
    this.agentConfig = config;
  }

  /**
   * 执行子任务
   */
  async execute(task: SubTask): Promise<any> {
    // 构建系统提示词
    const systemPrompt = this.buildSystemPrompt();

    // 构建用户消息
    const userMessage = this.buildUserMessage(task);

    // 调用 AI
    const response = await this.callAI(systemPrompt, userMessage);

    // 处理响应
    return this.processResponse(response, task);
  }

  /**
   * 构建系统提示词
   */
  protected buildSystemPrompt(): string {
    return this.agentConfig.systemPrompt || this.getDefaultPrompt();
  }

  /**
   * 构建用户消息
   */
  protected buildUserMessage(task: SubTask): string {
    let message = `**Task:** ${task.description}\n\n`;
    message += `**Goal:** ${task.input.goal}\n\n`;

    if (task.input.context) {
      message += `**Context:**\n${JSON.stringify(task.input.context, null, 2)}\n\n`;
    }

    if (task.input.relatedFiles && task.input.relatedFiles.length > 0) {
      message += `**Related Files:**\n`;
      message += task.input.relatedFiles.map(f => `- ${f}`).join('\n');
      message += '\n\n';
    }

    return message;
  }

  /**
   * 调用 AI（由子类实现具体逻辑）
   */
  protected abstract callAI(systemPrompt: string, userMessage: string): Promise<any>;

  /**
   * 处理响应（由子类实现具体逻辑）
   */
  protected abstract processResponse(response: any, task: SubTask): Promise<any>;

  /**
   * 获取默认提示词（由子类实现）
   */
  protected abstract getDefaultPrompt(): string;
}
