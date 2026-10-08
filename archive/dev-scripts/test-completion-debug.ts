#!/usr/bin/env node
/**
 * Debug completion logic
 */

import { AutoCompleter, createDefaultCompletionConfig } from './src/completion';

const config = createDefaultCompletionConfig(process.cwd());
const completer = new AutoCompleter(config);

// 测试 "/set " 的解析
const input = "/set ";

console.log('Input:', JSON.stringify(input));
console.log('Ends with space:', input.endsWith(' '));

const trimmed = input.trim();
console.log('Trimmed:', JSON.stringify(trimmed));

const parts = trimmed.split(/\s+/).filter(p => p.length > 0);
console.log('Parts:', parts);

const hasTrailingSpace = input.endsWith(' ');
console.log('hasTrailingSpace:', hasTrailingSpace);
console.log('parts.length:', parts.length);

console.log('\nShould call completeSetCommand with:', {
  args: parts.slice(1),
  hasTrailingSpace
});

const result = completer.complete(input);
console.log('\nResult:', result);
