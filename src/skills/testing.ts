/**
 * Test Generation and Execution Framework
 * Generates and runs tests for skills based on their schemas and examples
 */

import { SkillMetadata, JSONSchema } from './types';
import { validateSchema, ValidationResult, formatValidationErrors } from './validation';

export interface TestCase {
  name: string;
  description: string;
  input: any;
  expectedOutput: any;
  expectedError?: boolean;
}

export interface TestResult {
  name: string;
  description: string;
  passed: boolean;
  input: any;
  output: any;
  expectedOutput: any;
  validation?: ValidationResult;
  error?: string;
  duration: number;
}

export interface TestSuite {
  name: string;
  description: string;
  tests: TestCase[];
  setup?: () => void | Promise<void>;
  teardown?: () => void | Promise<void>;
}

export interface TestSuiteResult {
  suiteName: string;
  passed: number;
  failed: number;
  total: number;
  duration: number;
  results: TestResult[];
}

/**
 * Generate test cases from skill metadata
 */
export function generateTestsFromMetadata(skill: SkillMetadata): TestCase[] {
  const tests: TestCase[] = [];

  // Generate tests from examples
  if (skill.examples) {
    for (const example of skill.examples) {
      tests.push({
        name: `Example: ${example.input.substring(0, 50)}...`,
        description: example.explanation || 'Example from skill metadata',
        input: parseExampleInput(example.input),
        expectedOutput: parseExampleOutput(example.output),
      });
    }
  }

  // Generate tests from input/output schemas
  if (skill.inputSchema && skill.outputSchema) {
    tests.push(...generateSchemaTests(skill));
  }

  return tests;
}

/**
 * Generate tests from schemas
 */
function generateSchemaTests(skill: SkillMetadata): TestCase[] {
  const tests: TestCase[] = [];
  const { inputSchema, outputSchema } = skill;

  if (!inputSchema || !outputSchema) {
    return tests;
  }

  // Generate valid input test
  const validInput = generateValidData(inputSchema);
  tests.push({
    name: 'Valid input/output',
    description: 'Test with valid input expecting valid output',
    input: validInput,
    expectedOutput: generateValidData(outputSchema),
  });

  // Generate invalid input tests
  const invalidInputs = generateInvalidData(inputSchema);
  for (const invalidInput of invalidInputs) {
    tests.push({
      name: `Invalid input: ${invalidInput.reason}`,
      description: invalidInput.reason,
      input: invalidInput.data,
      expectedOutput: null,
      expectedError: true,
    });
  }

  return tests;
}

/**
 * Generate valid data from schema
 */
export function generateValidData(schema: JSONSchema, depth: number = 0): any {
  if (depth > 5) {
    return null; // Prevent infinite recursion
  }

  switch (schema.type) {
    case 'string':
      return generateValidString(schema);
    case 'number':
    case 'integer':
      return generateValidNumber(schema);
    case 'boolean':
      return true;
    case 'object':
      return generateValidObject(schema, depth);
    case 'array':
      return generateValidArray(schema, depth);
    case 'null':
      return null;
    default:
      return null;
  }
}

/**
 * Generate valid string
 */
function generateValidString(schema: JSONSchema): string {
  if (schema.enum) {
    return schema.enum[0];
  }

  if (schema.pattern) {
    // Generate string matching pattern (simplified)
    return 'test';
  }

  if (schema.format === 'email') {
    return 'test@example.com';
  }

  if (schema.format === 'uri') {
    return 'https://example.com';
  }

  if (schema.format === 'uuid') {
    return '00000000-0000-0000-0000-000000000000';
  }

  if (schema.format === 'date-time') {
    return new Date().toISOString();
  }

  const minLength = schema.minLength || 1;
  const maxLength = schema.maxLength || 20;
  const length = Math.min(maxLength, Math.max(minLength, 10));

  return 'a'.repeat(length);
}

/**
 * Generate valid number
 */
