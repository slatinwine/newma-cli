#!/usr/bin/env node

/**
 * Dual Track System Test (Compiled)
 *
 * 验证旧系统和新运行时系统都能正常工作
 */

const assert = require('assert');

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Running Dual Track System Tests');
  console.log('='.repeat(60) + '\n');

  // Test 1: Load runtime-integration module
  try {
    const runtimeIntegration = require('./dist/runtime-integration');
    assert.ok(typeof runtimeIntegration.createRuntimeConfig === 'function');
    assert.ok(typeof runtimeIntegration.createAndInitializeRuntime === 'function');
    assert.ok(typeof runtimeIntegration.startRuntime === 'function');
    assert.ok(typeof runtimeIntegration.stopRuntime === 'function');
    console.log('✅ Test 1: Runtime integration module loaded successfully');
  } catch (error) {
    console.error('❌ Test 1 Failed:', error.message);
    process.exit(1);
  }

  // Test 2: Load ToolExecutorAdapter
  try {
    const { ToolExecutorAdapter, createToolExecutorAdapter } = require('./dist/executors/tool-executor-adapter');
    assert.ok(typeof ToolExecutorAdapter === 'function');
    assert.ok(typeof createToolExecutorAdapter === 'function');
    console.log('✅ Test 2: ToolExecutorAdapter loaded successfully');
  } catch (error) {
    console.error('❌ Test 2 Failed:', error.message);
    process.exit(1);
  }

  // Test 3: Load and use runtime
  try {
    const { createAndInitializeRuntime, startRuntime, stopRuntime } = require('./dist/runtime-integration');
    const { ToolExecutor } = require('./dist/executor-v2');
    const { ExecutionTracker } = require('./dist/history');
    const { RollbackManager } = require('./dist/rollback');
    const { getDefaultConfig } = require('./dist/config');

    const tracker = new ExecutionTracker();
    const rollbackManager = new RollbackManager('/tmp/test-dual-track');
    const config = getDefaultConfig();
    config.eventSystem = { enabled: true, debugMode: false };
    const toolExecutor = new ToolExecutor(tracker, rollbackManager, config);

    const runtime = createAndInitializeRuntime('/tmp/test-dual-track', config, toolExecutor);

    assert.strictEqual(runtime.isRunning(), false);
    console.log('✅ Test 3a: Runtime initialized successfully');

    await startRuntime(runtime);
    assert.strictEqual(runtime.isRunning(), true);
    console.log('✅ Test 3b: Runtime started successfully');

    const eventLoop = runtime.getEventLoop();
    assert.ok(eventLoop);
    console.log('✅ Test 3c: EventLoop accessible');

    const stateMachine = runtime.getStateMachine();
    assert.ok(stateMachine);
    console.log('✅ Test 3d: StateMachine accessible');

    const state = runtime.getState();
    assert.ok(typeof state === 'object');
    console.log('✅ Test 3e: Runtime state accessible:', JSON.stringify(state, null, 2));

    await stopRuntime(runtime);
    assert.strictEqual(runtime.isRunning(), false);
    console.log('✅ Test 3f: Runtime stopped successfully');
  } catch (error) {
    console.error('❌ Test 3 Failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  // Test 4: Create ToolExecutorAdapter
  try {
    const { createToolExecutorAdapter } = require('./dist/executors/tool-executor-adapter');
    const { ToolExecutor } = require('./dist/executor-v2');
    const { ExecutionTracker } = require('./dist/history');
    const { RollbackManager } = require('./dist/rollback');
    const { getDefaultConfig } = require('./dist/config');

    const tracker = new ExecutionTracker();
    const rollbackManager = new RollbackManager('/tmp/test-dual-track');
    const config = getDefaultConfig();
    const toolExecutor = new ToolExecutor(tracker, rollbackManager, config);

    const adapter = createToolExecutorAdapter(toolExecutor, {
      debug: true,
      enableTracking: true,
    });

    assert.strictEqual(adapter.name, 'tool-executor-adapter');
    console.log('✅ Test 4: ToolExecutorAdapter created successfully');
    console.log('   Adapter name:', adapter.name);
    console.log('   Event type:', adapter.eventType);
    console.log('   Priority:', adapter.priority);
  } catch (error) {
    console.error('❌ Test 4 Failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 All Dual Track System Tests Passed!');
  console.log('='.repeat(60) + '\n');
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
