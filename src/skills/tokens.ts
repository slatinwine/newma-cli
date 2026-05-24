/**
 * Token Estimation and Management
 * Provides utilities for estimating token usage and optimizing content
 */

/**
 * Estimate token count for text
 * Rough estimate: 1 token ≈ 4 characters
 * This is a simplified approximation. For accurate counts, use tiktoken or similar.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // Remove extra whitespace
  const cleaned = text.trim().replace(/\s+/g, ' ');

  // Rough estimate: 1 token ≈ 4 characters
  // This works reasonably well for English text
  return Math.ceil(cleaned.length / 4);
}

/**
 * Estimate token count for markdown
 * Markdown formatting uses fewer tokens than raw characters suggest
 */
export function estimateMarkdownTokens(markdown: string): number {
  if (!markdown) return 0;

  // Remove markdown syntax that doesn't contribute much to tokens
  const cleaned = markdown
    // Remove headers (#)
    .replace(/^#+\s+/gm, '')
    // Remove bold/italic (**, *, __, _)
    .replace(/\*\*\*?\*\*?|__?_?/g, '')
    // Remove links ([text](url))
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, 'code block')
    .replace(/`([^`]+)`/g, '$1')
    // Remove lists
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();

  return estimateTokens(cleaned);
}

/**
 * Estimate token count for JSON
 */
export function estimateJsonTokens(json: any): number {
  const text = typeof json === 'string' ? json : JSON.stringify(json);
  return estimateTokens(text);
}

/**
 * Check if content fits within token budget
 */
export function fitsInBudget(content: string, budget: number): boolean {
  const tokens = estimateTokens(content);
  return tokens <= budget;
}

/**
 * Truncate content to fit token budget
 */
export function truncateToFit(content: string, maxTokens: number): string {
  const currentTokens = estimateTokens(content);

  if (currentTokens <= maxTokens) {
    return content;
  }

  // Calculate target character count
  const targetChars = maxTokens * 4;

  if (content.length <= targetChars) {
    return content;
  }

  // Truncate and add indicator
  return content.substring(0, targetChars) + '\n\n[Content truncated due to token limit]';
}

/**
 * Optimize content for token usage
 * Removes unnecessary formatting, whitespace, etc.
 */
export function optimizeContent(content: string): string {
  return content
    // Remove multiple consecutive blank lines
    .replace(/\n{3,}/g, '\n\n')
    // Remove trailing whitespace on lines
    .replace(/[ \t]+$/gm, '')
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .trim();
}

/**
 * Calculate token savings from optimization
 */
export function calculateSavings(content: string): {
  original: number;
  optimized: number;
  saved: number;
  percentage: number;
} {
  const original = estimateTokens(content);
  const optimized = estimateTokens(optimizeContent(content));
  const saved = original - optimized;
  const percentage = original > 0 ? (saved / original) * 100 : 0;

  return { original, optimized, saved, percentage };
}

/**
 * Estimate token count for a skill
 */
export function estimateSkillTokens(skill: {
  content: string;
  references: Map<string, { content: string }>;
}): {
  core: number;
  references: Record<string, number>;
  total: number;
} {
  const core = estimateMarkdownTokens(skill.content);
  const references: Record<string, number> = {};
  let total = core;

  for (const [name, ref] of skill.references.entries()) {
    const tokens = estimateMarkdownTokens(ref.content);
    references[name] = tokens;
    total += tokens;
  }

  return { core, references, total };
}

/**
 * Calculate optimal load order for sections
 * Returns sections ordered by importance (tokens/complexity ratio)
 */
export function calculateLoadOrder(sections: Array<{
  name: string;
  tokens: number;
  priority: number; // 1-10, higher is more important
}>): string[] {
  // Calculate score: priority / tokens
  // This prioritizes high-priority, low-token sections
  const scored = sections.map(section => ({
    ...section,
    score: section.priority / section.tokens,
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored.map(s => s.name);
}

/**
 * Token budget manager
 */
export class TokenBudget {
  private budget: number;
  private used: number;

  constructor(budget: number) {
    this.budget = budget;
    this.used = 0;
  }

  /**
   * Check if content can be added to budget
   */
  canAdd(content: string): boolean {
    const tokens = estimateTokens(content);
    return this.used + tokens <= this.budget;
  }

  /**
   * Try to add content to budget
   * Returns true if successful, false otherwise
   */
  tryAdd(content: string): boolean {
    if (!this.canAdd(content)) {
      return false;
    }

    const tokens = estimateTokens(content);
    this.used += tokens;
    return true;
  }

  /**
   * Add content to budget, truncating if necessary
   */
  add(content: string): string {
    const tokens = estimateTokens(content);

    if (this.used + tokens <= this.budget) {
      this.used += tokens;
      return content;
    }

    // Truncate to fit
    const remaining = this.budget - this.used;
    const targetChars = remaining * 4;
    const truncated = content.substring(0, targetChars) +
      '\n\n[Content truncated due to token limit]';

    this.used = this.budget;
    return truncated;
  }

  /**
   * Get remaining budget
   */
  getRemaining(): number {
    return this.budget - this.used;
  }

  /**
   * Get used tokens
   */
  getUsed(): number {
    return this.used;
  }

  /**
   * Get total budget
   */
  getTotal(): number {
    return this.budget;
  }

  /**
   * Get usage percentage
   */
  getUsagePercentage(): number {
    return (this.used / this.budget) * 100;
  }

  /**
   * Reset budget
   */
  reset(): void {
    this.used = 0;
  }

  /**
   * Check if budget is exhausted
   */
  isExhausted(): boolean {
    return this.used >= this.budget;
  }
}

/**
 * Create a token budget manager
 */
export function createTokenBudget(budget: number): TokenBudget {
  return new TokenBudget(budget);
}

/**
 * Analyze token efficiency of content
 */
export function analyzeTokenEfficiency(content: string): {
  total: number;
  whitespace: number;
  formatting: number;
  actual: number;
  efficiency: number; // percentage of meaningful tokens
} {
  const total = estimateTokens(content);

  // Count whitespace tokens
  const whitespace = estimateTokens(content.replace(/[^\s]/g, ''));

  // Count formatting tokens (markdown, etc.)
  const formatting = estimateTokens(
    content.replace(/[^\#`\*\[\]_\(\)\-]/g, '')
  );

  // Actual content tokens
  const actual = total - whitespace - formatting;

  // Efficiency: actual / total
  const efficiency = total > 0 ? (actual / total) * 100 : 0;

  return { total, whitespace, formatting, actual, efficiency };
}

