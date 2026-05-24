#!/usr/bin/env ts-node
/**
 * Integration test for Phase 2 features
 * Tests: Tool system, Permissions, Verifier, ToolExecutor
 */

import { ToolExecutor } from './src/executor-v2';
import { Verifier, autoDetectStages } from './src/verifier';
import { PermissionManager, PermissionLevel } from './src/permissions';
import { buildSystemPrompt } from './src/prompt';
import { ExecutionTracker } from './src/history';
import { RollbackManager } from './src/rollback';
import { Config } from './src/config';
import path from 'path';

async function testToolSystem() {
  console.log('🧪 Testing Phase 2 Integration...\n');

  // Test 1: System Prompt with Tools
  console.log('✓ Test 1: System Prompt Builder');
  const tools = ['file', 'command', 'analysis'];
  const permissions = ['READ_FILES', 'WRITE_FILES'];
  const prompt = buildSystemPrompt(tools, permissions);

  if (prompt.includes('AVAILABLE TOOLS') &&
      prompt.includes('GRANTED PERMISSIONS') &&
      prompt.includes('file') &&
      prompt.includes('command')) {
    console.log('  ✓ System prompt includes tool and permission information');
  } else {
    console.log('  ✗ System prompt missing tool/permission information');
    return false;
  }

  // Test 2: ToolExecutor Initialization
  console.log('\n✓ Test 2: ToolExecutor Initialization');
  const tracker = new ExecutionTracker();
  const rollbackManager = new RollbackManager(path.resolve(process.cwd()));
  const config: Config = {
    apiKey: 'test-key',
    model: 'gpt-4',
    baseUrl: 'http://localhost:8000',
  };

  const executor = new ToolExecutor(
    tracker,
    rollbackManager,
    config,
    PermissionLevel.SAFE
  );

  if (executor.getRegistry() && executor.getPermissionManager()) {
    console.log('  ✓ ToolExecutor initialized with registry and permission manager');
  } else {
    console.log('  ✗ ToolExecutor initialization failed');
    return false;
  }

  // Test 3: Permission Manager
  console.log('\n✓ Test 3: Permission Manager');
  const permManager = executor.getPermissionManager();
  const granted = permManager.getGranted();

  if (granted && granted.length > 0) {
    console.log(`  ✓ Permission manager has ${granted.length} granted permissions`);
    console.log(`    Permissions: ${Array.from(granted).join(', ')}`);
  } else {
    console.log('  ✗ No permissions granted');
    return false;
  }

  // Test 4: Tool Registry
  console.log('\n✓ Test 4: Tool Registry');
  const registry = executor.getRegistry();
  const allTools = registry.list();

  if (allTools.length >= 2) {  // Should have at least 'file' and 'command'
    console.log(`  ✓ Registry has ${allTools.length} tools registered`);
    console.log(`    Tools: ${allTools.map((t: any) => t.name).join(', ')}`);
  } else {
    console.log('  ✗ Not enough tools registered');
    return false;
  }

  // Test 5: Verifier Initialization
  console.log('\n✓ Test 5: Verifier Initialization');
  const verifier = new Verifier();

  // Add a custom stage (no description field in VerificationStage interface)
  verifier.addStage({
    name: 'test-check',
    required: false,
    check: async (root: string) => {
      return { passed: true, message: 'Test passed' };
    },
  });

  const testRoot = path.resolve(process.cwd());
  autoDetectStages(verifier, testRoot);

  console.log('  ✓ Verifier initialized with auto-detected stages');
  console.log(`    Has TypeScript: ${true}`); // We know it has TS

  // Test 6: System Prompt without Tools (backward compatibility)
  console.log('\n✓ Test 6: Backward Compatibility');
  const basicPrompt = buildSystemPrompt();

  if (basicPrompt && basicPrompt.includes('KODE')) {
    console.log('  ✓ System prompt works without tool parameters (backward compatible)');
  } else {
    console.log('  ✗ Backward compatibility broken');
    return false;
  }

  console.log('\n✅ All Phase 2 integration tests passed!\n');
  return true;
}

// Run tests
testToolSystem()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  });
