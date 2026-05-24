#!/usr/bin/env npx ts-node
/**
 * Initialize skill registry with existing skills
 */

import { resolve } from 'path';
import { SkillRegistry } from '../src/skills/registry';
import { SimpleSkillManager } from '../src/skills/simple-loader';
import { parseSkillFrontmatter } from '../src/skills/simple-loader';
import { readFile } from 'fs/promises';

const skillsDir = resolve(process.cwd(), '.kode', 'skills');
const registryPath = resolve(skillsDir, 'registry.json');

async function initRegistry() {
  console.log('📝 Initializing skill registry...\n');

  // Create registry
  const registry = new SkillRegistry(registryPath);
  await registry.initialize();

  // Load all skills
  const skillManager = new SimpleSkillManager({ skillDirectories: [skillsDir] });
  const skills = await skillManager.discoverSkills();

  console.log(`Found ${skills.length} skill(s)\n`);

  // Register each skill
  for (const skill of skills) {
    try {
      const content = await readFile(skill.path, 'utf-8');
      const metadata = parseSkillFrontmatter(content);

      const entry = SkillRegistry.createEntryFromMetadata(
        metadata,
        resolve(skill.path, '..'),
        'local'
      );

      if (registry.hasSkill(metadata.name)) {
        console.log(`⚠️  Skipping existing: ${metadata.name}`);
      } else {
        await registry.registerSkill(entry);
        console.log(`✅ Registered: ${metadata.name}`);
      }
    } catch (error: any) {
      console.error(`❌ Failed to register ${skill.id}: ${error.message}`);
    }
  }

  console.log(`\n✅ Registry initialized with ${skills.length} skill(s)`);
  console.log(`📁 Location: ${registryPath}\n`);

  // Show stats
  const stats = registry.getStats();
  console.log('📊 Statistics:');
  console.log(`   Total: ${stats.total}`);
  console.log(`   Enabled: ${stats.enabled}`);
  console.log(`   By Type: ${JSON.stringify(stats.byType, null, 2)}\n`);
}

initRegistry().catch(console.error);
