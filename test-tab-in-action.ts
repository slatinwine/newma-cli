/**
 * Minimal test to verify tab completion works in your terminal
 */
import readline from 'readline';
import { AutoCompleter, createDefaultCompletionConfig } from './dist/completion';

console.log('\n🧪 Tab Completion Interactive Test\n');
console.log('This will test if tab completion works in your terminal.');
console.log('Instructions:');
console.log('  1. Type "/h" and press Tab');
console.log('  2. You should see completions: /help, /history, /hooks');
console.log('  3. Type "exit" to quit\n');

const config = createDefaultCompletionConfig(process.cwd());
const completer = new AutoCompleter(config);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'test> ',
  completer: completer.createCompleter(),
  terminal: true,  // Important: Force terminal mode
});

rl.prompt();

rl.on('line', (line) => {
  const trimmed = line.trim();

  if (trimmed === 'exit' || trimmed === 'quit') {
    console.log('\n✅ Test completed');
    console.log('\nIf tab completion worked above, it should work in Kode CLI.');
    console.log('If it did NOT work, see TAB_COMPLETION_FIX.md for solutions.\n');
    rl.close();
    return;
  }

  console.log(`You entered: "${line}"`);
  console.log(`  Try typing "/h" and pressing Tab`);
  rl.prompt();
});

rl.on('close', () => {
  process.exit(0);
});