function generateValidNumber(schema: JSONSchema): number {
  if (schema.enum) {
    return schema.enum[0];
  }

  const minimum = schema.minimum ?? 0;
  const maximum = schema.maximum ?? 100;

  if (schema.type === 'integer') {
    return Math.floor((minimum + maximum) / 2);
  }

  return (minimum + maximum) / 2;
}

/**
 * Generate valid object
 */
function generateValidObject(schema: JSONSchema, depth: number): any {
  const obj: any = {};
  const properties = schema.properties || {};
  const required = schema.required || [];

  // Add required properties
  for (const propName of required) {
    const propSchema = properties[propName];
    if (propSchema) {
      obj[propName] = generateValidData(propSchema, depth + 1);
    }
  }

  // Add some optional properties
  const optionalProps = Object.keys(properties).filter(p => !required.includes(p));
  for (const propName of optionalProps.slice(0, 3)) {
    const propSchema = properties[propName];
    if (propSchema && Math.random() > 0.5) {
      obj[propName] = generateValidData(propSchema, depth + 1);
    }
  }

  return obj;
}

/**
 * Generate valid array
 */
function generateValidArray(schema: JSONSchema, depth: number): any[] {
  const items = schema.items;
  if (!items) {
    return [];
  }

  const minItems = schema.minItems ?? 1;
  const maxItems = schema.maxItems ?? 3;
  const count = Math.min(maxItems, Math.max(minItems, 2));

  const arr: any[] = [];
  for (let i = 0; i < count; i++) {
    arr.push(generateValidData(items, depth + 1));
  }

  return arr;
}

/**
 * Generate invalid data for testing
 */
export function generateInvalidData(schema: JSONSchema): Array<{
  reason: string;
  data: any;
}> {
  const invalid: Array<{ reason: string; data: any }> = [];

  switch (schema.type) {
    case 'string':
      invalid.push(
        { reason: 'Wrong type (number)', data: 123 },
        { reason: 'Wrong type (object)', data: {} }
      );

      if (schema.minLength) {
        invalid.push({
          reason: 'Too short',
          data: 'a'.repeat(Math.max(0, schema.minLength - 1)),
        });
      }

      if (schema.maxLength) {
        invalid.push({
          reason: 'Too long',
          data: 'a'.repeat(schema.maxLength + 1),
        });
      }

      if (schema.pattern) {
        invalid.push({
          reason: 'Pattern mismatch',
          data: 'xxx',
        });
      }

      break;

    case 'number':
    case 'integer':
      invalid.push(
        { reason: 'Wrong type (string)', data: '123' },
        { reason: 'Wrong type (boolean)', data: true }
      );

      if (schema.minimum !== undefined) {
        invalid.push({
          reason: 'Below minimum',
          data: schema.minimum - 1,
        });
      }

      if (schema.maximum !== undefined) {
        invalid.push({
          reason: 'Above maximum',
          data: schema.maximum + 1,
        });
      }

      if (schema.type === 'integer') {
        invalid.push({
          reason: 'Not integer',
          data: 1.5,
        });
      }

      break;

    case 'boolean':
      invalid.push(
        { reason: 'Wrong type (string)', data: 'true' },
        { reason: 'Wrong type (number)', data: 1 }
      );
      break;

    case 'object':
      invalid.push(
        { reason: 'Wrong type (array)', data: [] },
        { reason: 'Wrong type (string)', data: '{}' }
      );

      if (schema.required && schema.required.length > 0) {
        const missing = {};
        invalid.push({
          reason: 'Missing required property',
          data: missing,
        });
      }

      break;

    case 'array':
      invalid.push(
        { reason: 'Wrong type (object)', data: {} },
        { reason: 'Wrong type (string)', data: '[]' }
      );
      break;
  }

  return invalid;
}

/**
 * Parse example input
 */
function parseExampleInput(input: string): any {
  try {
    return JSON.parse(input);
  } catch {
    return { input };
  }
}

/**
 * Parse example output
 */
function parseExampleOutput(output: string): any {
  try {
    return JSON.parse(output);
  } catch {
    return { output };
  }
}

/**
 * Execute a test suite
 */
