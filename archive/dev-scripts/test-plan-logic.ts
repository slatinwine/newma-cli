#!/usr/bin/env ts-node
/**
 * 逻辑测试：验证 /plan 模式下的 API 请求参数
 * 不需要实际调用 API，只验证 requestBody 的构建逻辑
 */

import { Config } from './dist/config';
import chalk from 'chalk';

// 模拟 callAI 函数中构建 requestBody 的逻辑
function buildRequestBodyLogic(
  mode: 'plan' | 'verify' | 'think',
  availableTools?: string[]
) {
  const requestBody: any = {
    model: 'gpt-4o-mini',
    temperature: 0,
    max_tokens: 4096,
    messages: [],
  };

  // 这是修复后的逻辑（从 ai.ts:835-855 复制的）
  if (mode !== 'think' && mode !== 'plan' && mode !== 'verify' && availableTools && availableTools.length > 0) {
    // Only use tools in non-plan/verify modes
    requestBody.tools = availableTools.map(toolName => ({
      type: "function",
      function: {
        name: toolName,
        description: `Capability: ${toolName}`,
        parameters: {
          type: "object",
          properties: {},
        }
      }
    }));
  } else if (mode === 'plan' || mode === 'verify') {
    // Plan/verify modes: Force JSON response format (do NOT use tools)
    requestBody.response_format = { type: "json_object" };
  }

  return requestBody;
}

function testCase(name: string, mode: any, tools: string[] | undefined, expected: any) {
  console.log(chalk.cyan(`\n测试：${name}`));
  console.log(chalk.gray('─'.repeat(50)));

  const requestBody = buildRequestBodyLogic(mode, tools);

  // 检查是否有 tools
  const hasTools = !!requestBody.tools;
  const hasResponseFormat = !!requestBody.response_format;

  console.log(chalk.gray(`Mode: ${mode}`));
  console.log(chalk.gray(`Tools: ${tools ? tools.join(', ') : 'none'}`));
  console.log(chalk.gray(`Result:`));
  console.log(chalk.gray(`  - tools: ${hasTools ? '✅' : '❌'}`));
  console.log(chalk.gray(`  - response_format: ${hasResponseFormat ? '✅' : '❌'}`));

  // 验证预期
  let passed = true;

  if (expected.shouldHaveTools && !hasTools) {
    console.log(chalk.red('  ❌ 应该有 tools 但没有'));
    passed = false;
  } else if (!expected.shouldHaveTools && hasTools) {
    console.log(chalk.red('  ❌ 不应该有 tools 但有'));
    passed = false;
  }

  if (expected.shouldHaveResponseFormat && !hasResponseFormat) {
    console.log(chalk.red('  ❌ 应该有 response_format 但没有'));
    passed = false;
  } else if (!expected.shouldHaveResponseFormat && hasResponseFormat) {
    console.log(chalk.red('  ❌ 不应该有 response_format 但有'));
    passed = false;
  }

  if (passed) {
    console.log(chalk.green('  ✅ 通过'));
  }

  return passed;
}

async function main() {
  console.log(chalk.cyan('\n🧪 /plan 模式逻辑验证测试\n'));
  console.log(chalk.gray('验证 API 请求参数构建是否正确\n'));

  let passedCount = 0;
  let totalCount = 0;

  // 测试用例
  const tests = [
    {
      name: 'plan 模式，有工具列表（修复的关键场景）',
      mode: 'plan',
      tools: ['file', 'command', 'search'],
      expected: {
        shouldHaveTools: false,  // 关键：不应该使用 tools
        shouldHaveResponseFormat: true,  // 应该使用 response_format
      }
    },
    {
      name: 'plan 模式，无工具列表',
      mode: 'plan',
      tools: undefined,
      expected: {
        shouldHaveTools: false,
        shouldHaveResponseFormat: true,
      }
    },
    {
      name: 'verify 模式，有工具列表',
      mode: 'verify',
      tools: ['file', 'command'],
      expected: {
        shouldHaveTools: false,
        shouldHaveResponseFormat: true,
      }
    },
    {
      name: 'think 模式，有工具列表',
      mode: 'think',
      tools: ['file', 'command'],
      expected: {
        shouldHaveTools: false,
        shouldHaveResponseFormat: false,
      }
    },
    {
      name: '其他模式（非 plan/verify/think），有工具列表',
      mode: 'chat',
      tools: ['file', 'command'],
      expected: {
        shouldHaveTools: true,  // 其他模式可以使用 tools
        shouldHaveResponseFormat: false,
      }
    },
  ];

  for (const test of tests) {
    totalCount++;
    const passed = testCase(test.name, test.mode, test.tools, test.expected);
    if (passed) passedCount++;
  }

  // 总结
  console.log(chalk.cyan(`\n${'='.repeat(50)}`));
  console.log(chalk.cyan('测试总结'));
  console.log(chalk.cyan('='.repeat(50)));
  console.log(chalk.gray(`通过：${passedCount}/${totalCount}\n`));

  if (passedCount === totalCount) {
    console.log(chalk.green('✅ 所有逻辑测试通过！\n'));
    console.log(chalk.cyan('关键修复：'));
    console.log(chalk.gray('  • plan/verify 模式强制使用 response_format'));
    console.log(chalk.gray('  • 不会与 tools 参数冲突'));
    console.log(chalk.gray('  • 确保 API 返回标准 JSON 格式\n'));
    process.exit(0);
  } else {
    console.log(chalk.red('❌ 部分测试失败\n'));
    process.exit(1);
  }
}

main().catch(error => {
  console.error(chalk.red('测试失败：'), error);
  process.exit(1);
});
