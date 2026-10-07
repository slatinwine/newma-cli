/**
 * 动态重派测试：任务失败时轮换到另一个具备同等能力的 agent 重试
 * （ultrathink MultiAgentConfig.dynamicReassignment 的落地行为）
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { AgentCoordinator } from '../src/agents/coordinator';
import type { Agent, AgentTask, AgentResult } from '../src/agents/types';

function makeStubAgent(
  id: string,
  behavior: (call: number) => Partial<AgentResult> & { success: boolean }
): Agent & { calls: number } {
  return {
    id,
    name: `Stub-${id}`,
    description: `stub ${id}`,
    capabilities: ['frontend'] as any,
    status: 'idle' as any,
    calls: 0,
    canHandle: () => true,
    async process(task: AgentTask): Promise<AgentResult> {
      const self = this as any;
      self.calls++;
      return {
        agentId: id,
        taskId: task.id,
        output: `${id}-attempt-${self.calls}`,
        ...behavior(self.calls),
      };
    },
  } as any;
}

const tempDirs: string[] = [];

function makeCoordinator(): AgentCoordinator {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'newma-agent-'));
  tempDirs.push(dir);
  const coordinator = new AgentCoordinator(
    {} as any, // toolExecutor（stub agents 不使用）
    {} as any, // tracker
    {} as any, // rollbackManager
    {} as any, // config
    dir
  );
  return coordinator;
}

const task: AgentTask = {
  id: 't1',
  description: 'build the login form',
  capabilities: ['frontend'] as any,
  priority: 'high',
  dependencies: [],
  status: 'pending',
} as any;

const plan = (t: AgentTask) =>
  ({
    tasks: [t],
    taskGraph: [],
    executionOrder: [['t1']],
    estimatedIterations: 1,
  } as any);

describe('🔁 动态重派（dynamicReassignment）', () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('首个 agent 失败 → 轮换到备用 agent 成功', async () => {
    const coordinator = makeCoordinator();

    // 覆盖默认 agent（同 id 替换，保持 Map 顺序：frontend 先于 backend）
    const failing = makeStubAgent('frontend-agent', () => ({ success: false, error: 'boom' }));
    const succeeding = makeStubAgent('backend-agent', () => ({ success: true }));
    coordinator.registerAgent(failing);
    coordinator.registerAgent(succeeding);

    const results = await coordinator.executePlan(plan(task), 'req', {
      maxRetries: 1,
      dynamicReassignment: true,
    });

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].agentId).toBe('backend-agent'); // 重派到了备用 agent
    expect(failing.calls).toBe(1);
    expect(succeeding.calls).toBe(1);
    expect(task.assignedTo).toBe('backend-agent');
  });

  test('maxRetries=0 保持旧行为：失败即失败，不重派', async () => {
    const coordinator = makeCoordinator();
    const failing = makeStubAgent('frontend-agent', () => ({ success: false, error: 'boom' }));
    const unused = makeStubAgent('backend-agent', () => ({ success: true }));
    coordinator.registerAgent(failing);
    coordinator.registerAgent(unused);

    const results = await coordinator.executePlan(plan(task), 'req', {
      maxRetries: 0,
    });

    expect(results[0].success).toBe(false);
    expect(failing.calls).toBe(1);
    expect(unused.calls).toBe(0); // 未重派
  });

  test('瞬时故障：同一 agent 第一次失败重试后成功', async () => {
    const coordinator = makeCoordinator();
    const flaky = makeStubAgent('frontend-agent', (call) => ({
      success: call >= 2, // 第一次失败，重试成功
    }));
    const unused = makeStubAgent('backend-agent', () => ({ success: true }));
    coordinator.registerAgent(flaky);
    coordinator.registerAgent(unused);

    const results = await coordinator.executePlan(plan(task), 'req', {
      maxRetries: 1,
      dynamicReassignment: false, // 关闭轮换：始终用原 agent 重试
    });

    expect(results[0].success).toBe(true);
    expect(flaky.calls).toBe(2);
    expect(unused.calls).toBe(0); // 未轮换
  });
});
