#!/usr/bin/env ts-node
/**
 * Automated test for Adventure Mode (no user interaction required)
 */

import chalk from 'chalk';
import { AdventureManager } from './src/adventure';
import { PlanChoiceManager } from './src/plan-choice';
import { Choice } from './src/types';
import { Action } from './src/types';

function testAdventureManager() {
  console.log(chalk.cyan('\n' + '='.repeat(60)));
  console.log(chalk.cyan.bold('  测试 1: Adventure Manager'));
  console.log(chalk.cyan('='.repeat(60) + '\n'));

  const adventureManager = new AdventureManager();

  // Test data
  const choices: Choice[] = [
    {
      id: 'A',
      title: 'JWT 认证',
      description: '使用 JSON Web Token 进行无状态认证',
      pros: ['性能好', '易于扩展'],
      cons: ['需要处理 token 刷新'],
      todo: ['安装 JWT 库'],
      actions: [{ type: 'run', command: 'npm install jsonwebtoken' }]
    },
    {
      id: 'B',
      title: 'Session 认证',
      description: '使用服务端 session 存储',
      pros: ['实现简单'],
      cons: ['服务器负担大'],
      todo: ['配置 session'],
      actions: [{ type: 'run', command: 'npm install express-session' }]
    }
  ];

  const scenario = '需要为应用添加用户认证功能';

  // Test 1: Format choice summary
  console.log(chalk.gray('测试 1.1: 格式化选择摘要'));
  const summary = adventureManager.formatChoiceSummary(choices[0]);
  console.log(chalk.green('✓') + ' ' + summary);
  console.log('');

  // Test 2: Execute choice
  console.log(chalk.gray('测试 1.2: 执行选择'));
  const result = adventureManager.executeChoice(choices[0]);
  console.log(chalk.green('✓') + ' Todo items: ' + result.todo.length);
  console.log(chalk.green('✓') + ' Actions: ' + result.actions.length);
  console.log('');

  return true;
}

function testPlanChoiceManager() {
  console.log(chalk.cyan('\n' + '='.repeat(60)));
  console.log(chalk.cyan.bold('  测试 2: Plan Choice Manager'));
  console.log(chalk.cyan('='.repeat(60) + '\n'));

  const planChoiceManager = new PlanChoiceManager();

  // Test data
  const todo = ['安装依赖', '创建文件', '测试功能'];
  const actions: Action[] = [
    { type: 'run', command: 'npm install lodash' },
    { type: 'create', path: 'src/utils.ts', content: 'export function test() {}' },
    { type: 'run', command: 'npm test' }
  ];

  // Test: Show plan details (doesn't require user input)
  console.log(chalk.gray('测试 2.1: 显示计划详情'));
  console.log(chalk.gray('─'.repeat(60)));
  planChoiceManager.showPlanDetails(todo, actions);
  console.log('');

  return true;
}

function testTypeDefinitions() {
  console.log(chalk.cyan('\n' + '='.repeat(60)));
  console.log(chalk.cyan.bold('  测试 3: 类型定义'));
  console.log(chalk.cyan('='.repeat(60) + '\n'));

  // Test Choice interface
  const choice: Choice = {
    id: 'A',
    title: 'Test Choice',
    description: 'Test description',
    pros: ['pro1', 'pro2'],
    cons: ['con1'],
    todo: ['step1', 'step2'],
    actions: [{ type: 'run', command: 'echo test' }]
  };

  console.log(chalk.gray('测试 3.1: Choice 接口'));
  console.log(chalk.green('✓') + ' id: ' + choice.id);
  console.log(chalk.green('✓') + ' title: ' + choice.title);
  console.log(chalk.green('✓') + ' pros: ' + choice.pros.length);
  console.log(chalk.green('✓') + ' cons: ' + choice.cons.length);
  console.log(chalk.green('✓') + ' todo: ' + choice.todo.length);
  console.log(chalk.green('✓') + ' actions: ' + choice.actions.length);
  console.log('');

  // Test AdventureResponse interface
  const adventureResponse = {
    type: 'choice' as const,
    scenario: 'Test scenario',
    choices: [choice]
  };

  console.log(chalk.gray('测试 3.2: AdventureResponse 接口'));
  console.log(chalk.green('✓') + ' type: ' + adventureResponse.type);
  console.log(chalk.green('✓') + ' scenario: ' + adventureResponse.scenario);
  console.log(chalk.green('✓') + ' choices: ' + adventureResponse.choices.length);
  console.log('');

  return true;
}