export async function executeTestSuite(
  suite: TestSuite,
  executor: (input: any) => Promise<any>
): Promise<TestSuiteResult> {
  const startTime = Date.now();
  const results: TestResult[] = [];

  // Run setup
  if (suite.setup) {
    await suite.setup();
  }

  // Run tests
  for (const test of suite.tests) {
    const result = await executeTest(test, executor);
    results.push(result);
  }

  // Run teardown
  if (suite.teardown) {
    await suite.teardown();
  }

  const duration = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    suiteName: suite.name,
    passed,
    failed,
    total: results.length,
    duration,
    results,
  };
}

/**
 * Execute a single test
 */
async function executeTest(
  test: TestCase,
  executor: (input: any) => Promise<any>
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const output = await executor(test.input);

    // Check if error was expected
    if (test.expectedError) {
      return {
        name: test.name,
        description: test.description,
        passed: false,
        input: test.input,
        output,
        expectedOutput: test.expectedOutput,
        error: 'Expected error but execution succeeded',
        duration: Date.now() - startTime,
      };
    }

    // Validate output against expected
    // Note: This is a simple comparison, could be enhanced
    const passed = JSON.stringify(output) === JSON.stringify(test.expectedOutput);

    return {
      name: test.name,
      description: test.description,
      passed,
      input: test.input,
      output,
      expectedOutput: test.expectedOutput,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    // Check if error was expected
    if (test.expectedError) {
      return {
        name: test.name,
        description: test.description,
        passed: true,
        input: test.input,
        output: error instanceof Error ? error.message : String(error),
        expectedOutput: test.expectedOutput,
        duration: Date.now() - startTime,
      };
    }

    // Unexpected error
    return {
      name: test.name,
      description: test.description,
      passed: false,
      input: test.input,
      output: null,
      expectedOutput: test.expectedOutput,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Format test results for display
 */
export function formatTestResults(result: TestSuiteResult): string {
  const lines: string[] = [];

  lines.push(`\n📊 Test Suite: ${result.suiteName}`);
  lines.push(`\n   Passed: ${result.passed}/${result.total} ✅`);
  if (result.failed > 0) {
    lines.push(`   Failed: ${result.failed}/${result.total} ❌`);
  }
  lines.push(`   Duration: ${result.duration}ms`);

  if (result.failed > 0) {
    lines.push('\n❌ Failed Tests:');
    for (const test of result.results.filter(r => !r.passed)) {
      lines.push(`\n   ${test.name}`);
      lines.push(`   ${test.description}`);

      if (test.error) {
        lines.push(`   Error: ${test.error}`);
      }

      if (test.validation) {
        lines.push(`   ${formatValidationErrors(test.validation)}`);
      }

      lines.push(`   Input: ${JSON.stringify(test.input, null, 2)}`);
      lines.push(`   Expected: ${JSON.stringify(test.expectedOutput, null, 2)}`);
      lines.push(`   Received: ${JSON.stringify(test.output, null, 2)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Create test suite from skill metadata
 */
export function createTestSuite(
  skill: SkillMetadata,
  executor: (input: any) => Promise<any>,
  options?: {
    includeSchemaTests?: boolean;
    includeExampleTests?: boolean;
  }
): TestSuite {
  const tests: TestCase[] = [];

  if (options?.includeExampleTests !== false && skill.examples) {
    tests.push(...generateTestsFromMetadata(skill));
  }

  if (options?.includeSchemaTests && skill.inputSchema && skill.outputSchema) {
    tests.push(...generateSchemaTests(skill));
  }

  return {
    name: `${skill.name} Tests`,
    description: `Automated tests for ${skill.name}`,
    tests,
  };
}

/**
 * Run skill tests
 */
export async function runSkillTests(
  skill: SkillMetadata,
  executor: (input: any) => Promise<any>,
  options?: {
    includeSchemaTests?: boolean;
    includeExampleTests?: boolean;
  }
): Promise<TestSuiteResult> {
  const suite = createTestSuite(skill, executor, options);
  return executeTestSuite(suite, executor);
}

/**
 * Generate test file content
 */
export function generateTestFile(
  skill: SkillMetadata,
  options?: {
    importPath?: string;
    framework?: 'jest' | 'mocha' | 'jasmine';
  }
): string {
  const framework = options?.framework || 'jest';
  const importPath = options?.importPath || `./skills/${skill.id}`;

  const tests = generateTestsFromMetadata(skill);

  let content = '';

  if (framework === 'jest') {
    content = generateJestTest(skill, tests, importPath);
  } else if (framework === 'mocha') {
    content = generateMochaTest(skill, tests, importPath);
  } else {
    content = generateJasmineTest(skill, tests, importPath);
  }

  return content;
}

/**
 * Generate Jest test file
 */
function generateJestTest(skill: SkillMetadata, tests: TestCase[], importPath: string): string {
  const lines: string[] = [];

  lines.push(`import { ${skill.id} } from '${importPath}';`);
  lines.push(``);
  lines.push(`describe('${skill.name}', () => {`);
  lines.push(``);

  for (const test of tests) {
    lines.push(`  it('${test.description}', async () => {`);
    lines.push(`    const input = ${JSON.stringify(test.input)};`);
    lines.push(`    const expected = ${JSON.stringify(test.expectedOutput)};`);
    lines.push(``);
    lines.push(`    const result = await ${skill.id}(input);`);
    lines.push(``);
    lines.push(`    if (${test.expectedError ? 'false' : 'true'}) {`);
    lines.push(`      expect(result).toEqual(expected);`);
    lines.push(`    } else {`);
    lines.push(`      expect(result).toThrow();`);
    lines.push(`    }`);
    lines.push(`  });`);
    lines.push(``);
  }

  lines.push(`});`);

  return lines.join('\n');
}

/**
 * Generate Mocha test file
 */
function generateMochaTest(skill: SkillMetadata, tests: TestCase[], importPath: string): string {
  const lines: string[] = [];

  lines.push(`const { ${skill.id} } = require('${importPath}');`);
  lines.push(`const { expect } = require('chai');`);
  lines.push(``);
  lines.push(`describe('${skill.name}', () => {`);
  lines.push(``);

  for (const test of tests) {
    lines.push(`  it('${test.description}', async () => {`);
    lines.push(`    const input = ${JSON.stringify(test.input)};`);
    lines.push(`    const expected = ${JSON.stringify(test.expectedOutput)};`);
    lines.push(``);
    lines.push(`    const result = await ${skill.id}(input);`);
    lines.push(``);
    lines.push(`    if (${test.expectedError ? 'false' : 'true'}) {`);
    lines.push(`      expect(result).to.deep.equal(expected);`);
    lines.push(`    } else {`);
    lines.push(`      expect(result).to.throw();`);
    lines.push(`    }`);
    lines.push(`  });`);
    lines.push(``);
  }

  lines.push(`});`);

  return lines.join('\n');
}

/**
 * Generate Jasmine test file
 */
function generateJasmineTest(skill: SkillMetadata, tests: TestCase[], importPath: string): string {
  const lines: string[] = [];

  lines.push(`import { ${skill.id} } from '${importPath}';`);
  lines.push(``);
  lines.push(`describe('${skill.name}', () => {`);
  lines.push(``);

  for (const test of tests) {
    lines.push(`  it('${test.description}', async () => {`);
    lines.push(`    const input = ${JSON.stringify(test.input)};`);
    lines.push(`    const expected = ${JSON.stringify(test.expectedOutput)};`);
    lines.push(``);
    lines.push(`    const result = await ${skill.id}(input);`);
    lines.push(``);
    lines.push(`    if (${test.expectedError ? 'false' : 'true'}) {`);
    lines.push(`      expect(result).toEqual(expected);`);
    lines.push(`    } else {`);
    lines.push(`      await expectAsync(${skill.id}(input)).toBeRejected();`);
    lines.push(`    }`);
    lines.push(`  });`);
    lines.push(``);
  }

  lines.push(`});`);

  return lines.join('\n');
}
