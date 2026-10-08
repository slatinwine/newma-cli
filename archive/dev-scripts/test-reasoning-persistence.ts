/**
 * Test script to verify ReAct and ToT reasoning persistence to Memo
 */

import { Config } from './src/config';
import { MemoCliPlugin } from './src/loop/plugins/memo-cli-plugin';
import { TreeOfThoughtsEngine } from './src/ultrathink/tree-of-thoughts';
import { ReActAgent } from './src/ultrathink/react-loop';
import { ReasoningTracker } from './src/ultrathink/tracker';
import { scanDirectory } from './src/scanner';

async function testToTPersistence() {
  console.log('\n🧪 Testing ToT Reasoning Persistence\n');

  // Setup
  const config = new Config();
  const projectRoot = process.cwd();
  const projectInfo = await scanDirectory(projectRoot);

  // Initialize Memo plugin
  const memoPlugin = new MemoCliPlugin(projectRoot);
  await memoPlugin.initialize();

  // Initialize ToT with Memo
  const tracker = new ReasoningTracker();
  const totEngine = new TreeOfThoughtsEngine(
    config,
    projectInfo,
    'Add user authentication to the application',
    { memoPlugin, tracker }
  );

  console.log('📊 Running ToT BFS search with Memo persistence...');
  const result = await totEngine.breadthFirstSearch();

  console.log('\n✅ ToT Search Complete:');
  console.log(`   - Best node: ${result?.id}`);
  console.log(`   - Content: ${result?.content.substring(0, 100)}...`);

  // Verify reasoning was saved
  const reasoningData = memoPlugin['reasoningManager']['data'];
  const chains = Object.values(reasoningData.reasoningChains || {});

  console.log(`\n📝 Reasoning chains saved: ${chains.length}`);
  if (chains.length > 0) {
    const chain = chains[0];
    console.log(`   - Chain ID: ${chain.id.substring(0, 8)}...`);
    console.log(`   - Type: ${chain.type}`);
    console.log(`   - Status: ${chain.status}`);
    console.log(`   - Steps: ${chain.steps.length}`);

    console.log('\n📄 Reasoning steps:');
    chain.steps.forEach((step, index) => {
      console.log(`   ${index + 1}. ${step.description}`);
      console.log(`      Status: ${step.status}`);
      if (step.metadata) {
        console.log(`      Algorithm: ${step.metadata.algorithm}`);
        console.log(`      Depth: ${step.metadata.depth}`);
      }
    });
  }

  return chains.length > 0;
}

async function testReActPersistence() {
  console.log('\n🧪 Testing ReAct Reasoning Persistence\n');

  // Setup
  const config = new Config();
  const projectRoot = process.cwd();
  const projectInfo = await scanDirectory(projectRoot);

  // Initialize Memo plugin
  const memoPlugin = new MemoCliPlugin(projectRoot);
  await memoPlugin.initialize();

  // Initialize ReAct with Memo
  const tracker = new ReasoningTracker();
  const reactAgent = new ReActAgent(
    config,
    projectInfo,
    3, // maxSteps
    { memoPlugin, tracker }
  );

  console.log('🔄 Running ReAct loop with Memo persistence...');
  const result = await reactAgent.runReActLoop('Verify that files are properly structured');

  console.log('\n✅ ReAct Loop Complete:');
  console.log(`   - Success: ${result.success}`);
  console.log(`   - Steps: ${result.totalSteps}`);
  console.log(`   - Time: ${result.totalTime}ms`);

  // Verify reasoning was saved
  const reasoningData = memoPlugin['reasoningManager']['data'];
  const chains = Object.values(reasoningData.reasoningChains || {});

  console.log(`\n📝 Reasoning chains saved: ${chains.length}`);
  if (chains.length > 0) {
    const chain = chains[0];
    console.log(`   - Chain ID: ${chain.id.substring(0, 8)}...`);
    console.log(`   - Type: ${chain.type}`);
    console.log(`   - Status: ${chain.status}`);
    console.log(`   - Steps: ${chain.steps.length}`);

    console.log('\n📄 Reasoning steps:');
    chain.steps.forEach((step, index) => {
      console.log(`   ${index + 1}. ${step.description}`);
      console.log(`      Type: ${step.type}`);
      console.log(`      Status: ${step.status}`);
      if (step.metadata) {
        console.log(`      Algorithm: ${step.metadata.algorithm}`);
        console.log(`      Step: ${step.metadata.stepNumber}`);
        console.log(`      Phase: ${step.metadata.phase}`);
      }
    });
  }

  return chains.length > 0;
}

async function main() {
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   Testing ReAct & ToT Reasoning Persistence to Memo       ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    // Test ToT
    const totSuccess = await testToTPersistence();

    // Test ReAct
    const reactSuccess = await testReActPersistence();

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║   Test Summary                                             ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n   ToT Persistence:    ${totSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   ReAct Persistence:  ${reactSuccess ? '✅ PASS' : '❌ FAIL'}`);

    if (totSuccess && reactSuccess) {
      console.log('\n🎉 All tests passed! Reasoning chains are being persisted to Memo.');
    } else {
      console.log('\n⚠️  Some tests failed. Check the logs above.');
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  }
}

main();
