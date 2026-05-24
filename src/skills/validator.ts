/**
 * Skill Validator
 *
 * Validates SKILL.md format and structure.
 * Inspired by OpenDeepWiki's validation approach.
 *
 * Key Features:
 * - YAML frontmatter validation
 * - Required field checking
 * - Name format validation (kebab-case)
 * - allowed-tools syntax validation
 * - Folder structure verification
 * - Detailed error reporting
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { SimpleSkillMetadata, parseSkillFrontmatter } from './simple-loader';

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  metadata?: SimpleSkillMetadata;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  /**
   * Require all recommended fields
   */
  strict?: boolean;

  /**
   * Check folder structure
   */
  checkStructure?: boolean;

  /**
   * Validate allowed-tools against known tools
   */
  validateAllowedTools?: boolean;

  /**
   * Known tool names for validation
   */
  knownTools?: string[];
}

/**
 * Skill Validator
 */
export class SkillValidator {
  private options: Required<ValidationOptions>;

  constructor(options: ValidationOptions = {}) {
    this.options = {
      strict: options.strict ?? false,
      checkStructure: options.checkStructure ?? true,
      validateAllowedTools: options.validateAllowedTools ?? false,
      knownTools: options.knownTools ?? [],
    };
  }

  /**
   * Validate skill at path
   *
   * @param skillPath - Path to skill directory or SKILL.md
   * @returns Validation result
   */
  async validateSkill(skillPath: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Determine if path is directory or file
    const skillMdPath = skillPath.endsWith('SKILL.md')
      ? skillPath
      : join(skillPath, 'SKILL.md');

    // Check if SKILL.md exists
    if (!existsSync(skillMdPath)) {
      return {
        valid: false,
        errors: [{ field: 'SKILL.md', message: 'File not found', severity: 'error' }],
        warnings: [],
      };
    }

    // Read file
    let content: string;
    try {
      content = await readFile(skillMdPath, 'utf-8');
    } catch (error: any) {
      return {
        valid: false,
        errors: [{ field: 'SKILL.md', message: `Failed to read: ${error.message}`, severity: 'error' }],
        warnings: [],
      };
    }

    // Check frontmatter
    if (!content.startsWith('---')) {
      errors.push({
        field: 'frontmatter',
        message: 'SKILL.md must start with YAML frontmatter (---)',
        severity: 'error',
      });
      return { valid: false, errors, warnings };
    }

    // Parse frontmatter
    let metadata: SimpleSkillMetadata;
    try {
      metadata = parseSkillFrontmatter(content);
    } catch (error: any) {
      errors.push({
        field: 'frontmatter',
        message: `Failed to parse frontmatter: ${error.message}`,
        severity: 'error',
      });
      return { valid: false, errors, warnings };
    }

    // Validate required fields
    this.validateRequiredFields(metadata, errors, warnings);

    // Validate name format
    this.validateName(metadata.name, errors);

    // Validate type
    this.validateType(metadata.type, errors);

    // Validate complexity
    this.validateComplexity(metadata.complexity, warnings);

    // Validate tags
    this.validateTags(metadata.tags, warnings);

    // Validate triggers
    this.validateTriggers(metadata.triggers, errors, warnings);

    // Validate allowed-tools
    if (metadata.allowedTools) {
      this.validateAllowedTools(metadata.allowedTools, errors);
    }

    // Validate compatibility
    if (metadata.compatibility) {
      this.validateCompatibility(metadata.compatibility, warnings);
    }

    // Validate version format
    if (metadata.version) {
      this.validateVersion(metadata.version, warnings);
    }

    // Validate timeout
    if (metadata.timeout) {
      this.validateTimeout(metadata.timeout, warnings);
    }

    // Check folder structure if enabled
    if (this.options.checkStructure) {
      await this.validateFolderStructure(skillPath, metadata, warnings);
    }

    // Strict mode: check recommended fields
    if (this.options.strict) {
      this.validateRecommendedFields(metadata, warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata,
    };
  }

  /**
   * Validate required fields
   */
  private validateRequiredFields(
    metadata: SimpleSkillMetadata,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    // Name is required
    if (!metadata.name || metadata.name === 'Unnamed Skill') {
      errors.push({
        field: 'name',
        message: 'name is required',
        severity: 'error',
      });
    }

    // Description is required
    if (!metadata.description) {
      errors.push({
        field: 'description',
        message: 'description is required',
        severity: 'error',
      });
    }

    // Type is required
    if (!metadata.type) {
      errors.push({
        field: 'type',
        message: 'type is required (knowledge, code, or hybrid)',
        severity: 'error',
      });
    }

    // Triggers are required
    if (!metadata.triggers || metadata.triggers.length === 0) {
      errors.push({
        field: 'triggers',
        message: 'triggers is required (at least one)',
        severity: 'error',
      });
    }
  }

  /**
   * Validate name format (kebab-case)
   */
  private validateName(name: string, errors: ValidationError[]): void {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
      errors.push({
        field: 'name',
        message: 'name must be in kebab-case (lowercase letters, numbers, and hyphens only)',
        severity: 'error',
      });
    }

    if (name.startsWith('-') || name.endsWith('-')) {
      errors.push({
        field: 'name',
        message: 'name cannot start or end with a hyphen',
        severity: 'error',
      });
    }

    if (name.length > 64) {
      errors.push({
        field: 'name',
        message: 'name must be 64 characters or less',
        severity: 'error',
      });
    }
  }

