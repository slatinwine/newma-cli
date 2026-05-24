/**
 * Plugin Generator
 *
 * Generates plugin code from requirements using AI and templates
 */

import type {
  PluginRequirement,
  PluginGenerationOptions,
  PluginGenerationResult,
  GeneratedFile,
  TemplateContext,
  PluginTemplate,
} from './types';
import { callAI } from '../ai';
import type { Config } from '../config';
import { promises as fs } from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { PluginCodeValidator } from './validator';
import { BunCompiler } from './compiler';

export class PluginGenerator {
  private config: Config;
  private projectRoot: string;
  private validator: PluginCodeValidator;
  private compiler: BunCompiler;

  constructor(config: Config, projectRoot: string) {
    this.config = config;
    this.projectRoot = projectRoot;
    this.validator = new PluginCodeValidator();
    this.compiler = new BunCompiler();
  }

  /**
   * Generate plugin from requirements
   */
  async generate(
    requirement: PluginRequirement,
    options: PluginGenerationOptions = {}
  ): Promise<PluginGenerationResult> {
    console.log(chalk.cyan(`[Plugin Generator] Generating: ${requirement.name}`));

    const warnings: string[] = [];
    const files: GeneratedFile[] = [];

    // Normalize plugin ID
    const pluginId = this.toKebabCase(requirement.name);

    // Load template
    const template = options.template || 'basic';
    const templateContent = await this.loadTemplate(template);

    // Build template context
    const context: TemplateContext = {
      pluginName: requirement.name,
      pluginId,
      description: requirement.description,
      tools: requirement.tools,
      version: requirement.version || '1.0.0',
      author: requirement.metadata?.author,
      year: new Date().getFullYear(),
      kodeVersion: '3.0.0',
    };

    // Generate main plugin file
    let pluginCode = await this.generatePluginCode(requirement, context, template);

    // Validate generated code with enhanced validator
    console.log(chalk.gray('[Skills Creator] 🔍 Validating generated code...'));
    let validation = this.validator.validate(pluginCode);

    if (!validation.valid) {
      this.validator.displayValidation(validation);

      // Try to auto-fix common errors
      if (validation.fixes && validation.fixes.length > 0) {
        console.log(chalk.yellow('\n[S Skills Creator] 🔧 Attempting auto-fix...'));

        const fixedCode = this.validator.autoFix(pluginCode);
        const revalidation = this.validator.validate(fixedCode);

        if (revalidation.valid) {
          console.log(chalk.green('[Skills Creator] ✅ Auto-fix successful!'));
          pluginCode = fixedCode;
          validation = revalidation;
        } else {
          console.warn(chalk.yellow('[Skills Creator] ⚠️  Auto-fix partially successful, manual review needed'));
          this.validator.displayValidation(revalidation);
          warnings.push(`Auto-fix attempted but validation issues remain`);
        }
      } else {
        warnings.push(`Code validation failed: ${validation.errors.join(', ')}`);
      }
    } else {
      console.log(chalk.green('[Skills Creator] ✅ Code validation passed'));
    }

    if (validation.warnings.length > 0) {
      warnings.push(...validation.warnings);
    }

    // Compile check with bun (optional, can be disabled)
    if (options.skipCompile !== true) {
      console.log(chalk.gray('[Skills Creator] 🔨 Running bun compile check...'));

      try {
        const compilation = await this.compiler.syntaxCheck(pluginCode);

        if (compilation.success) {
          console.log(chalk.green('[Skills Creator] ✅ Bun compilation successful'));
        } else {
          console.error(chalk.red('[Skills Creator] ❌ Bun compilation failed:'));
          this.compiler.displayCompilationResult(compilation);

          // Add compilation errors to warnings
          warnings.push(`Bun compilation failed: ${compilation.errors.join(', ')}`);

          // Still write the file, but warn user
          if (!options.continueOnError) {
            console.warn(chalk.yellow('[Skills Creator] ⚠️  Writing file despite compilation errors'));
          }
        }
      } catch (error: any) {
        console.warn(chalk.yellow('[Skills Creator] ⚠️  Bun not available, skipping compilation check'));
        warnings.push('Bun compilation check skipped');
      }
    }

    files.push({
      path: 'plugin.ts',
      content: pluginCode,
      type: 'code',
    });

    // Generate package.json
    const packageJson = this.generatePackageJson(context);
    files.push({
      path: 'package.json',
      content: packageJson,
      type: 'config',
    });

    // Generate README
    if (options.includeReadme !== false) {
      const readme = this.generateReadme(context);
      files.push({
        path: 'README.md',
        content: readme,
        type: 'documentation',
      });
    }

    // Generate tests
    if (options.includeTests !== false) {
      const testCode = this.generateTestCode(context);
      files.push({
        path: 'plugin.test.ts',
        content: testCode,
        type: 'test',
      });
    }

    // Generate TypeScript definitions
    if (options.includeTypes !== false) {
      const typesCode = this.generateTypes(context);
      files.push({
        path: 'types.ts',
        content: typesCode,
        type: 'code',
      });
    }

    // Generate resource files
    if (options.includeResources !== false) {
      // Generate example script
      const exampleScript = this.generateExampleScript(context);
      files.push({
        path: 'scripts/example.ts',
        content: exampleScript,
        type: 'code',
      });

      // Generate API reference
      const apiReference = this.generateApiReference(context);
      files.push({
        path: 'references/api.md',
        content: apiReference,
        type: 'documentation',
      });

      // Generate asset placeholder
      const assetPlaceholder = this.generateAssetPlaceholder();
      files.push({
        path: 'assets/README.md',
        content: assetPlaceholder,
        type: 'documentation',
      });
    }

    return {
      plugin: await this.parsePluginCode(pluginCode),
      files,
      warnings: warnings.length > 0 ? warnings : undefined,
      nextSteps: this.getNextSteps(pluginId, options),
    };
  }

