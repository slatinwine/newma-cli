/**
 * Automated testing script for Kode CLI modes
 * Tests basic functionality of each execution mode
 */

import { getDefaultConfig } from './dist/config.js';
import { existsSync, readdirSync } from 'fs';
import * as path from 'path';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  issues: string[];
}

const results: TestResult[] = [];

function logTest(name: string) {
  console.log(`\n▶ Testing: ${name}`);
  console.log('─'.repeat(60));
}

function logPass(message: string) {
  console.log(`✓ ${message}`);
}

function logFail(message: string) {
  console.log(`✗ ${message}`);
}

function logIssue(issue: string) {
  console.log(`⚠ Issue: ${issue}`);
}

async function testConfig() {
  logTest('Configuration Loading');
  const start = Date.now();
  const issues: string[] = [];

  try {
    const config = getDefaultConfig();
    logPass(`Config loaded successfully`);
    logPass(`API Key: ${config.apiKey ? '✓' : '✗'}`);
    logPass(`Model: ${config.model}`);
    logPass(`Execution Mode: ${config.executionMode}`);
    logPass(`Function Calling: ${config.functionCallingEnabled ? 'enabled' : 'disabled'}`);

    if (config.executionMode !== 'subagent') {
      issues.push(`Default execution mode is ${config.executionMode}, expected 'subagent'`);
      logIssue(issues[0]);
    }

    results.push({
      name: 'Configuration Loading',
      status: issues.length > 0 ? 'fail' : 'pass',
      duration: Date.now() - start,
      issues
    });

  } catch (error: any) {
    logFail(`Failed to load config: ${error.message}`);
    results.push({
      name: 'Configuration Loading',
      status: 'fail',
      duration: Date.now() - start,
      issues: [error.message]
    });
  }
}

async function testModuleStructure() {
  logTest('Module Structure');
  const start = Date.now();
  const issues: string[] = [];

  const modules = [
    { path: './dist/repl.js', name: 'REPL' },
    { path: './dist/session.js', name: 'Session' },
    { path: './dist/ai.js', name: 'AI Integration' },
    { path: './dist/config.js', name: 'Config' },
    { path: './dist/agents/subagent/coordinator.js', name: 'Subagent Coordinator' },
    { path: './dist/fft/engine.js', name: 'FFT Engine' },
    { path: './dist/landmark/planner.js', name: 'Landmark Planner' },
  ];

  for (const mod of modules) {
    try {
      const fullPath = path.resolve(mod.path);
      if (existsSync(fullPath)) {
        logPass(`${mod.name} module exists`);
        // Try to load it
        await import(fullPath);
        logPass(`${mod.name} module loads successfully`);
      } else {
        const issue = `${mod.name} module file not found at ${mod.path}`;
        logIssue(issue);
        issues.push(issue);
      }
    } catch (error: any) {
      const issue = `${mod.name} module failed to load: ${error.message}`;
      logIssue(issue);
      issues.push(issue);
    }
  }

  results.push({
    name: 'Module Structure',
    status: issues.length > 0 ? 'fail' : 'pass',
    duration: Date.now() - start,
    issues
  });
}

async function testBuildStatus() {
  logTest('Build Status');
  const start = Date.now();
  const issues: string[] = [];

  try {
    const distPath = path.resolve('./dist');
    if (!existsSync(distPath)) {
      const issue = 'dist directory does not exist';
      logIssue(issue);
      issues.push(issue);
    } else {
      const files = readdirSync(distPath).filter(f => f.endsWith('.js'));
      logPass(`Build output exists: ${files.length} JavaScript files`);

      if (files.length === 0) {
        issues.push('No JavaScript files in dist directory');
      }
    }
  } catch (error: any) {
    logIssue('Could not verify build status');
    issues.push('Build verification failed');
  }

  results.push({
    name: 'Build Status',
    status: issues.length > 0 ? 'fail' : 'pass',
    duration: Date.now() - start,
    issues
  });
}

async function testExecutionModesAvailability() {
  logTest('Execution Modes Availability');
  const start = Date.now();
  const issues: string[] = [];

  const validModes = ['function-calling', 'two-phase', 'multi-agent', 'subagent', 'standard'];

  try {
    const config = getDefaultConfig();
    const currentMode = config.executionMode || 'standard';

    if (validModes.includes(currentMode)) {
      logPass(`Current mode "${currentMode}" is valid`);
    } else {
      issues.push(`Current mode "${currentMode}" is not in valid modes list`);
      logIssue(issues[0]);
    }

    // Check if mode routing logic exists
    const replPath = path.resolve('./dist/repl.js');
    try {
      await import(replPath);
      logPass('REPL module (contains mode routing) loads successfully');
    } catch (error) {
      issues.push('REPL module failed to load');
      logIssue(issues[issues.length - 1]);
    }

  } catch (error: any) {
    issues.push(`Failed to verify execution modes: ${error.message}`);
    logIssue(issues[0]);
  }

  results.push({
    name: 'Execution Modes Availability',
    status: issues.length > 0 ? 'fail' : 'pass',
    duration: Date.now() - start,
    issues
  });
}

function printSummary() {
  console.log('\n' + '═'.repeat(60));
  console.log('TEST SUMMARY');
  console.log('═'.repeat(60));

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const total = results.length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\nTotal Tests: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Duration: ${totalDuration}ms`);

  if (failed > 0) {
    console.log('\n' + '─'.repeat(60));
    console.log('FAILED TESTS DETAILS:');
    console.log('─'.repeat(60));

    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`\n✗ ${r.name}`);
      r.issues.forEach(issue => {
        console.log(`  • ${issue}`);
      });
    });
  }

  console.log('\n' + '═'.repeat(60));
  console.log('For detailed manual testing, see: MANUAL_MODE_TESTING.md');
  console.log('═'.repeat(60) + '\n');
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║         Kode CLI - Automated Mode Testing                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  try {
    await testConfig();
    await testModuleStructure();
    await testBuildStatus();
    await testExecutionModesAvailability();

    printSummary();

    // Exit with error code if any tests failed
    const failedCount = results.filter(r => r.status === 'fail').length;
    process.exit(failedCount > 0 ? 1 : 0);

  } catch (error: any) {
    console.error(`\n✗ Test suite failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
