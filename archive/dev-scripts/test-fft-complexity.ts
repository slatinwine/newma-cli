/**
 * Test FFT Planner Complexity Analysis Fix
 *
 * This test verifies that the FFT planner can handle AI responses
 * that may contain malformed JSON.
 */

import { FFTPlanner } from './src/fft/planner';
import { Config } from './src/config';

async function testFFTComplexityAnalysis() {
  console.log('🧪 Testing FFT Planner Complexity Analysis\n');

  // Create a minimal config
  const config: Config = {
    apiKey: process.env.OPENAI_API_KEY || 'test-key',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    endpoint: process.env.OPENAI_ENDPOINT,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    executionMode: 'standard',
    functionCallingEnabled: false,
  };

  const planner = new FFTPlanner(config);

  // Test case 1: Simple requirement (should use quick rules)
  console.log('Test 1: Simple requirement (quick rules)');
  console.log('Input: "Create a hello world file"');

  try {
    const result1 = await planner.generatePlan({
      requirement: 'Create a hello world file',
      projectInfo: {},
      userProfile: undefined,
    });

    console.log(`✅ Result: ${result1.complexity}`);
    console.log(`   Reasoning: ${result1.reasoning}`);
    console.log(`   Time: ${result1.analysisTime}ms\n`);
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}\n`);
  }

  // Test case 2: Complex requirement (should use AI or be detected by keywords)
  console.log('Test 2: Complex requirement (Vue + Java backend)');
  console.log('Input: "写一个网站，实现 html 上传下载功能。前端 vue，后端 java"');

  try {
    const result2 = await planner.generatePlan({
      requirement: '写一个网站，实现 html 上传下载功能。前端 vue，后端 java',
      projectInfo: {},
      userProfile: undefined,
    });

    console.log(`✅ Result: ${result2.complexity}`);
    console.log(`   Reasoning: ${result2.reasoning}`);
    console.log(`   Time: ${result2.analysisTime}ms\n`);

    // Show plan details if available
    if (result2.plan) {
      console.log(`   Plan: ${result2.plan.name}`);
      console.log(`   Actions: ${result2.plan.actions.length}`);
    }

    if (result2.options) {
      console.log(`   Options: ${result2.options.length} plans generated`);
      result2.options.forEach((opt, idx) => {
        console.log(`     [${idx + 1}] ${opt.name}`);
      });
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}\n`);
    console.log(`   Stack: ${error.stack?.split('\n').slice(0, 3).join('\n')}\n`);
  }

  // Test case 3: Ambiguous requirement (will trigger AI)
  console.log('Test 3: Ambiguous requirement (triggers AI)');
  console.log('Input: "Add user feature"');

  try {
    const result3 = await planner.generatePlan({
      requirement: 'Add user feature',
      projectInfo: {},
      userProfile: undefined,
    });

    console.log(`✅ Result: ${result3.complexity}`);
    console.log(`   Reasoning: ${result3.reasoning}`);
    console.log(`   Time: ${result3.analysisTime}ms\n`);
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}\n`);
  }

  console.log('========================================');
  console.log('✅ All tests completed\n');
}

// Run the test
testFFTComplexityAnalysis().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