  /**
   * Validate type
   */
  private validateType(type: string, errors: ValidationError[]): void {
    const validTypes = ['knowledge', 'code', 'hybrid'];
    if (!validTypes.includes(type)) {
      errors.push({
        field: 'type',
        message: `type must be one of: ${validTypes.join(', ')}`,
        severity: 'error',
      });
    }
  }

  /**
   * Validate complexity
   */
  private validateComplexity(complexity: number, warnings: ValidationError[]): void {
    if (complexity < 1 || complexity > 10) {
      warnings.push({
        field: 'complexity',
        message: 'complexity should be between 1 and 10',
        severity: 'warning',
      });
    }
  }

  /**
   * Validate tags
   */
  private validateTags(tags: string[], warnings: ValidationError[]): void {
    if (tags.length === 0) {
      warnings.push({
        field: 'tags',
        message: 'tags are recommended for better discoverability',
        severity: 'warning',
      });
    }

    // Check tag format
    for (const tag of tags) {
      if (/\s/.test(tag)) {
        warnings.push({
          field: 'tags',
          message: `tag "${tag}" contains whitespace (consider using hyphens)`,
          severity: 'warning',
        });
      }
    }
  }

  /**
   * Validate triggers
   */
  private validateTriggers(
    triggers: string[],
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    if (triggers.length === 0) {
      errors.push({
        field: 'triggers',
        message: 'at least one trigger is required',
        severity: 'error',
      });
    }

    // Check for empty triggers
    for (const trigger of triggers) {
      if (!trigger || trigger.trim().length === 0) {
        errors.push({
          field: 'triggers',
          message: 'trigger cannot be empty',
          severity: 'error',
        });
      }
    }

    // Warning if too many triggers
    if (triggers.length > 10) {
      warnings.push({
        field: 'triggers',
        message: 'too many triggers (consider using more generic patterns)',
        severity: 'warning',
      });
    }
  }

  /**
   * Validate allowed-tools
   */
  private validateAllowedTools(allowedTools: string[], errors: ValidationError[]): void {
    // Check format
    for (const tool of allowedTools) {
      if (!/^[a-z_][a-z0-9_]*$/.test(tool)) {
        errors.push({
          field: 'allowedTools',
          message: `invalid tool name: "${tool}" (use snake_case)`,
          severity: 'error',
        });
      }
    }

    // Check against known tools if enabled
    if (this.options.validateAllowedTools && this.options.knownTools.length > 0) {
      const unknownTools = allowedTools.filter(t => !this.options.knownTools.includes(t));
      if (unknownTools.length > 0) {
        errors.push({
          field: 'allowedTools',
          message: `unknown tools: ${unknownTools.join(', ')}`,
          severity: 'error',
        });
      }
    }
  }

