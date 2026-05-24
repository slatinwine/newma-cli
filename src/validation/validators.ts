/**
 * Validation utilities for AI responses
 *
 * Provides validation functions using ajv schemas, with helpful error messages.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  schemas,
  PlanResponse,
  Action,
  FFTPlanResult,
  ChatResponse,
  VerifyResponse,
} from './schemas';

// ============================================================================
// Validator Instance
// ============================================================================

const ajv = new Ajv({
  allErrors: true, // Collect all errors, not just first
  verbose: true,   // Include property names and values in errors
  strict: false,   // Allow additional properties for flexibility
});

addFormats(ajv);

// Compile validators
const planResponseValidator = ajv.compile(schemas.planResponse);
const fftPlanResultValidator = ajv.compile(schemas.fftPlanResult);
const chatResponseValidator = ajv.compile(schemas.chatResponse);
const verifyResponseValidator = ajv.compile(schemas.verifyResponse);

// ============================================================================
// Validation Error Types
// ============================================================================

export interface ValidationError {
  path: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  data?: any;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Format ajv errors into user-friendly validation errors
 */
function formatErrors(errors: any[]): ValidationError[] {
  return errors.map(err => {
    const path = err.instancePath || 'root';
    const message = err.message || 'Unknown validation error';

    return {
      path,
      message,
      value: err.data,
    };
  });
}

/**
 * Validate a plan response from AI
 *
 * @param data - The parsed JSON object to validate
 * @returns ValidationResult with validation status and errors
 */
export function validatePlanResponse(data: any): ValidationResult {
  const valid = planResponseValidator(data);

  if (!valid) {
    return {
      valid: false,
      errors: formatErrors(planResponseValidator.errors || []),
    };
  }

  // Additional custom validation
  const customErrors: ValidationError[] = [];

  // Type assertion for access
  const planData = data as PlanResponse;

  // Check for empty arrays
  if (planData.todo.length === 0) {
    customErrors.push({
      path: 'todo',
      message: 'todo array must not be empty',
    });
  }

  if (planData.actions.length === 0) {
    customErrors.push({
      path: 'actions',
      message: 'actions array must not be empty',
    });
  }

  // Validate actions have reasonable content
  planData.actions.forEach((action: Action, index: number) => {
    if (action.type === 'create' || action.type === 'modify') {
      if (!action.path || action.path.trim() === '') {
        customErrors.push({
          path: `actions[${index}].path`,
          message: 'path must not be empty',
          value: action.path,
        });
      }

      if (action.type === 'create' && (!action.content || action.content.trim() === '')) {
        customErrors.push({
          path: `actions[${index}].content`,
          message: 'content must not be empty for create action',
          value: action.content,
        });
      }

      if (action.type === 'modify') {
        if (!action.oldContent || action.oldContent.trim() === '') {
          customErrors.push({
            path: `actions[${index}].oldContent`,
            message: 'oldContent must not be empty for modify action',
            value: action.oldContent,
          });
        }
        if (!action.newContent || action.newContent.trim() === '') {
          customErrors.push({
            path: `actions[${index}].newContent`,
            message: 'newContent must not be empty for modify action',
            value: action.newContent,
          });
        }
      }
    }

    if (action.type === 'run') {
      if (!action.command || action.command.trim() === '') {
        customErrors.push({
          path: `actions[${index}].command`,
          message: 'command must not be empty for run action',
          value: action.command,
        });
      }

      // Warn about dangerous commands
      const dangerousCommands = ['rm -rf', 'del /f', 'format', 'shutdown'];
      if (dangerousCommands.some(cmd => action.command!.includes(cmd))) {
        customErrors.push({
          path: `actions[${index}].command`,
          message: `⚠️  Potentially dangerous command detected: ${action.command}`,
          value: action.command,
        });
      }
    }
  });

  if (customErrors.length > 0) {
    return {
      valid: false,
      errors: customErrors,
    };
  }

  return {
    valid: true,
    errors: [],
    data: data as PlanResponse,
  };
}

/**
 * Validate an FFT plan result
 *
 * @param data - The parsed JSON object to validate
 * @returns ValidationResult with validation status and errors
 */
