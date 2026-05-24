/**
 * Progressive Skill Loader
 * Implements token-efficient progressive loading of skill content
 *
 * Key features:
 * - Load core knowledge always (0-2k tokens)
 * - Load reference sections on-demand (2-8k tokens)
 * - Token budget management
 * - Complexity-based loading
 * - Section caching
 */

import fs from 'fs/promises';
import path from 'path';
import {
  AnySkill,
  SkillReference,
  ProgressiveLoadingOptions,
  SkillComplexity,
} from './types';
import { estimateTokens } from './tokens';
import { SectionCache } from './cache';
import { analyzeComplexity } from './complexity';

export interface LoadResult {
  content: string; // Combined content
  sectionsLoaded: string[]; // Sections that were loaded
  tokensUsed: number; // Total tokens used
  cacheHits: number; // Number of cache hits
  remainingBudget: number; // Remaining token budget
}

export interface LoadStrategy {
  loadCore: boolean; // Always load core content
  loadReferences: string[]; // Reference sections to load
  maxTokens: number; // Maximum tokens to use
}

/**
 * Progressive Skill Loader
 */
export class ProgressiveSkillLoader {
  private cache: SectionCache;
  private defaultMaxTokens: number;

  constructor(options?: { maxTokens?: number }) {
    this.cache = new SectionCache();
    this.defaultMaxTokens = options?.maxTokens || 8000;
  }

  /**
   * Load skill content progressively based on options
   */
  async loadSkill(
    skill: AnySkill,
    options: ProgressiveLoadingOptions = {}
  ): Promise<LoadResult> {
    const {
      maxTokens = this.defaultMaxTokens,
      complexity,
      sections: forcedSections,
    } = options;

    let content = '';
    let tokensUsed = 0;
    let cacheHits = 0;
    const sectionsLoaded: string[] = [];

    // Step 1: Always load core content
    const coreResult = await this.loadCore(skill);
    content += coreResult.content;
    tokensUsed += coreResult.tokens;
    cacheHits += coreResult.cacheHit ? 1 : 0;
    sectionsLoaded.push('core');

    // Step 2: Determine which reference sections to load
    const loadStrategy = this.determineLoadStrategy(
      skill,
      tokensUsed,
      maxTokens,
      complexity,
      forcedSections
    );

    // Step 3: Load reference sections progressively
    for (const sectionName of loadStrategy.loadReferences) {
      // Check if we have budget
      if (tokensUsed >= maxTokens) {
        break;
      }

      const sectionResult = await this.loadSection(skill, sectionName);
      const sectionTokens = sectionResult.tokens;

      // Check if loading this section would exceed budget
      if (tokensUsed + sectionTokens > maxTokens) {
        // Try to load a truncated version
        const truncated = this.truncateContent(
          sectionResult.content,
          maxTokens - tokensUsed
        );

        if (truncated.length > 0) {
          content += '\n\n' + truncated;
          tokensUsed += estimateTokens(truncated);
          sectionsLoaded.push(`${sectionName} (truncated)`);
        }

        break;
      }

      // Load full section
      content += '\n\n' + sectionResult.content;
      tokensUsed += sectionTokens;
      cacheHits += sectionResult.cacheHit ? 1 : 0;
      sectionsLoaded.push(sectionName);
    }

    // Step 4: Add section headers for clarity
    content = this.formatContent(content, sectionsLoaded);

    return {
      content,
      sectionsLoaded,
      tokensUsed,
      cacheHits,
      remainingBudget: maxTokens - tokensUsed,
    };
  }

  /**
   * Load core skill content (SKILL.md body)
   */
  private async loadCore(skill: AnySkill): Promise<{
    content: string;
    tokens: number;
    cacheHit: boolean;
  }> {
    const cacheKey = `${skill.id}:core`;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return {
        content: cached.content,
        tokens: cached.tokens,
        cacheHit: true,
      };
    }

    const content = skill.content;
    const tokens = estimateTokens(content);

    this.cache.set(cacheKey, {
      name: 'core',
      path: '',
      content,
      tokens,
    });

