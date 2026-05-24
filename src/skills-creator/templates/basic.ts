/**
 * Basic Plugin Template
 *
 * Use this for simple utility plugins with straightforward tool implementations.
 * Suitable for: file operations, simple calculations, basic automation tasks.
 */

export const BASIC_TEMPLATE = `/**
 * {pluginName} Plugin
 *
 * [TODO: Complete description - explain what this plugin does and WHEN to use it]
 * Example: "Provides file compression utilities for optimizing project assets"
 *
 * Quick Start:
 * 1. Implement tool handlers below (look for TODO comments)
 * 2. Test: bun test plugin.test.ts
 * 3. Load in Kode: /plugin-load {pluginId}
 * 4. Use: {toolName} <params>
 */

import type { Plugin } from '../../src/plugins/types';
import { ToolCategory, Permission } from '../../src/tools/types';

const {pluginId}Plugin: Plugin = {
  id: '{pluginId}',
  name: '{pluginName}',
  version: '{version}',
  description: '{description}',

  tools: [
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
          {#if default}default: {default},{/if}
        },
        {/each}
      ],

      handler: async (params, context) => {
        // [TODO: Implement {name} handler]
        //
        // Implementation checklist:
        // 1. Validate required parameters
        // 2. Extract and type-cast parameters
        // 3. Perform the operation
        // 4. Handle errors gracefully
        // 5. Return structured result
        //
        // Available context:
        // - context.projectRoot: Project root directory
        // - context.pluginRoot: Plugin directory
        // - context.config: Kode configuration

        const { {#each parameters}{name}{#unless @last}}, {/unless}{/each} } = params as {
          {#each parameters}
          {name}?: {type};
          {/each}
        };

        try {
          // TODO: Add implementation here

          // Example: Parameter validation
          {#each parameters}
          {#if required}
          if (!{name}) {
            return {
              success: false,
              error: '{name} is required',
            };
          }
          {/if}
          {/each}

          // TODO: Perform operation

          return {
            success: true,
            output: 'Operation completed',
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Operation failed',
          };
        }
      },
    },
    {/each}
  ],

  async initialize(context) {
    // [TODO: Add initialization logic]
    //
    // This runs when the plugin is loaded.
    // Use for:
    // - Loading configuration files
    // - Validating environment
    // - Setting up resources
    // - Logging plugin state
    //
    // Available: context.projectRoot, context.pluginRoot, context.config

    console.log('[{pluginName}] Initialized');
  },

  async cleanup(context) {
    // [TODO: Add cleanup logic]
    //
    // This runs when the plugin is unloaded.
    // Use for:
    // - Closing connections
    // - Freeing resources
    // - Saving state
    // - Cleanup tasks

    console.log('[{pluginName}] Cleaned up');
  },
};

export default {pluginId}Plugin;
`;
