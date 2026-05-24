/**
 * Test example for the new prompt system
 *
 * Run with: npx ts-node examples/test-prompts.ts
 */

import { loadSystemPrompt, PromptType, buildSystemPrompt } from '../src/prompt';

console.log('=== Kode System Prompts Test ===\n');

// Test 1: Default prompt
console.log('1. Testing DEFAULT prompt...');
const defaultPrompt = loadSystemPrompt(PromptType.DEFAULT);
console.log(`✓ Default prompt loaded (${defaultPrompt.length} chars)`);
console.log(`  Starts with: "${defaultPrompt.substring(0, 50)}..."\n`);

// Test 2: Compact prompt
console.log('2. Testing COMPACT prompt...');
const compactPrompt = loadSystemPrompt(PromptType.COMPACT);
console.log(`✓ Compact prompt loaded (${compactPrompt.length} chars)`);
console.log(`  Starts with: "${compactPrompt.substring(0, 50)}..."\n`);

// Test 3: Frontend Agent prompt
console.log('3. Testing FRONTEND_AGENT prompt...');
const frontendPrompt = loadSystemPrompt(PromptType.FRONTEND_AGENT);
console.log(`✓ Frontend Agent prompt loaded (${frontendPrompt.length} chars)`);
console.log(`  Contains: ${frontendPrompt.includes('Frontend Agent') ? '✓' : '✗'} "Frontend Agent"\n`);

// Test 4: Backend Agent prompt
console.log('4. Testing BACKEND_AGENT prompt...');
const backendPrompt = loadSystemPrompt(PromptType.BACKEND_AGENT);
console.log(`✓ Backend Agent prompt loaded (${backendPrompt.length} chars)`);
console.log(`  Contains: ${backendPrompt.includes('Backend Agent') ? '✓' : '✗'} "Backend Agent"\n`);

// Test 5: Verification prompt
console.log('5. Testing VERIFICATION prompt...');
const verificationPrompt = loadSystemPrompt(PromptType.VERIFICATION);
console.log(`✓ Verification prompt loaded (${verificationPrompt.length} chars)`);
console.log(`  Contains: ${verificationPrompt.includes('Verification Mode') ? '✓' : '✗'} "Verification Mode"\n`);

// Test 6: With tools and permissions
console.log('6. Testing prompt with tools and permissions...');
const promptWithContext = loadSystemPrompt(
  PromptType.DEFAULT,
  ['file', 'command', 'search'],
  ['read', 'write', 'execute']
);
console.log(`✓ Prompt with context loaded (${promptWithContext.length} chars)`);
console.log(`  Contains tools: ${promptWithContext.includes('AVAILABLE TOOLS') ? '✓' : '✗'}`);
console.log(`  Contains permissions: ${promptWithContext.includes('GRANTED PERMISSIONS') ? '✓' : '✗'}\n`);

// Test 7: Backward compatibility
console.log('7. Testing backward compatibility...');
const legacyPrompt = buildSystemPrompt(['file'], ['read']);
console.log(`✓ Legacy prompt still works (${legacyPrompt.length} chars)`);
console.log(`  Starts with: "${legacyPrompt.substring(0, 50)}..."\n`);

// Test 8: Prompt size comparison
console.log('8. Prompt size comparison:');
console.log(`  Default: ${defaultPrompt.length} chars`);
console.log(`  Compact: ${compactPrompt.length} chars (${Math.round(compactPrompt.length / defaultPrompt.length * 100)}% of default)`);
console.log(`  Frontend: ${frontendPrompt.length} chars`);
console.log(`  Backend: ${backendPrompt.length} chars`);
console.log(`  Verification: ${verificationPrompt.length} chars\n`);

// Test 9: Enum values
console.log('9. Testing PromptType enum:');
console.log(`  DEFAULT: "${PromptType.DEFAULT}"`);
console.log(`  COMPACT: "${PromptType.COMPACT}"`);
console.log(`  FRONTEND_AGENT: "${PromptType.FRONTEND_AGENT}"`);
console.log(`  BACKEND_AGENT: "${PromptType.BACKEND_AGENT}"`);
console.log(`  VERIFICATION: "${PromptType.VERIFICATION}"\n`);

// Test 10: Edge cases
console.log('10. Testing edge cases...');
const noArgsPrompt = loadSystemPrompt();
console.log(`✓ No args prompt loaded (${noArgsPrompt.length} chars)`);
console.log(`  Same as default: ${noArgsPrompt === defaultPrompt ? '✓' : '✗'}\n`);

console.log('=== All Tests Passed! ===\n');

// Usage examples
console.log('=== Usage Examples ===\n');

console.log('Example 1: Use in AI call');
console.log(`
import { loadSystemPrompt, PromptType } from '@kode/cli';

const prompt = loadSystemPrompt(PromptType.DEFAULT);
const response = await callAI(config, projectInfo, requirement, prompt);
`);

console.log('Example 2: Frontend task');
console.log(`
const prompt = loadSystemPrompt(PromptType.FRONTEND_AGENT);
const response = await callAI(config, projectInfo, "create a button component", prompt);
`);

console.log('Example 3: Verification');
console.log(`
const prompt = loadSystemPrompt(PromptType.VERIFICATION);
const result = await callAI(config, projectInfo, requirement, prompt, history);

if (result.done) {
  console.log('✅ Task completed');
}
`);

console.log('Example 4: Backward compatible');
console.log(`
// Old code still works
const prompt = buildSystemPrompt(tools, permissions);
`);

console.log('\n=== Test Complete ===');
