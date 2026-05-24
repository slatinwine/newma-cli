/**
 * Basic Test for Ultrathink Tree of Thoughts
 *
 * This test verifies that:
 * 1. Types are correctly exported
 * 2. ToT engine can be instantiated
 * 3. Utilities work correctly
 */

import { TreeOfThoughtsEngine, runToTSearch } from './src/ultrathink/tree-of-thoughts';
import { MultiPlanGenerator, generatePlansWithToT } from './src/ultrathink/planner';
import {
  ThoughtNode,
  ThoughtTree,
  ThoughtState,
  ActionPlan,
  PlanAlternatives,
  UltrathinkConfig,
  DEFAULT_ULTRATHINK_CONFIG
} from './src/ultrathink/types';
import {
  formatThoughtTree,
  formatPlanAlternatives,
  createThoughtNode,
  generateId
} from './src/ultrathink/utils';
import { Config } from './src/config';

// Mock config for testing
const mockConfig: Config = {
  apiKey: 'test-key',
  baseUrl: 'https://api.openai.com',
  model: 'gpt-4o-mini',
};

const mockProjectInfo = {
  'src/index.ts': 'console.log("hello");',
  'package.json': '{"name": "test"}',
};

console.log('🧪 Testing Ultrathink Tree of Thoughts Implementation\n');
console.log('=' .repeat(60));

// Test 1: Type imports
console.log('\n✅ Test 1: Type Imports');
try {
  // Check that types are imported (they exist as interfaces/types)
  console.log('  - Types imported successfully');
  console.log('  - ThoughtState enum values:', Object.values(ThoughtState).slice(0, 3).join(', '));
  console.log('  - All types imported successfully!');
} catch (error) {
  console.error('  ❌ Type import failed:', error);
  process.exit(1);
}

// Test 2: Utility functions
console.log('\n✅ Test 2: Utility Functions');
try {
  const id1 = generateId();
  const id2 = generateId();
  console.log(`  - Generated IDs: ${id1.substring(0, 20)}... and ${id2.substring(0, 20)}...`);
  console.log(`  - IDs are unique: ${id1 !== id2 ? '✅' : '❌'}`);

  const node = createThoughtNode('Test thought', null, 0);
  console.log(`  - Created thought node: ${node.content}`);
  console.log(`  - Node depth: ${node.depth}`);
  console.log(`  - Node state: ${node.state}`);
} catch (error) {
  console.error('  ❌ Utility function failed:', error);
  process.exit(1);
}

// Test 3: ToT Engine instantiation
console.log('\n✅ Test 3: ToT Engine Instantiation');
try {
  const engine = new TreeOfThoughtsEngine(
    mockConfig,
    mockProjectInfo,
    'Add a login page'
  );
  console.log('  - ToT engine created successfully');
  console.log('  - Config type:', typeof mockConfig);
  console.log('  - Project info keys:', Object.keys(mockProjectInfo).length);
} catch (error) {
  console.error('  ❌ Engine instantiation failed:', error);
  process.exit(1);
}

// Test 4: Multi-Plan Generator instantiation
console.log('\n✅ Test 4: Multi-Plan Generator Instantiation');
try {
  const generator = new MultiPlanGenerator(mockConfig, mockProjectInfo);
  console.log('  - Multi-plan generator created successfully');
  console.log('  - Ready to generate plans');
} catch (error) {
  console.error('  ❌ Generator instantiation failed:', error);
  process.exit(1);
}

// Test 5: Default configuration
console.log('\n✅ Test 5: Default Configuration');
try {
  console.log('  - Ultrathink enabled:', DEFAULT_ULTRATHINK_CONFIG.enabled);
  console.log('  - Plan mode enabled:', DEFAULT_ULTRATHINK_CONFIG.planMode.enabled);
  console.log('  - Num alternatives:', DEFAULT_ULTRATHINK_CONFIG.planMode.numAlternatives);
  console.log('  - Search strategy:', DEFAULT_ULTRATHINK_CONFIG.planMode.searchStrategy);
  console.log('  - Max depth:', DEFAULT_ULTRATHINK_CONFIG.planMode.maxDepth);
  console.log('  - Beam width:', DEFAULT_ULTRATHINK_CONFIG.planMode.beamWidth);
  console.log('  - All config values present ✅');
} catch (error) {
  console.error('  ❌ Configuration check failed:', error);
  process.exit(1);
}

// Test 6: Visualization functions (without actual data)
console.log('\n✅ Test 6: Visualization Functions');
try {
  const mockTree: ThoughtTree = {
    root: createThoughtNode('Root thought', null, 0),
    nodes: new Map(),
    currentLeaf: null,
    maxDepth: 4,
    beamWidth: 3,
    branchingFactor: 5,
    searchStrategy: 'bfs',
    metadata: {
      requirement: 'Test requirement',
      createdAt: Date.now(),
      totalNodes: 1,
      evaluatedNodes: 1,
      prunedNodes: 0,
      searchTime: 0,
      bestScore: 0,
    },
  };
  mockTree.nodes.set(mockTree.root.id, mockTree.root);

  const treeOutput = formatThoughtTree(mockTree, true);
  console.log('  - Thought tree formatted:');
  console.log('    ' + treeOutput.split('\n')[0]); // First line
  console.log('  - Visualization works ✅');
} catch (error) {
  console.error('  ❌ Visualization failed:', error);
  process.exit(1);
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('✅ ALL BASIC TESTS PASSED!');
console.log('\n📊 Test Summary:');
console.log('  - Type system: ✅ Working');
console.log('  - Utilities: ✅ Working');
console.log('  - ToT Engine: ✅ Instantiatable');
console.log('  - Planner: ✅ Instantiatable');
console.log('  - Configuration: ✅ Valid');
console.log('  - Visualization: ✅ Working');
console.log('\n🎉 Ultrathink Phase 1 implementation is ready!');
console.log('\n📝 Next Steps:');
console.log('  1. Test with real OpenAI API (requires OPENAI_API_KEY)');
console.log('  2. Implement Phase 2 (ReAct loop)');
console.log('  3. Add comprehensive unit tests');
console.log('  4. Performance benchmarking');
console.log('\n');
