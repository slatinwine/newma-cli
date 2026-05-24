/**
 * Skill Plugin Type Definitions
 *
 * Supports Claude Skills-like functionality in Kode:
 * - Progressive disclosure (SKILL.md + references/)
 * - Complex knowledge transfer (Markdown for AI)
 * - No-compilation mode (direct execution)
 */

import { Tool } from '../tools/types';

/**
 * Skill plugin - combines code tools with AI-readable knowledge
 */
export interface SkillPlugin {
  /** Unique skill identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Skill description */
  description: string;

  /** Skill version */
  version: string;

  /** Skill type */
  type: 'code' | 'knowledge' | 'hybrid';

  /** Core knowledge (always loaded) */
  core: SkillCore;

  /** Progressive disclosure sections */
  sections?: SkillSection[];

  /** Tools (for code/hybrid skills) */
  tools?: Tool[];

  /** AI instructions (for knowledge/hybrid skills) */
  instructions?: SkillInstructions;

  /** Metadata */
  metadata?: SkillMetadata;
}

/**
 * Core skill content (always loaded)
 */
export interface SkillCore {
  /** Main skill file (SKILL.md) */
  markdown: string;

  /** Quick start guide */
  quickStart?: string;

  /** When to use this skill */
  whenToUse?: string[];

  /** Trigger conditions */
  triggers?: string[];
}

/**
 * Progressive disclosure sections
 */
export interface SkillSection {
  /** Section identifier */
  id: string;

  /** Section title */
  title: string;

  /** Section content (markdown or reference to file) */
  content: string;

  /** Content type */
  contentType: 'inline' | 'file' | 'url';

  /** When to load this section */
  loadTrigger?: {
    type: 'manual' | 'keyword' | 'complexity';
    value?: string | number;
  };

  /** Estimated tokens (for context management) */
  estimatedTokens?: number;

  /** Priority for loading */
  priority?: number;
}

/**
 * AI instructions for knowledge transfer
 */
export interface SkillInstructions {
  /** System prompt addition */
  systemPrompt?: string;

  /** User prompt template */
  userPromptTemplate?: string;

  /** Workflow steps */
  workflow?: SkillWorkflowStep[];

  /** Decision tree */
  decisionTree?: SkillDecisionNode;

  /** Examples */
  examples?: SkillExample[];
}

/**
 * Workflow step
 */
export interface SkillWorkflowStep {
  /** Step identifier */
  id: string;

  /** Step title */
  title: string;

  /** Step description */
  description: string;

  /** Step actions */
  actions: SkillAction[];

  /** Next steps */
  next: string[] | 'end' | SkillConditionalNext;
}

/**
 * Skill action
 */
export interface SkillAction {
  /** Action type */
  type: 'ai_call' | 'tool_call' | 'user_input' | 'condition';

  /** Action content */
  content: string;

  /** Parameters */
  params?: Record<string, unknown>;
}

/**
 * Conditional next step
 */
export interface SkillConditionalNext {
  /** Conditions mapping */
  conditions: Record<string, string[]>;

  /** Default next step */
  default: string[];
}

/**
 * Decision tree node
 */
export interface SkillDecisionNode {
  /** Node identifier */
  id: string;

  /** Question to ask */
  question: string;

  /** Options */
  options: Array<{
    value: string;
    label: string;
    next: string | 'end' | SkillDecisionNode;
  }>;

  /** Default next step */
  default?: string | 'end';
}

/**
 * Skill example
 */
export interface SkillExample {
  /** Example title */
  title: string;

  /** Example input */
  input: string;

  /** Example output */
  output: string;

  /** Example context */
  context?: string;
}

/**
 * Skill metadata
 */
export interface SkillMetadata {
  /** Author */
  author?: string;

  /** Category */
  category?: string;

  /** Tags */
  tags?: string[];

  /** Complexity (1-5) */
  complexity?: number;

  /** Estimated time to complete */
  estimatedTime?: string;

  /** Related skills */
  relatedSkills?: string[];

