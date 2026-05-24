// src/compressor/incremental.ts
/**
 * Incremental Context Tracking
 * Tracks changes and only sends deltas to reduce token usage
 */

import { readFileSync, statSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import { IncrementalTrackingOptions, CompressionStats, CompressionResult } from './types';

/**
 * File change information
 */
interface FileChange {
  path: string;
  oldHash?: string;
  newHash: string;
  type: 'added' | 'modified' | 'deleted';
  content?: string;
}

/**
 * Incremental tracker class
 */
export class IncrementalTracker {
  private options: IncrementalTrackingOptions;
  private state: Map<string, string>; // path -> hash
  private baseline: Map<string, string>; // path -> content

  constructor(options: IncrementalTrackingOptions = {}) {
    this.options = {
      trackChanges: options.trackChanges !== false,
      cacheHashes: options.cacheHashes !== false,
      maxDeltaSize: options.maxDeltaSize || 10000,
    };
    this.state = new Map();
    this.baseline = new Map();
  }

  /**
   * Set baseline state
   */
  setBaseline(files: Map<string, string>): void {
    this.baseline = new Map(files);
    this.state = new Map();

    // Calculate hashes for all files
    for (const [path, content] of files.entries()) {
      const hash = this.calculateHash(content);
      this.state.set(path, hash);
    }
  }

  /**
   * Get delta since baseline
   */
  getDelta(currentFiles: Map<string, string>): CompressionResult<Map<string, FileChange>> {
    const startTime = Date.now();
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;

    const changes = new Map<string, FileChange>();

    // Check for additions and modifications
    for (const [path, content] of currentFiles.entries()) {
      totalOriginalSize += content.length;

      const oldHash = this.state.get(path);
      const newHash = this.calculateHash(content);

      if (!oldHash) {
        // New file
        changes.set(path, {
          path,
          newHash,
          type: 'added',
          content,
        });
        totalCompressedSize += content.length;
      } else if (oldHash !== newHash) {
        // Modified file
        changes.set(path, {
          path,
          oldHash,
          newHash,
          type: 'modified',
          content,
        });
        totalCompressedSize += content.length;
      }
    }

    // Check for deletions
    for (const [path, oldHash] of this.state.entries()) {
      if (!currentFiles.has(path)) {
        changes.set(path, {
          path,
          oldHash,
          newHash: '',
          type: 'deleted',
        });
        totalCompressedSize += 100; // Approximate size for deletion marker
      }
    }

    // Limit delta size
    if (totalCompressedSize > this.options.maxDeltaSize!) {
      // If delta is too large, just send everything
      return this.getFullDelta(currentFiles, totalOriginalSize, startTime);
    }

    const endTime = Date.now();

    const stats: CompressionStats = {
      originalSize: totalOriginalSize,
      compressedSize: totalCompressedSize,
      reduction: ((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100,
      reductionBytes: totalOriginalSize - totalCompressedSize,
      compressionTime: endTime - startTime,
    };

    return { data: changes, stats };
  }

  /**
   * Get full delta (when changes are too large)
   */
  private getFullDelta(
    files: Map<string, string>,
    totalOriginalSize: number,
    startTime: number
  ): CompressionResult<Map<string, FileChange>> {
    const changes = new Map<string, FileChange>();

    for (const [path, content] of files.entries()) {
      changes.set(path, {
        path,
        newHash: this.calculateHash(content),
        type: 'modified', // Treat everything as modified
        content,
      });
    }

    const endTime = Date.now();
    const totalCompressedSize = totalOriginalSize; // No compression

    const stats: CompressionStats = {
      originalSize: totalOriginalSize,
      compressedSize: totalCompressedSize,
      reduction: 0,
      reductionBytes: 0,
      compressionTime: endTime - startTime,
    };

    return { data: changes, stats };
  }

  /**
   * Calculate content hash
   */
  private calculateHash(content: string): string {
    return createHash('md5').update(content).digest('hex');
  }

  /**
   * Update state with current files
   */
  updateState(files: Map<string, string>): void {
    this.state.clear();

    for (const [path, content] of files.entries()) {
      const hash = this.calculateHash(content);
      this.state.set(path, hash);
    }
  }

  /**
   * Clear state
   */
  clear(): void {
    this.state.clear();
    this.baseline.clear();
  }

  /**
   * Scan directory and build file map
   */
  scanDirectory(root: string, filePaths: string[]): Map<string, string> {
    const files = new Map<string, string>();

    for (const filePath of filePaths) {
      const fullPath = join(root, filePath);
      if (existsSync(fullPath)) {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          files.set(filePath, content);
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }
    }

    return files;
  }

  /**
   * Get statistics without generating delta
   */
  estimate(currentFiles: Map<string, string>): CompressionStats {
    const result = this.getDelta(currentFiles);
    return result.stats;
  }
}
