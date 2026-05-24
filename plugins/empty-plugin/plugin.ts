/**
 * Empty Plugin
 *
 * A minimal plugin demonstrating the correct TypeScript plugin structure.
 * This plugin provides basic utility tools that require no permissions.
 */

import type { Plugin } from '../../src/plugins/types';
import { ToolCategory, Permission } from '../../src/tools/types';

const emptyPlugin: Plugin = {
  id: 'empty-plugin',
  name: 'Empty Plugin',
  version: '1.0.0',
  description: 'A minimal plugin demonstrating the correct TypeScript plugin structure',

  tools: [
    /**
     * Echo Tool
     * Returns the input string as-is.
     */
    {
      name: 'echo',
      description: 'Returns the input string as-is',
      category: ToolCategory.ANALYSIS,
      permissions: [],
      parameters: [
        {
          name: 'message',
          type: 'string',
          description: 'The message to echo back',
          required: true,
        },
      ],
      handler: async (params, context) => {
        const { message } = params as { message: string };

        // Validate input
        if (typeof message !== 'string') {
          return {
            success: false,
            error: 'Message must be a string',
          };
        }

        return {
          success: true,
          output: message,
        };
      },
    },

    /**
     * Greet Tool
     * Returns a personalized greeting message.
     */
    {
      name: 'greet',
      description: 'Returns a personalized greeting message',
      category: ToolCategory.ANALYSIS,
      permissions: [],
      parameters: [
        {
          name: 'name',
          type: 'string',
          description: 'The name to greet',
          required: true,
        },
        {
          name: 'greeting',
          type: 'string',
          description: 'The greeting phrase (optional, defaults to "Hello")',
          required: false,
        },
      ],
      handler: async (params, context) => {
        const { name, greeting = 'Hello' } = params as { name: string; greeting?: string };

        // Validate input
        if (typeof name !== 'string') {
          return {
            success: false,
            error: 'Name must be a string',
          };
        }

        if (greeting && typeof greeting !== 'string') {
          return {
            success: false,
            error: 'Greeting must be a string',
          };
        }

        const message = `${greeting}, ${name}!`;

        return {
          success: true,
          output: message,
        };
      },
    },

    /**
     * Status Tool
     * Returns the current status of the plugin.
     */
    {
      name: 'status',
      description: 'Returns the current status of the plugin',
      category: ToolCategory.ANALYSIS,
      permissions: [],
      parameters: [],
      handler: async (params, context) => {
        return {
          success: true,
          output: {
            pluginId: emptyPlugin.id,
            pluginName: emptyPlugin.name,
            version: emptyPlugin.version,
            description: emptyPlugin.description,
            tools: emptyPlugin.tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              category: tool.category,
              permissions: tool.permissions,
            })),
          },
        };
      },
    },

    /**
     * Version Tool
     * Returns the plugin version.
     */
    {
      name: 'version',
      description: 'Returns the plugin version',
      category: ToolCategory.ANALYSIS,
      permissions: [],
      parameters: [],
      handler: async (params, context) => {
        return {
          success: true,
          output: emptyPlugin.version,
        };
      },
    },
  ],

  /**
   * Initialize the plugin
   */
  async initialize(context) {
    console.log('[Empty Plugin] ✅ Initialized');
  },

  /**
   * Cleanup the plugin
   */
  async cleanup(context) {
    console.log('[Empty Plugin] 🧹 Cleaned up');
  },
};

export default emptyPlugin;
