/**
 * Skills System Index
 * Central export point for all skill system components
 */

// Types
export * from './types';

// Metadata
export * from './metadata';

// Discovery
export * from './discovery';

// Templates
export * from './templates';

// Progressive Loading
export * from './loader';

// Cache
export * from './cache';

// Tokens
export * from './tokens';

// Complexity
export * from './complexity';

// Validation
export * from './validation';

// Testing
export * from './testing';

// Benchmarking
export * from './benchmark';

// Re-export commonly used utilities
export {
  // Metadata
  parseFrontmatter,
  extractMetadata,
  validateMetadata,
  exportFrontmatter,
} from './metadata';

export {
  // Discovery
  calculateSimilarity,
  matchTriggers,
  matchKeywords,
  matchTags,
  matchName,
  calculateSkillScore,
  findRelevantSkills,
  getSkillSuggestions,
  estimateInputComplexity,
} from './discovery';

export {
  // Progressive Loading
  ProgressiveSkillLoader,
  createLoader,
  loadSkillProgressively,
} from './loader';

export {
  // Cache
  SectionCache,
  createSectionCache,
  getGlobalCache,
  resetGlobalCache,
} from './cache';

export {
  // Tokens
  estimateTokens,
  estimateMarkdownTokens,
  estimateJsonTokens,
  fitsInBudget,
  truncateToFit,
  optimizeContent,
  calculateSavings,
  estimateSkillTokens,
  calculateLoadOrder,
  TokenBudget,
  createTokenBudget,
  analyzeTokenEfficiency,
  getSkillsTokenStats,
  recommendBudget,
} from './tokens';

export {
  // Complexity
  analyzeMetadataComplexity,
  analyzeContentComplexity,
  analyzeInputComplexity,
  analyzeComplexity,
  compareComplexity,
  getComplexityLevel,
  estimateSectionsToLoad,
  adjustComplexityForExpertise,
  batchAnalyzeComplexity,
  getComplexityDistribution,
} from './complexity';

export {
  // Validation
  validateSchema,
  validateSkillInput,
  validateSkillOutput,
  formatValidationErrors,
  createValidationSummary,
  validateMultipleSkills,
  createValidationMiddleware,
} from './validation';

export {
  // Testing
  generateTestsFromMetadata,
  generateValidData,
  generateInvalidData,
  executeTestSuite,
  formatTestResults,
  createTestSuite,
  runSkillTests,
  generateTestFile,
} from './testing';

export {
  // Benchmarking
  benchmark,
  benchmarkSkillLoad,
  benchmarkSkillValidation,
  benchmarkSkillExecution,
  benchmarkSkill,
  benchmarkSkills,
  getMemoryStats,
  formatBenchmarkResults,
  compareBenchmarkResults,
  detectRegressions,
  createBenchmarkReport,
  saveBenchmarkResults,
  loadBenchmarkResults,
} from './benchmark';

export {
  // Templates
  SkillTemplateType,
  getTemplate,
  listTemplates,
} from './templates';
