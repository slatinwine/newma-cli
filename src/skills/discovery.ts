/**
 * Skill Discovery System
 * Handles trigger-based skill discovery, scoring, and ranking
 */

import {
  AnySkill,
  SkillMatch,
  SkillDiscoveryOptions,
  SkillMetadata,
} from './types';

/**
 * Calculate word overlap similarity (Jaccard index)
 */
export function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;

  return intersection.size / union.size;
}

/**
 * Check if any trigger matches the input
 */
export function matchTriggers(skill: SkillMetadata, input: string): number {
  const normalizedInput = input.toLowerCase();
  let matches = 0;

  for (const trigger of skill.triggers) {
    if (normalizedInput.includes(trigger.toLowerCase())) {
      matches++;
    }
  }

  return matches;
}

/**
 * Check if any keyword matches the input
 */
export function matchKeywords(skill: SkillMetadata, input: string): boolean {
  const normalizedInput = input.toLowerCase();

  return skill.keywords.some(keyword =>
    normalizedInput.includes(keyword.toLowerCase())
  );
}

/**
 * Check if any tag matches the input
 */
export function matchTags(skill: SkillMetadata, input: string): number {
  const normalizedInput = input.toLowerCase();
  let matches = 0;

  for (const tag of skill.tags) {
    if (normalizedInput.includes(tag.toLowerCase())) {
      matches++;
    }
  }

  return matches;
}

/**
 * Check if skill name matches the input
 */
export function matchName(skill: SkillMetadata, input: string): boolean {
  const normalizedInput = input.toLowerCase();
  const normalizedName = skill.name.toLowerCase();

  return normalizedInput.includes(normalizedName) || normalizedName.includes(normalizedInput);
}

/**
 * Calculate skill match score
 * Returns a score from 0-100 based on match quality
 */
export function calculateSkillScore(
  skill: SkillMetadata,
  input: string
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // High-weight matches

  // Trigger matches (40 points each)
  const triggerMatches = matchTriggers(skill, input);
  if (triggerMatches > 0) {
    const triggerScore = triggerMatches * 40;
    score += triggerScore;
    reasons.push(`Matches ${triggerMatches} trigger(s): ${skill.triggers.slice(0, triggerMatches).join(', ')}`);
  }

  // Name match (50 points)
  if (matchName(skill, input)) {
    score += 50;
    reasons.push(`Name matches: "${skill.name}"`);
  }

  // Keyword matches (30 points each)
  if (skill.keywords && skill.keywords.length > 0) {
    const keywordMatches = skill.keywords.filter(kw =>
      input.toLowerCase().includes(kw.toLowerCase())
    ).length;

    if (keywordMatches > 0) {
      score += keywordMatches * 30;
      reasons.push(`Matches ${keywordMatches} keyword(s)`);
    }
  }

  // Medium-weight matches

  // Tag matches (20 points each)
  const tagMatches = matchTags(skill, input);
  if (tagMatches > 0) {
    score += tagMatches * 20;
    reasons.push(`Matches ${tagMatches} tag(s): ${skill.tags.slice(0, tagMatches).join(', ')}`);
  }

  // Low-weight matches

  // Semantic similarity (0-30 points)
  const similarity = calculateSimilarity(input, skill.description);
  if (similarity > 0.3) {
    const similarityScore = Math.round(similarity * 30);
    score += similarityScore;
    reasons.push(`Description similarity: ${Math.round(similarity * 100)}%`);
  }

  // Complexity boost (prefer simpler skills for simple tasks)
  const inputComplexity = estimateInputComplexity(input);
  if (skill.complexity <= inputComplexity + 2) {
    score += 10;
    reasons.push(`Complexity appropriate (${skill.complexity} for input ~${inputComplexity})`);
  }

  return { score, reasons };
}

/**
 * Estimate input complexity (1-10)
 */