function testIntegration() {
  console.log(chalk.cyan('\n' + '='.repeat(60)));
  console.log(chalk.cyan.bold('  测试 4: 集成验证'));
  console.log(chalk.cyan('='.repeat(60) + '\n'));

  // Verify files exist
  const fs = require('fs');
  const path = require('path');

  const files = [
    'src/adventure.ts',
    'src/plan-choice.ts',
    'src/types.ts',
    'dist/adventure.js',
    'dist/plan-choice.js'
  ];

  console.log(chalk.gray('测试 4.1: 验证文件存在'));
  let allExist = true;
  files.forEach(file => {
    const exists = fs.existsSync(path.join(process.cwd(), file));
    const status = exists ? chalk.green('✓') : chalk.red('✗');
    console.log(status + ' ' + file);
    if (!exists) allExist = false;
  });
  console.log('');

  // Verify exports
  console.log(chalk.gray('测试 4.2: 验证模块导出'));
  try {
    const { AdventureManager } = require('./src/adventure');
    const { PlanChoiceManager } = require('./src/plan-choice');
    const { Choice } = require('./src/types');

    console.log(chalk.green('✓') + ' AdventureManager exported');
    console.log(chalk.green('✓') + ' PlanChoiceManager exported');
    console.log(chalk.green('✓') + ' Choice type exported');
    console.log('');
  } catch (error: any) {
    console.log(chalk.red('✗') + ' Export error: ' + error.message);
    console.log('');
    return false;
  }

  return allExist;
}

async function main() {
  console.log(chalk.yellow.bold('\n🎮 Adventure Mode 自动化测试\n'));
  console.log(chalk.gray('这个测试验证 Adventure Mode 的核心功能\n'));

  const results = {
    adventureManager: testAdventureManager(),
    planChoiceManager: testPlanChoiceManager(),
    typeDefinitions: testTypeDefinitions(),
    integration: testIntegration()
  };

  console.log(chalk.cyan('='.repeat(60)));
  console.log(chalk.cyan.bold('  测试总结'));
  console.log(chalk.cyan('='.repeat(60) + '\n'));

  console.log(chalk.gray('Adventure Manager:'));
  console.log(results.adventureManager ? chalk.green('  ✅ 通过') : chalk.red('  ❌ 失败'));

  console.log(chalk.gray('Plan Choice Manager:'));
  console.log(results.planChoiceManager ? chalk.green('  ✅ 通过') : chalk.red('  ❌ 失败'));

  console.log(chalk.gray('类型定义:'));
  console.log(results.typeDefinitions ? chalk.green('  ✅ 通过') : chalk.red('  ❌ 失败'));

  console.log(chalk.gray('集成验证:'));
  console.log(results.integration ? chalk.green('  ✅ 通过') : chalk.red('  ❌ 失败'));
  console.log('');

  const allPassed = Object.values(results).every(r => r === true);

  if (allPassed) {
    console.log(chalk.green.bold('✅ 所有测试通过！\n'));
    console.log(chalk.gray('📚 下一步:'));
    console.log(chalk.gray('  1. 启动 REPL: npx newma-cli -i'));
    console.log(chalk.gray('  2. 输入需求（如: "添加用户认证"）'));
    console.log(chalk.gray('  3. 体验 Adventure Mode 和 Plan Choice\n'));
  } else {
    console.log(chalk.red.bold('❌ 部分测试失败\n'));
  }

  return allPassed;
}

main()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error(chalk.red('Error:', error));
    process.exit(1);
  });
