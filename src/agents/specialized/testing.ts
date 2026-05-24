// src/agents/specialized/testing.ts
/**
 * Testing Agent
 * Specializes in test automation, quality assurance, and testing strategies
 */

import { BaseAgent } from '../agent';
import { AgentCapability, AgentContext, AgentResult, AgentTask, AgentSpecialization, AgentExecutionOptions, AgentStatus } from '../types';
import { ToolExecutor } from '../../executor-v2';
import { ExecutionTracker } from '../../history';

/**
 * Testing agent implementation
 */
export class TestingAgent extends BaseAgent {
  constructor(toolExecutor: ToolExecutor, tracker: ExecutionTracker) {
    const specialization: AgentSpecialization = {
      capabilities: [AgentCapability.TESTING],
      filePatterns: [
        '*.test.ts',
        '*.test.tsx',
        '*.spec.ts',
        '*.spec.tsx',
        '*.test.js',
        '*.spec.js',
        '*.e2e.ts',
        '*.e2e.js',
        '*.cy.ts',
        '*.cy.js',
      ],
      exclusions: ['*.server.ts', '*.api.ts', '*.controller.ts', '*.service.ts'],
      tools: ['file', 'command'],
      systemPrompt: `
You are a **Testing Specialist Agent** for KODE.

**YOUR EXPERTISE:**
- Testing frameworks (Jest, Vitest, Mocha, Jasmine, Cypress, Playwright)
- Test types (Unit, Integration, E2E, Component, API testing)
- Testing best practices and patterns
- Test coverage and quality metrics
- Mocking and stubbing strategies
- Test data management
- Behavior-driven development (BDD)
- Test-driven development (TDD)

**YOUR RESPONSIBILITIES:**
- Write comprehensive unit tests
- Create integration tests
- Develop end-to-end test scenarios
- Set up testing infrastructure
- Implement test mocking strategies
- Ensure test coverage
- Write clear, maintainable tests
- Test edge cases and error conditions

**RULES:**
1. Follow testing best practices (AAA pattern: Arrange, Act, Assert)
2. Write descriptive test names that explain what is being tested
3. Test behavior, not implementation details
4. Keep tests independent and isolated
5. Use appropriate assertions and matchers
6. Mock external dependencies appropriately
7. Test both happy paths and error cases
8. Aim for high coverage but focus on meaningful tests
9. Use test doubles (mocks, stubs, spies) when needed
10. Follow framework-specific conventions

**TEST PATTERNS:**
- Unit Tests: Test individual functions/classes in isolation
- Integration Tests: Test how multiple components work together
- E2E Tests: Test complete user flows from start to finish
- Component Tests: Test UI components with user interactions
- API Tests: Test API endpoints with various inputs

**OUTPUT FORMAT:**
Return a JSON object with the testing tasks to execute.
`,
    };

    super(
      'testing-agent',
      'Testing Specialist',
      'Expert in test automation, quality assurance, and testing strategies',
      [AgentCapability.TESTING],
      specialization,
      toolExecutor,
      tracker
    );
  }

  /**
   * Process testing-specific tasks
   */
  async process(
    task: AgentTask,
    context: AgentContext,
    options?: AgentExecutionOptions
  ): Promise<AgentResult> {
    try {
      this.status = AgentStatus.WORKING;

      // Get project info
      const projectInfo = await this.scanProject(context.projectRoot);

      // Call LLM with testing expertise
      const config = context.config as any;
      const llmResponse = await this.callLLM(
        config,
        projectInfo,
        task,
        context,
        options
      );

      // Execute the actions
      const toolResults = await this.executeTools(
        llmResponse.actions || [],
        options?.callbacks
      );

      // Create subtasks if needed
      const nextTasks = this.createSubtasks(llmResponse, task);

      return {
        success: true,
        agentId: this.id,
        taskId: task.id,
        output: llmResponse.todo?.join('\n') || 'Testing tasks completed',
        toolResults,
        nextTasks,
        metadata: {
          capabilities: this.capabilities,
          testsCreated: toolResults.filter(r => r.success).length,
        },
      };
    } catch (error) {
      this.status = AgentStatus.FAILED;
      return {
        success: false,
        agentId: this.id,
        taskId: task.id,
        output: 'Testing task failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Scan project for testing files
   */
  private async scanProject(projectRoot: string): Promise<Record<string, string>> {
    const { scanDirectory } = await import('../../scanner');
    return await scanDirectory(projectRoot);
  }

  /**
   * Create subtasks for other agents if needed
   */
  private createSubtasks(llmResponse: any, currentTask: AgentTask): AgentTask[] {
    const tasks: AgentTask[] = [];

    // If testing work requires code changes, create development tasks
    const needsCodeChanges = this.extractCodeChangeNeeds(llmResponse);
    if (needsCodeChanges.length > 0) {
      tasks.push({
        id: `${currentTask.id}-code`,
        description: `Code changes needed for testing: ${needsCodeChanges.join(', ')}`,
        capabilities: [AgentCapability.FRONTEND, AgentCapability.BACKEND],
        priority: 'medium',
        dependencies: [currentTask.id],
        status: 'pending',
      });
    }

    return tasks;
  }

  /**
   * Extract code change requirements from testing response
   */
  private extractCodeChangeNeeds(llmResponse: any): string[] {
    const needs: string[] = [];
    const text = JSON.stringify(llmResponse);

    if (text.includes('testable') || text.includes('refactor')) {
      needs.push('code refactoring for testability');
    }
    if (text.includes('dependency injection')) {
      needs.push('implement dependency injection');
    }

    return needs;
  }
}
