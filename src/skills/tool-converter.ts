/**
 * Skill Tool Converter
 *
 * Converts skill metadata to OpenAI Function Calling format.
 * Inspired by OpenDeepWiki's BuildSkillTool() approach.
 *
 * Key Features:
 * - Convert skill to OpenAI tool definition
 * - Generate parameters schema from triggers
 * - Include skill description for AI understanding
 * - Support allowed-tools mechanism
 */

import { SimpleSkill, SimpleSkillMetadata } from './simple-loader';

/**
 * OpenAI Function Calling tool definition
 */
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters?: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

/**
 * Conversion options
 */
export interface ToolConverterOptions {
  /**
   * Include parameters schema (default: true)
   */
  includeParameters?: boolean;

  /**
   * Description prefix (default: "Skill: ")
   */
  descriptionPrefix?: string;

  /**
   * Function name prefix (default: "skill_")
   */
  functionPrefix?: string;
}

/**
 * Convert skill metadata to OpenAI tool definition
 *
 * @param skill - Skill to convert
 * @param options - Conversion options
 * @returns OpenAI tool definition
 */
export function skillToOpenAITool(
  skill: SimpleSkill,
  options: ToolConverterOptions = {}
): OpenAITool {
  const {
    includeParameters = true,
    descriptionPrefix = 'Skill: ',
    functionPrefix = 'skill_',
  } = options;

  const metadata = skill.metadata;

  // Generate function name from skill name
  // Use kebab-case to match OpenAI requirements
  const functionName = `${functionPrefix}${metadata.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;

  // Build description from metadata
  const description = buildSkillDescription(metadata, descriptionPrefix);

  // Build parameters if requested
  let parameters;
  if (includeParameters) {
    parameters = buildParametersSchema(metadata);
  }

  return {
    type: 'function',
    function: {
      name: functionName,
      description,
      parameters,
    },
  };
}

/**
 * Build skill description from metadata
 *
 * Priority:
 * 1. description field
 * 2. whenToUse field
 * 3. Generated from triggers
 */
function buildSkillDescription(
  metadata: SimpleSkillMetadata,
  prefix: string
): string {
  const parts: string[] = [prefix];

  // Add description if available
  if (metadata.description) {
    parts.push(metadata.description);
  }

  // Add whenToUse hints
  if (metadata.whenToUse && metadata.whenToUse.length > 0) {
    parts.push(`\nWhen to use: ${metadata.whenToUse.join(', ')}`);
  }

  // Add triggers as examples
  if (metadata.triggers && metadata.triggers.length > 0) {
    parts.push(`\nTriggered by: ${metadata.triggers.slice(0, 3).join(', ')}`);
  }

  // Add type info
  if (metadata.type) {
    parts.push(`\nType: ${metadata.type}`);
  }

  return parts.join('');
}

/**
 * Build parameters schema for OpenAI Function Calling
 *
 * Skills typically accept:
 * - input: User input string
 * - context: Optional context object
 */
function buildParametersSchema(metadata: SimpleSkillMetadata): any {
  const properties: Record<string, any> = {
    input: {
      type: 'string',
      description: 'User input or request',
    },
  };

  const required: string[] = ['input'];

  // Add context parameter for hybrid skills
  if (metadata.type === 'hybrid' || metadata.type === 'code') {
    properties.context = {
      type: 'object',
      description: 'Optional context (project info, file paths, etc.)',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Project root directory',
        },
        filePaths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Relevant file paths',
        },
      },
    };
  }

  return {
    type: 'object',
    properties,
    required,
  };
}

/**
 * Convert multiple skills to OpenAI tools
 *
 * @param skills - Skills to convert
 * @param options - Conversion options
 * @returns Array of OpenAI tool definitions
 */
export function skillsToOpenAITools(
  skills: SimpleSkill[],
  options: ToolConverterOptions = {}
): OpenAITool[] {
  return skills.map((skill) => skillToOpenAITool(skill, options));
}

/**
 * Extract skill name from function call
 *
 * @param functionName - Function name from tool call
 * @param prefix - Function name prefix (default: "skill_")
 * @returns Original skill name
 */
export function extractSkillName(functionName: string, prefix: string = 'skill_'): string {
  return functionName.substring(prefix.length);
}

/**
 * Check if a function call is for a skill
 *
 * @param functionName - Function name from tool call
 * @param prefix - Function name prefix (default: "skill_")
 * @returns True if function call is for a skill
 */
export function isSkillFunctionCall(functionName: string, prefix: string = 'skill_'): boolean {
  return functionName.startsWith(prefix);
}

/**
 * Filter skills by allowed-tools
 *
 * If a skill declares allowed-tools, only include it if
 * the requested tools are a subset of allowed tools.
 *
 * @param skills - All skills
 * @param availableTools - Tools currently available
 * @returns Filtered skills
 */
export function filterSkillsByAllowedTools(
  skills: SimpleSkill[],
  availableTools: string[]
): SimpleSkill[] {
  return skills.filter((skill) => {
    const metadata = skill.metadata as any;

    // If no allowed-tools restriction, include skill
    if (!metadata.allowedTools || metadata.allowedTools.length === 0) {
      return true;
    }

    // Check if all allowed tools are available
    const allowedTools = metadata.allowedTools as string[];
    return allowedTools.every((tool) => availableTools.includes(tool));
  });
}

/**
 * Create skill tool map for quick lookup
 *
 * @param skills - Skills to map
 * @param options - Conversion options
 * @returns Map of function name to skill
 */
export function createSkillToolMap(
  skills: SimpleSkill[],
  options: ToolConverterOptions = {}
): Map<string, SimpleSkill> {
  const map = new Map<string, SimpleSkill>();
  const prefix = options.functionPrefix || 'skill_';

  for (const skill of skills) {
    const functionName = `${prefix}${skill.metadata.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}`;
    map.set(functionName, skill);
  }

  return map;
}
