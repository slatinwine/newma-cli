/**
 * Analyzer Plugin Template
 *
 * Use this for code analysis and introspection plugins.
 * Suitable for: code quality checks, dependency analysis, metrics extraction.
 */

export const ANALYZER_TEMPLATE = `/**
 * {pluginName} - Code Analysis Plugin
 *
 * [TODO: Complete description]
 * Example: "Analyzes code quality, complexity, and maintainability metrics"
 *
 * Common Use Cases:
 * - Code quality analysis
 * - Dependency extraction
 * - Complexity metrics
 * - Security vulnerability scanning
 * - Performance profiling
 *
 * Quick Start:
 * 1. Implement analysis tools below
 * 2. Add custom analyzers/metrics
 * 3. Test: bun test plugin.test.ts
 * 4. Load: /plugin-load {pluginId}
 */

import type { Plugin } from '../../src/plugins/types';
import { ToolCategory, Permission } from '../../src/tools/types';
import { promises as fs } from 'fs';
import * as path from 'path';

// [TODO: Import analysis libraries]
// Examples:
// - import * as parser from 'acorn'; // JavaScript parser
// - import * as ts from 'typescript'; // TypeScript compiler API
// - import { complexity } from 'complexity-report'; // Code complexity

const {pluginId}Plugin: Plugin = {
  id: '{pluginId}',
  name: '{pluginName}',
  version: '{version}',
  description: '{description}',

  tools: [
    {
      name: 'analyze',
      description: 'Analyze code files and extract metrics',
      category: ToolCategory.ANALYSIS,
      permissions: [Permission.READ_FILES],

      parameters: [
        {
          name: 'target',
          type: 'string',
          description: 'File or directory to analyze (relative to project root)',
          required: true,
        },
        {
          name: 'metrics',
          type: 'array',
          description: 'Metrics to extract (e.g., ["complexity", "lines", "dependencies"])',
          required: false,
        },
        {
          name: 'format',
          type: 'string',
          description: 'Output format: "json", "markdown", or "text"',
          required: false,
        },
      ],

      handler: async (params, context) => {
        // [TODO: Implement analysis logic]
        //
        // Steps:
        // 1. Resolve target path
        // 2. Scan files (if directory)
        // 3. Parse/analyze each file
        // 4. Calculate metrics
        // 5. Format results
        // 6. Return analysis report

        const { target, metrics = ['complexity'], format = 'json' } = params as {
          target: string;
          metrics?: string[];
          format?: 'json' | 'markdown' | 'text';
        };

        try {
          const targetPath = path.resolve(context.projectRoot, target);

          // Check if target exists
          try {
            await fs.access(targetPath);
          } catch {
            return {
              success: false,
              error: \`Target not found: \${target}\`,
            };
          }

          // TODO: Implement analysis
          const results = {
            target,
            metrics: {},
            // TODO: Add actual metrics
          };

          // Format output
          let output: string;
          switch (format) {
            case 'json':
              output = JSON.stringify(results, null, 2);
              break;
            case 'markdown':
              output = \`# Analysis Report
\\n\\nTarget: \${target}
\\n\\n\`\`\`json
\${JSON.stringify(results, null, 2)}
\`\`\`
\`;
              break;
            case 'text':
              output = \`Analysis: \${target}\\n\${JSON.stringify(results, null, 2)}\`;
              break;
            default:
              output = JSON.stringify(results, null, 2);
          }

          return {
            success: true,
            output,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Analysis failed',
          };
        }
      },
    },

    {
      name: 'scan',
      description: 'Scan project for specific patterns or issues',
      category: ToolCategory.ANALYSIS,
      permissions: [Permission.READ_FILES],

      parameters: [
        {
          name: 'pattern',
          type: 'string',
          description: 'Pattern to search for (regex or string)',
          required: true,
        },
        {
          name: 'path',
          type: 'string',
          description: 'Directory to scan (default: project root)',
          required: false,
        },
        {
          name: 'exclude',
          type: 'array',
          description: 'Patterns to exclude (e.g., ["node_modules", "dist"])',
          required: false,
        },
      ],

      handler: async (params, context) => {
        // [TODO: Implement scanning logic]
        //
        // Steps:
        // 1. Compile search pattern
        // 2. Recursively scan directory
        // 3. Skip excluded paths
        // 4. Search for matches
        // 5. Return matched results

        const { pattern, path: scanPath = '.', exclude = ['node_modules', 'dist'] } = params as {
          pattern: string;
          path?: string;
          exclude?: string[];
        };

        try {
          // TODO: Implement recursive scan with pattern matching
          const matches = [
            // TODO: Add actual matches
          ];

          return {
            success: true,
            output: \`Found \${matches.length} matches for "\${pattern}"\`,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Scan failed',
          };
        }
      },
    },

    // [TODO: Add more analysis tools]
    // Examples:
    // - complexity: Calculate cyclomatic complexity
    // - dependencies: Extract dependency graph
    // - duplicates: Find duplicate code
  ],

  async initialize(context) {
    // TODO: Load analyzers/parsers
    // TODO: Cache analysis rules
    console.log('[{pluginName}] Analyzer ready');
  },

  async cleanup(context) {
    // TODO: Clear analysis caches
    console.log('[{pluginName}] Analyzer cleaned up');
  },
};

export default {pluginId}Plugin;
`;
