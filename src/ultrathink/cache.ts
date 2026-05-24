/**
 * Project Context Cache
 *
 * Caches project information to reduce redundant data transfer.
 * Generates compact project summaries for subsequent API calls.
 *
 * Strategy:
 * 1. First call: Full project info (~400KB)
 * 2. Subsequent calls: Project summary (~50KB)
 * 3. Cache invalidation: When project structure changes
 */

import * as crypto from 'crypto';
import { Config } from '../config';

// ============================================================================
// CACHE ENTRY
// ============================================================================

/**
 * Cached project information
 */
export interface ProjectCacheEntry {
  hash: string; // Hash of project structure (for invalidation)
  fullInfo: Record<string, string>; // Complete project file contents
  summary: ProjectSummary; // Compact summary
  createdAt: number; // Cache creation timestamp
  lastAccessed: number; // Last access timestamp
  accessCount: number; // Number of times accessed
}

/**
 * Compact project summary
 */
export interface ProjectSummary {
  fileTree: FileTreeNode[]; // Hierarchical file structure
  keyFiles: Map<string, string>; // Important file contents
  totalFiles: number;
  totalLines: number;
  languages: string[]; // Detected programming languages
  framework?: string; // Detected framework (React, Vue, etc.)
  metadata: {
    generatedAt: number;
    estimatedTokens: number; // Estimated token count
  };
}

/**
 * File tree node
 */
export interface FileTreeNode {
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  language?: string; // For files
  size?: number; // Line count for files
  isKeyFile?: boolean; // Marked as important
}

// ============================================================================
// PROJECT CACHE
// ============================================================================

export class ProjectContextCache {
  private cache: Map<string, ProjectCacheEntry> = new Map();
  private currentHash: string | null = null;
  private currentSummary: ProjectSummary | null = null;

  constructor(private config: Config) {}

  // ---------------------------------------------------------------------------
  // CACHE MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Get or create cache entry for project
   */
  async getOrCreate(projectInfo: Record<string, string>): Promise<{
    entry: ProjectCacheEntry;
    isNew: boolean;
  }> {
    const hash = this.computeProjectHash(projectInfo);

    // Check if we have a valid cache
    const existing = this.cache.get(hash);
    if (existing && this.isCacheValid(existing)) {
      existing.lastAccessed = Date.now();
      existing.accessCount++;

      this.currentHash = hash;
      this.currentSummary = existing.summary;

      return { entry: existing, isNew: false };
    }

    // Create new cache entry
    const entry = await this.createCacheEntry(projectInfo, hash);
    this.cache.set(hash, entry);
    this.currentHash = hash;
    this.currentSummary = entry.summary;

    return { entry, isNew: true };
  }

  /**
   * Create a new cache entry
   */
  private async createCacheEntry(
    projectInfo: Record<string, string>,
    hash: string
  ): Promise<ProjectCacheEntry> {
    const now = Date.now();

    // Generate file tree
    const fileTree = this.buildFileTree(projectInfo);

    // Identify key files
    const keyFiles = this.identifyKeyFiles(projectInfo);

    // Detect languages and framework
    const languages = this.detectLanguages(projectInfo);
    const framework = this.detectFramework(projectInfo);

    // Calculate statistics
    const totalFiles = Object.keys(projectInfo).length;
    const totalLines = Object.values(projectInfo).reduce(
      (sum, content) => sum + content.split('\n').length,
      0
    );

    // Build summary
    const summary: ProjectSummary = {
      fileTree,
      keyFiles,
      totalFiles,
      totalLines,
      languages,
      framework,
      metadata: {
        generatedAt: now,
        estimatedTokens: this.estimateTokenCount(projectInfo),
      },
    };

    return {
      hash,
      fullInfo: projectInfo,
      summary,
      createdAt: now,
      lastAccessed: now,
      accessCount: 1,
    };
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(entry: ProjectCacheEntry): boolean {
    const age = Date.now() - entry.lastAccessed;
    const maxAge = 60 * 60 * 1000; // 1 hour

    return age < maxAge;
  }

  /**
   * Compute hash of project structure (for cache invalidation)
   */
  private computeProjectHash(projectInfo: Record<string, string>): string {
    const keys = Object.keys(projectInfo).sort();
    const hash = crypto.createHash('sha256');

    for (const key of keys) {
      // Hash file path and first 100 characters (detects changes)
      const preview = projectInfo[key].substring(0, 100);
      hash.update(`${key}:${preview}`);
    }

    return hash.digest('hex').substring(0, 16);
  }

  // ---------------------------------------------------------------------------
  // FILE TREE BUILDER
  // ---------------------------------------------------------------------------

  /**
   * Build hierarchical file tree
   */
  private buildFileTree(projectInfo: Record<string, string>): FileTreeNode[] {
    const root: FileTreeNode[] = [];
    const map = new Map<string, FileTreeNode>();

    // Create all nodes
    for (const filePath of Object.keys(projectInfo)) {
      const parts = filePath.split('/');
      let currentPath = '';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        let node = map.get(currentPath);

        if (!node) {
          node = {
            path: currentPath,
            type: isLast ? 'file' : 'directory',
            language: isLast ? this.detectLanguage(currentPath) : undefined,
            size: isLast ? projectInfo[filePath].split('\n').length : undefined,
          };

          map.set(currentPath, node);

          // Add to parent or root
          if (i === 0) {
            root.push(node);
          } else {
            const parentPath = parts.slice(0, i).join('/');
            const parent = map.get(parentPath);
            if (parent) {
              if (!parent.children) {
                parent.children = [];
              }
              parent.children.push(node);
            }
          }
        }
      }
    }

    return root;
  }

