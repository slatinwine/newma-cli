/**
 * JSON Schemas for validating AI responses
 *
 * Provides type-safe validation for plan responses, actions, and other AI-generated content.
 * Uses ajv (Another JSON Schema Validator) for runtime validation.
 */

// Using plain object schema definitions to avoid complex type inference issues

// ============================================================================
// Action Schemas
// ============================================================================

/**
 * Base action schema with common fields
 */
export interface BaseAction {
  type: 'create' | 'modify' | 'run' | 'verify';
}

/**
 * Create action: Create a new file
 */
export interface CreateAction extends BaseAction {
  type: 'create';
  path: string;
  content: string;
}

/**
 * Modify action: Modify an existing file
 */
export interface ModifyAction extends BaseAction {
  type: 'modify';
  path: string;
  oldContent: string;
  newContent: string;
}

/**
 * Run action: Execute a command
 */
export interface RunAction extends BaseAction {
  type: 'run';
  command: string;
}

/**
 * Verify action: Run verification checks
 */
export interface VerifyAction extends BaseAction {
  type: 'verify';
  command?: string;
  checks?: ('syntax' | 'lint' | 'test' | 'build')[];
}

/**
 * Union type for all actions
 */
export type Action = CreateAction | ModifyAction | RunAction | VerifyAction;

/**
 * JSON Schema for Action validation
 */
export const actionSchema: any = {
  type: 'object',
  required: ['type'],
  properties: {
    type: {
      type: 'string',
      enum: ['create', 'modify', 'run', 'verify']
    },
  },
  if: {
    properties: {
      type: { const: 'create' }
    },
    required: ['type']
  },
  then: {
    required: ['path', 'content'],
    properties: {
      type: { const: 'create' },
      path: { type: 'string', minLength: 1 },
      content: { type: 'string' }
    }
  },
  else: {
    if: {
      properties: {
        type: { const: 'modify' }
      },
      required: ['type']
    },
    then: {
      required: ['path', 'oldContent', 'newContent'],
      properties: {
        type: { const: 'modify' },
        path: { type: 'string', minLength: 1 },
        oldContent: { type: 'string' },
        newContent: { type: 'string' }
      }
    },
    else: {
      if: {
        properties: {
          type: { const: 'run' }
        },
        required: ['type']
      },
      then: {
        required: ['command'],
        properties: {
          type: { const: 'run' },
          command: { type: 'string', minLength: 1 }
        }
      },
      else: {
        // type: 'verify'
        properties: {
          type: { const: 'verify' },
          command: { type: 'string' },
          checks: {
            type: 'array',
            items: { type: 'string', enum: ['syntax', 'lint', 'test', 'build'] }
          }
        }
      }
    }
  }
};

// ============================================================================
// Plan Response Schemas
// ============================================================================

/**
 * Plan response from AI
 */
export interface PlanResponse {
  todo: string[];
  actions: Action[];
  reasoning?: string;
  techStack?: string[];
}

/**
 * JSON Schema for Plan Response validation
 */
export const planResponseSchema: any = {
  type: 'object',
  required: ['todo', 'actions'],
  properties: {
    todo: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      minItems: 1
    },
    actions: {
      type: 'array',
      items: actionSchema,
      minItems: 1
    },
    reasoning: { type: 'string' },
    techStack: {
      type: 'array',
      items: { type: 'string' }
    }
  }
};

// ============================================================================
// FFT Plan Option Schemas
// ============================================================================

/**
 * FFT Plan Option (for complex tasks with multiple approaches)
 */
export interface FFTPlanOption {
  id?: string;
  name: string;
  description: string;
  reasoning: string;
  strategy?: 'conservative' | 'balanced' | 'aggressive';
  actions: Action[];
  todo?: string[];
  estimatedTime: number; // milliseconds
  riskLevel?: 'low' | 'medium' | 'high';
  risk: 'low' | 'medium' | 'high'; // For backward compatibility
  confidence: number; // 0-1
  pros: string[];
  cons: string[];
}

/**
 * FFT Plan Result (response from FFT planner)
 */
export interface FFTPlanResult {
  complexity: 'simple' | 'complex';
  reasoning: string;
  selected?: FFTPlanOption;
  options?: FFTPlanOption[];
}

/**
 * JSON Schema for FFT Plan Option
 */
export const fftPlanOptionSchema: any = {
  type: 'object',
  required: ['name', 'description', 'reasoning', 'actions', 'estimatedTime', 'risk', 'confidence', 'pros', 'cons'],
  properties: {
    name: { type: 'string', minLength: 1 },
    description: { type: 'string', minLength: 1 },
    reasoning: { type: 'string', minLength: 1 },
    actions: {
      type: 'array',
      items: actionSchema,
      minItems: 1
    },
    estimatedTime: { type: 'number', minimum: 0 },
    risk: { type: 'string', enum: ['low', 'medium', 'high'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    pros: {
      type: 'array',
      items: { type: 'string', minLength: 1 }
    },
    cons: {
      type: 'array',
      items: { type: 'string', minLength: 1 }
    }
  }
};

/**
 * JSON Schema for FFT Plan Result
 */
export const fftPlanResultSchema: any = {
  type: 'object',
  required: ['complexity', 'reasoning'],
  properties: {
    complexity: { type: 'string', enum: ['simple', 'complex'] },
    reasoning: { type: 'string', minLength: 1 },
    selected: { ...fftPlanOptionSchema }, // Optional for simple tasks
    options: {
      type: 'array',
      items: fftPlanOptionSchema,
      minItems: 1
    }
  }
};

// ============================================================================
// Chat Response Schemas
// ============================================================================

/**
 * Chat response from AI
 */
export interface ChatResponse {
  message: string;
  type?: 'answer' | 'suggestion' | 'clarification';
}

/**
 * JSON Schema for Chat Response
 */
export const chatResponseSchema: any = {
  type: 'object',
  required: ['message'],
  properties: {
    message: { type: 'string', minLength: 1 },
    type: { type: 'string', enum: ['answer', 'suggestion', 'clarification'] }
  }
};

// ============================================================================
// Verify Response Schemas
// ============================================================================

/**
 * Verification response from AI
 */
export interface VerifyResponse {
  satisfied: boolean;
  reasoning: string;
  issues?: string[];
  suggestions?: string[];
}

/**
 * JSON Schema for Verify Response
 */
export const verifyResponseSchema: any = {
  type: 'object',
  required: ['satisfied', 'reasoning'],
  properties: {
    satisfied: { type: 'boolean' },
    reasoning: { type: 'string', minLength: 1 },
    issues: {
      type: 'array',
      items: { type: 'string', minLength: 1 }
    },
    suggestions: {
      type: 'array',
      items: { type: 'string', minLength: 1 }
    }
  }
};

// ============================================================================
// Export All Schemas
// ============================================================================

// Export individual schemas to avoid complex type inference
export const schemas = {
  action: actionSchema,
  planResponse: planResponseSchema,
  fftPlanOption: fftPlanOptionSchema,
  fftPlanResult: fftPlanResultSchema,
  chatResponse: chatResponseSchema,
  verifyResponse: verifyResponseSchema,
} as const;
