/**
 * Runtime Validation Framework
 * Provides JSON Schema validation for skill inputs and outputs
 *
 * Features:
 * - JSON Schema validation
 * - Type checking
 * - Runtime error detection
 * - Validation error reporting
 */

import { JSONSchema, SkillMetadata } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  path: string; // JSON path to error location
}

interface ValidationError {
  path: string;
  message: string;
  expected?: any;
  received?: any;
  code: string;
}

interface ValidationWarning {
  path: string;
  message: string;
  code: string;
}

export interface ValidationOptions {
  strict?: boolean; // Fail on warnings
  coerceTypes?: boolean; // Attempt type coercion
  removeAdditional?: boolean; // Remove properties not in schema
  useDefaults?: boolean; // Apply default values from schema
}

/**
 * Validate data against JSON Schema
 */
export function validateSchema(
  data: any,
  schema: JSONSchema,
  options: ValidationOptions = {}
): ValidationResult {
  const {
    strict = false,
    coerceTypes = false,
    removeAdditional = false,
    useDefaults = false,
  } = options;

  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Apply defaults if requested
  let validatedData = data;
  if (useDefaults) {
    validatedData = applyDefaults(data, schema);
  }

  // Perform validation
  validateValue(validatedData, schema, '', errors, warnings, {
    coerceTypes,
    removeAdditional,
  });

  const valid = errors.length === 0 && (!strict || warnings.length === 0);

  return {
    valid,
    errors,
    warnings,
    path: '',
  };
}

/**
 * Validate a value against a schema
 */
function validateValue(
  value: any,
  schema: JSONSchema,
  path: string,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  options: { coerceTypes: boolean; removeAdditional: boolean }
): void {
  // Check required
  if (value === undefined || value === null) {
    if (schema.type && !isNullable(schema)) {
      errors.push({
        path,
        message: `Required value is missing`,
        code: 'REQUIRED',
      });
    }
    return;
  }

  // Check type
  if (schema.type) {
    if (!validateType(value, schema.type)) {
      if (options.coerceTypes) {
        value = coerceType(value, schema.type);
        if (!validateType(value, schema.type)) {
          errors.push({
            path,
            message: `Type mismatch: expected ${schema.type}, got ${typeof value}`,
            expected: schema.type,
            received: typeof value,
            code: 'TYPE_MISMATCH',
          });
        }
      } else {
        errors.push({
          path,
          message: `Type mismatch: expected ${schema.type}, got ${typeof value}`,
          expected: schema.type,
          received: typeof value,
          code: 'TYPE_MISMATCH',
        });
      }
      return;
    }
  }

  // Check enum
  if (schema.enum) {
    if (!schema.enum.includes(value)) {
      errors.push({
        path,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        expected: schema.enum,
        received: value,
        code: 'ENUM_MISMATCH',
      });
      return;
    }
  }

  // Type-specific validation
  switch (schema.type) {
    case 'object':
      validateObject(value, schema, path, errors, warnings, options);
      break;
    case 'array':
      validateArray(value, schema, path, errors, warnings, options);
      break;
    case 'string':
      validateString(value, schema, path, errors, warnings);
      break;
    case 'number':
    case 'integer':
      validateNumber(value, schema, path, errors, warnings);
      break;
  }
}

/**
 * Validate object
 */
function validateObject(
  value: any,
  schema: JSONSchema,
  path: string,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  options: { coerceTypes: boolean; removeAdditional: boolean }
): void {
  if (typeof value !== 'object' || Array.isArray(value)) {
    errors.push({
      path,
      message: `Expected object, got ${typeof value}`,
      expected: 'object',
      received: typeof value,
      code: 'TYPE_MISMATCH',
    });
    return;
  }

  const properties = schema.properties || {};
  const required = schema.required || [];
  const additionalProperties = schema.additionalProperties !== false;

  // Check required properties
  for (const propName of required) {
    if (!(propName in value)) {
      errors.push({
        path: `${path}.${propName}`,
        message: `Required property missing: ${propName}`,
        code: 'REQUIRED_PROPERTY',
      });
    }
  }

  // Validate each property
  for (const [propName, propValue] of Object.entries(value)) {
    const propPath = `${path}.${propName}`;
    const propSchema = properties[propName];

    if (propSchema) {
      validateValue(propValue, propSchema, propPath, errors, warnings, options);
    } else if (!additionalProperties) {
      if (options.removeAdditional) {
        delete value[propName];
      } else {
        errors.push({
          path: propPath,
          message: `Additional property not allowed: ${propName}`,
          code: 'ADDITIONAL_PROPERTY',
        });
      }
    }
  }
}

