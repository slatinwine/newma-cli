/**
 * Calculator Plugin
 *
 * A simple calculator plugin that provides basic mathematical operations.
 * All operations are safe (read_only) and have proper error handling.
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
          output: `${a} + ${b} = ${result}`,
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

        // Validate input
        if (typeof a !== 'number' || typeof b !== 'number') {
          return {
            success: false,
            error: 'Both a and b must be numbers',
          };
        }

        const result = a - b;

        return {
          success: true,
          output: `${a} - ${b} = ${result}`,
        };
      },
    },

    {
      name: 'multiply',
      description: 'Multiply two numbers',
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

        // Validate input
        if (typeof a !== 'number' || typeof b !== 'number') {
          return {
            success: false,
            error: 'Both a and b must be numbers',
          };
        }

        const result = a * b;

        return {
          success: true,
          output: `${a} × ${b} = ${result}`,
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

        // Validate input
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
          output: `${a} ÷ ${b} = ${result}`,
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

export default calculatorPlugin;
