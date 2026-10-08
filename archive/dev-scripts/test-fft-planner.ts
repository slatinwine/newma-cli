/**
 * Test FFT Planner functionality
 *
 * This test verifies:
 * 1. Complexity analysis (simple vs. complex)
 * 2. Single plan generation for simple tasks
 * 3. Multiple options generation for complex tasks
 */

import { FFTPlanner } from './src/fft/planner';
import { Config } from './src/config';

// Mock config (use real .env values if available)
const config: Config = {
  apiKey: process.env.OPENAI_API_KEY || '',
  baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
  endpoint: process.env.OPENAI_ENDPOINT || undefined,
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  functionCallingEnabled: false,
  executionMode: 'standard',
};

async function testFFTPlanner() {
  console.log('\n🧪 FFT Planner Tests\n');

  const planner = new FFTPlanner(config);

  // Test 1: Simple task
  console.log('Test 1: Simple Task (单一文件创建)');
  console.log('─'.repeat(60));
  try {
    const simpleResult = await planner.generatePlan({
      requirement: '创建一个 README.md 文件',
      projectInfo: {},
      userProfile: 'User prefers Chinese',
    });

    console.log(`✅ Complexity: ${simpleResult.complexity}`);
    console.log(`✅ Reasoning: ${simpleResult.reasoning}`);
    console.log(`✅ Analysis Time: ${simpleResult.analysisTime}ms`);

    if (simpleResult.plan) {
      console.log(`✅ Generated plan: ${simpleResult.plan.name}`);
      console.log(`✅ Actions: ${simpleResult.plan.actions.length}`);
    }
  } catch (error: any) {
    console.error(`❌ Test 1 failed: ${error.message}`);
  }

  console.log('\n');

  // Test 2: Complex task
  console.log('Test 2: Complex Task (系统重构)');
  console.log('─'.repeat(60));
  try {
    const complexResult = await planner.generatePlan({
      requirement: '重构认证系统，添加 JWT 和 OAuth2 支持',
      projectInfo: {
        'src/auth.ts': 'Current auth implementation',
      },
      userProfile: 'User prefers TypeScript and Node.js',
    });

    console.log(`✅ Complexity: ${complexResult.complexity}`);
    console.log(`✅ Reasoning: ${complexResult.reasoning}`);
    console.log(`✅ Analysis Time: ${complexResult.analysisTime}ms`);

    if (complexResult.options) {
      console.log(`✅ Generated ${complexResult.options.length} options:`);
      complexResult.options.forEach((opt, idx) => {
        console.log(`\n  [${idx + 1}] ${opt.name}`);
        console.log(`      ${opt.description}`);
        console.log(`      Risk: ${opt.riskLevel}, Time: ${opt.estimatedTime}ms`);
        console.log(`      Pros: ${opt.pros.join(', ')}`);
        console.log(`      Cons: ${opt.cons.join(', ')}`);
      });
    }
  } catch (error: any) {
    console.error(`❌ Test 2 failed: ${error.message}`);
  }

  console.log('\n');
}

// Run tests
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           FFT Planner Test Suite                          ║');
console.log('╚════════════════════════════════════════════════════════════╝');

testFFTPlanner()
  .then(() => {
    console.log('✅ All tests completed!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
