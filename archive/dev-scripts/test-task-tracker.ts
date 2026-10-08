/**
 * Task Tracker Tests - Basic functionality tests
 */

import { TaskTracker } from './src/task-tracker/tracker';
import { TaskStorage } from './src/task-tracker/storage';
import { TaskDisplay } from './src/task-tracker/display';
import { TaskCommands } from './src/task-tracker/commands';
import { TaskMode } from './src/task-tracker/types';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Simple test helpers
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function testTaskLifecycle() {
  console.log('\n📋 Testing Task Lifecycle...');

  // Create temp directory
  const tempDir = join(tmpdir(), `task-test-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    // Create storage
    const storage = new TaskStorage({
      dataDir: tempDir,
      compressAfterDays: 30,
      compressionLevel: 9,
      algorithm: 'gzip',
    });

    // Create tracker
    const tracker = new TaskTracker(storage);

    // Test 1: Start task
    console.log('  ✓ Test 1: Start task');
    const task = tracker.startTask(
      'Test requirement',
      'plan',
      'test-session-123',
      tempDir
    );

    assert(task !== null, 'Task should be created');
    assert(task.id === 'test-session-123', 'Task ID should match session ID');
    assert(task.status === 'pending', 'Task should be pending');
    assert(task.requirement === 'Test requirement', 'Requirement should match');
    console.log('    ✓ Task created successfully');

    // Test 2: Update reasoning
    console.log('  ✓ Test 2: Update reasoning');
    tracker.updateReasoning({
      algorithm: 'fft',
      thoughts: 'This is a simple task',
      plan: ['Step 1', 'Step 2'],
    });

    const updatedTask = tracker.getCurrentTask();
    assert(updatedTask?.reasoning.algorithm === 'fft', 'Algorithm should be fft');
    assert(updatedTask?.reasoning.plan?.length === 2, 'Plan should have 2 steps');
    console.log('    ✓ Reasoning updated successfully');

    // Test 3: Add execution steps
    console.log('  ✓ Test 3: Add execution steps');
    tracker.updateExecution({
      type: 'create',
      target: '/test/file.txt',
      status: 'success',
      duration: 1000,
    });

    tracker.updateExecution({
      type: 'run',
      target: 'npm test',
      status: 'success',
      duration: 2000,
    });

    const currentTask = tracker.getCurrentTask();
    assert(currentTask?.execution.actions.length === 2, 'Should have 2 actions');
    assert(currentTask?.execution.summary.succeeded === 2, 'Should have 2 succeeded');
    console.log('    ✓ Execution steps added successfully');

    // Test 4: Complete task
    console.log('  ✓ Test 4: Complete task');
    await tracker.completeTask(true);
    assert(tracker.getCurrentTask() === null, 'Current task should be cleared');
    console.log('    ✓ Task completed successfully');

    // Test 5: Load task
    console.log('  ✓ Test 5: Load task');
    const loadedTask = await tracker.getTask('test-session-123');
    assert(loadedTask !== null, 'Task should be loaded');
    assert(loadedTask?.status === 'completed', 'Task should be completed');
    assert(loadedTask?.execution.actions.length === 2, 'Should have 2 actions');
    console.log('    ✓ Task loaded successfully');

    // Test 6: List tasks
    console.log('  ✓ Test 6: List tasks');
    const tasks = await tracker.listTasks();
    assert(tasks.length === 1, 'Should have 1 task');
    assert(tasks[0].id === 'test-session-123', 'Task ID should match');
    console.log('    ✓ Tasks listed successfully');

    // Test 7: Display formatter
    console.log('  ✓ Test 7: Display formatter');
    const display = new TaskDisplay();
    const formatted = display.formatTaskList(tasks, { colorize: false });
    assert(formatted.includes('test-sessi') || formatted.includes('Test requirement'), 'Should include task info');
    assert(formatted.includes('completed'), 'Should include status');
    console.log('    ✓ Display formatter works');

    // Test 8: Export to JSON
    console.log('  ✓ Test 8: Export to JSON');
    const json = await tracker.exportTask('test-session-123', 'json');
    const parsed = JSON.parse(json);
    assert(parsed.id === 'test-session-123', 'Exported JSON should match');
    console.log('    ✓ Export to JSON works');

    // Test 9: Export to Markdown
    console.log('  ✓ Test 9: Export to Markdown');
    const markdown = await tracker.exportTask('test-session-123', 'markdown');
    assert(markdown.includes('# Task: test-session-123'), 'Should have task header');
    assert(markdown.includes('## Requirement'), 'Should have requirement section');
    console.log('    ✓ Export to Markdown works');

    console.log('\n✅ All tests passed!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', (error as Error).message);
    throw error;
  } finally {
    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

// Run tests
testTaskLifecycle()
  .then(() => {
    console.log('🎉 Task tracker implementation is working correctly!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Tests failed:', error);
    process.exit(1);
  });
