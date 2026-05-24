/**
 * Hybrid Skill Template
 * Combines knowledge guidance with code execution
 *
 * Best for:
 * - Complex workflows requiring both guidance and execution
 * - Skills that need to explain and then act
 * - Tools with educational components
 */

import { SkillMetadata } from '../types';

export const hybridSkillTemplate: {
  metadata: SkillMetadata;
  skillMd: string;
  codeTs: string;
  references: Record<string, string>;
} = {
  metadata: {
    id: 'hybrid-skill',
    name: 'Hybrid Skill',
    version: '1.0.0',
    description: 'A template for creating hybrid skills with both knowledge and execution capabilities',
    type: 'hybrid',
    category: 'general',
    complexity: 7,
    tags: ['hybrid', 'knowledge', 'execution'],
    keywords: ['guide', 'execute', 'workflow', 'automate'],
    triggers: ['automate', 'workflow', 'guide and execute', 'help with'],
    whenToUse: [
      'User needs both guidance and execution',
      'User wants to understand and then act',
      'Complex workflows requiring explanation',
    ],
    author: 'Your Name',
    license: 'MIT',
    performance: {
      estimatedTokens: 3500,
      averageResponseTime: 3000,
      cacheable: true,
    },
  },

  skillMd: `---
name: {{name}}
description: {{description}}
type: hybrid
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

## Overview

{{overview}}

## When to Use This Skill

{{whenToUseDetailed}}

## How It Works

{{howItWorks}}

## Guidance

{{guidance}}

## Execution

### Available Actions

{{availableActions}}

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
`,

  codeTs: `import { SkillContext, SkillResult, Tool } from '../types';

/**
 * {{name}} Hybrid Skill
 * {{description}}
 *
 * This skill provides both guidance and execution capabilities
 */
export class {{className}} {
  /**
   * Execute the skill
   */
  async execute(context: SkillContext): Promise<SkillResult> {
    try {
      const { action, options } = this.parseInput(context.userInput);

      // First, provide guidance if requested
      if (action === 'guide' || action === 'explain') {
        return this.provideGuidance(options, context);
      }

      // Then, execute the action
      return this.executeAction(action, options, context);
    } catch (error) {
      return {
        success: false,
        error: error.message,
        metadata: {
          executionTime: Date.now(),
          tokensUsed: 0,
        },
      };
    }
  }

  /**
   * Provide guidance on the task
   */
  private async provideGuidance(options: any, context: SkillContext): Promise<SkillResult> {
    return {
      success: true,
      output: {
        guidance: {{guidanceText}},
        recommendations: {{recommendations}},
      },
      metadata: {
        executionTime: Date.now(),
        tokensUsed: 0,
      },
    };
  }

  /**
   * Execute the action
   */
  private async executeAction(action: string, options: any, context: SkillContext): Promise<SkillResult> {
    switch (action) {
      {{actions}}
      default:
        return {
          success: false,
          error: \`Unknown action: \${action}\`,
        };
    }
  }

  /**
   * Parse user input
   */
  private parseInput(input: string): { action: string; options: any } {
    const parts = input.split(' ');
    const action = parts[0];
    const options = parts.slice(1).join(' ');

    return { action, options: { input: options } };
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
        param1: { type: 'string', description: 'Parameter 1' },
        param2: { type: 'string', description: 'Parameter 2' },
      },
      required: ['param1'],
    },
    handler: async (params, context) => {
      // Implement tool logic
      return { success: true, result: null };
    },
  },
];
`,

  references: {
    concepts: `# Key Concepts

## Understanding {{name}}

{{conceptsOverview}}

## Core Principles

{{corePrinciples}}

## Best Practices

{{bestPractices}}
`,

    workflows: `# Common Workflows

## Workflow 1: {{workflow1Name}}

{{workflow1Steps}}

## Workflow 2: {{workflow2Name}}

{{workflow2Steps}}

## Advanced Workflow

{{advancedWorkflow}}
`,

    troubleshooting: `# Troubleshooting

## Common Issues

{{commonIssues}}

## Debug Mode

{{debugMode}}

## Getting Help

{{gettingHelp}}
`,
  },
};

/**
 * Generate hybrid skill from variables
 */
