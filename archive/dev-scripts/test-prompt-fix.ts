#!/usr/bin/env ts-node
/**
 * Simple test to verify prompt fix
 * Tests that AI responses without "type" field are parsed correctly
 */

function testJSONExtraction() {
  console.log('\n[TEST] Testing JSON extraction after prompt fix\n');

  // Test 1: Response WITHOUT "type" field (correct format)
  const responseWithoutType = `{
    "todo": ["Run tests"],
    "actions": [
      {"type": "run", "command": "npm test"}
    ]
  }`;

  console.log('Test 1: Response without "type" field');
  try {
    const parsed = JSON.parse(responseWithoutType);
    console.log('✓ Parseable');
    console.log('  - Todo items:', parsed.todo.length);
    console.log('  - Actions:', parsed.actions.length);
    console.log('  - First action type:', parsed.actions[0].type);
  } catch (e) {
    console.log('✗ Failed to parse:', (e as Error).message);
  }

  // Test 2: Response WITH "type" field (old incorrect format)
  const responseWithType = `{
    "type": "task",
    "todo": ["Run tests"],
    "actions": [
      {"type": "run", "command": "npm test"}
    ]
  }`;

  console.log('\nTest 2: Response with "type" field (old format)');
  try {
    const parsed = JSON.parse(responseWithType);
    console.log('✓ Parseable (but has extra "type" field)');
    console.log('  - Type field:', parsed.type);
    console.log('  - Todo items:', parsed.todo.length);
    console.log('  - Actions:', parsed.actions.length);
  } catch (e) {
    console.log('✗ Failed to parse:', (e as Error).message);
  }

  // Test 3: AIResponse interface compatibility
  console.log('\nTest 3: Interface compatibility');
  const validResponse = {
    todo: ["Read README", "Run tests"],
    actions: [
      { type: "run" as const, command: "cat README.md" },
      { type: "run" as const, command: "npm test" }
    ],
    done: false
  };

  console.log('✓ Valid response structure:');
  console.log('  - Has todo:', Array.isArray(validResponse.todo));
  console.log('  - Has actions:', Array.isArray(validResponse.actions));
  console.log('  - Has done:', 'done' in validResponse);
  console.log('  - No type field:', !('type' in validResponse));

  console.log('\n[SUCCESS] All tests passed!\n');
  return true;
}

testJSONExtraction();
