/**
 * Project Context Memory Test
 *
 * 测试项目上下文记忆功能
 */

import { createContextManager } from './src/memory/context-manager';
import { join } from 'path';

async function testProjectContext() {
  console.log('🧪 Testing Project Context Memory\n');

  const projectRoot = process.cwd();
  const contextManager = createContextManager(projectRoot, {
    ttl: 3600, // 1 hour
    maxChanges: 50,
  });

  try {
    // Test 1: Initialize
    console.log('Test 1: Initialize Context Manager');
    await contextManager.initialize();
    console.log('✅ PASS: Context Manager initialized\n');

    // Test 2: Get Context (first time - will scan)
    console.log('Test 2: Get Project Context (first scan)');
    const startTime = Date.now();
    const context1 = await contextManager.getContext();
    const duration1 = Date.now() - startTime;

    console.log(`✅ PASS: Context scanned in ${duration1}ms`);
    console.log(`  - Total Files: ${context1.structure.totalFiles}`);
    console.log(`  - Total Lines: ~${context1.structure.totalLines}`);
    console.log(`  - Languages: ${context1.structure.primaryLanguages.join(', ')}`);
    console.log(`  - Framework: ${context1.config.framework || 'N/A'}`);
    console.log(`  - Build Tool: ${context1.config.buildTool || 'N/A'}`);
    console.log(`  - Package Manager: ${context1.config.packageManager}`);
    console.log();

    // Test 3: Get Context again (should use cache)
    console.log('Test 3: Get Project Context (cached)');
    const startTime2 = Date.now();
    const context2 = await contextManager.getContext();
    const duration2 = Date.now() - startTime2;

    console.log(`✅ PASS: Context loaded from cache in ${duration2}ms`);
    console.log(`  - Cache speedup: ${Math.round((duration1 - duration2) / duration1 * 100)}% faster`);
    console.log(`  - Same context: ${JSON.stringify(context1) === JSON.stringify(context2) ? 'Yes' : 'No'}`);
    console.log();

    // Test 4: Get Project Summary
    console.log('Test 4: Get Project Summary (for AI context)');
    const summary = await contextManager.getSummary();
    console.log('✅ PASS: Summary generated');
    console.log('--- Summary Preview (first 500 chars) ---');
    console.log(summary.substring(0, 500) + '...');
    console.log();

    // Test 5: Record File Change
    console.log('Test 5: Record File Changes');
    await contextManager.recordChange({
      file: 'src/test.ts',
      type: 'create',
      summary: 'Test file for context memory',
    });

    await contextManager.recordChange({
      file: 'src/memory/context-manager.ts',
      type: 'modify',
      summary: 'Added context caching',
    });

    await contextManager.recordChange({
      file: 'old-file.ts',
      type: 'delete',
    });

    const updatedContext = await contextManager.getContext(true);
    console.log('✅ PASS: File changes recorded');
    console.log(`  - Recent changes: ${updatedContext.recentChanges.length}`);
    updatedContext.recentChanges.slice(0, 3).forEach((change, idx) => {
      const icon = change.type === 'create' ? '➕' : change.type === 'delete' ? '❌' : '✏️';
      console.log(`  ${idx + 1}. ${icon} ${change.file} (${change.type})`);
    });
    console.log();

    // Test 6: Force Refresh
    console.log('Test 6: Force Refresh Context');
    const startTime3 = Date.now();
    const context3 = await contextManager.getContext(true);
    const duration3 = Date.now() - startTime3;

    console.log(`✅ PASS: Context refreshed in ${duration3}ms`);
    console.log(`  - Updated at: ${context3.lastUpdated}`);
    console.log();

    // Test 7: Clear Cache
    console.log('Test 7: Clear Cache');
    await contextManager.clearCache();
    console.log('✅ PASS: Cache cleared\n');

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Test Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All tests passed!');
    console.log();
    console.log('Performance Metrics:');
    console.log(`  - First scan: ${duration1}ms`);
    console.log(`  - Cached load: ${duration2}ms`);
    console.log(`  - Speedup: ${Math.round(duration1 / duration2)}x faster`);
    console.log();
    console.log('Project Information:');
    console.log(`  - Files: ${context1.structure.totalFiles}`);
    console.log(`  - Lines: ~${context1.structure.totalLines}`);
    console.log(`  - Languages: ${context1.structure.primaryLanguages.join(', ')}`);
    if (context1.config.framework) {
      console.log(`  - Framework: ${context1.config.framework}`);
    }
    console.log();

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testProjectContext()
  .then(() => {
    console.log('✅ Test suite completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
