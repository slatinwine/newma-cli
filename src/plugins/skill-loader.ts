/**
 * Skill Plugin Loader
 *
 * Loads and manages Claude Skills-like plugins in Kode with:
 * - Progressive disclosure (load sections on demand)
 * - Complex knowledge transfer (AI-readable markdown)
 * - No-compilation mode (direct execution)
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import {
  SkillPlugin,
  SkillContext,
  SkillResult,
  SkillManifest,
  SkillSection,
  SkillLoaderOptions
} from './skill-types';
import { Tool } from '../tools/types';

// Re-export types for external use
export type { SkillContext, SkillResult, SkillManifest, SkillSection, SkillLoaderOptions };

/**
 * Skill Plugin Loader
 */
export class SkillLoader {
  private skills: Map<string, SkillPlugin> = new Map();
  private sectionCache: Map<string, string> = new Map();
  protected options: SkillLoaderOptions;

  constructor(options: SkillLoaderOptions = {}) {
    this.options = {
      progressiveDisclosure: true,
      maxInitialTokens: 4000,
      autoLoadByKeyword: true,
      cacheSections: true,
      verbose: false,
      ...options,
    };
  }

  /**
   * Load skill from directory
   */
  async loadSkill(skillPath: string): Promise<SkillPlugin> {
    const startTime = Date.now();

    if (this.options.verbose) {
      console.log(`[SkillLoader] Loading skill from: ${skillPath}`);
    }

    // Read SKILL.md
    const skillFilePath = path.join(skillPath, 'SKILL.md');
    let skillContent: string;

    try {
      skillContent = await fs.readFile(skillFilePath, 'utf-8');
    } catch (error) {
      throw new Error(`SKILL.md not found in ${skillPath}`);
    }

    // Parse frontmatter
    const { frontmatter, content } = this.parseFrontmatter(skillContent);
    const manifest = this.parseManifest(frontmatter);

    // Load references directory (progressive disclosure)
    const referencesDir = path.join(skillPath, 'references');
    let sections: SkillSection[] = [];

    try {
      const referenceFiles = await fs.readdir(referencesDir);

      for (const file of referenceFiles) {
        if (file.endsWith('.md')) {
          const sectionPath = path.join(referencesDir, file);
          const sectionContent = await fs.readFile(sectionPath, 'utf-8');
          const sectionName = path.basename(file, '.md');

          sections.push({
            id: sectionName,
            title: this.toTitleCase(sectionName.replace(/-/g, ' ')),
            content: sectionContent,
            contentType: 'file',
            loadTrigger: this.inferLoadTrigger(sectionContent),
            estimatedTokens: this.estimateTokens(sectionContent),
          });
        }
      }
    } catch (error) {
      // No references directory, that's okay
      if (this.options.verbose) {
        console.log(`[SkillLoader] No references/ directory found`);
      }
    }

    // Build skill plugin
    const skill: SkillPlugin = {
      id: manifest.name.toLowerCase().replace(/\s+/g, '-'),
      name: manifest.name,
      description: manifest.description,
      version: '1.0.0',
      type: manifest.type || 'knowledge',
      core: {
        markdown: content,
        quickStart: this.extractQuickStart(content),
        whenToUse: manifest.whenToUse,
        triggers: manifest.triggers,
      },
      sections: sections.sort((a, b) => (a.priority || 5) - (b.priority || 5)),
      metadata: {
        complexity: manifest.complexity,
        tags: manifest.tags,
        estimatedTokens: manifest.estimatedTokens,
      },
    };

    const duration = Date.now() - startTime;
    if (this.options.verbose) {
      console.log(`[SkillLoader] Skill loaded in ${duration}ms`);
      console.log(`[SkillLoader]   - Core: ${this.estimateTokens(content)} tokens`);
      console.log(`[SkillLoader]   - Sections: ${sections.length}`);
    }

    this.skills.set(skill.id, skill);
    return skill;
  }

  /**
   * Load skill from directory (sync version for simple cases)
   */
  loadSkillSync(skillPath: string): SkillPlugin {
    const { readFileSync } = require('fs');
    const skillFilePath = path.join(skillPath, 'SKILL.md');
    const skillContent = readFileSync(skillFilePath, 'utf-8');

    const { frontmatter, content } = this.parseFrontmatter(skillContent);
    const manifest = this.parseManifest(frontmatter);

    return {
      id: manifest.name.toLowerCase().replace(/\s+/g, '-'),
      name: manifest.name,
      description: manifest.description,
      version: '1.0.0',
      type: manifest.type || 'knowledge',
      core: {
        markdown: content,
        quickStart: this.extractQuickStart(content),
        whenToUse: manifest.whenToUse,
        triggers: manifest.triggers,
      },
      metadata: {
        complexity: manifest.complexity,
        tags: manifest.tags,
        estimatedTime: '5-10 minutes',
        estimatedTokens: manifest.estimatedTokens,
      },
    };
  }

