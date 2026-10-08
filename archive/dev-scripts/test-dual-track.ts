#!/usr/bin/env ts-node

/**
 * Dual Track System Test
 *
 * 验证旧系统和新运行时系统都能正常工作
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Dual Track System Tests', () => {

  it('should load runtime-integration module', async () => {
    const {
      createRuntimeConfig,
      createAndInitializeRuntime,
      startRuntime,
      stopRuntime,
    } = await import('../src/runtime-integration');

    assert.ok(typeof createRuntimeConfig === 'function');
    assert.ok(typeof createAndInitializeRuntime === 'function');
    assert.ok(typeof startRuntime === 'function');
    assert.ok(typeof stopRuntime === 'function');
    console.log('✅ Runtime integration module loaded successfully');
  });

  it('should load ToolExecutorAdapter', async () => {
    const { ToolExecutorAdapter, createToolExecutorAdapter } = await import('../src/executors/tool-executor-adapter');

    assert.ok(typeof ToolExecutorAdapter === 'function');
    assert.ok(typeof createToolExecutorAdapter === 'function');
    console.log('✅ ToolExecutorAdapter loaded successfully');
  });

  it('should create runtime config', async () => {
    const { createRuntimeConfig } = await import('../src/runtime-integration');
    const { ToolExecutor } = await import('../src/executor-v2');
    const { ExecutionTracker } = await import('../src/history');
    const { RollbackManager } = await import('../src/rollback');
    const { getDefaultConfig } = await import('../src/config');

    const tracker = new ExecutionTracker();
    const rollbackManager = new RollbackManager('/tmp/test');
    const config = getDefaultConfig();
    const toolExecutor = new ToolExecutor(tracker, rollbackManager, config);

    const runtimeConfig = createRuntimeConfig('/tmp/test', config, toolExecutor);

    assert.strictEqual(runtimeConfig.projectRoot, '/tmp/test');
    assert.strictEqual(typeof runtimeConfig.debug, 'boolean');
    assert.strictEqual(typeof runtimeConfig.maxIterations, 'number');
    console.log('✅ Runtime config created successfully');
    console.log('   Config:', JSON.stringify(runtimeConfig, null, 2));
  });

  it('should initialize NewmaRuntime', async () => {
    const { createAndInitializeRuntime } = await import('../src/runtime-integration');
    const { ToolExecutor } = await import('../src/executor-v2');
    const { ExecutionTracker } = await import('../src/history');
    const { RollbackManager } = await import('../src/rollback');
    const { getDefaultConfig } = await import('../src/config');
    const { NewmaRuntime } = await import('../src/runtime/runtime');

    const tracker = new ExecutionTracker();
    const rollbackManager = new RollbackManager('/tmp/test');
    const config = getDefaultConfig();
    const toolExecutor = new ToolExecutor(tracker, rollbackManager, config);

    const runtime = createAndInitializeRuntime('/tmp/test', config, toolExecutor);

    assert.ok(runtime instanceof NewmaRuntime);
    assert.strictEqual(runtime.isRunning(), false);
    console.log('✅ NewmaRuntime initialized successfully');
    console.log('   Runtime state:', runtime.getState());
  });

  it('should start and stop runtime', async () => {
    const { createAndInitializeRuntime, startRuntime, stopRuntime } = await import('../src/runtime-integration');
    const { ToolExecutor } = await import('../src/executor-v2');
    const { ExecutionTracker } = await import('../src/history');
    const { RollbackManager } = await import('../src/rollback');
    const { getDefaultConfig } = await import('../src/config');

    const tracker = new ExecutionTracker();
    const rollbackManager = new RollbackManager('/tmp/test');
    const config = getDefaultConfig();
    config.eventSystem = { enabled: true, debugMode: false }; // 启用事件系统
    const toolExecutor = new ToolExecutor(tracker, rollbackManager, config);

    const runtime = createAndInitializeRuntime('/tmp/test', config, toolExecutor);

    await startRuntime(runtime);
    assert.strictEqual(runtime.isRunning(), true);
    console.log('✅ Runtime started successfully');

    await stopRuntime(runtime);
    assert.strictEqual(runtime.isRunning(), false);
    console.log('✅ Runtime stopped successfully');
  });

  it('should access runtime components', async () => {
    const { createAndInitializeRuntime } = await import('../src/runtime-integration');
    const { ToolExecutor } = await import('../src/executor-v2');
    const { ExecutionTracker } = await import('../src/history');
    const { RollbackManager } = await import('../src/rollback');
    const { getDefaultConfig } = await import('../src/config');

    const tracker = new ExecutionTracker();
    const rollbackManager = new RollbackManager('/tmp/test');
    const config = getDefaultConfig();
    const toolExecutor = new ToolExecutor(tracker, rollbackManager, config);

    const runtime = createAndInitializeRuntime('/tmp/test', config, toolExecutor);

    // 测试各个组件
    const eventLoop = runtime.getEventLoop();
    assert.ok(eventLoop);
    console.log('✅ EventLoop accessible');

    const stateMachine = runtime.getStateMachine();
    assert.ok(stateMachine);
    console.log('✅ StateMachine accessible');

    const agentRegistry = runtime.getAgentRegistry();
    assert.ok(agentRegistry);
    console.log('✅ AgentRegistry accessible');

    const state = runtime.getState();
    assert.ok(typeof state === 'object');
    console.log('✅ Runtime state accessible:', state);
  });

  it('should create ToolExecutorAdapter', async () => {
    const { createToolExecutorAdapter } = await import('../src/executors/tool-executor-adapter');
    const { ToolExecutor } = await import('../src/executor-v2');
    const { ExecutionTracker } = await import('../src/history');
    const { RollbackManager } = await import('../src/rollback');
    const { getDefaultConfig } = await import('../src/config');

    const tracker = new ExecutionTracker();
    const rollbackManager = new RollbackManager('/tmp/test');
    const config = getDefaultConfig();
    const toolExecutor = new ToolExecutor(tracker, rollbackManager, config);

    const adapter = createToolExecutorAdapter(toolExecutor, {
      debug: true,
      enableTracking: true,
    });

    assert.strictEqual(adapter.name, 'tool-executor-adapter');
    console.log('✅ ToolExecutorAdapter created successfully');
    console.log('   Adapter name:', adapter.name);
    console.log('   Event type:', adapter.eventType);
    console.log('   Priority:', adapter.priority);
  });
});

// 运行测试
console.log('\n' + '='.repeat(60));
console.log('🧪 Running Dual Track System Tests');
console.log('='.repeat(60) + '\n');
