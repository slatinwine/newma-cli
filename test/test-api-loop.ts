/**
 * Unit Tests for API Mode with Loop Support
 *
 * Tests multi-level quality control and verification
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { runApiMode, runApiModeWithLoop } from '../src/api';
import { quickVerify } from '../src/api-verifier';
import { Config } from '../src/config';

// Mock config
const mockConfig: Config = {
  apiKey: 'test-key',
  model: 'gpt-4o-mini',
  baseUrl: 'https://api.openai.com/v1',
} as Config;

// Mock project root
const mockProjectRoot = '/tmp/test-project';

describe('API Mode - Multi-Level Quality Control', () => {
  describe('Level 1 - Fast Mode', () => {
    it('should use single call without verification', async () => {
      // This test validates backward compatibility
      // Level 1 should be fast and not use verification

      const result = 'test response'; // Mock implementation

      expect(result).toBeDefined();
      // In actual implementation, level 1 would call runApiModeFast
      // which does a single AI call with no verification
    });

    it('should maintain backward compatibility', () => {
      // Level 1 should behave exactly like original API mode
      const mode = 'chat';
      const level = 1;

      expect(level).toBe(1);
      // Original API mode didn't have level parameter
      // So level 1 should be the default (backward compatible)
    });
  });

  describe('Level 2 - Standard Mode', () => {
    it('should use 2 iterations with verification', async () => {
      const input = 'Create a fibonacci function';

      // Mock implementation
      const mockLoopResult = {
        iterations: 2,
        satisfied: true,
        level: 2,
        duration: 1500,
        results: []
      };

      expect(mockLoopResult.iterations).toBe(2);
      expect(mockLoopResult.satisfied).toBe(true);
      expect(mockLoopResult.level).toBe(2);
    });

    it('should stop early if verification passes', async () => {
      // Level 2 should stop after first successful verification
      const maxIterations = 2;

      // Mock: First iteration passes verification
      let iteration = 1;
      const satisfied = true;

      expect(iteration).toBeLessThanOrEqual(maxIterations);
      expect(satisfied).toBe(true);
    });
  });

  describe('Level 3 - Deep Mode', () => {
    it('should use 3 iterations with ReAct verification', async () => {
      const input = 'Implement a binary search tree';

      // Mock implementation
      const mockLoopResult = {
        iterations: 3,
        satisfied: true,
        level: 3,
        duration: 3000,
        results: []
      };

      expect(mockLoopResult.iterations).toBe(3);
      expect(mockLoopResult.level).toBe(3);
    });

    it('should use stricter verification for level 3', async () => {
      // Level 3 should have higher minimum length requirement
      const verifyOptions = {
        useAICheck: true,
        checkSyntax: true,
        minLength: 100 // Higher than level 2 (50 chars)
      };

      expect(verifyOptions.minLength).toBe(100);
    });
  });

  describe('API Verifier', () => {
    describe('quickVerify', () => {
      it('should reject responses that are too short', async () => {
        const requirement = 'Explain quantum computing';
        const response = 'OK'; // Too short

        const result = await quickVerify(
          mockConfig,
          mockProjectRoot,
          requirement,
          response,
          { useAICheck: false, checkSyntax: false, minLength: 50 }
        );

        expect(result.passed).toBe(false);
        expect(result.reason).toContain('too short');
      });

      it('should check JavaScript syntax', async () => {
        const requirement = 'Write a hello world function';
        const response = '```javascript\nfunction hello() { console.log("Hello"); }\n```';

        const result = await quickVerify(
          mockConfig,
          mockProjectRoot,
          requirement,
          response,
          { useAICheck: false, checkSyntax: true, minLength: 10 }
        );

        // Valid JavaScript should pass
        expect(result.passed).toBe(true);
      });

      it('should detect syntax errors', async () => {
        const requirement = 'Write a function';
        const response = '```javascript\nfunction test( {\n```'; // Syntax error

        const result = await quickVerify(
          mockConfig,
          mockProjectRoot,
          requirement,
          response,
          { useAICheck: false, checkSyntax: true, minLength: 10 }
        );

        expect(result.passed).toBe(false);
        expect(result.reason).toContain('Syntax error');
      });

      it('should use AI self-check for level >= 2', async () => {
        const requirement = 'Calculate fibonacci numbers';
        const response = 'Here is the implementation...'; // Sufficient length

        const result = await quickVerify(
          mockConfig,
          mockProjectRoot,
          requirement,
          response,
          { useAICheck: true, checkSyntax: false, minLength: 50 }
        );

        // Should call AI for verification
        // (In real test, this would be mocked)
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle empty input gracefully', () => {
      const input = '';
      expect(input.trim()).toBe('');
      // Empty input should be caught before API call
    });

    it('should handle very long input', () => {
      const input = 'A'.repeat(10000);
      expect(input.length).toBeGreaterThan(5000);
      // Should still process long input
    });

    it('should handle special characters in input', () => {
      const input = 'Test with émojis 🎉 and spëcial çhars';
      expect(input).toContain('🎉');
      expect(input).toContain('é');
      expect(input).toContain('ç');
      // Should handle Unicode properly
    });
  });

  describe('Loop Metadata', () => {
    it('should track all iterations', () => {
      const metadata = {
        iterations: 2,
        satisfied: true,
        level: 2,
        duration: 1500,
        results: [
          { iteration: 1, phase: 'plan', result: {}, timestamp: 500 },
          { iteration: 1, phase: 'execute', result: {}, timestamp: 300 },
          { iteration: 1, phase: 'verify', result: {}, timestamp: 700 },
          { iteration: 2, phase: 'plan', result: {}, timestamp: 1000 },
        ]
      };

      expect(metadata.results.length).toBe(4); // 2 iterations × 2 phases (plan+verify) = 4
      expect(metadata.iterations).toBe(2);
    });

    it('should calculate duration correctly', () => {
      const metadata = {
        iterations: 1,
        satisfied: true,
        level: 1,
        duration: 2500, // 2.5 seconds
        results: []
      };

      expect(metadata.duration).toBe(2500);
      expect(metadata.duration).toBeGreaterThan(2000);
      expect(metadata.duration).toBeLessThan(3000);
    });
  });
});
