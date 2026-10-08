#!/usr/bin/env ts-node
/**
 * Test script for Two-Phase Agent System (V2 - Tool Calling based)
 */

import { TwoPhaseCoordinatorV2 } from './src/agents/two-phase';
import { Config } from './src/config';
import { ToolExecutor } from './src/executor-v2';
import { ExecutionTracker } from './src/history';
import { RollbackManager } from './src/rollback';
import { scanDirectory } from './src/scanner';

// Mock inquirer to auto-confirm (after imports)
const inquirer = require('inquirer');
const originalPrompt = inquirer.prompt.bind(inquirer);
inquirer.prompt = async (questions: any) => {
  return { confirm: true };
};

async function testTwoPhaseSystem() {
  console.log('\n🧪 Testing Two-Phase Agent System (V2 - Tool Calling)\n');
  console.log('═'.repeat(60));

  try {
    // 1. Setup
    console.log('\n📦 Setting up test environment...\n');
    const config = require('./src/config').getDefaultConfig();
    const projectRoot = process.cwd();
    const tracker = new ExecutionTracker();
    const rollbackManager = new RollbackManager(projectRoot);

    // 2. Create tool executor
    const { PermissionLevel } = require('./src/permissions');
    const toolExecutor = new ToolExecutor(
      tracker,
      rollbackManager,
      config,
      PermissionLevel.SAFE  // permission level
    );

    // 3. Scan project
    console.log('🔍 Scanning project...\n');
    const projectInfo = await scanDirectory(projectRoot);

    // 4. Create coordinator
    const coordinator = new TwoPhaseCoordinatorV2(config, toolExecutor);

    // 5. Test requirement
    const testRequirement = 'Create a simple README explaining what this project does';

    console.log('\n🎯 Test Requirement:');
    console.log(`  "${testRequirement}"\n`);

    // 6. Execute two-phase process
    const context = {
      projectRoot,
      projectInfo,
      requirement: testRequirement,
      config,
    };

    const result = await coordinator.execute(context);

    // 7. Show results
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Test Results');
    console.log('═'.repeat(60));

    if (result.success) {
      console.log(`\n✅ SUCCESS`);
      console.log(`   Phase: ${result.phase}`);
      console.log(`   Duration: ${(result.duration / 1000).toFixed(2)}s`);

      if (result.data) {
        const plan = result.data as any;
        console.log(`   Todo items: ${plan.todo?.length || 0}`);
        console.log(`   Actions: ${plan.actions?.length || 0}`);
      }
    } else {
      console.log(`\n❌ FAILED`);
      console.log(`   Phase: ${result.phase}`);
      console.log(`   Duration: ${(result.duration / 1000).toFixed(2)}s`);
      console.log(`   Error: ${result.error}`);
    }

    console.log('\n' + '═'.repeat(60) + '\n');

    // 8. Cleanup
    console.log('🧹 Cleaning up test artifacts...\n');
    const fs = require('fs');
    if (fs.existsSync('TEST_README.md')) {
      fs.unlinkSync('TEST_README.md');
      console.log('✅ Removed TEST_README.md\n');
    }

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
testTwoPhaseSystem()
  .then(() => {
    console.log('✅ Test completed\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test error:', error);
    process.exit(1);
  });
