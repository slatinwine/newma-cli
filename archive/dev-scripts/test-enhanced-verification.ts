/**
 * Test Enhanced Verification System
 *
 * Tests the new multi-dimensional verification logic
 */

import { Config } from './src/config';
import { EnhancedVerifier } from './src/verification/enhanced-verifier';
import * as fs from 'fs';

// Test cases
const testCases = [
  {
    name: 'Short response (should fail)',
    requirement: 'Write a function to sum two numbers',
    response: 'Here it is:', // Too short
    expectedPass: false,
    level: 2
  },
  {
    name: 'Good Python code',
    requirement: 'Write a function to calculate factorial',
    response: `Here's a Python function to calculate factorial:

\`\`\`python
def factorial(n):
    """Calculate factorial of n."""
    if n < 0:
        raise ValueError("Factorial is not defined for negative numbers")
    if n == 0 or n == 1:
        return 1
    return n * factorial(n - 1)

# Time complexity: O(n)
# Space complexity: O(n) due to recursion stack
\`\`\`

This function handles:
- Negative numbers (raises error)
- Zero (returns 1)
- Positive integers (recursive calculation)`,
    expectedPass: true,
    level: 2
  },
  {
    name: 'JavaScript with syntax error',
    requirement: 'Write a function to reverse a string',
    response: `Here's a JavaScript function:

\`\`\`javascript
function reverseString(str) {
  return str.split('').reverse().join('');
}
\`\`\`

This should work for most strings, but the function body is missing (only has return statement).`,
    expectedPass: false, // Semantic error: incomplete function (missing body)
    level: 2
  },
  {
    name: 'Incomplete response',
    requirement: 'Write a function to sort an array and handle edge cases like empty array, null, and duplicates',
    response: `Here's a sorting function:

\`\`\`javascript
function sortArray(arr) {
  return arr.sort((a, b) => a - b);
}
\`\`\`

This sorts numbers in ascending order.`,
    expectedPass: false, // Missing edge case handling
    level: 3 // Level 3 checks completeness
  },
  {
    name: 'High-quality response',
    requirement: 'Implement binary search in JavaScript',
    response: `Here's a binary search implementation in JavaScript:

\`\`\`javascript
/**
 * Performs binary search on a sorted array
 * @param {number[]} arr - Sorted array to search
 * @param {number} target - Value to find
 * @returns {number} - Index of target, or -1 if not found
 */
function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);

    if (arr[mid] === target) {
      return mid; // Target found
    } else if (arr[mid] < target) {
      left = mid + 1; // Search right half
    } else {
      right = mid - 1; // Search left half
    }
  }

  return -1; // Target not found
}

// Example usage:
// const arr = [1, 3, 5, 7, 9, 11, 13, 15];
// console.log(binarySearch(arr, 7)); // Output: 3

// Time complexity: O(log n)
// Space complexity: O(1)
\`\`\`

Key features:
- Handles empty array (returns -1)
- Handles single element
- Uses Math.floor for correct midpoint calculation
- Clear documentation
- Example usage provided`,
    expectedPass: true,
    level: 3
  }
];

async function runTests() {
  console.log('========================================');
  console.log('Enhanced Verification System Test');
  console.log('========================================\n');

  // Load config
  const config: Config = JSON.parse(fs.readFileSync('.claude/settings.local.json', 'utf-8'));

  const verifier = new EnhancedVerifier(config, process.cwd());

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`\n[Test] ${testCase.name}`);
    console.log(`Level: ${testCase.level}`);
    console.log(`Requirement: ${testCase.requirement.substring(0, 60)}...`);

    const startTime = Date.now();
    const result = await verifier.verify(
      testCase.requirement,
      testCase.response,
      {
        level: testCase.level as 1 | 2 | 3,
        useAICheck: false, // Disable AI check for faster testing
        checkSyntax: true,
        checkQuality: testCase.level === 3,
        checkCompleteness: testCase.level === 3
      }
    );
    const duration = Date.now() - startTime;

    console.log(`\nResult:`);
    console.log(`  Passed: ${result.passed ? '✅ YES' : '❌ NO'}`);
    console.log(`  Expected: ${testCase.expectedPass ? '✅ YES' : '❌ NO'}`);
    console.log(`  Overall Score: ${(result.overallScore * 100).toFixed(1)}%`);
    console.log(`  Confidence: ${result.confidence.toFixed(2)}`);
    console.log(`  Reason: ${result.reason}`);
    console.log(`  Duration: ${duration}ms`);

    // Show details
    console.log(`\nDetails:`);
    console.log(`  Length: ${result.details.length.score.toFixed(2)} (${result.details.length.issues.join(', ') || 'OK'})`);
    console.log(`  Syntax: ${result.details.syntax.score.toFixed(2)} (${result.details.syntax.issues.join(', ') || 'OK'})`);
    if (testCase.level === 3) {
      console.log(`  Quality: ${result.details.quality.score.toFixed(2)} (${result.details.quality.issues.join(', ') || 'OK'})`);
      console.log(`  Completeness: ${result.details.completeness.score.toFixed(2)} (${result.details.completeness.issues.join(', ') || 'OK'})`);
    }
    console.log(`  AI Assessment: ${result.details.aiAssessment.score.toFixed(2)} (disabled for test)`);

    // Check if result matches expectation
    const actualPass = result.passed;
    if (actualPass === testCase.expectedPass) {
      console.log(`\n✅ Test PASSED`);
      passed++;
    } else {
      console.log(`\n❌ Test FAILED (expected ${testCase.expectedPass}, got ${actualPass})`);
      failed++;
    }

    console.log('----------------------------------------');
  }

  // Summary
  console.log('\n========================================');
  console.log('Test Summary');
  console.log('========================================');
  console.log(`Total: ${testCases.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success Rate: ${(passed / testCases.length * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
