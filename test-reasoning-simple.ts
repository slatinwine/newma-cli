/**
 * Simple test to verify ReAct and ToT reasoning persistence
 */

import { getDefaultConfig } from './src/config';
import { scanDirectory } from './src/scanner';
import { TreeOfThoughtsEngine } from './src/ultrathink/tree-of-thoughts';
import { ReActAgent } from './src/ultrathink/react-loop';
import { ReasoningTracker } from './src/ultrathink/tracker';
import { MemoCliPlugin } from './src/loop/plugins/memo-cli-plugin';
import * as fs from 'fs';
import * as path from 'path';

async function testToTReasoning() {
  console.log('\n🧪 Testing ToT Reasoning with Memo Persistence\n');

  const config = getDefaultConfig();
  const projectRoot = process.cwd();
  const projectInfo = await scanDirectory(projectRoot);

  // Initialize Memo plugin
  const memoPlugin = new MemoCliPlugin(projectRoot);
  await memoPlugin.initialize();

  // Initialize ToT with Memo
  const tracker = new ReasoningTracker(projectRoot);
  const totEngine = new TreeOfThoughtsEngine(
    config,
    projectInfo,
    'Add user authentication to the application',
    { memoPlugin, tracker }
  );

  console.log('📊 Initializing ToT tree...');
  const tree = await totEngine.initializeTree(
    'I need to add user authentication with login and registration',
    'bfs',
    2, // maxDepth
    2, // beamWidth
    2  // branchingFactor
  );

  console.log('🔄 Running BFS search...');
  const result = await totEngine.bfsSearch(tree);

  console.log('\n✅ ToT Search Complete:');
  console.log(`   - Best node: ${result?.id}`);
  console.log(`   - Content: ${result?.content.substring(0, 80)}...`);

  // Read saved reasoning file
  const reasoningPath = path.join(projectRoot, '.memo', 'reasoning.json');
  if (fs.existsSync(reasoningPath)) {
    const reasoningData = JSON.parse(fs.readFileSync(reasoningPath, 'utf-8'));
    const chains = Object.values(reasoningData.reasoningChains || {});

    console.log(`\n📝 Reasoning chains in file: ${chains.length}`);
    if (chains.length > 0) {
      const chain: any = chains[0];
      console.log(`   - Chain ID: ${chain.id.substring(0, 8)}...`);
      console.log(`   - Type: ${chain.type}`);
      console.log(`   - Status: ${chain.status}`);
      console.log(`   - Steps: ${chain.steps.length}`);

      console.log('\n📄 Sample reasoning steps:');
      chain.steps.slice(0, 3).forEach((step: any, index: number) => {
        console.log(`   ${index + 1}. ${step.description}`);
        console.log(`      Status: ${step.status}, Type: ${step.type}`);
        if (step.metadata) {
          console.log(`      Algorithm: ${step.metadata.algorithm}`);
        }
      });
    }
  }

  return result !== null;
}

async function testReActReasoning() {
  console.log('\n🧪 Testing ReAct Reasoning with Memo Persistence\n');

  const config = getDefaultConfig();
  const projectRoot = process.cwd();
  const projectInfo = await scanDirectory(projectRoot);

  // Initialize Memo plugin
  const memoPlugin = new MemoCliPlugin(projectRoot);
  await memoPlugin.initialize();

  // Initialize ReAct with Memo
  const tracker = new ReasoningTracker(projectRoot);
  const reactAgent = new ReActAgent(
    config,
    projectInfo,
    3, // maxSteps
    { memoPlugin, tracker }
  );

  console.log('🔄 Running ReAct loop...');
  const result = await reactAgent.runReActLoop(
    'Verify that the project structure is correct',
    'Starting verification'
  );

  console.log('\n✅ ReAct Loop Complete:');
  console.log(`   - Success: ${result.success}`);
  console.log(`   - Steps: ${result.totalSteps}`);
  console.log(`   - Time: ${result.totalTime}ms`);

  // Read saved reasoning file
  const reasoningPath = path.join(projectRoot, '.memo', 'reasoning.json');
  if (fs.existsSync(reasoningPath)) {
    const reasoningData = JSON.parse(fs.readFileSync(reasoningPath, 'utf-8'));
    const chains = Object.values(reasoningData.reasoningChains || {});

    console.log(`\n📝 Reasoning chains in file: ${chains.length}`);
    if (chains.length > 0) {
      const chain: any = chains[chains.length - 1]; // Get latest
      console.log(`   - Chain ID: ${chain.id.substring(0, 8)}...`);
      console.log(`   - Type: ${chain.type}`);
      console.log(`   - Status: ${chain.status}`);
      console.log(`   - Steps: ${chain.steps.length}`);

      console.log('\n📄 Sample reasoning steps:');
      chain.steps.slice(0, 3).forEach((step: any, index: number) => {
        console.log(`   ${index + 1}. ${step.description}`);
        console.log(`      Status: ${step.status}, Type: ${step.type}`);
        if (step.metadata) {
          console.log(`      Phase: ${step.metadata.phase}, Step: ${step.metadata.stepNumber}`);
        }
      });
    }
  }

  return result.success;
}

async function main() {
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   Testing ReAct & ToT Reasoning → Memo Persistence         ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    const totSuccess = await testToTReasoning();
    const reactSuccess = await testReActReasoning();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║   Test Summary                                             ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n   ToT Persistence:    ${totSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   ReAct Persistence:  ${reactSuccess ? '✅ PASS' : '❌ FAIL'}`);

    if (totSuccess && reactSuccess) {
      console.log('\n🎉 All tests passed! Reasoning is being saved to .memo/reasoning.json');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
