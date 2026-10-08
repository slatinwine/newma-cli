/**
 * Direct test of Reasoner class
 * Tests if the improved prompt generates actionable commands
 */

import { Reasoner } from './dist/loop/reasoner';
import { getDefaultConfig, Config } from './dist/config';
import { scanDirectory } from './dist/scanner';

async function testReasoner() {
  console.log('🧪 Testing Reasoner with improved prompt\n');
  console.log('📝 Requirement: "总结项目"\n');

  try {
    // Load config
    const config = getDefaultConfig();

    // Create reasoner
    const reasoner = new Reasoner(config, process.cwd());

    // Scan project
    const projectInfo = await scanDirectory(process.cwd());

    // Test reasoning
    const result = await reasoner.reason(
      '总结项目',
      projectInfo,
      undefined  // no previous reasoning
    );

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULT');
    console.log('='.repeat(60));

    // Check if actions were generated
    if (result.plan.actions.length > 0) {
      console.log(`\n✅ SUCCESS: Generated ${result.plan.actions.length} actions\n`);

      console.log('📋 Actions:');
      result.plan.actions.forEach((action, idx) => {
        console.log(`  ${idx + 1}. ${action.type}: ${JSON.stringify(action)}`);
      });

      console.log(`\n🧠 Reasoning steps: ${result.reasoning.length}`);
      console.log(`📈 Confidence: ${(result.confidence * 100).toFixed(0)}%`);
      console.log(`🎯 Expected outcome: ${result.expectedOutcome}`);

      // Check if actions are specific commands
      const hasRunCommands = result.plan.actions.some(a => a.type === 'run');
      const hasSpecificCommands = result.plan.actions.some(a =>
        a.type === 'run' && a.command && !a.command.includes('...')
      );

      if (hasRunCommands && hasSpecificCommands) {
        console.log('\n✅ EXCELLENT: Actions include specific executable commands!');
      } else {
        console.log('\n⚠️  WARNING: Actions may not be specific enough');
      }

    } else {
      console.log('\n❌ FAILED: No actions generated');
      console.log('The AI should have returned actionable commands like:');
      console.log('  - {"type": "run", "command": "cat README.md"}');
      console.log('  - {"type": "run", "command": "ls -la src/"}');
      process.exit(1);
    }

    console.log('\n' + '='.repeat(60));

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testReasoner();
