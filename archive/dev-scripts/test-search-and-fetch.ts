/**
 * Test search and fetch functionality
 */

import { searchAndFetchTool } from './src/tools/builtin/search-and-fetch';
import { webScrapeTool } from './src/tools/builtin/web-scrape';
import { ExecutionTracker } from './src/history';
import { Config } from './src/config';
import { Permission } from './src/tools/types';

async function testWebScrape() {
  console.log('🌐 Testing Web Scrape Tool...\n');

  const tracker = new ExecutionTracker();
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

  // Test: Scrape a simple page
  console.log('Test: Scrape Wikipedia page');
  try {
    const result = await webScrapeTool.handler(
      {
        url: 'https://en.wikipedia.org/wiki/TypeScript',
        max_length: 2000,
      },
      context
    );

    if (result.success) {
      console.log('✅ Scrape successful!');
      console.log(`   Title: ${result.metadata?.title}`);
      console.log(`   URL: ${result.metadata?.url}`);
      console.log(`   Content length: ${result.metadata?.text_length} chars`);
      console.log(`\n   Content preview:`);
      const text = result.metadata?.text as string;
      console.log(`   ${text.substring(0, 300)}...`);
    } else {
      console.log(`❌ Scrape failed: ${result.error}`);
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testSearchAndFetch() {
  console.log('\n\n🔍📄 Testing Search and Fetch Tool...\n');

  const tracker = new ExecutionTracker();
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

  // Test: Search and fetch
  console.log('Test: Search and fetch content about TypeScript');
  try {
    const result = await searchAndFetchTool.handler(
      {
        query: 'TypeScript vs JavaScript comparison',
        max_results: 2,
        content_length: 3000,
      },
      context
    );

    if (result.success) {
      console.log('✅ Search and fetch successful!');
      console.log(`   Total results: ${result.metadata?.total_results}`);
      console.log(`   Fetched: ${result.metadata?.successful_count}/${result.metadata?.fetched_count}`);
      console.log(`   Total content: ${result.metadata?.total_content_length} chars`);

      const results = result.metadata?.results as any[];
      if (results && results.length > 0) {
        console.log('\n📋 Fetched Results:');

        results.forEach((r, i) => {
          console.log(`\n${i + 1}. ${r.title}`);
          console.log(`   URL: ${r.url}`);
          if (r.content) {
            console.log(`   ✅ Content: ${r.content_length} chars`);
            console.log(`   Preview: ${r.content.substring(0, 150)}...`);
          } else if (r.error) {
            console.log(`   ❌ Error: ${r.error}`);
          }
        });

        // Format for AI
        console.log('\n\n🤖 Formatted for AI Consumption:');
        console.log('---');
        const { formatSearchMetadataForAI } = await import('./src/tools/builtin/search-and-fetch');
        const formatted = formatSearchMetadataForAI(result.metadata);
        console.log(formatted.substring(0, 1500));
        console.log('...');
        console.log('---');
      }
    } else {
      console.log(`❌ Search and fetch failed: ${result.error}`);
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testErrorHandling() {
  console.log('\n\n⚠️  Testing Error Handling...\n');

  const tracker = new ExecutionTracker();
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

  // Test: Invalid URL
  console.log('Test 1: Invalid URL');
  const validation1 = webScrapeTool.validate!({ url: 'not-a-url' });
  console.log(`   Valid: ${validation1.valid}`);
  console.log(`   Errors: ${validation1.errors.join(', ')}`);

  // Test: 404 URL
  console.log('\nTest 2: Non-existent page (404)');
  try {
    const result = await webScrapeTool.handler(
      { url: 'https://example.com/this-page-does-not-exist-12345' },
      context
    );
    console.log(`   Success: ${result.success}`);
    console.log(`   Error: ${result.error}`);
  } catch (error) {
    console.log(`   Error: ${error}`);
  }
}

async function main() {
  console.log('🧪 Running Search and Fetch Tests\n');
  console.log('=' .repeat(60));

  await testWebScrape();
  await testSearchAndFetch();
  await testErrorHandling();

  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed!');
}

// Run tests
main().catch(console.error);