/**
 * Get token usage statistics for multiple skills
 */
export function getSkillsTokenStats(skills: Array<{
  id: string;
  content: string;
  references: Map<string, { content: string }>;
}>): Array<{
  skillId: string;
  core: number;
  references: number;
  total: number;
}> {
  return skills.map(skill => {
    const estimate = estimateSkillTokens(skill);
    const referencesTotal = Object.values(estimate.references).reduce((a, b) => a + b, 0);

    return {
      skillId: skill.id,
      core: estimate.core,
      references: referencesTotal,
      total: estimate.total,
    };
  });
}

/**
 * Recommend token budget based on skills
 */
export function recommendBudget(skills: Array<{
  complexity: number;
  content: string;
  references: Map<string, { content: string }>;
}>): {
  minimum: number;
  recommended: number;
  comfortable: number;
} {
  // Calculate average token usage
  const estimates = skills.map(s => estimateSkillTokens(s));
  const avgCore = estimates.reduce((a, b) => a + b.core, 0) / estimates.length;
  const avgTotal = estimates.reduce((a, b) => a + b.total, 0) / estimates.length;

  // Calculate based on complexity
  const avgComplexity = skills.reduce((a, b) => a + b.complexity, 0) / skills.length;

  // Minimum: core content + 1 reference
  const minimum = Math.ceil(avgCore + avgTotal * 0.3);

  // Recommended: core + 2-3 references
  const recommended = Math.ceil(avgCore + avgTotal * 0.6);

  // Comfortable: all content
  const comfortable = Math.ceil(avgTotal * 1.2); // 20% buffer

  return { minimum, recommended, comfortable };
}
