/**
 * Skill Metadata Management
 * Handles parsing, validation, and extraction of skill metadata
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import {
  SkillMetadata,
  SkillFrontmatter,
  SkillValidationResult,
  ValidationError,
  ValidationWarning,
  JSONSchema,
} from './types';

/**
 * Parse YAML frontmatter from markdown content
 */
export function parseFrontmatter(content: string): {
  frontmatter: Record<string, any>;
  body: string;
} {
  const frontmatterRegex = /^---\n([\s\S]+?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return {
      frontmatter: {},
      body: content,
    };
  }

  try {
    const frontmatter = yaml.load(match[1]) as Record<string, any>;
    const body = match[2];

    return { frontmatter, body };
  } catch (error) {
    throw new Error(`Failed to parse YAML frontmatter: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Build frontmatter YAML from metadata
 */
export function buildFrontmatter(metadata: SkillFrontmatter): string {
  const yamlContent = yaml.dump(metadata, {
    indent: 2,
    lineWidth: -1, // No line wrapping
    quotingType: '"',
    forceQuotes: false,
  });

  return `---\n${yamlContent}---\n`;
}

/**
 * Extract metadata from SKILL.md frontmatter
 */
export async function extractMetadata(
  skillPath: string
): Promise<{ metadata: SkillMetadata; content: string }> {
  const skillFilePath = path.join(skillPath, 'SKILL.md');
  const fileContent = await fs.readFile(skillFilePath, 'utf-8');

  const { frontmatter, body } = parseFrontmatter(fileContent);

  // Validate required fields
  const requiredFields = ['name', 'description', 'type', 'complexity', 'tags', 'triggers', 'whenToUse'];
  const errors: ValidationError[] = [];

  for (const field of requiredFields) {
    if (!frontmatter[field]) {
      errors.push({
        field,
        message: `Missing required field: ${field}`,
        severity: 'error',
      });
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid SKILL.md:\n${errors.map(e => `  - ${e.field}: ${e.message}`).join('\n')}`);
  }

  // Build metadata object
  const metadata: SkillMetadata = {
    id: frontmatter.name.toLowerCase().replace(/\s+/g, '-'),
    name: frontmatter.name,
    version: frontmatter.version || '1.0.0',
    description: frontmatter.description,
    longDescription: frontmatter.longDescription,
    type: frontmatter.type,
    category: frontmatter.category || 'uncategorized',
    complexity: frontmatter.complexity,
    tags: frontmatter.tags || [],
    keywords: frontmatter.keywords || [],
    triggers: frontmatter.triggers || [],
    whenToUse: frontmatter.whenToUse || [],
    whenNotToUse: frontmatter.whenNotToUse,
    dependencies: frontmatter.dependencies,
    compatibility: frontmatter.compatibility,
    author: frontmatter.author || 'Unknown',
    license: frontmatter.license,
    repository: frontmatter.repository,
    examples: frontmatter.examples,
    performance: frontmatter.performance,
    inputSchema: frontmatter.inputSchema,
    outputSchema: frontmatter.outputSchema,
  };

  return { metadata, content: body };
}

/**
 * Validate skill metadata
 */
