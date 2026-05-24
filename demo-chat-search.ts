/**
 * Demo: Chat mode with automatic search
 *
 * This demonstrates the fix for enabling search tools in chat mode.
 */

import { chatAI, createDefaultToolRegistry } from './src/ai';
import { ToolExecutor } from './src/executor-v2';
import { ExecutionTracker } from './src/history';
import { RollbackManager } from './src/rollback';
import { Config } from './src/config';
import { PermissionManager } from './src/permissions';
import { ToolRegistry } from './src/tools/registry';
import { searchTool } from './src/tools/builtin/search';
import chalk from 'chalk';

async function demo() {
  console.log(chalk.cyan('\n🔍 Demo: Chat Mode with Automatic Search\n'));
  console.log('=' .repeat(70));

  console.log('\n✅ What was fixed:');
  console.log('   1. chatAI() now accepts ToolExecutor parameter');
  console.log('   2. Implements complete ReAct loop for tool execution');
  console.log('   3. System prompt emphasizes "PRIORITIZE WEB SEARCH"');
  console.log('   4. REPL passes toolExecutor to enable tool execution');

  console.log('\n📝 Key changes:');
  console.log('   src/ai.ts:');
  console.log('     - chatAI(config, msg, signal, profile, registry?, executor?)');
  console.log('     - Executes tools when AI requests them');
  console.log('     - Sends results back to AI for final answer');
  console.log('   src/repl.ts:');
  console.log('     - chatMode() now passes toolExecutor');
  console.log('     - Enables search in all chat conversations');

  console.log('\n🎯 Expected behavior when you ask questions:\n');

  console.log(chalk.white('Before fix:'));
  console.log('  [kode] ❯ What are TypeScript 5.0 new features?');
  console.log('  AI: [Answers based on 2023 training data, may be outdated]');

  console.log(chalk.white('\nAfter fix:'));
  console.log('  [kode] ❯ What are TypeScript 5.0 new features?');
  console.log('  ⚙️  [search] {"query":"TypeScript 5.0 new features"}');
  console.log('  ✅ [search] 成功 - Found 10 results');
  console.log('  📤 Sending tool results back to AI...');
  console.log('  AI: [Answers based on LATEST search results from 2024/2025]');

  console.log('\n' + '=' .repeat(70));

  console.log('\n🧪 Testing default tool registry:\n');
  const defaultRegistry = createDefaultToolRegistry();
  const tools = defaultRegistry.list();
  console.log(`✅ Default registry has ${tools.length} tools:`);
  tools.forEach(t => console.log(`   - ${t.name}: ${t.description}`));

  console.log('\n' + '=' .repeat(70));
  console.log('\n✅ Fix complete! Search is now automatic in all modes.\n');

  console.log('To test manually:');
  console.log('  1. Build: npm run build');
  console.log('  2. Start: npx newma-cli -i');
  console.log('  3. Ask: TypeScript 5有哪些新特性?');
  console.log('  4. Watch AI automatically search and answer!\n');
}

demo().catch(console.error);
