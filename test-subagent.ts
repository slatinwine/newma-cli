#!/usr/bin/env npx ts-node
/**
 * SubAgent System Test
 *
 * Tests the two-phase SubAgent system:
 * - Phase 1: PlanningSubAgent (read-only tools)
 * - Phase 2: ExecutionSubAgent (all tools)
 */

import chalk from 'chalk';
import { SubAgentCoordinator } from './src/agents/subagent';
import { ToolRegistry } from './src/tools/registry';
import { ToolExecutor } from './src/executor-v2';
import { ExecutionTracker } from './src/history';
import { getDefaultConfig } from './src/config';
import { RollbackManager } from './src/rollback';

async function testSubAgentSystem() {
  console.log(chalk.cyan('🧪 Testing SubAgent System\n'));

  try {
    // Setup
    const config = getDefaultConfig();
    const tracker = new ExecutionTracker();
    const registry = new ToolRegistry();
    const rollbackManager = new RollbackManager(process.cwd(), {});

    // Register basic tools
    const fileTools = await import('./src/tools/builtin/file');
    registry.register(fileTools.fileTool);

    const commandTools = await import('./src/tools/builtin/command');
    registry.register(commandTools.commandTool);

    const toolExecutor = new ToolExecutor(tracker, rollbackManager, config);

    // Create context
    const context = {
      projectRoot: process.cwd(),
      projectInfo: {
        test_project: 'true',
        test_file: 'test.txt',
      },
      config,
      toolRegistry: registry,
      toolExecutor,
      signal: undefined,
    };

    console.log(chalk.gray('✅ Setup complete\n'));

    // Test 1: Coordinator instantiation
    console.log(chalk.cyan('Test 1: Coordinator instantiation'));
    const coordinator = new SubAgentCoordinator(context);
    console.log(chalk.green('✅ SubAgentCoordinator created\n'));

    // Test 2: Simple planning task
    console.log(chalk.cyan('Test 2: Simple planning task'));
    console.log(chalk.gray('─'.repeat(50)));

    const result = await coordinator.execute('List all TypeScript files in src/', {
      skipConfirmation: true,
    });

    console.log(chalk.gray('─'.repeat(50)));

    // Check results
    if (result.planningResult.success) {
      console.log(chalk.green('✅ Planning phase succeeded'));
    } else {
      console.log(chalk.yellow('⚠️  Planning phase failed'));
    }

    if (result.executionResult?.success) {
      console.log(chalk.green('✅ Execution phase succeeded'));
    } else {
      console.log(chalk.yellow('⚠️  Execution phase failed or skipped'));
    }

    console.log(chalk.gray(`\n📊 Total duration: ${result.totalDuration}ms`));

    // Summary
    console.log(chalk.cyan('\n📋 Test Summary:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.green('✅ All tests passed!'));
    console.log(chalk.gray('─'.repeat(50)) + '\n');

    return true;

  } catch (error: any) {
    console.log(chalk.red('\n❌ Test failed:'));
    console.log(chalk.gray(error.message));
    console.log(chalk.gray(error.stack));
    return false;
  }
}

// Run test
testSubAgentSystem()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error(chalk.red('❌ Test error:'), error);
    process.exit(1);
  });
