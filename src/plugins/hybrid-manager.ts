/**
 * Hybrid Plugin Manager
 *
 * Combines code tools with AI skills for maximum flexibility.
 * Supports:
 * - Progressive disclosure (SKILL.md + references/)
 * - Complex knowledge transfer (AI instructions)
 * - No-compilation mode (direct execution)
 * - Traditional compiled plugins
 */

import { SkillLoader, SkillContext, SkillLoaderOptions } from './skill-loader';
import { DirectExecutionEngine } from './direct-execution';
import { SkillPlugin, DirectPlugin, HybridPlugin } from './skill-types';
import { Plugin } from './types';
import { Tool } from '../tools/types';

/**
 * Hybrid plugin manager
 */
export class HybridPluginManager {
  private skillLoader: SkillLoader;
  private directEngine: DirectExecutionEngine;
  private plugins: Map<string, HybridPluginInstance> = new Map();

  constructor() {
    this.skillLoader = new SkillLoader({
      progressiveDisclosure: true,
      autoLoadByKeyword: true,
      cacheSections: true,
      verbose: false,
    });
    this.directEngine = new DirectExecutionEngine();
  }

  /**
   * Register a hybrid plugin
   */
  async registerPlugin(plugin: HybridPluginSource): Promise<void> {
    const instance = await this.loadPlugin(plugin);
    this.plugins.set(instance.id, instance);
  }

  /**
   * Load plugin from various sources
   */
  private async loadPlugin(source: HybridPluginSource): Promise<HybridPluginInstance> {
    if (source.type === 'traditional') {
      // Traditional compiled plugin
      return {
        id: source.plugin.id,
        name: source.plugin.name,
        type: 'traditional',
        plugin: source.plugin,
      };
    } else if (source.type === 'skill') {
      // Skill-based plugin (SKILL.md)
      const skill = await this.skillLoader.loadSkill(source.path);
      return {
        id: skill.id,
        name: skill.name,
        type: 'skill',
        skill,
      };
    } else if (source.type === 'direct') {
      // Direct execution plugin (no compilation)
      const converted = await this.directEngine.convertToStandardPlugin(source.plugin);
      return {
        id: source.plugin.id,
        name: source.plugin.name,
        type: 'direct',
        plugin: converted,
        directPlugin: source.plugin,
      };
    } else if (source.type === 'hybrid') {
      // Hybrid: code + skill
      const skill = await this.skillLoader.loadSkill(source.skillPath);
      return {
        id: source.codePlugin.id,
        name: source.codePlugin.name,
        type: 'hybrid',
        plugin: source.codePlugin,
        skill,
      };
    } else {
      throw new Error(`Unknown plugin type: ${(source as any).type}`);
    }
  }

  /**
   * Execute plugin/tool
   */
  async execute(
    pluginId: string,
    toolName: string,
    params: Record<string, any>,
    context?: any
  ): Promise<any> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (instance.type === 'traditional' || instance.type === 'direct') {
      // Execute tool from plugin
      if (!instance.plugin) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }
      const tool = instance.plugin.tools.find(t => t.name === toolName);
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      return tool.handler(params, context);
    } else if (instance.type === 'skill') {
      // Execute skill with AI
      if (!instance.skill) {
        throw new Error(`Skill not found: ${pluginId}`);
      }
      return this.executeSkill(instance.skill, params, context);
    } else if (instance.type === 'hybrid') {
      // Try tool first, fall back to skill
      if (!instance.plugin || !instance.skill) {
        throw new Error(`Hybrid plugin incomplete: ${pluginId}`);
      }
      const tool = instance.plugin.tools.find(t => t.name === toolName);
      if (tool) {
        return tool.handler(params, context);
      } else {
        return this.executeSkill(instance.skill, params, context);
      }
    }
  }

  /**
   * Execute skill with AI
   */
  private async executeSkill(
    skill: SkillPlugin,
    params: Record<string, any>,
    context: any
  ): Promise<any> {
    const skillContext: SkillContext = {
      skillId: skill.id,
      projectRoot: context.projectRoot || process.cwd(),
      userInput: params.userInput || '',
      history: params.history || [],
      tools: context.tools || [],
      loadedSections: new Set(),
      metadata: {
        startTime: Date.now(),
        tokensUsed: 0,
        sectionsLoaded: 0,
      },
    };

    // Use AI call from context or default
    const aiCall = context.aiCall || this.defaultAICall;

    return this.skillLoader.executeSkill(skill.id, skillContext, aiCall);
  }

  /**
   * Default AI call (placeholder)
   */
  private async defaultAICall(messages: Array<{ role: string; content: string }>): Promise<string> {
    // This should be replaced with actual AI integration
    console.warn('[HybridPluginManager] AI call not configured, returning placeholder');
    return 'AI response not configured';
  }

  /**
   * Unregister plugin
   */
  async unregisterPlugin(pluginId: string): Promise<void> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      return;
    }

    // Cleanup if needed
    if (instance.plugin?.cleanup) {
      await instance.plugin.cleanup({
        pluginRoot: process.cwd(),
        projectRoot: process.cwd(),
        config: {},
        toolRegistry: null as any,
        hookSystem: null as any,
        getPlugin: () => undefined,
        logger: {
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
        },
      });
    }

    this.plugins.delete(pluginId);
  }

  /**
   * Get plugin by ID
   */
  getPlugin(id: string): HybridPluginInstance | undefined {
    return this.plugins.get(id);
  }

  /**
   * List all plugins
   */
  listPlugins(): HybridPluginInstance[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Find plugins by trigger
   */
  findPluginsByTrigger(userInput: string): HybridPluginInstance[] {
    return this.listPlugins().filter(instance => {
      if (instance.type === 'skill' || instance.type === 'hybrid') {
        const skill = instance.skill;
        return skill?.core.triggers?.some(trigger =>
          userInput.toLowerCase().includes(trigger.toLowerCase())
        ) || false;
      }
      return false;
    });
  }

}

/**
 * Hybrid plugin instance
 */
export interface HybridPluginInstance {
  id: string;
  name: string;
  type: 'traditional' | 'skill' | 'direct' | 'hybrid';
  plugin?: Plugin;
  skill?: SkillPlugin;
  directPlugin?: DirectPlugin;
}

/**
 * Hybrid plugin source
 */
export type HybridPluginSource =
  | { type: 'traditional'; plugin: Plugin }
  | { type: 'skill'; path: string }
  | { type: 'direct'; plugin: DirectPlugin }
  | { type: 'hybrid'; codePlugin: Plugin; skillPath: string };

/**
 * Create hybrid plugin manager
 */
export function createHybridPluginManager(): HybridPluginManager {
  return new HybridPluginManager();
}