export function generateHybridSkill(variables: Record<string, any>): {
  metadata: SkillMetadata;
  skillMd: string;
  codeTs: string;
  references: Record<string, string>;
} {
  const className = variables.name?.replace(/\s+/g, '') || 'HybridSkill';

  const metadata: SkillMetadata = {
    ...hybridSkillTemplate.metadata,
    id: variables.name?.toLowerCase().replace(/\s+/g, '-') || 'hybrid-skill',
    name: variables.name || 'Hybrid Skill',
    description: variables.description || 'A hybrid skill with guidance and execution',
    category: variables.category || 'general',
    complexity: variables.complexity || 7,
    tags: variables.tags || ['hybrid'],
    triggers: variables.triggers || ['automate', 'workflow'],
    whenToUse: variables.whenToUse || ['User needs guidance and execution'],
    author: variables.author || 'Your Name',
    inputSchema: variables.inputSchema,
    outputSchema: variables.outputSchema,
  };

  const skillMd = hybridSkillTemplate.skillMd
    .replace(/\{\{name\}\}/g, metadata.name)
    .replace(/\{\{description\}\}/g, metadata.description)
    .replace(/\{\{complexity\}\}/g, metadata.complexity.toString())
    .replace(/\{\{tags\}\}/g, metadata.tags.join(', '))
    .replace(/\{\{triggers\}\}/g, metadata.triggers.join(', '))
    .replace(/\{\{whenToUse\}\}/g, metadata.whenToUse.join('\n  - '))
    .replace(/\{\{author\}\}/g, metadata.author)
    .replace(/\{\{category\}\}/g, metadata.category)
    .replace(/\{\{overview\}\}/g, variables.overview || 'Add overview')
    .replace(/\{\{whenToUseDetailed\}\}/g, variables.whenToUseDetailed || 'Add detailed usage info')
    .replace(/\{\{howItWorks\}\}/g, variables.howItWorks || 'Explain how it works')
    .replace(/\{\{guidance\}\}/g, variables.guidance || 'Add guidance')
    .replace(/\{\{availableActions\}\}/g, variables.availableActions || 'List actions')
    .replace(/\{\{inputSchema\}\}/g, JSON.stringify(metadata.inputSchema || {}, null, 2))
    .replace(/\{\{outputSchema\}\}/g, JSON.stringify(metadata.outputSchema || {}, null, 2))
    .replace(/\{\{examples\}\}/g, variables.examples || 'Add examples');

  const codeTs = hybridSkillTemplate.codeTs
    .replace(/\{\{name\}\}/g, metadata.name)
    .replace(/\{\{description\}\}/g, metadata.description)
    .replace(/\{\{className\}\}/g, className)
    .replace(/\{\{guidanceText\}\}/g, variables.guidanceText || "'Guidance text'")
    .replace(/\{\{recommendations\}\}/g, variables.recommendations || "[]")
    .replace(/\{\{actions\}\}/g, variables.actions || 'case \'default\':\n        return { success: false };')
    .replace(/\{\{helperMethods\}\}/g, variables.helperMethods || '')
    .replace(/\{\{toolName\}\}/g, variables.toolName || 'tool')
    .replace(/\{\{toolDescription\}\}/g, variables.toolDescription || 'Tool description');

  const references = {
    concepts: hybridSkillTemplate.references.concepts
      .replace(/\{\{name\}\}/g, metadata.name)
      .replace(/\{\{conceptsOverview\}\}/g, variables.conceptsOverview || 'Add concepts overview')
      .replace(/\{\{corePrinciples\}\}/g, variables.corePrinciples || 'Add core principles')
      .replace(/\{\{bestPractices\}\}/g, variables.bestPractices || 'Add best practices'),
    workflows: hybridSkillTemplate.references.workflows
      .replace(/\{\{workflow1Name\}\}/g, variables.workflow1Name || 'Workflow 1')
      .replace(/\{\{workflow1Steps\}\}/g, variables.workflow1Steps || 'Add steps')
      .replace(/\{\{workflow2Name\}\}/g, variables.workflow2Name || 'Workflow 2')
      .replace(/\{\{workflow2Steps\}\}/g, variables.workflow2Steps || 'Add steps')
      .replace(/\{\{advancedWorkflow\}\}/g, variables.advancedWorkflow || 'Add advanced workflow'),
    troubleshooting: hybridSkillTemplate.references.troubleshooting
      .replace(/\{\{commonIssues\}\}/g, variables.commonIssues || 'Add common issues')
      .replace(/\{\{debugMode\}\}/g, variables.debugMode || 'Add debug info')
      .replace(/\{\{gettingHelp\}\}/g, variables.gettingHelp || 'Add help resources'),
  };

  return { metadata, skillMd, codeTs, references };
}