  /**
   * Generate plugin code using AI
   * Uses Function Calling API when available, falls back to strong prompts
   */
  private async generatePluginCode(
    requirement: PluginRequirement,
    context: TemplateContext,
    template: string
  ): Promise<string> {
    const { supportsFunctionCalling } = await import('../ai');
    const useFunctionCalling = supportsFunctionCalling(this.config);

    if (useFunctionCalling) {
      // Try Function Calling API for reliable code extraction
      try {
        const code = await this.generateWithFunctionCalling(requirement, context, template);

        // Validate generated code
        if (this.isValidPluginCode(code)) {
          console.log('[Skills Creator] ✓ Generated code via Function Calling API');
          return code;
        }
      } catch (error: any) {
        console.warn('[Skills Creator] Function Calling failed, falling back to prompts:', error.message);
      }
    }

    // Fallback: Strong prompt approach
    return this.generateWithStrongPrompt(requirement, context, template);
  }

  /**
   * Generate using Function Calling API (most reliable)
   */
  private async generateWithFunctionCalling(
    requirement: PluginRequirement,
    context: TemplateContext,
    template: string
  ): Promise<string> {
    const { callAI, buildToolDefinitions } = await import('../ai');

    const systemPrompt = `You are a TypeScript plugin generator for Kode.
Generate complete, working plugin code based on requirements.

CRITICAL RULES:
- Return ONLY the code, no explanations
- Include all imports at the top
- Implement all required tools
- Add proper error handling
- Include JSDoc comments
- Export the plugin as default`;

    const userPrompt = this.buildCodeGenerationPrompt(requirement, context, template);

    // Define function for code generation
    const codeGenFunction = {
      type: 'function' as const,
      function: {
        name: 'generate_plugin_code',
        description: 'Generate complete TypeScript plugin code',
        parameters: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'Complete TypeScript plugin file content with proper escaping'
            },
            explanation: {
              type: 'string',
              description: 'Brief explanation of the generated code'
            }
          },
          required: ['code']
        }
      }
    };

    // Build request with function calling
    const endpoint = this.config.endpoint ||
      `${(this.config.baseUrl || 'https://api.openai.com').replace(/\/+$/, '')}/v1/chat/completions`;

    const requestBody: any = {
      model: this.config.model,
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      tools: [codeGenFunction],
      tool_choice: { type: 'function', name: 'generate_plugin_code' }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Function Calling API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    // Extract function call result
    const toolCall = data.choices[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const args = JSON.parse(toolCall.function.arguments);
      if (args.code) {
        // Unescape newlines and quotes
        return args.code.replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }
    }

    throw new Error('Function Calling did not return code');
  }

  /**
   * Generate using strong prompts (fallback)
   */
  private async generateWithStrongPrompt(
    requirement: PluginRequirement,
    context: TemplateContext,
    template: string
  ): Promise<string> {
    const prompt = await this.buildCodeGenerationPrompt(requirement, context, template);

    // Disable auto algorithm selection for plugin generation
    // To avoid triggering ToT which can cause long delays
    const originalAutoAlgorithm = this.config.autoAlgorithm;
    this.config.autoAlgorithm = false;

    try {
      // Use 'plan' mode for structured output
      const response = await callAI(
        this.config,
        {},
        prompt,
        'plan',  // Use 'plan' mode, NOT 'think'
        [],
        undefined,
        undefined,
        undefined,
        this.projectRoot
      );

      // Extract JSON with code field
      const code = this.extractCodeFromResponse(response.content || '', 'plugin.ts');
      return code;
    } finally {
      // Restore original autoAlgorithm setting
      this.config.autoAlgorithm = originalAutoAlgorithm;
    }
  }

  /**
   * Validate generated plugin code
   */
  private isValidPluginCode(code: string): boolean {
    // Basic validation checks
    const checks = [
      code.includes('import'),  // Has imports
      code.includes('export'),  // Has exports
      code.includes('Plugin'),  // Uses Plugin type
      code.length > 500,        // Minimum length
      !code.includes('```'),    // No markdown artifacts
      !code.includes('TODO'),   // No TODO placeholders
    ];

    return checks.every(check => check === true);
  }

  /**
   * Build code generation prompt (enhanced with complete examples)
   */
  private async buildCodeGenerationPrompt(
    requirement: PluginRequirement,
    context: TemplateContext,
    template: string
  ): Promise<string> {
    // Import the enhanced prompt builder
    const { buildEnhancedPrompt } = await import('./prompts/plugin-prompt');
    return buildEnhancedPrompt(requirement, context);
  }

  /**
   * Extract code from AI response
   */
  private extractCodeFromResponse(response: string, filename: string): string {
    // 1. Try to extract JSON code block with 'code' field (新方法 - 优先)
    try {
      // 首先尝试找到 ```json ... ``` 代码块
      const jsonCodeBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      let jsonStr = '';

      if (jsonCodeBlockMatch) {
        // 从代码块中提取 JSON
        jsonStr = jsonCodeBlockMatch[1].trim();
        console.log('[Skills Creator] Found JSON code block');
      } else {
        // 如果没有代码块，尝试解析整个响应为 JSON
        jsonStr = response.trim();
      }

      // 尝试解析 JSON
      const jsonResponse = JSON.parse(jsonStr);

      if (jsonResponse.code && typeof jsonResponse.code === 'string') {
        console.log('[Skills Creator] ✓ Extracted code from JSON field');
        // 将 \n 转义换回实际换行符
        return jsonResponse.code.replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }
    } catch (e) {
      // JSON 解析失败，使用原有的代码块提取逻辑
      console.log('[Skills Creator] JSON parse failed, trying code block extraction...');
    }

    // 2. Try to extract TypeScript/TS code block
    const tsCodeBlockMatch = response.match(/```(?:typescript|ts)\n([\s\S]*?)```/);
    if (tsCodeBlockMatch) {
      return tsCodeBlockMatch[1].trim();
    }

    // 3. Try to extract any code block (不包括 JSON)
    const codeBlockMatch = response.match(/```(?!json)([\w]*)\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[2].trim();
    }

    // 4. Try to find import statement as code start
    const importMatch = response.match(/(?:^|\n)(import\s+.*$)/m);
    if (importMatch) {
      const startIndex = response.indexOf(importMatch[1]);
      const lines = response.substring(startIndex).split('\n');
      const codeLines: string[] = [];

      for (const line of lines) {
        // Skip everything until we see import
        if (!codeLines.length && !line.includes('import')) {
          continue;
        }

        // Stop conditions
        if (line.trim().startsWith('```')) break; // Code block end
        if (line.trim().startsWith('{') && line.includes(':') && !line.includes('export')) {
          // Likely JSON metadata
          if (line.trim().startsWith('{') && line.includes('"todo"')) break;
        }
        if (line.trim().match(/^\d+\s+/)) break; // "1 The user wants..." (AI thinking)

        codeLines.push(line);
      }

      if (codeLines.length > 0) {
        return codeLines.join('\n').trim();
      }
    }

    // 5. If all extraction methods fail, warn and return as-is
    console.warn('[Skills Creator] Could not extract clean code from AI response');
    console.warn('[Skills Creator] Response preview:', response.substring(0, 200));
    return response.trim();
  }

  /**
   * Load template file
   */
  private async loadTemplate(templateType: PluginTemplate): Promise<string> {
    const templateFileName = templateType === 'custom' ? 'custom' : templateType;
    const templatePath = path.join(__dirname, 'templates', `${templateFileName}.ts`);

    try {
      // Dynamic import to get template constant
      const templateModule = await import(templatePath);

      // Try different export names
      const templateConstant = templateModule[`${templateType.toUpperCase()}_TEMPLATE`] ||
                              templateModule.DEFAULT ||
                              templateModule.default;

      if (typeof templateConstant === 'string') {
        return templateConstant;
      } else {
        throw new Error('Template constant not found in module');
      }
    } catch (error: any) {
      console.warn(chalk.yellow(`Template not found: ${templateType}`));
      console.warn(chalk.yellow(`Error: ${error.message}`));
      console.warn(chalk.yellow(`Using enhanced basic template`));

      // Return enhanced basic template with guidance
      return this.getEnhancedBasicTemplate();
    }
  }

  /**
   * Get basic template
   */
  private getBasicTemplate(): string {
    return `import type { Plugin } from '../../src/plugins/types';

const {{pluginName}}: Plugin = {
  id: '{{pluginId}}',
  name: '{{pluginName}}',
  version: '{{version}}',
  description: '{{description}}',

  tools: [
    {{#each tools}}
    {
      name: '{{name}}',
      description: '{{description}}',
      category: '{{category}}',
      permissions: [{{#each permissions}}'{{this}}'{{#unless @last}}, {{/unless}}{{/each}}],

      handler: async (params, context) => {
        // Implementation here
        return {
          success: true,
          output: 'Result',
        };
      },
    },
    {{/each}}
  ],

  async initialize(context) {
    console.log('[{{pluginName}}] Initialized');
  },

  async cleanup(context) {
    console.log('[{{pluginName}}] Cleaned up');
  },
};

export default {{pluginName}};`;
  }

  /**
   * Get enhanced basic template with guidance
   */
  private getEnhancedBasicTemplate(): string {
    return `/**
 * {pluginName} Plugin
 *
 * [TODO: Complete description - explain what this plugin does]
 *
 * Quick Start:
 * 1. Implement tool handlers below
 * 2. Test: bun test plugin.test.ts
 * 3. Load: /plugin-load {pluginId}
 */

import type { Plugin } from '../../src/plugins/types';
import { ToolCategory, Permission } from '../../src/tools/types';

const {pluginId}Plugin: Plugin = {
  id: '{pluginId}',
  name: '{pluginName}',
  version: '{version}',
  description: '{description}',

  tools: [
    {#each tools}
    {
      name: '{name}',
      description: '{description}',
      category: ToolCategory.{uppercase category},
      permissions: [{#each permissions}Permission.{uppercase this}{#unless @last}}, {/unless}{/each}],

      handler: async (params, context) => {
        // [TODO: Implement {name} handler]
        return {
          success: true,
          output: 'Result',
        };
      },
    },
    {/each}
  ],

  async initialize(context) {
    // [TODO: Add initialization logic]
    console.log('[{pluginName}] Initialized');
  },

  async cleanup(context) {
    // [TODO: Add cleanup logic]
    console.log('[{pluginName}] Cleaned up');
  },
};

export default {pluginId}Plugin;`;
  }

  /**
   * Generate package.json
   */
  private generatePackageJson(context: TemplateContext): string {
    const pkg = {
      name: context.pluginId,
      version: context.version,
      description: context.description,
      main: 'plugin.ts',
      keywords: ['kode-plugin', context.pluginId],
      author: context.author || 'Kode User',
      license: 'MIT',
      kode: {
        id: context.pluginId,
        entryPoint: 'plugin.ts',
      },
    };

    return JSON.stringify(pkg, null, 2);
  }

  /**
   * Generate README
   */
  private generateReadme(context: TemplateContext): string {
    const toolsList = context.tools
      .map(t => `- \`${t.name}\`: ${t.description}`)
      .join('\n');

    return `# ${context.pluginName}

${context.description}

## Version

v${context.version}

## Tools

${toolsList}

## Installation

\`\`\`bash
# Copy to your Kode plugins directory
cp -r ${context.pluginId} ~/.kode/plugins/
\`\`\`

## Usage

\`\`\`bash
# In Kode REPL
> /plugin-load ${context.pluginId}

# Use the tools
> ${context.tools[0]?.name || 'tool-name'} ...
\`\`\`

## Development

\`\`\`bash
# Run tests
bun test plugin.test.ts

# Load plugin for testing
bun run plugin:load
\`\`\`

## Author

${context.author || 'Kode User'}

## License

MIT
`;
  }

  /**
   * Generate test code
   */
  private generateTestCode(context: TemplateContext): string {
    const toolTests = context.tools
      .map(tool => `
describe('${tool.name}', () => {
  it('should execute successfully', async () => {
    const result = await tool.handler({}, mockContext);

    expect(result.success).toBe(true);
  });
});`)
      .join('\n');

    return `import { describe, it, expect, beforeEach } from 'bun:test';
import plugin from './plugin';

describe('${context.pluginName}', () => {
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      pluginRoot: '/tmp/plugin',
      projectRoot: '/tmp/project',
      config: {},
    };
  });

  it('should have correct metadata', () => {
    expect(plugin.id).toBe('${context.pluginId}');
    expect(plugin.name).toBe('${context.pluginName}');
    expect(plugin.tools).toBeDefined();
  });

  it('should have tools', () => {
    expect(plugin.tools.length).toBeGreaterThan(0);
  });${toolTests}
});
`;
  }

  /**
   * Generate TypeScript definitions
   */
  private generateTypes(context: TemplateContext): string {
    const toolInterfaces = context.tools
      .map(tool => `export interface ${this.toPascalCase(tool.name)}Params {
  ${Object.entries(tool.parameters?.properties || {})
    .map(([name, prop]: [string, any]) => `  ${name}?: ${prop.type};`)
    .join('\n')}
}`)
      .join('\n\n');

    return `/**
 * Type definitions for ${context.pluginName}
 */

${toolInterfaces}

export interface ${this.toPascalCase(context.pluginId)}Config {
  // Add plugin-specific config here
}
`;
  }

  /**
   * Generate example script
   */
  private generateExampleScript(context: TemplateContext): string {
    return `#!/usr/bin/env bun
/**
 * Example script for ${context.pluginName}
 *
 * This script demonstrates how to use the plugin outside of Kode.
 * Run: bun run scripts/example.ts
 */

import plugin from '../plugin';

async function main() {
  console.log('Running ${context.pluginName} example...');

  // Example: Initialize plugin
  await plugin.initialize({
    projectRoot: process.cwd(),
    pluginRoot: __dirname,
    config: {},
  });

  // Example tool call
  if (plugin.tools.length > 0) {
    const tool = plugin.tools[0];
    console.log(\`\\nCalling tool: \${tool.name}\`);

    const result = await tool.handler(
      { /* Add tool parameters here */ },
      {
        projectRoot: process.cwd(),
        pluginRoot: __dirname,
        config: {},
      }
    );

    console.log('Result:', result);
  }

  // Cleanup
  await plugin.cleanup({});
}

main().catch(console.error);
`;
  }

  /**
   * Generate API reference documentation
   */
  private generateApiReference(context: TemplateContext): string {
    const toolsList = context.tools.map(tool => `
### \`${tool.name}\`

**Description**: ${tool.description}

**Category**: ${tool.category || 'utility'}

**Permissions**: ${tool.permissions?.join(', ') || 'None'}

**Parameters**:

${tool.parameters?.properties ?
  Object.entries(tool.parameters.properties).map(([name, prop]: [string, any]) => `
- \`${name}\` (\`${prop.type}\`): ${prop.description}${tool.parameters && tool.parameters.required?.includes(name) ? ' **(required)**' : ' *(optional)*'}
`).join('') : 'No parameters'}

