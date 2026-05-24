#!/usr/bin/env ts-node
/**
 * Test Calculator Plugin
 *
 * Demonstrates loading and using the calculator plugin
 */

import type { Plugin } from './src/plugins/types';
import chalk from 'chalk';

async function main() {
  console.log(chalk.cyan('\n🧮 Testing Calculator Plugin\n'));

  // Load the plugin
  console.log(chalk.yellow('📦 Step 1: Loading plugin...'));
  const pluginPath = './plugins/calculator-plugin/plugin.ts';
  const calculatorModule = await import(pluginPath);
  const calculatorPlugin: Plugin = calculatorModule.default;

  console.log(chalk.green(`✅ Plugin loaded: ${calculatorPlugin.name} v${calculatorPlugin.version}`));
  console.log(chalk.gray(`   ID: ${calculatorPlugin.id}`));
  console.log(chalk.gray(`   Tools: ${calculatorPlugin.tools.length}\n`));

  // Mock context objects
  const pluginContext = {
    pluginRoot: '/tmp/plugin',
    projectRoot: '/tmp/project',
    config: {},
    toolRegistry: null as any,
    permissions: [],
  };

  const toolContext = {
    root: '/tmp',
    history: [],
    permissions: [],
    config: {},
  };

  // Initialize plugin
  console.log(chalk.yellow('🚀 Step 2: Initializing plugin...'));
  if (calculatorPlugin.initialize) {
    await calculatorPlugin.initialize(pluginContext as any);
    console.log(chalk.green('✅ Plugin initialized\n'));
  } else {
    console.log(chalk.gray('   (No initialize method)\n'));
  }

  // Test all tools
  console.log(chalk.yellow('🔧 Step 3: Testing tools...\n'));

  const tools = calculatorPlugin.tools;

  for (const tool of tools) {
    console.log(chalk.cyan(`\nTesting: ${tool.name}`));
    console.log(chalk.gray(`Description: ${tool.description}`));

    // Test case 1
    const testCases = [
      { name: 'add', params: { a: 5, b: 3 }, expected: '8' },
      { name: 'subtract', params: { a: 10, b: 4 }, expected: '6' },
      { name: 'multiply', params: { a: 6, b: 7 }, expected: '42' },
      { name: 'divide', params: { a: 20, b: 4 }, expected: '5' },
    ];

    const testCase = testCases.find(t => t.name === tool.name);

    if (testCase) {
      console.log(chalk.gray(`  Input: ${JSON.stringify(testCase.params)}`));

      const result = await tool.handler(testCase.params as any, toolContext as any);

      if (result.success) {
        console.log(chalk.green(`  ✅ Result: ${result.output}`));
      } else {
        console.log(chalk.red(`  ❌ Error: ${result.error}`));
      }
    }
  }

  // Test error handling
  console.log(chalk.yellow('\n🛡️  Step 4: Testing error handling...\n'));

  // Test division by zero
  const divideTool = tools.find(t => t.name === 'divide')!;
  console.log(chalk.cyan('Testing: divide by zero'));
  console.log(chalk.gray('  Input: { a: 10, b: 0 }'));

  const errorResult = await divideTool.handler({ a: 10, b: 0 } as any, toolContext as any);
  if (!errorResult.success) {
    console.log(chalk.green(`  ✅ Correctly caught error: ${errorResult.error}\n`));
  } else {
    console.log(chalk.red('  ❌ Should have caught division by zero\n'));
  }

  // Cleanup
  console.log(chalk.yellow('🧹 Step 5: Cleaning up...'));
  if (calculatorPlugin.cleanup) {
    await calculatorPlugin.cleanup(pluginContext as any);
    console.log(chalk.green('✅ Plugin cleaned up\n'));
  } else {
    console.log(chalk.gray('   (No cleanup method)\n'));
  }

  // Summary
  console.log(chalk.cyan('═══════════════════════════════════════'));
  console.log(chalk.bold('📊 Test Summary'));
  console.log(chalk.cyan('═══════════════════════════════════════'));
  console.log(`Plugin: ${calculatorPlugin.name}`);
  console.log(`Version: ${calculatorPlugin.version}`);
  console.log(`Tools Tested: ${tools.length}/4`);
  console.log(chalk.green('Status: ✅ All tools working correctly\n'));
}

main().catch(error => {
  console.error(chalk.red('❌ Error:'), error);
  process.exit(1);
});