  /**
   * Execute skill with context
   */
  async executeSkill(
    skillId: string,
    context: SkillContext,
    aiCall: (messages: Array<{ role: string; content: string }>) => Promise<string>
  ): Promise<SkillResult> {
    const startTime = Date.now();
    const skill = this.skills.get(skillId);

    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    if (this.options.verbose) {
      console.log(`[SkillLoader] Executing skill: ${skillId}`);
    }

    // Build messages
    const messages: Array<{ role: string; content: string }> = [
      {
        role: 'system',
        content: this.buildSystemPrompt(skill),
      },
    ];

    // Add conversation history
    messages.push(...context.history);

    // Add current user input
    messages.push({
      role: 'user',
      content: context.userInput,
    });

    // Progressive disclosure: check if we need to load more sections
    const sectionsToLoad = this.determineSectionsToLoad(skill, context);
    for (const sectionId of sectionsToLoad) {
      const section = skill.sections?.find(s => s.id === sectionId);
      if (section && !context.loadedSections.has(sectionId)) {
        const content = await this.loadSectionContent(section, skillId);
        messages.push({
          role: 'system',
          content: `\n\n## Additional Reference: ${section.title}\n\n${content}`,
        });
        context.loadedSections.add(sectionId);
      }
    }

    // Call AI
    const response = await aiCall(messages);

    const duration = Date.now() - startTime;
    const tokensUsed = this.estimateTokens(messages.map(m => m.content).join('\n'));

    return {
      success: true,
      response,
      sectionsLoaded: Array.from(context.loadedSections),
      tokensUsed,
      duration,
    };
  }

  /**
   * Get skill by ID
   */
  getSkill(id: string): SkillPlugin | undefined {
    return this.skills.get(id);
  }

  /**
   * List all skills
   */
  listSkills(): SkillPlugin[] {
    return Array.from(this.skills.values());
  }

  /**
   * Find skills by trigger
   */
  findSkillsByTrigger(userInput: string): SkillPlugin[] {
    const input = userInput.toLowerCase();

    return this.listSkills().filter(skill =>
      skill.core.triggers?.some(trigger =>
        input.includes(trigger.toLowerCase())
      ) || false
    );
  }

  /**
   * Find skills by keyword
   */
  findSkillsByKeyword(keywords: string[]): SkillPlugin[] {
    return this.listSkills().filter(skill =>
      skill.metadata?.tags?.some(tag =>
        keywords.some(keyword => tag.toLowerCase().includes(keyword.toLowerCase()))
      ) || false
    );
  }

  /**
   * Parse YAML frontmatter
   */
  protected parseFrontmatter(content: string): { frontmatter: string; content: string } {
    const frontmatterRegex = /^---\n([\s\S]+?)\n---\n([\s\S]+)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return { frontmatter: '', content };
    }

