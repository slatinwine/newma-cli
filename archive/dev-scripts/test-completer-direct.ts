/**
 * Direct test of readline completer function
 */
import readline from 'readline';
import { AutoCompleter, createDefaultCompletionConfig } from './dist/completion';

console.log('🧪 Testing Readline Completer Directly\n');

// Create completer
const config = createDefaultCompletionConfig(process.cwd());
const autoCompleter = new AutoCompleter(config);

// Get the completer function
const completerFn = autoCompleter.createCompleter();

// Test the completer function directly
console.log('Testing completer function:\n');

const testInputs = [
  '',
  '/h',
  '/set ',
  '/set ultrathink ',
];

for (const input of testInputs) {
  console.log(`Input: "${input}"`);
  const result = completerFn(input);
  console.log(`Return value:`, result);
  console.log(`  - Candidates:`, result[0]);
  console.log(`  - Type:`, result[1]);
  console.log('');
}

// Now test with actual readline
console.log('\n🔧 Testing with real readline interface...');
console.log('Type "/h" and press Tab to see completions');
console.log('Press Ctrl+C to exit\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'test> ',
  completer: completerFn,
});

rl.prompt();

rl.on('line', (line) => {
  if (line === 'exit') {
    rl.close();
    return;
  }

  console.log(`You entered: ${line}`);
  rl.prompt();
});

rl.on('close', () => {
  console.log('\n👋 Bye!');
  process.exit(0);
});
