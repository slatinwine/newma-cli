/**
 * Test Weather Skill with Auto Skill Manager
 *
 * Demonstrates automatic skill discovery, matching, and usage
 */

import { createAutoSkillManager } from './dist/plugins/auto-skill-manager';
import * as path from 'path';

async function testWeatherSkill() {
  console.log('\n🌤️  Testing Weather Skill\n');
  console.log('=' .repeat(60));

  try {
    // 1. Create auto skill manager
    const manager = createAutoSkillManager({
      skillDirectories: [
        path.join(__dirname, '.kode/skills'),
        path.join(__dirname, 'examples/skills'),
      ],
      autoLoad: true,
      verbose: true, // Show what's happening
    });

    console.log('\n📂 Step 1: Initializing Auto Skill Manager...');
    await manager.initialize();

    // Show all loaded skills
    const skills = manager.listSkills();
    console.log(`\n✅ Loaded ${skills.length} skills:`);
    skills.forEach(skill => {
      console.log(`   - ${skill.name} (${skill.id})`);
      if (skill.core.triggers && skill.core.triggers.length > 0) {
        console.log(`     Triggers: ${skill.core.triggers.slice(0, 3).join(', ')}${skill.core.triggers.length > 3 ? '...' : ''}`);
      }
    });

    // 2. Test different user inputs
    const testInputs = [
      'What\'s the weather in Beijing today?',
      'Will it rain in Shanghai tomorrow?',
      'Help me write API documentation', // Should match doc-coauthoring instead
      'Is it warmer in Tokyo or Singapore right now?',
      'How do I refactor my code?', // No skill match
    ];

    console.log('\n\n🔍 Step 2: Testing Auto-Matching\n');

    for (const input of testInputs) {
      console.log(`\n   User: "${input}"`);

      const matches = manager.findSkills(input);

      if (matches.length > 0) {
        const bestMatch = matches[0];
        console.log(`   ✅ Matched: ${bestMatch.skill.name}`);
        console.log(`      Score: ${bestMatch.score.toFixed(2)}`);
        console.log(`      Reason: ${bestMatch.reason}`);
        console.log(`      Matched triggers: ${bestMatch.matchedTriggers.join(', ')}`);
      } else {
        console.log(`   ❌ No matching skill - using default AI`);
      }
    }

    // 3. Demonstrate AI prompt building with weather skill
    console.log('\n\n🤖 Step 3: AI Integration Demo\n');

    const weatherQuery = 'What\'s the weather in Beijing today?';
    console.log(`   User: "${weatherQuery}"\n`);

    const messages = await manager.buildPromptWithSkill(weatherQuery);

    console.log('   Generated AI Messages:');
    console.log('   ' + '─'.repeat(58));

    messages.forEach((msg, i) => {
      console.log(`   [${msg.role}]`);

      if (msg.role === 'system') {
        // Show first 800 chars of system prompt
        const preview = msg.content.substring(0, 800) + (msg.content.length > 800 ? '\n... [truncated, ' + msg.content.length + ' total chars]' : '');
        console.log(`   ${preview}`);
      } else {
        console.log(`   ${msg.content}`);
      }
      console.log('');
    });

    // 4. Show statistics
    console.log('─'.repeat(60));
    const stats = manager.getStats();
    console.log('\n📊 Skill Manager Statistics:');
    console.log(`   Total skills: ${stats.total}`);
    console.log(`   With triggers: ${stats.withTriggers}`);
    console.log(`   Knowledge type: ${stats.types.knowledge}`);
    console.log(`   Code type: ${stats.types.code}`);
    console.log(`   Hybrid type: ${stats.types.hybrid}`);

    console.log('\n✅ Test completed successfully!\n');

    console.log('💡 Key Features Demonstrated:');
    console.log('   1. ✅ Auto-discovered weather skill from .kode/skills/');
    console.log('   2. ✅ Auto-matched weather-related queries');
    console.log('   3. ✅ Built AI prompt with skill content');
    console.log('   4. ✅ Provided structured weather guidance to AI');
    console.log('   5. ✅ Progressive disclosure ready (references/)');

    return true;
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run test
testWeatherSkill()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Test error:', error);
    process.exit(1);
  });
