#!/usr/bin/env npx ts-node
/**
 * Test URL Detection Logic
 */

const testCases = [
  { input: 'npm:@anthropics/anthropic-agent-skills/document-skills', expected: 'npm' },
  { input: '@anthropics/anthropic-agent-skills/document-skills', expected: 'npm' },
  { input: 'github:user/repo', expected: 'github' },
  { input: 'https://github.com/user/repo', expected: 'github' },
  { input: 'https://example.com/skill.zip', expected: 'url' },
  { input: 'http://example.com/skill.zip', expected: 'url' },
  { input: '/local/path/to/skill.zip', expected: 'local' },
  { input: './relative/path.zip', expected: 'local' },
];

// Copy the detectSourceType function
function detectSourceType(source: string): 'npm' | 'github' | 'url' | 'local' {
  // Check for explicit prefixes first
  if (source.startsWith('npm:')) {
    return 'npm';
  }

  if (source.startsWith('github:')) {
    return 'github';
  }

  // Check for URLs
  if (source.startsWith('http://') || source.startsWith('https://')) {
    if (source.includes('github.com')) {
      return 'github';
    }
    return 'url';
  }

  // Check for npm package pattern
  // Matches: @scope/package, @scope/package/path, user/package, user/package/path
  if (source.match(/^@[\w-]+\/[\w-]+/) || source.match(/^[\w-]+\/[\w-]+/)) {
    return 'npm';
  }

  // Default to local file
  return 'local';
}

console.log('🧪 Testing URL Detection Logic\n');
console.log('═'.repeat(60));

let passed = 0;
let failed = 0;

for (const test of testCases) {
  try {
    const result = detectSourceType(test.input);
    const status = result === test.expected ? '✅' : '❌';

    if (result === test.expected) {
      passed++;
    } else {
      failed++;
    }

    console.log(`${status} ${test.input}`);
    console.log(`   Expected: ${test.expected}, Got: ${result}\n`);
  } catch (error: any) {
    failed++;
    console.log(`❌ ${test.input}`);
    console.log(`   Error: ${error.message}\n`);
  }
}

console.log('═'.repeat(60));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('\n✅ All tests passed!');
  process.exit(0);
} else {
  console.log(`\n❌ ${failed} test(s) failed`);
  process.exit(1);
}
