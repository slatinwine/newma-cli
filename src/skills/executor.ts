/**
 * Skill Executor
 *
 * Executes skills and returns results to AI.
 * Integrates with OpenAI Function Calling workflow.
 *
 * Key Features:
 * - Execute skill with user input and context
 * - Return structured results to AI
 * - Handle execution errors gracefully
 * - Cache results for repeated calls
 * - Record usage statistics
 */

import { SimpleSkill, SimpleSkillManager } from './simple-loader';
import { SkillRegistry } from './registry';
import { spawn } from 'child_process';

/**
 * Skill execution context
 */
export interface SkillExecutionContext {
  projectPath?: string;
  filePaths?: string[];
  conversationHistory?: any[];
  metadata?: Record<string, any>;
}

/**
 * Skill execution result
 */
export interface SkillExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  skillName: string;
  executionTime: number;  // milliseconds
  cached?: boolean;
}

/**
 * Skill executor options
 */
export interface SkillExecutorOptions {
  /**
   * Enable result caching (default: true)
   */
  enableCache?: boolean;

  /**
   * Cache TTL in seconds (default: 300 = 5 minutes)
   */
  cacheTTL?: number;

  /**
   * Python executable path
   */
  pythonPath?: string;

  /**
   * Path to execute_skill.py
   */
  executorPath?: string;

  /**
   * API configuration
   */
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

/**
 * Cached execution result
 */
interface CachedResult {
  result: SkillExecutionResult;
  timestamp: number;
}

/**
 * Skill Executor
 *
 * Manages skill execution with caching, error handling,
 * and usage tracking.
 */
export class SkillExecutor {
  private skillManager: SimpleSkillManager;
  private registry?: SkillRegistry;
  private cache: Map<string, CachedResult> = new Map();
  private options: Required<SkillExecutorOptions>;

  constructor(
    skillManager: SimpleSkillManager,
    registry?: SkillRegistry,
    options: SkillExecutorOptions = {}
  ) {
    this.skillManager = skillManager;
    this.registry = registry;
    this.options = {
      enableCache: options.enableCache ?? true,
      cacheTTL: options.cacheTTL ?? 300,
      pythonPath: options.pythonPath || 'python3',
      executorPath: options.executorPath ||
        process.cwd() + '/python/execute_skill.py',
      apiKey: options.apiKey || process.env.OPENAI_API_KEY || '',
      baseUrl: options.baseUrl || process.env.OPENAI_BASE_URL || '',
      model: options.model || process.env.OPENAI_MODEL || 'glm-5',
    };
  }

  /**
   * Execute skill by name
   *
   * @param skillName - Name of skill to execute
   * @param input - User input
   * @param context - Execution context
   * @returns Execution result
   */
  async executeSkill(
    skillName: string,
    input: string,
    context: SkillExecutionContext = {}
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();

    try {
      // Check cache
      const cacheKey = this.getCacheKey(skillName, input, context);
      if (this.options.enableCache) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          return {
            ...cached,
            cached: true,
            executionTime: Date.now() - startTime,
          };
        }
      }

      // Get skill
      const skill = this.skillManager.getSkill(skillName);
      if (!skill) {
        throw new Error(`Skill not found: ${skillName}`);
      }

      // Build execution context
      const execContext = this.buildExecutionContext(context);

      // Execute skill
      const output = await this.executeSkillInternal(
        skill,
        input,
        execContext
      );

      // Build result
      const result: SkillExecutionResult = {
        success: true,
        output,
        skillName,
        executionTime: Date.now() - startTime,
      };

      // Cache result
      if (this.options.enableCache) {
        this.setToCache(cacheKey, result);
      }

      // Record usage
      if (this.registry) {
        await this.registry.recordUsage(skillName);
      }

      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        skillName,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute skill at path
   *
   * @param skillPath - Path to SKILL.md
   * @param input - User input
   * @param context - Execution context
   * @returns Execution result
   */
  async executeSkillAtPath(
    skillPath: string,
    input: string,
    context: SkillExecutionContext = {}
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();

    try {
      // Build execution context
      const execContext = this.buildExecutionContext(context);

      // Create temporary skill object
      const skill: SimpleSkill = {
        id: 'temp',
        path: skillPath,
        metadata: {
          name: 'temp',
          description: '',
          type: 'knowledge',
          complexity: 5,
          tags: [],
          whenToUse: [],
          triggers: [],
        },
        content: '',
      };

      // Execute
      const output = await this.executeSkillInternal(skill, input, execContext);

      return {
        success: true,
        output,
        skillName: 'temp',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        skillName: 'temp',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Internal skill execution
   */
  private async executeSkillInternal(
    skill: SimpleSkill,
    input: string,
    context: Record<string, any>
  ): Promise<string> {
    const timeout = skill.metadata.timeout || 120;

    // Execute via Python
    return this.runPythonExecutor(skill.path, input, context, timeout * 1000);
  }

  /**
   * Run Python executor
   */
  private runPythonExecutor(
    skillPath: string,
    input: string,
    context: Record<string, any>,
    timeout: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        OPENAI_API_KEY: this.options.apiKey,
        OPENAI_BASE_URL: this.options.baseUrl,
        OPENAI_MODEL: this.options.model,
        SKILL_DIR: '.kode/skills',
      };

      const python = spawn(
        this.options.pythonPath,
        [this.options.executorPath, 'execute', skillPath, input, JSON.stringify(context)],
        { env, stdio: ['pipe', 'pipe', 'pipe'] }
      );

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
          resolve(stdout.trim());
        } else {
          reject(new Error(`Python execution failed (code ${code}): ${stderr}`));
        }
      });

      // Timeout
      setTimeout(() => {
        python.kill();
        reject(new Error(`Skill execution timeout (${timeout}ms)`));
      }, timeout);
    });
  }

  /**
   * Build execution context for Python
   */
  private buildExecutionContext(context: SkillExecutionContext): Record<string, any> {
    return {
      projectPath: context.projectPath || process.cwd(),
      filePaths: context.filePaths || [],
      conversationHistory: context.conversationHistory || [],
      metadata: context.metadata || {},
    };
  }

  /**
   * Get cache key
   */
  private getCacheKey(
    skillName: string,
    input: string,
    context: SkillExecutionContext
  ): string {
    return JSON.stringify({ skillName, input, context });
  }

  /**
   * Get from cache
   */
  private getFromCache(key: string): SkillExecutionResult | null {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    // Check TTL
    const age = (Date.now() - cached.timestamp) / 1000;
    if (age > this.options.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.result;
  }

  /**
   * Set to cache
   */
  private setToCache(key: string, result: SkillExecutionResult): void {
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}
