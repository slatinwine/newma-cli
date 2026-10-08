#!/usr/bin/env ts-node

/**
 * Test script to verify chat mode uses the new prompt system
 */

import { loadSystemPrompt, PromptType } from './src/prompt';

async function testChatPrompt() {
  console.log('🧪 Testing Chat Mode Prompt System\n');

  // Load chat mode prompt
  const chatPrompt = loadSystemPrompt(PromptType.CHAT);

  console.log('✅ Successfully loaded chat mode prompt');
  console.log(`📏 Prompt length: ${chatPrompt.length} characters`);

  // Check for key sections
  const keySections = [
    'Core Identity',
    'Personality & Communication Style',
    'Critical First Step',
    'When to Use Search Tools',
    'Search Best Practices',
    'Temporal Accuracy',
    'Error Handling',
    'Available Tools',
  ];

  console.log('\n🔍 Checking for key sections:');
  keySections.forEach(section => {
    const found = chatPrompt.includes(section);
    console.log(`  ${found ? '✅' : '❌'} ${section}`);
  });

  // Check for placeholder replacement
  console.log('\n🔍 Checking for placeholders:');
  const hasPlaceholders = chatPrompt.includes('{CURRENT_DATE}') ||
                          chatPrompt.includes('{CURRENT_YEAR}') ||
                          chatPrompt.includes('{CURRENT_MONTH}');

  if (hasPlaceholders) {
    console.log('  ⚠️  Placeholders found (should be replaced at runtime)');
  } else {
    console.log('  ✅ No placeholders found (will be replaced at runtime)');
  }

  // Display first 500 characters of prompt
  console.log('\n📄 First 500 characters of prompt:');
  console.log('─'.repeat(50));
  console.log(chatPrompt.substring(0, 500));
  console.log('─'.repeat(50));

  console.log('\n✅ Test completed successfully!');
}

testChatPrompt().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