/**
 * Validate array
 */
function validateArray(
  value: any,
  schema: JSONSchema,
  path: string,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  options: { coerceTypes: boolean; removeAdditional: boolean }
): void {
  if (!Array.isArray(value)) {
    errors.push({
      path,
      message: `Expected array, got ${typeof value}`,
      expected: 'array',
      received: typeof value,
      code: 'TYPE_MISMATCH',
    });
    return;
  }

  // Validate items
  if (schema.items) {
    value.forEach((item, index) => {
      validateValue(
        item,
        schema.items!,
        `${path}[${index}]`,
        errors,
        warnings,
        options
      );
    });
  }
}

/**
 * Validate string
 */
function validateString(
  value: any,
  schema: JSONSchema,
  path: string,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  if (typeof value !== 'string') {
    return; // Already checked by validateType
  }

  // minLength
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    errors.push({
      path,
      message: `String length ${value.length} is less than minimum ${schema.minLength}`,
      expected: `>= ${schema.minLength}`,
      received: value.length,
      code: 'MIN_LENGTH',
    });
  }

  // maxLength
  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    errors.push({
      path,
      message: `String length ${value.length} exceeds maximum ${schema.maxLength}`,
      expected: `<= ${schema.maxLength}`,
      received: value.length,
      code: 'MAX_LENGTH',
    });
  }

  // pattern
  if (schema.pattern) {
    const regex = new RegExp(schema.pattern);
    if (!regex.test(value)) {
      errors.push({
        path,
        message: `String does not match pattern: ${schema.pattern}`,
        expected: schema.pattern,
        received: value,
        code: 'PATTERN_MISMATCH',
      });
    }
  }

  // format
  if (schema.format) {
    if (!validateFormat(value, schema.format)) {
      warnings.push({
        path,
        message: `String format validation not implemented for: ${schema.format}`,
        code: 'FORMAT_NOT_IMPLEMENTED',
      });
    }
  }
}

/**
 * Validate number
 */
function validateNumber(
  value: any,
  schema: JSONSchema,
  path: string,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  if (typeof value !== 'number') {
    return; // Already checked by validateType
  }

  // minimum
  if (schema.minimum !== undefined && value < schema.minimum) {
    errors.push({
      path,
      message: `Value ${value} is less than minimum ${schema.minimum}`,
      expected: `>= ${schema.minimum}`,
      received: value,
      code: 'MINIMUM',
    });
  }

  // maximum
  if (schema.maximum !== undefined && value > schema.maximum) {
    errors.push({
      path,
      message: `Value ${value} exceeds maximum ${schema.maximum}`,
      expected: `<= ${schema.maximum}`,
      received: value,
      code: 'MAXIMUM',
    });
  }

  // integer check
  if (schema.type === 'integer' && !Number.isInteger(value)) {
    errors.push({
      path,
      message: `Value ${value} is not an integer`,
      expected: 'integer',
      received: value,
      code: 'NOT_INTEGER',
    });
  }
}

/**
 * Check if value matches type
 */
function validateType(value: any, type: string): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'null':
      return value === null;
    default:
      return true;
  }
}

/**
 * Check if schema allows null
 */
function isNullable(schema: JSONSchema): boolean {
  if (schema.type === 'null') {
    return true;
  }

  if (Array.isArray(schema.type)) {
    return schema.type.includes('null');
  }

  return false;
}

/**
 * Coerce value to type
 */
function coerceType(value: any, type: string): any {
  switch (type) {
    case 'string':
      return String(value);
    case 'number':
      return Number(value);
    case 'integer':
      return parseInt(value, 10);
    case 'boolean':
      return Boolean(value);
    default:
      return value;
  }
}

/**
 * Apply default values from schema
 */
function applyDefaults(value: any, schema: JSONSchema): any {
  if (value === undefined || value === null) {
    if (schema.default !== undefined) {
      return schema.default;
    }
    return value;
  }

  if (schema.type === 'object' && typeof value === 'object' && !Array.isArray(value)) {
    const result = { ...value };
    const properties = schema.properties || {};

    for (const [propName, propSchema] of Object.entries(properties)) {
      if (result[propName] === undefined && propSchema.default !== undefined) {
        result[propName] = propSchema.default;
      } else if (result[propName] !== undefined) {
        result[propName] = applyDefaults(result[propName], propSchema);
      }
    }

    return result;
  }

  if (schema.type === 'array' && Array.isArray(value)) {
    if (schema.items) {
      return value.map(item => applyDefaults(item, schema.items!));
    }
  }

  return value;
}

