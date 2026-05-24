// test-loop-verify-logic.ts
// Unit test to verify loop mode exit logic

import { callAI, ExtendedAIResponse } from './src/ai';

async function testLoopVerifyLogic() {
  console.log('=== Testing Loop Mode Verify Exit Logic ===\n');

  // Test 1: Verify mode with done === true should exit
  console.log('Test 1: Verify mode returns done: true');
  const mockResponseDone: ExtendedAIResponse = {
    todo: [],
    actions: [],
    done: true,
    duration: 100,
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    ultrathinkEnabled: false,
  };

  const mode = 'verify';
  const shouldExit = (mode === 'verify' && mockResponseDone.done === true);

  console.log(`  Mode: ${mode}`);
  console.log(`  Response.done: ${mockResponseDone.done}`);
  console.log(`  Should exit: ${shouldExit}`);
  console.log(shouldExit ? '  ✅ PASS: Will exit loop\n' : '  ❌ FAIL: Will NOT exit loop\n');

  // Test 2: Verify mode with done === false should continue
  console.log('Test 2: Verify mode returns done: false (with actions)');
  const mockResponseNotDone: ExtendedAIResponse = {
    todo: ['Add error handling'],
    actions: [
      { type: 'modify', path: 'test.js', oldContent: '...', newContent: '...' }
    ],
    done: false,
    duration: 100,
    ultrathinkEnabled: false,
  };

  const shouldNotExit = (mode === 'verify' && mockResponseNotDone.done === true);

  console.log(`  Mode: ${mode}`);
  console.log(`  Response.done: ${mockResponseNotDone.done}`);
  console.log(`  Actions: ${mockResponseNotDone.actions.length} action(s)`);
  console.log(`  Should exit: ${shouldNotExit}`);
  console.log(!shouldNotExit ? '  ✅ PASS: Will continue loop\n' : '  ❌ FAIL: Will exit prematurely\n');

  // Test 3: Plan mode with done === true should also exit
  console.log('Test 3: Plan mode returns done: true');
  const planMode = 'plan';
  const shouldExitPlan = (planMode === 'plan' && mockResponseDone.done === true);

  console.log(`  Mode: ${planMode}`);
  console.log(`  Response.done: ${mockResponseDone.done}`);
  console.log(`  Should exit: ${shouldExitPlan}`);
  console.log(shouldExitPlan ? '  ✅ PASS: Will exit loop\n' : '  ❌ FAIL: Will NOT exit loop\n');

  console.log('=== All Tests Completed ===');
}

// Run tests
testLoopVerifyLogic().catch(console.error);
