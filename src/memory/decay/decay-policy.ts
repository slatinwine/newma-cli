/**
 * Memory Decay - Decay Policy
 *
 * Configurable policies for memory retention and archival
 */

/**
 * Decay policy configuration
 */
export interface DecayPolicyConfig {
  /**
   * Score threshold below which memories are archived
   * Range: 0.0 - 1.0
   * Default: 0.1
   */
  archiveThreshold?: number;

  /**
   * Minimum age (in days) before a memory can be archived
   * Default: 90 days
   */
  minRetentionDays?: number;

  /**
   * Maximum age (in days) before forced archival
   * Default: 365 days (1 year)
   */
  maxRetentionDays?: number;

  /**
   * How often to run archival (in hours)
   * Default: 24 hours (daily)
   */
  archiveIntervalHours?: number;

  /**
   * Minimum access count to prevent archival
   * Memories accessed this many times are kept regardless of score
   * Default: 5
   */
  minAccessCount?: number;

  /**
   * Decay rate lambda
   * Higher = faster decay
   * Default: 0.1
   */
  decayLambda?: number;

  /**
   * Whether to auto-archive on initialization
   * Default: false
   */
  autoArchiveOnStart?: boolean;

  /**
   * Maximum number of memories to keep in active storage
   * Default: 10000
   */
  maxActiveMemories?: number;

  /**
   * Priority memory types (never archived)
   */
  priorityTypes?: string[];
}

/**
 * Policy violation type
 */
export type PolicyViolationType =
  | 'below_threshold'
  | 'too_old'
  | 'too_many_memories'
  | 'low_access';

/**
 * Policy violation
 */
export interface PolicyViolation {
  /**
   * Memory ID
   */
  id: string;

  /**
   * Violation type
   */
  type: PolicyViolationType;

  /**
   * Current score
   */
  score: number;

  /**
   * Severity (0-1)
   */
  severity: number;

  /**
   * Reason for violation
   */
  reason: string;

  /**
   * Suggested action
   */
  suggestedAction: 'archive' | 'keep' | 'boost';
}

/**
 * Decay Policy Manager
 *
 * Configures and enforces memory retention policies
 */
export class DecayPolicyManager {
  private config: Required<DecayPolicyConfig>;

  constructor(config: DecayPolicyConfig = {}) {
    this.config = {
      archiveThreshold: config.archiveThreshold ?? 0.1,
      minRetentionDays: config.minRetentionDays ?? 90,
      maxRetentionDays: config.maxRetentionDays ?? 365,
      archiveIntervalHours: config.archiveIntervalHours ?? 24,
      minAccessCount: config.minAccessCount ?? 5,
      decayLambda: config.decayLambda ?? 0.1,
      autoArchiveOnStart: config.autoArchiveOnStart ?? false,
      maxActiveMemories: config.maxActiveMemories ?? 10000,
      priorityTypes: config.priorityTypes ?? [],
    };
  }

  /**
   * Check if a memory violates any policies
   */
  checkViolation(
    score: number,
    ageInDays: number,
    accessCount: number,
    type: string,
    totalMemories: number
  ): PolicyViolation | null {
    // Check if it's a priority type
    if (this.config.priorityTypes.includes(type)) {
      return null; // Never archive priority types
    }

    // Check if memory is too old
    if (ageInDays > this.config.maxRetentionDays) {
      return {
        id: '',
        type: 'too_old',
        score,
        severity: 1.0,
        reason: `Memory is ${Math.floor(ageInDays)} days old (max: ${this.config.maxRetentionDays})`,
        suggestedAction: 'archive',
      };
    }

    // Check if too many memories in total
    if (totalMemories > this.config.maxActiveMemories) {
      // If we have too many memories, be more aggressive
      if (score < this.config.archiveThreshold * 1.5) {
        return {
          id: '',
          type: 'too_many_memories',
          score,
          severity: 0.7,
          reason: `Too many active memories (${totalMemories} > ${this.config.maxActiveMemories})`,
          suggestedAction: 'archive',
        };
      }
    }

    // Check if memory is old enough and has low score
    if (ageInDays >= this.config.minRetentionDays) {
      if (score < this.config.archiveThreshold) {
        // Check access count exception
        if (accessCount >= this.config.minAccessCount) {
          return {
            id: '',
            type: 'low_access',
            score,
            severity: 0.3,
            reason: `Low score (${score.toFixed(2)}) but high access count (${accessCount})`,
            suggestedAction: 'keep',
          };
        }

        return {
          id: '',
          type: 'below_threshold',
          score,
          severity: 0.5 + (1 - score), // Higher severity for lower scores
          reason: `Score ${score.toFixed(2)} below threshold ${this.config.archiveThreshold}`,
          suggestedAction: 'archive',
        };
      }
    }

    return null;
  }

