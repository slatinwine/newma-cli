/**
 * Phase 1 Component Tests
 *
 * Tests for:
 * - ReasoningTracker
 * - ReasoningSerializer
 * - ProjectContextCache
 * - AdaptiveContextManager
 */

import { ReasoningTracker, TrackedEventType } from '../src/ultrathink/tracker';
import { ReasoningSerializer } from '../src/ultrathink/serializer';
import { ProjectContextCache } from '../src/ultrathink/cache';
import { AdaptiveContextManager, ComplexityLevel } from '../src/ultrathink/context-manager';
import { ThoughtNode, ThoughtState } from '../src/ultrathink/types';
import { Action } from '../src/types';
import { Config } from '../src/config';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProjectInfo: Record<string, string> = {
  'src/index.ts': `
import express from 'express';
const app = express();
app.listen(3000);
`.trim(),
  'package.json': `
{
  "name": "test-project",
  "version": "1.0.0"
}
`.trim(),
  'README.md': `
# Test Project
This is a test project.
`.trim(),
};

const mockThought: ThoughtNode = {
  id: 'thought-1',
  content: 'We should create an Express server',
  parentId: null,
  children: [],
  depth: 0,
  score: 0.85,
  state: ThoughtState.EVALUATED,
  metadata: {
    timestamp: Date.now(),
    evaluationMethod: 'llm',
    evaluationReasoning: 'Good approach',
  },
};

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

async function testTracker() {
  console.log('\n🧪 Testing ReasoningTracker...');

  const tracker = new ReasoningTracker('./test-output');

  // Test event tracking
  tracker.trackEvent(TrackedEventType.STAGE_START, {
    stageName: 'planning',
  });

  // Test thought tracking
  tracker.trackThoughtGenerated(mockThought, 100);
  tracker.trackThoughtEvaluated(
    'thought-1',
    0.85,
    'Good approach',
    'llm',
    150
  );

  // Test plan tracking
  const mockPlan: any = {
    id: 'plan-1',
    thoughtNodeId: 'thought-1',
    actions: [],
    reasoning: 'Test plan',
    estimatedTime: 1000,
    confidence: 0.9,
    riskLevel: 'low',
    metadata: {},
  };
  tracker.trackPlanGenerated(mockPlan, 200);
  tracker.trackPlanEvaluated('plan-1', 0.9, 'Excellent plan', 'quick', 100);

  // Test ReAct tracking
  tracker.trackReActThink(1, 'I should test this', 50, 1000);
  tracker.trackReActAct(1, { type: 'create', path: '/test', content: '' }, 100);
  tracker.trackReActObserve(1, 'File created successfully');

  // Test API call tracking
  tracker.trackAPICall({
    timestamp: Date.now(),
    endpoint: 'chat/completions',
    stage: 'planning',
    promptTokens: 1000,
    completionTokens: 500,
    totalTokens: 1500,
    latency: 1000,
    cached: false,
    metadata: {
      model: 'gpt-4',
      function: 'generateThoughts',
    },
  });

  tracker.endStage('planning');

  // Get tracked data
  const data = tracker.getTrackedData();

  console.log('✅ Events tracked:', data.events.length);
  console.log('✅ Thoughts tracked:', data.thoughts.length);
  console.log('✅ Plans tracked:', data.plans.length);
  console.log('✅ API calls tracked:', data.apiCalls.length);
  console.log('✅ Stages completed:', data.stages.length);

  // Save to file
  await tracker.save();
  console.log('✅ Saved to:', tracker.getSessionId());

  return data;
}

async function testSerializer(trackedData: any) {
  console.log('\n🧪 Testing ReasoningSerializer...');

  const serializer = new ReasoningSerializer(trackedData, './test-output');

  // Export all reports
  const files = await serializer.exportAll();

  console.log('✅ JSON saved:', files.json);
  console.log('✅ Summary MD saved:', files.summaryMd);
  console.log('✅ Thought Tree MD saved:', files.thoughtTreeMd);
  console.log('✅ Plans MD saved:', files.plansMd);
  console.log('✅ ReAct Trace MD saved:', files.reactTraceMd);
  console.log('✅ Performance MD saved:', files.performanceMd);

  return files;
}

async function testCache() {
  console.log('\n🧪 Testing ProjectContextCache...');

  const mockConfig = {} as Config;
  const cache = new ProjectContextCache(mockConfig);

  // Test cache creation
  const { entry, isNew } = await cache.getOrCreate(mockProjectInfo);

  console.log('✅ Cache entry created:', isNew);
  console.log('✅ Project hash:', entry.hash);
  console.log('✅ Summary files:', entry.summary.totalFiles);
  console.log('✅ Summary languages:', entry.summary.languages);

  // Test summary formatting
  const summary = await cache.getSummary(mockProjectInfo);
  const formatted = cache.formatSummaryForPrompt(summary);

  console.log('✅ Summary formatted (length):', formatted.length);
  console.log('✅ Summary preview:', formatted.substring(0, 200) + '...');

  // Test cache stats
  const stats = cache.getStats();
  console.log('✅ Cache stats:', stats);

  return { cache, summary, formatted };
}

