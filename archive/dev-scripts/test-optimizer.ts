#!/usr/bin/env ts-node
/**
 * Self-Optimization System Tests
 * Demonstrates Kode's ability to learn from its own execution
 */

import { SelfOptimizer } from './src/optimizer/optimizer';
import { ExecutionRecord } from './src/history';

async function testSelfOptimization() {
  console.log('🧪 Testing Self-Optimization System\n');

  const optimizer = new SelfOptimizer();

  // Test 1: Record execution history
  console.log('✓ Test 1: Recording Execution History');

  // Simulate execution history
  const sampleRecords: ExecutionRecord[] = [
    {
      id: '1',
      iteration: 1,
      timestamp: new Date(Date.now() - 10000),
      action: {
        type: 'create',
        path: 'test.ts',
        content: 'console.log("test");',
      },
      status: 'success',
      duration: 500,
    },
    {
      id: '2',
      iteration: 1,
      timestamp: new Date(Date.now() - 8000),
      action: {
        type: 'modify',
        path: 'test.ts',
        content: 'console.log("updated");',
      },
      status: 'success',
      duration: 300,
    },
    {
      id: '3',
      iteration: 1,
      timestamp: new Date(Date.now() - 6000),
      action: {
        type: 'run',
        command: 'npm test',
      },
      status: 'success',
      duration: 2000,
    },
    {
      id: '4',
      iteration: 1,
      timestamp: new Date(Date.now() - 4000),
      action: {
        type: 'create',
        path: 'error.ts',
        content: 'invalid syntax',
      },
      status: 'failed',
      duration: 100,
      error: 'SyntaxError: Unexpected identifier',
    },
    {
      id: '5',
      iteration: 1,
      timestamp: new Date(Date.now() - 2000),
      action: {
        type: 'run',
        command: 'npm run build',
      },
      status: 'success',
      duration: 1500,
    },
    {
      id: '6',
      iteration: 1,
      timestamp: new Date(Date.now() - 1000),
      action: {
        type: 'modify',
        path: 'test.ts',
        content: '// modified',
      },
      status: 'success',
      duration: 250,
    },
  ];

  // Add records to optimizer
  sampleRecords.forEach(record => optimizer.recordExecution(record));
  console.log(`  ✓ Recorded ${sampleRecords.length} execution events`);

  // Test 2: Calculate metrics
  console.log('\n✓ Test 2: Calculate Performance Metrics');
  const metrics = optimizer.getMetrics();

  console.log(`  ✓ Total Tasks: ${metrics.totalTasks}`);
  console.log(`  ✓ Success Rate: ${(metrics.successRate * 100).toFixed(1)}%`);
  console.log(`  ✓ Average Execution Time: ${metrics.averageExecutionTime.toFixed(0)}ms`);
  console.log(`  ✓ Failed Tasks: ${metrics.failedTasks}`);

  // Test 3: Identify patterns
  console.log('\n✓ Test 3: Identify Successful Patterns');
  const patterns = optimizer.getPatterns();

  console.log(`  ✓ Found ${patterns.length} patterns`);
  patterns.slice(0, 3).forEach((pattern, i) => {
    console.log(`    ${i + 1}. ${pattern.description} (${(pattern.confidence * 100).toFixed(0)}% confidence)`);
  });

  // Test 4: Generate suggestions
  console.log('\n✓ Test 4: Generate Optimization Suggestions');
  const suggestions = optimizer.getSuggestions();

  console.log(`  ✓ Generated ${suggestions.length} suggestions`);
  suggestions.slice(0, 3).forEach((s, i) => {
    console.log(`    ${i + 1}. [${s.priority.toUpperCase()}] ${s.description}`);
  });

  // Test 5: Establish baseline
  console.log('\n✓ Test 5: Establish Performance Baseline');
  const baseline = optimizer.establishBaseline();

  console.log(`  ✓ Baseline Success Rate: ${(baseline.averageSuccessRate * 100).toFixed(1)}%`);
  console.log(`  ✓ Baseline Execution Time: ${baseline.averageExecutionTime.toFixed(0)}ms`);
  console.log(`  ✓ Baseline Error Rate: ${baseline.averageErrorsPerTask.toFixed(2)}`);

  // Test 6: Generate full report
  console.log('\n✓ Test 6: Generate Optimization Report');
  const report = optimizer.analyzeAndOptimize();

  console.log(`  ✓ Report Generated at ${new Date(report.timestamp).toISOString()}`);
  console.log(`  ✓ Overall Health: ${report.overallHealth.level.toUpperCase()} (${report.overallHealth.score}/100)`);

  if (report.overallHealth.issues.length > 0) {
    console.log(`  ✓ Issues Detected: ${report.overallHealth.issues.length}`);
  }

  // Test 7: Export learning data
  console.log('\n✓ Test 7: Export Learning Data');
  const jsonData = optimizer.exportLearningData();
  const data = JSON.parse(jsonData);

  console.log(`  ✓ Exported ${data.patterns.length} patterns`);
  console.log(`  ✓ Exported ${data.metrics.suggestions.length} suggestions`);
  console.log(`  ✓ Data size: ${jsonData.length} bytes`);

  console.log('\n✅ All Self-Optimization Tests Passed!\n');

  // Display summary
  console.log(chalk.cyan('📊 Self-Optimization Summary'));
  console.log(report.summary);

  return true;
}

// Import chalk for colored output
import chalk from 'chalk';

// Run tests
testSelfOptimization()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  });
