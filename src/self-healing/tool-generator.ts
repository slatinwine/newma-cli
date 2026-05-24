// src/self-healing/tool-generator.ts
/**
 * AI-powered tool generator
 * Creates specialized tools based on error patterns and user needs
 *
 * SECURITY: Generated tools are saved to files and loaded via require(),
 * not evaluated with Function constructor. This provides better security.
 */

import { AutoToolSpec, AutoTestCase, IssuePattern } from './types';
import { Tool, ToolCategory, Permission } from '../tools/types';
import { callAI } from '../ai';
import { Config } from '../config';
import { ExecutionRecord } from '../history';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

/**
 * Tool generator class
 * Uses AI to create specialized tools based on patterns
 */
export class ToolGenerator {
  private generatedTools: Map<string, AutoToolSpec> = new Map();
  private toolsDirectory: string;

  constructor(toolsDirectory: string = '.kode/self-healing/tools') {
    this.toolsDirectory = toolsDirectory;
  }

  /**
   * Initialize tools directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.toolsDirectory, { recursive: true });
    } catch (error) {
      console.error(chalk.red('[ToolGenerator] Failed to create tools directory:'), error);
    }
  }

  /**
   * Generate a tool based on an issue pattern
   */
  async generateToolFromPattern(
    pattern: IssuePattern,
    config: Config,
    context?: {
      projectInfo?: string | Record<string, string>;
      recentExecutions?: ExecutionRecord[];
    }
  ): Promise<AutoToolSpec | null> {
    console.log(chalk.cyan(`[ToolGenerator] 🛠️  Generating tool for pattern: ${pattern.pattern}`));

    const prompt = this.buildToolGenerationPrompt(pattern, context);

    try {
      const response = await callAI(
        config,
        typeof context?.projectInfo === 'string' ? {} : (context?.projectInfo || {}),
        `Generate a specialized tool to handle this recurring issue: ${pattern.pattern}`,
        'plan',
        [],
        undefined, // don't use tools in tool generation
        undefined,
        undefined,
        undefined,
        undefined,
        undefined, // no abort signal
        prompt // custom system prompt
      );

      const toolSpec = this.parseToolSpecFromContent(response.content || '', pattern);
      if (toolSpec) {
        this.generatedTools.set(toolSpec.name, toolSpec);
        return toolSpec;
      }

      return null;
    } catch (error) {
      console.error(chalk.red('[ToolGenerator] Failed to generate tool:'), error);
      return null;
    }
  }

  /**
   * Generate tool from user request
   */
  async generateToolFromRequest(
    request: string,
    config: Config,
    context?: {
      projectInfo?: string;
      recentExecutions?: ExecutionRecord[];
    }
  ): Promise<AutoToolSpec | null> {
    console.log(chalk.cyan(`[ToolGenerator] 🛠️  Generating tool from request: ${request}`));

    const prompt = `
You are a tool generation expert. Create a specialized tool based on the user's request.

User Request: ${request}

${context?.projectInfo ? `Project Context:\n${context.projectInfo}\n` : ''}

Generate a tool specification in JSON format:
{
  "name": "tool-name",
  "description": "What this tool does",
  "category": "file|command|analysis|system",
  "parameters": [
    {
      "name": "param1",
      "type": "string|number|boolean",
      "description": "Parameter description",
      "required": true,
      "default": "default value (if applicable)"
    }
  ],
  "handlerCode": "TypeScript code for the tool handler function body",
  "estimatedUsefulness": 0.8
}

Requirements:
- Tool name should be kebab-case
- handlerCode should be the FUNCTION BODY only (not the full function declaration)
- The function will have access to: params, context (ToolContext)
- Must return: { success: boolean, output?: string, error?: string }
- Include error handling
- Use try-catch blocks
- Make the tool reusable and well-documented

Example handlerCode:
\`\`\`
try {
  const filePath = params.filePath as string;
  const content = params.content as string;

  await fs.writeFile(filePath, content, 'utf-8');

  return {
    success: true,
    output: \`File \${filePath} written successfully\`
  };
} catch (error: any) {
  return {
    success: false,
    error: error.message
  };
}
\`\`\`
`;

    try {
      const response = await callAI(
        config,
        typeof context?.projectInfo === 'string' ? {} : (context?.projectInfo || {}),
        request,
        'plan',
        [],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        prompt
      );

      const toolSpec = this.parseToolSpecFromContent(response.content || '', undefined);
      if (toolSpec) {
        this.generatedTools.set(toolSpec.name, toolSpec);
        return toolSpec;
      }

      return null;
    } catch (error) {
      console.error(chalk.red('[ToolGenerator] Failed to generate tool:'), error);
      return null;
    }
  }

