/**
 * Custom Plugin Template
 *
 * Use this when you want full control and don't fit into other categories.
 * This is a minimal starting point - build whatever you need!
 */

export const CUSTOM_TEMPLATE = `/**
 * {pluginName} Plugin
 *
 * [TODO: Describe your plugin here]
 *
 * This is a custom plugin - you have full freedom to design it as needed.
 */

import type { Plugin } from '../../src/plugins/types';
import { ToolCategory, Permission } from '../../src/tools/types';

const {pluginId}Plugin: Plugin = {
  id: '{pluginId}',
  name: '{pluginName}',
  version: '{version}',
  description: '{description}',

  tools: [
    // [TODO: Add your tools here]
    //
    // Tool structure:
    // {
    //   name: 'tool-name',
    //   description: 'What this tool does',
    //   category: ToolCategory.UTILITY, // or ANALYSIS, TRANSFORMATION, INTEGRATION
    //   permissions: [Permission.READ_ONLY], // Adjust permissions as needed
    //
    //   parameters: [
    //     {
    //       name: 'paramName',
    //       type: 'string',
    //       description: 'Parameter description',
    //       required: true,
    //     },
    //   ],
    //
    //   handler: async (params, context) => {
    //     // TODO: Implement tool logic
    //     return {
    //       success: true,
    //       output: 'Result',
    //     };
    //   },
    // },

    {#each tools}
    {
      name: '{name}',
      description: '{description}',
      category: ToolCategory.{uppercase category},
      permissions: [{#each permissions}Permission.{uppercase this}{#unless @last}}, {/unless}{/each}],

      parameters: [
        {#each parameters}
        {
          name: '{name}',
          type: '{type}',
          description: '{description}',
          required: {required},
        },
        {/each}
      ],

      handler: async (params, context) => {
        // TODO: Implement {name}
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
    // This runs when plugin is loaded
    console.log('[{pluginName}] Initialized');
  },

  async cleanup(context) {
    // [TODO: Add cleanup logic]
    // This runs when plugin is unloaded
    console.log('[{pluginName}] Cleaned up');
  },
};

export default {pluginId}Plugin;
`;
