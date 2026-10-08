// test-command-crossplatform.ts
/**
 * Test cross-platform compatibility for command tool
 */

import { platform } from 'os';
import { commandTool, isSafeCommand, getCommandRisk } from './src/tools/builtin/command';

const currentPlatform = platform();

console.log(`\n🔍 Testing Command Tool Cross-Platform Compatibility`);
console.log(`📍 Current Platform: ${currentPlatform}\n`);

// Test cases
const testCases = [
  {
    name: 'Safe npm command',
    params: { command: 'npm install', shell: 'auto' },
    expectedSafe: true,
    expectedRisk: 'low',
  },
  {
    name: 'Safe git command',
    params: { command: 'git status', shell: 'auto' },
    expectedSafe: true,
    expectedRisk: 'low',
  },
  {
    name: 'Dangerous delete command (Unix)',
    params: { command: 'rm -rf /tmp/test', shell: 'auto' },
    expectedSafe: false,
    expectedRisk: 'high',
  },
  {
    name: 'Platform-specific dangerous command',
    params: {
      command: currentPlatform === 'win32'
        ? 'Remove-Item -Recurse -Force C:\\temp'
        : 'rm -rf /tmp/test',
      shell: 'auto'
    },
    expectedSafe: false,
    expectedRisk: 'high',
  },
  {
    name: 'Unknown command (medium risk)',
    params: { command: 'echo "hello"', shell: 'auto' },
    expectedSafe: false,
    expectedRisk: 'medium',
  },
];

// Run tests
async function runTests() {
  let passed = 0;
  let failed = 0;

  console.log('📋 Running Tests...\n');

  for (const test of testCases) {
    console.log(`Test: ${test.name}`);
    console.log(`  Command: ${test.params.command}`);

    try {
      // Test validation
      const validation = commandTool.validate!(test.params);
      console.log(`  Validation: ${validation.valid ? '✅' : '❌'}`);
      if (!validation.valid && validation.errors.length > 0) {
        console.log(`  Errors: ${validation.errors.join(', ')}`);
      }

      // Test isSafeCommand
      const safe = isSafeCommand(
        test.params.command as string,
        test.params.shell as any
      );
      const safeMatch = safe === test.expectedSafe;
      console.log(`  Safe: ${safe ? 'Yes' : 'No'} (Expected: ${test.expectedSafe ? 'Yes' : 'No'}) ${safeMatch ? '✅' : '❌'}`);

      // Test getCommandRisk
      const risk = getCommandRisk(
        test.params.command as string,
        test.params.shell as any
      );
      const riskMatch = risk === test.expectedRisk;
      console.log(`  Risk: ${risk} (Expected: ${test.expectedRisk}) ${riskMatch ? '✅' : '❌'}`);

      if (safeMatch && riskMatch) {
        passed++;
        console.log(`  Status: ✅ PASSED\n`);
      } else {
        failed++;
        console.log(`  Status: ❌ FAILED\n`);
      }
    } catch (error: any) {
      failed++;
      console.log(`  Status: ❌ ERROR: ${error.message}\n`);
    }
  }

  // Summary
  console.log('═══════════════════════════════════════════════════');
  console.log(`\n📊 Test Summary:`);
  console.log(`  Total: ${testCases.length}`);
  console.log(`  Passed: ${passed} ✅`);
  console.log(`  Failed: ${failed} ❌`);
  console.log(`  Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%\n`);

  // Platform info
  console.log('🖥️  Platform-Specific Tests:');
  if (currentPlatform === 'win32') {
    console.log('  • Windows CMD: rmdir /s /q (dangerous)');
    console.log('  • Windows PowerShell: Remove-Item -Recurse (dangerous)');
    console.log('  • Auto: PowerShell preferred\n');
  } else {
    console.log('  • Unix: rm -rf (dangerous)');
    console.log('  • Unix: sudo (requires approval)\n');
  }
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
