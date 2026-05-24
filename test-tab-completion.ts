/**
 * Test script to verify tab completion is working
 */
import readline from 'readline';
import { AutoCompleter, createDefaultCompletionConfig } from './dist/completion';

console.log('🧪 Testing Tab Completion...\n');

// Create completer
const config = createDefaultCompletionConfig(process.cwd());
const completer = new AutoCompleter(config);

// Test cases
const tests = [
  { input: '', expected: 'commands' },
  { input: '/h', expected: 'commands starting with /h' },
  { input: '/set ', expected: 'set options' },
  { input: '/set ultrathink ', expected: 'true/false' },
  { input: './sr', expected: 'files starting with ./sr' },
];

console.log('Test Results:\n');

for (const test of tests) {
  const result = completer.complete(test.input);
  console.log(`Input: "${test.input}"`);
  console.log(`Expected: ${test.expected}`);
  console.log(`Candidates (${result.candidates.length}):`, result.candidates);
  console.log(`Type: ${result.type}`);
  console.log('─'.repeat(60));
}

// Now test with readline
console.log('\n🔧 Testing with readline interface...\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> ',
  completer: completer.createCompleter(),
});

console.log('✅ Readline interface created successfully');
console.log('✅ Completer configured');
console.log('\n💡 Tab completion should now work in interactive mode');
console.log('   (This test cannot verify tab key behavior programmatically)\n');

rl.close();
