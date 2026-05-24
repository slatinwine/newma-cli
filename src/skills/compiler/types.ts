/**
 * Skill Compiler - Type Definitions
 * Compiles TypeScript skills to JavaScript for distribution
 */

import { SkillMetadata } from '../types';

/**
 * Compilation options
 */
export interface CompilationOptions {
  /** Output directory (default: ./dist) */
  outDir?: string;
  /** Source map generation */
  sourceMap?: boolean;
  /** Declaration file generation */
  declaration?: boolean;
  /** Minification */
  minify?: boolean;
  /** Target ES version */
  target?: 'ES5' | 'ES2015' | 'ES2020' | 'ESNext';
  /** Module format */
  module?: 'CommonJS' | 'ESNext';
  /** Remove comments */
  removeComments?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Compilation result
 */
export interface CompilationResult {
  /** Success status */
  success: boolean;
  /** Output files */
  files: string[];
  /** Source map files */
  sourceMaps?: string[];
  /** Declaration files */
  declarations?: string[];
  /** Compilation errors */
  errors?: CompilationError[];
  /** Compilation time (ms) */
  compilationTime: number;
}

/**
 * Compilation error
 */
export interface CompilationError {
  /** File path */
  file: string;
  /** Line number */
  line: number;
  /** Column number */
  column: number;
  /** Error code */
  code: number;
  /** Error message */
  message: string;
}

/**
 * Bundler options
 */
export interface BundlerOptions {
  /** Output file path */
  outFile: string;
  /** Bundle format */
  format?: 'cjs' | 'esm';
  /** External dependencies (don't bundle) */
  external?: string[];
  /** Minification */
  minify?: boolean;
  /** Source map */
  sourceMap?: boolean;
}

/**
 * Bundle result
 */
export interface BundleResult {
  /** Success status */
  success: boolean;
  /** Output file */
  file: string;
  /** Bundle size (bytes) */
  size: number;
  /** Minified size (bytes) */
  minifiedSize?: number;
  /** Bundling time (ms) */
  bundleTime: number;
  /** Errors */
  errors?: string[];
}

/**
 * Skill package metadata
 */
export interface SkillPackage {
  /** Skill metadata */
  metadata: SkillMetadata;
  /** Package version */
  version: string;
  /** Package name */
  name: string;
  /** Dependencies */
  dependencies?: Record<string, string>;
  /** Dev dependencies */
  devDependencies?: Record<string, string>;
  /** Files included */
  files: string[];
  /** Compiled files */
  compiledFiles?: string[];
  /** Checksum */
  checksum?: string;
  /** Package timestamp */
  timestamp: string;
}
