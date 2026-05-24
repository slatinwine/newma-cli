/**
 * Implementation Agent
 * 实现专家，负责编写和修改代码
 */

import { BaseSpecializedAgent } from './base-specialized-agent';
import { SubTask, AgentConfig } from '../subtask';
import { callAIWithFunctionCalling } from '../../../ai';

export class ImplementationAgent extends BaseSpecializedAgent {
  constructor(config?: Partial<AgentConfig>) {
    const defaultConfig: AgentConfig = {
      enabled: true,
      temperature: 0.3,
      maxIterations: 15,
      tools: ['create_file', 'modify_file', 'delete_file', 'run_command', 'read_file'],
      systemPrompt: `You are an implementation expert focused on writing clean, efficient, and maintainable code.

**Your Expertise:**
- Write production-ready code following best practices
- Ensure type safety and proper error handling
- Follow project code style and conventions
- Optimize for performance and readability
- Write self-documenting code with clear names

**Implementation Guidelines:**
1. **Quality First**: Write clean, testable, maintainable code
2. **Type Safety**: Use TypeScript types effectively
3. **Error Handling**: Handle errors gracefully with meaningful messages
4. **Performance**: Optimize hot paths, avoid premature optimization
5. **Testing**: Write testable code with clear interfaces
6. **Documentation**: Add JSDoc comments for complex logic

**Code Style:**
- Use meaningful variable and function names
- Keep functions focused and short (< 50 lines)
- Use composition over inheritance
- Follow SOLID principles
- Prefer pure functions over side effects

**Response Format:**
When implementing:
1. List files to be created/modified
2. Show key code snippets with explanations
3. Highlight important implementation details
4. Note any dependencies or requirements
5. Suggest testing approach

Focus on delivering working, production-ready code that integrates seamlessly with the existing codebase.`
    };

    super({ ...defaultConfig, ...config });
  }

  protected getDefaultPrompt(): string {
    return this.agentConfig.systemPrompt || '';
  }

  protected async callAI(systemPrompt: string, userMessage: string): Promise<any> {
    return callAIWithFunctionCalling(
      this.getConfig(),
      {}, // projectInfo
      userMessage,
      [], // history
      { getAllTools: () => [] } as any, // ToolRegistry (临时空实现)
      undefined // signal
    );
  }

  protected async processResponse(response: any, task: SubTask): Promise<any> {
    const result: any = {
      type: response.type,
      implementation: response.content || '',
      toolCalls: response.toolCalls || [],
      reasoning: response.reasoning || []
    };

    // 提取创建的文件列表
    if (response.toolCalls) {
      result.files = response.toolCalls
        .filter((call: any) =>
          call.function.name === 'create_file' ||
          call.function.name === 'modify_file'
        )
        .map((call: any) => {
          const args = JSON.parse(call.function.arguments);
          return args.path;
        });
    }

    // 提取命令执行记录
    if (response.toolCalls) {
      result.commands = response.toolCalls
        .filter((call: any) => call.function.name === 'run_command')
        .map((call: any) => {
          const args = JSON.parse(call.function.arguments);
          return args.command;
        });
    }

    return result;
  }

  private getConfig() {
    return {
      apiKey: process.env.OPENAI_API_KEY || '',
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
    };
  }
}
