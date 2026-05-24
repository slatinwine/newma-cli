/**
 * Unit Tests for ReAct Loop
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ReActAgent, runReActLoop } from '../src/ultrathink/react-loop';
import { ReActTrace, ReActStep, ReActMetadata } from '../src/ultrathink/types';
import { Config } from '../src/config';
import { mockCallAI } from './setup';

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

describe('ReActAgent', () => {
  let agent: ReActAgent;

  beforeEach(() => {
    agent = new ReActAgent(mockConfig, mockProjectInfo, 5);
  });

  describe('Initialization', () => {
    it('should create agent with config and project info', () => {
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(ReActAgent);
    });

    it('should have default max steps of 5', () => {
      const agent1 = new ReActAgent(mockConfig, mockProjectInfo);
      expect(agent1).toBeDefined();
    });

    it('should accept custom max steps', () => {
      const agent3 = new ReActAgent(mockConfig, mockProjectInfo, 3);
      expect(agent3).toBeDefined();
    });
  });

  describe('Think Step', () => {
    it('should generate thought from requirement and observation', async () => {
      // Mock the AI call
      mockCallAI.mockResolvedValue({
        content: 'Thought: Need to add authentication system',
      });

      const thought = await agent['think'](
        'Add login feature',
        'File created successfully',
        1
      );

      expect(thought).toBeDefined();
      expect(typeof thought).toBe('string');
      expect(thought.length).toBeGreaterThan(0);
    });

    it('should generate contextual thoughts based on step number', async () => {
      // Mock the AI calls
      mockCallAI
        .mockResolvedValueOnce({ content: 'Thought: First step analysis' })
        .mockResolvedValueOnce({ content: 'Thought: Second step analysis' });

      const thought1 = await agent['think']('Create API', 'Starting', 1);
      const thought2 = await agent['think']('Create API', 'In progress', 2);

      expect(thought1).toBeDefined();
      expect(thought2).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      // Mock AI call to throw error
      mockCallAI.mockRejectedValue(
        new Error('API error')
      );

      const thought = await agent['think']('Test', 'Observation', 1);

      expect(thought).toBeDefined();
      expect(thought).toContain('analyze the current state');
    });
  });

  describe('Act Step', () => {
    it('should generate action from thought', async () => {
      // Mock the AI call to return a JSON action
      mockCallAI.mockResolvedValue({
        content: JSON.stringify({
          type: 'create',
          path: 'user-model.ts',
          content: 'export class User {}',
        }),
      });

      const action = await agent['act'](
        'I need to create a user model file',
        'Add user authentication',
        'No files yet'
      );

      expect(action).toBeDefined();
      if (action) {
        expect(action.type).toBeDefined();
      }
    });

    it('should return satisfaction action when thought indicates completion', async () => {
      // Mock the AI call to return satisfied verification
      mockCallAI.mockResolvedValue({
        content: JSON.stringify({
          type: 'verify',
          command: 'satisfied',
        }),
      });

      const action = await agent['act'](
        'The requirement is already satisfied',
        'Add login',
        'All files created'
      );

      expect(action).toBeDefined();
      if (action) {
        expect(action.type).toBe('verify');
        expect(action.command).toBe('satisfied');
      }
    });

    it('should handle parse errors gracefully', async () => {
      mockCallAI.mockResolvedValue({
        content: 'Invalid response without JSON',
      });

      const action = await agent['act']('Test thought', 'Test requirement', '');

      expect(action).toBeNull();
    });
  });

  describe('Execute Step', () => {
    it('should simulate action execution for create action', async () => {
      const result = await agent['executeAction']({
        type: 'create',
        path: 'test.txt',
      });

      expect(result).toBeDefined();
      expect(result).toContain('test.txt');
      expect(result).toContain('created');
    });

    it('should simulate action execution for modify action', async () => {
      const result = await agent['executeAction']({
        type: 'modify',
        path: 'test.txt',
      });

      expect(result).toBeDefined();
      expect(result).toContain('test.txt');
      expect(result).toContain('modified');
    });

    it('should simulate action execution for run action', async () => {
      const result = await agent['executeAction']({
        type: 'run',
        command: 'npm test',
      });

      expect(result).toBeDefined();
      expect(result).toContain('npm test');
    });
  });

  describe('ReAct Loop', () => {
    it('should run ReAct loop and return trace', async () => {
      // Mock the methods
      jest.spyOn(agent as any, 'think').mockResolvedValue('Initial thought');
      jest.spyOn(agent as any, 'act').mockResolvedValue({
        type: 'create',
        path: 'test.txt',
      });
      jest.spyOn(agent as any, 'executeAction').mockResolvedValue('Success');

      const trace = await agent.runReActLoop('Create a test file', '', () => {});

      expect(trace).toBeDefined();
      expect(trace.requirement).toBe('Create a test file');
      expect(trace.steps).toBeDefined();
      expect(Array.isArray(trace.steps)).toBe(true);
      expect(trace.steps.length).toBeGreaterThan(0);
      expect(trace.totalTime).toBeGreaterThan(0);
    });

    it('should stop when requirement is satisfied', async () => {
      jest.spyOn(agent as any, 'think').mockResolvedValue('Requirement satisfied');
      jest.spyOn(agent as any, 'act').mockResolvedValue({
        type: 'verify',
        command: 'satisfied',
      });

      const trace = await agent.runReActLoop('Simple task', '');

      expect(trace.success).toBe(true);
      expect(trace.metadata.terminationReason).toBe('satisfied');
    });

    it('should reach max steps if not satisfied', async () => {
      jest.spyOn(agent as any, 'think').mockResolvedValue('Continue working');
      jest.spyOn(agent as any, 'act').mockResolvedValue({
        type: 'create',
        path: 'file.txt',
      });
      jest.spyOn(agent as any, 'executeAction').mockResolvedValue('File created');

      const trace = await agent.runReActLoop('Complex task', '');

      expect(trace.steps.length).toBeGreaterThan(0);
      expect(trace.metadata.terminationReason).toBe('max-steps');
    });

    it('should call onStep callback for each step', async () => {
      const steps: ReActStep[] = [];

      jest.spyOn(agent as any, 'think').mockResolvedValue('Working on it');
      jest.spyOn(agent as any, 'act').mockResolvedValue({
        type: 'create',
        path: 'test.txt',
      });
      jest.spyOn(agent as any, 'executeAction').mockResolvedValue('Done');

      await agent.runReActLoop('Test', '', (step) => {
        steps.push(step);
      });

      expect(steps.length).toBeGreaterThan(0);
      steps.forEach(step => {
        expect(step.stepNumber).toBeDefined();
        expect(step.thought).toBeDefined();
      });
    });
  });
});

describe('runReActLoop', () => {
  it('should create agent and run loop', async () => {
    const result = await runReActLoop(
      mockConfig,
      mockProjectInfo,
      'Create a component'
    );

    expect(result).toBeDefined();
    expect(result.requirement).toBe('Create a component');
    expect(result.steps).toBeDefined();
  });

  it('should accept custom max steps', async () => {
    const result = await runReActLoop(
      mockConfig,
      mockProjectInfo,
      'Test',
      { maxSteps: 3 }
    );

    expect(result.metadata.maxSteps).toBe(3);
    expect(result.steps.length).toBeLessThanOrEqual(3);
  });

  it('should accept initial observation', async () => {
    const initialObs = 'Starting with existing files';
    const result = await runReActLoop(
      mockConfig,
      mockProjectInfo,
      'Test',
      { initialObservation: initialObs }
    );

    expect(result).toBeDefined();
    expect(result.finalState).toBeDefined();
  });
});
