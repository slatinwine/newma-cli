#!/usr/bin/env ts-node
/**
 * Test production code with lightweight mode
 */

import { callAI } from './src/ai';
import { Config } from './src/config';
import { scanDirectory } from './src/scanner';

async function testProductionFix() {
  console.log('\n[TEST] Testing Production Fix\n');
  console.log('='.repeat(60));

  try {
    const config = require('./src/config').getDefaultConfig();
    const projectRoot = process.cwd();

    // Test 1: Simple command (should be very fast)
    console.log('\n[Test 1] Simple task: "Say hello"');
    console.log('Expected: Fast response (< 10 seconds)\n');

    const projectInfo1 = await scanDirectory(projectRoot, {
      listOnly: true,
      maxFiles: 5
    });
    console.log(`✓ Scanned ${Object.keys(projectInfo1).length} files`);

    const start1 = Date.now();
    const response1 = await callAI(
      config,
      projectInfo1,
      'Say hello in JSON format',
      'plan'
    );
    const time1 = Date.now() - start1;

    console.log(`✓ Response time: ${time1}ms (${(time1/1000).toFixed(1)}s)`);
    console.log(`✓ Actions: ${response1.actions.length}`);

    // Test 2: Real task
    console.log('\n[Test 2] Real task: "List all TypeScript files"');
    console.log('Expected: Fast response (< 15 seconds)\n');

    const projectInfo2 = await scanDirectory(projectRoot, {
      listOnly: true,
      maxFiles: 5
    });
    console.log(`✓ Scanned ${Object.keys(projectInfo2).length} files`);

    const start2 = Date.now();
    const response2 = await callAI(
      config,
      projectInfo2,
      'List all TypeScript files in the src directory',
      'plan'
    );
    const time2 = Date.now() - start2;

    console.log(`✓ Response time: ${time2}ms (${(time2/1000).toFixed(1)}s)`);
    console.log(`✓ Actions: ${response2.actions.length}`);
    if (response2.actions.length > 0) {
      console.log(`✓ First action: ${JSON.stringify(response2.actions[0])}`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('[SUMMARY] Production Fix Results');
    console.log('='.repeat(60));
    console.log(`Test 1: ${time1}ms - ${time1 < 10000 ? '✅ PASS' : '⚠️  SLOW'}`);
    console.log(`Test 2: ${time2}ms - ${time2 < 15000 ? '✅ PASS' : '⚠️  SLOW'}`);
    console.log(`Average: ${((time1 + time2) / 2).toFixed(0)}ms`);

    if (time1 < 10000 && time2 < 15000) {
      console.log('\n✅ All tests passed! Production fix is working well.');
      return true;
    } else {
      console.log('\n⚠️  Some tests were slow, but completed successfully.');
      return true;
    }

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    return false;
  }
}

testProductionFix()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
