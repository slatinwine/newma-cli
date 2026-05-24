/**
 * API Integration Skill Template
 * Specialized for API integration and automation
 *
 * Best for:
 * - REST API integrations
 * - Webhook handling
 * - Third-party service integration
 * - API automation
 */

import { SkillMetadata } from '../types';

export const apiIntegrationSkillTemplate: {
  metadata: SkillMetadata;
  skillMd: string;
  codeTs: string;
} = {
  metadata: {
    id: 'api-integration-skill',
    name: 'API Integration Skill',
    version: '1.0.0',
    description: 'A template for creating API integration and automation skills',
    type: 'code',
    category: 'integration',
    complexity: 7,
    tags: ['api', 'integration', 'rest', 'webhook', 'automation'],
    keywords: ['api', 'rest', 'webhook', 'integration', 'service', 'endpoint'],
    triggers: ['integrate api', 'call api', 'webhook', 'connect to', 'api integration'],
    whenToUse: [
      'User needs to integrate with an API',
      'User wants to automate API calls',
      'User requires webhook handling',
      'User needs third-party service integration',
    ],
    author: 'Your Name',
    license: 'MIT',
    performance: {
      estimatedTokens: 2500,
      averageResponseTime: 2000,
      cacheable: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: 'API operation to perform',
        },
        endpoint: {
          type: 'string',
          description: 'API endpoint URL',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
          description: 'HTTP method',
        },
        headers: {
          type: 'object',
          description: 'HTTP headers',
        },
        body: {
          type: 'object',
          description: 'Request body',
        },
        params: {
          type: 'object',
          description: 'Query parameters',
        },
      },
      required: ['operation', 'endpoint', 'method'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'any' },
        status: { type: 'number' },
        headers: { type: 'object' },
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

## API Configuration

{{apiConfiguration}}

## Supported Operations

{{supportedOperations}}

## Authentication

{{authentication}}

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

## Error Handling

{{errorHandling}}
`,

  codeTs: `import fetch from 'node-fetch';
import { SkillContext, SkillResult } from '../types';

interface ApiRequest {
  operation: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string>;
}

interface ApiResponse {
  success: boolean;
  data?: any;
  status?: number;
  headers?: Record<string, string>;
  error?: string;
}

/**
 * {{name}} API Integration Skill
 * {{description}}
 */
export class {{className}} {
  private baseUrl: string;
  private apiKey?: string;
  private defaultHeaders: Record<string, string>;

  constructor(config: { baseUrl: string; apiKey?: string }) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': '{{name}}/1.0.0',
    };

    if (this.apiKey) {
      this.defaultHeaders['Authorization'] = \`Bearer \${this.apiKey}\`;
    }
  }

  /**
   * Execute API operation
   */
  async execute(context: SkillContext): Promise<SkillResult> {
    try {
      const request = this.parseRequest(context.userInput);
      const response = await this.makeRequest(request);

      return response;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Parse user input into API request
   */
  private parseRequest(input: string): ApiRequest {
    try {
      const parsed = JSON.parse(input);
      return parsed;
    } catch {
      return this.parseNaturalLanguage(input);
    }
  }

  /**
   * Parse natural language input
   */
  private parseNaturalLanguage(input: string): ApiRequest {
    const parts = input.trim().split(/\\s+/);
    const operation = parts[0].toLowerCase();
    const endpoint = parts[1] || '';

    // Determine HTTP method from operation
    const methodMap: Record<string, 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'> = {
      get: 'GET',
      fetch: 'GET',
      list: 'GET',
      create: 'POST',
      post: 'POST',
      update: 'PUT',
      put: 'PUT',
      delete: 'DELETE',
      remove: 'DELETE',
      patch: 'PATCH',
    };

    const method = methodMap[operation] || 'GET';

    return {
      operation,
      endpoint: this.buildEndpoint(endpoint),
      method,
    };
  }

  /**
   * Build full endpoint URL
   */
  private buildEndpoint(endpoint: string): string {
    if (endpoint.startsWith('http')) {
      return endpoint;
    }

    return \`\${this.baseUrl.replace(/\\/$/, '')}/\${endpoint.replace(/^\\//, '')}\`;
  }

  /**
   * Make HTTP request
   */
  private async makeRequest(request: ApiRequest): Promise<ApiResponse> {
    const url = new URL(request.endpoint);

    // Add query parameters
    if (request.params) {
      Object.entries(request.params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    // Prepare request options
    const options: RequestInit = {
      method: request.method,
      headers: {
        ...this.defaultHeaders,
        ...request.headers,
      },
    };

    // Add body for POST/PUT/PATCH
    if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      options.body = JSON.stringify(request.body);
    }

    try {
      const response = await fetch(url.toString(), options);
      const data = await this.parseResponse(response);

      return {
        success: response.ok,
        data,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        error: response.ok ? undefined : \`HTTP \${response.status}\`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Parse API response
   */
  private async parseResponse(response: any): Promise<any> {
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      return await response.json();
    }

    if (contentType?.includes('text/')) {
      return await response.text();
    }

    return await response.buffer();
  }

  /**
   * GET request
   */
  async get(endpoint: string, params?: Record<string, string>): Promise<ApiResponse> {
    return this.makeRequest({
      operation: 'get',
      endpoint,
      method: 'GET',
      params,
    });
  }

  /**
   * POST request
   */
  async post(endpoint: string, body?: any): Promise<ApiResponse> {
    return this.makeRequest({
      operation: 'post',
      endpoint,
      method: 'POST',
      body,
    });
  }

  /**
   * PUT request
   */
  async put(endpoint: string, body?: any): Promise<ApiResponse> {
    return this.makeRequest({
      operation: 'put',
      endpoint,
      method: 'PUT',
      body,
    });
  }

  /**
   * DELETE request
   */
  async delete(endpoint: string): Promise<ApiResponse> {
    return this.makeRequest({
      operation: 'delete',
      endpoint,
      method: 'DELETE',
    });
  }

  /**
   * PATCH request
   */
  async patch(endpoint: string, body?: any): Promise<ApiResponse> {
    return this.makeRequest({
      operation: 'patch',
      endpoint,
      method: 'PATCH',
      body,
    });
  }

  {{customMethods}}
}
`,
};

/**
 * Generate API integration skill from variables
 */
export function generateApiIntegrationSkill(variables: Record<string, any>): {
  metadata: SkillMetadata;
  skillMd: string;
  codeTs: string;
} {
  const className = variables.name?.replace(/\s+/g, '') || 'ApiIntegrationSkill';

  const metadata: SkillMetadata = {
    ...apiIntegrationSkillTemplate.metadata,
    id: variables.name?.toLowerCase().replace(/\s+/g, '-') || 'api-integration-skill',
    name: variables.name || 'API Integration Skill',
    description: variables.description || 'An API integration skill',
    category: variables.category || 'integration',
    complexity: variables.complexity || 7,
    tags: variables.tags || ['api', 'integration'],
    triggers: variables.triggers || ['integrate', 'api'],
    whenToUse: variables.whenToUse || ['User needs API integration'],
    author: variables.author || 'Your Name',
  };

  const skillMd = apiIntegrationSkillTemplate.skillMd
    .replace(/\{\{name\}\}/g, metadata.name)
    .replace(/\{\{description\}\}/g, metadata.description)
    .replace(/\{\{complexity\}\}/g, metadata.complexity.toString())
    .replace(/\{\{tags\}\}/g, metadata.tags.join(', '))
    .replace(/\{\{triggers\}\}/g, metadata.triggers.join(', '))
    .replace(/\{\{whenToUse\}\}/g, metadata.whenToUse.join('\n  - '))
    .replace(/\{\{author\}\}/g, metadata.author)
    .replace(/\{\{category\}\}/g, metadata.category)
    .replace(/\{\{apiConfiguration\}\}/g, variables.apiConfiguration || 'Add API configuration details')
    .replace(/\{\{supportedOperations\}\}/g, variables.supportedOperations || '- GET\n- POST\n- PUT\n- DELETE\n- PATCH')
    .replace(/\{\{authentication\}\}/g, variables.authentication || 'Bearer token authentication')
    .replace(/\{\{inputSchema\}\}/g, JSON.stringify(apiIntegrationSkillTemplate.metadata.inputSchema, null, 2))
    .replace(/\{\{outputSchema\}\}/g, JSON.stringify(apiIntegrationSkillTemplate.metadata.outputSchema, null, 2))
    .replace(/\{\{examples\}\}/g, variables.examples || 'Add API usage examples')
    .replace(/\{\{errorHandling\}\}/g, variables.errorHandling || 'Standard HTTP error handling');

  const codeTs = apiIntegrationSkillTemplate.codeTs
    .replace(/\{\{name\}\}/g, metadata.name)
    .replace(/\{\{description\}\}/g, metadata.description)
    .replace(/\{\{className\}\}/g, className)
    .replace(/\{\{customMethods\}\}/g, variables.customMethods || '');

  return { metadata, skillMd, codeTs };
}
