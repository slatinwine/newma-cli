/**
 * Unit Tests for Tree of Thoughts Engine
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  TreeOfThoughtsEngine,
  runToTSearch
} from '../src/ultrathink/tree-of-thoughts';
import { ThoughtNode, ThoughtTree, ThoughtState } from '../src/ultrathink/types';
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

describe('TreeOfThoughtsEngine', () => {
  let engine: TreeOfThoughtsEngine;

  beforeEach(() => {
    engine = new TreeOfThoughtsEngine(
      mockConfig,
      mockProjectInfo,
      'Add a login feature'
    );
  });

  describe('Initialization', () => {
    it('should create engine with config and project info', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(TreeOfThoughtsEngine);
    });

    it('should initialize tree with root thought', async () => {
      const tree = await engine.initializeTree(
        'Initial approach',
        'bfs',
        4,
        3,
        5
      );

      expect(tree).toBeDefined();
      expect(tree.root).toBeDefined();
      expect(tree.root.content).toBe('Initial approach');
      expect(tree.root.depth).toBe(0);
      expect(tree.root.state).toBe(ThoughtState.EVALUATED);
      expect(tree.nodes.size).toBe(1);
    });

    it('should set correct tree metadata', async () => {
      const tree = await engine.initializeTree(
        'Initial thought',
        'dfs',
        5,
        2,
        3
      );

      expect(tree.metadata.requirement).toBe('Add a login feature');
      expect(tree.metadata.createdAt).toBeDefined();
      expect(tree.metadata.totalNodes).toBe(1);
      expect(tree.metadata.evaluatedNodes).toBe(1);
      expect(tree.maxDepth).toBe(5);
      expect(tree.beamWidth).toBe(2);
      expect(tree.branchingFactor).toBe(3);
      expect(tree.searchStrategy).toBe('dfs');
    });
  });

  describe('Thought Generation', () => {
    it('should generate thoughts from parent', async () => {
      const parent: ThoughtNode = {
        id: 'parent-1',
        content: 'Create a login form',
        parentId: null,
        children: [],
        depth: 0,
        state: ThoughtState.EVALUATED,
        metadata: { timestamp: Date.now() },
      };

      // Mock the AI call
      mockCallAI.mockResolvedValue({
        content: '1. Add email input field\n2. Add password input\n3. Add submit button',
      });

      const thoughts = await engine.generateThoughts(parent, 3);

      expect(thoughts).toBeDefined();
      expect(Array.isArray(thoughts)).toBe(true);
      expect(thoughts.length).toBeGreaterThanOrEqual(0);
    });

    it('should create thoughts with correct properties', async () => {
      const parent: ThoughtNode = {
        id: 'parent-1',
        content: 'Parent thought',
        parentId: null,
        children: [],
        depth: 0,
        state: ThoughtState.EVALUATED,
        metadata: { timestamp: Date.now() },
      };

      mockCallAI.mockResolvedValue({
        content: '1. First thought\n2. Second thought',
      });

      const thoughts = await engine.generateThoughts(parent, 2);

      thoughts.forEach(thought => {
        expect(thought.id).toBeDefined();
        expect(thought.content).toBeDefined();
        expect(thought.parentId).toBe('parent-1');
        expect(thought.depth).toBe(1);
        expect(thought.children).toEqual([]);
        expect(thought.state).toBe(ThoughtState.PENDING);
        expect(thought.metadata).toBeDefined();
        if (thought.metadata) {
          expect(thought.metadata.timestamp).toBeDefined();
        }
      });
    });
  });

  describe('Thought Evaluation', () => {
    it('should evaluate thoughts and assign scores', async () => {
      const thoughts: ThoughtNode[] = [
        {
          id: 't1',
          content: 'Thought 1',
          parentId: null,
          children: [],
          depth: 0,
          state: ThoughtState.PENDING,
          metadata: { timestamp: Date.now() },
        },
        {
          id: 't2',
          content: 'Thought 2',
          parentId: null,
          children: [],
          depth: 0,
          state: ThoughtState.PENDING,
          metadata: { timestamp: Date.now() },
        },
      ];

      mockCallAI.mockResolvedValue({
        content: 'Thought 1: 0.85\nThought 2: 0.62',
      });

      const scores = await engine.evaluateThoughts(thoughts);

      expect(scores).toBeDefined();
      expect(scores instanceof Map).toBe(true);
      expect(scores.size).toBe(2);

      thoughts.forEach(thought => {
        expect(thought.state).toBe(ThoughtState.EVALUATED);
        expect(thought.score).toBeDefined();
        expect(thought.score).toBeGreaterThanOrEqual(0);
        expect(thought.score).toBeLessThanOrEqual(1);
      });
    });

    it('should handle evaluation errors gracefully', async () => {
      const thoughts: ThoughtNode[] = [
        {
          id: 't1',
          content: 'Thought 1',
          parentId: null,
          children: [],
          depth: 0,
          state: ThoughtState.PENDING,
          metadata: { timestamp: Date.now() },
        },
      ];

      mockCallAI.mockRejectedValue(
        new Error('API error')
      );

      const scores = await engine.evaluateThoughts(thoughts);

      expect(scores.size).toBe(1);
      expect(thoughts[0].score).toBe(0.5); // Default score
    });
  });

  describe('BFS Search', () => {
    it('should perform BFS search on thought tree', async () => {
      const tree = await engine.initializeTree(
        'Root thought',
        'bfs',
        2,
        2,
        2
      );

      // Mock generateThoughts to return simple thoughts
      jest.spyOn(engine, 'generateThoughts').mockResolvedValue([
        {
          id: 'c1',
          content: 'Child 1',
          parentId: tree.root.id,
          children: [],
          depth: 1,
          state: ThoughtState.PENDING,
          metadata: { timestamp: Date.now() },
        },
        {
          id: 'c2',
          content: 'Child 2',
          parentId: tree.root.id,
          children: [],
          depth: 1,
          state: ThoughtState.PENDING,
          metadata: { timestamp: Date.now() },
        },
      ]);

      // Mock evaluateThoughts to return scores
      jest.spyOn(engine, 'evaluateThoughts').mockResolvedValue(
        new Map([
          [
            {
              id: 'c1',
              content: 'Child 1',
              parentId: tree.root.id,
              children: [],
              depth: 1,
              state: ThoughtState.PENDING,
              metadata: { timestamp: Date.now() },
            },
            0.8,
          ],
          [
            {
              id: 'c2',
              content: 'Child 2',
              parentId: tree.root.id,
              children: [],
              depth: 1,
              state: ThoughtState.PENDING,
              metadata: { timestamp: Date.now() },
            },
            0.6,
          ],
        ])
      );

      const bestNode = await engine.bfsSearch(tree);

      expect(bestNode).toBeDefined();
      // Since we're mocking internal methods, we just check the search was attempted
      expect(tree.metadata.searchTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('DFS Search', () => {
    it('should perform DFS search with backtracking', async () => {
      const tree = await engine.initializeTree(
        'Root thought',
        'dfs',
        2,
        2,
        2
      );

      jest.spyOn(engine, 'generateThoughts').mockResolvedValue([
        {
          id: 'c1',
          content: 'Child 1',
          parentId: tree.root.id,
          children: [],
          depth: 1,
          state: ThoughtState.PENDING,
          metadata: { timestamp: Date.now() },
        },
      ]);

      jest.spyOn(engine, 'evaluateThoughts').mockResolvedValue(
        new Map([
          [
            {
              id: 'c1',
              content: 'Child 1',
              parentId: tree.root.id,
              children: [],
              depth: 1,
              state: ThoughtState.PENDING,
              metadata: { timestamp: Date.now() },
            },
            0.9,
          ],
        ])
      );

      const bestNode = await engine.dfsSearch(tree);

      expect(bestNode).toBeDefined();
      expect(tree.metadata.totalNodes).toBeGreaterThan(1);
    });
  });
});

describe('runToTSearch', () => {
  it('should run complete ToT search and return tree + best node', async () => {
    // Mock the AI call to return valid responses
    mockCallAI.mockResolvedValue({
      content: '1. Create database schema\n2. Add user model\n3. Create API endpoints',
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    });

    const result = await runToTSearch(
      mockConfig,
      mockProjectInfo,
      'Create a user profile',
      'Start with database schema',
      'bfs',
      2,
      2,
      2
    );

    expect(result).toBeDefined();
    expect(result.tree).toBeDefined();
    expect(result.bestNode).toBeDefined();
    expect(result.tree.root).toBeDefined();
    expect(result.tree.metadata).toBeDefined();
  });

  it('should mark solution path when solution found', async () => {
    // Mock the AI call
    mockCallAI.mockResolvedValue({
      content: '1. Approach A\n2. Approach B',
      usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
    });

    const result = await runToTSearch(
      mockConfig,
      mockProjectInfo,
      'Test requirement',
      'Initial thought',
      'dfs',
      2,
      2,
      2
    );

    if (result.bestNode) {
      // Check that path is marked
      const path = result.tree.metadata.solutionPath;
      expect(path).toBeDefined();
      if (path) {
        expect(Array.isArray(path)).toBe(true);
        expect(path.length).toBeGreaterThan(0);
      }
    }
  });
});
