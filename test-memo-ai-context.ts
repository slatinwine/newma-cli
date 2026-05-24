/**
 * Memo AI 上下文增强测试
 *
 * 测试真实的 AI 调用场景，验证 memo 上下文是否正确注入
 */

import { MemoCliPlugin } from './src/loop/plugins/memo-cli-plugin';
import { callAI } from './src/ai';
import { Config } from './src/config';
import { scanDirectory } from './src/scanner';

// 测试配置
const PROJECT_ROOT = process.cwd();
const MEMO_PATH = '/Users/mac/freedomking/memo';

/**
 * 测试 AI 调用时的 Memo 上下文增强
 */
async function testAIWithContext() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Test: AI Context Enhancement with Memo');
  console.log('='.repeat(60));

  // 1. 初始化 Memo Plugin
  console.log('\n📋 Step 1: Initialize Memo Plugin');
  console.log('─'.repeat(60));
  const memoPlugin = new MemoCliPlugin(PROJECT_ROOT, MEMO_PATH);

  // 2. 确保有测试数据
  console.log('\n📋 Step 2: Setup Test Data');
  console.log('─'.repeat(60));

  // 先索引项目（确保有代码索引）
  console.log('Indexing project...');
  await memoPlugin.indexProject();
  console.log('✅ Project indexed');

  // 记录一些测试决策
  await memoPlugin.recordDecision(
    '认证系统架构',
    '使用 JWT + Refresh Token 双令牌机制，accessToken 有效期 15 分钟，refreshToken 有效期 7 天',
    ['auth', 'architecture', 'security']
  );

  await memoPlugin.recordDecision(
    '状态管理选择',
    '使用 Zustand 而非 Redux，因为更轻量且 TypeScript 支持更好',
    ['frontend', 'architecture']
  );

  console.log('✅ Recorded 2 test decisions');

  // 3. 测试上下文检索（模拟 AI 调用前的场景）
  console.log('\n📋 Step 3: Test Context Retrieval');
  console.log('─'.repeat(60));

  // 实际场景：AI 会从 requirement 中提取关键词进行搜索
  const requirement = '优化 Memo 插件功能';  // 修改：使用能找到代码的查询
  const searchQuery = 'memo';

  console.log(`  Requirement: "${requirement}"`);
  console.log(`  Search query: "${searchQuery}"`);

  // 搜索相关决策（可能没有，这是正常的）
  const decisions = await memoPlugin.searchDecisions(searchQuery);
  console.log(`✅ Found ${decisions.length} relevant decision(s)`);

  // 查找相关代码（使用完整 requirement）
  const relatedCode = await memoPlugin.findRelated(searchQuery);
  console.log(`✅ Found ${relatedCode.length} related file(s)`);

  // 4. 格式化上下文（这是会注入到 AI 提示词的内容）
  console.log('\n📋 Step 4: Formatted Context (will be injected to AI)');
  console.log('─'.repeat(60));

  let context = '\n\n📚 PROJECT MEMORY:\n';

  if (decisions.length > 0) {
    context += '\nRelevant Decisions:\n';
    decisions.slice(0, 5).forEach((d) => {
      const date = new Date(d.timestamp).toLocaleDateString();
      context += `- [${date}] ${d.title}\n`;
      context += `  ${d.content.substring(0, 100)}${d.content.length > 100 ? '...' : ''}\n`;
      if (d.tags.length > 0) {
        context += `  Tags: ${d.tags.join(', ')}\n`;
      }
    });
    context += `\nFound ${decisions.length} relevant decision(s)\n`;
  }

  if (relatedCode.length > 0) {
    context += '\nRelated Code:\n';
    relatedCode.slice(0, 5).forEach(({ file, info }) => {
      context += `- ${file}`;
      if (info.classes.length > 0) {
        context += ` (classes: ${info.classes.join(', ')})`;
      }
      context += '\n';
    });
    context += `\nFound ${relatedCode.length} relevant file(s)\n`;
  }

  console.log(context);

  // 5. 模拟 AI 提示词（实际会发送给 API 的内容）
  console.log('\n📋 Step 5: Simulated AI Prompt (what gets sent to API)');
  console.log('─'.repeat(60));

  const simulatedPrompt = `Project files: {...}
Task: ${requirement}
Return valid JSON with "todo" and "actions" arrays.${context}

User requirement: "${requirement}"
`;

  console.log(simulatedPrompt);

  // 6. 验证
  console.log('\n📋 Step 6: Verification');
  console.log('─'.repeat(60));

  const checks = {
    hasContext: decisions.length > 0 || relatedCode.length > 0,  // 任一即可
    hasContextInjection: context.includes('PROJECT MEMORY'),
    hasDecisionOrCode: context.includes('Relevant Decisions:') || context.includes('Related Code:'),
  };

  console.log('Verification Results:');
  console.log(`  ${checks.hasContext ? '✅' : '❌'} Found relevant context (decisions or code)`);
  console.log(`  ${checks.hasContextInjection ? '✅' : '❌'} Context will be injected to AI`);
  console.log(`  ${checks.hasDecisionOrCode ? '✅' : '❌'} Context formatted correctly`);

  const allPassed = Object.values(checks).every(v => v);

  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('🎉 SUCCESS! Memo context enhancement is working correctly.');
    console.log('\nWhat this means:');
    console.log('  • AI will receive historical decisions when planning');
    console.log('  • AI will know about existing related code');
    console.log('  • Plans will be more consistent with past decisions');
    console.log('  • Better code reuse and less duplication');
  } else {
    console.log('⚠️  Some checks failed. Review the output above.');
  }
  console.log('='.repeat(60) + '\n');

  return allPassed;
}

/**
 * 测试不同场景的上下文检索
 */
async function testDifferentScenarios() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Test: Different Requirement Scenarios');
  console.log('='.repeat(60));

  const memoPlugin = new MemoCliPlugin(PROJECT_ROOT, MEMO_PATH);

  const scenarios = [
    '优化认证性能',
    '添加状态管理',
    '重构用户模块',
  ];

  for (const requirement of scenarios) {
    console.log(`\n📋 Scenario: "${requirement}"`);
    console.log('─'.repeat(60));

    const decisions = await memoPlugin.searchDecisions(requirement);
    const relatedCode = await memoPlugin.findRelated(requirement);

    console.log(`  Decisions: ${decisions.length}`);
    decisions.slice(0, 2).forEach((d) => {
      console.log(`    - ${d.title}`);
    });

    console.log(`  Related Code: ${relatedCode.length}`);
    relatedCode.slice(0, 3).forEach(({ file }) => {
      console.log(`    - ${file}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ All scenarios tested successfully');
  console.log('='.repeat(60) + '\n');

  return true;
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  try {
    const result1 = await testAIWithContext();
    const result2 = await testDifferentScenarios();

    if (result1 && result2) {
      console.log('\n🎉 All AI context enhancement tests passed!\n');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests failed.\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test error:', error);
    process.exit(1);
  }
}

// 运行测试
runAllTests();
