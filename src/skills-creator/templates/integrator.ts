/**
 * Integrator Plugin Template
 *
 * Use this for third-party service integration plugins.
 * Suitable for: API clients, webhooks, external service integrations.
 */

export const INTEGRATOR_TEMPLATE = `/**
 * {pluginName} - Integration Plugin
 *
 * [TODO: Complete description]
 * Example: "Integrates with GitHub API for repository management"
 *
 * Common Use Cases:
 * - API clients (REST, GraphQL)
 * - Webhook handlers
 * - OAuth authentication
 * - Third-party service integration
 *
 * Quick Start:
 * 1. Add API configuration/credentials
 * 2. Implement API client methods
 * 3. Test: bun test plugin.test.ts
 * 4. Load: /plugin-load {pluginId}
 */

import type { Plugin } from '../../src/plugins/types';
import { ToolCategory, Permission } from '../../src/tools/types';

// [TODO: Import API client libraries]
// Examples:
// - import { Octokit } from 'octokit'; // GitHub API
// - import axios from 'axios'; // HTTP client
// - import { WebClient } from '@slack/web-api'; // Slack API

const {pluginId}Plugin: Plugin = {
  id: '{pluginId}',
  name: '{pluginName}',
  version: '{version}',
  description: '{description}',

  tools: [
    {
      name: 'configure',
      description: 'Configure API credentials and settings',
      category: ToolCategory.UTILITY,
      permissions: [Permission.READ_ONLY],

      parameters: [
        {
          name: 'apiKey',
          type: 'string',
          description: 'API key or token',
          required: true,
        },
        {
          name: 'endpoint',
          type: 'string',
          description: 'API endpoint URL (if custom)',
          required: false,
        },
        {
          name: 'options',
          type: 'object',
          description: 'Additional configuration options',
          required: false,
        },
      ],

      handler: async (params, context) => {
        // [TODO: Implement configuration logic]
        //
        // Steps:
        // 1. Validate API key format
        // 2. Test connection to API
        // 3. Store configuration (use context.config or environment variables)
        // 4. Return success/error

        const { apiKey, endpoint, options } = params as {
          apiKey: string;
          endpoint?: string;
          options?: Record<string, any>;
        };

        try {
          // TODO: Validate API key
          if (!apiKey || apiKey.length < 10) {
            return {
              success: false,
              error: 'Invalid API key format',
            };
          }

          // TODO: Test connection
          // const client = new ApiClient({ apiKey, endpoint });
          // await client.test();

          // TODO: Store configuration securely
          // Option 1: Environment variables
          // process.env.{PLUGIN_NAME}_API_KEY = apiKey;

          // Option 2: Config file
          // const configPath = path.join(context.pluginRoot, 'config.json');
          // await fs.writeFile(configPath, JSON.stringify({ apiKey, endpoint, options }));

          return {
            success: true,
            output: 'API configured successfully',
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Configuration failed',
          };
        }
      },
    },

    {
      name: 'request',
      description: 'Make API request to external service',
      category: ToolCategory.INTEGRATION,
      permissions: [Permission.NETWORK],

      parameters: [
        {
          name: 'method',
          type: 'string',
          description: 'HTTP method: GET, POST, PUT, DELETE, etc.',
          required: true,
        },
        {
          name: 'path',
          type: 'string',
          description: 'API endpoint path (e.g., "/users")',
          required: true,
        },
        {
          name: 'body',
          type: 'object',
          description: 'Request body (for POST/PUT requests)',
          required: false,
        },
        {
          name: 'params',
          type: 'object',
          description: 'Query parameters',
          required: false,
        },
      ],

      handler: async (params, context) => {
        // [TODO: Implement API request logic]
        //
        // Steps:
        // 1. Load API configuration
        // 2. Build request (method, path, headers, body)
        // 3. Execute HTTP request
        // 4. Handle response/errors
        // 5. Return formatted result

        const { method, path, body, params: queryParams } = params as {
          method: string;
          path: string;
          body?: Record<string, any>;
          params?: Record<string, any>;
        };

        try {
          // TODO: Load configuration
          // const config = await loadConfig(context);

          // TODO: Make API request
          // const client = new ApiClient(config);
          // const response = await client.request({
          //   method: method.toUpperCase(),
          //   path,
          //   body,
          //   params: queryParams,
          // });

          return {
            success: true,
            output: \`API request: \${method} \${path}\`,
            // TODO: Return actual response data
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'API request failed',
          };
        }
      },
    },

    // [TODO: Add more integration-specific tools]
    // Examples for GitHub integration:
    // - createIssue: Create a new issue
    // - listRepos: List repositories
    // - getBranch: Get branch information
  ],

  async initialize(context) {
    // TODO: Load API configuration
    // TODO: Initialize API client
    // TODO: Validate credentials
    console.log('[{pluginName}] Integration ready');
  },

  async cleanup(context) {
    // TODO: Close API connections
    // TODO: Clear sensitive data
    console.log('[{pluginName}] Integration cleaned up');
  },
};

export default {pluginId}Plugin;
`;
