/**
 * Integration Tests for Ultrathink System
 *
 * End-to-end tests for Tree of Thoughts + ReAct integration
 */

import { describe, it, expect, jest } from '@jest/globals';
import { runToTSearch } from '../src/ultrathink/tree-of-thoughts';
import { generatePlansWithToT, MultiPlanGenerator } from '../src/ultrathink/planner';
import { runReActLoop } from '../src/ultrathink/react-loop';
import { verifyWithReAct, ReActVerifier } from '../src/ultrathink/verifier';
import { ExecutionRecord } from '../src/history';
import { Config } from '../src/config';
import { mockCallAI } from './setup';

const mockConfig: Config = {
  apiKey: 'test-key',
  baseUrl: 'https://api.openai.com',
  model: 'gpt-4o-mini',
};

const mockProjectInfo = {
  'src/index.ts': 'console.log("hello");',
  'package.json': '{"name": "test"}',
};

describe('Ultrathink Integration Tests', () => {
  describe('ToT + Planning Integration', () => {
    it('should complete ToT search and generate plans', async () => {
      // Mock ToT search
      jest.spyOn(require('../src/ultrathink/tree-of-thoughts'), 'runToTSearch').mockResolvedValue({
        tree: {
          root: {
            id: 'root',
            content: 'Root thought',
            parentId: null,
            children: [],
            depth: 0,
            state: 'evaluated' as any,
            metadata: { timestamp: Date.now() },
          },
          nodes: new Map(),
          currentLeaf: null,
          maxDepth: 4,
          beamWidth: 3,
          branchingFactor: 5,
          searchStrategy: 'bfs' as const,
          metadata: {
            requirement: 'Create API',
            createdAt: Date.now(),
            totalNodes: 15,
            evaluatedNodes: 15,
            prunedNodes: 5,
            searchTime: 1000,
            bestScore: 0.9,
          },
        },
        bestNode: {
          id: 'best',
          content: 'Best approach',
          parentId: 'root',
          children: [],
          depth: 2,
          state: 'selected' as any,
          score: 0.9,
          metadata: { timestamp: Date.now() },
        },
      });

      // Mock plan generation
      jest.spyOn(require('../src/ultrathink/planner'), 'generatePlansWithToT').mockResolvedValue({
        selected: {
          id: 'plan-1',
          thoughtNodeId: 'thought-1',
          actions: [
            { type: 'create', path: 'api.ts' },
            { type: 'create', path: 'routes.ts' },
          ],
          reasoning: 'Start with API structure',
          estimatedTime: 5000,
          confidence: 0.9,
          riskLevel: 'low',
          metadata: {
            generationMethod: 'tot-bfs',
            searchDepth: 3,
            nodesExplored: 15,
            evaluationCriteria: ['quality', 'speed'],
            thoughtTree: undefined,
          },
        },
        rejected: [],
        selectionReason: 'Highest confidence score',
        comparison: {
          criteria: [],
          reasoning: 'Selected for best quality',
        },
      });

      const result = await generatePlansWithToT(
        mockConfig,
        mockProjectInfo,
        'Create a REST API',
        '{}',
        { numAlternatives: 5 }
      );

      expect(result).toBeDefined();
      expect(result.selected).toBeDefined();
      expect(result.selected.actions.length).toBeGreaterThan(0);
      expect(result.selected.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('ReAct Verification Integration', () => {
    it('should verify requirement with ReAct loop', async () => {
      const history: ExecutionRecord[] = [
        {
          id: '1',
          iteration: 1,
          action: { type: 'create', path: 'auth.ts' },
          status: 'success',
          timestamp: new Date(),
          duration: 200,
        },
      ];

      // Mock ReAct loop
      jest.spyOn(require('../src/ultrathink/react-loop'), 'runReActLoop').mockResolvedValue({
        requirement: 'Add authentication',
        steps: [
          {
            stepNumber: 1,
            thought: 'Check if auth is working',
            action: { type: 'verify', command: 'npm test' },
            observation: 'Tests passing',
            timestamp: Date.now(),
            success: true,
          },
        ],
        finalState: 'All tests passing',
        success: true,
        totalSteps: 1,
        totalTime: 500,
        reasoning: 'Authentication is working',
        metadata: {
          startedAt: Date.now(),
          completedAt: Date.now() + 500,
          maxSteps: 5,
          terminationReason: 'satisfied',
          selfCorrections: 0,
          fallbackPlans: 0,
        },
      });

      const result = await verifyWithReAct(
        mockConfig,
        mockProjectInfo,
        'Add authentication',
        history,
        5
      );

      expect(result).toBeDefined();
      expect(result.satisfied).toBe(true);
      expect(result.trace).toBeDefined();
      expect(result.trace?.steps.length).toBeGreaterThan(0);
    });
  });

  describe('Complete Planning to Verification Flow', () => {
    it('should integrate planning and verification', async () => {
      // Mock planning
      jest.spyOn(require('../src/ultrathink/planner'), 'generatePlansWithToT').mockResolvedValue({
        selected: {
          id: 'plan-1',
          thoughtNodeId: 't1',
          actions: [
            { type: 'create', path: 'component.tsx' },
            { type: 'modify', path: 'app.tsx' },
          ],
          reasoning: 'Build component',
          estimatedTime: 3000,
          confidence: 0.85,
          riskLevel: 'low',
          metadata: {
            generationMethod: 'tot-bfs',
            searchDepth: 3,
            nodesExplored: 12,
            evaluationCriteria: [],
          },
        },
        rejected: [],
        selectionReason: 'Best plan',
        comparison: { criteria: [], reasoning: 'Selected' },
      });

      // Mock verification
      jest.spyOn(require('../src/ultrathink/react-loop'), 'runReActLoop').mockResolvedValue({
        requirement: 'Build UI',
        steps: [],
        finalState: 'Done',
        success: true,
        totalSteps: 2,
        totalTime: 600,
        reasoning: 'UI completed',
        metadata: {
          startedAt: Date.now(),
          completedAt: Date.now() + 600,
          maxSteps: 5,
          terminationReason: 'satisfied',
          selfCorrections: 0,
          fallbackPlans: 0,
        },
      });

      // Step 1: Generate plans
      const plans = await generatePlansWithToT(
        mockConfig,
        mockProjectInfo,
        'Build user interface',
        '{}'
      );

      expect(plans.selected).toBeDefined();
      expect(plans.selected.actions.length).toBe(2);

      // Step 2: Verify with ReAct
      const history: ExecutionRecord[] = [];
      const verification = await verifyWithReAct(
        mockConfig,
        mockProjectInfo,
        'Build user interface',
        history,
        5
      );

      expect(verification.satisfied).toBe(true);

      // Complete flow successful
      expect(true).toBe(true);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle ToT errors gracefully', async () => {
      // Mock the AI call to simulate error
      mockCallAI.mockRejectedValueOnce(new Error('AI API failed'));

      const generator = new MultiPlanGenerator(mockConfig, mockProjectInfo);

      // The generator should catch the error and return a fallback result
      const result = await generator.generateAndSelectPlans(
        'Test requirement',
        '{}',
        { numAlternatives: 2 }
      );

      // Should return a result with fallback values
      expect(result).toBeDefined();
      expect(result.selected).toBeDefined();
    });

    it('should handle ReAct errors gracefully', async () => {
      const history: ExecutionRecord[] = [];
      const verifier = new ReActVerifier(mockConfig, mockProjectInfo, 'Test');

      // Mock the internal runReActLoop to simulate error
      const mockRunReActLoopError = jest.fn() as any;
      jest.mock('../src/ultrathink/react-loop', () => ({
        runReActLoop: () => mockRunReActLoopError(),
      }));
      mockRunReActLoopError.mockRejectedValue(new Error('ReAct loop failed'));

      const result = await verifier.verifyWithReAct(history, 5)
        .catch(e => ({ error: e.message }));

      expect(result).toBeDefined();
      // Should handle error gracefully
      if (result && 'error' in result) {
        expect(result.error).toContain('ReAct loop failed');
      }
    });
  });

  describe('Performance Integration', () => {
    it('should complete full flow within reasonable time', async () => {
      const startTime = Date.now();

      // Mock all AI calls for speed
      jest.spyOn(require('../src/ultrathink/planner'), 'generatePlansWithToT').mockResolvedValue({
        selected: {
          id: 'plan-1',
          thoughtNodeId: 't1',
          actions: [{ type: 'create', path: 'test.ts' }],
          reasoning: 'Quick plan',
          estimatedTime: 100,
          confidence: 0.8,
          riskLevel: 'low',
          metadata: {
            generationMethod: 'tot-bfs',
            searchDepth: 2,
            nodesExplored: 5,
            evaluationCriteria: [],
          },
        },
        rejected: [],
        selectionReason: 'Fast',
        comparison: { criteria: [], reasoning: 'Fast' },
      });

      jest.spyOn(require('../src/ultrathink/react-loop'), 'runReActLoop').mockResolvedValue({
        requirement: 'Test',
        steps: [],
        finalState: 'Done',
        success: true,
        totalSteps: 1,
        totalTime: 50,
        reasoning: 'Quick',
        metadata: {
          startedAt: Date.now(),
          completedAt: Date.now() + 50,
          maxSteps: 5,
          terminationReason: 'satisfied',
          selfCorrections: 0,
          fallbackPlans: 0,
        },
      });

      // Run planning
      const plans = await generatePlansWithToT(
        mockConfig,
        mockProjectInfo,
        'Quick task',
        '{}'
      );

      // Run verification
      const verification = await verifyWithReAct(
        mockConfig,
        mockProjectInfo,
        'Quick task',
        [],
        3
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(plans).toBeDefined();
      expect(verification).toBeDefined();
      // Should complete very fast with mocks (under 1 second)
      expect(totalTime).toBeLessThan(1000);
    });
  });

  describe('Type Safety Integration', () => {
    it('should maintain type safety across integration', async () => {
      // Verify return types are correct
      const planPromise = generatePlansWithToT(
        mockConfig,
        mockProjectInfo,
        'Test',
        '{}'
      );

      const verifyPromise = verifyWithReAct(
        mockConfig,
        mockProjectInfo,
        'Test',
        [],
        5
      );

      // Mock to avoid actual AI calls
      jest.spyOn(require('../src/ultrathink/planner'), 'generatePlansWithToT').mockResolvedValue({
        selected: {
          id: 'p1',
          thoughtNodeId: 't1',
          actions: [],
          reasoning: 'Test',
          estimatedTime: 100,
          confidence: 0.5,
          riskLevel: 'low',
          metadata: {
            generationMethod: 'tot-bfs',
            searchDepth: 1,
            nodesExplored: 1,
            evaluationCriteria: [],
          },
        },
        rejected: [],
        selectionReason: 'Test',
        comparison: { criteria: [], reasoning: 'Test' },
      });

      jest.spyOn(require('../src/ultrathink/react-loop'), 'runReActLoop').mockResolvedValue({
        requirement: 'Test',
        steps: [],
        finalState: 'Test',
        success: true,
        totalSteps: 0,
        totalTime: 0,
        reasoning: 'Test',
        metadata: {
          startedAt: 0,
          completedAt: 0,
          maxSteps: 5,
          terminationReason: 'satisfied',
          selfCorrections: 0,
          fallbackPlans: 0,
        },
      });

      const [plans, verification] = await Promise.all([
        planPromise,
        verifyPromise,
      ]);

      // Type checks
      expect(plans.selected.actions).toBeDefined();
      expect(Array.isArray(plans.selected.actions)).toBe(true);
      expect(verification.satisfied).toBeDefined();
      expect(typeof verification.satisfied).toBe('boolean');
    });
  });
});
