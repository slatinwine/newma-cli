#!/usr/bin/env ts-node
/**
 * Test Improved Skill-Creator
 */

import { PluginGenerator } from './src/skills-creator/generator';
import { Config } from './src/config';
import chalk from 'chalk';

async function testImprovedGenerator() {
  console.log(chalk.cyan.bold('\n🧪 Testing Improved Skill-Creator\n'));

  // Load config
  const config: Config = {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
    endpoint: process.env.OPENAI_ENDPOINT || undefined,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  };

  if (!config.apiKey) {
    console.error(chalk.red('❌ OPENAI_API_KEY not set'));
    process.exit(1);
  }

  // Create generator
  const generator = new PluginGenerator(config, process.cwd());

  // Test requirement: Simple Calculator Plugin
  const requirement = {
    name: 'Calculator Plugin',
    description: 'A calculator plugin with basic math operations',
    version: '1.0.0',
    tools: [
      {
        name: 'add',
        description: 'Add two numbers together',
        parameters: {
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' },
          },
          required: ['a', 'b'],
        },
      },
      {
        name: 'subtract',
        description: 'Subtract b from a',
        parameters: {
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' },
          },
          required: ['a', 'b'],
        },
      },
      {
        name: 'multiply',
        description: 'Multiply two numbers',
        parameters: {
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' },
          },
          required: ['a', 'b'],
        },
      },
      {
        name: 'divide',
        description: 'Divide a by b with zero-division protection',
        parameters: {
          properties: {
            a: { type: 'number', description: 'Numerator' },
            b: { type: 'number', description: 'Denominator' },
          },
          required: ['a', 'b'],
        },
      },
    ],
    metadata: {
      author: 'Test User',
    },
  };

  console.log(chalk.yellow('📦 Generating Calculator Plugin...\n'));

  try {
    // Generate plugin
    const result = await generator.generate(requirement, {
      outDir: './plugins/calculator-plugin-test',
      interactive: false,
    });

    console.log(chalk.cyan('\n═══════════════════════════════════════'));
    console.log(chalk.bold('📊 Generation Result'));
    console.log(chalk.cyan('═══════════════════════════════════════'));

    if (result.warnings) {
      console.log(chalk.yellow(`⚠️  Warnings: ${result.warnings.length}`));
      result.warnings.forEach(w => console.log(chalk.yellow(`  - ${w}`)));
    }

    console.log(chalk.green(`\n✅ Plugin generated successfully!`));
    console.log(chalk.cyan(`📂 Location: ./plugins/calculator-plugin-test`));
    console.log(chalk.gray(`\n📋 Files generated:`));
    result.files.forEach(f => console.log(chalk.gray(`  - ${f.path}`)));

    // Show plugin code preview
    const pluginFile = result.files.find(f => f.path === 'plugin.ts');
    if (pluginFile) {
      console.log(chalk.cyan('\n📄 plugin.ts preview (first 50 lines):'));
      console.log(chalk.gray('─'.repeat(50)));
      const preview = pluginFile.content.split('\n').slice(0, 50).join('\n');
      console.log(preview);
      console.log(chalk.gray('─'.repeat(50)));
    }

    console.log(chalk.green('\n✨ Test completed!'));

  } catch (error: any) {
    console.error(chalk.red('\n❌ Generation failed:'), error.message);
    if (error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

testImprovedGenerator();
