#!/usr/bin/env npx ts-node
/**
 * Test if skill manager initialization works
 */

import { SimpleSkillManager } from './src/skills/simple-loader';
import { SkillRegistry } from './src/skills/registry';
import * as path from 'path';

async function testSkills() {
  console.log('🧪 Testing Skill Manager Initialization\n');

  try {
    const skillsDir = path.join(process.cwd(), '.kode', 'skills');
    const registryPath = path.join(skillsDir, 'registry.json');

    console.log(`Skills directory: ${skillsDir}`);
    console.log(`Registry path: ${registryPath}\n`);

    // Create Skill Manager
    const skillManager = new SimpleSkillManager({
      skillDirectories: [skillsDir],
    });

    // Create Skill Registry
    const skillRegistry = new SkillRegistry(registryPath);

    // Initialize registry
    await skillRegistry.initialize();
    console.log('✅ Registry initialized\n');

    // Discover skills
    const skills = await skillManager.discoverSkills();
    console.log(`✅ Discovered ${skills.length} skill(s)\n`);

    // List skills
    console.log('📋 Skills:');
    console.log('═'.repeat(60));
    for (const skill of skills) {
      const metadata = skill.metadata;
      console.log(`\n${metadata.name}`);
      console.log(`  Description: ${metadata.description.substring(0, 60)}...`);
      console.log(`  Type: ${metadata.type}`);
      console.log(`  Version: ${metadata.version || '1.0.0'}`);
    }
    console.log('\n' + '═'.repeat(60) + '\n');

    console.log('✅ Test passed!\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testSkills();