/**
 * Validate format (basic implementation)
 */
function validateFormat(value: string, format: string): boolean {
  switch (format) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case 'uri':
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    case 'date-time':
      return !isNaN(Date.parse(value));
    case 'uuid':
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    default:
      return true; // Unknown format, pass validation
  }
}

/**
 * Validate skill input
 */
export function validateSkillInput(
  skill: SkillMetadata,
  input: any,
  options?: ValidationOptions
): ValidationResult {
  if (!skill.inputSchema) {
    return {
      valid: true,
      errors: [],
      warnings: [
        {
          path: '',
          message: 'Skill has no input schema, skipping validation',
          code: 'NO_SCHEMA',
        },
      ],
      path: '',
    };
  }

  return validateSchema(input, skill.inputSchema, options);
}

/**
 * Validate skill output
 */
export function validateSkillOutput(
  skill: SkillMetadata,
  output: any,
  options?: ValidationOptions
): ValidationResult {
  if (!skill.outputSchema) {
    return {
      valid: true,
      errors: [],
      warnings: [
        {
          path: '',
          message: 'Skill has no output schema, skipping validation',
          code: 'NO_SCHEMA',
        },
      ],
      path: '',
    };
  }

  return validateSchema(output, skill.outputSchema, options);
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push('✅ Validation passed');
  } else {
    lines.push('❌ Validation failed');
  }

  if (result.errors.length > 0) {
    lines.push('\nErrors:');
    for (const error of result.errors) {
      const location = error.path || 'root';
      lines.push(`  - [${location}] ${error.message}`);
      if (error.expected !== undefined) {
        lines.push(`    Expected: ${JSON.stringify(error.expected)}`);
      }
      if (error.received !== undefined) {
        lines.push(`    Received: ${JSON.stringify(error.received)}`);
      }
    }
  }

  if (result.warnings.length > 0) {
    lines.push('\nWarnings:');
    for (const warning of result.warnings) {
      const location = warning.path || 'root';
      lines.push(`  - [${location}] ${warning.message}`);
    }
  }

  return lines.join('\n');
}

/**
 * Create validation error summary
 */
export function createValidationSummary(result: ValidationResult): {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  summary: string;
} {
  const errorCount = result.errors.length;
  const warningCount = result.warnings.length;

  let summary = result.valid ? '✅ Valid' : '❌ Invalid';

  if (errorCount > 0) {
    summary += `, ${errorCount} error${errorCount > 1 ? 's' : ''}`;
  }

  if (warningCount > 0) {
    summary += `, ${warningCount} warning${warningCount > 1 ? 's' : ''}`;
  }

  return {
    valid: result.valid,
    errorCount,
    warningCount,
    summary,
  };
}

/**
 * Validate multiple skills
 */
export function validateMultipleSkills(
  skills: Array<{ skill: SkillMetadata; input?: any; output?: any }>,
  options?: ValidationOptions
): Array<{
  skillId: string;
  skillName: string;
  inputResult?: ValidationResult;
  outputResult?: ValidationResult;
}> {
  return skills.map(({ skill, input, output }) => {
    const result: any = {
      skillId: skill.id,
      skillName: skill.name,
    };

    if (input !== undefined) {
      result.inputResult = validateSkillInput(skill, input, options);
    }

    if (output !== undefined) {
      result.outputResult = validateSkillOutput(skill, output, options);
    }

    return result;
  });
}

/**
 * Validation middleware for skill execution
 */
export function createValidationMiddleware(
  skill: SkillMetadata,
  options?: ValidationOptions
) {
  return {
    /**
     * Validate input before execution
     */
    validateInput(input: any): ValidationResult {
      return validateSkillInput(skill, input, options);
    },

    /**
     * Validate output after execution
     */
    validateOutput(output: any): ValidationResult {
      return validateSkillOutput(skill, output, options);
    },

    /**
     * Validate both input and output
     */
    validate(input: any, output: any): {
      input: ValidationResult;
      output: ValidationResult;
      valid: boolean;
    } {
      const inputResult = this.validateInput(input);
      const outputResult = this.validateOutput(output);

      return {
        input: inputResult,
        output: outputResult,
        valid: inputResult.valid && outputResult.valid,
      };
    },
  };
}