  /**
   * Validate compatibility
   */
  private validateCompatibility(compatibility: string[], warnings: ValidationError[]): void {
    const knownModels = ['gpt-4', 'gpt-3.5-turbo', 'claude-3', 'claude-2', 'glm-4', 'glm-3'];
    const unknownModels = compatibility.filter(m => !knownModels.includes(m));

    if (unknownModels.length > 0) {
      warnings.push({
        field: 'compatibility',
        message: `unknown models: ${unknownModels.join(', ')} (known: ${knownModels.join(', ')})`,
        severity: 'warning',
      });
    }
  }

  /**
   * Validate version format (semver)
   */
  private validateVersion(version: string, warnings: ValidationError[]): void {
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(-[a-zA-Z0-9._-]+)?(\+[a-zA-Z0-9._-]+)?$/;
    if (!semverRegex.test(version)) {
      warnings.push({
        field: 'version',
        message: `version "${version}" does not follow semver format (e.g., 1.0.0)`,
        severity: 'warning',
      });
    }
  }

  /**
   * Validate timeout
   */
  private validateTimeout(timeout: number, warnings: ValidationError[]): void {
    if (timeout < 10 || timeout > 600) {
      warnings.push({
        field: 'timeout',
        message: 'timeout should be between 10 and 600 seconds',
        severity: 'warning',
      });
    }
  }

  /**
   * Validate folder structure
   */
  private async validateFolderStructure(
    skillPath: string,
    metadata: SimpleSkillMetadata,
    warnings: ValidationError[]
  ): Promise<void> {
    const skillDir = skillPath.endsWith('SKILL.md')
      ? join(skillPath, '..')
      : skillPath;

    // Check if scripts folder exists
    if (metadata.hasScripts) {
      const scriptsPath = join(skillDir, 'scripts');
      if (!existsSync(scriptsPath)) {
        warnings.push({
          field: 'hasScripts',
          message: 'hasScripts is true but scripts/ folder not found',
          severity: 'warning',
        });
      }
    }

    // Check if references folder exists
    if (metadata.hasReferences) {
      const referencesPath = join(skillDir, 'references');
      if (!existsSync(referencesPath)) {
        warnings.push({
          field: 'hasReferences',
          message: 'hasReferences is true but references/ folder not found',
          severity: 'warning',
        });
      }
    }

    // Check if assets folder exists
    if (metadata.hasAssets) {
      const assetsPath = join(skillDir, 'assets');
      if (!existsSync(assetsPath)) {
        warnings.push({
          field: 'hasAssets',
          message: 'hasAssets is true but assets/ folder not found',
          severity: 'warning',
        });
      }
    }
  }

  /**
   * Validate recommended fields (strict mode)
   */
  private validateRecommendedFields(
    metadata: SimpleSkillMetadata,
    warnings: ValidationError[]
  ): void {
    // Author is recommended
    if (!metadata.author) {
      warnings.push({
        field: 'author',
        message: 'author is recommended (strict mode)',
        severity: 'warning',
      });
    }

    // License is recommended
    if (!metadata.license) {
      warnings.push({
        field: 'license',
        message: 'license is recommended (strict mode)',
        severity: 'warning',
      });
    }

    // whenToUse is recommended
    if (!metadata.whenToUse || metadata.whenToUse.length === 0) {
      warnings.push({
        field: 'whenToUse',
        message: 'whenToUse is recommended (strict mode)',
        severity: 'warning',
      });
    }
  }

  /**
   * Format validation result as string
   */
  static formatResult(result: ValidationResult): string {
    const lines: string[] = [];

    if (result.valid) {
      lines.push('✅ Validation passed!');
    } else {
      lines.push('❌ Validation failed!');
    }

    if (result.errors.length > 0) {
      lines.push('\n🔴 Errors:');
      for (const error of result.errors) {
        lines.push(`  • [${error.field}] ${error.message}`);
      }
    }

    if (result.warnings.length > 0) {
      lines.push('\n⚠️  Warnings:');
      for (const warning of result.warnings) {
        lines.push(`  • [${warning.field}] ${warning.message}`);
      }
    }

    if (result.metadata) {
      lines.push('\n📋 Metadata:');
      lines.push(`  Name: ${result.metadata.name}`);
      lines.push(`  Type: ${result.metadata.type}`);
      lines.push(`  Description: ${result.metadata.description.substring(0, 60)}...`);
    }

    return lines.join('\n');
  }
}