  /**
   * Parse tool spec from content string
   */
  private parseToolSpecFromContent(content: string, pattern?: IssuePattern): AutoToolSpec | null {
    try {
      // Try to extract JSON from content
      const jsonMatch = content.match(/\{[\s\S]*"name"[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }

      const spec = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!spec.name || !spec.description || !spec.handlerCode) {
        return null;
      }

      return {
        name: spec.name,
        description: spec.description,
        category: spec.category || 'analysis',
        parameters: spec.parameters || [],
        handlerCode: spec.handlerCode,
        testCases: spec.testCases || [],
        estimatedUsefulness: spec.estimatedUsefulness || 0.5,
      };
    } catch (error) {
      console.error(chalk.yellow('[ToolGenerator] Failed to parse tool spec:'), error);
      return null;
    }
  }

  /**
   * Save generated tool to file and return Tool interface
   * SECURITY: Tools are saved to files and loaded via require(), not eval'd
   */
  async saveAndLoadTool(spec: AutoToolSpec): Promise<Tool | null> {
    try {
      await this.initialize();

      const filePath = path.join(this.toolsDirectory, `${spec.name}.ts`);
      const camelCaseName = this.toCamelCase(spec.name);

      // Generate tool file with proper TypeScript
      const toolFileContent = this.generateToolFileContent(spec, camelCaseName);

      await fs.writeFile(filePath, toolFileContent, 'utf-8');

      console.log(chalk.green(`[ToolGenerator] ✅ Tool saved to: ${filePath}`));

      // Load the tool by requiring the generated file
      // This is safer than using Function constructor
      const absolutePath = path.resolve(filePath);
      delete require.cache[require.resolve(absolutePath)];
      const toolModule = require(absolutePath);

      return toolModule[camelCaseName] || null;
    } catch (error: any) {
      console.error(chalk.red('[ToolGenerator] Failed to save/load tool:'), error.message);
      return null;
    }
  }

  /**
   * Generate TypeScript file content for a tool
   */
  private generateToolFileContent(spec: AutoToolSpec, camelCaseName: string): string {
    const permissions = this.inferPermissions(spec);
    const category = this.mapCategory(spec.category);

    return `// Auto-generated tool: ${spec.name}
// Generated: ${new Date().toISOString()}
// Description: ${spec.description}
//
// SECURITY: This tool was auto-generated by the self-healing system.
// Review before using in production.

import { Tool, ToolContext, ToolResult } from '../../types';
import * as fs from 'fs/promises';
import * as path from 'path';

export const ${camelCaseName}: Tool = {
  name: '${spec.name}',
  description: '${spec.description}',
  category: ToolCategory.${category},
  permissions: [
${permissions.map(p => `    Permission.${p},`).join('\n')}
  ],
  parameters: [
${spec.parameters.map(p => `    {
      name: '${p.name}',
      type: '${p.type}',
      description: '${p.description}',
      required: ${p.required},
      ${p.default !== undefined ? `default: '${p.default}',` : ''}
    }`).join(',\n')}
  ],
  handler: async (params: any, context: ToolContext): Promise<ToolResult> => {
    try {
      // Handler code (AI-generated)
      ${spec.handlerCode}

      // Ensure return structure
      if (typeof result === 'object' && 'success' in result) {
        return result;
      }

      return {
        success: true,
        output: JSON.stringify(result)
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Handler execution failed'
      };
    }
  },
};
`;
  }

  /**
   * Map string category to ToolCategory enum
   */
  private mapCategory(category: string): ToolCategory {
    const categoryMap: Record<string, ToolCategory> = {
      'file': ToolCategory.FILE,
      'command': ToolCategory.COMMAND,
      'analysis': ToolCategory.ANALYSIS,
      'system': ToolCategory.SYSTEM,
      'version_control': ToolCategory.VERSION_CONTROL,
      'search': ToolCategory.SEARCH,
      'execution': ToolCategory.EXECUTION,
      'database': ToolCategory.DATABASE,
      'network': ToolCategory.NETWORK,
    };

    return categoryMap[category] || ToolCategory.ANALYSIS;
  }

  /**
   * Infer required permissions from tool spec
   */
  private inferPermissions(spec: AutoToolSpec): Permission[] {
    const permissions: Permission[] = [];

    const code = spec.handlerCode.toLowerCase();
    const desc = spec.description.toLowerCase();

    // Check for file operations
    if (code.includes('fs.read') || code.includes('readfile') || desc.includes('read') || desc.includes('check')) {
      permissions.push(Permission.READ_FILES);
    }
    if (code.includes('fs.write') || code.includes('writefile') || code.includes('create') || desc.includes('create') || desc.includes('write')) {
      permissions.push(Permission.WRITE_FILES);
    }
    if (code.includes('fs.delete') || code.includes('unlink') || desc.includes('delete') || desc.includes('remove')) {
      permissions.push(Permission.DELETE_FILES);
    }

    // Check for command execution
    if (code.includes('exec') || code.includes('spawn') || desc.includes('run') || desc.includes('execute')) {
      permissions.push(Permission.RUN_COMMANDS);
    }

    // Check for network operations
    if (code.includes('fetch') || code.includes('http') || desc.includes('api') || desc.includes('http')) {
      permissions.push(Permission.NETWORK_ACCESS);
    }

    // Check for git operations
    if (code.includes('git.') || desc.includes('git')) {
      permissions.push(Permission.MODIFY_GIT);
    }

    // Default to read-only if no permissions detected
    if (permissions.length === 0) {
      permissions.push(Permission.READ_FILES);
    }

    return permissions;
  }

  /**
   * Validate tool spec before saving
   */
  validateToolSpec(spec: AutoToolSpec): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!spec.name || spec.name.trim() === '') {
      errors.push('Tool name is required');
    }

