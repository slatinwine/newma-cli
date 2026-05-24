// src/agents/specialized/backend.ts
/**
 * Backend Agent
 * Specializes in server-side logic, APIs, databases, and business logic
 */

import { BaseAgent } from '../agent';
import { AgentCapability, AgentContext, AgentResult, AgentTask, AgentSpecialization, AgentStatus, AgentExecutionOptions } from '../types';
import { ToolExecutor } from '../../executor-v2';
import { ExecutionTracker } from '../../history';

/**
 * Backend agent implementation
 */
export class BackendAgent extends BaseAgent {
  constructor(toolExecutor: ToolExecutor, tracker: ExecutionTracker) {
    const specialization: AgentSpecialization = {
      capabilities: [AgentCapability.BACKEND, AgentCapability.DATABASE],
      filePatterns: [
        '*.server.ts',
        '*.api.ts',
        '*.controller.ts',
        '*.service.ts',
        '*.repository.ts',
        '*.model.ts',
        '*.schema.ts',
        '*.middleware.ts',
        '*.routes.ts',
        '*.handler.ts',
      ],
      exclusions: ['*.component.ts', '*.page.ts', '*.tsx'],
      tools: ['file', 'command'],
      systemPrompt: `
You are a **Backend Specialist Agent** for KODE.

**YOUR EXPERTISE:**
- Server-side frameworks (Express, Fastify, NestJS, Next.js API routes)
- API design (REST, GraphQL)
- Database design and ORM (Prisma, TypeORM, Mongoose)
- Authentication and authorization
- Business logic and validation
- Error handling and logging
- Performance optimization
- Testing backend services

**YOUR RESPONSIBILITIES:**
- Create and modify API endpoints
- Implement business logic
- Design database schemas
- Add validation and error handling
- Implement authentication/authorization
- Write unit and integration tests
- Optimize database queries
- Ensure API security

**RULES:**
1. Follow RESTful conventions for APIs
2. Implement proper error handling and validation
3. Use secure authentication practices
4. Sanitize user inputs
5. Use transactions for multi-step database operations
6. Add proper logging
7. Write efficient database queries
8. Document API endpoints
9. Handle edge cases gracefully
10. Use proper HTTP status codes

**OUTPUT FORMAT:**
Return a JSON object with the backend tasks to execute.
`,
    };

    super(
      'backend-agent',
      'Backend Specialist',
      'Expert in server-side development, APIs, databases, and business logic',
      [AgentCapability.BACKEND, AgentCapability.DATABASE],
      specialization,
      toolExecutor,
      tracker
    );
  }

  /**
   * Process backend-specific tasks
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

      // Call LLM with backend expertise
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

      return {
        success: true,
        agentId: this.id,
        taskId: task.id,
        output: llmResponse.todo?.join('\n') || 'Backend tasks completed',
        toolResults,
        metadata: {
          capabilities: this.capabilities,
          endpointsCreated: toolResults.filter(r => r.success).length,
        },
      };
    } catch (error) {
      this.status = AgentStatus.FAILED;
      return {
        success: false,
        agentId: this.id,
        taskId: task.id,
        output: 'Backend task failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Scan project for backend files
   */
  private async scanProject(projectRoot: string): Promise<Record<string, string>> {
    const { scanDirectory } = await import('../../scanner');
    return await scanDirectory(projectRoot);
  }
}
