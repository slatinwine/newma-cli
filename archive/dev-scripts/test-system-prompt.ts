#!/usr/bin/env ts-node
/**
 * Test script to verify SYSTEM_PROMPT.md changes
 */

import { callAI } from './src/ai';
import { Config } from './src/config';
import { scanDirectory } from './src/scanner';

async function testSystemPrompt() {
  console.log('\n[TEST] Verifying SYSTEM_PROMPT.md Changes\n');

  try {
    const config = require('./src/config').getDefaultConfig();
    const projectRoot = process.cwd();

    console.log('[1/3] Scanning project...');
    const projectInfo = await scanDirectory(projectRoot);
    console.log(`OK: Scanned ${Object.keys(projectInfo).length} files\n`);

    // Test 1: Simple task
    console.log('[2/3] Test 1: Simple Task (run tests)');
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

    console.log(`Response Analysis:`);
    console.log(`  - Todo items: ${simpleResponse.todo.length}`);
    console.log(`  - Actions: ${simpleResponse.actions.length}\n`);

    if (simpleResponse.actions.length > 0) {
      console.log('Actions:');
      simpleResponse.actions.forEach((action, idx) => {
        const cmd = action.command || action.path || 'N/A';
        console.log(`  ${idx + 1}. ${action.type}: ${cmd}`);
      });
    }

    // Test 2: Complex task
    console.log('\n[3/3] Test 2: Complex Task (add authentication)');
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

    console.log(`Response Analysis:`);
    console.log(`  - Todo items: ${complexResponse.todo.length}`);
    console.log(`  - Actions: ${complexResponse.actions.length}\n`);

    if (complexResponse.todo.length > 0) {
      console.log('Todo list:');
      complexResponse.todo.forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item}`);
      });
    }

    // Verify action types
    console.log('\n[VERIFICATION] Checking action types...');
    const validTypes = ['create', 'modify', 'delete', 'run', 'verify'];
    let allValid = true;

    [...simpleResponse.actions, ...complexResponse.actions].forEach((action, idx) => {
      if (!validTypes.includes(action.type)) {
        console.log(`FAIL: Invalid action type: ${action.type}`);
        allValid = false;
      }
    });

    if (allValid) {
      console.log('PASS: All action types are valid\n');
    }

    console.log('SUCCESS: Tests completed!\n');

  } catch (error: any) {
    console.error(`\nERROR: ${error.message}`);
    if (error.message.includes('API')) {
      console.error('\nMake sure OPENAI_API_KEY is set in .env file');
    }
    process.exit(1);
  }
}

testSystemPrompt()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('ERROR:', error);
    process.exit(1);
  });
