#!/usr/bin/env ts-node
/**
 * Test Script: Create Calculator Plugin using Skill-Creator
 */

import { SkillsCreator } from './src/skills-creator';
import { loadConfig } from './src/config';
import chalk from 'chalk';

async function main() {
  console.log(chalk.cyan('\n🎨 Creating Calculator Plugin...\n'));

  // Load config
  const config = await loadConfig();

  // Create SkillsCreator instance
  const creator = new SkillsCreator(config, process.cwd(), {
    defaultTemplate: 'basic',
    interactive: false, // 自动模式，不交互
  });

  // Plugin requirement
  const requirement = `
创建一个计算器插件（Calculator Plugin），包含以下工具：

1. add - 加法工具
   - 参数: a (number), b (number)
   - 返回: a + b

2. subtract - 减法工具
   - 参数: a (number), b (number)
   - 返回: a - b

3. multiply - 乘法工具
   - 参数: a (number), b (number)
   - 返回: a * b

4. divide - 除法工具
   - 参数: a (number), b (number)
   - 返回: a / b
   - 特殊处理: 除零保护

所有工具都应该是 read_only 权限。
插件应该包含完整的 TypeScript 类型定义、JSDoc 注释和错误处理。
  `;

  try {
    // Create plugin
    const result = await creator.createFromRequirement(requirement, './plugins/calculator-plugin');

    console.log(chalk.green('\n✅ Calculator plugin created successfully!\n'));
    console.log(chalk.cyan('📂 Location: ./plugins/calculator-plugin'));
    console.log(chalk.cyan('📋 Next steps:'));
    console.log(chalk.gray('  1. Review the generated plugin code'));
    console.log(chalk.gray('  2. Run tests: bun test plugin.test.ts'));
    console.log(chalk.gray('  3. Load in Kode and test the tools'));

    return result;
  } catch (error: any) {
    console.error(chalk.red('\n❌ Failed to create plugin:'), error.message);
    console.error(chalk.gray(error.stack));
    process.exit(1);
  }
}

main();
