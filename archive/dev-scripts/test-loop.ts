/**
 * Test script for /loop command
 * Tests the Reasoner's ability to generate actionable commands
 */

import { LoopCoordinator } from './dist/loop/coordinator';
import { Config } from './dist/config';
import { loadConfig } from './dist/config';

async function testLoop() {
  console.log('🧪 Testing /loop command with: "总结项目"\n');

  try {
    // Load config
    const config = loadConfig();

    // Create coordinator
    const coordinator = new LoopCoordinator(
      config,
      process.cwd(),  // project root
      1  // max iterations (just test reasoning step)
    );

    // Execute loop (will be interrupted after reasoning)
    console.log('Starting loop coordinator...\n');
    await coordinator.execute('总结项目');

    console.log('\n✅ Test completed');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testLoop();
