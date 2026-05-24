/**
 * Test Hybrid Plugin System
 *
 * Tests the new hybrid plugin system that combines:
 * 1. Progressive disclosure (SKILL.md + references/)
 * 2. Complex knowledge transfer (AI instructions)
 * 3. No-compilation mode (direct execution)
 * 4. Traditional compiled plugins
 */

import { SkillLoader, createSkillLoader } from './src/plugins/skill-loader';
import { DirectExecutionEngine, createDirectExecutionEngine } from './src/plugins/direct-execution';
import { HybridPluginManager, createHybridPluginManager } from './src/plugins/hybrid-manager';
import { DirectPlugin } from './src/plugins/skill-types';
import * as path from 'path';

async function testSkillLoader() {
  console.log('\n🧪 Test 1: Skill Loader (Progressive Disclosure)\n');
  console.log('=' .repeat(60));

  try {
    const loader = createSkillLoader({ verbose: true });

    // Load doc-coauthoring skill
    const skillPath = path.join(__dirname, 'examples/skills/doc-coauthoring');
    const skill = await loader.loadSkill(skillPath);

    console.log('\n✅ Skill loaded successfully!');
    console.log(`   ID: ${skill.id}`);
    console.log(`   Name: ${skill.name}`);
    console.log(`   Type: ${skill.type}`);
    console.log(`   Core tokens: ${Math.ceil(skill.core.markdown.length / 4)}`);
    console.log(`   Sections: ${skill.sections?.length || 0}`);

    if (skill.sections && skill.sections.length > 0) {
      console.log('\n   Progressive disclosure sections:');
      skill.sections.forEach(section => {
        console.log(`   - ${section.title} (${section.estimatedTokens} tokens)`);
      });
    }

    // Test trigger matching
    const userInput = 'I need to write API documentation';
    const matched = loader.findSkillsByTrigger(userInput);

    if (matched.length > 0) {
      console.log('\n✅ Trigger matching works!');
      console.log(`   Input: "${userInput}"`);
      console.log(`   Matched skills: ${matched.map(s => s.name).join(', ')}`);
    }

    return true;
  } catch (error: any) {
    console.log(`\n❌ Test failed: ${error.message}`);
    console.log(error.stack);
    return false;
  }
}

async function testDirectExecution() {
  console.log('\n🧪 Test 2: Direct Execution (No-Compilation Mode)\n');
  console.log('=' .repeat(60));

  try {
    const engine = createDirectExecutionEngine();

    // Create a simple direct plugin
    const plugin: DirectPlugin = {
      id: 'test-calculator',
      name: 'Test Calculator',
      description: 'Simple calculator without compilation',
      version: '1.0.0',
      type: 'typescript',
      entryPoint: 'calculator.ts',
      tools: [
        {
          name: 'add',
          description: 'Add two numbers',
          handler: 'const a = params.a || 0; const b = params.b || 0; const result = a + b; return { success: true, output: result.toString(), result };',
          parameters: {
            type: 'object',
            properties: {
              a: { type: 'number', description: 'First number' },
              b: { type: 'number', description: 'Second number' }
            },
            required: ['a', 'b']
          },
          permissions: ['SAFE'],
          category: 'UTILITY'
        }
      ]
    };

    // Execute tool
    console.log('   Executing: add(5, 3)');
    const result = await engine.executeDirectPlugin(plugin, 'add', { a: 5, b: 3 });

    if (result.success && result.result === 8) {
      console.log('\n✅ Direct execution works!');
      console.log(`   Result: ${result.result}`);
      console.log('   No compilation needed!');
    } else {
      console.log('\n❌ Unexpected result:', result);
      return false;
    }

    return true;
  } catch (error: any) {
    console.log(`\n❌ Test failed: ${error.message}`);
    console.log(error.stack);
    return false;
  }
}

async function testHybridManager() {
  console.log('\n🧪 Test 3: Hybrid Plugin Manager\n');
  console.log('=' .repeat(60));

  try {
    const manager = createHybridPluginManager();

    // Register a skill-based plugin
    console.log('   Registering skill plugin...');
    await manager.registerPlugin({
      type: 'skill',
      path: path.join(__dirname, 'examples/skills/doc-coauthoring')
    });

    // List plugins
    const plugins = manager.listPlugins();
    console.log(`\n✅ Plugins registered: ${plugins.length}`);
    plugins.forEach(p => {
      console.log(`   - ${p.name} (${p.type})`);
    });

    // Test trigger-based plugin finding
    const userInput = 'help me write documentation';
    const matched = manager.findPluginsByTrigger(userInput);

    if (matched.length > 0) {
      console.log('\n✅ Trigger-based finding works!');
      console.log(`   Found: ${matched.map(p => p.name).join(', ')}`);
    }

    return true;
  } catch (error: any) {
    console.log(`\n❌ Test failed: ${error.message}`);
    console.log(error.stack);
    return false;
  }
}

