/**
 * Python Plugin Loader
 *
 * Loads and executes Markdown-based plugins using Python executor.
 * Communicates with Python process via JSON over stdin/stdout.
 */

import { spawn, ChildProcess } from 'child_process';
import { readFile } from 'fs/promises';
import { resolve, join } from 'path';
import { LoopPlugin, LoopPluginContext, BeforeInputResult } from '../interfaces/plugin';
import { Command, CommandResult, CommandContext } from '../commands/types';

/**
 * Python plugin metadata
 */
export interface PythonPluginMetadata {
  name: string;
  description: string;
  version: string;
}

/**
 * Python plugin execution result
 */
export interface PythonPluginResult {
  success: boolean;
  output?: string;
  error?: string;
  plugin?: PythonPluginMetadata;
}

/**
 * Python plugin command
 */
export interface PythonPluginCommand {
  type: 'execute' | 'info' | 'exit';
  pluginPath: string;
  userInput?: string;
  context?: Record<string, any>;
}

/**
 * Markdown plugin loader options
 */
export interface MarkdownPluginLoaderOptions {
  /**
   * Path to Python executable
   */
  pythonPath?: string;

  /**
   * Path to execute_plugin.py script
   */
  executorPath?: string;

  /**
   * Whether to keep Python process alive for multiple commands
   */
  persistentProcess?: boolean;

  /**
   * Process timeout in milliseconds
   */
  timeout?: number;
}

/**
 * Python Plugin Loader
 *
 * Loads Markdown plugins and executes them via Python
 */
export class PythonPluginLoader {
  private pythonPath: string;
  private executorPath: string;
  private persistentProcess: boolean;
  private timeout: number;
  private pythonProcess: ChildProcess | null = null;
  private processId = 0;

  constructor(options: MarkdownPluginLoaderOptions = {}) {
    this.pythonPath = options.pythonPath || 'python3';
    this.executorPath = options.executorPath ||
      resolve(__dirname, '../../../python/execute_plugin.py');
    this.persistentProcess = options.persistentProcess ?? true;
    this.timeout = options.timeout || 120000; // 2 minutes default
  }

  /**
   * Load a plugin from Markdown file
   */
  async loadPlugin(pluginPath: string): Promise<LoopPlugin> {
    // Get plugin info
    const info = await this.getPluginInfo(pluginPath);

    // Create LoopPlugin
    const plugin: LoopPlugin = {
      id: info.name,
      name: info.name,
      description: info.description,
      version: info.version,
      type: 'loop',
      tools: [], // Markdown plugins don't provide tools

      // Register as command
      onBeforeInput: async (input: string, context: LoopPluginContext) => {
        // Check if input starts with plugin name
        const commandPattern = new RegExp(`^/?${info.name}\\s*(.*)$`, 'i');
        const match = input.match(commandPattern);

        if (match) {
          const args = match[1].trim();
          const result = await this.executePlugin(pluginPath, args, context);

          if (result.success) {
            // Output will be handled by the command system
            console.log(result.output);
            return {
              shouldContinue: true,
              shouldSkip: true, // Skip normal processing
            };
          } else {
            console.error(`Plugin error: ${result.error}`);
            return {
              shouldContinue: true,
              shouldSkip: true,
            };
          }
        }

        return { shouldContinue: true };
      },
    };

    return plugin;
  }

  /**
   * Get plugin info without executing
   */
  async getPluginInfo(pluginPath: string): Promise<PythonPluginMetadata> {
    const command: PythonPluginCommand = {
      type: 'info',
      pluginPath,
    };

    const result = await this.sendCommand(command);
    return result as unknown as PythonPluginMetadata;
  }

  /**
   * Execute plugin with user input
   */
  async executePlugin(
    pluginPath: string,
    userInput: string,
    context: LoopPluginContext
  ): Promise<PythonPluginResult> {
    const command: PythonPluginCommand = {
      type: 'execute',
      pluginPath,
      userInput,
      context: {
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL,
        model: process.env.OPENAI_MODEL,
        projectRoot: context.projectRoot,
        pluginRoot: context.pluginRoot,
      },
    };

    return await this.sendCommand(command);
  }

  /**
   * Send command to Python process
   */
  private async sendCommand(command: PythonPluginCommand): Promise<any> {
    if (this.persistentProcess) {
      return await this.sendToPersistentProcess(command);
    } else {
      return await this.spawnOneShot(command);
    }
  }

