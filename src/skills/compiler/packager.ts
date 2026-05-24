/**
 * Skill Packager
 * Packages skills into distributable .kode.tar.gz format
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as tar from 'tar';
import * as zlib from 'zlib';
import * as os from 'os';
import { promisify } from 'util';
import type {
  SkillPackage,
  BundlerOptions,
  BundleResult
} from './types';
import type { SkillMetadata } from '../types';
import { extractMetadata } from '../metadata';

const gzip = promisify(zlib.gzip);

/**
 * Package format version
 */
const PACKAGE_FORMAT_VERSION = '1.0.0';

/**
 * Create a skill package (.kode.tar.gz)
 */
export async function createSkillPackage(
  skillPath: string,
  options: {
    outFile?: string;
    includeSource?: boolean;
    minify?: boolean;
    verbose?: boolean;
  } = {}
): Promise<{
  success: boolean;
  packageFile: string;
  package: SkillPackage;
  size: number;
}> {
  const {
    outFile,
    includeSource = true,
    minify = false,
    verbose = false,
  } = options;

  try {
    // Extract metadata
    const { metadata } = await extractMetadata(skillPath);

    // Collect files to package
    const files = await collectPackageFiles(skillPath, {
      includeSource,
      minify,
    });

    // Create package metadata
    const skillPackage: SkillPackage = {
      metadata,
      version: metadata.version,
      name: metadata.id,
      files: files.map(f => path.relative(skillPath, f)),
      timestamp: new Date().toISOString(),
    };

    // Calculate checksum
    const checksum = await calculateChecksum(files);
    skillPackage.checksum = checksum;

    // Create package directory structure
    const stagingDir = path.join(process.cwd(), '.kode-staging', metadata.id);
    await fs.mkdir(stagingDir, { recursive: true });

    // Copy files to staging
    await Promise.all(
      files.map(async (file) => {
        const dest = path.join(stagingDir, path.relative(skillPath, file));
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(file, dest);
      })
    );

    // Write package metadata
    await fs.writeFile(
      path.join(stagingDir, 'package.json'),
      JSON.stringify(skillPackage, null, 2),
      'utf-8'
    );

    // Create tarball
    const outputFile = outFile || path.join(process.cwd(), `${metadata.id}-${metadata.version}.kode.tar.gz`);
    await createTarball(stagingDir, outputFile);

    // Get file size
    const stats = await fs.stat(outputFile);

    // Clean up staging
    await fs.rm(stagingDir, { recursive: true, force: true });

    if (verbose) {
      console.log(`✅ Package created: ${outputFile}`);
      console.log(`   Size: ${formatBytes(stats.size)}`);
      console.log(`   Files: ${files.length}`);
    }

    return {
      success: true,
      packageFile: outputFile,
      package: skillPackage,
      size: stats.size,
    };
  } catch (error: any) {
    throw new Error(`Failed to create package: ${error.message}`);
  }
}

/**
 * Collect files to include in package
 */
async function collectPackageFiles(
  skillPath: string,
  options: {
    includeSource: boolean;
    minify: boolean;
  }
): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(skillPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(skillPath, entry.name);

    // Skip common ignore patterns
    if (shouldIgnore(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      const subFiles = await collectPackageFiles(fullPath, options);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      // Include compiled files, metadata, and optionally source
      if (entry.name.endsWith('.js') ||
          entry.name.endsWith('.d.ts') ||
          entry.name === 'SKILL.md' ||
          entry.name.endsWith('.json') ||
          (options.includeSource && entry.name.endsWith('.ts'))) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Check if file/directory should be ignored
 */
function shouldIgnore(name: string): boolean {
  const ignorePatterns = [
    'node_modules',
    'dist',
    '.git',
    '.DS_Store',
    '*.log',
    '.env',
    '__pycache__',
    '.pytest_cache',
    'coverage',
    '.nyc_output',
  ];

  return ignorePatterns.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      return regex.test(name);
    }
    return name === pattern;
  });
}

/**
 * Calculate checksum for files
 */
async function calculateChecksum(files: string[]): Promise<string> {
  const hash = crypto.createHash('sha256');

  for (const file of files) {
    const content = await fs.readFile(file);
    hash.update(content);
  }

  return hash.digest('hex');
}

