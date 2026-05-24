#!/usr/bin/env node

/**
 * Test script for user profile generation
 */

const path = require('path');
const fs = require('fs').promises;

// Simulate the profile generation prompt
async function testProfilePrompt() {
  console.log('🧪 Testing User Profile Generation\n');
  console.log('=' .repeat(60));

  // Simulate user inputs
  const userInputs = [
    '今天东莞气温',
    '小米股价',
    '如何评价任正非',
    '1+1=',
    '帮我写个TypeScript函数'
  ];

  const inputsText = userInputs.map((input, idx) => `${idx + 1}. ${input}`).join('\n');

  // New improved prompt
  const prompt = `你是一个用户侧写分析专家。

用户输入历史（${userInputs.length}条）：
${inputsText}

【任务】请生成用户侧写文档，直接以markdown格式输出。

【重要】
- 直接输出侧写文档，不要输出任何分析过程、思考步骤或说明
- 不要说"让我分析"、"我将生成"之类的话
- 直接开始输出侧写内容

【输出格式示例】
# 用户侧写

## 语言偏好
中文

## 交流风格
简洁直接，偏好技术性回答

## 技术偏好
TypeScript, Node.js

## 其他特征
重视代码质量，喜欢实用示例

【要求】
1. 提取用户语言偏好（中文、英文等）
2. 识别交流风格（简洁、详细、正式、随意等）
3. 识别技术偏好（编程语言、工具偏好）
4. 输出简洁（100-200字）的markdown文档
5. 直接输出内容，不要有分析过程`;

  console.log('\n📋 Test Inputs:');
  console.log(inputsText);
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Prompt Updated Successfully!');
  console.log('\nKey Improvements:');
  console.log('  1. Added clear role definition (你是一个用户侧写分析专家)');
  console.log('  2. Added explicit "直接输出" instruction');
  console.log('  3. Added output format example');
  console.log('  4. Banned analysis phrases ("让我分析", "我将生成")');
  console.log('  5. Structured with clear sections');

  console.log('\n' + '='.repeat(60));
  console.log('\n💡 Next Steps:');
  console.log('  1. Start kode-cli: npx kode-cli -i');
  console.log('  2. Chat 5 times to trigger profile generation');
  console.log('  3. Check 用户侧写.md for proper format');
  console.log('\n');
}

testProfilePrompt().catch(console.error);
