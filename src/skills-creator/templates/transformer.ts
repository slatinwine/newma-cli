/**
 * Transformer Plugin Template
 *
 * Use this for data transformation and conversion plugins.
 * Suitable for: format conversions, data migrations, file transformations.
 */

export const TRANSFORMER_TEMPLATE = `/**
 * {pluginName} - Data Transformation Plugin
 *
 * [TODO: Complete description]
 * Example: "Transforms data between CSV, JSON, YAML, and XML formats"
 *
 * Common Use Cases:
 * - Format conversion (CSV ↔ JSON ↔ YAML ↔ XML)
 * - Data migration between systems
 * - File encoding/decoding
 * - Data normalization/cleaning
 *
 * Quick Start:
 * 1. Implement the transform() tool below
 * 2. Add validation for input/output formats
 * 3. Test: bun test plugin.test.ts
 * 4. Load: /plugin-load {pluginId}
 */

import type { Plugin } from '../../src/plugins/types';
import { ToolCategory, Permission } from '../../src/tools/types';
import { promises as fs } from 'fs';
import * as path from 'path';

const {pluginId}Plugin: Plugin = {
  id: '{pluginId}',
  name: '{pluginName}',
  version: '{version}',
  description: '{description}',

  tools: [
    {
      name: 'transform',
      description: 'Transform data from one format to another',
      category: ToolCategory.TRANSFORMATION,
      permissions: [Permission.READ_FILES, Permission.WRITE_FILES],

      parameters: [
        {
          name: 'input',
          type: 'string',
          description: 'Input file path (relative to project root)',
          required: true,
        },
        {
          name: 'output',
          type: 'string',
          description: 'Output file path (relative to project root)',
          required: true,
        },
        {
          name: 'fromFormat',
          type: 'string',
          description: 'Source format (e.g., "csv", "json", "yaml", "xml")',
          required: true,
        },
        {
          name: 'toFormat',
          type: 'string',
          description: 'Target format (e.g., "json", "yaml", "csv", "xml")',
          required: true,
        },
        {
          name: 'options',
          type: 'object',
          description: 'Additional transformation options',
          required: false,
        },
      ],

      handler: async (params, context) => {
        // [TODO: Implement transformation logic]
        //
        // Steps:
        // 1. Validate input/output paths
        // 2. Read input file
        // 3. Parse based on fromFormat
        // 4. Transform to toFormat
        // 5. Write output file
        // 6. Return success message

        const { input, output, fromFormat, toFormat, options } = params as {
          input: string;
          output: string;
          fromFormat: string;
          toFormat: string;
          options?: Record<string, any>;
        };

        try {
          // Resolve paths
          const inputPath = path.resolve(context.projectRoot, input);
          const outputPath = path.resolve(context.projectRoot, output);

          // Validate input exists
          try {
            await fs.access(inputPath);
          } catch {
            return {
              success: false,
              error: \`Input file not found: \${input}\`,
            };
          }

          // Read input file
          const inputContent = await fs.readFile(inputPath, 'utf-8');

          // TODO: Parse based on fromFormat
          let data: any;
          switch (fromFormat.toLowerCase()) {
            case 'json':
              data = JSON.parse(inputContent);
              break;
            // TODO: Add more format parsers
            default:
              return {
                success: false,
                error: \`Unsupported source format: \${fromFormat}\`,
              };
          }

          // TODO: Transform to toFormat
          let outputContent: string;
          switch (toFormat.toLowerCase()) {
            case 'json':
              outputContent = JSON.stringify(data, null, 2);
              break;
            // TODO: Add more format converters
            default:
              return {
                success: false,
                error: \`Unsupported target format: \${toFormat}\`,
              };
          }

          // Ensure output directory exists
          const outputDir = path.dirname(outputPath);
          await fs.mkdir(outputDir, { recursive: true });

          // Write output file
          await fs.writeFile(outputPath, outputContent, 'utf-8');

          return {
            success: true,
            output: \`Transformed \${input} (\${fromFormat}) → \${output} (\${toFormat})\`,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Transformation failed',
          };
        }
      },
    },

    // [TODO: Add more transformation tools]
    // Examples:
    // - batch: Transform multiple files
    // - validate: Validate file format
    // - detect: Auto-detect file format
  ],

  async initialize(context) {
    // TODO: Load format-specific parsers/converters
    // TODO: Validate required dependencies are installed
    console.log('[{pluginName}] Transformer ready');
  },

  async cleanup(context) {
    // TODO: Cleanup resources (close file handles, etc.)
    console.log('[{pluginName}] Transformer cleaned up');
  },
};

export default {pluginId}Plugin;
`;