/**
 * Create tarball from directory
 */
async function createTarball(sourceDir: string, outputFile: string): Promise<void> {
  await tar.c(
    {
      gzip: true,
      file: outputFile,
      cwd: sourceDir,
    },
    ['.']
  );
}

/**
 * Extract skill package
 */
export async function extractSkillPackage(
  packageFile: string,
  targetDir: string
): Promise<{
  success: boolean;
  package: SkillPackage;
  files: string[];
}> {
  try {
    // Extract tarball
    await tar.x({
      file: packageFile,
      cwd: targetDir,
    });

    // Read package metadata
    const packagePath = path.join(targetDir, 'package.json');
    const packageContent = await fs.readFile(packagePath, 'utf-8');
    const skillPackage: SkillPackage = JSON.parse(packageContent);

    // List extracted files
    const files: string[] = [];
    const entries = await fs.readdir(targetDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name !== 'package.json') {
        const fullPath = path.join(targetDir, entry.name);
        files.push(fullPath);
      }
    }

    return {
      success: true,
      package: skillPackage,
      files,
    };
  } catch (error: any) {
    throw new Error(`Failed to extract package: ${error.message}`);
  }
}

/**
 * Bundle skill into single file
 */
export async function bundleSkill(
  skillPath: string,
  options: BundlerOptions
): Promise<BundleResult> {
  const startTime = Date.now();
  const {
    outFile,
    format = 'cjs',
    external = [],
    minify = false,
    sourceMap = false,
  } = options;

  try {
    // This is a placeholder for bundling logic
    // In production, you'd use esbuild, webpack, or rollup
    const content = await generateBundle(skillPath, {
      format,
      external,
    });

    let finalContent = content;

    // Minify if requested
    if (minify) {
      finalContent = await minifyContent(content);
    }

    // Write bundle
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await fs.writeFile(outFile, finalContent, 'utf-8');

    // Write source map if requested
    if (sourceMap) {
      const mapPath = `${outFile}.map`;
      await fs.writeFile(mapPath, JSON.stringify({ version: 3, file: path.basename(outFile) }), 'utf-8');
    }

    const stats = await fs.stat(outFile);

    return {
      success: true,
      file: outFile,
      size: stats.size,
      minifiedSize: minify ? Buffer.byteLength(finalContent, 'utf-8') : undefined,
      bundleTime: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      file: outFile,
      size: 0,
      bundleTime: Date.now() - startTime,
      errors: [error.message],
    };
  }
}

/**
 * Generate bundle content
 */
async function generateBundle(
  skillPath: string,
  options: { format: string; external: string[] }
): Promise<string> {
  // Placeholder: In production, use bundler
  // For now, just read the main entry point
  const { metadata } = await extractMetadata(skillPath);

  let entryPoint: string;
  if (metadata.type === 'code' || metadata.type === 'hybrid') {
    entryPoint = path.join(skillPath, 'code.ts');
  } else {
    throw new Error('Cannot bundle knowledge skills');
  }

  const content = await fs.readFile(entryPoint, 'utf-8');

  // Wrap in module format
  if (options.format === 'cjs') {
    return `"use strict";\nmodule.exports = ${content};`;
  } else {
    return `export default ${content};`;
  }
}

/**
 * Minify content
 */
async function minifyContent(content: string): Promise<string> {
  // Simple minification: remove comments and extra whitespace
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Verify package integrity
 */
export async function verifyPackage(packageFile: string): Promise<{
  valid: boolean;
  package?: SkillPackage;
  error?: string;
}> {
  try {
    // Extract to temp directory
    const tempDir = path.join(os.tmpdir(), 'kode-verify-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });

    const result = await extractSkillPackage(packageFile, tempDir);

    // Verify checksum
    const files = result.files.filter(f => f !== path.join(tempDir, 'package.json'));
    const actualChecksum = await calculateChecksum(files);

    if (actualChecksum !== result.package.checksum) {
      await fs.rm(tempDir, { recursive: true, force: true });
      return {
        valid: false,
        error: `Checksum mismatch: expected ${result.package.checksum}, got ${actualChecksum}`,
      };
    }

    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true });

    return {
      valid: true,
      package: result.package,
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message,
    };
  }
}
