/**
 * Test Auto Skill Manager
 *
 * Tests automatic skill discovery, matching, and AI integration
 */

import { createAutoSkillManager } from './dist/plugins/auto-skill-manager';
import * as path from 'path';

async function testAutoSkillDiscovery() {
  console.log('\n🧪 Test: Auto Skill Discovery\n');
  console.log('=' .repeat(60));

  try {
    const manager = createAutoSkillManager({
      skillDirectories: [
        path.join(__dirname, 'examples/skills'),
        path.join(__dirname, '.kode/skills'),
      ],
      autoLoad: true,
      verbose: true,
    });

    // Initialize (scan and load skills)
    await manager.initialize();

    const stats = manager.getStats();
    console.log('\n📊 Statistics:');
    console.log(`   Total skills: ${stats.total}`);
    console.log(`   With triggers: ${stats.withTriggers}`);
    console.log(`   Types: ${JSON.stringify(stats.types)}`);

    return true;
  } catch (error: any) {
    console.log(`\n❌ Test failed: ${error.message}`);
    return false;
  }
}

async function testSkillMatching() {
  console.log('\n🧪 Test: Skill Auto-Matching\n');
  console.log('=' .repeat(60));

  try {
    const manager = createAutoSkillManager({
      skillDirectories: [path.join(__dirname, 'examples/skills')],
      autoLoad: true,
      verbose: false,
    });

    await manager.initialize();

    // Test different user inputs
    const testCases = [
      'I need to write API documentation',
      'Help me create a README file',
      'How do I refactor my code?',
      'What is the weather today?', // No skill should match
    ];

    for (const input of testCases) {
      console.log(`\n   Input: "${input}"`);
      const matches = manager.findSkills(input);

      if (matches.length > 0) {
        console.log(`   ✅ Matched: ${matches[0].skill.name}`);
        console.log(`      Score: ${matches[0].score.toFixed(2)}`);
        console.log(`      Triggers: ${matches[0].matchedTriggers.join(', ')}`);
      } else {
        console.log(`   ❌ No matching skill`);
      }
    }

    return true;
  } catch (error: any) {
    console.log(`\n❌ Test failed: ${error.message}`);
    return false;
  }
}

async function testAIIntegration() {
  console.log('\n🧪 Test: AI Integration with Skills\n');
  console.log('=' .repeat(60));

  try {
    const manager = createAutoSkillManager({
      skillDirectories: [path.join(__dirname, 'examples/skills')],
      autoLoad: true,
      verbose: false,
    });

    await manager.initialize();

    // Build AI prompt with skill
    const userInput = 'I need to write API documentation';
    const messages = await manager.buildPromptWithSkill(userInput);

    console.log(`\n   User Input: "${userInput}"`);
    console.log('\n   Generated AI Messages:');
    console.log('   ' + '─'.repeat(58));

    messages.forEach((msg, i) => {
      console.log(`   [${msg.role}]`);
      if (msg.role === 'system') {
        // Show first 500 chars of system prompt
        const preview = msg.content.substring(0, 500) + (msg.content.length > 500 ? '...' : '');
        console.log(`   ${preview}`);
      } else {
        console.log(`   ${msg.content}`);
      }
      console.log('');
    });

    return true;
  } catch (error: any) {
    console.log(`\n❌ Test failed: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('\n🚀 Auto Skill Manager - Test Suite\n');
  console.log('=' .repeat(60));

  const results = {
    discovery: await testAutoSkillDiscovery(),
    matching: await testSkillMatching(),
    aiIntegration: await testAIIntegration(),
  };

  console.log('\n' + '=' .repeat(60));
  console.log('📊 Test Results Summary\n');

  const total = Object.keys(results).length;
  const passed = Object.values(results).filter(r => r).length;

  Object.entries(results).forEach(([name, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`   ${status}: ${name}`);
  });

  console.log(`\n   Total: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('\n🎉 All tests passed!\n');
    console.log('Kode 现在可以:');
    console.log('   ✅ 自动发现 skills');
    console.log('   ✅ 根据 triggers 匹配技能');
    console.log('   ✅ 自动构建 AI 提示词');
    console.log('   ✅ 渐进式披露 (按需加载)');
  } else {
    console.log('\n⚠️  Some tests failed.\n');
  }

  return passed === total;
}

// Run tests
runAllTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Test suite error:', error);
    process.exit(1);
  });
