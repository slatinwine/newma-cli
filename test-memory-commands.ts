/**
 * Test Interactive Memory Commands
 *
 * 测试新添加的 REPL 记忆查询命令
 */

import { CommandManager } from './src/loop/commands/command-manager';
import { createMemoPlugin } from './src/loop/plugins/memo-cli-plugin';
import { registerMemoCommands } from './src/loop/commands/memo-commands';
import { CommandContext } from './src/loop/commands/types';

async function testMemoryCommands() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     Testing Interactive Memory Commands                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const projectRoot = process.cwd();

  // 创建命令管理器和插件
  const commandManager = new CommandManager();
  const memoPlugin = createMemoPlugin(projectRoot);

  // 注册所有记忆命令
  registerMemoCommands(commandManager, memoPlugin);

  console.log('✅ Commands registered successfully\n');

  // ==================== Test 1: /memory-stats ====================
  console.log('📊 Test 1: /memory-stats');
  console.log('─────────────────────────────────────────────────────────');

  const result1 = await commandManager.execute('memory-stats', [], {});
  if (result1.success) {
    console.log(result1.output);
  } else {
    console.log('❌ Error:', result1.error);
  }
  console.log();

  // ==================== Test 2: /memory-prefs ====================
  console.log('⚙️  Test 2: /memory-prefs');
  console.log('─────────────────────────────────────────────────────────');

  const result2 = await commandManager.execute('memory-prefs', [], {});
  if (result2.success) {
    console.log(result2.output);
  } else {
    console.log('❌ Error:', result2.error);
  }
  console.log();

  // ==================== Test 3: /memory-history ====================
  console.log('📜 Test 3: /memory-history 3');
  console.log('─────────────────────────────────────────────────────────');

  const result3 = await commandManager.execute('memory-history', ['3'], {});
  if (result3.success) {
    console.log(result3.output);
  } else {
    console.log('❌ Error:', result3.error);
  }
  console.log();

  // ==================== Test 4: /memory-sessions ====================
  console.log('💬 Test 4: /memory-sessions 3');
  console.log('─────────────────────────────────────────────────────────');

  const result4 = await commandManager.execute('memory-sessions', ['3'], {});
  if (result4.success) {
    console.log(result4.output);
  } else {
    console.log('❌ Error:', result4.error);
  }
  console.log();

  // ==================== Test 5: /memory-errors ====================
  console.log('❌ Test 5: /memory-errors 3');
  console.log('─────────────────────────────────────────────────────────');

  const result5 = await commandManager.execute('memory-errors', ['3'], {});
  if (result5.success) {
    console.log(result5.output);
  } else {
    console.log('❌ Error:', result5.error);
  }
  console.log();

  // ==================== Test 6: /memory-reasoning ====================
  console.log('🧠 Test 6: /memory-reasoning 3');
  console.log('─────────────────────────────────────────────────────────');

  const result6 = await commandManager.execute('memory-reasoning', ['3'], {});
  if (result6.success) {
    console.log(result6.output);
  } else {
    console.log('❌ Error:', result6.error);
  }
  console.log();

  // ==================== Final Summary ====================
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                  Test Summary                               ║');
  console.log('╠════════════════════════════════════════════════════════════╣\n');

  const results = [
    { name: '/memory-stats', result: result1 },
    { name: '/memory-prefs', result: result2 },
    { name: '/memory-history', result: result3 },
    { name: '/memory-sessions', result: result4 },
    { name: '/memory-errors', result: result5 },
    { name: '/memory-reasoning', result: result6 },
  ];

  const passed = results.filter(r => r.result.success).length;
  const failed = results.filter(r => !r.result.success).length;

  console.log(`📊 Total Commands: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}\n`);

  if (failed === 0) {
    console.log('🎉 All commands work correctly!\n');

    console.log('📝 Available Commands in REPL:');
    console.log('────────────────────────────────────────────────');
    results.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.name}`);
    });
    console.log();

    console.log('💡 Usage:');
    console.log('  npx newma-cli -i');
    console.log('  [newma] ❯ /memory-stats');
    console.log('  [newma] ❯ /memory-history 10');
    console.log('  [newma] ❯ /memory-prefs');
    console.log();

  } else {
    console.log('⚠️  Some commands failed\n');
    results.forEach(r => {
      if (!r.result.success) {
        console.log(`❌ ${r.name}: ${r.result.error}`);
      }
    });
  }

  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

// Run tests
testMemoryCommands()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
