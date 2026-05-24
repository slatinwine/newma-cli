/**
 * Auto Skill Manager
 *
 * Automatically discovers, loads, and selects skills based on user input.
 * Integrates with AI module to provide skill-enhanced responses.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { SkillLoader, SkillContext } from './skill-loader';
import { SkillPlugin } from './skill-types';

/**
 * Auto skill manager configuration
 */
export interface AutoSkillConfig {
  /** Directories to scan for skills */
  skillDirectories: string[];

  /** Auto-load skills on startup */
  autoLoad: boolean;

  /** Auto-select skills based on triggers */
  autoSelect: boolean;

  /** Maximum skills to load initially */
  maxInitialSkills: number;

  /** Verbose logging */
  verbose: boolean;
}

/**
 * Skill match result
 */
export interface SkillMatch {
  /** Skill that matched */
  skill: SkillPlugin;

  /** Match score (0-1) */
  score: number;

  /** Matched triggers */
  matchedTriggers: string[];

  /** Match reason */
  reason: string;
}

/**
 * Auto skill manager
 */
export class AutoSkillManager {
  private skillLoader: SkillLoader;
  private skills: Map<string, SkillPlugin> = new Map();
  private config: AutoSkillConfig;
  private loaded: boolean = false;

  constructor(config: Partial<AutoSkillConfig> = {}) {
    this.config = {
      skillDirectories: config.skillDirectories || [
        path.join(process.cwd(), '.kode/skills'),
        path.join(process.cwd(), 'examples/skills'),
        path.join(process.cwd(), 'skills'),
      ],
      autoLoad: config.autoLoad ?? true,
      autoSelect: config.autoSelect ?? true,
      maxInitialSkills: config.maxInitialSkills || 100,
      verbose: config.verbose || false,
    };

    this.skillLoader = new SkillLoader({
      progressiveDisclosure: true,
      autoLoadByKeyword: true,
      cacheSections: true,
      verbose: this.config.verbose,
    });
  }

  /**
   * Initialize - scan and load skills
   */
  async initialize(): Promise<void> {
    if (this.loaded) {
      return;
    }

    if (this.config.verbose) {
      console.log('[AutoSkillManager] Initializing...');
      console.log(`  Scanning directories: ${this.config.skillDirectories.join(', ')}`);
    }

    // Scan directories for skills
    for (const dir of this.config.skillDirectories) {
      await this.scanDirectory(dir);
    }

    this.loaded = true;

    if (this.config.verbose) {
      console.log(`[AutoSkillManager] Loaded ${this.skills.size} skills`);
      this.skills.forEach((skill) => {
        console.log(`  - ${skill.name} (${skill.id})`);
        if (skill.core.triggers && skill.core.triggers.length > 0) {
          console.log(`    Triggers: ${skill.core.triggers.join(', ')}`);
        }
      });
    }
  }

  /**
   * Scan directory for skills
   */
  private async scanDirectory(dir: string): Promise<void> {
    try {
      const stat = await fs.stat(dir);
      if (!stat.isDirectory()) {
        return;
      }
    } catch {
      // Directory doesn't exist, skip
      return;
    }

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(dir, entry.name);
        const skillFile = path.join(skillPath, 'SKILL.md');

        try {
          await fs.access(skillFile);
          // Found a skill, load it
          const skill = await this.skillLoader.loadSkill(skillPath);
          this.skills.set(skill.id, skill);

          if (this.config.verbose) {
            console.log(`[AutoSkillManager] Found skill: ${skill.name}`);
          }
        } catch {
          // Not a skill directory, skip
        }
      }
    }
  }

  /**
   * Find matching skills for user input
   */
  findSkills(userInput: string): SkillMatch[] {
    const matches: SkillMatch[] = [];
    const input = userInput.toLowerCase();

    for (const skill of this.skills.values()) {
      let score = 0;
      const matchedTriggers: string[] = [];

      // Check triggers
      if (skill.core.triggers) {
        for (const trigger of skill.core.triggers) {
          if (input.includes(trigger.toLowerCase())) {
            score += 0.3;
            matchedTriggers.push(trigger);
          }
        }
      }

      // Check tags
      if (skill.metadata?.tags) {
        for (const tag of skill.metadata.tags) {
          if (input.includes(tag.toLowerCase())) {
            score += 0.2;
          }
        }
      }

      // Check name
      if (input.includes(skill.name.toLowerCase())) {
        score += 0.1;
      }

      // Check description
      if (input.includes(skill.description.toLowerCase().split(' ')[0])) {
        score += 0.1;
      }

      if (score > 0) {
        matches.push({
          skill,
          score,
          matchedTriggers,
          reason: `Matched ${matchedTriggers.length} triggers`,
        });
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    // Return only matches with score > 0.3 (at least one trigger)
    return matches.filter(m => m.score >= 0.3);
  }

  /**
   * Get best matching skill
   */
  getBestSkill(userInput: string): SkillPlugin | null {
    const matches = this.findSkills(userInput);
    return matches.length > 0 ? matches[0].skill : null;
  }

  /**
   * Build AI prompt with skill
   */
  async buildPromptWithSkill(
    userInput: string,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<Array<{ role: string; content: string }>> {
    await this.initialize();

    const messages: Array<{ role: string; content: string }> = [];

    // Find matching skill
    const bestSkill = this.getBestSkill(userInput);

    if (bestSkill) {
      if (this.config.verbose) {
        console.log(`[AutoSkillManager] Using skill: ${bestSkill.name}`);
      }

      // Build system prompt with skill
      const systemPrompt = this.buildSystemPrompt(bestSkill);
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    } else {
      if (this.config.verbose) {
        console.log('[AutoSkillManager] No matching skill found, using default');
      }

      // Default system prompt
      messages.push({
        role: 'system',
        content: this.getDefaultSystemPrompt(),
      });
    }

    // Add conversation history
    messages.push(...conversationHistory);

    // Add current user input
    messages.push({
      role: 'user',
      content: userInput,
    });

    return messages;
  }

  /**
   * Build system prompt from skill
   */
  private buildSystemPrompt(skill: SkillPlugin): string {
    let prompt = `# ${skill.name}\n\n`;
    prompt += `${skill.description}\n\n`;

    if (skill.core.quickStart) {
      prompt += `## Quick Start\n${skill.core.quickStart}\n\n`;
    }

    if (skill.core.whenToUse && skill.core.whenToUse.length > 0) {
      prompt += `## When to Use This Skill\n`;
      prompt += skill.core.whenToUse.map(use => `- ${use}`).join('\n');
      prompt += '\n\n';
    }

    prompt += `## Core Knowledge\n${skill.core.markdown}\n`;

    return prompt;
  }

  /**
   * Get default system prompt (when no skill matches)
   */
  private getDefaultSystemPrompt(): string {
    return `You are Kode, an AI programming assistant. Help users with their coding tasks.`;
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
   * Get skill statistics
   */
  getStats() {
    return {
      total: this.skills.size,
      withTriggers: Array.from(this.skills.values()).filter(s => s.core.triggers && s.core.triggers.length > 0).length,
      types: {
        knowledge: Array.from(this.skills.values()).filter(s => s.type === 'knowledge').length,
        code: Array.from(this.skills.values()).filter(s => s.type === 'code').length,
        hybrid: Array.from(this.skills.values()).filter(s => s.type === 'hybrid').length,
      },
    };
  }
}

/**
 * Create auto skill manager
 */
export function createAutoSkillManager(config?: Partial<AutoSkillConfig>): AutoSkillManager {
  return new AutoSkillManager(config);
}
