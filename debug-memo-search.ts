/**
 * 调试 Memo 搜索功能
 */

import { MemoCliPlugin } from './src/loop/plugins/memo-cli-plugin';
import { readFile } from 'fs/promises';

async function debugSearch() {
  const memoPlugin = new MemoCliPlugin(process.cwd(), '/Users/mac/freedomking/memo');

  console.log('\n📋 Debug: Reading decisions.json directly');
  console.log('─'.repeat(50));

  const decisionsData = JSON.parse(
    await readFile('.memo/decisions.json', 'utf-8')
  );

  console.log(`Total decisions in file: ${decisionsData.decisions.length}`);
  decisionsData.decisions.slice(0, 3).forEach((d: any) => {
    console.log(`\n  [${d.id}] ${d.title}`);
    console.log(`  Content: ${d.content}`);
    console.log(`  Tags: ${JSON.stringify(d.tags)}`);
  });

  console.log('\n📋 Debug: Testing search with different queries');
  console.log('─'.repeat(50));

  const queries = [
    '认证',
    'auth',
    'JWT',
    'Token',
    '架构',
  ];

  for (const query of queries) {
    console.log(`\n  Query: "${query}"`);
    const results = await memoPlugin.searchDecisions(query);
    console.log(`  Results: ${results.length}`);
    if (results.length > 0) {
      results.forEach((r) => {
        console.log(`    - ${r.title}`);
      });
    }
  }

  console.log('\n📋 Debug: Testing code search');
  console.log('─'.repeat(50));

  const codeQueries = ['auth', 'user', 'memo'];
  for (const query of codeQueries) {
    console.log(`\n  Query: "${query}"`);
    const results = await memoPlugin.findRelated(query);
    console.log(`  Results: ${results.length}`);
    if (results.length > 0) {
      results.slice(0, 3).forEach(({ file }) => {
        console.log(`    - ${file}`);
      });
    }
  }
}

debugSearch().catch(console.error);
