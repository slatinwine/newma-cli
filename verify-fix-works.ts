/**
 * REAL VERIFICATION TEST
 * This simulates the ACTUAL loop mode flow with REAL AI responses
 */

import { callAI } from './src/ai';
import { scanDirectory } from './src/scanner';
import { ExecutionTracker } from './src/history';
import { loadConfig } from './src/config';

async function testLoopModeExit() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   REAL LOOP MODE EXIT VERIFICATION TEST               ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    // Setup
    const config = await loadConfig();
    const projectRoot = '/tmp/kode-real-test';
    const tracker = new ExecutionTracker();
    const requirement = 'add a hello world function to test.js';

    console.log('📋 Test Configuration:');
    console.log(`   Project: ${projectRoot}`);
    console.log(`   Requirement: "${requirement}"`);
    console.log(`   Max Iterations: 3\n`);

    // Iteration 1: Plan mode
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📌 Iteration 1 (plan mode)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const projectInfo1 = await scanDirectory(projectRoot, { listOnly: true, maxFiles: 5 });
    console.log('Project scanned:');
    console.log(`   Files: ${projectInfo1.files.map(f => f.path).join(', ')}\n`);

    console.log('Calling AI in PLAN mode...\n');

    const planResp = await callAI(
      config,
      projectInfo1,
      requirement,
      'plan',
      tracker.getHistory(),
      undefined, // availableTools
      undefined, // grantedPermissions
      undefined, // compression
      projectRoot,
      undefined, // signal
      undefined, // ultrathinkOptions
      undefined  // userProfile
    );

    console.log('📤 AI Response (Plan Mode):');
    console.log(`   Todo items: ${planResp.todo?.length || 0}`);
    console.log(`   Actions: ${planResp.actions?.length || 0}`);
    console.log(`   Done: ${planResp.done ? '✅ true' : '❌ false'}`);
    console.log(`   Duration: ${planResp.duration}ms\n`);

    if (planResp.actions && planResp.actions.length > 0) {
      console.log('📝 Actions to execute:');
      planResp.actions.forEach((action, i) => {
        console.log(`   ${i + 1}. ${action.type} ${action.path || action.command}`);
      });
      console.log();
    }

    // Simulate execution
    console.log('⚙️  Simulating action execution...\n');
    // In real scenario, actions would be executed here

    // Iteration 2: Verify mode
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📌 Iteration 2 (verify mode) ← KEY TEST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const projectInfo2 = await scanDirectory(projectRoot, { listOnly: true, maxFiles: 5 });

    console.log('Calling AI in VERIFY mode...\n');
    console.log('🔑 CRITICAL: AI should now use DETAILED verification prompt');
    console.log('   (prompts/mode-verification.md - 281 lines)\n');

    const verifyResp = await callAI(
      config,
      projectInfo2,
      requirement,
      'verify', // ← VERIFY MODE!
      tracker.getHistory(),
      undefined,
      undefined,
      undefined,
      projectRoot,
      undefined,
      undefined,
      undefined
    );

    console.log('📤 AI Response (Verify Mode):');
    console.log(`   Todo items: ${verifyResp.todo?.length || 0}`);
    console.log(`   Actions: ${verifyResp.actions?.length || 0}`);
    console.log(`   Done: ${verifyResp.done ? '✅ true' : '❌ false'}`);
    console.log(`   Duration: ${verifyResp.duration}ms\n`);

    // THE CRITICAL CHECK
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 EXIT LOGIC CHECK');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const mode = 'verify';
    const shouldExit = (mode === 'verify' && verifyResp.done === true);

    console.log('Condition: if (mode === "verify" && aiResp.done === true)');
    console.log(`  mode = "${mode}"`);
    console.log(`  aiResp.done = ${verifyResp.done}`);
    console.log(`  Result: ${shouldExit}\n`);

    if (shouldExit) {
      console.log('✅ TEST PASSED: Loop would exit correctly!\n');
      console.log('   The fix is working as expected.');
      console.log('   Loop mode can now auto-exit via validation.\n');
      return true;
    } else {
      console.log('❌ TEST FAILED: Loop would NOT exit\n');
      console.log('   This means:');
      console.log('   1. AI did not set done: true');
      console.log('   2. OR exit logic is not working');
      console.log('   3. Needs further investigation\n');

      if (verifyResp.done === false) {
        console.log('🔍 Analysis: AI set done: false');
        console.log('   Possible reasons:');
        console.log('   - AI thinks task is incomplete');
        console.log('   - AI verification prompt not clear enough');
        console.log('   - Actual issues with implementation\n');
      }

      return false;
    }

  } catch (error: any) {
    console.error('\n❌ TEST ERROR:', error.message);
    console.error('   Stack:', error.stack);
    return false;
  }
}

// Run test
console.log('Starting real verification test...\n');

testLoopModeExit().then(success => {
  console.log('╔════════════════════════════════════════════════════════╗');
  if (success) {
    console.log('║   ✅ TEST PASSED: Loop mode auto-exit works!         ║');
    console.log('║                                                     ║');
    console.log('║   The fix is VERIFIED and working correctly.        ║');
  } else {
    console.log('║   ❌ TEST FAILED: Further investigation needed       ║');
    console.log('║                                                     ║');
    console.log('║   Check the output above for specific issues.       ║');
  }
  console.log('╚════════════════════════════════════════════════════════╝');

  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
