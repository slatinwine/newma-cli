#!/usr/bin/env ts-node
/**
 * Test improved plan mode
 * Verifies that the enhanced prompts produce better responses
 */

import { callAI } from './src/ai';
import { Config } from './src/config';
import { scanDirectory } from './src/scanner';

async function testImprovedPlan() {
  console.log('\n[TEST] Testing Improved Plan Mode\n');
  console.log('=' .repeat(60));

  try {
    const config = require('./src/config').getDefaultConfig();
    const projectRoot = process.cwd();

    // Scan project
    console.log('\n[1/3] Scanning project...');
    const projectInfo = await scanDirectory(projectRoot);
    console.log(`✓ Scanned ${Object.keys(projectInfo).length} files`);

    // Test 1: Simple task (should have minimal todo)
    console.log('\n[2/3] Test 1: Simple Task');
    console.log('Requirement: "Run the test suite"\n');

    const simpleResponse = await callAI(
      config,
      projectInfo,
      'Run the test suite',
      'plan',
      undefined,
      undefined,
      undefined,
      undefined,
      projectRoot
    );

    console.log('Response Analysis:');
    console.log(`  - Todo items: ${simpleResponse.todo.length}`);
    console.log(`  - Actions: ${simpleResponse.actions.length}`);
    console.log(`  - First action type: ${simpleResponse.actions[0]?.type || 'N/A'}`);

    // Verify simple task has minimal planning
    const isMinimal = simpleResponse.todo.length <= 1 && simpleResponse.actions.length <= 2;
    if (isMinimal) {
      console.log('  ✓ PASS: Simple task has minimal planning');
    } else {
      console.log('  ✗ FAIL: Simple task is over-planned');
    }

    // Test 2: Complex task (should have structured planning)
    console.log('\n[3/3] Test 2: Complex Task');
    console.log('Requirement: "Add user authentication with JWT"\n');

    const complexResponse = await callAI(
      config,
      projectInfo,
      'Add user authentication with JWT tokens',
      'plan',
      undefined,
      undefined,
      undefined,
      undefined,
      projectRoot
    );

    console.log('Response Analysis:');
    console.log(`  - Todo items: ${complexResponse.todo.length}`);
    console.log(`  - Actions: ${complexResponse.actions.length}`);

    if (complexResponse.todo.length > 0) {
      console.log('\n  Todo items:');
      complexResponse.todo.forEach((item, idx) => {
        console.log(`    ${idx + 1}. ${item}`);
      });
    }

    // Verify complex task has structured planning
    const isStructured = complexResponse.todo.length >= 3;
    if (isStructured) {
      console.log('\n  ✓ PASS: Complex task has structured planning');
    } else {
      console.log('\n  ✗ FAIL: Complex task lacks structure');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('[SUMMARY] Test Results');
    console.log('='.repeat(60));

    if (isMinimal && isStructured) {
      console.log('✓ All tests passed!');
      console.log('\nImprovements verified:');
      console.log('  • Simple tasks use minimal planning');
      console.log('  • Complex tasks have structured todos');
      console.log('  • Task complexity is properly assessed');
      return true;
    } else {
      console.log('✗ Some tests failed');
      return false;
    }

  } catch (error: any) {
    console.error('\n[ERROR]', error.message);
    if (error.message.includes('API')) {
      console.error('\nMake sure OPENAI_API_KEY is set in .env file');
    }
    process.exit(1);
  }
}

testImprovedPlan()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
