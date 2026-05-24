// src/compressor/types.ts
/**
 * Token Compression Types
 * Optimizes token usage by compressing context, history, and file content
 */

/**
 * Compression configuration
 */
export interface CompressionConfig {
  enabled?: boolean;
  maxTokens?: number;
  targetReduction?: number; // Target percentage reduction (0-100)
  aggressive?: boolean; // Aggressive compression mode
}

/**
 * Compression statistics
 */
export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  reduction: number; // Percentage
  reductionBytes: number;
  compressionTime: number; // ms
}

/**
 * Compression result
 */
export interface CompressionResult<T> {
  data: T;
  stats: CompressionStats;
}

/**
 * Context compression options
 */
export interface ContextCompressionOptions {
  excludePatterns?: string[]; // Patterns to exclude (e.g., ['node_modules', 'dist'])
  maxDepth?: number; // Maximum directory depth
  maxFiles?: number; // Maximum number of files to include
  prioritizeExtensions?: string[]; // File extensions to prioritize
}

/**
 * History summarization options
 */
export interface HistorySummarizationOptions {
  maxIterations?: number; // Maximum number of iterations to keep
  keepRecent?: number; // Keep N most recent iterations
  summarizeOld?: boolean; // Summarize older iterations instead of removing
  focusOnErrors?: boolean; // Keep error-prone iterations
}

/**
 * File content optimization options
 */
export interface FileContentOptions {
  maxLength?: number; // Maximum characters per file
  keepStructure?: boolean; // Keep structural elements (imports, exports)
  removeComments?: boolean; // Remove comments
  removeEmptyLines?: boolean; // Remove empty lines
  keepSignatures?: boolean; // Only keep function/class signatures
}

/**
 * Incremental tracking options
 */
export interface IncrementalTrackingOptions {
  trackChanges?: boolean; // Track file changes
  cacheHashes?: boolean; // Cache file content hashes
  maxDeltaSize?: number; // Maximum size of delta to send
}
