#!/usr/bin/env node

/**
 * State Tracker Test
 *
 * 验证状态追踪器的功能
 */

const assert = require('assert');

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Running State Tracker Tests');
  console.log('='.repeat(60) + '\n');

  // Test 1: Load StateTracker
  try {
    const { StateTracker, createStateTracker, ExecutionStage } = require('./dist/state/tracker');

    assert.ok(typeof StateTracker === 'function');
    assert.ok(typeof createStateTracker === 'function');
    assert.ok(typeof ExecutionStage === 'object');
    console.log('✅ Test 1: StateTracker module loaded successfully');
  } catch (error) {
    console.error('❌ Test 1 Failed:', error.message);
    process.exit(1);
  }

  // Test 2: Create StateTracker
  try {
    const { createStateTracker } = require('./dist/state/tracker');
    const tracker = createStateTracker({ debug: false });

    assert.strictEqual(tracker.getCurrentStage(), 'idle');
    assert.strictEqual(tracker.isTerminal(), false);
    console.log('✅ Test 2: StateTracker created successfully');
    console.log('   Initial state:', tracker.getCurrentStage());
  } catch (error) {
    console.error('❌ Test 2 Failed:', error.message);
    process.exit(1);
  }

  // Test 3: State transitions
  try {
    const { createStateTracker, ExecutionStage } = require('./dist/state/tracker');
    const tracker = createStateTracker({ debug: false });

    tracker.enterPlanning('Test planning');
    assert.strictEqual(tracker.getCurrentStage(), ExecutionStage.PLANNING);
    console.log('✅ Test 3a: Enter planning state');

    tracker.enterExecuting('Test executing');
    assert.strictEqual(tracker.getCurrentStage(), ExecutionStage.EXECUTING);
    console.log('✅ Test 3b: Enter executing state');

    tracker.enterVerifying('Test verifying');
    assert.strictEqual(tracker.getCurrentStage(), ExecutionStage.VERIFYING);
    console.log('✅ Test 3c: Enter verifying state');

    tracker.complete('Test complete');
    assert.strictEqual(tracker.getCurrentStage(), ExecutionStage.COMPLETED);
    assert.strictEqual(tracker.isTerminal(), true);
    console.log('✅ Test 3d: Complete state');
  } catch (error) {
    console.error('❌ Test 3 Failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  // Test 4: State history
  try {
    const { createStateTracker, ExecutionStage } = require('./dist/state/tracker');
    const tracker = createStateTracker({ debug: false });

    tracker.enterPlanning('Step 1');
    tracker.enterExecuting('Step 2');
    tracker.enterVerifying('Step 3');
    tracker.complete('Done');

    const history = tracker.getHistory();
    assert.strictEqual(history.length, 4);
    console.log('✅ Test 4a: State history recorded');
    console.log('   History length:', history.length);

    const stats = tracker.getStateStats();
    assert.ok(stats.has(ExecutionStage.PLANNING));
    assert.ok(stats.has(ExecutionStage.EXECUTING));
    assert.ok(stats.has(ExecutionStage.VERIFYING));
    assert.ok(stats.has(ExecutionStage.COMPLETED));
    console.log('✅ Test 4b: State statistics computed');
    console.log('   States tracked:', stats.size);
  } catch (error) {
    console.error('❌ Test 4 Failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  // Test 5: Visualization
  try {
    const { createStateTracker } = require('./dist/state/tracker');
    const tracker = createStateTracker({ debug: false });

    tracker.enterPlanning('Planning task');
    tracker.enterExecuting('Executing task');
    tracker.complete('Task done');

    const formatted = tracker.format();
    assert.ok(typeof formatted === 'string');
    assert.ok(formatted.includes('COMPLETED'));
    console.log('✅ Test 5a: Format state output');
    console.log('   Formatted output:\n' + formatted.split('\n').map(l => '     ' + l).join('\n'));

    const visualized = tracker.visualizeHistory();
    assert.ok(typeof visualized === 'string');
    assert.ok(visualized.includes('State Transition History'));
    console.log('✅ Test 5b: Visualize history');
  } catch (error) {
    console.error('❌ Test 5 Failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  // Test 6: Error handling
  try {
    const { createStateTracker, ExecutionStage } = require('./dist/state/tracker');
    const tracker = createStateTracker({ debug: false });

    tracker.error('Test error', { code: 500 });
    assert.strictEqual(tracker.getCurrentStage(), ExecutionStage.ERROR);
    assert.strictEqual(tracker.isTerminal(), true);
    console.log('✅ Test 6: Error state handling');
  } catch (error) {
    console.error('❌ Test 6 Failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  // Test 7: Reset functionality
  try {
    const { createStateTracker, ExecutionStage } = require('./dist/state/tracker');
    const tracker = createStateTracker({ debug: false });

    tracker.enterPlanning('Test');
    tracker.complete('Done');
    assert.strictEqual(tracker.getCurrentStage(), ExecutionStage.COMPLETED);

    tracker.reset();
    assert.strictEqual(tracker.getCurrentStage(), ExecutionStage.IDLE);
    assert.strictEqual(tracker.getHistory().length, 0);
    console.log('✅ Test 7: Reset functionality');
  } catch (error) {
    console.error('❌ Test 7 Failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 All State Tracker Tests Passed!');
  console.log('='.repeat(60) + '\n');
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
