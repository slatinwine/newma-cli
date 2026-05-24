/**
 * Task Tracker - Type Definitions
 *
 * Records complete lifecycle of planning, reasoning, and execution
 */

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'aborted';
export type TaskMode = 'plan' | 'execute' | 'verify' | 'loop';
export type CompressionAlgorithm = 'gzip';

/**
 * Task document - complete record of a REPL session task
 */
export interface TaskDocument {
  /**
   * Unique task identifier (reuses sessionId for simplicity)
   */
  id: string;

  /**
   * Session identifier (from SessionManager)
   */
  sessionId: string;

  /**
   * Task status
   */
  status: TaskStatus;

  /**
   * Execution mode
   */
  mode: TaskMode;

  /**
   * Creation timestamp (ISO string)
   */
  createdAt: string;

  /**
   * Last update timestamp (ISO string)
   */
  updatedAt: string;

  /**
   * Completion timestamp (ISO string)
   */
  completedAt?: string;

  /**
   * Compression timestamp (ISO string)
   */
  compressedAt?: string;

  /**
   * Project root directory
   */
  projectRoot: string;

  // ==================== User Input ====================

  /**
   * User requirement / input
   */
  requirement: string;

  // ==================== AI Processing ====================

  /**
   * AI reasoning and planning
   */
  reasoning: {
    /**
     * Planning algorithm used
     */
    algorithm?: 'fft' | 'landmark' | 'tot' | 'standard';

    /**
     * AI reasoning trace
     */
    thoughts?: string;

    /**
     * Execution plan
     */
    plan?: string[];

    /**
     * Plan alternatives (for FFT, ToT)
     */
    alternatives?: Array<{
      name: string;
      description: string;
      risk: 'low' | 'medium' | 'high';
      confidence: number;
    }>;
  };

  // ==================== Execution ====================

  /**
   * Execution details
   */
  execution: {
    /**
     * Individual actions/steps
     */
    actions: Array<{
      type: string;
      target?: string;
      status: 'pending' | 'running' | 'success' | 'failed';
      result?: string;
      error?: string;
      timestamp: string;
      duration?: number;
    }>;

    /**
     * Execution summary
     */
    summary: {
      total: number;
      succeeded: number;
      failed: number;
    };
  };

  // ==================== Verification ====================

  /**
   * Verification results (if enabled)
   */
  verification?: {
    enabled: boolean;
    stages?: Array<{
      name: string;
      passed: boolean;
      message?: string;
      duration?: number;
    }>;
    satisfied: boolean;
    iterations?: number;
  };

  // ==================== Metadata ====================

  /**
   * Task metadata and metrics
   */
  metadata: {
    /**
     * Total duration (milliseconds)
     */
    duration: number;

    /**
     * Token usage
     */
    tokens?: {
      input: number;
      output: number;
      total: number;
    };

    /**
     * Task status
     */
    status: TaskStatus;

    /**
     * Error summary (if failed)
     */
    errorSummary?: string;

    /**
     * Tags for categorization
     */
    tags?: string[];
  };
}

/**
 * Task filter options
 */
export interface TaskFilter {
  status?: TaskStatus;
  mode?: TaskMode;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Task storage configuration
 */
export interface TaskStorageConfig {
  /**
   * Directory for task storage
   */
  dataDir: string;

  /**
   * Compress tasks older than this many days
   */
  compressAfterDays: number;

  /**
   * Compression level (0-9, default 9 for max compression)
   */
  compressionLevel: number;

  /**
   * Compression algorithm
   */
  algorithm: CompressionAlgorithm;
}

/**
 * Compression statistics
 */
export interface CompressionStats {
  compressedCount: number;
  originalSize: number;
  compressedSize: number;
  reduction: number;
  duration: number;
}