async function testSkillFileStructure() {
  console.log('\n🧪 Test 4: Skill File Structure Validation\n');
  console.log('=' .repeat(60));

  try {
    const fs = await import('fs/promises');
    const skillPath = path.join(__dirname, 'examples/skills/doc-coauthoring');

    // Check SKILL.md exists
    const skillFilePath = path.join(skillPath, 'SKILL.md');
    const skillContent = await fs.readFile(skillFilePath, 'utf-8');

    if (skillContent.includes('---') && skillContent.includes('# Doc Co-Authoring')) {
      console.log('✅ SKILL.md has valid frontmatter and content');
    } else {
      console.log('❌ SKILL.md structure invalid');
      return false;
    }

    // Check references directory
    const refPath = path.join(skillPath, 'references');
    const refFiles = await fs.readdir(refPath);

    if (refFiles.includes('advanced.md')) {
      console.log('✅ references/ directory exists with advanced.md');
    } else {
      console.log('❌ references/ directory missing or incomplete');
      return false;
    }

    // Verify progressive disclosure
    const lines = skillContent.split('\n');
    const quickStartIndex = lines.findIndex(l => l.includes('## Quick Start'));
    const advancedRefIndex = lines.findIndex(l => l.includes('See `references/advanced.md`'));

    if (quickStartIndex !== -1 && advancedRefIndex !== -1) {
      console.log('✅ Progressive disclosure structure correct');
      console.log('   - Quick start in main file');
      console.log('   - Advanced topics in references/');
    } else {
      console.log('❌ Progressive disclosure structure incomplete');
      return false;
    }

    return true;
  } catch (error: any) {
    console.log(`\n❌ Test failed: ${error.message}`);
    return false;
  }
}

async function testKnowledgeTransfer() {
  console.log('\n🧪 Test 5: Knowledge Transfer (AI Instructions)\n');
  console.log('=' .repeat(60));

  try {
    const loader = createSkillLoader();
    const skillPath = path.join(__dirname, 'examples/skills/doc-coauthoring');
    const skill = await loader.loadSkill(skillPath);

    // Check for knowledge transfer elements
    const hasWhenToUse = skill.core.whenToUse && skill.core.whenToUse.length > 0;
    const hasTriggers = skill.core.triggers && skill.core.triggers.length > 0;
    const hasWorkflow = skill.core.markdown.includes('## Stage 1') &&
                        skill.core.markdown.includes('## Stage 2') &&
                        skill.core.markdown.includes('## Stage 3');

    if (hasWhenToUse) {
      console.log('✅ When to use conditions defined');
      console.log(`   Triggers: ${skill.core.whenToUse!.length} conditions`);
    }

    if (hasTriggers) {
      console.log('✅ Trigger keywords defined');
      console.log(`   Keywords: ${skill.core.triggers!.join(', ')}`);
    }

    if (hasWorkflow) {
      console.log('✅ Workflow stages defined');
      console.log('   - Stage 1: Context Gathering');
      console.log('   - Stage 2: Refinement & Structure');
      console.log('   - Stage 3: Reader Testing');
    }

    if (hasWhenToUse && hasTriggers && hasWorkflow) {
      console.log('\n✅ Complete knowledge transfer structure!');
      return true;
    } else {
      console.log('\n❌ Knowledge transfer incomplete');
      return false;
    }
  } catch (error: any) {
    console.log(`\n❌ Test failed: ${error.message}`);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('\n🚀 Kode Hybrid Plugin System - Test Suite\n');
  console.log('=' .repeat(60));

  const results = {
    skillLoader: await testSkillLoader(),
    directExecution: await testDirectExecution(),
    hybridManager: await testHybridManager(),
    fileStructure: await testSkillFileStructure(),
    knowledgeTransfer: await testKnowledgeTransfer(),
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
    console.log('Kode now supports:');
    console.log('   ✨ Progressive disclosure (SKILL.md + references/)');
    console.log('   ✨ Complex knowledge transfer (AI instructions)');
    console.log('   ✨ No-compilation mode (direct execution)');
    console.log('   ✨ Hybrid plugin system (Code + Skills)');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the output above.\n');
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