async function testContextManager() {
  console.log('\n🧪 Testing AdaptiveContextManager...');

  const manager = new AdaptiveContextManager();

  // Test complexity assessment
  const simpleReq = 'Add a button';
  const mediumReq = 'Create a login page with form validation';
  const complexReq = 'Design a microservices architecture with API gateway, authentication, and database sharding';

  const simpleComplexity = manager.assessComplexity(simpleReq);
  const mediumComplexity = manager.assessComplexity(mediumReq);
  const complexComplexity = manager.assessComplexity(complexReq);

  console.log('✅ Simple requirement complexity:', simpleComplexity);
  console.log('✅ Medium requirement complexity:', mediumComplexity);
  console.log('✅ Complex requirement complexity:', complexComplexity);

  // Test context building for thoughts
  const thoughts = [mockThought];
  const allThoughts = new Map<string, ThoughtNode>([['thought-1', mockThought]]);

  const thoughtContext = manager.buildThoughtEvaluationContext(
    thoughts,
    allThoughts,
    'Add a button',
    simpleComplexity
  );

  console.log('✅ Thought context size:', thoughtContext.estimatedTokens, 'tokens');
  console.log('✅ Batch size:', thoughtContext.batchSize);

  // Test ReAct context
  const reactSteps = [
    {
      thought: 'I should create a file',
      action: { type: 'create', path: '/test' },
      observation: 'Success',
    },
    {
      thought: 'Now I should test it',
      action: { type: 'run', command: 'npm test' },
      observation: 'Tests passed',
    },
  ];

  const reactContext = manager.buildReActContext(
    2,
    reactSteps,
    'Run tests',
    mediumComplexity
  );

  console.log('✅ ReAct context size:', reactContext.estimatedTokens, 'tokens');
  console.log('✅ Window size:', reactContext.windowSize);

  return { manager, simpleComplexity, complexComplexity };
}

// ============================================================================
// INTEGRATION TEST
// ============================================================================

async function testIntegration() {
  console.log('\n🧪 Testing Integration (All Components Together)...');

  // Create tracker
  const tracker = new ReasoningTracker('./test-output/integration');

  // Create cache
  const cache = new ProjectContextCache({} as Config);
  const { entry } = await cache.getOrCreate(mockProjectInfo);
  const summary = entry.summary;

  // Create context manager
  const contextManager = new AdaptiveContextManager();
  const complexity = contextManager.assessComplexity('Create an API server');

  console.log('✅ Complexity assessed:', complexity);

  // Track with adaptive context
  tracker.startStage('planning');

  tracker.trackThoughtGenerated(mockThought, 100);

  // Use context manager to build evaluation context
  const thoughtContext = contextManager.buildThoughtEvaluationContext(
    [mockThought],
    new Map([['thought-1', mockThought]]),
    'Create an API server',
    complexity
  );

  tracker.trackThoughtEvaluated(
    'thought-1',
    0.85,
    'Good approach',
    'llm',
    150,
    { batchSize: thoughtContext.batchSize, batchIndex: 0 }
  );

  tracker.trackAPICall({
    timestamp: Date.now(),
    endpoint: 'chat/completions',
    stage: 'planning',
    promptTokens: thoughtContext.estimatedTokens,
    completionTokens: 500,
    totalTokens: thoughtContext.estimatedTokens + 500,
    latency: 1000,
    cached: false,
    metadata: {
      model: 'gpt-4',
      function: 'evaluateThoughts',
    },
  });

  tracker.endStage('planning');

  // Get data and serialize
  const data = tracker.getTrackedData();
  const serializer = new ReasoningSerializer(data, './test-output/integration');
  await serializer.exportAll();

  console.log('✅ Integration test completed!');
  console.log('✅ Session ID:', tracker.getSessionId());
  console.log('✅ Reports saved to: ./test-output/integration');

  // Display summary
  console.log('\n📊 Session Summary:');
  console.log('  - Total API Calls:', data.summary.totalApiCalls);
  console.log('  - Total Tokens:', data.summary.totalTokens);
  console.log('  - Thoughts Generated:', data.summary.thoughtsGenerated);
  console.log('  - Duration:', data.summary.totalDuration, 'ms');
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.log('🚀 Starting Phase 1 Component Tests\n');
  console.log('=' .repeat(60));

  try {
    // Test individual components
    const trackedData = await testTracker();
    await testSerializer(trackedData);
    await testCache();
    await testContextManager();

    // Test integration
    await testIntegration();

    console.log('\n' + '='.repeat(60));
    console.log('✅ All Phase 1 tests passed!');
    console.log('\n📁 Generated files:');
    console.log('  - ./test-output/reasoning-trace.json');
    console.log('  - ./test-output/*.md (multiple reports)');
    console.log('  - ./test-output/integration/* (integration test)');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests();
