/**
 * Test search tool functionality
 */

import { searchTool } from './src/tools/builtin/search';
import { ExecutionTracker } from './src/history';
import { RollbackManager } from './src/rollback';
import { Config } from './src/config';
import { Permission } from './src/tools/types';

async function testSearchTool() {
  console.log('🔍 Testing Search Tool...\n');

  // Create mock context
  const tracker = new ExecutionTracker();
  const rollbackManager = new RollbackManager(process.cwd());
  const config: Config = {
    apiKey: 'test-key',
    model: 'gpt-4',
    baseUrl: 'https://api.openai.com',
  };

  const context = {
    root: process.cwd(),
    history: tracker,
    permissions: new Set([Permission.NETWORK_ACCESS]),
    config,
  };

  // Test 1: Validate parameters
  console.log('Test 1: Parameter validation');
  const validation1 = searchTool.validate!({});
  console.log('❌ No query:', validation1);
  console.log('Expected: { valid: false, errors: ["Query must be a non-empty string"] }\n');

  const validation2 = searchTool.validate!({ query: 'TypeScript tutorial' });
  console.log('✅ Valid query:', validation2);
  console.log('Expected: { valid: true, errors: [] }\n');

  // Test 2: Execute search
  console.log('Test 2: Execute search');
  try {
    const result = await searchTool.handler(
      { query: 'TypeScript tutorial', max_results: 5 },
      context
    );

    console.log('Search result:', result);

    if (result.success) {
      console.log(`\n✅ Search successful!`);
      console.log(`   Query: ${result.metadata?.query}`);
      console.log(`   Results: ${result.metadata?.count}`);

      const results = result.metadata?.results as any[];
      if (results && results.length > 0) {
        console.log('\n📋 Top results:');
        results.slice(0, 3).forEach((r, i) => {
          console.log(`\n${i + 1}. ${r.title}`);
          console.log(`   URL: ${r.url}`);
          console.log(`   ${r.snippet.substring(0, 100)}...`);
        });
      }
    } else {
      console.log(`\n❌ Search failed: ${result.error}`);
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }

  // Test 3: Test post-execution hook
  console.log('\n\nTest 3: Post-execution hook');
  try {
    const result = {
      success: true,
      output: 'Found 5 search results',
      metadata: {
        query: 'TypeScript tutorial',
        count: 5,
      },
    };

    await searchTool.postExecute!(result, context);
    console.log('✅ Post-execution completed');

    const history = tracker.getHistory();
    console.log(`   History entries: ${history.length}`);
    if (history.length > 0) {
      console.log('   Last action:', history[history.length - 1].action);
    }
  } catch (error) {
    console.error('❌ Post-execution failed:', error);
  }

  console.log('\n✅ All tests completed!');
}

// Run tests
testSearchTool().catch(console.error);
