/**
 * Memory Decay - Memory Scorer
 *
 * Implements memory scoring with time decay and frequency tracking
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Memory score data
 */
export interface MemoryScore {
  /**
   * Unique identifier for the memory
   */
  id: string;

  /**
   * Current score (0-1)
   */
  value: number;

  /**
   * Last access timestamp
   */
  lastAccessed: string;

  /**
   * Number of times this memory has been accessed
   */
  accessCount: number;

  /**
   * When this memory was created
   */
  createdAt: string;

  /**
   * Manual importance boost (0-1)
   */
  importance: number;

  /**
   * Memory type/category
   */
  type: string;

  /**
   * Additional metadata
   */
  metadata: Record<string, any>;
}

/**
 * Score calculation options
 */
export interface ScoreOptions {
  /**
   * Decay rate lambda (higher = faster decay)
   * Default: 0.1 (decays to ~37% after 10 days)
   */
  decayLambda?: number;

  /**
   * Frequency weight (0-1)
   * Higher = access count matters more
   */
  frequencyWeight?: number;

  /**
   * Recency weight (0-1)
   * Higher = time since access matters more
   */
  recencyWeight?: number;

  /**
   * Importance weight (0-1)
   * Higher = manual importance matters more
   */
  importanceWeight?: number;
}

/**
 * Memory Scorer
 *
 * Calculates and updates memory scores based on access patterns
 * Uses exponential decay for time and logarithmic scaling for frequency
 */
export class MemoryScorer {
  private options: Required<ScoreOptions>;
  private scores: Map<string, MemoryScore>;
  private scoreFile: string | null;

  constructor(options: ScoreOptions = {}, scoreFile?: string) {
    this.options = {
      decayLambda: options.decayLambda ?? 0.1,
      frequencyWeight: options.frequencyWeight ?? 0.3,
      recencyWeight: options.recencyWeight ?? 0.5,
      importanceWeight: options.importanceWeight ?? 0.2,
    };

    this.scores = new Map();
    this.scoreFile = scoreFile || null;
  }

  /**
   * Initialize a new memory score
   */
  initializeScore(
    id: string,
    type: string,
    importance: number = 0.5,
    metadata: Record<string, any> = {}
  ): MemoryScore {
    const now = new Date().toISOString();

    const score: MemoryScore = {
      id,
      value: importance, // Initial score equals importance
      lastAccessed: now,
      accessCount: 0,
      createdAt: now,
      importance,
      type,
      metadata,
    };

    this.scores.set(id, score);
    return score;
  }

  /**
   * Get current score for a memory
   */
  getScore(id: string): MemoryScore | null {
    return this.scores.get(id) || null;
  }

  /**
   * Update score when memory is accessed
   */
  recordAccess(id: string): MemoryScore {
    let score = this.scores.get(id);

    if (!score) {
      // Create new score if doesn't exist
      score = this.initializeScore(id, 'unknown', 0.5);
    }

    // Update access tracking
    score.accessCount++;
    score.lastAccessed = new Date().toISOString();

    // Recalculate score
    score.value = this.calculateScore(score);

    this.scores.set(id, score);
    return score;
  }

  /**
   * Manually set importance for a memory
   */
  setImportance(id: string, importance: number): MemoryScore | null {
    const score = this.scores.get(id);
    if (!score) {
      return null;
    }

    // Clamp importance to 0-1
    score.importance = Math.max(0, Math.min(1, importance));

    // Recalculate score
    score.value = this.calculateScore(score);

    this.scores.set(id, score);
    return score;
  }

  /**
   * Calculate current score for a memory
   */
  private calculateScore(score: MemoryScore): number {
    const now = new Date();
    const lastAccess = new Date(score.lastAccessed);
    const created = new Date(score.createdAt);

    // Calculate days since last access
    const daysSinceAccess = (now.getTime() - lastAccess.getTime()) / (1000 * 60 * 60 * 24);

    // Calculate days since creation
    const daysSinceCreation = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);

    // Calculate recency score using exponential decay
    // recency = exp(-λ * days_since_access)
    const recency = Math.exp(-this.options.decayLambda * daysSinceAccess);

    // Calculate frequency score using logarithmic scaling
    // frequency = log(1 + access_count)
    const frequency = Math.log(1 + score.accessCount);

    // Normalize frequency to 0-1 range (assuming max useful count is ~100)
    const normalizedFrequency = Math.min(frequency / Math.log(101), 1);

