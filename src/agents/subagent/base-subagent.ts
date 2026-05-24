/**
 * BaseSubAgent - Subagent 系统的基类
 *
 * 提供核心的 Function Calling 执行逻辑
 */

import { callAIWithFunctionCalling, FunctionCallingResponse } from '../../ai';
import chalk from 'chalk';
import {
  SubAgentConfig,
  SubAgentContext,
  SubAgentResult,
} from './types';

/**
 * SubAgent 基类
 *
 * 实现 Function Calling API 的核心逻辑
 */
export abstract class BaseSubAgent {
  protected config: SubAgentConfig;
  protected context: SubAgentContext;

  constructor(config: SubAgentContext) {
    this.context = config;
    this.config = this.getSubAgentConfig();
  }

  /**
   * 子类实现 - 返回 SubAgent 配置
   */
  protected abstract getSubAgentConfig(): SubAgentConfig;

  /**
   * 子类实现 - 定义具体的执行逻辑
   */
  abstract execute(requirement: string, context?: any): Promise<SubAgentResult>;

  /**
   * 使用 Function Calling API 执行任务
   *
   * @param requirement 用户需求
   * @param initialHistory 初始消息历史
   * @returns 执行结果
   */
  protected async executeWithFunctionCalling(
    requirement: string,
    initialHistory: any[] = []
  ): Promise<SubAgentResult> {
    const startTime = Date.now();
    let totalTokens = { prompt: 0, completion: 0, total: 0 };
    let toolCallsExecuted = 0;
    let history = [...initialHistory];

    const maxIterations = this.config.maxIterations || 10;

    if (this.context.config.executionMode === 'subagent') {
      console.log(chalk.gray(`\n🤖 ${this.config.name} starting...`));
      console.log(chalk.gray(`Max iterations: ${maxIterations}`));
      console.log(chalk.gray(`Allowed tools: ${this.config.allowedTools.join(', ')}`));
      console.log('');
    }

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // 检查中断
      if (this.context.signal?.aborted) {
        return {
          success: false,
          agentId: this.config.id,
          output: 'Execution interrupted by user',
          toolCallsExecuted,
          tokensUsed: totalTokens,
          duration: Date.now() - startTime,
          error: 'ABORTED',
        };
      }

      // 构建 system prompt
      const systemPrompt = this.buildSystemPrompt();

      // 添加 system prompt 到历史开头
      const fullHistory = [
        { role: 'system', content: systemPrompt },
        ...history,
      ];

      // 调用 AI
      const aiResp = await callAIWithFunctionCalling(
        this.context.config,
        this.context.projectInfo,
        requirement,
        fullHistory,
        this.context.toolRegistry,
        this.context.signal
      );

      // 统计 token
      if (aiResp.usage) {
        totalTokens.prompt += aiResp.usage.prompt_tokens;
        totalTokens.completion += aiResp.usage.completion_tokens;
        totalTokens.total += aiResp.usage.total_tokens;
      }

      // 处理错误
      if (aiResp.type === 'error') {
        return {
          success: false,
          agentId: this.config.id,
          output: aiResp.message || 'Unknown error',
          toolCallsExecuted,
          tokensUsed: totalTokens,
          duration: Date.now() - startTime,
          error: aiResp.message,
        };
      }

      // 处理工具调用
      if (aiResp.type === 'tool_calls' && aiResp.toolCalls && aiResp.toolCalls.length > 0) {
        if (this.context.config.executionMode === 'subagent') {
          console.log(chalk.cyan(`\n📞 Iteration ${iteration + 1}: AI called ${aiResp.toolCalls.length} tool(s)`));
        }

        toolCallsExecuted += aiResp.toolCalls.length;

        // 添加 assistant 消息（包含 tool_calls）
        history.push({
          role: 'assistant',
          tool_calls: aiResp.toolCalls.map((call) => ({
            id: call.id,
            type: 'function',
            function: {
              name: call.function.name,
              arguments: call.function.arguments,
            },
          })),
          content: null,
        });

        // 执行工具
        const toolResults = await Promise.all(
          aiResp.toolCalls.map(async (call) => {
            const toolName = chalk.cyan(call.function.name);
            const args = call.function.arguments;

            if (this.context.config.executionMode === 'subagent') {
              console.log(`  ⚙️  [${toolName}] ${args}`);
            }

            const result = await this.context.toolExecutor.executeToolCall({
              tool: call.function.name,
              parameters: JSON.parse(args),
              id: call.id,
            });

            if (result.success) {
              if (this.context.config.executionMode === 'subagent') {
                console.log(chalk.green(`  ✅ [${toolName}] Success`));
                if (result.output && result.output.length < 200) {
                  console.log(chalk.gray(`  📄 ${result.output}`));
                }
              }
            } else {
              if (this.context.config.executionMode === 'subagent') {
                console.log(chalk.red(`  ❌ [${toolName}] Failed: ${result.error}`));
              }
            }

            return {
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify(result),
            };
          })
        );

        history.push(...toolResults);
        continue;
      }

      // 文本响应
      if (aiResp.type === 'text' && aiResp.content) {
        if (this.context.config.executionMode === 'subagent') {
          console.log(chalk.cyan('\n💬 AI Response:'));
          console.log(chalk.gray(aiResp.content));
        }

        return {
          success: true,
          agentId: this.config.id,
          output: aiResp.content,
          toolCallsExecuted,
          tokensUsed: totalTokens,
          duration: Date.now() - startTime,
        };
      }

      // 完成标志
      if (aiResp.done) {
        if (this.context.config.executionMode === 'subagent') {
          console.log(chalk.green('\n✅ Task completed'));
        }
        break;
      }
    }

    return {
      success: true,
      agentId: this.config.id,
      output: 'Task completed',
      toolCallsExecuted,
      tokensUsed: totalTokens,
      duration: Date.now() - startTime,
    };
  }

  /**
   * 构建系统提示词
   */
  protected buildSystemPrompt(): string {
    return `${this.config.systemPrompt}

**AVAILABLE TOOLS**
You have access to the following tools:
${this.config.allowedTools.map(t => `- ${t}`).join('\n')}

**IMPORTANT CONSTRAINTS**
- ONLY use tools from the allowed list above
- Be concise and direct
- Stop when the task is complete
- Explain your reasoning clearly

**AGENT IDENTITY**
Name: ${this.config.name}
ID: ${this.config.id}
Description: ${this.config.description}`;
  }

  /**
   * 过滤工具白名单
   *
   * 从 ToolRegistry 中获取允许的工具
   */
  protected filterAllowedTools(): void {
    const allTools = this.context.toolRegistry.list();
    const allowedTools = allTools.filter((tool) =>
      this.config.allowedTools.includes(tool.name)
    );

    // 创建一个新的 ToolRegistry 只包含允许的工具
    // 这是一个简单的实现，实际可能需要更复杂的逻辑
    if (allowedTools.length !== allTools.length) {
      // TODO: 实现工具过滤逻辑
      // 目前我们依赖 AI 遵循系统提示词中的限制
    }
  }

  /**
   * 验证工具调用是否在白名单中
   */
  protected isToolAllowed(toolName: string): boolean {
    return this.config.allowedTools.includes(toolName);
  }
}
