/**
 * Simple test for Skills Creator
 */

import { SkillsCreator } from './dist/skills-creator/index.js';

async function testSkillsCreator() {
  console.log('🧪 Testing Skills Creator...\n');

  // Mock config
  const config = {
    apiKey: 'test-key',
    model: 'gpt-4o-mini',
    baseUrl: 'http://localhost:8000',
  };

  const creator = new SkillsCreator(config, process.cwd());

  console.log('✅ SkillsCreator instantiated successfully');
  console.log('Config:', creator.getConfig());

  console.log('\n📋 Skills Creator is ready!');
  console.log('\nTo use:');
  console.log('  1. REPL: kode -i');
  console.log('     > /create-plugin');
  console.log('  2. CLI: kode-create-plugin interactive');
  console.log('  3. API: import { SkillsCreator } ...');
}

testSkillsCreator().catch(console.error);