export function estimateInputComplexity(input: string): number {
  let complexity = 1;

  // Word count (more words = more complex)
  const words = input.split(/\s+/).length;
  if (words > 10) complexity += 1;
  if (words > 20) complexity += 1;
  if (words > 50) complexity += 1;

  // Technical keywords increase complexity
  const technicalKeywords = [
    'api', 'database', 'authentication', 'authorization', 'integration',
    'architecture', 'refactor', 'optimize', 'performance', 'security',
    'deployment', 'testing', 'validation', 'schema', 'protocol'
  ];

  const technicalCount = technicalKeywords.filter(kw =>
    input.toLowerCase().includes(kw)
  ).length;

  complexity += Math.min(technicalCount, 3);

  // Question marks indicate questions (lower complexity)
  if (input.includes('?')) {
    complexity = Math.max(1, complexity - 1);
  }

  // Multiple steps indicated
  if (input.includes(' and ') || input.includes(' then ') || input.includes(' after ')) {
    complexity += 1;
  }

  return Math.min(10, Math.max(1, complexity));
}

/**
 * Find relevant skills based on user input
 */
export function findRelevantSkills(
  skills: AnySkill[],
  input: string,
  options: {
    maxResults?: number;
    minScore?: number;
    types?: string[];
  } = {}
): SkillMatch[] {
  const {
    maxResults = 5,
    minScore = 30,
    types = [],
  } = options;

  // Score all skills
  const scored = skills.map(skill => {
    const { score, reasons } = calculateSkillScore(skill.metadata, input);
    return { skill, score, reasons };
  });

  // Filter by type if specified
  let filtered = scored;
  if (types.length > 0) {
    filtered = filtered.filter(s => types.includes(s.skill.metadata.type));
  }

  // Filter by minimum score
  const aboveThreshold = filtered.filter(s => s.score >= minScore);

  // Sort by score descending
  aboveThreshold.sort((a, b) => b.score - a.score);

  // Return top N
  return aboveThreshold.slice(0, maxResults).map(s => ({
    skill: s.skill,
    score: s.score,
    reasons: s.reasons,
  }));
}

/**
 * Discover skills from search paths
 */
export async function discoverSkills(
  options: SkillDiscoveryOptions
): Promise<AnySkill[]> {
  // This would be implemented to scan directories for SKILL.md files
  // For now, return empty array
  // Implementation would:
  // 1. Scan each searchPath for directories
  // 2. Check if directory contains SKILL.md
  // 3. Load metadata from SKILL.md
  // 4. Return array of skills

  return [];
}

/**
 * Get skill suggestions based on partial input
 */
export function getSkillSuggestions(
  skills: AnySkill[],
  partialInput: string,
  maxSuggestions: number = 5
): Array<{ skill: AnySkill; suggestion: string }> {
  const matches = findRelevantSkills(skills, partialInput, {
    maxResults: maxSuggestions,
    minScore: 20, // Lower threshold for suggestions
  });

  return matches.map(match => ({
    skill: match.skill,
    suggestion: `Use "${match.skill.metadata.name}" for ${match.skill.metadata.description.toLowerCase()}`,
  }));
}

/**
 * Analyze skill compatibility
 */
export function analyzeSkillCompatibility(
  skill: AnySkill,
  context: {
    platform: string;
    nodeVersion: string;
    availablePackages: string[];
  }
): { compatible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  let compatible = true;

  // Check platform compatibility
  if (skill.metadata.compatibility?.platform) {
    if (!skill.metadata.compatibility.platform.includes(context.platform)) {
      compatible = false;
      reasons.push(`Platform ${context.platform} not supported (requires: ${skill.metadata.compatibility.platform.join(', ')})`);
    }
  }

  // Check Node version compatibility
  if (skill.metadata.compatibility?.nodeVersion) {
    // Simple version check (would use semver in production)
    const requiredVersion = skill.metadata.compatibility.nodeVersion.replace('>=', '');
    const [requiredMajor] = requiredVersion.split('.');
    const [currentMajor] = context.nodeVersion.split('.');

    if (parseInt(currentMajor) < parseInt(requiredMajor)) {
      compatible = false;
      reasons.push(`Node version ${context.nodeVersion} too old (requires: ${skill.metadata.compatibility.nodeVersion})`);
    }
  }

  // Check dependencies
  if (skill.metadata.compatibility?.dependencies) {
    for (const dep of skill.metadata.compatibility.dependencies) {
      if (!context.availablePackages.includes(dep)) {
        compatible = false;
        reasons.push(`Missing dependency: ${dep}`);
      }
    }
  }

  return { compatible, reasons };
}
