// src/tools/adapter.ts
/**
 * Tool adapter layer
 * Bridges new buildTool-based tools with legacy Tool interface
 */

import type { Tool as NewTool } from './Tool';
import type { Tool as LegacyTool, ToolContext } from './types';

/**
 * Adapt a new buildTool to legacy Tool interface
 */
export function adaptToLegacyTool(newTool: NewTool | any): LegacyTool {
  return {
    name: newTool.name,
    description: newTool.description,
    category: newTool.category,
    permissions: newTool.permissions,

    // Convert Zod schema to parameters array
    parameters: convertZodSchemaToParameters(newTool.inputSchema),

    // Handler wrapper
    handler: async (params, context) => {
      return newTool.call(params as any, context);
    },

    // Optional validator
    validate: newTool.validateInput
      ? (params) => {
          return { valid: true, errors: [] };
        }
      : undefined,
  };
}

/**
 * Convert Zod schema to ToolParameter array
 * Supports both Zod v3 (_def.shape()) and Zod v4 (schema.shape / schema.def)
 */
function convertZodSchemaToParameters(schema: any): any[] {
  let shape: any = null;

  // Zod v4: schema.shape is a plain object, schema.def is the def
  if (schema && typeof schema.shape === 'object' && schema.shape !== null) {
    shape = schema.shape;
  }
  // Zod v3: schema._def.shape is a function
  else if (schema?._def?.shape && typeof schema._def.shape === 'function') {
    shape = schema._def.shape();
  }
  // Zod v3: schema._def.shape is an object (some versions)
  else if (schema?._def?.shape && typeof schema._def.shape === 'object') {
    shape = schema._def.shape;
  }

  if (!shape) {
    return [];
  }

  const parameters: any[] = [];

  for (const [name, zodType] of Object.entries(shape)) {
    const param: any = {
      name,
      type: getZodType(zodType),
      description: getZodDescription(zodType),
      required: !isZodOptional(zodType),
    };

    const enumValues = getZodEnumValues(zodType);
    if (enumValues) {
      param.values = enumValues;
    }

    parameters.push(param);
  }

  return parameters;
}

/**
 * Get Zod type name
 * Zod v4: type.def.type, Zod v3: type._def.typeName
 */
function getZodType(zodType: unknown): string {
  const type = zodType as any;

  // Zod v4
  if (type.def?.type) {
    switch (type.def.type) {
      case 'string': return 'string';
      case 'number': return 'number';
      case 'boolean': return 'boolean';
      case 'enum': return 'enum';
      case 'array': return 'array';
      case 'object': return 'object';
      default: return 'string';
    }
  }
  // Zod v3
  if (type._def?.typeName) {
    switch (type._def.typeName) {
      case 'ZodString': return 'string';
      case 'ZodNumber': return 'number';
      case 'ZodBoolean': return 'boolean';
      case 'ZodEnum': return 'enum';
      case 'ZodArray': return 'array';
      case 'ZodObject': return 'object';
      default: return 'string';
    }
  }
  return 'string';
}

/**
 * Check if Zod type is optional
 * Zod v4: type.type === 'optional' or type.isOptional()
 * Zod v3: type._def.typeName === 'ZodOptional'
 */
function isZodOptional(zodType: unknown): boolean {
  const type = zodType as any;
  if (typeof type.isOptional === 'function') {
    return type.isOptional();
  }
  if (type.type === 'optional') return true;
  if (type._def?.typeName === 'ZodOptional') return true;
  return false;
}

/**
 * Get description from Zod type
 */
function getZodDescription(zodType: unknown): string | undefined {
  const type = zodType as any;
  if (type.description) return type.description;
  if (type.def?.description) return type.def.description;
  if (type._def?.description) return type._def.description;
  return undefined;
}

/**
 * Get enum values if applicable
 */
function getZodEnumValues(zodType: unknown): string[] | undefined {
  const type = zodType as any;
  // Zod v4
  if (type.def?.type === 'enum' && type.def.values) {
    return type.def.values;
  }
  // Zod v3
  if (type._def?.typeName === 'ZodEnum' && type._def.values) {
    return type._def.values;
  }
  return undefined;
}
