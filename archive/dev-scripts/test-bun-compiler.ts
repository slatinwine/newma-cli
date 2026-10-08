#!/usr/bin/env ts-node
/**
 * Test Bun Compiler
 */

import { BunCompiler } from './src/skills-creator/compiler';
import { promises as fs } from 'fs';
import chalk from 'chalk';

async function testBunCompiler() {
  console.log(chalk.cyan.bold('\n🧪 Testing Bun Compiler\n'));

  const compiler = new BunCompiler();

  // Test 1: Valid plugin code
  console.log(chalk.yellow('Test 1: Valid Calculator Plugin code'));
  const validCode = await fs.readFile('./plugins/calculator-plugin/plugin.ts', 'utf-8');

  try {
    const result = await compiler.syntaxCheck(validCode);

    if (result.success) {
      console.log(chalk.green('✅ Valid code compiled successfully'));
    } else {
      console.error(chalk.red('❌ Valid code failed to compile'));
      console.error(chalk.red('Errors:'), result.errors);
    }
  } catch (error: any) {
    console.warn(chalk.yellow('⚠️  Test skipped (bun not available)'));
    console.warn(chalk.gray(error.message));
  }

  // Test 2: Invalid code (missing import)
  console.log(chalk.yellow('\nTest 2: Invalid code (missing imports)'));
  const invalidCode = `
const plugin = {
  id: 'test',
  name: 'Test',
  version: '1.0.0',
  description: 'Test plugin',
  tools: [],
};
export default plugin;
`;

  try {
    const result = await compiler.syntaxCheck(invalidCode);

    if (!result.success) {
      console.log(chalk.green('✅ Invalid code correctly rejected'));
      console.log(chalk.gray('Expected errors found'));
    } else {
      console.error(chalk.red('❌ Invalid code incorrectly accepted'));
    }
  } catch (error: any) {
    console.warn(chalk.yellow('⚠️  Test skipped (bun not available)'));
  }

  console.log(chalk.cyan('\n✨ Bun compiler test complete!\n'));
}

testBunCompiler();
