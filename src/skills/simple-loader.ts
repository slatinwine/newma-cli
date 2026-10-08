/**
 * Simplified Skill Loader
 *
 * A much simpler alternative to ProgressiveSkillLoader.
 * Uses Python executor for skill execution.
 */

import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

/**
 * Skill metadata (parsed from frontmatter)
 *
 * Enhanced with OpenDeepWiki-inspired fields for better AI integration.
 */
export interface SimpleSkillMetadata {
  // Core identity
  name: string;
  description: string;

  // Type classification
  type: 'knowledge' | 'code' | 'hybrid';
  complexity: number;

  // Discovery hints
  tags: string[];
  whenToUse: string[];
  triggers: string[];

  // OpenDeepWiki-inspired fields
  license?: string;              // e.g., "MIT", "Apache-2.0"
  compatibility?: string[];      // e.g., ["gpt-4", "claude-3", "glm-4"]
  allowedTools?: string[];       // Tools this skill can use (e.g., ["read_file", "search"])
  author?: string;               // Skill author
  version?: string;              // Semver version (e.g., "1.0.0")

  // Folder structure hints
  hasScripts?: boolean;          // Whether skill has scripts/ folder
  hasReferences?: boolean;       // Whether skill has references/ folder
  hasAssets?: boolean;           // Whether skill has assets/ folder

  // Execution hints
  timeout?: number;              // Execution timeout in seconds (default: 120)
  async?: boolean;               // Whether skill execution is async
}

/**
 * Skill reference
 */
export interface SimpleSkill {
  id: string;
  path: string;
  metadata: SimpleSkillMetadata;
  content: string;
}

/**
 * Skill execution result
 */
export interface SkillExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  matchedSkill?: string;
}

/**
 * Simplified skill manager options
 */
export interface SimpleSkillManagerOptions {
  /**
   * Skill directories to scan
   */
  skillDirectories?: string[];

  /**
   * Python executable path
   */
  pythonPath?: string;

  /**
   * Path to execute_skill.py
   */
  executorPath?: string;

  /**
   * API key (for AI execution)
   */
  apiKey?: string;

  /**
   * API base URL
   */
  baseUrl?: string;

  /**
   * AI model
   */
  model?: string;
}

/**
 * Simplified Skill Manager
 *
 * Key differences from ProgressiveSkillLoader:
 * - No progressive loading (load everything at once)
 * - No token counting
 * - No complexity analysis
 * - Python-based execution
 * - Simple LRU cache
 */
export class SimpleSkillManager {
  private skills: Map<string, SimpleSkill> = new Map();
  private pythonPath: string;
  private executorPath: string;
  private options: Required<SimpleSkillManagerOptions>;

  constructor(options: SimpleSkillManagerOptions = {}) {
    this.pythonPath = options.pythonPath || 'python3';
    // ESM 无 __dirname：从模块 URL 推导（dist 与 src 各自相对上两级
    // 即 python/；bun 单文件打包时可用 executorPath 覆盖）
    const moduleDir = dirname(fileURLToPath(import.meta.url));
    this.executorPath = options.executorPath ||
      resolve(moduleDir, '../../python/execute_skill.py');

    this.options = {
      skillDirectories: options.skillDirectories || ['.kode/skills'],
      pythonPath: this.pythonPath,
      executorPath: this.executorPath,
      apiKey: options.apiKey || process.env.OPENAI_API_KEY || '',
      baseUrl: options.baseUrl || process.env.OPENAI_BASE_URL || '',
      model: options.model || process.env.OPENAI_MODEL || 'glm-5',
    };
  }

  /**
   * Discover and load all skills
   */
  async discoverSkills(): Promise<SimpleSkill[]> {
    const skills: SimpleSkill[] = [];

    for (const dir of this.options.skillDirectories) {
      const found = await this.scanDirectory(dir);
      skills.push(...found);
    }

    // Store in map for quick access
    for (const skill of skills) {
      this.skills.set(skill.metadata.name, skill);
    }

    return skills;
  }

