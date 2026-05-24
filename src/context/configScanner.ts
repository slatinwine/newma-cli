// src/context/configScanner.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface ProjectContext {
  globalSoul: string | null;
  projectSoul: string | null;
  projectRules: string | null;
  subDirRules: Map<string, string>;
  projectRoot: string | null;
}

export interface ConfigScannerOptions {
  maxDepth?: number;
  cacheTTL?: number;
  excludeDirs?: string[];
}

const CONFIG_FILES = ['NEWMA.md', 'CLAUDE.md'];
const SOUL_FILE = 'SOUL.md';
const NEWMA_DIR = '.newma';

export class ConfigScanner {
  private cache = new Map<string, ProjectContext>();
  private mtimeCache = new Map<string, number>();
  private options: Required<ConfigScannerOptions>;

  constructor(options: ConfigScannerOptions = {}) {
    this.options = {
      maxDepth: options.maxDepth ?? 5,
      cacheTTL: options.cacheTTL ?? 30000,
      excludeDirs: options.excludeDirs ?? ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt', 'target', 'bin', 'obj'],
    };
  }

  async scan(cwd: string): Promise<ProjectContext> {
    const cached = this.cache.get(cwd);
    if (cached && Date.now() - (this.mtimeCache.get(cwd) || 0) < this.options.cacheTTL) {
      return cached;
    }

    const startTime = Date.now();
    const projectRoot = this.findProjectRoot(cwd);

    const [globalSoul, projectSoul, projectRules, subDirRules] = await Promise.all([
      this.readIfExists(path.join(os.homedir(), NEWMA_DIR, SOUL_FILE)),
      projectRoot ? this.readIfExists(path.join(projectRoot, NEWMA_DIR, SOUL_FILE)) : Promise.resolve(null),
      projectRoot ? this.findFileUpward(projectRoot, CONFIG_FILES) : Promise.resolve(null),
      projectRoot ? this.scanSubDirs(projectRoot, CONFIG_FILES) : Promise.resolve(new Map()),
    ]);

    const ctx: ProjectContext = { globalSoul, projectSoul, projectRules, subDirRules, projectRoot };
    this.cache.set(cwd, ctx);
    this.mtimeCache.set(cwd, Date.now());

    return ctx;
  }

  buildPrompt(ctx: ProjectContext): string {
    const parts: string[] = [];
    if (ctx.globalSoul) {
      parts.push('# Global Soul (~/.newma/SOUL.md)');
      parts.push(ctx.globalSoul);
      parts.push('');
    }
    if (ctx.projectSoul) {
      parts.push('# Project Soul (.newma/SOUL.md)');
      parts.push(ctx.projectSoul);
      parts.push('');
    }
    if (ctx.projectRules) {
      parts.push('# Project Rules (NEWMA.md)');
      parts.push(ctx.projectRules);
      parts.push('');
    }
    if (ctx.subDirRules.size > 0) {
      const sortedDirs = Array.from(ctx.subDirRules.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      for (const [dir, content] of sortedDirs) {
        parts.push('# Subdirectory (' + dir + '/NEWMA.md)');
        parts.push(content);
        parts.push('');
      }
    }
    return parts.join('\n');
  }

  invalidate(cwd?: string): void {
    if (cwd) {
      this.cache.delete(cwd);
      this.mtimeCache.delete(cwd);
    } else {
      this.cache.clear();
      this.mtimeCache.clear();
    }
  }

  getCacheStats(): { size: number; keys: string[] } {
    return { size: this.cache.size, keys: Array.from(this.cache.keys()) };
  }

  private findProjectRoot(cwd: string): string | null {
    let dir = cwd;
    while (dir !== path.dirname(dir)) {
      const packageJsonPath = path.join(dir, 'package.json');
      const gitPath = path.join(dir, '.git');
      try {
        (fs as any).accessSync(packageJsonPath);
        return dir;
      } catch (_e) { /* configScanner: root detection */ }
      try {
        (fs as any).accessSync(gitPath);
        return dir;
      } catch (_e) { /* configScanner: git detection */ }
      dir = path.dirname(dir);
    }
    return cwd;
  }

  private async findFileUpward(startDir: string, filenames: string[]): Promise<string | null> {
    let dir = startDir;
    while (dir !== path.dirname(dir)) {
      for (const filename of filenames) {
        const content = await this.readIfExists(path.join(dir, filename));
        if (content !== null) return content;
      }
      dir = path.dirname(dir);
    }
    return null;
  }

  private async scanSubDirs(projectRoot: string, filenames: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    await this.scanDirRecursive(projectRoot, filenames, results, 0);
    return results;
  }

  private async scanDirRecursive(dir: string, filenames: string[], results: Map<string, string>, depth: number): Promise<void> {
    if (depth >= this.options.maxDepth) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (this.shouldExclude(entry.name)) continue;
      const subDir = path.join(dir, entry.name);
      for (const filename of filenames) {
        const content = await this.readIfExists(path.join(subDir, filename));
        if (content !== null) {
          const relPath = path.relative(dir, subDir);
          results.set(relPath, content);
        }
      }
      await this.scanDirRecursive(subDir, filenames, results, depth + 1);
    }
  }

  private shouldExclude(dirName: string): boolean {
    if (dirName.startsWith('.')) return true;
    if (this.options.excludeDirs.includes(dirName)) return true;
    return false;
  }

  private async readIfExists(filePath: string): Promise<string | null> {
    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile()) return await fs.readFile(filePath, 'utf-8');
    } catch (_e) { /* configScanner: readdir failed */ }
    return null;
  }
}

let scannerInstance: ConfigScanner | null = null;

export function getConfigScanner(options?: ConfigScannerOptions): ConfigScanner {
  if (!scannerInstance) {
    scannerInstance = new ConfigScanner(options);
  }
  return scannerInstance;
}

export async function scanCurrentProject(): Promise<ProjectContext> {
  const scanner = getConfigScanner();
  return await scanner.scan(process.cwd());
}

export async function buildProjectContextPrompt(): Promise<string> {
  const context = await scanCurrentProject();
  const scanner = getConfigScanner();
  return scanner.buildPrompt(context);
}