**Example**:

\`\`\`typescript
await tool.handler({
${tool.parameters?.properties ?
  Object.entries(tool.parameters.properties).map(([name, prop]) => `  ${name}: /* ${prop.type} */`).join(',\n')
  : '  // No parameters'}
}, context);
\`\`\`
`).join('\n---\n');

    return `# ${context.pluginName} API Reference

## Overview

${context.description}

**Version**: ${context.version}
**Author**: ${context.author || 'Kode User'}

## Installation

\`\`\`bash
# Copy to your Kode plugins directory
cp -r ${context.pluginId} ~/.kode/plugins/
\`\`\`

## Quick Start

\`\`\`bash
# In Kode REPL
> /plugin-load ${context.pluginId}

# List available tools
> /plugin-list ${context.pluginId}

# Use a tool
> ${context.tools[0]?.name || 'tool-name'} <params>
\`\`\`

## Tools

${toolsList}

## Development

\`\`\`bash
# Run tests
bun test plugin.test.ts

# Run example script
bun run scripts/example.ts
\`\`\`

## License

MIT
`;
  }

  /**
   * Generate asset placeholder
   */
  private generateAssetPlaceholder(): string {
    return `# Plugin Assets

This directory is for plugin assets that are used in output but not loaded into context.

## Common Asset Types

- **Templates**: Boilerplate files, document templates
- **Config files**: Default configurations, schemas
- **Data files**: Sample data, test fixtures
- **Media**: Icons, images, fonts

## Examples

\`\`\`
assets/
├── templates/
│   └── template.md
├── config/
│   └── default.json
└── data/
    └── sample.json
\`\`\`

Note: This is a placeholder directory. Add assets as needed for your plugin.
`;
  }

  /**
   * Parse plugin code to extract Plugin object
   */
  private async parsePluginCode(code: string): Promise<any> {
    // For now, return a mock plugin
    // In production, you'd use TypeScript compiler to parse
    return {
      id: 'temp',
      name: 'temp',
      version: '1.0.0',
      description: 'temp',
      tools: [],
    };
  }

  /**
   * Get next steps for user
   */
  private getNextSteps(pluginId: string, options: PluginGenerationOptions): string[] {
    const steps = [
      `Review generated plugin in ${options.outDir || pluginId}/`,
      'Test the plugin: bun test plugin.test.ts',
      'Load in Kode: bun run plugin:load',
      'Customize tool implementations',
      'Add error handling',
      'Write documentation',
    ];

    return steps;
  }

  /**
   * Convert to kebab-case
   */
  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  /**
   * Convert to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .replace(/[-_\s](.)/g, (_, c) => c.toUpperCase())
      .replace(/^(.)/, (_, c) => c.toUpperCase());
  }

  /**
   * Validate generated code before writing
   * Checks for common issues like AI thinking process, JSON metadata, etc.
   */
  private validateGeneratedCode(code: string, filename: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check 1: Must start with import or interface or type or const or export
    if (!code.match(/^(import|interface|type|const|export)/m)) {
      errors.push('Code must start with import, interface, type, const, or export');
    }

    // Check 2: Must not contain AI thinking markers (numbered lists)
    if (code.match(/^\d+\.\s/m)) {
      errors.push('Code contains numbered list (likely AI thinking process)');
    }

    // Check 3: Must not contain JSON metadata
    if (code.includes('"todo":') || code.includes('"actions":')) {
      errors.push('Code contains JSON metadata fields (todo, actions)');
    }

    // Check 4: Must have export statement
    if (!code.includes('export')) {
      errors.push('Code must have export statement');
    }

    // Check 5: Check for Plugin interface usage
    if (!code.includes('Plugin')) {
      errors.push('Code should reference Plugin interface');
    }

    // Check 6: Minimum length check (at least 500 characters for a valid plugin)
    if (code.length < 500) {
      errors.push('Code is too short (< 500 chars), likely incomplete');
    }

    // Check 7: Must not contain markdown artifacts
    if (code.includes('```')) {
      errors.push('Code contains markdown code block markers (```)');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Interactive generation with preview and retry
   */
  async generateInteractive(
    requirement: PluginRequirement,
    options: PluginGenerationOptions = {}
  ): Promise<PluginGenerationResult> {
    let attempt = 0;
    const maxAttempts = options.maxRetries || 2;

    while (attempt < maxAttempts) {
      console.log(chalk.cyan(`\n🔄 Generation attempt ${attempt + 1}...\n`));

      const result = await this.generate(requirement, options);

      // Show preview
      this.showPreview(result.files);

      if (attempt === maxAttempts - 1) {
        console.log(chalk.yellow('\n⚠️  Maximum attempts reached. Using current result.\n'));
        return result;
      }

      // Ask user what to do
      const { action } = await this.promptUserAction();

      if (action === 'accept') {
        return result;
      } else if (action === 'cancel') {
        throw new Error('Plugin creation cancelled by user');
      } else if (action === 'modify') {
        // Prompt for new requirements
        const { newRequirement } = await this.promptForRequirements();
        requirement.description = newRequirement;
      }
      // 'retry' just continues the loop

      attempt++;
    }

    throw new Error('Failed to generate acceptable code');
  }

  /**
   * Show preview of generated files
   */
  private showPreview(files: GeneratedFile[]): void {
    console.log(chalk.bold('\n📄 Generated Files Preview:\n'));

    for (const file of files) {
      console.log(chalk.cyan('══════════════════════════════════════════════════════════════'));
      console.log(chalk.cyan(`📄 ${file.path}`));
      console.log(chalk.cyan('══════════════════════════════════════════════════════════════\n'));

      // Show preview (first 30 lines)
      const lines = file.content.split('\n');
      const preview = lines.slice(0, 30).join('\n');
      console.log(preview);

      if (lines.length > 30) {
        console.log(chalk.gray(`\n... (${lines.length - 30} more lines)`));
      }

      console.log('\n');
    }
  }

  /**
   * Prompt user for action
   */
  private async promptUserAction(): Promise<{ action: string }> {
    const inquirer = await import('inquirer');

    return (inquirer as any).default.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '✅ Accept and write files', value: 'accept' },
          { name: '🔄 Regenerate with same requirements', value: 'retry' },
          { name: '✏️  Modify requirements and regenerate', value: 'modify' },
          { name: '❌ Cancel', value: 'cancel' }
        ]
      }
    ]);
  }

  /**
   * Prompt for modified requirements
   */
  private async promptForRequirements(): Promise<{ newRequirement: string }> {
    const inquirer = await import('inquirer');

    return (inquirer as any).default.prompt([
      {
        type: 'input',
        name: 'newRequirement',
        message: 'Enter modified requirements:',
        default: ''
      }
    ]);
  }
}
