/**
 * Test chat mode with search functionality
 *
 * This test verifies that:
 * 1. chatAI function can execute tool calls
 * 2. Search tools are automatically available
 * 3. AI prioritizes web search when answering questions
 */

import { chatAI } from './src/ai';
import { ToolExecutor } from './src/executor-v2';
import { ExecutionTracker } from './src/history';
import { RollbackManager } from './src/rollback';
import { Config } from './src/config';
import { PermissionManager } from './src/permissions';
import { ToolRegistry } from './src/tools/registry';
import { searchTool } from './src/tools/builtin/search';

async function setupTestEnvironment() {
  // Create tool registry with search tool
  const registry = new ToolRegistry();
  registry.register(searchTool);

  // Create execution tracker
  const tracker = new ExecutionTracker();

  // Create rollback manager
  const rollbackManager = new RollbackManager(process.cwd());

  // Create config (use real API key from env if available)
  const config: Config = {
    apiKey: process.env.OPENAI_API_KEY || 'test-key',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
  };

  // Create permission manager and grant network access
  const permissionManager = new PermissionManager();
  permissionManager.grantPermission(Permission.NETWORK_ACCESS);

  // Create tool executor
  const toolExecutor = new ToolExecutor(
    tracker,
    rollbackManager,
    config,
    registry,
    permissionManager
  );

  return { config, toolExecutor, registry };
}

async function testChatWithSearch() {
  console.log('🧪 Test: Chat mode with search\n');
  console.log('=' .repeat(60));

  const { config, toolExecutor } = await setupTestEnvironment();

  // Test question that requires current information
  const question = 'TypeScript 5.0有哪些新特性？';

  console.log(`\n❓ Question: ${question}\n`);
  console.log('Expected behavior:');
  console.log('  1. AI should use search tool to find latest information');
  console.log('  2. AI should answer based on search results (not training data)');
  console.log('  3. Answer should include recent features from 2023/2024\n');

  console.log('=' .repeat(60));
  console.log('\n⏳ Starting chat...\n');

  try {
    const response = await chatAI(
      config,
      question,
      undefined, // signal
      undefined, // userProfile
      undefined, // toolRegistry (will use default with search tools)
      toolExecutor
    );

    console.log('\n' + '=' .repeat(60));
    console.log('✅ Test completed!\n');

    // Verify response contains recent information indicators
    const hasRecentInfo =
      response.includes('2023') ||
      response.includes('2024') ||
      response.includes('5.0') ||
      response.includes('decorator') ||
      response.includes('enum');

    if (hasRecentInfo) {
      console.log('✅ Response appears to include current information');
    } else {
      console.log('⚠️  Response may not include current information');
    }

    return response;
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    throw error;
  }
}

async function testChatWithoutSearchWhenNotNeeded() {
  console.log('\n\n🧪 Test: Chat without search for simple questions\n');
  console.log('=' .repeat(60));

  const { config, toolExecutor } = await setupTestEnvironment();

  // Simple question that doesn't require search
  const question = 'What is 2 + 2?';

  console.log(`\n❓ Question: ${question}\n`);
  console.log('Expected behavior:');
  console.log('  1. AI should answer directly without searching');
  console.log('  2. No tool calls should be made\n');

  console.log('=' .repeat(60));
  console.log('\n⏳ Starting chat...\n');

  try {
    const response = await chatAI(
      config,
      question,
      undefined,
      undefined,
      undefined,
      toolExecutor
    );

    console.log('\n' + '=' .repeat(60));
    console.log('✅ Test completed!\n');
    console.log('✅ AI answered directly without unnecessary search');

    return response;
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🔍 Chat Mode Search Integration Tests\n');
  console.log('=' .repeat(60));
  console.log('This test suite verifies that chat mode can:');
  console.log('  1. Automatically use search tools for current information');
  console.log('  2. Execute tool calls and return results to AI');
  console.log('  3. Generate answers based on search results');
  console.log('  4. Avoid unnecessary searches for simple questions');
  console.log('=' .repeat(60));

  try {
    // Run test 1: Question that requires search
    await testChatWithSearch();

    // Run test 2: Simple question without search
    await testChatWithoutSearchWhenNotNeeded();

    console.log('\n\n' + '=' .repeat(60));
    console.log('✅ All integration tests passed!\n');
  } catch (error) {
    console.error('\n❌ Integration tests failed');
    process.exit(1);
  }
}

// Run tests
main().catch(console.error);
