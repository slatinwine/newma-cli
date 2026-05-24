/**
 * Testing Agent
 * 测试专家，负责编写和运行测试
 */

import { BaseSpecializedAgent } from './base-specialized-agent';
import { SubTask, AgentConfig } from '../subtask';
import { callAIWithFunctionCalling } from '../../../ai';

export class TestingAgent extends BaseSpecializedAgent {
  constructor(config?: Partial<AgentConfig>) {
    const defaultConfig: AgentConfig = {
      enabled: true,
      temperature: 0.3,
      maxIterations: 10,
      tools: ['run_command', 'read_file', 'create_file', 'modify_file'],
      systemPrompt: `You are a testing expert dedicated to ensuring code quality through comprehensive testing.

**Your Expertise:**
- Design comprehensive test suites
- Write unit, integration, and E2E tests
- Ensure high code coverage
- Identify edge cases and boundary conditions
- Use testing best practices and patterns

**Testing Philosophy:**
1. **Test Behavior, Not Implementation**: Focus on what the code does, not how
2. **Arrange-Act-Assert**: Structure tests clearly with AAA pattern
3. **Descriptive Names**: Test names should read like requirements
4. **Independence**: Tests should not depend on each other
5. **Repeatability**: Tests must produce consistent results
6. **Fast**: Keep tests fast for rapid feedback

**Testing Framework:**
- Use Jest/Jasmine for unit tests
- Use Testing Library for component tests
- Use Playwright/Cypress for E2E tests
- Mock external dependencies appropriately
- Use fixtures and factories for test data

**Test Coverage Goals:**
- Statements: > 80%
- Branches: > 75%
- Functions: > 80%
- Lines: > 80%

**Response Format:**
When creating tests:
1. List test files to be created
2. Show test structure with describe/it blocks
3. Include test cases for:
   - Happy path (success scenarios)
   - Edge cases (boundary values)
   - Error cases (failure scenarios)
   - Integration points
4. Suggest mocking strategy
5. Include commands to run tests

Focus on writing tests that provide confidence in the code's correctness and catch regressions early.`
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
      tests: response.content || '',
      toolCalls: response.toolCalls || [],
      reasoning: response.reasoning || []
    };

    // 提取测试文件列表
    if (response.toolCalls) {
      result.testFiles = response.toolCalls
        .filter((call: any) =>
          call.function.name === 'create_file' ||
          call.function.name === 'modify_file'
        )
        .map((call: any) => {
          const args = JSON.parse(call.function.arguments);
          return args.path;
        })
        .filter((path: string) =>
          path.includes('.test.') ||
          path.includes('.spec.') ||
          path.includes('__tests__')
        );
    }

    // 提取测试命令
    if (response.toolCalls) {
      result.testCommands = response.toolCalls
        .filter((call: any) => call.function.name === 'run_command')
        .map((call: any) => {
          const args = JSON.parse(call.function.arguments);
          return args.command;
        })
        .filter((cmd: string) =>
          cmd.includes('test') || cmd.includes('jest') || cmd.includes('vitest')
        );
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
