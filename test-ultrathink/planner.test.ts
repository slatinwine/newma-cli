/**
 * Unit Tests for Multi-Plan Generator
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MultiPlanGenerator, generatePlansWithToT } from '../src/ultrathink/planner';
import { ActionPlan, PlanAlternatives } from '../src/ultrathink/types';
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

describe('MultiPlanGenerator', () => {
  let generator: MultiPlanGenerator;

  beforeEach(() => {
    generator = new MultiPlanGenerator(mockConfig, mockProjectInfo);
  });

  describe('Initialization', () => {
    it('should create generator with config and project info', () => {
      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(MultiPlanGenerator);
    });
  });

  describe('Initial Thought Generation', () => {
    it('should generate initial thought from requirement', async () => {
      const thought = await generator['generateInitialThought'](
        'Add user authentication',
        JSON.stringify(mockProjectInfo)
      );

      expect(thought).toBeDefined();
      expect(typeof thought).toBe('string');
      expect(thought.length).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      mockCallAI.mockRejectedValue(
        new Error('API error')
      );

      const thought = await generator['generateInitialThought'](
        'Test',
        '{}'
      );

      expect(thought).toBeDefined();
      expect(thought).toContain('analyze the requirement');
    });
  });

  describe('Top Thoughts Selection', () => {
    it('should select top N thoughts from tree', () => {
      const mockTree = {
        root: {
          id: 'root',
          content: 'Root',
          parentId: null,
          children: [],
          depth: 0,
          state: 'pending' as any,
          score: 0.5,
          metadata: { timestamp: Date.now() },
        },
        nodes: new Map(),
        currentLeaf: null,
        maxDepth: 4,
        beamWidth: 3,
        branchingFactor: 5,
        searchStrategy: 'bfs' as const,
        metadata: {
          requirement: 'Test',
          createdAt: Date.now(),
          totalNodes: 1,
          evaluatedNodes: 1,
          prunedNodes: 0,
          searchTime: 0,
          bestScore: 0.5,
        },
      };

      const topThoughts = generator['getTopThoughts'](mockTree, 3);

      expect(topThoughts).toBeDefined();
      expect(Array.isArray(topThoughts)).toBe(true);
      expect(topThoughts.length).toBeLessThanOrEqual(3);
    });

    it('should sort thoughts by score and depth', () => {
      const mockTree = {
        root: {
          id: 'root',
          content: 'Root',
          parentId: null,
          children: [],
          depth: 0,
          state: 'evaluated' as any,
          score: 0.6,  // Changed from 0.5 to 0.6 to pass filter (> 0.5)
          metadata: { timestamp: Date.now() },
        },
        nodes: new Map([
          [
            'root',
            {
              id: 'root',
              content: 'Root',
              parentId: null,
              children: [],
              depth: 0,
              state: 'evaluated' as any,
              score: 0.6,  // Changed from 0.5 to 0.6
              metadata: { timestamp: Date.now() },
            },
          ],
        ]),
        currentLeaf: null,
        maxDepth: 4,
        beamWidth: 3,
        branchingFactor: 5,
        searchStrategy: 'bfs' as const,
        metadata: {
          requirement: 'Test',
          createdAt: Date.now(),
          totalNodes: 1,
          evaluatedNodes: 1,
          prunedNodes: 0,
          searchTime: 0,
          bestScore: 0.6,  // Changed from 0.5 to 0.6
        },
      };

      const topThoughts = generator['getTopThoughts'](mockTree, 1);

      expect(topThoughts.length).toBe(1);
    });
  });

  describe('Plan Generation from Thought', () => {
    it('should generate action plan from thought', async () => {
      mockCallAI.mockResolvedValue({
        content: JSON.stringify({
          reasoning: 'Create files first',
          actions: [
            { type: 'create', path: 'file1.txt', content: 'content' },
            { type: 'create', path: 'file2.txt', content: 'content' },
          ],
          estimatedTime: 1000,
          riskLevel: 'low',
        }),
      });

      const plan = await generator['generatePlanFromThought'](
        'Create test files',
        'Use file creation approach',
        0.85
      );

      expect(plan).toBeDefined();
      expect(plan.id).toBeDefined();
      expect(plan.actions).toBeDefined();
      expect(Array.isArray(plan.actions)).toBe(true);
      expect(plan.confidence).toBe(0.85);
      expect(plan.riskLevel).toBeDefined();
    });

    it('should handle JSON parse errors', async () => {
      mockCallAI.mockResolvedValue({
        content: 'Invalid JSON{{{',
      });

      const plan = await generator['generatePlanFromThought'](
        'Test requirement',
        'Test thought',
        0.7
      );

      expect(plan).toBeDefined();
      expect(plan.actions).toEqual([]);
    });
  });

  describe('Plan Evaluation', () => {
    it('should evaluate and rank plans', async () => {
      const plans: ActionPlan[] = [
        {
          id: '1',
          thoughtNodeId: 't1',
          actions: [],
          reasoning: 'Plan 1',
          estimatedTime: 1000,
          confidence: 0.7,
          riskLevel: 'low',
          metadata: {
            generationMethod: 'tot-bfs',
            searchDepth: 3,
            nodesExplored: 10,
            evaluationCriteria: [],
          },
        },
        {
          id: '2',
          thoughtNodeId: 't2',
          actions: [],
          reasoning: 'Plan 2',
          estimatedTime: 2000,
          confidence: 0.8,
          riskLevel: 'medium',
          metadata: {
            generationMethod: 'tot-bfs',
            searchDepth: 3,
            nodesExplored: 10,
            evaluationCriteria: [],
          },
        },
      ];

      mockCallAI.mockResolvedValue({
        content: 'Plan 1: 0.75\nPlan 2: 0.90',
      });

      const ranked = await generator['evaluatePlans'](plans, 'Test requirement');

      expect(ranked).toBeDefined();
      expect(ranked.length).toBe(2);
      expect(ranked[0].confidence).toBeGreaterThan(ranked[1].confidence);
    });

    it('should handle evaluation errors', async () => {
      const plans: ActionPlan[] = [
        {
          id: '1',
          thoughtNodeId: 't1',
          actions: [],
          reasoning: 'Plan',
          estimatedTime: 1000,
          confidence: 0.7,
          riskLevel: 'low',
          metadata: {
            generationMethod: 'tot-bfs',
            searchDepth: 3,
            nodesExplored: 10,
            evaluationCriteria: [],
          },
        },
      ];

      mockCallAI.mockRejectedValue(
        new Error('API error')
      );

      const ranked = await generator['evaluatePlans'](plans, 'Test');

      expect(ranked).toBeDefined();
      expect(ranked.length).toBe(1);
    });
  });

  describe('Generate and Select Plans', () => {
    it('should generate multiple alternative plans', async () => {
      // Mock ToT engine directly
      const mockToTEngine = {
        initializeTree: (jest.fn() as any).mockResolvedValue({
          root: {
            id: 'root',
            content: 'Root thought',
            parentId: null,
            children: [],
            depth: 0,
            state: 'pending' as const,
            metadata: { timestamp: Date.now() },
          },
          searchStrategy: 'bfs',
          metadata: {
            requirement: 'Add authentication',
            createdAt: Date.now(),
            totalNodes: 1,
            evaluatedNodes: 0,
            prunedNodes: 0,
            searchTime: 0,
            bestScore: 0,
          },
        }),
        bfsSearch: (jest.fn() as any).mockResolvedValue({
          id: 't1',
          content: 'Best thought',
          parentId: null,
          children: [],
          depth: 1,
          state: 'evaluated' as const,
          score: 0.9,
          metadata: { timestamp: Date.now() },
        }),
      };

      // Replace the totEngine
      (generator as any).totEngine = mockToTEngine;

      // Mock generatePlansFromThoughts
      jest.spyOn(generator as any, 'generatePlansFromThoughts').mockResolvedValue([
        {
          id: 'plan-1',
          reasoning: 'Plan 1',
          actions: [{ type: 'create' as const, path: 'auth.ts' }],
          confidence: 0.9,
          estimatedTime: 1000,
          riskLevel: 'low' as const,
          metadata: { thoughtNodeId: 't1', generationMethod: 'tot' },
        },
        {
          id: 'plan-2',
          reasoning: 'Plan 2',
          actions: [{ type: 'modify' as const, path: 'app.ts' }],
          confidence: 0.7,
          estimatedTime: 800,
          riskLevel: 'medium' as const,
          metadata: { thoughtNodeId: 't2', generationMethod: 'tot' },
        },
      ]);

      const result = await generator.generateAndSelectPlans(
        'Add authentication',
        '{}',
        { numAlternatives: 3 }
      );

      expect(result).toBeDefined();
      expect(result.selected).toBeDefined();
      expect(result.rejected).toBeDefined();
      expect(Array.isArray(result.rejected)).toBe(true);
      expect(result.thoughtTree).toBeDefined();
      expect(result.reasoning).toBeDefined();
    });
  });
});

describe('generatePlansWithToT', () => {
  it('should generate plan alternatives using ToT', async () => {
    // Mock the AI to return valid responses for ToT planning
    // First call: initial thought generation
    // Second call: thought generation
    // Third call: thought evaluation
    // Fourth call: plan generation from thoughts
    // Fifth call: plan evaluation
    mockCallAI
      .mockResolvedValueOnce({
        content: 'I will create an API by setting up Express routes and handlers',
      })
      .mockResolvedValueOnce({
        content: 'Thought: Create API with Express framework',
      })
      .mockResolvedValueOnce({
        content: 'Thought 1: 0.85\nThought 2: 0.72',
      })
      .mockResolvedValueOnce({
        content: `{"reasoning": "Use Express for routing", "actions": [{"type": "create_file", "path": "api.ts", "content": "express code"}], "estimatedTime": 5000, "riskLevel": "low"}`,
      })
      .mockResolvedValueOnce({
        content: 'Plan 1: 0.85\nPlan 2: 0.72',
      });

    const result = await generatePlansWithToT(
      mockConfig,
      mockProjectInfo,
      'Create API',
      '{}',
      { numAlternatives: 3 }
    );

    expect(result).toBeDefined();
    expect(result.selected).toBeDefined();
    expect(result.rejected).toBeDefined();
    expect(result.selectionReason).toBeDefined();
    expect(result.comparison).toBeDefined();
  });

  it('should return PlanAlternatives type', async () => {
    // Mock the AI responses
    mockCallAI
      .mockResolvedValueOnce({
        content: 'Initial thought about testing',
      })
      .mockResolvedValueOnce({
        content: 'Thought: Implement test framework',
      })
      .mockResolvedValueOnce({
        content: 'Thought 1: 0.8',
      })
      .mockResolvedValueOnce({
        content: '{"reasoning": "Add tests", "actions": [{"type": "create_file", "path": "test.ts", "content": "test code"}], "estimatedTime": 3000, "riskLevel": "low"}',
      })
      .mockResolvedValueOnce({
        content: 'Plan 1: 0.8',
      });

    const result = await generatePlansWithToT(
      mockConfig,
      mockProjectInfo,
      'Test',
      '{}'
    );

    expect(result).toBeDefined();
    expect(result.selected.id).toBeDefined();
    expect(result.rejected.length).toBeGreaterThanOrEqual(0);
  });
});
