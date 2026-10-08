#!/usr/bin/env ts-node
/**
 * 自动化测试 /plan 命令修复
 * 不需要交互式输入，直接测试 callAI 函数
 */

import { config } from 'dotenv';
config(); // Load .env file

import { callAI } from './dist/ai';
import { Config } from './dist/config';
import chalk from 'chalk';

// 测试配置
const testConfig: Config = {
  apiKey: process.env.OPENAI_API_KEY || '',
  baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  endpoint: undefined,
  functionCallingEnabled: false,
  executionMode: 'standard',
};

// 测试用例
const testCases = [
  {
    name: '测试1: 总结项目',
    requirement: '总结项目',
    description: '应该返回包含 todo 和 actions 的 JSON',
  },
  {
    name: '测试2: 创建文件',
    requirement: '创建一个 hello.ts 文件，输出 hello world',
    description: '应该返回 create 类型的 action',
  },
  {
    name: '测试3: 查询任务',
    requirement: '这个项目是做什么的',
    description: '应该返回 run 类型的 action 来读取文档',
  },
];

async function runTest(testCase: any, index: number) {
  console.log(chalk.cyan(`\n${'='.repeat(60)}`));
  console.log(chalk.cyan(`${testCase.name}`));
  console.log(chalk.gray(testCase.description));
  console.log(chalk.cyan('='.repeat(60)));

  const projectInfo = {
    'README.md': '# Kode CLI\n\nAI development assistant',
    'package.json': '{"name": "newma-cli", "version": "1.0.0"}',
    'src/ai.ts': '// AI integration code',
  };

  try {
    console.log(chalk.gray('\n📤 Calling AI (plan mode)...'));

    const response = await callAI(
      testConfig,
      projectInfo,
      testCase.requirement,
      'plan',  // Plan mode
      undefined,  // No history
      undefined,  // No tools - 关键：不传递工具列表
      undefined,  // No permissions
      undefined,  // No compression
      undefined,  // No project root
      undefined,  // No signal
      undefined,  // No ultrathink
      undefined   // No user profile
    );

    // 检查响应类型
    if (response.type === 'error') {
      console.log(chalk.red('\n❌ 失败：返回了错误类型'));
      console.log(chalk.yellow(`错误信息：${response.message}`));
      return false;
    }

    // 检查是否有 content (乱码或其他非JSON内容)
    if (response.content && !response.todo && !response.actions) {
      console.log(chalk.red('\n❌ 失败：AI返回了纯文本而不是JSON'));
      console.log(chalk.gray('内容预览：'));
      console.log(chalk.gray(response.content.substring(0, 200)));
      return false;
    }

    // 验证JSON结构
    const hasTodo = Array.isArray(response.todo);
    const hasActions = Array.isArray(response.actions);

    console.log(chalk.green('\n✅ 响应格式正确'));
    console.log(chalk.gray(`  - type: ${response.type || 'task'}`));
    console.log(chalk.gray(`  - todo: ${hasTodo ? response.todo.length + ' items' : 'missing'}`));
    console.log(chalk.gray(`  - actions: ${hasActions ? response.actions.length + ' items' : 'missing'}`));

    // 显示 TODO 列表
    if (hasTodo && response.todo.length > 0) {
      console.log(chalk.cyan('\n📋 TODO 列表:'));
      response.todo.forEach((item, idx) => {
        console.log(chalk.gray(`  ${idx + 1}. ${item}`));
      });
    }

    // 显示 Actions
    if (hasActions && response.actions.length > 0) {
      console.log(chalk.cyan('\n⚡ Action 列表:'));
      response.actions.forEach((action, idx) => {
        const type = chalk.cyan(action.type);
        const desc = action.type === 'run'
          ? action.command
          : action.type === 'create' || action.type === 'modify'
          ? action.path
          : JSON.stringify(action);
        console.log(chalk.gray(`  ${idx + 1}. [${type}] ${desc}`));
      });
    }

    // 验证成功
    if (!hasTodo || !hasActions) {
      console.log(chalk.yellow('\n⚠️  警告：缺少 todo 或 actions 数组'));
      return false;
    }

    console.log(chalk.green('\n✅ 测试通过'));
    return true;

  } catch (error: any) {
    console.log(chalk.red('\n❌ 异常：'), error.message);
    if (error.message.includes('ETIMEDOUT')) {
      console.log(chalk.yellow('提示：网络超时，请检查网络连接'));
    }
    return false;
  }
}

async function main() {
  console.log(chalk.cyan('\n🧪 /plan 命令修复验证测试\n'));
  console.log(chalk.gray('测试目标：验证 /plan 命令返回标准 JSON 格式，不再返回乱码\n'));

  // 检查配置
  if (!testConfig.apiKey) {
    console.log(chalk.red('❌ 错误：未设置 OPENAI_API_KEY 环境变量'));
    console.log(chalk.gray('请设置：export OPENAI_API_KEY=your_key\n'));
    process.exit(1);
  }

  console.log(chalk.gray('配置：'));
  console.log(chalk.gray(`  - API: ${testConfig.baseUrl}`));
  console.log(chalk.gray(`  - Model: ${testConfig.model}`));
  console.log(chalk.gray(`  - Tests: ${testCases.length}\n`));

  // 运行所有测试
  const results = [];
  for (let i = 0; i < testCases.length; i++) {
    const passed = await runTest(testCases[i], i);
    results.push({ name: testCases[i].name, passed });
  }

  // 总结
  console.log(chalk.cyan(`\n${'='.repeat(60)}`));
  console.log(chalk.cyan('测试总结'));
  console.log(chalk.cyan('='.repeat(60)));

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  results.forEach((result, idx) => {
    const icon = result.passed ? chalk.green('✅') : chalk.red('❌');
    console.log(`${icon} ${result.name}`);
  });

  console.log(chalk.cyan('\n' + '='.repeat(60)));
  console.log(chalk.gray(`通过：${passedCount}/${totalCount}\n`));

  if (passedCount === totalCount) {
    console.log(chalk.green('🎉 所有测试通过！/plan 命令修复成功！\n'));
    process.exit(0);
  } else {
    console.log(chalk.red('❌ 部分测试失败，需要进一步调试\n'));
    process.exit(1);
  }
}

main().catch(error => {
  console.error(chalk.red('测试运行失败：'), error);
  process.exit(1);
});
