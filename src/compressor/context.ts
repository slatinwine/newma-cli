// src/compressor/context.ts
/**
 * Context Compression
 * Optimizes file tree context by removing unnecessary files and directories
 */

import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { ContextCompressionOptions, CompressionStats, CompressionResult } from './types';

/**
 * Default exclude patterns
 */
const DEFAULT_EXCLUDE_PATTERNS = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  'vendor',
  '.next',
  '.nuxt',
  'out',
  '.cache',
  '*.log',
  '*.tmp',
  '.env*',
  'package-lock.json',
  'yarn.lock',
];

/**
 * Default prioritize extensions
 */
const DEFAULT_PRIORITIZE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.json',
  '.md',
];

/**
 * Context compressor class
 */
export class ContextCompressor {
  private options: ContextCompressionOptions;

  constructor(options: ContextCompressionOptions = {}) {
    this.options = {
      excludePatterns: options.excludePatterns || DEFAULT_EXCLUDE_PATTERNS,
      maxDepth: options.maxDepth || 5,
      maxFiles: options.maxFiles || 100,
      prioritizeExtensions: options.prioritizeExtensions || DEFAULT_PRIORITIZE_EXTENSIONS,
    };
  }

  /**
   * Compress file tree context
   */
  compress(context: string, root: string): CompressionResult<string> {
    const startTime = Date.now();
    const originalSize = context.length;

    // Parse the file tree
    const files = this.parseFileTree(context);

    // Filter and prioritize files
    const filtered = this.filterFiles(files, root);

    // Generate compressed context
    const compressed = this.generateContext(filtered);

    const endTime = Date.now();
    const compressedSize = compressed.length;

    const stats: CompressionStats = {
      originalSize,
      compressedSize,
      reduction: ((originalSize - compressedSize) / originalSize) * 100,
      reductionBytes: originalSize - compressedSize,
      compressionTime: endTime - startTime,
    };

    return { data: compressed, stats };
  }

  /**
   * Parse file tree from context string
   */
  private parseFileTree(context: string): string[] {
    // Each line is a file path
    return context
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  /**
   * Filter files based on options
   */
  private filterFiles(files: string[], root: string): string[] {
    let filtered = files;

    // Apply exclude patterns
    filtered = filtered.filter(file => {
      return !this.options.excludePatterns!.some(pattern => {
        const regex = new RegExp(pattern.replace('*', '.*'));
        return regex.test(file);
      });
    });

    // Check if files exist and are not directories
    filtered = filtered.filter(file => {
      const fullPath = join(root, file);
      if (!existsSync(fullPath)) return false;
      try {
        const stat = statSync(fullPath);
        return stat.isFile();
      } catch {
        return false;
      }
    });

    // Prioritize by extension
    const prioritized = filtered.filter(file => {
      const ext = this.getExtension(file);
      return this.options.prioritizeExtensions!.includes(ext);
    });

    const others = filtered.filter(file => {
      const ext = this.getExtension(file);
      return !this.options.prioritizeExtensions!.includes(ext);
    });

    // Combine prioritized and others, limited by maxFiles
    const prioritizedCount = Math.min(prioritized.length, Math.floor(this.options.maxFiles! * 0.7));
    const othersCount = Math.min(others.length, this.options.maxFiles! - prioritizedCount);

    return [
      ...prioritized.slice(0, prioritizedCount),
      ...others.slice(0, othersCount),
    ];
  }

  /**
   * Get file extension
   */
  private getExtension(file: string): string {
    const parts = file.split('.');
    return parts.length > 1 ? `.${parts.pop()}` : '';
  }

  /**
   * Generate compressed context
   */
  private generateContext(files: string[]): string {
    return files.join('\n');
  }

  /**
   * Get compression statistics without actually compressing
   */
  estimate(context: string, root: string): CompressionStats {
    const result = this.compress(context, root);
    return result.stats;
  }
}