  /**
   * Check if archival should run
   */
  shouldArchive(lastArchiveTime: Date): boolean {
    const now = new Date();
    const hoursSinceLastArchive =
      (now.getTime() - lastArchiveTime.getTime()) / (1000 * 60 * 60);

    return hoursSinceLastArchive >= this.config.archiveIntervalHours;
  }

  /**
   * Calculate next archive time
   */
  getNextArchiveTime(): Date {
    const next = new Date();
    next.setHours(next.getHours() + this.config.archiveIntervalHours);
    return next;
  }

  /**
   * Get policy configuration
   */
  getConfig(): Required<DecayPolicyConfig> {
    return { ...this.config };
  }

  /**
   * Update policy configuration
   */
  updateConfig(updates: Partial<DecayPolicyConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Validate policy configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.archiveThreshold < 0 || this.config.archiveThreshold > 1) {
      errors.push('archiveThreshold must be between 0 and 1');
    }

    if (this.config.minRetentionDays < 0) {
      errors.push('minRetentionDays must be positive');
    }

    if (this.config.maxRetentionDays < this.config.minRetentionDays) {
      errors.push('maxRetentionDays must be >= minRetentionDays');
    }

    if (this.config.archiveIntervalHours < 1) {
      errors.push('archiveIntervalHours must be at least 1 hour');
    }

    if (this.config.minAccessCount < 0) {
      errors.push('minAccessCount must be positive');
    }

    if (this.config.decayLambda < 0) {
      errors.push('decayLambda must be positive');
    }

    if (this.config.maxActiveMemories < 1) {
      errors.push('maxActiveMemories must be at least 1');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get default policies
   */
  static getDefaultPolicies(): Record<string, DecayPolicyConfig> {
    return {
      aggressive: {
        archiveThreshold: 0.2,
        minRetentionDays: 30,
        maxRetentionDays: 180,
        archiveIntervalHours: 12,
        minAccessCount: 3,
        decayLambda: 0.15,
        autoArchiveOnStart: true,
        maxActiveMemories: 5000,
      },
      balanced: {
        archiveThreshold: 0.1,
        minRetentionDays: 90,
        maxRetentionDays: 365,
        archiveIntervalHours: 24,
        minAccessCount: 5,
        decayLambda: 0.1,
        autoArchiveOnStart: false,
        maxActiveMemories: 10000,
      },
      conservative: {
        archiveThreshold: 0.05,
        minRetentionDays: 180,
        maxRetentionDays: 730, // 2 years
        archiveIntervalHours: 48,
        minAccessCount: 10,
        decayLambda: 0.05,
        autoArchiveOnStart: false,
        maxActiveMemories: 20000,
      },
    };
  }

  /**
   * Create policy manager from preset
   */
  static fromPreset(presetName: 'aggressive' | 'balanced' | 'conservative'): DecayPolicyManager {
    const policies = DecayPolicyManager.getDefaultPolicies();
    return new DecayPolicyManager(policies[presetName]);
  }
}