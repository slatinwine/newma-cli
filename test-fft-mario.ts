/**
 * Integration test for FFT planner with Mario game scenario
 */

import { FFTPlanner } from './src/fft/planner';
import { Config } from './src/config';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testMarioScenario() {
  console.log('🎮 Testing FFT Planner with Mario Game Scenario\n');
  console.log('═'.repeat(60));

  // Create config
  const config: Config = {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
    endpoint: process.env.OPENAI_ENDPOINT || undefined,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  };

  // Create planner
  const planner = new FFTPlanner(config);

  // Test input
  const input = {
    requirement: '搜索一下马里奥游戏，再生成一个马里奥游戏 单html应用',
    projectInfo: {},
    userProfile: undefined,
  };

  console.log('\n📋 Requirement:');
  console.log(input.requirement);
  console.log('');

  try {
    // Generate plan
    const result = await planner.generatePlan(input);

    console.log('\n✅ Plan Generated Successfully!');
    console.log('═'.repeat(60));
    console.log(`\nComplexity: ${result.complexity.toUpperCase()}`);
    console.log(`Reasoning: ${result.reasoning}`);
    console.log(`Analysis Time: ${result.analysisTime}ms`);

    if (result.plan) {
      console.log(`\n📊 Plan: ${result.plan.name}`);
      console.log(`Description: ${result.plan.description}`);
      console.log(`Actions: ${result.plan.actions.length}`);
      console.log(`Estimated Time: ${result.plan.estimatedTime}ms`);
      console.log(`Risk Level: ${result.plan.riskLevel}`);
      console.log(`Confidence: ${result.plan.confidence}`);

      if (result.plan.actions.length > 0) {
        console.log('\n✅ SUCCESS: Actions were generated!');
        console.log('\nFirst few actions:');
        result.plan.actions.slice(0, 3).forEach((action, idx) => {
          console.log(`  ${idx + 1}. ${action.type}: ${action.path || action.command}`);
        });

        if (result.plan.actions.length > 3) {
          console.log(`  ... and ${result.plan.actions.length - 3} more`);
        }
      } else {
        console.log('\n❌ FAILURE: No actions generated (fallback was used)');
      }
    }

    if (result.options) {
      console.log(`\n📊 Options: ${result.options.length} generated`);
      result.options.forEach((opt, idx) => {
        console.log(`\n  ${idx + 1}. ${opt.name} (${opt.strategy})`);
        console.log(`     Actions: ${opt.actions.length}`);
        console.log(`     Risk: ${opt.riskLevel}`);
        console.log(`     Time: ${opt.estimatedTime}ms`);
      });
    }

    console.log('\n' + '═'.repeat(60));
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run test
testMarioScenario().then(() => {
  console.log('\n✨ Test complete');
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
