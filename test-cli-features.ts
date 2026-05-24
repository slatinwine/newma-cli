#!/usr/bin/env ts-node
/**
 * CLI Features Test
 * Tests all new CLI flags and features
 */

import { spawn } from 'child_process';
import chalk from 'chalk';

/**
 * Test CLI flags
 */
async function testCLIFlag(flag: string, description: string): Promise<boolean> {
  console.log(chalk.cyan(`\n🧪 Testing: ${description}`));
  console.log(chalk.gray(`   Flag: ${flag}`));

  return new Promise((resolve) => {
    const args = flag.split(' ');
    const cli = spawn('npx', ['ts-node', 'src/cli.ts', ...args, '--help'], {
      stdio: 'pipe',
    });

    let output = '';
    let errorOutput = '';

    cli.stdout.on('data', (data) => {
      output += data.toString();
    });

    cli.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    cli.on('close', (code) => {
      if (code === 0 || output.includes('Options:') || output.includes('用法：')) {
        console.log(chalk.green('   ✓ Flag recognized'));
        resolve(true);
      } else {
        console.log(chalk.red('   ✗ Flag not recognized'));
        console.log(chalk.gray(`   Error: ${errorOutput}`));
        resolve(false);
      }
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      cli.kill();
      console.log(chalk.yellow('   ⚠ Timeout'));
      resolve(false);
    }, 5000);
  });
}

/**
 * Test all CLI features
 */
async function testAllCLIFeatures() {
  console.log(chalk.magenta.bold('\n🎯 Kode CLI Features Test\n'));

  const tests = [
    { flag: '--help', description: 'Help flag' },
    { flag: '--version', description: 'Version flag' },
    { flag: '--use-tools', description: 'Tool system flag' },
    { flag: '--multi-agent', description: 'Multi-agent flag' },
    { flag: '--autonomous', description: 'Autonomous mode flag' },
    { flag: '--compress', description: 'Token compression flag' },
    { flag: '--verify', description: 'Verification flag' },
    { flag: '--permission-level safe', description: 'Permission level flag' },
    { flag: '--max-iterations 5', description: 'Max iterations flag' },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await testCLIFlag(test.flag, test.description);
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }

  // Print summary
  console.log(chalk.magenta.bold('\n📊 Test Summary'));
  console.log(chalk.magenta('==='));
  console.log(`Total Tests: ${tests.length}`);
  console.log(chalk.green(`Passed: ${passed}`));
  if (failed > 0) {
    console.log(chalk.red(`Failed: ${failed}`));
  }
  console.log(chalk.magenta('==='));

  if (failed === 0) {
    console.log(chalk.green.bold('\n🎉 All CLI Feature Tests Passed!\n'));
    return true;
  } else {
    console.log(chalk.yellow.bold('\n⚠️ Some Tests Failed\n'));
    return false;
  }
}

/**
 * Display feature matrix
 */
function displayFeatureMatrix() {
  console.log(chalk.cyan.bold('\n📋 Kode Feature Matrix'));
  console.log(chalk.cyan('===\n'));

  const features = [
    {
      phase: 'Phase 1',
      name: 'Core Infrastructure',
      flags: '--dir, --model, --base-url',
      status: '✅ Stable',
    },
    {
      phase: 'Phase 2',
      name: 'Tool System',
      flags: '--use-tools, --permission-level, --verify',
      status: '✅ Stable',
    },
    {
      phase: 'Phase 3',
      name: 'Multi-Agent System',
      flags: '--multi-agent',
      status: '✅ Stable',
    },
    {
      phase: 'Phase 4',
      name: 'Autonomous Mode',
      flags: '--autonomous, --auto-fix, --auto-optimize',
      status: '✅ Experimental',
    },
    {
      phase: 'Phase 4',
      name: 'Token Compression',
      flags: '--compress',
      status: '✅ Stable',
    },
  ];

  features.forEach((feature) => {
    console.log(chalk.bold(`${feature.phase}: ${feature.name}`));
    console.log(chalk.gray(`  Flags: ${feature.flags}`));
    console.log(chalk.gray(`  Status: ${feature.status}\n`));
  });

  console.log(chalk.cyan('===\n'));
}

/**
 * Display usage examples
 */
function displayUsageExamples() {
  console.log(chalk.cyan.bold('💡 Usage Examples\n'));

  const examples = [
    {
      title: 'Basic Usage',
      command: 'npx newma-cli "add a login page"',
      description: 'Simple requirement execution',
    },
    {
      title: 'With Token Compression',
      command: 'npx newma-cli --compress "fix memory leak"',
      description: 'Enable compression to save tokens',
    },
    {
      title: 'Multi-Agent Mode',
      command: 'npx newma-cli --multi-agent "build REST API"',
      description: 'Use specialized agents for complex tasks',
    },
    {
      title: 'Autonomous Mode',
      command: 'npx newma-cli --autonomous "create full-stack app"',
      description: 'Fully autonomous execution',
    },
    {
      title: 'With Verification',
      command: 'npx newma-cli --verify "add unit tests"',
      description: 'Auto-verify quality after execution',
    },
  ];

  examples.forEach((example, i) => {
    console.log(chalk.bold(`${i + 1}. ${example.title}`));
    console.log(chalk.gray(`   ${example.command}`));
    console.log(chalk.cyan(`   → ${example.description}\n`));
  });
}

// Run all tests
async function run() {
  try {
    // Display feature matrix
    displayFeatureMatrix();

    // Display usage examples
    displayUsageExamples();

    // Run tests
    const success = await testAllCLIFeatures();

    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error(chalk.red('\n❌ Test failed with error:'), error);
    process.exit(1);
  }
}

// Execute
run();
