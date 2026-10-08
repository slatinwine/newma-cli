#!/usr/bin/env ts-node
/**
 * Simple debug test for API calls
 */

import { callAI } from './src/ai';
import { Config } from './src/config';
import { scanDirectory } from './src/scanner';

async function debugAPI() {
  console.log('\n[DEBUG] Testing API Connection\n');
  console.log('=' .repeat(60));

  try {
    // Load config
    const config = require('./src/config').getDefaultConfig();
    console.log('✓ Config loaded');
    console.log(`  Model: ${config.model}`);
    console.log(`  Base URL: ${config.baseUrl}`);
    console.log(`  Endpoint: ${config.endpoint || '(default)'}`);

    // Check API key
    if (!config.apiKey || config.apiKey === 'sk-xxxxxxxxxxxxxxxxxxxxxxx') {
      console.log('\n✗ ERROR: Invalid API key');
      console.log('  Please set OPENAI_API_KEY in .env file');
      process.exit(1);
    }
    console.log(`  API Key: ${config.apiKey.substring(0, 10)}...`);

    // Scan project (lightweight mode: only file list, no content)
    console.log('\n[1/3] Scanning project...');
    const projectRoot = process.cwd();
    const projectInfo = await scanDirectory(projectRoot, {
      listOnly: true,  // Only file paths, no content
      maxFiles: 5      // Limit to 5 files
    });
    console.log(`✓ Scanned ${Object.keys(projectInfo).length} files (lightweight mode)`);

    // Test simple prompt
    console.log('\n[2/3] Testing simple prompt...');
    console.log('  Requirement: "Say hello"');

    const startTime = Date.now();
    const response = await callAI(
      config,
      projectInfo,
      'Say hello',
      'plan',
      undefined,
      undefined,
      undefined,
      undefined,
      projectRoot
    );
    const duration = Date.now() - startTime;

    console.log(`✓ Got response in ${duration}ms`);
    console.log(`  Todo items: ${response.todo.length}`);
    console.log(`  Actions: ${response.actions.length}`);
    console.log(`  Done: ${response.done || false}`);
    if (response.usage) {
      console.log(`  Tokens: ${response.usage.total_tokens || 'N/A'}`);
    }

    // Test actual task
    console.log('\n[3/3] Testing actual task...');
    console.log('  Requirement: "Run the test suite"');

    const startTime2 = Date.now();
    const response2 = await callAI(
      config,
      projectInfo,
      'Run the test suite',
      'plan',
      undefined,
      undefined,
      undefined,
      undefined,
      projectRoot
    );
    const duration2 = Date.now() - startTime2;

    console.log(`✓ Got response in ${duration2}ms`);
    console.log(`  Todo items: ${response2.todo.length}`);
    console.log(`  Actions: ${response2.actions.length}`);
    if (response2.actions.length > 0) {
      console.log(`  First action: ${JSON.stringify(response2.actions[0])}`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('[SUMMARY] API Test Results');
    console.log('='.repeat(60));
    console.log('✓ API is working correctly');
    console.log(`✓ Average response time: ${(duration + duration2) / 2}ms`);
    console.log('\nAll tests passed!');

    process.exit(0);

  } catch (error: any) {
    console.error('\n✗ ERROR:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    // Check for common errors
    if (error.message.includes('fetch')) {
      console.error('\n💡 Possible causes:');
      console.error('  1. Network connectivity issue');
      console.error('  2. Invalid base URL or endpoint');
      console.error('  3. Firewall blocking the request');
    } else if (error.message.includes('401') || error.message.includes('apiKey')) {
      console.error('\n💡 Possible causes:');
      console.error('  1. Invalid API key');
      console.error('  2. API key expired');
      console.error('  3. Check .env file');
    } else if (error.message.includes('timeout')) {
      console.error('\n💡 Possible causes:');
      console.error('  1. API server is slow');
      console.error('  2. Network latency');
      console.error('  3. Model is overloaded');
    }

    process.exit(1);
  }
}

debugAPI();
