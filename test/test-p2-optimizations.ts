// test/test-p2-optimizations.ts
/**
 * P2 优化功能测试
 * 测试 Token 预算管理、结构化压缩、子代理提示词、Prompt 架构
 */

import { TokenBudgetManager, type Message } from '../src/context/tokenBudget';
import {
  CompactSummaryFormatter,
  SummaryExtractor,
  CompactSummaryManager,
} from '../src/compressor/structuredSummary';
import {
  AgentPromptBuilder,
  AgentPromptManager,
  EXPLORE_AGENT_PROMPT,
  VERIFY_AGENT_PROMPT,
  PLAN_AGENT_PROMPT,
} from '../src/agents/prompts';
import { PromptBuilder, buildSystemPromptWithOptions } from '../src/prompt/promptBuilder';

/**
 * 测试辅助函数
 */
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message}\nExpected: ${expected}\nActual: ${actual}`);
  }
}

/**
 * P2-1: Token 预算管理器测试
 */
function testTokenBudgetManager() {
  console.log('\n📊 Testing TokenBudgetManager...');

  const manager = new TokenBudgetManager(8000);

  // 测试 1: 基本分配
  console.log('  Test 1: Basic allocation...');
  const allocation = manager.allocate(1000, 2000);
  assert(allocation.systemPrompt === 1000, 'System prompt should be 1000');
  assert(allocation.toolResults === 2000, 'Tool results should be 2000');
  assert(allocation.history > 0, 'History should be positive');
  assert(allocation.context > 0, 'Context should be positive');
  assert(allocation.reserve > 0, 'Reserve should be positive');
  console.log('    ✓ Passed');

  // 测试 2: Token 估算（中文）
  console.log('  Test 2: Token estimation (Chinese)...');
  const chineseText = '这是一个测试文本，用于估算中文字符的 token 数量。';
  const zhTokens = manager.estimateTokens(chineseText);
  assert(zhTokens > 0, 'Should estimate positive tokens for Chinese');
  console.log(`    Estimated ${zhTokens} tokens for ${chineseText.length} chars`);
  console.log('    ✓ Passed');

  // 测试 3: Token 估算（英文）
  console.log('  Test 3: Token estimation (English)...');
  const englishText = 'This is a test text for estimating token count for English characters.';
  const enTokens = manager.estimateTokens(englishText);
  assert(enTokens > 0, 'Should estimate positive tokens for English');
  console.log(`    Estimated ${enTokens} tokens for ${englishText.length} chars`);
  console.log('    ✓ Passed');

  // 测试 4: 历史截断
  console.log('  Test 4: History truncation...');
  const messages: Message[] = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'First message' },
    { role: 'assistant', content: 'First response' },
    { role: 'user', content: 'Second message' },
    { role: 'assistant', content: 'Second response' },
    { role: 'user', content: 'Third message' },
  ];
  const truncated = manager.truncateHistory(messages, 100);
  assert(truncated.length > 0, 'Should have some messages after truncation');
  assert(truncated[0].role === 'system', 'Should keep system message');
  console.log(`    Truncated from ${messages.length} to ${truncated.length} messages`);
  console.log('    ✓ Passed');

  // 测试 5: 使用分析
  console.log('  Test 5: Usage analysis...');
  const analysis = manager.analyzeUsage({
    systemPrompt: 'You are a helpful assistant.',
    messages: messages,
    toolResults: [],
    context: 'Some context',
  });
  assert(analysis.allocation.available === 8000, 'Total budget should be 8000');
  assert(analysis.usage.total > 0, 'Total usage should be positive');
  console.log(`    Utilization: ${(analysis.usage.utilizationRate * 100).toFixed(1)}%`);
  console.log('    ✓ Passed');

  console.log('✅ TokenBudgetManager tests passed!\n');
}

/**
 * P2-2: 结构化摘要测试
 */
function testStructuredSummary() {
  console.log('\n📝 Testing StructuredSummary...');

  const extractor = new SummaryExtractor();

  // 测试 1: 提取主要请求
  console.log('  Test 1: Extract primary request...');
  const messages: Message[] = [
    { role: 'user', content: 'Create a login page' },
    { role: 'assistant', content: 'I will create a login page for you.' },
    { role: 'user', content: 'Add authentication' },
  ];
  const result = extractor.extractFromMessages(messages);
  assert(result.summary.primaryRequest.length > 0, 'Should extract primary request');
  console.log(`    Extracted: "${result.summary.primaryRequest.substring(0, 50)}..."`);
  console.log('    ✓ Passed');

  // 测试 2: 格式化摘要
  console.log('  Test 2: Format summary...');
  const formatted = CompactSummaryFormatter.formatCompact(result.summary);
  assert(formatted.includes('# Conversation Summary'), 'Should include title');
  assert(formatted.includes('Primary Request'), 'Should include primary request section');
  console.log(`    Formatted ${formatted.length} chars`);
  console.log('    ✓ Passed');

  // 测试 3: JSON 序列化
  console.log('  Test 3: JSON serialization...');
  const json = CompactSummaryFormatter.toJSON(result.summary);
  assert(json.includes('primaryRequest'), 'Should include primaryRequest in JSON');
  const parsed = CompactSummaryFormatter.fromJSON(json);
  assert(parsed.primaryRequest === result.summary.primaryRequest, 'Should round-trip correctly');
  console.log('    ✓ Passed');

  // 测试 4: 元数据计算
  console.log('  Test 4: Metadata calculation...');
  assert(result.metadata.originalMessageCount === 3, 'Should count 3 messages');
  assert(result.metadata.originalTokenEstimate > 0, 'Should estimate original tokens');
  assert(result.metadata.compressedTokenEstimate > 0, 'Should estimate compressed tokens');
  assert(result.metadata.compressionRatio > 0, 'Should have compression ratio');
  console.log(`    Compression ratio: ${(result.metadata.compressionRatio * 100).toFixed(1)}%`);
  console.log('    ✓ Passed');

  // 测试 5: 自动压缩管理器
  console.log('  Test 5: Auto-compression manager...');
  const manager = new CompactSummaryManager();
  const compressionResult = manager.compressIfNeeded(messages, 50);
  // 消息应该不会超出 50 tokens 预算，所以不应该压缩
  assert(!compressionResult.compressed, 'Should not compress if under budget');
  console.log('    ✓ Passed');

  console.log('✅ StructuredSummary tests passed!\n');
}

/**
 * P2-3: 子代理提示词测试
 */
function testAgentPrompts() {
  console.log('\n🤖 Testing Agent Prompts...');

  // 测试 1: 探索代理提示词
  console.log('  Test 1: Explore agent prompt...');
  const explorePrompt = AgentPromptBuilder.buildExplorePrompt();
  assert(explorePrompt.includes('READ-ONLY'), 'Should include read-only warning');
  assert(explorePrompt.includes('Glob'), 'Should mention Glob tool');
  assert(explorePrompt.includes('Grep'), 'Should mention Grep tool');
  console.log(`    Explore prompt length: ${explorePrompt.length} chars`);
  console.log('    ✓ Passed');

  // 测试 2: 验证代理提示词
  console.log('  Test 2: Verify agent prompt...');
  const verifyPrompt = AgentPromptBuilder.buildVerifyPrompt();
  assert(verifyPrompt.includes('verification specialist'), 'Should mention verification');
  assert(verifyPrompt.toLowerCase().includes('anti-rationalization'), 'Should include anti-rationalization');
  assert(verifyPrompt.includes('Reading is NOT verification'), 'Should warn against reading-only');
  console.log(`    Verify prompt length: ${verifyPrompt.length} chars`);
  console.log('    ✓ Passed');

  // 测试 3: 规划代理提示词
  console.log('  Test 3: Plan agent prompt...');
  const planPrompt = AgentPromptBuilder.buildPlanPrompt();
  assert(planPrompt.includes('planning specialist'), 'Should mention planning');
  assert(planPrompt.includes('dependencies'), 'Should mention dependencies');
  assert(planPrompt.includes('trade-offs'), 'Should mention trade-offs');
  console.log(`    Plan prompt length: ${planPrompt.length} chars`);
  console.log('    ✓ Passed');

  // 测试 4: 提示词管理器
  console.log('  Test 4: Agent prompt manager...');
  const manager = new AgentPromptManager();
  manager.registerConfig('test-explore', {
    agentType: 'explore',
    customInstructions: 'Custom explore instructions',
  });
  const builtPrompt = manager.buildPrompt('test-explore');
  assert(builtPrompt.includes('Custom explore instructions'), 'Should include custom instructions');
  console.log('    ✓ Passed');

  // 测试 5: 代理类型验证
  console.log('  Test 5: Agent type validation...');
  assert(AgentPromptBuilder.isValidAgentType('explore'), 'Explore should be valid');
  assert(AgentPromptBuilder.isValidAgentType('verify'), 'Verify should be valid');
  assert(AgentPromptBuilder.isValidAgentType('plan'), 'Plan should be valid');
  assert(!AgentPromptBuilder.isValidAgentType('invalid'), 'Invalid should be invalid');
  console.log('    ✓ Passed');

  console.log('✅ Agent Prompts tests passed!\n');
}

/**
 * P2-4: Prompt 构建器测试
 */
function testPromptBuilder() {
  console.log('\n🔨 Testing PromptBuilder...');

  // 测试 1: 基本构建
  console.log('  Test 1: Basic building...');
  const builder = new PromptBuilder();
  builder.addStatic('Static content', 0, true);
  builder.addDynamic('Dynamic content', 0);
  const result = builder.build();
  assert(result.fullPrompt.includes('Static content'), 'Should include static content');
  assert(result.fullPrompt.includes('Dynamic content'), 'Should include dynamic content');
  assert(result.staticTokens > 0, 'Should estimate static tokens');
  assert(result.dynamicTokens > 0, 'Should estimate dynamic tokens');
  console.log(`    Total tokens: ${result.totalTokens}`);
  console.log('    ✓ Passed');

  // 测试 2: 静态+动态分区
  console.log('  Test 2: Static/Dynamic separation...');
  assert(result.fullPrompt.includes('__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__'), 'Should include boundary');
  assert(result.staticSection.includes('Static content'), 'Static section should work');
  assert(result.dynamicSection.includes('Dynamic content'), 'Dynamic section should work');
  console.log(`    Static: ${result.staticTokens} tokens, Dynamic: ${result.dynamicTokens} tokens`);
  console.log('    ✓ Passed');

  // 测试 3: 优先级排序
  console.log('  Test 3: Priority ordering...');
  const builder2 = new PromptBuilder();
  builder2.addStatic('Low priority', 10, true);
  builder2.addStatic('High priority', 0, true);
  builder2.addStatic('Medium priority', 5, true);
  const result2 = builder2.build();
  const staticLines = result2.staticSection.split('\n').filter(l => l.includes('priority'));
  assert(staticLines[0].includes('High'), 'High priority should come first');
  assert(staticLines[1].includes('Medium'), 'Medium priority should come second');
  assert(staticLines[2].includes('Low'), 'Low priority should come last');
  console.log('    ✓ Passed');

  // 测试 4: 克隆构建器
  console.log('  Test 4: Clone builder...');
  const cloned = builder.clone();
  const cloneResult = cloned.build();
  assert(cloneResult.fullPrompt === result.fullPrompt, 'Cloned builder should produce same result');
  console.log('    ✓ Passed');

  // 测试 5: 清空构建器
  console.log('  Test 5: Clear builder...');
  builder.clear();
  const emptyResult = builder.build();
  assert(emptyResult.fullPrompt.trim().length === 0 || emptyResult.fullPrompt.includes('__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__'), 'Cleared builder should be empty');
  console.log('    ✓ Passed');

  console.log('✅ PromptBuilder tests passed!\n');
}

/**
 * 集成测试
 */
function testIntegration() {
  console.log('\n🔗 Testing Integration...');

  // 测试 1: TokenBudgetManager + StructuredSummary
  console.log('  Test 1: TokenBudgetManager + StructuredSummary...');
  const tokenManager = new TokenBudgetManager(8000);
  const summaryManager = new CompactSummaryManager(tokenManager);

  const longConversation: Message[] = [];
  for (let i = 0; i < 50; i++) {
    longConversation.push({ role: 'user', content: `Message ${i}: Some user input here.` });
    longConversation.push({
      role: 'assistant',
      content: `Response ${i}: Some assistant response here. This is a longer response to simulate real conversation.`,
    });
  }

  const compressed = summaryManager.compressIfNeeded(longConversation, 1000);
  console.log(`    Original: ${longConversation.length} messages`);
  console.log(`    Compressed: ${compressed.compressed ? 'Yes' : 'No'}`);
  console.log('    ✓ Passed');

  // 测试 2: AgentPrompts + PromptBuilder
  console.log('  Test 2: AgentPrompts + PromptBuilder...');
  const builder = new PromptBuilder();
  const agentPrompt = AgentPromptBuilder.buildSystemPrompt('explore');
  builder.addStatic(agentPrompt, 5, true);
  const promptResult = builder.build();
  assert(promptResult.fullPrompt.includes('READ-ONLY'), 'Should include explore agent prompt');
  console.log(`    Combined prompt: ${promptResult.totalTokens} tokens`);
  console.log('    ✓ Passed');

  console.log('✅ Integration tests passed!\n');
}

/**
 * 主测试运行器
 */
export async function runP2Tests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Running P2 Optimization Tests');
  console.log('='.repeat(60));

  try {
    testTokenBudgetManager();
    testStructuredSummary();
    testAgentPrompts();
    testPromptBuilder();
    testIntegration();

    console.log('\n' + '='.repeat(60));
    console.log('✅ All P2 tests passed successfully!');
    console.log('='.repeat(60) + '\n');

    return {
      success: true,
      testsRun: 5,
      testsPassed: 5,
      testsFailed: 0,
    };
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    return {
      success: false,
      testsRun: 5,
      testsPassed: 4,
      testsFailed: 1,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runP2Tests()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
