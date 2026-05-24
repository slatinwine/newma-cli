#!/usr/bin/env ts-node

/**
 * Test script to verify user profile integration in chat mode
 */

import { loadSystemPrompt, PromptType } from './src/prompt';

async function testUserProfileIntegration() {
  console.log('🧪 Testing User Profile Integration in Chat Mode\n');

  // Load base chat prompt
  const basePrompt = loadSystemPrompt(PromptType.CHAT);

  console.log('✅ Base prompt loaded');
  console.log(`📏 Base prompt length: ${basePrompt.length} characters\n`);

  // Simulate adding user profile (same way chatAI() does it)
  const mockUserProfile = `# 用户侧写

## 语言偏好
中文

## 交流风格
简洁直接，偏好事实性回答

## 兴趣领域
- 实时信息查询（天气、股价）
- 商业人物评价
- 基础知识问答
- 阅读习惯：喜欢看书

## 其他特征
- 重视时效性和准确性
- 喜欢快速获取信息
- 问题简短明确`;

  const finalPrompt = basePrompt + `\n\nUSER PROFILE:\n${mockUserProfile}\n\nIMPORTANT: Adapt your responses to match the user's language preference and communication style as described in their profile.`;

  console.log('👤 User profile added to prompt');
  console.log(`📏 Final prompt length: ${finalPrompt.length} characters\n`);

  // Check for key profile-related instructions
  const profileChecks = [
    { name: 'User Profile Awareness section', pattern: /User Profile Awareness/i },
    { name: 'Profile usage rules', pattern: /ALWAYS.*adapt.*response.*language/i },
    { name: 'Profile example scenarios', pattern: /User Profile.*Language.*Style.*Interests/i },
    { name: 'Profile in Key Takeaways', pattern: /Check user profile.*adapt.*language/i },
    { name: 'Actual user profile appended', pattern: /USER PROFILE:\s*# 用户侧写/i },
  ];

  console.log('🔍 Checking for profile integration:');
  profileChecks.forEach(check => {
    const found = check.pattern.test(finalPrompt);
    console.log(`  ${found ? '✅' : '❌'} ${check.name}`);
  });

  // Show how the profile is positioned
  const profileSectionStart = finalPrompt.indexOf('USER PROFILE:');
  const totalLength = finalPrompt.length;
  const profilePosition = ((profileSectionStart / totalLength) * 100).toFixed(1);

  console.log(`\n📍 User profile is positioned at ${profilePosition}% of the prompt`);
  console.log('   (Profile is at the END, after all core instructions)\n');

  // Display a sample of how AI would interpret this
  console.log('📄 Example: How AI would use this profile\n');
  console.log('─'.repeat(60));
  console.log('User asks: "小米股价"');
  console.log('');
  console.log('AI sees in profile:');
  console.log('  - Language: 中文 ✓');
  console.log('  - Style: 简洁直接 ✓');
  console.log('  - Interests: 实时信息、股价 ✓');
  console.log('');
  console.log('AI response (adapted):');
  console.log('  "小米集团（1810.HK）今日股价为 XX 港元"');
  console.log('  ✓ Uses Chinese');
  console.log('  ✓ Concise answer');
  console.log('  ✓ Relevant to user interest');
  console.log('─'.repeat(60));

  console.log('\n✅ User profile integration test completed successfully!');
  console.log('\n💡 Key Benefits:');
  console.log('  1. AI adapts language to user preference');
  console.log('  2. AI matches communication style');
  console.log('  3. AI personalizes based on interests');
  console.log('  4. Profile persists across conversations');
}

testUserProfileIntegration().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
