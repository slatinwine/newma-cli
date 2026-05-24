// src/compressor/content.ts
/**
 * File Content Optimization
 * Optimizes file content by removing unnecessary parts
 */

import { readFileSync } from 'fs';
import { FileContentOptions, CompressionStats, CompressionResult } from './types';

/**
 * File content optimizer class
 */
export class ContentOptimizer {
  private options: FileContentOptions;

  constructor(options: FileContentOptions = {}) {
    this.options = {
      maxLength: options.maxLength || 2000,
      keepStructure: options.keepStructure !== false,
      removeComments: options.removeComments !== false,
      removeEmptyLines: options.removeEmptyLines !== false,
      keepSignatures: options.keepSignatures || false,
    };
  }

  /**
   * Optimize file content
   */
  optimize(filePath: string, content?: string): CompressionResult<string> {
    const startTime = Date.now();

    // Read content if not provided
    const fileContent = content || readFileSync(filePath, 'utf-8');
    const originalSize = fileContent.length;

    // Apply optimizations
    let optimized = fileContent;

    // Remove comments if enabled
    if (this.options.removeComments) {
      optimized = this.removeComments(optimized, filePath);
    }

    // Remove empty lines if enabled
    if (this.options.removeEmptyLines) {
      optimized = this.removeEmptyLines(optimized);
    }

    // Keep only signatures if enabled
    if (this.options.keepSignatures) {
      optimized = this.extractSignatures(optimized, filePath);
    }

    // Truncate to max length
    if (optimized.length > this.options.maxLength!) {
      optimized = this.truncate(optimized, this.options.maxLength!);
    }

    const endTime = Date.now();
    const compressedSize = optimized.length;

    const stats: CompressionStats = {
      originalSize,
      compressedSize,
      reduction: ((originalSize - compressedSize) / originalSize) * 100,
      reductionBytes: originalSize - compressedSize,
      compressionTime: endTime - startTime,
    };

    return { data: optimized, stats };
  }

  /**
   * Remove comments from code
   */
  private removeComments(content: string, filePath: string): string {
    const ext = this.getExtension(filePath);

    // Language-specific comment patterns
    const patterns: Record<string, RegExp[]> = {
      '.js': [
        /\/\/.*$/gm, // Single line
        /\/\*[\s\S]*?\*\//g, // Multi-line
      ],
      '.ts': [
        /\/\/.*$/gm,
        /\/\*[\s\S]*?\*\//g,
      ],
      '.tsx': [
        /\/\/.*$/gm,
        /\/\*[\s\S]*?\*\//g,
        /\{\/\*[\s\S]*?\*\/\}/g, // JSX comments
      ],
      '.jsx': [
        /\/\/.*$/gm,
        /\/\*[\s\S]*?\*\//g,
        /\{\/\*[\s\S]*?\*\/\}/g,
      ],
      '.py': [
        /#.*$/gm, // Single line
        /"""[\s\S]*?"""/g, // Multi-line
        /'''[\s\S]*?'''/g,
      ],
    };

    const langPatterns = patterns[ext] || patterns['.js'];

    let result = content;
    for (const pattern of langPatterns) {
      result = result.replace(pattern, '');
    }

    return result;
  }

  /**
   * Remove empty lines
   */
  private removeEmptyLines(content: string): string {
    return content
      .split('\n')
      .filter(line => line.trim().length > 0)
      .join('\n');
  }

  /**
   * Extract only signatures (imports, exports, function/class declarations)
   */
  private extractSignatures(content: string, filePath: string): string {
    const ext = this.getExtension(filePath);
    const lines = content.split('\n');
    const signatures: string[] = [];

    const patterns: Record<string, RegExp[]> = {
      '.ts': [
        /^import .* from .*$/,
        /^export .*$/,
        /^interface .*/,
        /^type .*/,
        /^class .*/,
        /^function .*/,
        /^const .*=.*=>.*$/,
        /^async function .*/,
      ],
      '.js': [
        /^import .* from .*$/,
        /^export .*$/,
        /^class .*/,
        /^function .*/,
        /^const .*=.*=>.*$/,
        /^async function .*/,
      ],
      '.py': [
        /^import .*$/,
        /^from .* import .*$/,
        /^class .*/,
        /^def .*/,
      ],
    };

    const langPatterns = patterns[ext] || patterns['.js'];

    for (const line of lines) {
      for (const pattern of langPatterns) {
        if (pattern.test(line.trim())) {
          signatures.push(line);
          break;
        }
      }
    }

    return signatures.join('\n');
  }

  /**
   * Truncate content to max length
   */
  private truncate(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;

    // Keep structure by keeping first and last parts
    const firstPartSize = Math.floor(maxLength * 0.7);
    const lastPartSize = maxLength - firstPartSize - 50; // 50 chars for separator

    const firstPart = content.substring(0, firstPartSize);
    const lastPart = content.substring(content.length - lastPartSize);

    return `${firstPart}\n\n... [truncated] ...\n\n${lastPart}`;
  }

  /**
   * Get file extension
   */
  private getExtension(filePath: string): string {
    const parts = filePath.split('.');
    return parts.length > 1 ? `.${parts.pop()}` : '';
  }

  /**
   * Optimize multiple files
   */
  optimizeMultiple(files: Map<string, string>): CompressionResult<Map<string, string>> {
    const startTime = Date.now();
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;

    const optimized = new Map<string, string>();

    for (const [path, content] of files.entries()) {
      const result = this.optimize(path, content);
      optimized.set(path, result.data);
      totalOriginalSize += result.stats.originalSize;
      totalCompressedSize += result.stats.compressedSize;
    }

    const endTime = Date.now();

    const stats: CompressionStats = {
      originalSize: totalOriginalSize,
      compressedSize: totalCompressedSize,
      reduction: ((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100,
      reductionBytes: totalOriginalSize - totalCompressedSize,
      compressionTime: endTime - startTime,
    };

    return { data: optimized, stats };
  }
}