    return {
      frontmatter: match[1],
      content: match[2],
    };
  }

  /**
   * Parse manifest from frontmatter
   */
  protected parseManifest(frontmatter: string): SkillManifest {
    const manifest: any = {};

    // Handle array values (YAML format: - item1, - item2)
    const arrayKeys = ['whenToUse', 'triggers', 'tags'];

    for (const key of arrayKeys) {
      const arrayStart = frontmatter.indexOf(`${key}:`);
      if (arrayStart === -1) continue;

      // Find the end of this array (next key or end of frontmatter)
      let arrayEnd = frontmatter.length;
      const remainingFrontmatter = frontmatter.substring(arrayStart + key.length + 1);
      const nextKeyMatch = remainingFrontmatter.match(/^\n\n([a-z]+)/);
      if (nextKeyMatch) {
        const nextKeyStart = frontmatter.indexOf(nextKeyMatch[0], arrayStart);
        arrayEnd = nextKeyStart;
      }

      const arraySection = frontmatter.substring(arrayStart, arrayEnd);
      const arrayItems: string[] = [];
      const arrayLines = arraySection.split('\n');

      for (const arrayLine of arrayLines) {
        const itemMatch = arrayLine.match(/^\s*-\s*(.+)$/);
        if (itemMatch) {
          arrayItems.push(itemMatch[1].trim());
        }
      }

      manifest[key] = arrayItems;
    }

    // Handle simple key-value pairs (non-array)
    const lines = frontmatter.split('\n');
    for (const line of lines) {
      const match = line.match(/^([a-z]+):\s*(.+)$/i);
      if (match) {
        const key = match[1];
        const value = match[2].trim().replace(/^["']|["']$/g, '');

        // Skip array keys (already handled above)
        if (arrayKeys.includes(key)) {
          continue;
        }

        if (key === 'complexity') {
          manifest[key] = parseInt(value, 10);
        } else {
          manifest[key] = value;
        }
      }
    }

    return manifest;
  }

  /**
   * Extract quick start from content
   */
  protected extractQuickStart(content: string): string | undefined {
    const quickStartRegex = /##\s*Quick\s+Start\n([\s\S]+?)(?=\n##|\n*$)/i;
    const match = content.match(quickStartRegex);

    return match ? match[1].trim() : undefined;
  }

  /**
   * Infer load trigger for a section
   */
  private inferLoadTrigger(content: string): SkillSection['loadTrigger'] {
    // Check for keywords that suggest complexity
    const complexKeywords = ['advanced', 'detailed', 'comprehensive', 'deep dive', 'reference'];
    const hasComplexKeyword = complexKeywords.some(kw =>
      content.toLowerCase().includes(kw)
    );

    if (hasComplexKeyword) {
      return { type: 'complexity', value: 3 };
    }

    // Check for section title hints
    const lines = content.split('\n').slice(0, 5);
    for (const line of lines) {
      if (line.match(/^#+\s*(advanced|detailed|reference)/i)) {
        return { type: 'manual' };
      }
    }

    return { type: 'keyword', value: 'default' };
  }

  /**
   * Determine which sections to load
   */
  private determineSectionsToLoad(skill: SkillPlugin, context: SkillContext): string[] {
    const sectionsToLoad: string[] = [];

    if (!skill.sections) {
      return sectionsToLoad;
    }

    for (const section of skill.sections) {
      // Skip if already loaded
      if (context.loadedSections.has(section.id)) {
        continue;
      }

      // Check trigger conditions
      if (!section.loadTrigger) {
        continue;
      }

      const trigger = section.loadTrigger;

      if (trigger.type === 'manual') {
        // Don't auto-load manual sections
        continue;
      } else if (trigger.type === 'keyword') {
        // Load if keyword matches user input
        if (this.options.autoLoadByKeyword) {
          const input = context.userInput.toLowerCase();
          const keywords = section.content.toLowerCase().split(/\s+/).slice(0, 20);

          for (const keyword of keywords) {
            if (input.includes(keyword) && keyword.length > 4) {
              sectionsToLoad.push(section.id);
              break;
            }
          }
        }
      } else if (trigger.type === 'complexity') {
        // Load if complexity threshold exceeded
        const threshold = (trigger.value as number) || 3;
        if (context.metadata.tokensUsed > threshold * 1000) {
          sectionsToLoad.push(section.id);
        }
      }
    }

    return sectionsToLoad;
  }

  /**
   * Load section content
   */
  private async loadSectionContent(section: SkillSection, skillId: string): Promise<string> {
    const cacheKey = `${skillId}:${section.id}`;

    if (this.options.cacheSections && this.sectionCache.has(cacheKey)) {
      return this.sectionCache.get(cacheKey)!;
    }

    let content: string;

    if (section.contentType === 'inline') {
      content = section.content;
    } else if (section.contentType === 'file') {
      // Already loaded in skill.sections
      content = section.content;
    } else if (section.contentType === 'url') {
      // TODO: Implement URL loading
      content = section.content;
    } else {
      content = section.content;
    }

    if (this.options.cacheSections) {
      this.sectionCache.set(cacheKey, content);
    }

    return content;
  }

  /**
   * Build system prompt from skill
   */
  private buildSystemPrompt(skill: SkillPlugin): string {
    let prompt = `# ${skill.name}\n\n`;

    prompt += `${skill.description}\n\n`;

    if (skill.core.quickStart) {
      prompt += `## Quick Start\n\n${skill.core.quickStart}\n\n`;
    }

    if (skill.core.whenToUse) {
      prompt += `## When to Use This Skill\n\n`;
      prompt += skill.core.whenToUse.map(use => `- ${use}`).join('\n');
      prompt += '\n\n';
    }

    prompt += `## Core Knowledge\n\n${skill.core.markdown}\n`;

    if (skill.instructions?.systemPrompt) {
      prompt += `\n\n${skill.instructions.systemPrompt}`;
    }

    return prompt;
  }

  /**
   * Estimate tokens (rough approximation: 1 token ≈ 4 characters)
   */
  protected estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Convert to title case
   */
  private toTitleCase(str: string): string {
    return str.replace(
      /\w\S*/g,
      txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }
}

/**
 * Create a skill loader instance
 */
export function createSkillLoader(options?: SkillLoaderOptions): SkillLoader {
  return new SkillLoader(options);
}
