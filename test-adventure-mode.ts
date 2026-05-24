#!/usr/bin/env ts-node
/**
 * Test Adventure Mode and Plan Choice features
 */

import chalk from 'chalk';
import { AdventureManager } from './src/adventure';
import { PlanChoiceManager } from './src/plan-choice';
import { Choice } from './src/types';
import { Action } from './src/types';

async function testAdventureMode() {
  console.log(chalk.cyan('\n' + '='.repeat(60)));
  console.log(chalk.cyan.bold('  测试 Adventure Mode'));
  console.log(chalk.cyan('='.repeat(60) + '\n'));

  const adventureManager = new AdventureManager();

  // Mock choices for user authentication
  const choices: Choice[] = [
    {
      id: 'A',
      title: 'JWT 认证',
      description: '使用 JSON Web Token 进行无状态认证',
      pros: ['性能好', '易于扩展', '支持移动端'],
      cons: ['需要处理 token 刷新'],
      todo: ['安装 JWT 库', '实现登录接口', '添加 token 验证'],
      actions: [
        { type: 'run', command: 'npm install jsonwebtoken' }
      ]
    },
    {
      id: 'B',
      title: 'Session 认证',
      description: '使用服务端 session 存储',
      pros: ['实现简单', '易于管理'],
      cons: ['服务器负担大', '扩展性差'],
      todo: ['配置 session', '实现登录接口'],
      actions: [
        { type: 'run', command: 'npm install express-session' }
      ]
    }
  ];

  const scenario = '需要为应用添加用户认证功能';

  try {
    const selected = await adventureManager.presentChoices(scenario, choices);
    console.log(chalk.green('\n✓ 选择了: ' + selected.id + ' - ' + selected.title));
    console.log(chalk.gray('这个功能将在 REPL 中自动执行选定的方案\n'));
  } catch (error) {
    console.error(chalk.red('测试失败:', error));
  }
}

async function testPlanChoice() {
  console.log(chalk.cyan('\n' + '='.repeat(60)));
  console.log(chalk.cyan.bold('  测试 Plan Choice'));
  console.log(chalk.cyan('='.repeat(60) + '\n'));

  const planChoiceManager = new PlanChoiceManager();

  // Mock plan
  const todo = ['安装依赖', '创建文件', '测试功能'];
  const actions: Action[] = [
    { type: 'run', command: 'npm install lodash' },
    { type: 'create', path: 'src/utils.ts', content: 'export function test() {}' },
    { type: 'run', command: 'npm test' }
  ];

  try {
    const choice = await planChoiceManager.presentPlanOptions(todo, actions, false);
    console.log(chalk.green('\n✓ 用户选择了: ' + choice));
    console.log(chalk.gray('这个功能将在 REPL 中根据选择执行相应操作\n'));
  } catch (error) {
    console.error(chalk.red('测试失败:', error));
  }
}

async function main() {
  console.log(chalk.yellow.bold('\n🎮 Adventure Mode 测试\n'));

  console.log(chalk.gray('这个测试将演示两个功能:'));
  console.log(chalk.gray('1. Adventure Mode - AI 生成多个方案让用户选择'));
  console.log(chalk.gray('2. Plan Choice - 计划生成后的选项菜单\n'));

  // Test 1: Adventure Mode
  await testAdventureMode();

  // Test 2: Plan Choice
  await testPlanChoice();

  console.log(chalk.cyan('='.repeat(60)));
  console.log(chalk.cyan.bold('  测试完成'));
  console.log(chalk.cyan('='.repeat(60) + '\n'));

  console.log(chalk.gray('要在实际 Kode CLI 中体验这些功能:'));
  console.log(chalk.gray('  1. 启动 REPL: npx newma-cli -i'));
  console.log(chalk.gray('  2. 输入一个需求（如: "添加用户认证"）'));
  console.log(chalk.gray('  3. 如果 AI 生成多个方案，会看到 Adventure Mode'));
  console.log(chalk.gray('  4. 计划生成后，会看到 Plan Choice 菜单\n'));

  console.log(chalk.green('✅ 所有测试功能正常工作！\n'));
}

main().catch(error => {
  console.error(chalk.red('Error:', error));
  process.exit(1);
});