export function validateFFTPlanResult(data: any): ValidationResult {
  const valid = fftPlanResultValidator(data);

  if (!valid) {
    return {
      valid: false,
      errors: formatErrors(fftPlanResultValidator.errors || []),
    };
  }

  // Additional validation for complex tasks
  if ((data as any).complexity === 'complex') {
    const customErrors: ValidationError[] = [];
    const fftData = data as any;

    if (!fftData.options || fftData.options.length === 0) {
      customErrors.push({
        path: 'options',
        message: 'Complex tasks must have at least one option',
      });
    }

    if (fftData.options.length > 5) {
      customErrors.push({
        path: 'options',
        message: 'Too many options (max 5 recommended)',
        value: fftData.options.length,
      });
    }

    // Validate each option
    if (fftData.options) {
      fftData.options.forEach((option: any, index: number) => {
        if (!option.actions || option.actions.length === 0) {
          customErrors.push({
            path: `options[${index}].actions`,
            message: 'Option must have at least one action',
          });
        }

        if (option.confidence < 0 || option.confidence > 1) {
          customErrors.push({
            path: `options[${index}].confidence`,
            message: 'Confidence must be between 0 and 1',
            value: option.confidence,
          });
        }

        if (option.estimatedTime < 0) {
          customErrors.push({
            path: `options[${index}].estimatedTime`,
            message: 'Estimated time must be positive',
            value: option.estimatedTime,
          });
        }
      });
    }

    if (customErrors.length > 0) {
      return {
        valid: false,
        errors: customErrors,
      };
    }
  }

  return {
    valid: true,
    errors: [],
    data: data as FFTPlanResult,
  };
}

/**
 * Validate a chat response
 *
 * @param data - The parsed JSON object to validate
 * @returns ValidationResult with validation status and errors
 */
export function validateChatResponse(data: any): ValidationResult {
  const valid = chatResponseValidator(data);

  if (!valid) {
    return {
      valid: false,
      errors: formatErrors(chatResponseValidator.errors || []),
    };
  }

  // Custom validation: message should not be too short (unless it's a clarification)
  const chatData = data as ChatResponse;
  if (chatData.type !== 'clarification' && chatData.message.length < 10) {
    return {
      valid: false,
      errors: [{
        path: 'message',
        message: 'Message is too short (min 10 characters for answers/suggestions)',
        value: chatData.message,
      }],
    };
  }

  return {
    valid: true,
    errors: [],
    data: data as ChatResponse,
  };
}

/**
 * Validate a verification response
 *
 * @param data - The parsed JSON object to validate
 * @returns ValidationResult with validation status and errors
 */
export function validateVerifyResponse(data: any): ValidationResult {
  const valid = verifyResponseValidator(data);

  if (!valid) {
    return {
      valid: false,
      errors: formatErrors(verifyResponseValidator.errors || []),
    };
  }

  // Custom validation: if not satisfied, should provide reasoning
  const verifyData = data as VerifyResponse;
  if (!verifyData.satisfied && (!verifyData.reasoning || verifyData.reasoning.length < 20)) {
    return {
      valid: false,
      errors: [{
        path: 'reasoning',
        message: 'When not satisfied, reasoning must be detailed (min 20 characters)',
        value: verifyData.reasoning,
      }],
    };
  }

  return {
    valid: true,
    errors: [],
    data: data as VerifyResponse,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format validation errors into a user-friendly string
 *
 * @param errors - Array of validation errors
 * @returns Formatted error message
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return 'No errors';
  }

  const lines = [
    `❌ Validation Failed (${errors.length} error${errors.length > 1 ? 's' : ''})`,
    '',
  ];

  // Group errors by path
  const errorsByPath: Record<string, ValidationError[]> = {};
  errors.forEach(err => {
    if (!errorsByPath[err.path]) {
      errorsByPath[err.path] = [];
    }
    errorsByPath[err.path].push(err);
  });

  // Display errors grouped by path
  Object.entries(errorsByPath).forEach(([path, pathErrors]) => {
    lines.push(`  📍 ${path}`);

    pathErrors.forEach(err => {
      lines.push(`     ${err.message}`);

      if (err.value !== undefined) {
        const valueStr = typeof err.value === 'string'
          ? `"${err.value.substring(0, 50)}${err.value.length > 50 ? '...' : ''}"`
          : JSON.stringify(err.value);
        lines.push(`     Value: ${valueStr}`);
      }
    });

    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Validate any data against a schema (generic validator)
 *
 * @param schema - ajv schema to validate against
 * @param data - Data to validate
 * @returns ValidationResult
 */
export function validateGeneric(schema: any, data: any): ValidationResult {
  const validator = ajv.compile(schema);
  const valid = validator(data);

  if (!valid) {
    return {
      valid: false,
      errors: formatErrors(validator.errors || []),
    };
  }

  return {
    valid: true,
    errors: [],
    data,
  };
}

// ============================================================================
// Export All Validators
// ============================================================================

export const validators = {
  planResponse: validatePlanResponse,
  fftPlanResult: validateFFTPlanResult,
  chatResponse: validateChatResponse,
  verifyResponse: validateVerifyResponse,
  generic: validateGeneric,
};