export function validateMetadata(metadata: SkillMetadata): SkillValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate ID format
  if (!/^[a-z0-9-]+$/.test(metadata.id)) {
    errors.push({
      field: 'id',
      message: 'ID must contain only lowercase letters, numbers, and hyphens',
      severity: 'error',
    });
  }

  // Validate version format (semver)
  if (!/^\d+\.\d+\.\d+$/.test(metadata.version)) {
    errors.push({
      field: 'version',
      message: 'Version must follow semantic versioning (e.g., 1.0.0)',
      severity: 'error',
    });
  }

  // Validate type
  if (!['knowledge', 'code', 'hybrid'].includes(metadata.type)) {
    errors.push({
      field: 'type',
      message: 'Type must be one of: knowledge, code, hybrid',
      severity: 'error',
    });
  }

  // Validate complexity range
  if (metadata.complexity < 1 || metadata.complexity > 10) {
    errors.push({
      field: 'complexity',
      message: 'Complexity must be between 1 and 10',
      severity: 'error',
    });
  }

  // Validate arrays
  if (!Array.isArray(metadata.tags) || metadata.tags.length === 0) {
    errors.push({
      field: 'tags',
      message: 'Tags must be a non-empty array',
      severity: 'error',
    });
  }

  if (!Array.isArray(metadata.triggers) || metadata.triggers.length === 0) {
    errors.push({
      field: 'triggers',
      message: 'Triggers must be a non-empty array',
      severity: 'error',
    });
  }

  if (!Array.isArray(metadata.whenToUse) || metadata.whenToUse.length === 0) {
    errors.push({
      field: 'whenToUse',
      message: 'whenToUse must be a non-empty array',
      severity: 'error',
    });
  }

  // Validate JSON schemas if provided
  if (metadata.inputSchema) {
    const schemaValidation = validateJSONSchema(metadata.inputSchema);
    if (!schemaValidation.valid) {
      schemaValidation.errors.forEach(err => {
        errors.push({
          field: `inputSchema.${err.field}`,
          message: err.message,
          severity: 'error',
        });
      });
    }
  }

  if (metadata.outputSchema) {
    const schemaValidation = validateJSONSchema(metadata.outputSchema);
    if (!schemaValidation.valid) {
      schemaValidation.errors.forEach(err => {
        errors.push({
          field: `outputSchema.${err.field}`,
          message: err.message,
          severity: 'error',
        });
      });
    }
  }

  // Warnings
  if (!metadata.author || metadata.author === 'Unknown') {
    warnings.push({
      field: 'author',
      message: 'Author is not specified',
      severity: 'warning',
    });
  }

  if (!metadata.license) {
    warnings.push({
      field: 'license',
      message: 'License is not specified',
      severity: 'warning',
    });
  }

  if (!metadata.repository) {
    warnings.push({
      field: 'repository',
      message: 'Repository URL is not specified',
      severity: 'warning',
    });
  }

  if (!metadata.performance) {
    warnings.push({
      field: 'performance',
      message: 'Performance metadata is not provided',
      severity: 'warning',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate JSON Schema
 */
export function validateJSONSchema(schema: JSONSchema): SkillValidationResult {
  const errors: ValidationError[] = [];

  if (!schema.type) {
    errors.push({
      field: 'type',
      message: 'Schema must have a "type" field',
      severity: 'error',
    });
  }

  const validTypes = ['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'];
  if (schema.type && !validTypes.includes(schema.type)) {
    errors.push({
      field: 'type',
      message: `Invalid type: ${schema.type}. Must be one of: ${validTypes.join(', ')}`,
      severity: 'error',
    });
  }

  if (schema.type === 'object' && !schema.properties) {
    errors.push({
      field: 'properties',
      message: 'Object type must have "properties" defined',
      severity: 'error',
    });
  }

  if (schema.required) {
    if (!Array.isArray(schema.required)) {
      errors.push({
        field: 'required',
        message: '"required" must be an array',
        severity: 'error',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}

/**
 * Generate skill metadata from template
 */
export function generateMetadata(template: Partial<SkillMetadata>): SkillMetadata {
  const defaults: SkillMetadata = {
    id: 'new-skill',
    name: 'New Skill',
    version: '1.0.0',
    description: 'A new skill',
    type: 'knowledge',
    category: 'general',
    complexity: 3,
    tags: [],
    keywords: [],
    triggers: [],
    whenToUse: [],
    author: 'Your Name',
    license: 'MIT',
  };

  return { ...defaults, ...template };
}

/**
 * Export metadata to YAML frontmatter
 */
export function exportFrontmatter(metadata: SkillMetadata): string {
  const frontmatter: SkillFrontmatter = {
    name: metadata.name,
    description: metadata.description,
    type: metadata.type,
    complexity: metadata.complexity,
    tags: metadata.tags,
    triggers: metadata.triggers,
    whenToUse: metadata.whenToUse,
    version: metadata.version,
    author: metadata.author,
    category: metadata.category,
    keywords: metadata.keywords,
    whenNotToUse: metadata.whenNotToUse,
    dependencies: metadata.dependencies,
    license: metadata.license,
    repository: metadata.repository,
  };

  return buildFrontmatter(frontmatter);
}
