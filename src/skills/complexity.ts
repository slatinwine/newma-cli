/**
 * Complexity Analysis
 * Analyzes and estimates skill complexity for progressive loading decisions
 */

import { AnySkill, SkillComplexity } from './types';
import { estimateTokens } from './tokens';

/**
 * Analyze complexity from skill metadata
 */
export function analyzeMetadataComplexity(skill: AnySkill): number {
  let complexity = skill.metadata.complexity || 5;

  // Adjust based on factors

  // Type adjustment
  if (skill.metadata.type === 'knowledge') {
    complexity -= 1; // Knowledge skills are simpler
  } else if (skill.metadata.type === 'hybrid') {
    complexity += 1; // Hybrid skills are more complex
  }

  // Category adjustment
  const complexCategories = ['integration', 'architecture', 'security'];
  if (complexCategories.includes(skill.metadata.category)) {
    complexity += 1;
  }

  // Tag count (more tags = broader scope = potentially more complex)
  if (skill.metadata.tags.length > 5) {
    complexity += 1;
  }

  // Trigger count (more triggers = more use cases)
  if (skill.metadata.triggers.length > 5) {
    complexity += 1;
  }

  // Clamp to 1-10 range
  return Math.max(1, Math.min(10, complexity));
}

/**
 * Analyze complexity from content
 */
export function analyzeContentComplexity(skill: AnySkill): number {
  const coreTokens = estimateTokens(skill.content);

  // Base complexity from content length
  let complexity = 1;

  if (coreTokens > 500) complexity += 1;
  if (coreTokens > 1000) complexity += 1;
  if (coreTokens > 2000) complexity += 1;
  if (coreTokens > 4000) complexity += 1;

  // Reference sections
  const refCount = skill.references.size;
  if (refCount > 0) complexity += 1;
  if (refCount > 2) complexity += 1;
  if (refCount > 4) complexity += 1;

  // Code indicators (for code/hybrid skills)
  if (skill.metadata.type === 'code' || skill.metadata.type === 'hybrid') {
    const codeIndicators = ['function', 'class', 'interface', 'async', 'await'];
    const codeCount = codeIndicators.reduce((count, indicator) => {
      return count + (skill.content.match(new RegExp(indicator, 'gi')) || []).length;
    }, 0);

    if (codeCount > 5) complexity += 1;
    if (codeCount > 20) complexity += 2;
  }

  return Math.max(1, Math.min(10, complexity));
}

/**
 * Analyze complexity from input string (user request)
 */
export function analyzeInputComplexity(input: string): number {
  let complexity = 1;

  // Word count
  const words = input.split(/\s+/).length;
  if (words > 10) complexity += 1;
  if (words > 20) complexity += 1;
  if (words > 50) complexity += 1;

  // Technical keywords increase complexity
  const technicalKeywords = [
    'api', 'database', 'authentication', 'authorization', 'integration',
    'architecture', 'refactor', 'optimize', 'performance', 'security',
    'deployment', 'testing', 'validation', 'schema', 'protocol',
    'microservice', 'distributed', 'scalability', 'async', 'concurrent'
  ];

  const techCount = technicalKeywords.filter(kw =>
    input.toLowerCase().includes(kw)
  ).length;

  complexity += Math.min(techCount, 3);

  // Multiple operations indicated
  const multiOpIndicators = [' and ', ' then ', ' after ', ' followed by ', ' plus '];
  const multiOpCount = multiOpIndicators.reduce((count, indicator) => {
    return count + (input.toLowerCase().match(new RegExp(indicator, 'g')) || []).length;
  }, 0);

  complexity += Math.min(multiOpCount, 2);

  // Question marks indicate questions (lower complexity)
  if (input.includes('?')) {
    complexity = Math.max(1, complexity - 1);
  }

  // Exclamation marks indicate emphasis (maybe lower complexity)
  if (input.includes('!')) {
    complexity = Math.max(1, complexity - 1);
  }

  // Commas and conjunctions indicate complexity (multiple clauses)
  const complexGrammar = (input.match(/,/g) || []).length +
                         (input.match(/\b(but|however|although|because|therefore)\b/gi) || []).length;

  if (complexGrammar > 2) complexity += 1;

  return Math.max(1, Math.min(10, complexity));
}

/**
 * Analyze overall skill complexity
 * Combines metadata, content, and reference analysis
 */
export function analyzeComplexity(skill: AnySkill): SkillComplexity {
  const metadataComplexity = analyzeMetadataComplexity(skill);
  const contentComplexity = analyzeContentComplexity(skill);

  // Weighted average (metadata 40%, content 60%)
  const overall = Math.round(
    (metadataComplexity * 0.4 + contentComplexity * 0.6)
  );

  return Math.max(1, Math.min(10, overall)) as SkillComplexity;
}

/**
 * Compare complexity of two skills
 */