    return {
      content,
      tokens,
      cacheHit: false,
    };
  }

  /**
   * Load a specific reference section
   */
  async loadSection(
    skill: AnySkill,
    sectionName: string
  ): Promise<{
    content: string;
    tokens: number;
    cacheHit: boolean;
  }> {
    const cacheKey = `${skill.id}:${sectionName}`;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return {
        content: cached.content,
        tokens: cached.tokens,
        cacheHit: true,
      };
    }

    // Load from disk
    const sectionPath = path.join(
      skill.path,
      'references',
      `${sectionName}.md`
    );

    try {
      const content = await fs.readFile(sectionPath, 'utf-8');
      const tokens = estimateTokens(content);

      // Cache the section
      this.cache.set(cacheKey, {
        name: sectionName,
        path: sectionPath,
        content,
        tokens,
      });

      return {
        content,
        tokens,
        cacheHit: false,
      };
    } catch (error) {
      // Section doesn't exist
      return {
        content: `# ${sectionName}\n\n*Section not available*`,
        tokens: estimateTokens(`# ${sectionName}\n\n*Section not available*`),
        cacheHit: false,
      };
    }
  }

  /**
   * Determine load strategy based on complexity and budget
   */
  private determineLoadStrategy(
    skill: AnySkill,
    currentTokens: number,
    maxTokens: number,
    forcedComplexity?: SkillComplexity,
    forcedSections?: string[]
  ): LoadStrategy {
    // If specific sections are forced, load only those
    if (forcedSections && forcedSections.length > 0) {
      return {
        loadCore: true,
        loadReferences: forcedSections,
        maxTokens,
      };
    }

    // Determine effective complexity
    const effectiveComplexity =
      forcedComplexity || skill.metadata.complexity || analyzeComplexity(skill);

    // Calculate remaining budget
    const remainingBudget = maxTokens - currentTokens;

    // Decide which sections to load based on complexity
    const loadReferences: string[] = [];

    // Get available reference sections
    const availableSections = Array.from(skill.references.keys()).sort();

    if (effectiveComplexity <= 3) {
      // Low complexity: Load basics only
      if (availableSections.includes('basics')) {
        loadReferences.push('basics');
      }
    } else if (effectiveComplexity <= 6) {
      // Medium complexity: Load basics + one more
      if (availableSections.includes('basics')) {
        loadReferences.push('basics');
      }

      // Add next most relevant section
      const nextSection = availableSections.find(
        s => s !== 'basics' && !loadReferences.includes(s)
      );

      if (nextSection && estimateTokens(skill.references.get(nextSection)?.content || '') < remainingBudget) {
        loadReferences.push(nextSection);
      }
    } else {
      // High complexity: Load all available sections
      for (const section of availableSections) {
        const sectionTokens = estimateTokens(
          skill.references.get(section)?.content || ''
        );

        if (currentTokens + sectionTokens <= maxTokens) {
          loadReferences.push(section);
        }
      }
    }

    return {
      loadCore: true,
      loadReferences,
      maxTokens,
    };
  }

  /**
   * Truncate content to fit token budget
   */
  private truncateContent(content: string, maxTokens: number): string {
    const targetChars = maxTokens * 4; // Rough estimate: 1 token ≈ 4 chars

    if (content.length <= targetChars) {
      return content;
    }

    // Truncate and add indicator
    return (
      content.substring(0, targetChars) +
      '\n\n[Content truncated due to token limit]'
    );
  }

  /**
   * Format content with section headers
   */
  private formatContent(content: string, sectionsLoaded: string[]): string {
    // Add header indicating which sections were loaded
    const header = `<!-- Sections loaded: ${sectionsLoaded.join(', ')} -->\n\n`;

    return header + content;
  }

  /**
   * Preload specific sections into cache
   */
  async preloadSections(
    skill: AnySkill,
    sections: string[]
  ): Promise<void> {
    for (const section of sections) {
      await this.loadSection(skill, section);
    }
  }

  /**
   * Clear cache for a specific skill
   */
  clearSkillCache(skillId: string): void {
    this.cache.clearSkill(skillId);
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    return this.cache.getStats();
  }
}

/**
 * Create a progressive loader instance
 */
export function createLoader(options?: { maxTokens?: number }): ProgressiveSkillLoader {
  return new ProgressiveSkillLoader(options);
}

/**
 * Load skill with automatic complexity detection
 */
export async function loadSkillProgressively(
  skill: AnySkill,
  options: ProgressiveLoadingOptions = {}
): Promise<LoadResult> {
  const loader = new ProgressiveSkillLoader(options);
  return loader.loadSkill(skill, options);
}