  // ---------------------------------------------------------------------------
  // KEY FILE IDENTIFICATION
  // ---------------------------------------------------------------------------

  /**
   * Identify important files in the project
   */
  private identifyKeyFiles(projectInfo: Record<string, string>): Map<string, string> {
    const keyFiles = new Map<string, string>();

    for (const [filePath, content] of Object.entries(projectInfo)) {
      if (this.isKeyFile(filePath)) {
        // Store first 50 lines for context
        const lines = content.split('\n');
        const preview = lines.slice(0, 50).join('\n');
        keyFiles.set(filePath, preview);
      }
    }

    return keyFiles;
  }

  /**
   * Check if a file is important
   */
  private isKeyFile(filePath: string): boolean {
    // Config files
    if (filePath.endsWith('.json')) return true;
    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) return true;
    if (filePath.endsWith('.toml')) return true;

    // Entry points
    if (filePath.includes('index.') || filePath.includes('main.') || filePath.includes('app.')) {
      return true;
    }

    // Important TypeScript/JavaScript files
    if (filePath.includes('src/') && (filePath.endsWith('.ts') || filePath.endsWith('.js'))) {
      return true;
    }

    // Package and config files
    if (filePath.endsWith('package.json')) return true;
    if (filePath.endsWith('tsconfig.json')) return true;
    if (filePath.endsWith('.config.js') || filePath.endsWith('.config.ts')) return true;

    // Documentation
    if (filePath.endsWith('README.md')) return true;
    if (filePath.endsWith('CLAUDE.md')) return true;

