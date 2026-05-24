/**
 * Direct Execution Engine
 *
 * Executes TypeScript/JavaScript plugins without compilation step.
 * Supports immediate execution, similar to running scripts directly.
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { DirectPlugin, DirectToolDefinition } from './skill-types';
import { Tool } from '../tools/types';

/**
 * Direct execution engine
 */
export class DirectExecutionEngine {
  private loadedPlugins: Map<string, any> = new Map();
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(process.cwd(), '.kode', 'temp');
  }

  /**
   * Execute direct plugin without compilation
   */
  async executeDirectPlugin(
    plugin: DirectPlugin,
    toolName: string,
    params: Record<string, any>
  ): Promise<any> {
    if (plugin.type === 'typescript' || plugin.type === 'javascript') {
      return this.executeNodePlugin(plugin, toolName, params);
    } else if (plugin.type === 'python') {
      return this.executePythonPlugin(plugin, toolName, params);
    } else if (plugin.type === 'bash') {
      return this.executeBashPlugin(plugin, toolName, params);
    } else {
      throw new Error(`Unsupported plugin type: ${plugin.type}`);
    }
  }

  /**
   * Execute Node.js plugin (TypeScript/JavaScript)
   */
  private async executeNodePlugin(
    plugin: DirectPlugin,
    toolName: string,
    params: Record<string, any>
  ): Promise<any> {
    const tool = plugin.tools?.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // Create execution script
    const script = this.buildNodeExecutionScript(plugin, tool, params);

    // Write to temp file
    await fs.mkdir(this.tempDir, { recursive: true });
    const tempFile = path.join(this.tempDir, `exec-${Date.now()}.mjs`);
    await fs.writeFile(tempFile, script, 'utf-8');

    try {
      // Execute with node
      const result = await this.runNodeScript(tempFile);
      return JSON.parse(result);
    } finally {
      // Cleanup
      await fs.unlink(tempFile).catch((_e) => { /* direct-execution: temp file cleanup */ });
    }
  }

  /**
   * Execute Python plugin
   */
  private async executePythonPlugin(
    plugin: DirectPlugin,
    toolName: string,
    params: Record<string, any>
  ): Promise<any> {
    const tool = plugin.tools?.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // Create execution script
    const script = this.buildPythonExecutionScript(tool, params);

    // Write to temp file
    await fs.mkdir(this.tempDir, { recursive: true });
    const tempFile = path.join(this.tempDir, `exec-${Date.now()}.py`);
    await fs.writeFile(tempFile, script, 'utf-8');

    try {
      // Execute with python
      const result = await this.runPythonScript(tempFile);
      return JSON.parse(result);
    } finally {
      // Cleanup
      await fs.unlink(tempFile).catch((_e) => { /* direct-execution: temp file cleanup */ });
    }
  }

  /**
   * Execute Bash plugin
   */
  private async executeBashPlugin(
    plugin: DirectPlugin,
    toolName: string,
    params: Record<string, any>
  ): Promise<any> {
    const tool = plugin.tools?.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // Execute handler as bash command
    const command = tool.handler
      .replace(/\$\{(\w+)\}/g, (_, key) => params[key] || '')
      .replace(/\$(\w+)/g, (_, key) => params[key] || '');

    return this.runBashCommand(command);
  }

  /**
   * Build Node.js execution script
   */
  private buildNodeExecutionScript(
    plugin: DirectPlugin,
    tool: DirectToolDefinition,
    params: Record<string, any>
  ): string {
    return `
// Direct execution plugin: ${plugin.id}
// Tool: ${tool.name}

const params = ${JSON.stringify(params)};

// Tool handler
async function handler() {
  try {
    ${tool.handler}

    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Execute
handler()
  .then(result => {
    console.log(JSON.stringify(result));
  })
  .catch(error => {
    console.error(JSON.stringify({
      success: false,
      error: error.message
    }));
  });
`;
  }

  /**
   * Build Python execution script
   */
  private buildPythonExecutionScript(
    tool: DirectToolDefinition,
    params: Record<string, any>
  ): string {
    return `
import json
import sys

# Tool parameters
params = ${JSON.stringify(params)}

# Tool handler
${tool.handler}

if __name__ == '__main__':
    try:
        result = handler()
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
`;
  }

  /**
   * Run Node.js script
   */
  private async runNodeScript(scriptPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('node', [scriptPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Script failed with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * Run Python script
   */
  private async runPythonScript(scriptPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('python3', [scriptPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Script failed with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * Run bash command
   */
  private async runBashCommand(command: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const proc = spawn('bash', ['-c', command], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        resolve({
          success: code === 0,
          output: stdout,
          error: stderr,
          exitCode: code,
        });
      });

      proc.on('error', reject);
    });
  }

  /**
   * Convert direct plugin to standard plugin interface
   */
  async convertToStandardPlugin(plugin: DirectPlugin): Promise<any> {
    const convertedTools: Tool[] = (plugin.tools || []).map(tool => ({
      name: tool.name,
      description: tool.description || '',
      category: (tool.category as any) || 'UTILITY',
      permissions: (tool.permissions as any) || ['READ_ONLY'],
      // Convert parameters schema if present, otherwise use empty array
      parameters: tool.parameters ? Object.entries(tool.parameters.properties || {}).map(([name, prop]: [string, any]) => ({
        name,
        description: prop.description,
        type: prop.type,
        required: tool.parameters?.required?.includes(name) || false,
      })) : [],
      handler: async (params: any) => {
        return this.executeDirectPlugin(plugin, tool.name, params);
      },
    }));

    return {
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      version: plugin.version,
      tools: convertedTools,
      initialize: async () => {
        console.log(`[DirectPlugin] ${plugin.id} initialized`);
      },
      cleanup: async () => {
        console.log(`[DirectPlugin] ${plugin.id} cleaned up`);
      },
    };
  }
}

/**
 * Create direct execution engine
 */
export function createDirectExecutionEngine(): DirectExecutionEngine {
  return new DirectExecutionEngine();
}
