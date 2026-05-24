/**
 * Hello Plugin - Example Plugin for Kode
 *
 * A simple plugin demonstrating how to create plugins with Bun support
 */

import type { Plugin } from '../../src/plugins/types';

const helloPlugin: Plugin = {
  id: 'hello-plugin',
  name: 'Hello Plugin',
  version: '1.0.0',
  description: 'A simple greeting plugin that demonstrates Bun plugin development',
  kodeVersion: '^3.0.0',

  tools: [
    {
      name: 'hello',
      description: 'Say hello to someone',
      category: 'utility',
      permissions: ['read_only'],

      handler: async (params, context) => {
        const name = params.name || 'World';

        return {
          success: true,
          output: `Hello, ${name}!`,
        };
      },

      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name to greet',
            default: 'World',
          },
        },
      },
    },
    {
      name: 'goodbye',
      description: 'Say goodbye to someone',
      category: 'utility',
      permissions: ['read_only'],

      handler: async (params, context) => {
        const name = params.name || 'World';

        return {
          success: true,
          output: `Goodbye, ${name}!`,
        };
      },

      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name to say goodbye to',
            default: 'World',
          },
        },
      },
    },
  ],

  async initialize(context) {
    console.log('[Hello Plugin] Initialized successfully!');
    console.log('[Hello Plugin] Plugin root:', context.pluginRoot);
    console.log('[Hello Plugin] Tools registered:', this.tools.map(t => t.name).join(', '));
  },

  async cleanup(context) {
    console.log('[Hello Plugin] Cleaning up...');
  },

  metadata: {
    author: 'Kode Team',
    license: 'MIT',
    tags: ['example', 'greeting', 'utility'],
    keywords: ['hello', 'greeting', 'demo'],
  },
};

export default helloPlugin;