  /**
   * Send command to persistent Python process
   */
  private async sendToPersistentProcess(command: PythonPluginCommand): Promise<any> {
    // Start process if not running
    if (!this.pythonProcess || this.pythonProcess.killed) {
      this.startPersistentProcess();
    }

    return new Promise((resolve, reject) => {
      const id = ++this.processId;
      const timeoutId = setTimeout(() => {
        reject(new Error(`Plugin execution timeout (${this.timeout}ms)`));
      }, this.timeout);

      // Set up response handler
      const responseHandler = (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString().trim());
          // Check if this is our response (simple sequence check)
          // In production, you'd want proper correlation IDs
          clearTimeout(timeoutId);
          resolve(response);
        } catch (error) {
          clearTimeout(timeoutId);
          reject(new Error(`Invalid JSON response: ${data.toString()}`));
        }
      };

      // Send command
      this.pythonProcess!.stdin!.write(JSON.stringify(command) + '\n');

      // Wait for response
      const onData = (data: Buffer) => {
        this.pythonProcess!.stdout!.off('data', onData);
        responseHandler(data);
      };

      this.pythonProcess!.stdout!.once('data', onData);
    });
  }

  /**
   * Spawn one-shot Python process
   */
  private async spawnOneShot(command: PythonPluginCommand): Promise<any> {
    return new Promise((resolve, reject) => {
      const args = ['--stdin'];
      const python = spawn(this.pythonPath, [this.executorPath, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      python.stdout!.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr!.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code === 0 && stdout) {
          try {
            resolve(JSON.parse(stdout.trim()));
          } catch (error) {
            reject(new Error(`Invalid JSON: ${stdout}`));
          }
        } else {
          reject(new Error(`Python process exited with code ${code}: ${stderr}`));
        }
      });

      // Send command
      python.stdin!.write(JSON.stringify(command) + '\n');
      python.stdin!.end();

      // Timeout
      setTimeout(() => {
        python.kill();
        reject(new Error(`Plugin execution timeout (${this.timeout}ms)`));
      }, this.timeout);
    });
  }

  /**
   * Start persistent Python process
   */
  private startPersistentProcess(): void {
    this.pythonProcess = spawn(this.pythonPath, [this.executorPath, '--stdin'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.pythonProcess.on('error', (error) => {
      console.error(`Python process error: ${error.message}`);
      this.pythonProcess = null;
    });

    this.pythonProcess.on('exit', (code, signal) => {
      console.log(`Python process exited (code: ${code}, signal: ${signal})`);
      this.pythonProcess = null;
    });
  }

  /**
   * Stop persistent Python process
   */
  stopPersistentProcess(): void {
    if (this.pythonProcess && !this.pythonProcess.killed) {
      this.pythonProcess.stdin!.write(JSON.stringify({ type: 'exit' }) + '\n');
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }
  }
}

/**
 * Load a Markdown plugin and convert to Command
 */
export async function loadMarkdownPluginAsCommand(
  pluginPath: string,
  loader?: PythonPluginLoader
): Promise<Command> {
  const pluginLoader = loader || new PythonPluginLoader();
  const info = await pluginLoader.getPluginInfo(pluginPath);

  const command: Command = {
    name: info.name,
    description: info.description,
    handler: async (context: CommandContext): Promise<CommandResult> => {
      try {
        const userInput = context.args.join(' ');
        const pluginContext: LoopPluginContext = {
          session: context.session,
          config: {},
          pluginRoot: process.cwd(),
          projectRoot: process.cwd(),
        };

        const result = await pluginLoader.executePlugin(
          pluginPath,
          userInput,
          pluginContext
        );

        if (result.success) {
          return {
            success: true,
            output: result.output || '',
          };
        } else {
          return {
            success: false,
            error: result.error || 'Plugin execution failed',
          };
        }
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
    help: {
      name: info.name,
      description: info.description,
      category: 'markdown-plugin',
    },
  };

  return command;
}

/**
 * Create a plugin scanner for Markdown plugins
 */
export class MarkdownPluginScanner {
  private loader: PythonPluginLoader;

  constructor(loader?: PythonPluginLoader) {
    this.loader = loader || new PythonPluginLoader();
  }

  /**
   * Scan directory for Markdown plugins
   */
  async scanDirectory(directory: string): Promise<string[]> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const plugins: string[] = [];

    async function scan(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          // Check if it has plugin frontmatter
          const content = await fs.readFile(fullPath, 'utf-8');
          if (content.startsWith('---') && content.includes('name:')) {
            plugins.push(fullPath);
          }
        }
      }
    }

    await scan(directory);
    return plugins;
  }

  /**
   * Load all plugins from directory
   */
  async loadFromDirectory(directory: string): Promise<LoopPlugin[]> {
    const pluginPaths = await this.scanDirectory(directory);
    const plugins: LoopPlugin[] = [];

    for (const pluginPath of pluginPaths) {
      try {
        const plugin = await this.loader.loadPlugin(pluginPath);
        plugins.push(plugin);
      } catch (error: any) {
        console.error(`Failed to load plugin ${pluginPath}: ${error.message}`);
      }
    }

    return plugins;
  }

  /**
   * Load all plugins as commands
   */
  async loadCommandsFromDirectory(directory: string): Promise<Command[]> {
    const pluginPaths = await this.scanDirectory(directory);
    const commands: Command[] = [];

    for (const pluginPath of pluginPaths) {
      try {
        const command = await loadMarkdownPluginAsCommand(pluginPath, this.loader);
        commands.push(command);
      } catch (error: any) {
        console.error(`Failed to load command from ${pluginPath}: ${error.message}`);
      }
    }

    return commands;
  }
}
