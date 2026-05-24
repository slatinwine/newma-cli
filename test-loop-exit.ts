// test-loop-exit.ts
/**
 * 测试 loop 模式退出逻辑
 */

import { callAI } from './src/ai';
import { Config } from './src/config';
import { loadConfig } from 'dotenv';

// Load environment
require('dotenv').config();

async function testDoneFlagParsing() {
  console.log('Testing AI done flag parsing...\n');

  const config: Config = {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
  };

  // Test 1: Plan mode with done: true
  console.log('=== Test 1: Plan mode asking for done: true ===');
  try {
    const resp1 = await callAI(
      config,
      {},
      'Create a test file',
      'plan',
      [],
      undefined,
      undefined,
      undefined,
      process.cwd(),
      undefined,
      undefined
    );
    console.log('Response done:', resp1.done);
    console.log('Has actions:', resp1.actions?.length || 0);
  } catch (e: any) {
    console.log('Error:', e.message);
  }

  console.log('\n=== Test 2: Verify mode with done: true ===');
  try {
    const resp2 = await callAI(
      config,
      {},
      'The file test.txt has been created with hello world. Is this satisfied?',
      'verify',
      [],
      undefined,
      undefined,
      undefined,
      process.cwd(),
      undefined,
      undefined
    );
    console.log('Response done:', resp2.done);
    console.log('Has actions:', resp2.actions?.length || 0);
    console.log('Response content:', resp2.content?.substring(0, 200));
  } catch (e: any) {
    console.log('Error:', e.message);
  }
}

testDoneFlagParsing().catch(console.error);
