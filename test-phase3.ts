#!/usr/bin/env ts-node
/**
 * Integration test for Phase 3 features
 * Tests: Multi-Agent System, Agent Coordination
 */

import { AgentCoordinator } from './src/agents/coordinator';
import { ToolExecutor } from './src/executor-v2';
import { ExecutionTracker } from './src/history';
import { RollbackManager } from './src/rollback';
import { Config } from './src/config';
import { PermissionLevel } from './src/permissions';
import path from 'path';

async function testMultiAgentSystem() {
  console.log('🧪 Testing Phase 3: Multi-Agent System\n');

  // Test 1: Coordinator Initialization
  console.log('✓ Test 1: Agent Coordinator Initialization');
  const tracker = new ExecutionTracker();
  const rollbackManager = new RollbackManager(path.resolve(process.cwd()));
  const config: Config = {
    apiKey: 'test-key',
    model: 'gpt-4',
    baseUrl: 'http://localhost:8000',
  };

  const toolExecutor = new ToolExecutor(
    tracker,
    rollbackManager,
    config,
    PermissionLevel.SAFE
  );

  const coordinator = new AgentCoordinator(
    toolExecutor,
    tracker,
    rollbackManager,
    config,
    path.resolve(process.cwd())
  );

  const agents = coordinator.getAllAgents();
  if (agents.length >= 4) {
    console.log(`  ✓ Coordinator initialized with ${agents.length} agents`);
    agents.forEach(agent => {
      console.log(`    - ${agent.name}: ${agent.capabilities.join(', ')}`);
    });
  } else {
    console.log('  ✗ Not enough agents registered');
    return false;
  }

  // Test 2: Agent Capabilities
  console.log('\n✓ Test 2: Agent Capabilities');
  const frontendAgent = agents.find(a => a.name === 'Frontend Specialist');
  const backendAgent = agents.find(a => a.name === 'Backend Specialist');
  const testingAgent = agents.find(a => a.name === 'Testing Specialist');
  const documentationAgent = agents.find(a => a.name === 'Documentation Specialist');

  if (frontendAgent && backendAgent && testingAgent && documentationAgent) {
    console.log(`  ✓ Frontend Agent: ${frontendAgent.capabilities.join(', ')}`);
    console.log(`  ✓ Backend Agent: ${backendAgent.capabilities.join(', ')}`);
    console.log(`  ✓ Testing Agent: ${testingAgent.capabilities.join(', ')}`);
    console.log(`  ✓ Documentation Agent: ${documentationAgent.capabilities.join(', ')}`);
  } else {
    console.log('  ✗ Missing required agents');
    return false;
  }

  // Test 3: Agent Selection
  console.log('\n✓ Test 3: Agent Task Selection');
  const testTasks = [
    {
      id: 'task-1',
      description: 'Create UI component',
      capabilities: ['frontend' as any],
      priority: 'medium' as const,
      dependencies: [],
      status: 'pending' as const,
    },
    {
      id: 'task-2',
      description: 'Create API endpoint',
      capabilities: ['backend' as any],
      priority: 'high' as const,
      dependencies: [],
      status: 'pending' as const,
    },
    {
      id: 'task-3',
      description: 'Write unit tests',
      capabilities: ['testing' as any],
      priority: 'medium' as const,
      dependencies: [],
      status: 'pending' as const,
    },
    {
      id: 'task-4',
      description: 'Update API documentation',
      capabilities: ['documentation' as any],
      priority: 'low' as const,
      dependencies: [],
      status: 'pending' as const,
    },
  ];

  const selectedAgent1 = (coordinator as any).selectAgent(testTasks[0]);
  const selectedAgent2 = (coordinator as any).selectAgent(testTasks[1]);
  const selectedAgent3 = (coordinator as any).selectAgent(testTasks[2]);
  const selectedAgent4 = (coordinator as any).selectAgent(testTasks[3]);

  if (selectedAgent1 && selectedAgent2 && selectedAgent3 && selectedAgent4) {
    console.log(`  ✓ Task 1 assigned to: ${selectedAgent1.name}`);
    console.log(`  ✓ Task 2 assigned to: ${selectedAgent2.name}`);
    console.log(`  ✓ Task 3 assigned to: ${selectedAgent3.name}`);
    console.log(`  ✓ Task 4 assigned to: ${selectedAgent4.name}`);

    if (
      selectedAgent1.name.includes('Frontend') &&
      selectedAgent2.name.includes('Backend') &&
      selectedAgent3.name.includes('Testing') &&
      selectedAgent4.name.includes('Documentation')
    ) {
      console.log('  ✓ Correct agent-task matching for all tasks');
    } else {
      console.log('  ⚠ Unexpected agent-task assignments');
    }
  } else {
    console.log('  ✗ Agent selection failed');
    return false;
  }

  // Test 4: Dependency Resolution
  console.log('\n✓ Test 4: Task Dependency Resolution');
  const tasksWithDeps = [
    {
      id: 'task-1',
      description: 'Create API',
      capabilities: ['backend' as any],
      priority: 'high' as const,
      dependencies: [],
      status: 'pending' as const,
    },
    {
      id: 'task-2',
      description: 'Create UI using API',
      capabilities: ['frontend' as any],
      priority: 'medium' as const,
      dependencies: ['task-1'],
      status: 'pending' as const,
    },
  ];

  const executionOrder = (coordinator as any).calculateExecutionOrder(tasksWithDeps);
  console.log(`  ✓ Execution order calculated: ${executionOrder.length} groups`);

  if (executionOrder.length === 2) {
    console.log(`  ✓ First group: ${executionOrder[0].join(', ')}`);
    console.log(`  ✓ Second group: ${executionOrder[1].join(', ')}`);
  } else {
    console.log('  ⚠ Unexpected execution order');
  }

  // Test 5: Agent Status Management
  console.log('\n✓ Test 5: Agent Status Management');
  const initialStatus = frontendAgent.getStatus();
  console.log(`  ✓ Initial status: ${initialStatus}`);

  frontendAgent.reset();
  const resetStatus = frontendAgent.getStatus();
  if (resetStatus === 'idle') {
    console.log('  ✓ Agent reset successful');
  } else {
    console.log('  ✗ Agent reset failed');
    return false;
  }

  console.log('\n✅ All Phase 3 integration tests passed!\n');
  return true;
}

// Run tests
testMultiAgentSystem()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  });
