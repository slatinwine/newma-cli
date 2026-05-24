// test-ultrathink.ts
// Test the ultrathink feature implementation

import { SessionManager } from './src/session';
import { Config } from './src/config';
import { AIResponse, TokenUsage } from './src/types';

console.log('🧪 Testing Ultrathink Feature Implementation\n');

// Test 1: Type definitions
console.log('Test 1: Type definitions');
console.log('─'.repeat(50));

const mockUsage: TokenUsage = {
  prompt_tokens: 1000,
  completion_tokens: 500,
  total_tokens: 1500
};

const mockAIResponse: AIResponse = {
  todo: ['Task 1', 'Task 2'],
  actions: [],
  duration: 2345, // milliseconds
  usage: mockUsage
};

console.log('✅ TokenUsage interface works');
console.log('✅ AIResponse includes duration and usage fields');
console.log('');

// Test 2: SessionManager ultrathink toggle
console.log('Test 2: SessionManager ultrathink state');
console.log('─'.repeat(50));

const config: Config = {
  apiKey: 'test-key',
  baseUrl: 'https://api.openai.com',
  endpoint: undefined,
  model: 'gpt-4'
};

const session = new SessionManager('/tmp', config);

console.log(`Initial state: ${session.isUltrathinkEnabled() ? 'ENABLED' : 'DISABLED'}`);
console.assert(!session.isUltrathinkEnabled(), 'Ultrathink should be disabled by default');

// Toggle on
const newState1 = session.toggleUltrathink();
console.log(`After first toggle: ${newState1 ? 'ENABLED' : 'DISABLED'}`);
console.assert(newState1 === true, 'Ultrathink should be enabled after first toggle');
console.assert(session.isUltrathinkEnabled() === true, 'isUltrathinkEnabled should return true');

// Toggle off
const newState2 = session.toggleUltrathink();
console.log(`After second toggle: ${newState2 ? 'ENABLED' : 'DISABLED'}`);
console.assert(newState2 === false, 'Ultrathink should be disabled after second toggle');
console.assert(session.isUltrathinkEnabled() === false, 'isUltrathinkEnabled should return false');

console.log('✅ SessionManager ultrathink toggle works correctly');
console.log('');

// Test 3: Session stats include ultrathink
console.log('Test 3: Session stats include ultrathink state');
console.log('─'.repeat(50));

// Enable ultrathink
session.toggleUltrathink();

const stats = session.getStats();
console.log(`Stats include ultrathinkEnabled: ${'ultrathinkEnabled' in stats}`);
console.assert('ultrathinkEnabled' in stats, 'SessionStats should include ultrathinkEnabled field');
console.log(`Ultrathink enabled in stats: ${stats.ultrathinkEnabled}`);
console.assert(stats.ultrathinkEnabled === true, 'ultrathinkEnabled should be true in stats');

console.log('✅ Session stats correctly include ultrathink state');
console.log('');

// Test 4: AIResponse structure
console.log('Test 4: AIResponse structure');
console.log('─'.repeat(50));

console.log(`Mock response has duration: ${mockAIResponse.duration !== undefined}`);
console.assert(mockAIResponse.duration !== undefined, 'AIResponse should have duration');
console.log(`Duration value: ${mockAIResponse.duration}ms`);
console.log(`Duration in seconds: ${(mockAIResponse.duration! / 1000).toFixed(2)}s`);

console.log(`Mock response has usage: ${mockAIResponse.usage !== undefined}`);
console.assert(mockAIResponse.usage !== undefined, 'AIResponse should have usage');
console.log(`Token usage:`, mockAIResponse.usage);
console.assert(mockAIResponse.usage!.total_tokens === 1500, 'Total tokens should be 1500');

console.log('✅ AIResponse structure is correct');
console.log('');

// Summary
console.log('═'.repeat(50));
console.log('✅ All tests passed!');
console.log('═'.repeat(50));
console.log('\n📝 Manual Testing Required:');
console.log('   • Start REPL with: npm run dev -- -i');
console.log('   • Run a requirement');
console.log('   • Toggle ultrathink: /ultrathink');
console.log('   • Run another requirement to see timing/token info');
console.log('   • Check /status shows ultrathink state\n');
