#!/usr/bin/env ts-node

/**
 * Test: Verify that the verification system actually works end-to-end
 */

import { Verifier, autoDetectStages, BUILTIN_STAGES } from './src/verifier';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function testVerification() {
  console.log('🧪 Testing Verification System');
  console.log('=============================\n');

  // Create a temporary test directory
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kode-verify-test-'));
  console.log(`📁 Test directory: ${tmpDir}\n`);

  try {
    // Test 1: No project (should pass - nothing to verify)
    console.log('Test 1: Empty directory (should pass)');
    const verifier1 = new Verifier();
    const result1 = await verifier1.verify(tmpDir, 'fast');
    console.log(`Result: ${result1.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Message: ${result1.message}\n`);

    // Test 2: TypeScript project with errors
    console.log('Test 2: TypeScript with errors (should fail)');
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { target: 'ES2020', module: 'commonjs' }
    }));

    fs.writeFileSync(path.join(tmpDir, 'test.ts'), `
      const x: string = 123; // Type error
      console.log(x);
    `);

    const verifier2 = new Verifier();
    verifier2.addStage(BUILTIN_STAGES.SYNTAX);
    const result2 = await verifier2.verify(tmpDir, 'fast');
    console.log(`Result: ${result2.passed ? '❌ FAIL (should have failed)' : '✅ PASS (correctly failed)'}`);
    console.log(`Message: ${result2.message}`);
    if (result2.details) {
      console.log(`Details: ${result2.details.slice(0, 3).join('\n         ')}`);
    }
    console.log();

    // Test 3: Auto-detection
    console.log('Test 3: Auto-detection (should detect TypeScript)');
    const verifier3 = new Verifier();
    autoDetectStages(verifier3, tmpDir);
    const result3 = await verifier3.verify(tmpDir, 'fast');
    console.log(`Result: ${result3.passed ? '❌ FAIL (should have failed)' : '✅ PASS (correctly failed)'}`);
    console.log(`Message: ${result3.message}\n`);

    // Test 4: Fix the error
    console.log('Test 4: Fixed TypeScript (should pass)');
    fs.writeFileSync(path.join(tmpDir, 'test.ts'), `
      const x: string = "hello";
      console.log(x);
    `);

    const verifier4 = new Verifier();
    verifier4.addStage(BUILTIN_STAGES.SYNTAX);
    const result4 = await verifier4.verify(tmpDir, 'fast');
    console.log(`Result: ${result4.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Message: ${result4.message}\n`);

    console.log('=============================');
    console.log('✅ All verification tests completed');

  } finally {
    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log(`\n🧹 Cleaned up test directory`);
  }
}

testVerification().catch(console.error);
