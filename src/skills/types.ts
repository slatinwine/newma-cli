/**
 * Enhanced Skill Type Definitions
 * Based on Claude's skill system architecture
 *
 * Key improvements over Kode's current system:
 * - Rich metadata schema with discovery support
 * - Progressive loading support (core + references)
 * - Input/output validation via JSON Schema
 * - Trigger-based auto-discovery
 * - Performance metadata
 */

/**
 * Skill types supported by the enhanced system
 */
export type SkillType = 'knowledge' | 'code' | 'hybrid';

/**
 * Skill complexity level (1-10)
 * Used for progressive loading decisions
 */
export type SkillComplexity = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * JSON Schema definition for validation
 */
export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  additionalProperties?: boolean;
  description?: string;
  enum?: any[];
  [key: string]: any;
}

/**
 * Skill example for documentation and testing
 */
export interface SkillExample {
  input: string;
  output: string;
  explanation?: string;
  context?: string;
}

/**
 * System requirements for skill compatibility
 */
export interface SystemRequirements {
  platform?: string[]; // e.g., ['darwin', 'linux']
  nodeVersion?: string; // e.g., '>=18.0.0'
  dependencies?: string[]; // npm package names
  tools?: string[]; // external tools required
}

/**
 * When to use guidance for discovery
 */
export interface UsageGuidance {
  whenToUse: string[];
  whenNotToUse?: string[];
}

/**
 * Performance metadata
 */
export interface PerformanceMetadata {
  estimatedTokens?: number; // Average token usage
  averageResponseTime?: number; // milliseconds
  cacheable?: boolean; // Can results be cached
}

/**
 * Enhanced skill metadata schema
 * This is the core metadata structure for all skills
 */
export interface SkillMetadata {
  // Identification
  id: string; // Unique identifier (e.g., 'pdf-generator')
  name: string; // Human-readable name (e.g., 'PDF Generator')
  version: string; // Semantic version (e.g., '1.0.0')

  // Description
  description: string; // Short description (1-2 sentences)
  longDescription?: string; // Detailed description (markdown)

  // Classification
  type: SkillType; // knowledge | code | hybrid
  category: string; // e.g., 'document-processing', 'analysis', 'integration'
  complexity: SkillComplexity; // 1-10, influences loading strategy

  // Discovery
  tags: string[]; // e.g., ['pdf', 'document', 'report']
  keywords: string[]; // Search keywords
  triggers: string[]; // Auto-activation triggers

  // Usage guidance
  whenToUse: string[]; // Scenarios where this skill is useful
  whenNotToUse?: string[]; // Scenarios to avoid

  // Technical
  dependencies?: string[]; // Other skills this depends on
  compatibility?: SystemRequirements; // Platform and version requirements

  // Authorship
  author: string; // Author name or organization
  license?: string; // License type (e.g., 'MIT')
  repository?: string; // Git repository URL

  // Examples
  examples?: SkillExample[]; // Usage examples

  // Performance
  performance?: PerformanceMetadata; // Performance characteristics

  // Validation
  inputSchema?: JSONSchema; // Input validation schema
  outputSchema?: JSONSchema; // Output validation schema
}

/**
 * Skill reference section for progressive loading
 */
export interface SkillReference {
  name: string; // Section name (e.g., 'basics', 'advanced')
  path: string; // Path to section file
  content: string; // Loaded content
  tokens: number; // Estimated token count
  loaded: boolean; // Whether currently loaded
}

/**
 * Base skill interface
 */
export interface Skill {
  id: string;
  metadata: SkillMetadata;
  content: string; // Core content from SKILL.md
  references: Map<string, SkillReference>; // Progressive sections
  path: string; // File system path
}

/**
 * Knowledge skill (no execution, pure guidance)
 */
export interface KnowledgeSkill extends Skill {
  metadata: SkillMetadata & { type: 'knowledge' };
}

/**
 * Code skill (execution only, no guidance)
 */
export interface CodeSkill extends Skill {
  metadata: SkillMetadata & { type: 'code' };
  execute: (context: SkillContext) => Promise<SkillResult>;
  tools?: Tool[];
}

/**
 * Hybrid skill (guidance + execution)
 */
export interface HybridSkill extends Skill {
  metadata: SkillMetadata & { type: 'hybrid' };
  execute: (context: SkillContext) => Promise<SkillResult>;
  tools?: Tool[];
}

/**
 * Union type for all skills
 */
export type AnySkill = KnowledgeSkill | CodeSkill | HybridSkill;

/**
 * Skill context passed to execute()
 */
export interface SkillContext {
  projectRoot: string;
  userInput: string;
  history: ConversationMessage[];
  tools: ToolRegistry;
  loadedSections: Set<string>;
  metadata: {
    timestamp: Date;
    tokensUsed: number;
    complexity: number;
  };
}

/**
 * Skill execution result
 */
export interface SkillResult {
  success: boolean;
  output?: any;
  error?: string;
  metadata?: {
    executionTime: number;
    tokensUsed: number;
  };
}

/**
 * Tool definition for code skills
 */
export interface Tool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  handler: (params: any, context: SkillContext) => Promise<any>;
}

/**
 * Tool registry for skill tools
 */
export interface ToolRegistry {
  register(tool: Tool): void;
  get(name: string): Tool | undefined;
  has(name: string): boolean;
  list(): Tool[];
}

/**
 * Conversation message for history
 */
export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

/**
 * Skill discovery match result
 */
export interface SkillMatch {
  skill: AnySkill;
  score: number; // 0-100
  reasons: string[]; // Why this skill matched
}

/**
 * Progressive loading options
 */
export interface ProgressiveLoadingOptions {
  maxTokens?: number; // Token budget (default: 8000)
  complexity?: SkillComplexity; // Force specific complexity level
  sections?: string[]; // Specific sections to load
}

/**
 * Skill validation result
 */
export interface SkillValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error';
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'warning';
}

/**
 * Skill package for distribution
 */
export interface SkillPackage {
  metadata: SkillMetadata;
  files: {
    skill: string; // SKILL.md content
    references?: Record<string, string>; // reference sections
    code?: string; // TypeScript code for code skills
    tests?: string; // Test file
  };
  manifest: {
    created: Date;
    checksum: string;
    size: number;
  };
}

/**
 * Skill loading options
 */
export interface SkillLoadingOptions {
  validate?: boolean; // Validate metadata
  cache?: boolean; // Use cache
  progressive?: boolean; // Enable progressive loading
}

/**
 * Skill discovery options
 */
export interface SkillDiscoveryOptions {
  searchPaths: string[]; // Paths to search for skills
  maxResults?: number; // Maximum results to return
  minScore?: number; // Minimum score threshold (0-100)
  types?: SkillType[]; // Filter by type
  categories?: string[]; // Filter by category
}

/**
 * SKILL.md frontmatter structure (YAML)
 */
export interface SkillFrontmatter {
  name: string;
  description: string;
  type: SkillType;
  complexity: SkillComplexity;
  tags: string[];
  triggers: string[];
  whenToUse: string[];
  version?: string;
  author?: string;
  category?: string;
  keywords?: string[];
  whenNotToUse?: string[];
  dependencies?: string[];
  license?: string;
  repository?: string;
}