    // Calculate weighted score
    const weightedScore =
      (this.options.recencyWeight * recency) +
      (this.options.frequencyWeight * normalizedFrequency) +
      (this.options.importanceWeight * score.importance);

    // Clamp to 0-1
    return Math.max(0, Math.min(1, weightedScore));
  }

  /**
   * Update all scores (should be called periodically)
   */
  updateAllScores(): void {
    for (const [id, score] of this.scores.entries()) {
      score.value = this.calculateScore(score);
      this.scores.set(id, score);
    }
  }

  /**
   * Get memories below a certain score threshold
   */
  getLowScoreMemories(threshold: number): MemoryScore[] {
    const results: MemoryScore[] = [];

    for (const score of this.scores.values()) {
      if (score.value < threshold) {
        results.push(score);
      }
    }

    // Sort by score (ascending)
    results.sort((a, b) => a.value - b.value);

    return results;
  }

  /**
   * Get memories above a certain score threshold
   */
  getHighScoreMemories(threshold: number): MemoryScore[] {
    const results: MemoryScore[] = [];

    for (const score of this.scores.values()) {
      if (score.value > threshold) {
        results.push(score);
      }
    }

    // Sort by score (descending)
    results.sort((a, b) => b.value - a.value);

    return results;
  }

  /**
   * Get top N memories by score
   */
  getTopMemories(limit: number): MemoryScore[] {
    const allScores = Array.from(this.scores.values());

    // Sort by score (descending)
    allScores.sort((a, b) => b.value - a.value);

    return allScores.slice(0, limit);
  }

  /**
   * Remove a score from tracking
   */
  removeScore(id: string): boolean {
    return this.scores.delete(id);
  }

  /**
   * Get score statistics
   */
  getStatistics(): {
    totalScores: number;
    averageScore: number;
    minScore: number;
    maxScore: number;
    scoreDistribution: Record<string, number>;
  } {
    if (this.scores.size === 0) {
      return {
        totalScores: 0,
        averageScore: 0,
        minScore: 0,
        maxScore: 0,
        scoreDistribution: {},
      };
    }

    const scores = Array.from(this.scores.values()).map(s => s.value);

    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);

    // Calculate score distribution
    const distribution: Record<string, number> = {
      '0.0-0.2': 0,
      '0.2-0.4': 0,
      '0.4-0.6': 0,
      '0.6-0.8': 0,
      '0.8-1.0': 0,
    };

    for (const score of scores) {
      if (score < 0.2) distribution['0.0-0.2']++;
      else if (score < 0.4) distribution['0.2-0.4']++;
      else if (score < 0.6) distribution['0.4-0.6']++;
      else if (score < 0.8) distribution['0.6-0.8']++;
      else distribution['0.8-1.0']++;
    }

    return {
      totalScores: this.scores.size,
      averageScore,
      minScore,
      maxScore,
      scoreDistribution: distribution,
    };
  }

  /**
   * Export all scores
   */
  exportScores(): Record<string, MemoryScore> {
    const exported: Record<string, MemoryScore> = {};

    for (const [id, score] of this.scores.entries()) {
      exported[id] = { ...score }; // Clone to avoid reference issues
    }

    return exported;
  }

  /**
   * Import scores
   */
  importScores(scores: Record<string, MemoryScore>): void {
    for (const [id, score] of Object.entries(scores)) {
      this.scores.set(id, { ...score });
    }
  }

  /**
   * Clear all scores
   */
  clear(): void {
    this.scores.clear();
  }

  /**
   * Save scores to disk
   */
  async save(): Promise<void> {
    if (!this.scoreFile) return;
    const dir = join(this.scoreFile, '..');
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
    const data = Object.fromEntries(this.scores);
    await fs.writeFile(this.scoreFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Load scores from disk
   */
  async load(): Promise<void> {
    if (!this.scoreFile || !existsSync(this.scoreFile)) return;
    try {
      const content = await fs.readFile(this.scoreFile, 'utf-8');
      const data = JSON.parse(content) as Record<string, MemoryScore>;
      this.scores.clear();
      for (const [id, score] of Object.entries(data)) {
        this.scores.set(id, score);
      }
    } catch {
      // Ignore load errors, start fresh
    }
  }

  /**
   * Get all scores
   */
  getAllScores(): MemoryScore[] {
    return Array.from(this.scores.values());
  }

  /**
   * Get score count
   */
  getCount(): number {
    return this.scores.size;
  }

  /**
   * Check if a score exists
   */
  hasScore(id: string): boolean {
    return this.scores.has(id);
  }
}