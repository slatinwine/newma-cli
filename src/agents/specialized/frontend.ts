// src/agents/specialized/frontend.ts
/**
 * Frontend Agent
 * Specializes in UI, frontend framework, styling, and user experience
 */

import { BaseAgent } from '../agent';
import { AgentCapability, AgentContext, AgentResult, AgentTask, AgentSpecialization, AgentExecutionOptions, AgentStatus } from '../types';
import { ToolExecutor } from '../../executor-v2';
import { ExecutionTracker } from '../../history';
import { Config } from '../../config';

/**
 * Frontend agent implementation
 */
export class FrontendAgent extends BaseAgent {
  constructor(toolExecutor: ToolExecutor, tracker: ExecutionTracker) {
    const specialization: AgentSpecialization = {
      capabilities: [AgentCapability.FRONTEND],
      filePatterns: [
        '*.tsx',
        '*.jsx',
        '*.ts',
        '*.js',
        '*.css',
        '*.scss',
        '*.sass',
        '*.less',
        '*.vue',
        '*.svelte',
        '*.html',
      ],
      exclusions: ['*.server.ts', '*.api.ts', '*.controller.ts', '*.service.ts'],
      tools: ['file', 'command'],
      systemPrompt: `
You are a **Frontend Specialist Agent** for KODE.

**YOUR EXPERTISE:**
- Modern frontend frameworks (React, Vue, Svelte, Angular)
- Component architecture and design patterns
- UI/UX best practices
- Responsive design and accessibility
- State management (Redux, Zustand, Pinia, etc.)
- Styling (CSS, SCSS, Tailwind, styled-components)
- Performance optimization
- Testing frontend components

**YOUR RESPONSIBILITIES:**
- Create and modify UI components
- Implement responsive layouts
- Style components according to best practices
- Optimize frontend performance
- Ensure accessibility standards (WCAG)
- Write component tests when appropriate

**RULES:**
1. Always use modern, clean code patterns
2. Follow existing project conventions for styling
3. Create reusable, composable components
4. Consider mobile-first responsive design
5. Use semantic HTML
6. Add proper error handling and loading states
7. Optimize images and assets
8. Consider accessibility (ARIA labels, keyboard navigation)

**OUTPUT FORMAT:**
Return a JSON object with the frontend tasks to execute.
`,
    };

    super(
      'frontend-agent',
      'Frontend Specialist',
      'Expert in UI development, component architecture, and user experience',
      [AgentCapability.FRONTEND],
      specialization,
      toolExecutor,
      tracker
    );
  }

  /**
   * Process frontend-specific tasks
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

      // Call LLM with frontend expertise
      const llmResponse = await this.callLLM(
        context.config as Config,
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
        output: llmResponse.todo?.join('\n') || 'Frontend tasks completed',
        toolResults,
        nextTasks,
        metadata: {
          capabilities: this.capabilities,
          filesModified: toolResults.filter(r => r.success).length,
        },
      };
    } catch (error) {
      this.status = AgentStatus.FAILED;
      return {
        success: false,
        agentId: this.id,
        taskId: task.id,
        output: 'Frontend task failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Scan project for frontend files
   */
  private async scanProject(projectRoot: string): Promise<Record<string, string>> {
    // Use the existing scanner
    const { scanDirectory } = await import('../../scanner');
    return await scanDirectory(projectRoot);
  }

  /**
   * Create subtasks for other agents if needed
   */
  private createSubtasks(llmResponse: any, currentTask: AgentTask): AgentTask[] {
    const tasks: AgentTask[] = [];

    // If frontend work requires backend changes, create backend task
    const needsBackend = this.extractBackendNeeds(llmResponse);
    if (needsBackend.length > 0) {
      tasks.push({
        id: `${currentTask.id}-backend`,
        description: `Backend changes needed for frontend: ${needsBackend.join(', ')}`,
        capabilities: [AgentCapability.BACKEND],
        priority: 'medium',
        dependencies: [currentTask.id],
        status: 'pending',
      });
    }

    return tasks;
  }

  /**
   * Extract backend requirements from frontend response
   */
  private extractBackendNeeds(llmResponse: any): string[] {
    const needs: string[] = [];
    const text = JSON.stringify(llmResponse);

    if (text.includes('API') || text.includes('endpoint')) {
      needs.push('API endpoints');
    }
    if (text.includes('data') || text.includes('fetch')) {
      needs.push('data fetching');
    }

    return needs;
  }
}
