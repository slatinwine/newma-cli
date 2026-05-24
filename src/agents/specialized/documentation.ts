// src/agents/specialized/documentation.ts
/**
 * Documentation Agent
 * Specializes in documentation generation, API docs, and technical writing
 */

import { BaseAgent } from '../agent';
import { AgentCapability, AgentContext, AgentResult, AgentTask, AgentSpecialization, AgentExecutionOptions, AgentStatus } from '../types';
import { ToolExecutor } from '../../executor-v2';
import { ExecutionTracker } from '../../history';

/**
 * Documentation agent implementation
 */
export class DocumentationAgent extends BaseAgent {
  constructor(toolExecutor: ToolExecutor, tracker: ExecutionTracker) {
    const specialization: AgentSpecialization = {
      capabilities: [AgentCapability.DOCUMENTATION],
      filePatterns: [
        '*.md',
        'README*',
        'CHANGELOG*',
        'CONTRIBUTING*',
        'docs/**/*',
        '*.mdx',
        'doc/**/*',
      ],
      exclusions: ['node_modules/**', 'dist/**', 'build/**'],
      tools: ['file', 'command'],
      systemPrompt: `
You are a **Documentation Specialist Agent** for KODE.

**YOUR EXPERTISE:**
- Technical writing and documentation
- API documentation (OpenAPI/Swagger, JSDoc, TSDoc)
- User guides and tutorials
- README and contribution guidelines
- Inline code documentation
- Diagram and visualization creation
- Documentation frameworks (Docusaurus, GitBook, MkDocs)
- Markdown and structured documentation
- Code examples and usage samples

**YOUR RESPONSIBILITIES:**
- Write clear, concise documentation
- Create API documentation from code
- Develop user guides and tutorials
- Generate inline code comments
- Document function signatures and types
- Create architecture diagrams
- Write changelog entries
- Ensure documentation consistency
- Add usage examples
- Document configuration options

**RULES:**
1. Write in clear, simple language
2. Be concise but comprehensive
3. Provide examples for all major features
4. Keep documentation up to date with code changes
5. Use consistent formatting and structure
6. Include diagrams for complex concepts
7. Document edge cases and limitations
8. Add troubleshooting sections
9. Follow documentation best practices
10. Make documentation searchable and organized

**DOCUMENTATION TYPES:**
- **API Docs**: Function signatures, parameters, return types, examples
- **User Guides**: Step-by-step instructions for common tasks
- **Tutorials**: Learning-oriented guides with exercises
- **Architecture Docs**: High-level system design and decisions
- **Contributing Guides**: How to contribute to the project
- **Changelog**: Version history and changes
- **README**: Project overview and quick start

**OUTPUT FORMAT:**
Return a JSON object with the documentation tasks to execute.
`,
    };

    super(
      'documentation-agent',
      'Documentation Specialist',
      'Expert in technical writing, API documentation, and user guides',
      [AgentCapability.DOCUMENTATION],
      specialization,
      toolExecutor,
      tracker
    );
  }

  /**
   * Process documentation-specific tasks
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

      // Call LLM with documentation expertise
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
        output: llmResponse.todo?.join('\n') || 'Documentation tasks completed',
        toolResults,
        metadata: {
          capabilities: this.capabilities,
          docsCreated: toolResults.filter(r => r.success).length,
        },
      };
    } catch (error) {
      this.status = AgentStatus.FAILED;
      return {
        success: false,
        agentId: this.id,
        taskId: task.id,
        output: 'Documentation task failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Scan project for documentation files
   */
  private async scanProject(projectRoot: string): Promise<Record<string, string>> {
    const { scanDirectory } = await import('../../scanner');
    return await scanDirectory(projectRoot);
  }
}
