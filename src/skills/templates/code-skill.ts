/**
 * Code Skill Template
 * Executable TypeScript skill with tool integration
 *
 * Best for:
 * - File operations
 * - API integrations
 * - Data processing
 * - System utilities
 */

import { SkillMetadata } from '../types';

export const codeSkillTemplate: {
  metadata: SkillMetadata;
  skillMd: string;
  codeTs: string;
} = {
  metadata: {
    id: 'code-skill',
    name: 'Code Skill',
    version: '1.0.0',
    description: 'A template for creating executable code skills with tool integration',
    type: 'code',
    category: 'utility',
    complexity: 5,
    tags: ['code', 'execution', 'tool'],
    keywords: ['execute', 'run', 'process', 'utility'],
    triggers: ['create', 'generate', 'process', 'execute'],
    whenToUse: [
      'User needs file operations',
      'User requires data processing',
      'User wants API integration',
      'User needs system utilities',
    ],
    author: 'Your Name',
    license: 'MIT',
    performance: {
      estimatedTokens: 1500,
      averageResponseTime: 2000,
      cacheable: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action to perform' },
        options: { type: 'object', description: 'Action options' },
      },
      required: ['action'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        result: { type: 'any' },
        error: { type: 'string' },
      },
    },
  },

  skillMd: `---
name: {{name}}
description: {{description}}
type: code
complexity: {{complexity}}
tags: {{tags}}
triggers: {{triggers}}
whenToUse:
  - {{whenToUse}}
author: {{author}}
version: 1.0.0
category: {{category}}
---

# {{name}}

{{description}}

## Capabilities

{{capabilities}}

## Usage

### Input Schema
\`\`\`json
{{inputSchema}}
\`\`\`

### Output Schema
\`\`\`json
{{outputSchema}}
\`\`\`

## Examples

{{examples}}

## Implementation

The skill is implemented in \`code.ts\` with the following tools:
{{tools}}
`,

  codeTs: `import { SkillContext, SkillResult, Tool } from '../types';

/**
 * {{name}} Skill
 * {{description}}
 */
export class {{className}} {
  /**
   * Execute the skill
   */
  async execute(context: SkillContext): Promise<SkillResult> {
    try {
      const { action, options } = this.parseInput(context.userInput);

      switch (action) {
        {{actions}}
        default:
          return {
            success: false,
            error: \`Unknown action: \${action}\`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Parse user input into action and options
   */
  private parseInput(input: string): { action: string; options: any } {
    // Implement input parsing logic
    const parts = input.split(' ');
    const action = parts[0];
    const options = {};

    return { action, options };
  }

  {{helperMethods}}
}

/**
 * Tool definitions
 */
export const tools: Tool[] = [
  {
    name: '{{toolName}}',
    description: '{{toolDescription}}',
    inputSchema: {
      type: 'object',
      properties: {
        // Add tool-specific properties
      },
      required: [],
    },
    handler: async (params, context) => {
      // Implement tool logic
      return { success: true, result: null };
    },
  },
];
`,
};

/**
 * Generate code skill from variables
 */
export function generateCodeSkill(variables: Record<string, any>): {
  metadata: SkillMetadata;
  skillMd: string;
  codeTs: string;
} {
  const className = variables.name?.replace(/\s+/g, '') || 'CodeSkill';

  const metadata: SkillMetadata = {
    ...codeSkillTemplate.metadata,
    id: variables.name?.toLowerCase().replace(/\s+/g, '-') || 'code-skill',
    name: variables.name || 'Code Skill',
    description: variables.description || 'An executable code skill',
    category: variables.category || 'utility',
    complexity: variables.complexity || 5,
    tags: variables.tags || ['code', 'execution'],
    triggers: variables.triggers || ['execute', 'run'],
    whenToUse: variables.whenToUse || ['User needs code execution'],
    author: variables.author || 'Your Name',
    inputSchema: variables.inputSchema,
    outputSchema: variables.outputSchema,
  };

  const skillMd = codeSkillTemplate.skillMd
    .replace(/\{\{name\}\}/g, metadata.name)
    .replace(/\{\{description\}\}/g, metadata.description)
    .replace(/\{\{complexity\}\}/g, metadata.complexity.toString())
    .replace(/\{\{tags\}\}/g, metadata.tags.join(', '))
    .replace(/\{\{triggers\}\}/g, metadata.triggers.join(', '))
    .replace(/\{\{whenToUse\}\}/g, metadata.whenToUse.join('\n  - '))
    .replace(/\{\{author\}\}/g, metadata.author)
    .replace(/\{\{category\}\}/g, metadata.category)
    .replace(/\{\{capabilities\}\}/g, variables.capabilities || 'List capabilities')
    .replace(/\{\{inputSchema\}\}/g, JSON.stringify(metadata.inputSchema, null, 2))
    .replace(/\{\{outputSchema\}\}/g, JSON.stringify(metadata.outputSchema, null, 2))
    .replace(/\{\{examples\}\}/g, variables.examples || 'Add examples')
    .replace(/\{\{tools\}\}/g, variables.tools || '- Tool 1\n- Tool 2');

  const codeTs = codeSkillTemplate.codeTs
    .replace(/\{\{name\}\}/g, metadata.name)
    .replace(/\{\{description\}\}/g, metadata.description)
    .replace(/\{\{className\}\}/g, className)
    .replace(/\{\{actions\}\}/g, variables.actions || 'case \'default\':\n        return { success: false, error: \'Not implemented\' };')
    .replace(/\{\{helperMethods\}\}/g, variables.helperMethods || '')
    .replace(/\{\{toolName\}\}/g, variables.toolName || 'tool')
    .replace(/\{\{toolDescription\}\}/g, variables.toolDescription || 'Tool description');

  return { metadata, skillMd, codeTs };
}
