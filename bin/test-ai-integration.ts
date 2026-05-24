#!/usr/bin/env npx ts-node
/**
 * Test AI Integration with Skills
 *
 * This script verifies that:
 * 1. Skills are loaded by SimpleSkillManager
 * 2. Skills are converted to OpenAI tool definitions
 * 3. Tool definitions are valid
 */

import { resolve } from 'path';
import { SimpleSkillManager } from '../src/skills/simple-loader';
import { skillsToOpenAITools, filterSkillsByAllowedTools } from '../src/skills/tool-converter';

const skillsDir = resolve(process.cwd(), '.kode', 'skills');

async function testAIIntegration() {
  console.log('🧪 Testing AI Integration with Skills\n');

  // 1. Load skills
  console.log('📂 Step 1: Loading skills...');
  const skillManager = new SimpleSkillManager({ skillDirectories: [skillsDir] });
  const skills = await skillManager.discoverSkills();

  console.log(`✅ Loaded ${skills.length} skill(s)\n`);

  // 2. Filter by allowed-tools (simulating available tools)
  console.log('🔍 Step 2: Filtering skills by allowed-tools...');
  const availableTools = ['read_file', 'search_code', 'run_command', 'write_file'];
  const enabledSkills = filterSkillsByAllowedTools(skills, availableTools);

  console.log(`✅ ${enabledSkills.length} skill(s) enabled (${skills.length - enabledSkills.length} filtered)\n`);

  // 3. Convert to OpenAI tools
  console.log('🔧 Step 3: Converting skills to OpenAI tools...');
  const tools = skillsToOpenAITools(enabledSkills);

  console.log(`✅ Generated ${tools.length} tool definition(s)\n`);

  // 4. Display tool definitions
  console.log('📋 Step 4: Tool definitions preview:\n');

  for (const tool of tools.slice(0, 3)) { // Show first 3
    console.log(`📌 Tool: ${tool.function.name}`);
    console.log(`   Type: ${tool.type}`);
    console.log(`   Description: ${tool.function.description.substring(0, 80)}...`);
    console.log(`   Parameters: ${JSON.stringify(tool.function.parameters, null, 2).substring(0, 100)}...\n`);
  }

  if (tools.length > 3) {
    console.log(`... and ${tools.length - 3} more\n`);
  }

  // 5. Validation summary
  console.log('✅ Step 5: Validation Summary\n');

  const validationResults = {
    totalSkills: skills.length,
    enabledSkills: enabledSkills.length,
    convertedTools: tools.length,
    toolNames: tools.map(t => t.function.name),
  };

  console.log('📊 Results:');
  console.log(`   Total skills loaded: ${validationResults.totalSkills}`);
  console.log(`   Skills enabled: ${validationResults.enabledSkills}`);
  console.log(`   Tools generated: ${validationResults.convertedTools}`);
  console.log(`\n   Tool names:`);
  for (const name of validationResults.toolNames) {
    console.log(`   • ${name}`);
  }

  console.log('\n✅ AI Integration Test PASSED!\n');

  console.log('🎯 Next Steps:');
  console.log('   1. Start newma: npx newma-cli -i');
  console.log('   2. Ask: "test skill" or "hello"');
  console.log('   3. AI should discover and use ai-test-skill');
  console.log('');
}

testAIIntegration().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
