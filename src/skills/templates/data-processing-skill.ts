/**
 * Data Processing Skill Template
 * Specialized for data transformation and analysis tasks
 *
 * Best for:
 * - Data transformation
 * - CSV/JSON processing
 * - Data aggregation
 * - Report generation
 */

import { SkillMetadata } from '../types';

export const dataProcessingSkillTemplate: {
  metadata: SkillMetadata;
  skillMd: string;
  codeTs: string;
} = {
  metadata: {
    id: 'data-processing-skill',
    name: 'Data Processing Skill',
    version: '1.0.0',
    description: 'A template for creating data processing and transformation skills',
    type: 'code',
    category: 'data',
    complexity: 6,
    tags: ['data', 'processing', 'transformation', 'analysis'],
    keywords: ['process', 'transform', 'aggregate', 'analyze', 'csv', 'json'],
    triggers: ['process data', 'transform', 'aggregate', 'analyze data', 'generate report'],
    whenToUse: [
      'User needs to transform data',
      'User wants to aggregate information',
      'User requires data analysis',
      'User needs to generate reports',
    ],
    author: 'Your Name',
    license: 'MIT',
    performance: {
      estimatedTokens: 2000,
      averageResponseTime: 3000,
      cacheable: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['transform', 'aggregate', 'analyze', 'report'],
          description: 'Operation to perform',
        },
        input: {
          type: 'object',
          description: 'Input data or file path',
        },
        options: {
          type: 'object',
          description: 'Processing options',
        },
      },
      required: ['operation', 'input'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        result: { type: 'any' },
        statistics: {
          type: 'object',
          properties: {
            recordsProcessed: { type: 'number' },
            timeElapsed: { type: 'number' },
          },
        },
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

## Supported Operations

{{supportedOperations}}

## Data Formats

{{dataFormats}}

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

## Performance

{{performanceInfo}}
`,

  codeTs: `import fs from 'fs/promises';
import { SkillContext, SkillResult } from '../types';

interface ProcessingOptions {
  format?: 'csv' | 'json' | 'xml';
  filter?: Record<string, any>;
  groupBy?: string;
  aggregate?: string[];
  sortBy?: string;
  limit?: number;
}

interface ProcessingResult {
  success: boolean;
  result?: any;
  statistics?: {
    recordsProcessed: number;
    timeElapsed: number;
    dataSize: number;
  };
  error?: string;
}

/**
 * {{name}} Data Processing Skill
 * {{description}}
 */
export class {{className}} {
  /**
   * Execute data processing operation
   */
  async execute(context: SkillContext): Promise<SkillResult> {
    const startTime = Date.now();

    try {
      const { operation, input, options } = this.parseInput(context.userInput);

      let result: ProcessingResult;

      switch (operation) {
        case 'transform':
          result = await this.transform(input, options);
          break;
        case 'aggregate':
          result = await this.aggregate(input, options);
          break;
        case 'analyze':
          result = await this.analyze(input, options);
          break;
        case 'report':
          result = await this.generateReport(input, options);
          break;
        default:
          return {
            success: false,
            error: \`Unknown operation: \${operation}\`,
          };
      }

      const timeElapsed = Date.now() - startTime;
      result.statistics = {
        ...result.statistics,
        timeElapsed,
      };

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Transform data
   */
  private async transform(input: any, options: ProcessingOptions): Promise<ProcessingResult> {
    const data = await this.loadData(input);
    const transformed = this.applyTransformations(data, options);

    return {
      success: true,
      result: transformed,
      statistics: {
        recordsProcessed: Array.isArray(transformed) ? transformed.length : 1,
        timeElapsed: 0,
        dataSize: JSON.stringify(transformed).length,
      },
    };
  }

  /**
   * Aggregate data
   */
  private async aggregate(input: any, options: ProcessingOptions): Promise<ProcessingResult> {
    const data = await this.loadData(input);
    const aggregated = this.performAggregation(data, options);

    return {
      success: true,
      result: aggregated,
      statistics: {
        recordsProcessed: data.length,
        timeElapsed: 0,
        dataSize: JSON.stringify(aggregated).length,
      },
    };
  }

  /**
   * Analyze data
   */
  private async analyze(input: any, options: ProcessingOptions): Promise<ProcessingResult> {
    const data = await this.loadData(input);
    const analysis = this.performAnalysis(data, options);

    return {
      success: true,
      result: analysis,
      statistics: {
        recordsProcessed: data.length,
        timeElapsed: 0,
        dataSize: JSON.stringify(analysis).length,
      },
    };
  }

  /**
   * Generate report
   */
  private async generateReport(input: any, options: ProcessingOptions): Promise<ProcessingResult> {
    const data = await this.loadData(input);
    const report = this.createReport(data, options);

    return {
      success: true,
      result: report,
      statistics: {
        recordsProcessed: data.length,
        timeElapsed: 0,
        dataSize: report.length,
      },
    };
  }

  /**
   * Load data from file or object
   */
  private async loadData(input: any): Promise<any[]> {
    if (typeof input === 'string') {
      // Load from file
      const content = await fs.readFile(input, 'utf-8');
      return JSON.parse(content);
    }

    if (typeof input === 'object') {
      // Return as-is or wrap if not array
      return Array.isArray(input) ? input : [input];
    }

    throw new Error('Invalid input format');
  }

  /**
   * Apply transformations to data
   */
  private applyTransformations(data: any[], options: ProcessingOptions): any[] {
    let transformed = [...data];

    // Apply filter
    if (options.filter) {
      transformed = transformed.filter(item =>
        this.matchesFilter(item, options.filter)
      );
    }

    // Sort
    if (options.sortBy) {
      transformed = this.sortData(transformed, options.sortBy);
    }

    // Limit
    if (options.limit) {
      transformed = transformed.slice(0, options.limit);
    }

    return transformed;
  }

  /**
   * Perform aggregation
   */
  private performAggregation(data: any[], options: ProcessingOptions): any {
    {{aggregationLogic}}
    return {};
  }

  /**
   * Perform analysis
   */
  private performAnalysis(data: any[], options: ProcessingOptions): any {
    return {
      totalRecords: data.length,
      uniqueValues: this.countUniqueValues(data),
      patterns: this.identifyPatterns(data),
    };
  }

  /**
   * Create report
   */
  private createReport(data: any[], options: ProcessingOptions): string {
    return \`# Data Report\\n\\nTotal Records: \${data.length}\\n\\n\${JSON.stringify(data, null, 2)}\`;
  }

  /**
   * Parse user input
   */
  private parseInput(input: string): any {
    try {
      return JSON.parse(input);
    } catch {
      // Parse natural language
      return this.parseNaturalLanguage(input);
    }
  }

  /**
   * Parse natural language input
   */
  private parseNaturalLanguage(input: string): any {
    const parts = input.toLowerCase().split(/\\s+/);
    const operation = parts[0];

    return {
      operation,
      input: parts.slice(1).join(' '),
      options: {},
    };
  }

  /**
   * Check if item matches filter
   */
  private matchesFilter(item: any, filter: Record<string, any>): boolean {
    return Object.entries(filter).every(([key, value]) =>
      item[key] === value
    );
  }

  /**
   * Sort data
   */
  private sortData(data: any[], sortBy: string): any[] {
    return [...data].sort((a, b) => {
      if (a[sortBy] < b[sortBy]) return -1;
      if (a[sortBy] > b[sortBy]) return 1;
      return 0;
    });
  }

  /**
   * Count unique values
   */
  private countUniqueValues(data: any[]): Record<string, number> {
    {{uniqueValuesLogic}}
    return {};
  }

  /**
   * Identify patterns
   */
  private identifyPatterns(data: any[]): any[] {
    {{patternsLogic}}
    return [];
  }
}
`,
};

/**
 * Generate data processing skill from variables
 */
export function generateDataProcessingSkill(variables: Record<string, any>): {
  metadata: SkillMetadata;
  skillMd: string;
  codeTs: string;
} {
  const className = variables.name?.replace(/\s+/g, '') || 'DataProcessingSkill';

  const metadata: SkillMetadata = {
    ...dataProcessingSkillTemplate.metadata,
    id: variables.name?.toLowerCase().replace(/\s+/g, '-') || 'data-processing-skill',
    name: variables.name || 'Data Processing Skill',
    description: variables.description || 'A data processing skill',
    category: variables.category || 'data',
    complexity: variables.complexity || 6,
    tags: variables.tags || ['data', 'processing'],
    triggers: variables.triggers || ['process', 'transform'],
    whenToUse: variables.whenToUse || ['User needs data processing'],
    author: variables.author || 'Your Name',
  };

  const skillMd = dataProcessingSkillTemplate.skillMd
    .replace(/\{\{name\}\}/g, metadata.name)
    .replace(/\{\{description\}\}/g, metadata.description)
    .replace(/\{\{complexity\}\}/g, metadata.complexity.toString())
    .replace(/\{\{tags\}\}/g, metadata.tags.join(', '))
    .replace(/\{\{triggers\}\}/g, metadata.triggers.join(', '))
    .replace(/\{\{whenToUse\}\}/g, metadata.whenToUse.join('\n  - '))
    .replace(/\{\{author\}\}/g, metadata.author)
    .replace(/\{\{category\}\}/g, metadata.category)
    .replace(/\{\{supportedOperations\}\}/g, variables.supportedOperations || '- Transform\n- Aggregate\n- Analyze\n- Report')
    .replace(/\{\{dataFormats\}\}/g, variables.dataFormats || '- JSON\n- CSV\n- XML')
    .replace(/\{\{inputSchema\}\}/g, JSON.stringify(dataProcessingSkillTemplate.metadata.inputSchema, null, 2))
    .replace(/\{\{outputSchema\}\}/g, JSON.stringify(dataProcessingSkillTemplate.metadata.outputSchema, null, 2))
    .replace(/\{\{examples\}\}/g, variables.examples || 'Add examples')
    .replace(/\{\{performanceInfo\}\}/g, variables.performanceInfo || 'Average processing: 1000 records/sec');

  const codeTs = dataProcessingSkillTemplate.codeTs
    .replace(/\{\{name\}\}/g, metadata.name)
    .replace(/\{\{description\}\}/g, metadata.description)
    .replace(/\{\{className\}\}/g, className)
    .replace(/\{\{aggregationLogic\}\}/g, variables.aggregationLogic || '// Implement aggregation logic')
    .replace(/\{\{uniqueValuesLogic\}\}/g, variables.uniqueValuesLogic || '// Implement unique values counting')
    .replace(/\{\{patternsLogic\}\}/g, variables.patternsLogic || '// Implement pattern identification');

  return { metadata, skillMd, codeTs };
}
