#!/usr/bin/env ts-node
/**
 * Test Skill-Creator Fixes
 */

import { supportsFunctionCalling } from './src/ai';
import { PluginGenerator } from './src/skills-creator/generator';
import type { Config } from './src/config';
import chalk from 'chalk';

console.log(chalk.cyan('\n🧪 Testing Skill-Creator Fixes\n'));

let passed = 0;
let failed = 0;

const mockConfig: Config = {
  apiKey: 'test-key',
  baseUrl: 'https://api.openai.com',
  endpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4',
};

// Test 1: Provider Detection
console.log(chalk.yellow('\n📡 Test 1: Provider Detection'));

const openai = supportsFunctionCalling(mockConfig);
console.log(openai ? chalk.green('  ✅ OpenAI') : chalk.red('  ❌ OpenAI'));
openai ? passed++ : failed++;

const zhipu = supportsFunctionCalling({ ...mockConfig, baseUrl: 'https://open.bigmodel.cn' });
console.log(zhipu ? chalk.green('  ✅ 智谱AI') : chalk.red('  ❌ 智谱AI'));
zhipu ? passed++ : failed++;

const unknown = !supportsFunctionCalling({ ...mockConfig, baseUrl: 'https://unknown.com' });
console.log(unknown ? chalk.green('  ✅ Unknown provider fallback') : chalk.red('  ❌ Unknown provider'));
unknown ? passed++ : failed++;

// Test 2: Validation
console.log(chalk.yellow('\n🔍 Test 2: Validation'));

const generator = new PluginGenerator(mockConfig, '/tmp/test');
const validate = (generator as any).validateGeneratedCode;

// Use longer code to pass length check (min 500 chars)
const goodCode = `
import type { Plugin } from '../../src/plugins/types';

/**
 * Test Plugin
 * A comprehensive plugin for testing purposes
 */
const testPlugin: Plugin = {
  id: 'test-plugin',
  name: 'Test Plugin',
  version: '1.0.0',
  description: 'A test plugin for validation',

  tools: [
    {
      name: 'test_tool',
      description: 'A test tool that performs operations',
      category: 'utility',
      permissions: ['read_only'],

      handler: async (params, context) => {
        // Implementation here
        return {
          success: true,
          output: 'Tool executed successfully',
        };
      },
    },
  ],

  async initialize(context) {
    console.log('[Test Plugin] Initialized');
  },

  async cleanup(context) {
    console.log('[Test Plugin] Cleaned up');
  },
};

export default testPlugin;
`;

const good = validate(goodCode, 'plugin.ts');
console.log(good.valid ? chalk.green('  ✅ Good code passes') : chalk.red('  ❌ Good code') + (good.valid ? '' : ` - ${good.errors[0]}`));
good.valid ? passed++ : failed++;

const badCode = '1. Let me think\n2. I will generate\n{"todo": []}';
const bad = validate(badCode, 'plugin.ts');
console.log(!bad.valid ? chalk.green('  ✅ Catches AI thinking') : chalk.red('  ❌ Should catch thinking'));
!bad.valid ? passed++ : failed++;

// Summary
console.log(chalk.cyan('\n📊 Results:'));
console.log(chalk.green(`✅ Passed: ${passed}`));
console.log(chalk.red(`❌ Failed: ${failed}`));

if (failed === 0) {
  console.log(chalk.green('\n🎉 All tests passed!\n'));
} else {
  console.log(chalk.red('\n⚠️  Some tests failed\n'));
}
