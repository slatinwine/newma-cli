/**
 * Knowledge Skill Template
 * Pure markdown guidance skill (no code execution)
 *
 * Best for:
 * - Documentation and guides
 * - Best practices and patterns
 * - Concepts and explanations
 * - Workflow guidance
 */

import { SkillMetadata } from '../types';

export const knowledgeSkillTemplate: {
  metadata: SkillMetadata;
  skillMd: string;
  references: Record<string, string>;
} = {
  metadata: {
    id: 'knowledge-skill',
    name: 'Knowledge Skill',
    version: '1.0.0',
    description: 'A template for creating knowledge-based skills with pure markdown guidance',
    type: 'knowledge',
    category: 'documentation',
    complexity: 2,
    tags: ['knowledge', 'documentation', 'guide'],
    keywords: ['guide', 'documentation', 'best practices', 'tutorial'],
    triggers: ['how to', 'guide', 'best practices', 'learn', 'understand'],
    whenToUse: [
      'User asks for guidance on a topic',
      'User needs to understand concepts',
      'User wants best practices',
      'User needs workflow information',
    ],
    whenNotToUse: [
      'User needs code execution',
      'User requires file operations',
      'User needs API integration',
    ],
    author: 'Your Name',
    license: 'MIT',
    performance: {
      estimatedTokens: 2000,
      averageResponseTime: 1000,
      cacheable: true,
    },
  },

  skillMd: `---
name: {{name}}
description: {{description}}
type: knowledge
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

## Key Concepts

{{keyConcepts}}

## Usage

{{usage}}

## Examples

{{examples}}

## References

- [Reference 1](#)
- [Reference 2](#)
`,

  references: {
    basics: `# Basics

## Getting Started

{{gettingStarted}}

## Prerequisites

{{prerequisites}}

## Installation

{{installation}}
`,

    advanced: `# Advanced Topics

## Advanced Concepts

{{advancedConcepts}}

## Edge Cases

{{edgeCases}}

## Performance Considerations

{{performance}}
`,

    troubleshooting: `# Troubleshooting

## Common Issues

{{commonIssues}}

## Solutions

{{solutions}}

## Getting Help

{{gettingHelp}}
`,
  },
};

/**
 * Generate knowledge skill from variables
 */
export function generateKnowledgeSkill(variables: Record<string, any>): {
  metadata: SkillMetadata;
  skillMd: string;
  references: Record<string, string>;
} {
  const metadata: SkillMetadata = {
    ...knowledgeSkillTemplate.metadata,
    id: variables.name?.toLowerCase().replace(/\s+/g, '-') || 'knowledge-skill',
    name: variables.name || 'Knowledge Skill',
    description: variables.description || 'A knowledge-based skill',
    category: variables.category || 'documentation',
    complexity: variables.complexity || 3,
    tags: variables.tags || ['knowledge'],
    triggers: variables.triggers || ['guide', 'learn'],
    whenToUse: variables.whenToUse || ['User needs guidance'],
    author: variables.author || 'Your Name',
  };

  const skillMd = knowledgeSkillTemplate.skillMd
    .replace(/\{\{name\}\}/g, metadata.name)
    .replace(/\{\{description\}\}/g, metadata.description)
    .replace(/\{\{complexity\}\}/g, metadata.complexity.toString())
    .replace(/\{\{tags\}\}/g, metadata.tags.join(', '))
    .replace(/\{\{triggers\}\}/g, metadata.triggers.join(', '))
    .replace(/\{\{whenToUse\}\}/g, metadata.whenToUse.join('\n  - '))
    .replace(/\{\{author\}\}/g, metadata.author)
    .replace(/\{\{category\}\}/g, metadata.category)
    .replace(/\{\{overview\}\}/g, variables.overview || 'Add overview here')
    .replace(/\{\{keyConcepts\}\}/g, variables.keyConcepts || 'Add key concepts')
    .replace(/\{\{usage\}\}/g, variables.usage || 'Add usage information')
    .replace(/\{\{examples\}\}/g, variables.examples || 'Add examples');

  const references = {
    basics: knowledgeSkillTemplate.references.basics
      .replace(/\{\{gettingStarted\}\}/g, variables.gettingStarted || 'Add getting started guide')
      .replace(/\{\{prerequisites\}\}/g, variables.prerequisites || 'List prerequisites')
      .replace(/\{\{installation\}\}/g, variables.installation || 'Add installation steps'),
    advanced: knowledgeSkillTemplate.references.advanced
      .replace(/\{\{advancedConcepts\}\}/g, variables.advancedConcepts || 'Add advanced concepts')
      .replace(/\{\{edgeCases\}\}/g, variables.edgeCases || 'Document edge cases')
      .replace(/\{\{performance\}\}/g, variables.performance || 'Add performance considerations'),
    troubleshooting: knowledgeSkillTemplate.references.troubleshooting
      .replace(/\{\{commonIssues\}\}/g, variables.commonIssues || 'List common issues')
      .replace(/\{\{solutions\}\}/g, variables.solutions || 'Provide solutions')
      .replace(/\{\{gettingHelp\}\}/g, variables.gettingHelp || 'Add help resources'),
  };

  return { metadata, skillMd, references };
}