  /** Prerequisites */
  prerequisites?: string[];

  /** Estimated tokens */
  estimatedTokens?: number;
}

/**
 * Skill loader options
 */
export interface SkillLoaderOptions {
  /** Whether to enable progressive disclosure */
  progressiveDisclosure?: boolean;

  /** Maximum tokens to load initially */
  maxInitialTokens?: number;

  /** Auto-load sections based on keywords */
  autoLoadByKeyword?: boolean;

  /** Cache loaded sections */
  cacheSections?: boolean;

  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Skill execution context
 */
export interface SkillContext {
  /** Skill ID */
  skillId: string;

  /** Project root */
  projectRoot: string;

  /** User input */
  userInput: string;

  /** Conversation history */
  history: Array<{ role: string; content: string }>;

  /** Available tools */
  tools: Tool[];

  /** Loaded sections */
  loadedSections: Set<string>;

  /** Execution metadata */
  metadata: {
    startTime: number;
    tokensUsed: number;
    sectionsLoaded: number;
  };
}

/**
 * Skill execution result
 */
export interface SkillResult {
  /** Whether execution was successful */
  success: boolean;

  /** AI response */
  response?: string;

  /** Tools called */
  toolCalls?: Array<{
    tool: string;
    params: Record<string, unknown>;
    result: unknown;
  }>;

  /** Sections loaded during execution */
  sectionsLoaded: string[];

  /** Tokens used */
  tokensUsed: number;

  /** Duration in ms */
  duration: number;

  /** Next actions suggested */
  nextActions?: string[];
}

/**
 * Skill manifest (from SKILL.md frontmatter)
 */
export interface SkillManifest {
  /** Skill name */
  name: string;

  /** Skill description */
  description: string;

  /** Skill type */
  type?: 'code' | 'knowledge' | 'hybrid';

  /** When to use */
  whenToUse?: string[];

  /** Triggers */
  triggers?: string[];

  /** Complexity */
  complexity?: number;

  /** Tags */
  tags?: string[];

  /** Estimated tokens */
  estimatedTokens?: number;
}

/**
 * No-compilation plugin types
 */

/**
 * Direct execution plugin (TypeScript/JavaScript without build)
 */
export interface DirectPlugin {
  /** Plugin identifier */
  id: string;

  /** Plugin name */
  name: string;

  /** Description */
  description: string;

  /** Version */
  version: string;

  /** Entry point file (relative to plugin root) */
  entryPoint: string;

  /** Plugin type */
  type: 'typescript' | 'javascript' | 'python' | 'bash';

  /** Source code (if inline) */
  sourceCode?: string;

  /** Dependencies */
  dependencies?: string[];

  /** Tools (defined without compilation) */
  tools?: DirectToolDefinition[];

  /** Metadata */
  metadata?: DirectPluginMetadata;
}

/**
 * Direct tool definition
 */
export interface DirectToolDefinition {
  /** Tool name */
  name: string;

  /** Description */
  description: string;

  /** Handler function (as string) */
  handler: string;

  /** Parameters schema */
  parameters?: {
    type: 'object';
    properties: Record<string, {
      type: 'string' | 'number' | 'boolean' | 'array' | 'object';
      description: string;
      required?: boolean;
    }>;
    required?: string[];
  };

  /** Permissions */
  permissions?: string[];

  /** Category */
  category?: string;
}

/**
 * Direct plugin metadata
 */
export interface DirectPluginMetadata {
  /** Author */
  author?: string;

  /** License */
  license?: string;

  /** Homepage */
  homepage?: string;

  /** Runtime requirements */
  runtime?: {
    nodeVersion?: string;
    pythonVersion?: string;
    dependencies?: string[];
  };
}

/**
 * Hybrid plugin (code + skill)
 */
export interface HybridPlugin {
  /** Code plugin part */
  code: {
    tools: Tool[];
    initialize?: (context: any) => Promise<void>;
    cleanup?: (context: any) => Promise<void>;
  };

  /** Skill plugin part */
  skill: SkillPlugin;
}