  /**
   * Scan directory for skills
   */
  private async scanDirectory(directory: string): Promise<SimpleSkill[]> {
    const skills: SimpleSkill[] = [];
    const path = await import('path');
    const fs = await import('fs/promises');

    async function scan(dir: string, baseDir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath, baseDir);
        } else if (entry.name === 'SKILL.md') {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const metadata = parseSkillFrontmatter(content);

            const skill: SimpleSkill = {
              id: metadata.name.toLowerCase().replace(/\s+/g, '-'),
              path: fullPath,
              metadata,
              content,
            };

            skills.push(skill);
          } catch (error: any) {
            console.error(`Failed to load skill from ${fullPath}: ${error.message}`);
          }
        }
      }
    }

    if (existsSync(directory)) {
      await scan(directory, directory);
    }

    return skills;
  }

  /**
   * Find matching skill for input
   */
  findMatchingSkill(userInput: string): SimpleSkill | null {
    const inputLower = userInput.toLowerCase();

    for (const skill of Array.from(this.skills.values())) {
      for (const trigger of skill.metadata.triggers) {
        if (inputLower.includes(trigger.toLowerCase())) {
          return skill;
        }
      }
    }

    return null;
  }

  /**
   * Execute skill with user input
   */
  async executeSkill(skillName: string, userInput: string, context: Record<string, any> = {}): Promise<SkillExecutionResult> {
    const skill = this.skills.get(skillName);
    if (!skill) {
      return {
        success: false,
        error: `Skill not found: ${skillName}`,
      };
    }

    return this.executeSkillWithPath(skill.path, userInput, context);
  }

  /**
   * Execute skill at path
   */
  async executeSkillWithPath(skillPath: string, userInput: string, context: Record<string, any> = {}): Promise<SkillExecutionResult> {
    try {
      const env = {
        ...process.env,
        OPENAI_API_KEY: this.options.apiKey,
        OPENAI_BASE_URL: this.options.baseUrl,
        OPENAI_MODEL: this.options.model,
        SKILL_DIR: '.kode/skills',
      };

      const result = await this.runPythonCommand('execute', [
        skillPath,
        userInput,
        JSON.stringify(context),
      ], env);

      return {
        success: true,
        output: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Match and execute skill for input
   */
  async matchAndExecute(userInput: string, context: Record<string, any> = {}): Promise<SkillExecutionResult> {
    const skill = this.findMatchingSkill(userInput);

    if (!skill) {
      return {
        success: false,
        error: 'No matching skill found',
      };
    }

    const result = await this.executeSkillWithPath(skill.path, userInput, context);
    result.matchedSkill = skill.metadata.name;
    return result;
  }

  /**
   * Get all skills
   */
  getAllSkills(): SimpleSkill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skill by name
   */
  getSkill(name: string): SimpleSkill | undefined {
    return this.skills.get(name);
  }

  /**
   * Run Python command
   */
  private runPythonCommand(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> {
    return new Promise((resolve, reject) => {
      const python = spawn(this.pythonPath, [this.executorPath, command, ...args], {
        env,
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
          resolve(stdout.trim());
        } else {
          reject(new Error(`Python execution failed (code ${code}): ${stderr}`));
        }
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        python.kill();
        reject(new Error('Skill execution timeout (120s)'));
      }, 120000);
    });
  }
}

/**
 * Parse skill frontmatter from SKILL.md content
 *
 * Enhanced to support OpenDeepWiki-style fields:
 * - license, compatibility, allowedTools
 * - author, version
 * - hasScripts, hasReferences, hasAssets
 * - timeout, async
 */
export function parseSkillFrontmatter(content: string): SimpleSkillMetadata {
  // Default metadata
  const metadata: SimpleSkillMetadata = {
    name: 'Unnamed Skill',
    description: '',
    type: 'knowledge',
    complexity: 5,
    tags: [],
    whenToUse: [],
    triggers: [],

    // New fields with defaults
    license: undefined,
    compatibility: undefined,
    allowedTools: undefined,
    author: undefined,
    version: '1.0.0',
    hasScripts: false,
    hasReferences: false,
    hasAssets: false,
    timeout: 120,
    async: false,
  };

  // Extract frontmatter
  if (content.startsWith('---')) {
    const endIdx = content.indexOf('---', 3);
    if (endIdx !== -1) {
      const frontmatterText = content.substring(3, endIdx).trim();

      // Parse YAML-like format (handle multiline lists)
      const lines = frontmatterText.split('\n');
      let i = 0;

      while (i < lines.length) {
        const line = lines[i];
        const stripped = line.trim();

        // Skip empty lines
        if (!stripped) {
          i++;
          continue;
        }

        // Check if this is a key
        if (stripped.includes(':') && !stripped.startsWith('-')) {
          const colonIdx = stripped.indexOf(':');
          const key = stripped.substring(0, colonIdx).trim();
          const value = stripped.substring(colonIdx + 1).trim();

          // Check if next lines contain list items (start with "-")
          const listItems: string[] = [];
          let j = i + 1;

          while (j < lines.length) {
            const nextLine = lines[j].trim();
            if (nextLine.startsWith('- ')) {
              listItems.push(nextLine.substring(2).trim().replace(/^["']|["']$/g, ''));
              j++;
            } else if (nextLine) {
              // Not empty and not a list item, stop
              break;
            } else {
              // Empty line, continue
              j++;
            }
          }

          // If we found list items, use them
          if (listItems.length > 0) {
            setMetadataValue(metadata, key, listItems);
            i = j - 1; // Will be incremented to j
          } else if (value) {
            // No list items, parse the value
            setMetadataValue(metadata, key, value);
          }
        }

        i++;
      }
    }
  }

  return metadata;
}

/**
 * Set metadata value based on key
 *
 * Enhanced to support new OpenDeepWiki-inspired fields.
 */
function setMetadataValue(metadata: SimpleSkillMetadata, key: string, value: any): void {
  const cleanValue = typeof value === 'string' ? value.trim().replace(/^["']|["']$/g, '') : value;

  switch (key) {
    // Core fields
    case 'name':
      metadata.name = cleanValue;
      break;
    case 'description':
      metadata.description = cleanValue;
      break;
    case 'type':
      if (['knowledge', 'code', 'hybrid'].includes(cleanValue)) {
        metadata.type = cleanValue as any;
      }
      break;
    case 'complexity':
      metadata.complexity = parseInt(cleanValue, 10) || 5;
      break;

    // Discovery hints
    case 'tags':
      metadata.tags = Array.isArray(value) ? value : parseList(cleanValue);
      break;
    case 'whenToUse':
      metadata.whenToUse = Array.isArray(value) ? value : parseList(cleanValue);
      break;
    case 'triggers':
      metadata.triggers = Array.isArray(value) ? value : parseList(cleanValue);
      break;

    // OpenDeepWiki-inspired fields
    case 'license':
      metadata.license = cleanValue || undefined;
      break;
    case 'compatibility':
      metadata.compatibility = Array.isArray(value) ? value : parseList(cleanValue);
      break;
    case 'allowed-tools':
    case 'allowedTools':
      metadata.allowedTools = Array.isArray(value) ? value : parseList(cleanValue);
      break;
    case 'author':
      metadata.author = cleanValue || undefined;
      break;
    case 'version':
      metadata.version = cleanValue || '1.0.0';
      break;

    // Folder structure hints
    case 'has-scripts':
    case 'hasScripts':
      metadata.hasScripts = cleanValue === 'true' || cleanValue === true;
      break;
    case 'has-references':
    case 'hasReferences':
      metadata.hasReferences = cleanValue === 'true' || cleanValue === true;
      break;
    case 'has-assets':
    case 'hasAssets':
      metadata.hasAssets = cleanValue === 'true' || cleanValue === true;
      break;

    // Execution hints
    case 'timeout':
      metadata.timeout = parseInt(cleanValue, 10) || 120;
      break;
    case 'async':
      metadata.async = cleanValue === 'true' || cleanValue === true;
      break;
  }
}


/**
 * Parse YAML list format
 */
function parseList(value: string): string[] {
  // Handle array format: [item1, item2, item3]
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((v) => v.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }

  // Handle single value
  if (value) {
    return [value.replace(/^["']|["']$/g, '')];
  }

  return [];
}
