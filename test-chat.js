#!/usr/bin/env node

// Test script for /chat command
const { chatAI } = require('./dist/ai');
const { getDefaultConfig } = require('./dist/config');

async function testChat() {
  try {
    // Load config
    const config = getDefaultConfig();

    console.log('🧪 Testing /chat command...\n');

    // Test 1: Simple greeting
    console.log('Test 1: Simple greeting');
    console.log('─'.repeat(50));
    await chatAI(config, 'Hello! Can you hear me?');

    console.log('\nTest 2: Technical question');
    console.log('─'.repeat(50));
    await chatAI(config, 'What is TypeScript in one sentence?');

    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testChat();
