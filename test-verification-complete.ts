#!/usr/bin/env ts-node
/**
 * Comprehensive Verification System Test
 *
 * This test validates that the verification system:
 * 1. Correctly detects project capabilities
 * 2. Auto-registers appropriate stages
 * 3. Executes verification correctly
 * 4. Reports results accurately
 * 5. Handles errors gracefully
 */

import { Verifier, autoDetectStages, hasTypeScript, hasESLint, hasTests, hasBuildScript } from './src/verifier';

async function runTest() {
  const projectRoot = process.cwd();

  console.log('🧪 Comprehensive Verification System Test\n');
  console.log('='.repeat(70));

  // Test 1: Project Detection
  console.log('\nTest 1: Project Capability Detection');
  console.log('-'.repeat(70));

  const capabilities = {
    typescript: hasTypeScript(projectRoot),
    eslint: hasESLint(projectRoot),
    tests: hasTests(projectRoot),
    build: hasBuildScript(projectRoot),
  };

  console.log('Project Root:', projectRoot);
  console.log('\nDetected Capabilities:');
  Object.entries(capabilities).forEach(([key, value]) => {
    console.log(`  ${key.padEnd(12)}: ${value ? '✅ Yes' : '❌ No'}`);
  });

  const detectedCount = Object.values(capabilities).filter(v => v).length;
  console.log(`\nTotal: ${detectedCount} capabilities detected`);

  // Test 2: Auto-Detection
  console.log('\n\nTest 2: Stage Auto-Detection');
  console.log('-'.repeat(70));

  const verifier = new Verifier();
  autoDetectStages(verifier, projectRoot);

  const stages = verifier.listStages();
  console.log(`\nAuto-registered ${stages.length} verification stages:`);

  stages.forEach((s, idx) => {
    const icon = s.required ? '⚠️ ' : '☐️ ';
    console.log(`  ${idx + 1}. ${icon}${s.name.padEnd(20)} (${s.required ? 'required' : 'optional'})`);
  });

  // Validate stages
  const expectedStages = [];
  if (capabilities.typescript) expectedStages.push('Syntax Check');
  if (capabilities.eslint) expectedStages.push('Linting');
  if (capabilities.tests) expectedStages.push('Test Suite');
  if (capabilities.build) expectedStages.push('Build Check');

  console.log(`\nExpected: ${expectedStages.length} stages`);
  console.log(`Detected: ${stages.length} stages`);

  const detectionCorrect = stages.length === expectedStages.length;
  console.log(detectionCorrect ? '✅ PASS' : '❌ FAIL', '- Auto-detection working correctly');

  // Test 3: Verification Execution
  console.log('\n\nTest 3: Verification Execution (Fast Mode)');
  console.log('-'.repeat(70));

  try {
    verifier.printSummary();

    console.log('Running verification...\n');
    const result = await verifier.verify(projectRoot, 'fast');

  console.log('\nResults:');
  console.log(`  Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`  Message: ${result.message}`);

  if (result.details && result.details.length > 0) {
    console.log(`  Details: ${result.details.length} line(s)`);
    result.details.slice(0, 5).forEach(detail => {
      console.log(`    - ${detail}`);
    });
    if (result.details.length > 5) {
      console.log(`    ... and ${result.details.length - 5} more`);
    }
  } else {
    console.log(`  Details: None`);
  }

  // Test 4: Result Validation
  console.log('\n\nTest 4: Result Validation');
  console.log('-'.repeat(70));

  const tests = [
    {
      name: 'Result is an object',
      check: typeof result === 'object' && result !== null,
    },
    {
      name: 'Result has "passed" boolean',
      check: typeof result.passed === 'boolean',
    },
    {
      name: 'Result has "message" string',
      check: typeof result.message === 'string',
    },
    {
      name: 'Result has "details" array',
      check: Array.isArray(result.details),
    },
  ];

  let passedTests = 0;
  tests.forEach(test => {
    const passed = test.check;
    if (passed) passedTests++;
    console.log(`  ${passed ? '✅' : '❌'} ${test.name}`);
  });

  console.log(`\nValidation: ${passedTests}/${tests.length} tests passed`);

  // Test 5: Stage Behavior
  console.log('\n\nTest 5: Stage Behavior');
  console.log('-'.repeat(70));

  console.log('\nRequired Stages:');
  stages.filter(s => s.required).forEach(s => {
    console.log(`  - ${s.name}: Must pass for verification to succeed`);
  });

  console.log('\nOptional Stages:');
  stages.filter(s => !s.required).forEach(s => {
    console.log(`  - ${s.name}: Can fail without failing overall verification`);
  });

  // Final Summary
  console.log('\n' + '='.repeat(70));
  console.log('\n✅ VERIFICATION SYSTEM TEST COMPLETE\n');

  console.log('Summary:');
  console.log(`  • Project has ${detectedCount} verification capabilities`);
  console.log(`  • Auto-detected ${stages.length} verification stages`);
  console.log(`  • Verification status: ${result.passed ? 'PASSED' : 'FAILED'}`);
  console.log(`  • Result validation: ${passedTests}/${tests.length} checks passed\n`);

  if (result.passed && passedTests === tests.length && detectionCorrect) {
    console.log('🎉 All systems operational!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some issues detected - see details above\n');
    process.exit(1);
  }

} catch (error: any) {
  console.error('\n❌ Verification execution failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
  }
}

// Run the test
runTest().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