export function compareComplexity(skill1: AnySkill, skill2: AnySkill): {
  skill1: number;
  skill2: number;
  difference: number;
  simpler: AnySkill;
} {
  const complexity1 = analyzeComplexity(skill1);
  const complexity2 = analyzeComplexity(skill2);
  const difference = Math.abs(complexity1 - complexity2);

  return {
    skill1: complexity1,
    skill2: complexity2,
    difference,
    simpler: complexity1 < complexity2 ? skill1 : skill2,
  };
}

/**
 * Get complexity level description
 */
export function getComplexityLevel(complexity: number): {
  level: 'very-low' | 'low' | 'medium' | 'high' | 'very-high';
  description: string;
  color: string;
} {
  if (complexity <= 2) {
    return {
      level: 'very-low',
      description: 'Simple, straightforward task',
      color: 'green',
    };
  }

  if (complexity <= 4) {
    return {
      level: 'low',
      description: 'Relatively simple task',
      color: 'blue',
    };
  }

  if (complexity <= 6) {
    return {
      level: 'medium',
      description: 'Moderately complex task',
      color: 'yellow',
    };
  }

  if (complexity <= 8) {
    return {
      level: 'high',
      description: 'Complex task requiring expertise',
      color: 'orange',
    };
  }

  return {
    level: 'very-high',
    description: 'Very complex task requiring deep expertise',
    color: 'red',
  };
}

/**
 * Estimate sections to load based on complexity
 */
export function estimateSectionsToLoad(
  skill: AnySkill,
  complexity: number
): {
  sections: string[];
  estimatedTokens: number;
  reasoning: string;
} {
  const sections: string[] = [];
  const availableSections = Array.from(skill.references.keys()).sort();
  let estimatedTokens = estimateTokens(skill.content);
  const reasoning: string[] = [];

  // Always load core
  reasoning.push(`Loading core content (${estimatedTokens} tokens)`);

  // Determine which sections to load based on complexity
  if (complexity <= 3) {
    // Low complexity: basics only
    if (availableSections.includes('basics')) {
      sections.push('basics');
      estimatedTokens += estimateTokens(skill.references.get('basics')?.content || '');
      reasoning.push('Low complexity: loading basics section only');
    }
  } else if (complexity <= 6) {
    // Medium complexity: basics + one relevant section
    if (availableSections.includes('basics')) {
      sections.push('basics');
      estimatedTokens += estimateTokens(skill.references.get('basics')?.content || '');
    }

    // Add next most relevant section
    const nextSection = availableSections.find(s => s !== 'basics');
    if (nextSection) {
      sections.push(nextSection);
      estimatedTokens += estimateTokens(skill.references.get(nextSection)?.content || '');
    }

    reasoning.push('Medium complexity: loading core + basics + 1 additional section');
  } else {
    // High complexity: load all available
    sections.push(...availableSections);
    for (const section of availableSections) {
      estimatedTokens += estimateTokens(skill.references.get(section)?.content || '');
    }

    reasoning.push(`High complexity: loading all ${sections.length} sections`);
  }

  return {
    sections,
    estimatedTokens,
    reasoning: reasoning.join('\n'),
  };
}

/**
 * Adjust complexity based on user expertise level
 */
export function adjustComplexityForExpertise(
  complexity: number,
  expertise: 'beginner' | 'intermediate' | 'expert'
): number {
  switch (expertise) {
    case 'beginner':
      // Beginners need more guidance (load more sections)
      return Math.min(10, complexity + 2);
    case 'intermediate':
      // No adjustment
      return complexity;
    case 'expert':
      // Experts need less guidance (load fewer sections)
      return Math.max(1, complexity - 1);
  }
}

/**
 * Batch analyze complexity for multiple skills
 */
export function batchAnalyzeComplexity(skills: AnySkill[]): Array<{
  skillId: string;
  skillName: string;
  complexity: number;
  level: ReturnType<typeof getComplexityLevel>;
}> {
  return skills.map(skill => {
    const complexity = analyzeComplexity(skill);
    const level = getComplexityLevel(complexity);

    return {
      skillId: skill.id,
      skillName: skill.metadata.name,
      complexity,
      level,
    };
  });
}

/**
 * Get complexity distribution for a set of skills
 */
export function getComplexityDistribution(skills: AnySkill[]): {
  veryLow: number;
  low: number;
  medium: number;
  high: number;
  veryHigh: number;
  average: number;
  median: number;
} {
  const complexities = skills.map(s => analyzeComplexity(s)).sort((a, b) => a - b);

  const veryLow = complexities.filter(c => c <= 2).length;
  const low = complexities.filter(c => c > 2 && c <= 4).length;
  const medium = complexities.filter(c => c > 4 && c <= 6).length;
  const high = complexities.filter(c => c > 6 && c <= 8).length;
  const veryHigh = complexities.filter(c => c > 8).length;

  const average = complexities.reduce((a, b) => a + b, 0) / complexities.length;
  const median = complexities[Math.floor(complexities.length / 2)];

  return {
    veryLow,
    low,
    medium,
    high,
    veryHigh,
    average,
    median,
  };
}