    return false;
  }

  // ---------------------------------------------------------------------------
  // LANGUAGE DETECTION
  // ---------------------------------------------------------------------------

  /**
   * Detect programming languages used in project
   */
  private detectLanguages(projectInfo: Record<string, string>): string[] {
    const extensions = new Set<string>();

    for (const filePath of Object.keys(projectInfo)) {
      const ext = filePath.split('.').pop();
      if (ext) {
        extensions.add(ext);
      }
    }

    const languageMap: Record<string, string> = {
      ts: 'TypeScript',
      js: 'JavaScript',
      py: 'Python',
      rs: 'Rust',
      go: 'Go',
      java: 'Java',
      cpp: 'C++',
      c: 'C',
      css: 'CSS',
      html: 'HTML',
      json: 'JSON',
      md: 'Markdown',
      yaml: 'YAML',
      yml: 'YAML',
    };

    const languages = new Set<string>();
    for (const ext of extensions) {
      const lang = languageMap[ext];
      if (lang) {
        languages.add(lang);
      }
    }

    return Array.from(languages);
  }

  /**
   * Detect language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop();

    const languageMap: Record<string, string> = {
      ts: 'TypeScript',
      js: 'JavaScript',
      py: 'Python',
      rs: 'Rust',
      go: 'Go',
      java: 'Java',
      cpp: 'C++',
      c: 'C',
      css: 'CSS',
      html: 'HTML',
      json: 'JSON',
      md: 'Markdown',
      yaml: 'YAML',
      yml: 'YAML',
    };

    return languageMap[ext || ''] || 'Unknown';
  }

  /**
   * Detect framework used in project
   */
  private detectFramework(projectInfo: Record<string, string>): string | undefined {
    for (const filePath of Object.keys(projectInfo)) {
      // React
      if (filePath.includes('react') || filePath.includes('jsx') || filePath.includes('tsx')) {
        return 'React';
      }

      // Vue
      if (filePath.includes('vue')) {
        return 'Vue';
      }

      // Angular
      if (filePath.includes('angular')) {
        return 'Angular';
      }

      // Next.js
      if (filePath.includes('next')) {
        return 'Next.js';
      }

      // Express
      if (filePath.includes('express')) {
        return 'Express';
      }

      // FastAPI
      if (filePath.includes('fastapi')) {
        return 'FastAPI';
      }

      // Django
      if (filePath.includes('django')) {
        return 'Django';
      }
    }

    return undefined;
  }

  // ---------------------------------------------------------------------------
  // TOKEN ESTIMATION
  // ---------------------------------------------------------------------------

  /**
   * Estimate token count for project info
   */
  private estimateTokenCount(projectInfo: Record<string, string>): number {
    let totalChars = 0;

    for (const content of Object.values(projectInfo)) {
      totalChars += content.length;
    }

    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(totalChars / 4);
  }

  // ---------------------------------------------------------------------------
  // PUBLIC ACCESSORS
  // ---------------------------------------------------------------------------

  /**
   * Get current project summary
   */
  getCurrentSummary(): ProjectSummary | null {
    return this.currentSummary;
  }

  /**
   * Get full project info (bypass cache)
   */
  async getFullInfo(projectInfo: Record<string, string>): Promise<Record<string, string>> {
    const { entry } = await this.getOrCreate(projectInfo);
    return entry.fullInfo;
  }

  /**
   * Get project summary (use cached if available)
   */
  async getSummary(projectInfo: Record<string, string>): Promise<ProjectSummary> {
    const { entry } = await this.getOrCreate(projectInfo);
    return entry.summary;
  }

  /**
   * Format summary as text for API prompt
   */
  formatSummaryForPrompt(summary: ProjectSummary): string {
    const lines: string[] = [];

    lines.push('PROJECT STRUCTURE:');
    lines.push(`- Files: ${summary.totalFiles}`);
    lines.push(`- Lines: ${summary.totalLines}`);
    lines.push(`- Languages: ${summary.languages.join(', ')}`);
    if (summary.framework) {
      lines.push(`- Framework: ${summary.framework}`);
    }
    lines.push('');

    // File tree (simplified)
    lines.push('FILE TREE:');
    this.renderFileTree(summary.fileTree, lines, 0, 10);
    lines.push('');

    // Key files preview
    if (summary.keyFiles.size > 0) {
      lines.push('KEY FILES:');
      for (const [path, content] of Array.from(summary.keyFiles.entries()).slice(0, 10)) {
        lines.push(`\n${path}:`);
        lines.push('```');
        lines.push(content);
        lines.push('```');
      }
    }

    return lines.join('\n');
  }

  /**
   * Render file tree as text
   */
  private renderFileTree(
    nodes: FileTreeNode[],
    lines: string[],
    depth: number,
    maxDepth: number,
    prefix: string = ''
  ): void {
    if (depth > maxDepth) return;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const isLast = i === nodes.length - 1;
      const connector = isLast ? '└──' : '├──';

      const icon = node.type === 'directory' ? '📁' : '📄';
      const size = node.size ? ` (${node.size} lines)` : '';

      lines.push(`${prefix}${connector} ${icon} ${node.path.split('/').pop()}${size}`);

      if (node.children && node.children.length > 0) {
        const childPrefix = prefix + (isLast ? '    ' : '│   ');
        this.renderFileTree(node.children, lines, depth + 1, maxDepth, childPrefix);
      }
    }
  }

  /**
   * Clear cache (for testing)
   */
  clear(): void {
    this.cache.clear();
    this.currentHash = null;
    this.currentSummary = null;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    entries: number;
    totalAccessCount: number;
    currentHash: string | null;
  } {
    const totalAccessCount = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.accessCount, 0);

    return {
      entries: this.cache.size,
      totalAccessCount,
      currentHash: this.currentHash,
    };
  }
}
