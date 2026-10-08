#!/usr/bin/env ts-node

/**
 * Event Stream System Test
 *
 * Demonstrates the new Codex-style event stream architecture.
 * Run with: npx ts-node test-event-stream.ts
 */

import chalk from 'chalk';
import {
  createEventSystem,
  waitForEvent,
  isQuitEvent,
  formatKeyEvent,
} from './loop/event';

// ============================================================================
// Test Functions
// ============================================================================

/**
 * Test basic event polling
 */
async function testBasicPolling() {
  console.log(chalk.cyan('\n🧪 Test 1: Basic Event Polling'));
  console.log(chalk.gray('─').repeat(50));

  const eventSystem = createEventSystem({
    debug: true,
  });

  console.log(chalk.yellow('Press any key (or Ctrl+C to exit)...'));

  let eventCount = 0;
  const maxEvents = 5;

  while (eventCount < maxEvents) {
    const event = await waitForEvent(eventSystem.stream, 5000);

    if (!event) {
      console.log(chalk.gray('Timeout waiting for event'));
      continue;
    }

    console.log(chalk.green(`✓ Event ${eventCount + 1}:`), chalk.gray(JSON.stringify(event)));

    if (isQuitEvent(event)) {
      console.log(chalk.yellow('\n⚠️  Quit event received, stopping test'));
      break;
    }

    eventCount++;
  }

  console.log(chalk.gray('\nTest completed!\n'));
}

/**
 * Test pause/resume functionality
 */
async function testPauseResume() {
  console.log(chalk.cyan('\n🧪 Test 2: Pause/Resume'));
  console.log(chalk.gray('─').repeat(50)));

  const eventSystem = createEventSystem({
    debug: true,
  });

  console.log(chalk.yellow('Event system started'));
  console.log(chalk.yellow('Waiting for events... (Ctrl+C to continue)'));

  let running = true;

  while (running) {
    const event = await waitForEvent(eventSystem.stream, 5000);

    if (!event) {
      continue;
    }

    console.log(chalk.green('Event received:'), chalk.gray(formatKeyEvent(event)));

    if (event.type === 'signal') {
      if (event.signal === 'SIGINT') {
        console.log(chalk.yellow('\n📸 Pausing event stream...'));
        eventSystem.stream.pause();
        console.log(chalk.red('⏸️  PAUSED - stdin is now released'));

        console.log(chalk.yellow('\nTry typing in terminal (echo won\'t appear)'));
        console.log(chalk.yellow('Press Enter to continue...'));

        // Wait for Enter key (raw input)
        await waitForAnyKey();

        console.log(chalk.yellow('\n▶️  Resuming event stream...'));
        eventSystem.stream.resume();
        console.log(chalk.green('✅ RESUMED - stdin captured again'));
        console.log(chalk.yellow('Press Ctrl+C again to exit test'));
      }
    }
  }

  console.log(chalk.gray('\nTest completed!\n'));
}

/**
 * Test external editor integration
 */
async function testExternalIntegration() {
  console.log(chalk.cyan('\n🧪 Test 3: External Editor Integration'));
  console.log(chalk.gray('─').repeat(50)));

  const eventSystem = createEventSystem();

  console.log(chalk.yellow('This test demonstrates pause/resume for external programs'));
  console.log(chalk.yellow('\nType /vim <filename> to open a file in vim'));
  console.log(chalk.yellow('Type /exit to quit\n'));

  const source = eventSystem.source;
  const rl = source.getInterface();

  if (rl) {
    rl.on('line', async (line: string) => {
      if (line.startsWith('/vim') || line.startsWith('/edit')) {
        const parts = line.split(' ');
        const filename = parts[1] || 'test.txt';

        console.log(chalk.cyan(`\n📝 Opening ${filename} in vim...`));

        // Pause event stream
        eventSystem.stream.pause();
        console.log(chalk.gray('[Event stream paused - stdin released]'));

        // Clear line
        source.clearLine();

        // Run vim
        const { spawn } = require('child_process');
        const proc = spawn('vim', [filename], {
          stdio: 'inherit',
        });

        await new Promise(resolve => proc.on('close', resolve));

        // Resume
        console.log(chalk.gray('[Event stream resumed - stdin captured]'));
        eventSystem.stream.resume();
        source.prompt();
      } else if (line === '/exit') {
        console.log(chalk.gray('\nExiting test...'));
        rl.close();
      } else if (line === '/help') {
        console.log(chalk.cyan('\nCommands:'));
        console.log(chalk.gray('  /vim <file> - Open file in vim'));
        console.log(chalk.gray('  /exit       - Exit test'));
        console.log();
        source.prompt();
      }
    });

    source.prompt();
  }

  console.log(chalk.gray('(Test running, press Ctrl+C to exit)\n'));
}

/**
 * Test round-robin polling
 */
async function testRoundRobin() {
  console.log(chalk.cyan('\n🧪 Test 4: Round-Robin Polling'));
  console.log(chalk.gray('─').repeat(50)));

  const eventSystem = createEventSystem({
    debug: false,
  });

  console.log(chalk.yellow('This test verifies fair event scheduling'));
  console.log(chalk.yellow('Events: Draw events and input events'));

  // Trigger multiple draw events
  for (let i = 0; i < 3; i++) {
    eventSystem.stream.triggerDraw();
    console.log(chalk.gray(`Draw event ${i + 1} queued`));
  }

  console.log(chalk.yellow('\nNow polling for events (should interleave Draw and Input)...'));
  console.log(chalk.yellow('Type something and press Enter, or Ctrl+C to exit\n'));

  let eventCount = 0;
  const maxEvents = 10;

  while (eventCount < maxEvents) {
    const event = await waitForEvent(eventSystem.stream, 3000);

    if (!event) {
      console.log(chalk.gray('No event (timeout)'));
      continue;
    }

    const eventType = event.type.toUpperCase();
    console.log(chalk.green(`Event ${eventCount + 1}:`), chalk.cyan(eventType));

    if (isQuitEvent(event)) {
      break;
    }

    eventCount++;
  }

  console.log(chalk.gray('\nTest completed!\n'));
}

/**
 * Wait for any key (raw stdin, bypassing event stream)
 */
async function waitForAnyKey(): Promise<void> {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function main() {
  console.log(chalk.cyan('\n🎯 Kode Event Stream System Tests'));
  console.log(chalk.gray('Based on Codex CLI architecture\n'));

  const args = process.argv.slice(2);
  const test = args[0] || 'basic';

  try {
    switch (test) {
      case 'basic':
        await testBasicPolling();
        break;

      case 'pause':
        await testPauseResume();
        break;

      case 'editor':
        await testExternalIntegration();
        break;

      case 'roundrobin':
        await testRoundRobin();
        break;

      case 'all':
        await testBasicPolling();
        await testPauseResume();
        await testRoundRobin();
        break;

      default:
        console.log(chalk.yellow('\nAvailable tests:'));
        console.log(chalk.gray('  npx ts-node test-event-stream.ts basic     - Basic event polling'));
        console.log(chalk.gray('  npx ts-node test-event-stream.ts pause     - Pause/Resume'));
        console.log(chalk.gray('  npx ts-node test-event-stream.ts editor    - External editor'));
        console.log(chalk.gray('  npx ts-node test-event-stream.ts roundrobin - Round-robin'));
        console.log(chalk.gray('  npx ts-node test-event-stream.ts all       - Run all tests'));
        console.log();
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Test failed: ${error}\n`));
    process.exit(1);
  }

  console.log(chalk.cyan('✅ All tests completed!\n'));
}

// Run tests
main().catch(console.error);
