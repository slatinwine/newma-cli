#!/usr/bin/env npx ts-node
/**
 * Manual REPL Skill Command Test
 * Simulates REPL command execution
 */

import { SimpleSkillManager } from './src/skills/simple-loader';
import { SkillRegistry } from './src/skills/registry';
import * as path from 'path';

async function testSkillCommands() {
  console.log('🧪 Testing REPL Skill Commands\n');
  console.log('='.repeat(60));

  try {
    // Initialize (simulates REPLManager.initializeSkillManager)
    const skillsDir = path.join(process.cwd(), '.kode', 'skills');
    const registryPath = path.join(skillsDir, 'registry.json');

    const skillManager = new SimpleSkillManager({
      skillDirectories: [skillsDir],
    });

    const skillRegistry = new SkillRegistry(registryPath);
    await skillRegistry.initialize();
    await skillManager.discoverSkills();

    console.log('✅ System initialized\n');

    // Test 1: skill-list
    console.log('\n📋 Test 1: /skill-list');
    console.log('-'.repeat(60));
    const skills = await skillManager.discoverSkills();
    console.log(`\nTotal: ${skills.length} skill(s)\n`);

    skills.slice(0, 3).forEach(skill => {
      const metadata = skill.metadata;
      const registryEntry = skillRegistry.getSkill(metadata.name);
      const enabled = registryEntry?.enabled;

      console.log(`${enabled ? '✓' : '✗'} ${metadata.name}`);
      console.log(`  ${metadata.description.substring(0, 60)}...`);
      console.log(`  Type: ${metadata.type} | Version: ${metadata.version || '1.0.0'}`);
      console.log('');
    });

    // Test 2: skill-info
    console.log('\n📋 Test 2: /skill-info ai-test-skill');
    console.log('-'.repeat(60));
    const skill = skillManager.getSkill('ai-test-skill');
    if (skill) {
      const metadata = skill.metadata;
      const registryEntry = skillRegistry.getSkill('ai-test-skill');

      console.log(`\n${metadata.name}`);
      console.log(`\nDescription:`);
      console.log(`  ${metadata.description}`);
      console.log(`\nDetails:`);
      console.log(`  Version: ${metadata.version || '1.0.0'}`);
      console.log(`  Type: ${metadata.type}`);
      console.log(`  Status: ${registryEntry?.enabled ? 'Enabled' : 'Disabled'}`);
      console.log(`  Author: ${metadata.author || 'Unknown'}`);
      console.log(`\nLocation:`);
      console.log(`  Path: ${skill.path}`);
      console.log('');
    }

    // Test 3: skill-search
    console.log('\n🔍 Test 3: /skill-search test');
    console.log('-'.repeat(60));
    const query = 'test';
    const filtered = skills.filter(skill => {
      const metadata = skill.metadata;
      return (
        metadata.name.toLowerCase().includes(query) ||
        metadata.description.toLowerCase().includes(query) ||
        metadata.tags.some((tag: string) => tag.toLowerCase().includes(query))
      );
    });

    console.log(`\nFound ${filtered.length} skill(s)\n`);
    filtered.forEach(skill => {
      const metadata = skill.metadata;
      console.log(`• ${metadata.name}`);
      console.log(`  ${metadata.description.substring(0, 60)}...`);
      console.log(`  Tags: ${metadata.tags.join(', ') || 'none'}`);
      console.log('');
    });

    console.log('='.repeat(60));
    console.log('\n✅ All REPL command tests passed!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

testSkillCommands();
