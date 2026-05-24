/**
 * Plugin Prompt Templates
 *
 * Enhanced prompts with complete working examples for reliable code generation
 */

import type { PluginRequirement, TemplateContext } from '../types';

/**
 * Complete working example - Calculator Plugin
 * This demonstrates ALL required patterns for correct code generation
 */
export const PLUGIN_CODE_EXAMPLE = `/**
 * Calculator Plugin
 *
 * A simple calculator plugin that provides basic mathematical operations.
 * All operations are safe (no permissions needed) and have proper error handling.
 */

import type { Plugin } from '../../src/plugins/types';
import { ToolCategory, Permission } from '../../src/tools/types';

const calculatorPlugin: Plugin = {
  id: 'calculator-plugin',
  name: 'Calculator Plugin',
  version: '1.0.0',
  description: 'A calculator plugin with basic math operations',

  tools: [
    {
      name: 'add',
      description: 'Add two numbers together',
      category: ToolCategory.ANALYSIS,  // ✅ Use enum, NOT string
      permissions: [],                   // ✅ Empty array (no permissions needed)
      parameters: [                      // ✅ Required: define parameters
        {
          name: 'a',
          type: 'number',
          description: 'First number',
          required: true,
        },
        {
          name: 'b',
          type: 'number',
          description: 'Second number',
          required: true,
        },
      ],
      handler: async (params, context) => {  // ✅ Correct signature
        const { a, b } = params as { a: number; b: number };  // ✅ Type assertion

        // Validate input
        if (typeof a !== 'number' || typeof b !== 'number') {
          return {
            success: false,
            error: 'Both a and b must be numbers',
          };
        }

        const result = a + b;

        return {
          success: true,
          output: \`\${a} + \${b} = \${result}\`,
        };
      },
    },

    {
      name: 'subtract',
      description: 'Subtract b from a',
      category: ToolCategory.ANALYSIS,
      permissions: [],
      parameters: [
        {
          name: 'a',
          type: 'number',
          description: 'First number',
          required: true,
        },
        {
          name: 'b',
          type: 'number',
          description: 'Second number',
          required: true,
        },
      ],
      handler: async (params, context) => {
        const { a, b } = params as { a: number; b: number };

        if (typeof a !== 'number' || typeof b !== 'number') {
          return {
            success: false,
            error: 'Both a and b must be numbers',
          };
        }

        const result = a - b;

        return {
          success: true,
          output: \`\${a} - \${b} = \${result}\`,
        };
      },
    },

    {
      name: 'divide',
      description: 'Divide a by b (with zero-division protection)',
      category: ToolCategory.ANALYSIS,
      permissions: [],
      parameters: [
        {
          name: 'a',
          type: 'number',
          description: 'Numerator',
          required: true,
        },
        {
          name: 'b',
          type: 'number',
          description: 'Denominator',
          required: true,
        },
      ],
      handler: async (params, context) => {
        const { a, b } = params as { a: number; b: number };

        if (typeof a !== 'number' || typeof b !== 'number') {
          return {
            success: false,
            error: 'Both a and b must be numbers',
          };
        }

        // Zero division check
        if (b === 0) {
          return {
            success: false,
            error: 'Cannot divide by zero',
          };
        }

        const result = a / b;

        return {
          success: true,
          output: \`\${a} ÷ \${b} = \${result}\`,
        };
      },
    },
  ],

  async initialize(context) {
    console.log('[Calculator Plugin] ✅ Initialized');
  },

  async cleanup(context) {
    console.log('[Calculator Plugin] 🧹 Cleaned up');
  },
};

export default calculatorPlugin;`;

/**
 * Build enhanced code generation prompt with strict type requirements
 */
export function buildEnhancedPrompt(
  requirement: PluginRequirement,
  context: TemplateContext
): string {
  const toolsDescription = requirement.tools
    .map(t => `- ${t.name}: ${t.description}`)
    .join('\n');

  return `You are an expert TypeScript plugin developer for Kode.

Generate a complete, production-ready plugin based on the requirements below.

═══════════════════════════════════════════════════════════════
PLUGIN REQUIREMENTS
═══════════════════════════════════════════════════════════════
- Name: ${context.pluginName}
- ID: ${context.pluginId}
- Description: ${context.description}
- Version: ${context.version}

TOOLS TO IMPLEMENT:
${toolsDescription}

═══════════════════════════════════════════════════════════════
CRITICAL TYPE REQUIREMENTS (MUST FOLLOW)
═══════════════════════════════════════════════════════════════
1. Import enums from '../../src/tools/types':
   import { ToolCategory, Permission } from '../../src/tools/types';

2. Use ToolCategory enum (NOT strings):
   ✅ category: ToolCategory.ANALYSIS
   ✅ category: ToolCategory.FILE
   ✅ category: ToolCategory.COMMAND
   ✅ category: ToolCategory.SYSTEM
   ❌ category: 'utility'  ← WRONG!
   ❌ category: 'analysis' ← WRONG!

3. Use Permission enum array (NOT strings):
   ✅ permissions: []  ← No permissions needed (safe operations)
   ✅ permissions: [Permission.READ_FILES]
   ✅ permissions: [Permission.WRITE_FILES, Permission.READ_FILES]
   ❌ permissions: ['read_only']  ← WRONG!
   ❌ permissions: ['read_files'] ← WRONG!

4. EVERY tool MUST have 'parameters' array:
   parameters: [
     {
       name: 'paramName',
       type: 'string' | 'number' | 'boolean',
       description: 'Parameter description',
       required: true,
     },
   ]

5. Use correct handler signature:
   ✅ handler: async (params, context) => {
       const { param1, param2 } = params as { param1: string; param2: number };
       // ...
     }
   ❌ handler: async (params: { a: number }, context) => { ... }

═══════════════════════════════════════════════════════════════
COMPLETE WORKING EXAMPLE (STUDY THIS CAREFULLY)
═══════════════════════════════════════════════════════════════
${PLUGIN_CODE_EXAMPLE}

═══════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════
1. Return ONLY valid JSON - no markdown, no extra text
2. Use this exact structure:
{
  "code": "COMPLETE TypeScript code with escaped newlines (\\\\n)",
  "todo": ["Generated plugin code"],
  "actions": []
}

3. Follow the type requirements STRICTLY
4. Include all tool handlers implemented
5. Add error handling in each handler
6. Include JSDoc comments

Generate the plugin now:`;
}
