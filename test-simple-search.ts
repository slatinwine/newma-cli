/**
 * 简单搜索测试
 */

import { MemoCliPlugin } from './src/loop/plugins/memo-cli-plugin';

async function test() {
  const memoPlugin = new MemoCliPlugin(process.cwd(), '/Users/mac/freedomking/memo');

  const queries = [
    '认证',
    '用户认证',
    '用户',
    'auth',
    'JWT',
  ];

  console.log('\n测试不同查询:\n');

  for (const query of queries) {
    const decisions = await memoPlugin.searchDecisions(query);
    console.log(`"${query}": ${decisions.length} results`);

    if (decisions.length > 0) {
      decisions.forEach((d) => {
        console.log(`  - ${d.title}`);
      });
    }
    console.log('');
  }
}

test().catch(console.error);
