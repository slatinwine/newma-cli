/**
 * Unit Tests for ReAct Verifier
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ReActVerifier, verifyWithReAct } from '../src/ultrathink/verifier';
import { ExecutionRecord } from '../src/history';
import { Action } from '../src/types';
import { Config } from '../src/config';
import { mockCallAI } from './setup';

// Mock runReActLoop function
const mockRunReActLoop = jest.fn() as any;
jest.mock('../src/ultrathink/react-loop', () => ({
  runReActLoop: () => mockRunReActLoop(),
}));

// Import after mocking
import { runReActLoop } from '../src/ultrathink/react-loop';

// Mock configuration
const mockConfig: Config = {
  apiKey: 'test-key',
  baseUrl: 'https://api.openai.com',
  model: 'gpt-4o-mini',
};

const mockProjectInfo = {
  'src/index.ts': 'console.log("hello");',
  'package.json': '{"name": "test"}',
};

describe('ReActVerifier', () => {
  let verifier: ReActVerifier;

  beforeEach(() => {
    verifier = new ReActVerifier(mockConfig, mockProjectInfo, 'Test requirement');
  });

  describe('Initialization', () => {
    it('should create verifier with config and project info', () => {
      expect(verifier).toBeDefined();
      expect(verifier).toBeInstanceOf(ReActVerifier);
    });

    it('should store requirement', () => {
      expect(verifier['requirement']).toBe('Test requirement');
    });
  });

  describe('Observation Building', () => {
    it('should build observation from empty history', () => {
      const observation = verifier['buildObservationFromHistory']([]);

      expect(observation).toBeDefined();
      expect(observation).toContain('No actions have been executed yet');
    });

    it('should build observation from execution history', () => {
      const history: ExecutionRecord[] = [
        {
          id: '1',
          iteration: 1,
          action: { type: 'create', path: 'test.txt' },
          status: 'success',
          timestamp: new Date(),
          duration: 100,
        },
        {
          id: '2',
          iteration: 1,
          action: { type: 'run', command: 'npm test' },
          status: 'failed',
          timestamp: new Date(),
          duration: 200,
          error: 'Test failed',
        },
      ];

      const observation = verifier['buildObservationFromHistory'](history);

      expect(observation).toBeDefined();
      expect(observation).toContain('EXECUTION SUMMARY');
      expect(observation).toContain('Total iterations: 1');
      expect(observation).toContain('Total actions: 2');
      expect(observation).toContain('Successful actions: 1');
      expect(observation).toContain('Failed actions: 1');
    });

    it('should include statistics in observation', () => {
      const history: ExecutionRecord[] = [
        {
          id: '1',
          iteration: 1,
          action: { type: 'create', path: 'file.txt' },
          status: 'success',
          timestamp: new Date(),
          duration: 150,
        },
      ];

      const observation = verifier['buildObservationFromHistory'](history);

      expect(observation).toContain('STATISTICS');
      expect(observation).toContain('Successful actions: 1');
      expect(observation).toContain('Success rate: 100.0%');
    });
  });

  describe('Action Description', () => {
    it('should describe create action', () => {
      const action: Action = { type: 'create', path: 'test.txt' };
      const desc = verifier['describeAction'](action);

      expect(desc).toContain('Created');
      expect(desc).toContain('test.txt');
    });

    it('should describe modify action', () => {
      const action: Action = { type: 'modify', path: 'app.ts' };
      const desc = verifier['describeAction'](action);

      expect(desc).toContain('Modified');
      expect(desc).toContain('app.ts');
    });

    it('should describe run action', () => {
      const action: Action = { type: 'run', command: 'npm test' };
      const desc = verifier['describeAction'](action);

      expect(desc).toContain('Ran');
      expect(desc).toContain('npm test');
    });
  });

  describe('Verification with ReAct', () => {
    it('should verify requirement with ReAct loop', async () => {
      const history: ExecutionRecord[] = [
        {
          id: '1',
          iteration: 1,
          action: { type: 'create', path: 'file.txt' },
          status: 'success',
          timestamp: new Date(),
          duration: 100,
        },
      ];

      // Mock runReActLoop
      mockRunReActLoop.mockResolvedValue({
        requirement: 'Test requirement',
        steps: [],
        finalState: 'Done',
        success: true,
        totalSteps: 2,
        totalTime: 500,
        reasoning: 'Requirement satisfied',
        metadata: {
          startedAt: Date.now(),
          completedAt: Date.now() + 500,
          maxSteps: 5,
          terminationReason: 'satisfied',
          selfCorrections: 0,
          fallbackPlans: 0,
        },
      });

      const result = await verifier.verifyWithReAct(history, 5);

      expect(result).toBeDefined();
      expect(result.satisfied).toBe(true);
      expect(result.trace).toBeDefined();
      expect(result.reasoning).toBeDefined();
    });

    it('should handle verification failures', async () => {
      const history: ExecutionRecord[] = [];

      mockRunReActLoop.mockResolvedValue({
        requirement: 'Test',
        steps: [],
        finalState: 'Not done',
        success: false,
        totalSteps: 5,
        totalTime: 1000,
        reasoning: 'Max steps reached',
        metadata: {
          startedAt: Date.now(),
          completedAt: Date.now() + 1000,
          maxSteps: 5,
          terminationReason: 'max-steps',
          selfCorrections: 0,
          fallbackPlans: 0,
        },
      });

      const result = await verifier.verifyWithReAct(history, 5);

      expect(result).toBeDefined();
      expect(result.satisfied).toBe(false);
    });
  });

  describe('Auto-fix', () => {
    it('should attempt auto-fix for failures', async () => {
      const trace = {
        requirement: 'Test',
        steps: [
          {
            stepNumber: 1,
            thought: 'Fix this',
            action: { type: 'create' as const, path: 'file.txt' },
            observation: 'Error occurred',
            timestamp: Date.now(),
            success: false,
          },
        ],
        finalState: 'Failed',
        success: false,
        totalSteps: 1,
        totalTime: 100,
        reasoning: 'Has failures',
        metadata: {
          startedAt: Date.now(),
          completedAt: Date.now() + 100,
          maxSteps: 5,
          terminationReason: 'max-steps' as const,
          selfCorrections: 0,
          fallbackPlans: 0,
        },
      };

      const history: ExecutionRecord[] = [];

      const result = await verifier.autoFix(trace, history);

      expect(result).toBeDefined();
      expect(result.fixesApplied).toBeGreaterThanOrEqual(0);
      expect(result.reasoning).toBeDefined();
    });

    it('should return zero fixes if no failures', async () => {
      const trace = {
        requirement: 'Test',
        steps: [],
        finalState: 'Done',
        success: true,
        totalSteps: 0,
        totalTime: 0,
        reasoning: 'No failures',
        metadata: {
          startedAt: Date.now(),
          completedAt: Date.now(),
          maxSteps: 5,
          terminationReason: 'satisfied' as const,
          selfCorrections: 0,
          fallbackPlans: 0,
        },
      };

      const history: ExecutionRecord[] = [];

      const result = await verifier.autoFix(trace, history);

      expect(result.fixesApplied).toBe(0);
      expect(result.reasoning).toContain('No failures detected');
    });
  });
});

describe('verifyWithReAct', () => {
  it('should create verifier and run verification', async () => {
    const history: ExecutionRecord[] = [];

    jest.spyOn(ReActVerifier.prototype, 'verifyWithReAct').mockResolvedValue({
      satisfied: true,
      trace: undefined,
      reasoning: 'All good',
    });

    const result = await verifyWithReAct(
      mockConfig,
      mockProjectInfo,
      'Test requirement',
      history,
      5
    );

    expect(result).toBeDefined();
    expect(result.satisfied).toBeDefined();
    expect(result.reasoning).toBeDefined();
  });
});
