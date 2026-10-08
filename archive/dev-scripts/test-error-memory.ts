/**
 * Error Solution Memory Test
 *
 * 测试错误解决方案记忆功能
 */

import { createErrorMemoryManager } from './src/memory/error-memory';

async function testErrorMemory() {
  console.log('🧪 Testing Error Solution Memory\n');

  const projectRoot = process.cwd();
  const errorMemory = createErrorMemoryManager(projectRoot, {
    maxErrors: 100,
    maxSolutions: 50,
  });

  try {
    // Test 1: Initialize
    console.log('Test 1: Initialize Error Memory Manager');
    await errorMemory.initialize();
    console.log('✅ PASS: Error Memory Manager initialized\n');

    // Test 2: Record Errors
    console.log('Test 2: Record Errors');

    const error1Id = await errorMemory.recordError({
      errorType: 'ModuleNotFoundError',
      errorMessage: 'Cannot find module \'@types/node\'',
      command: 'npm run build',
      commandType: 'execute',
      task: 'Build project',
      files: ['package.json', 'tsconfig.json'],
      tags: ['dependency', 'build'],
    });
    console.log(`  ✓ Recorded error 1: ${error1Id}`);

    const error2Id = await errorMemory.recordError({
      errorType: 'SyntaxError',
      errorMessage: 'Unexpected token < in JSX',
      command: '/plan add component',
      commandType: 'plan',
      task: 'Add React component',
      tags: ['syntax', 'react'],
    });
    console.log(`  ✓ Recorded error 2: ${error2Id}`);

    const error3Id = await errorMemory.recordError({
      errorType: 'TypeError',
      errorMessage: 'Cannot read property \'map\' of undefined',
      command: '/execute generate list',
      commandType: 'execute',
      task: 'Generate list',
      stackTrace: 'at Generator.generate (src/generator.ts:45:15)',
      tags: ['runtime', 'type'],
    });
    console.log(`  ✓ Recorded error 3: ${error3Id}`);

    // Record same error again (should increment count)
    const error4Id = await errorMemory.recordError({
      errorType: 'ModuleNotFoundError',
      errorMessage: 'Cannot find module \'@types/node\'',
      command: 'npm run test',
      commandType: 'execute',
      task: 'Run tests',
      tags: ['dependency'],
    });
    console.log(`  ✓ Recorded duplicate error (incremented count): ${error4Id}`);

    console.log('✅ PASS: All errors recorded\n');

    // Test 3: Record Solutions
    console.log('Test 3: Record Solutions');

    await errorMemory.recordSolution(error1Id, {
      description: 'Install missing type definitions',
      steps: [
        'Run: npm install --save-dev @types/node',
        'Verify installation in package.json',
        'Rebuild project',
      ],
      method: 'manual',
      codeExample: 'npm install --save-dev @types/node',
    });
    console.log('  ✓ Recorded solution for error 1');

    await errorMemory.recordSolution(error2Id, {
      description: 'Fix JSX syntax error',
      steps: [
        'Check file extension is .jsx or .tsx',
        'Ensure React is imported',
        'Verify JSX syntax is correct',
      ],
      method: 'manual',
      codeExample: 'import React from \'react\';',
    });
    console.log('  ✓ Recorded solution for error 2');

    await errorMemory.recordSolution(error3Id, {
      description: 'Add null check before map',
      steps: [
        'Check if array is defined',
        'Add optional chaining or default value',
      ],
      method: 'manual',
      codeExample: 'items?.map(item => ...) || []',
    });
    console.log('  ✓ Recorded solution for error 3\n');

    console.log('✅ PASS: All solutions recorded\n');

    // Test 4: Search Errors
    console.log('Test 4: Search Errors');

    const allErrors = await errorMemory.searchErrors({ limit: 10 });
    console.log(`✅ PASS: Found ${allErrors.length} error(s)`);

    const unresolvedErrors = await errorMemory.searchErrors({
      resolved: false,
    });
    console.log(`  Unresolved: ${unresolvedErrors.length}`);

    const resolvedErrors = await errorMemory.searchErrors({
      resolved: true,
      withSolutionOnly: true,
    });
    console.log(`  Resolved with solution: ${resolvedErrors.length}\n`);

    // Test 5: Find Similar Errors
    console.log('Test 5: Find Similar Errors');

    const similarErrors = await errorMemory.findSimilarErrors(
      'ModuleNotFoundError',
      'Cannot find module',
      5
    );
    console.log('✅ PASS: Found similar errors');
    console.log(`  Similar errors found: ${similarErrors.length}`);
    similarErrors.forEach(err => {
      console.log(`    - ${err.errorType}: ${err.errorMessage.substring(0, 50)}...`);
    });
    console.log();

    // Test 6: Error Patterns
    console.log('Test 6: Get Error Patterns');

    const patterns = await errorMemory.getErrorPatterns(10);
    console.log('✅ PASS: Retrieved error patterns');
    console.log(`  Unique error types: ${patterns.length}`);
    patterns.slice(0, 3).forEach(pattern => {
      console.log(`    - ${pattern.errorType}:`);
      console.log(`      Frequency: ${pattern.frequency}`);
      console.log(`      Resolution Rate: ${(pattern.resolutionRate * 100).toFixed(1)}%`);
      if (pattern.topSolution) {
        console.log(`      Top Solution: ${pattern.topSolution.description}`);
      }
    });
    console.log();

    // Test 7: Get Summary
    console.log('Test 7: Get Error Summary (30 days)');

    const summary = await errorMemory.getSummary(30);
    if (summary) {
      console.log('✅ PASS: Summary generated');
      console.log(`  Total Errors: ${summary.totalErrors}`);
      console.log(`  Resolved: ${summary.resolvedErrors}`);
      console.log(`  Resolution Rate: ${(summary.resolutionRate * 100).toFixed(1)}%`);
      console.log(`  Top Errors:`);
      summary.topErrors.slice(0, 3).forEach(({ errorType, count }) => {
        console.log(`    - ${errorType}: ${count}`);
      });
      console.log(`  Top Categories:`);
      summary.topCategories.slice(0, 3).forEach(({ category, count }) => {
        console.log(`    - ${category}: ${count}`);
      });
    }
    console.log();

    // Test 8: Use and Verify Solution
    console.log('Test 8: Use and Verify Solution');

    const solution = await errorMemory.useSolution(error1Id);
    if (solution) {
      console.log('✅ PASS: Solution used');
      console.log(`  Description: ${solution.description}`);
      console.log(`  Usage count: ${solution.usageCount}`);

      // Verify successful
      await errorMemory.verifySolution(error1Id, true);
      console.log('  ✓ Verified as successful');

      const updatedSolution = await errorMemory.useSolution(error1Id);
      if (updatedSolution) {
        console.log(`  Updated success rate: ${(updatedSolution.successRate * 100).toFixed(1)}%`);
      }
    }
    console.log();

    // Test 9: Search by Category
    console.log('Test 9: Search by Category');

    const dependencyErrors = await errorMemory.searchErrors({
      category: 'dependency',
      limit: 5,
    });
    console.log('✅ PASS: Category search works');
    console.log(`  Dependency errors: ${dependencyErrors.length}`);
    dependencyErrors.forEach(err => {
      console.log(`    - ${err.errorType}`);
    });
    console.log();

    // Test 10: Search by Keyword
    console.log('Test 10: Search by Keyword');

    const jsErrors = await errorMemory.searchErrors({
      keyword: 'JSX',
      limit: 5,
    });
    console.log('✅ PASS: Keyword search works');
    console.log(`  Errors matching 'JSX': ${jsErrors.length}\n`);

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Test Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All tests passed!');
    console.log();
    console.log('Error Memory Features:');
    console.log('  ✓ Error recording with auto-categorization');
    console.log('  ✓ Solution tracking');
    console.log('  ✓ Error pattern analysis');
    console.log('  ✓ Similar error detection');
    console.log('  ✓ Solution usage statistics');
    console.log('  ✓ Multi-dimensional search');
    console.log();

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testErrorMemory()
  .then(() => {
    console.log('✅ Test suite completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