    if (!spec.description || spec.description.trim() === '') {
      errors.push('Tool description is required');
    }

    if (!spec.handlerCode || spec.handlerCode.trim() === '') {
      errors.push('Handler code is required');
    }

    // Validate name format
    if (spec.name && !/^[a-z0-9-]+$/.test(spec.name)) {
      errors.push('Tool name must be kebab-case (lowercase letters, numbers, hyphens)');
    }

    // Validate parameters
    if (spec.parameters) {
      spec.parameters.forEach((param) => {
        if (!param.name) {
          errors.push(`Parameter is missing a name`);
        }
        if (!['string', 'number', 'boolean', 'enum', 'array'].includes(param.type)) {
          errors.push(`Parameter ${param.name} has invalid type: ${param.type}`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get all generated tools
   */
  getGeneratedTools(): AutoToolSpec[] {
    return Array.from(this.generatedTools.values());
  }

  /**
   * Get tool by name
   */
  getTool(name: string): AutoToolSpec | undefined {
    return this.generatedTools.get(name);
  }

  /**
   * Build tool generation prompt from pattern
   */
  private buildToolGenerationPrompt(
    pattern: IssuePattern,
    context?: {
      projectInfo?: string | Record<string, string>;
      recentExecutions?: ExecutionRecord[];
    }
  ): string {
    let prompt = `
You are a tool generation expert. Analyze this recurring issue pattern and create a specialized tool to handle it.

Issue Pattern:
- Type: ${pattern.category}
- Description: ${pattern.pattern}
- Frequency: ${pattern.frequency} occurrences
- Error Code: ${pattern.errorCode || 'N/A'}

${pattern.suggestedFix ? `Suggested Fix: ${pattern.suggestedFix}` : ''}

`;

    if (context?.recentExecutions && context.recentExecutions.length > 0) {
      prompt += `\nRecent Executions:\n`;
      context.recentExecutions.slice(-3).forEach((exec, idx) => {
        prompt += `\n${idx + 1}. ${JSON.stringify(exec.action)}\n`;
        prompt += `   Success: ${exec.status === 'success'}\n`;
        if (exec.status !== 'success' && exec.error) {
          prompt += `   Error: ${exec.error}\n`;
        }
      });
    }

    prompt += `
Generate a tool specification in JSON format:
{
  "name": "tool-name",
  "description": "What this tool does",
  "category": "file|command|analysis|system",
  "parameters": [
    {
      "name": "param1",
      "type": "string|number|boolean",
      "description": "Parameter description",
      "required": true
    }
  ],
  "handlerCode": "TypeScript function body (not full function)",
  "estimatedUsefulness": 0.8
}

Requirements:
- Tool name should be kebab-case
- handlerCode is the FUNCTION BODY only, inside the try block
- Available: params, context (ToolContext)
- Must return: { success: boolean, output?: string, error?: string }
- Include error handling with try-catch
- Address the specific issue pattern
`;

    return prompt;
  }

  /**
   * Convert kebab-case to camelCase
   */
  private toCamelCase(str: string): string {
    return str.replace(/-([a-z])/g, g => g[1].toUpperCase());
  }
}
