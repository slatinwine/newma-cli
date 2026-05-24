// src/rollback.ts
/**
 * Git-based rollback mechanism
 * Creates lightweight restoration points before destructive changes
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Rollback configuration
 */
export interface RollbackConfig {
  enabled: boolean;
  autoCommit: boolean;
  commitMessage: string;
}

/**
 * Checkpoint information
 */
export interface Checkpoint {
  hash: string;
  message: string;
  date: Date;
  timestamp: number;
}

/**
 * Safely execute git command
 */
function safeGitCommand(args: string[], cwd: string): string {
  try {
    const result = execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch (error: any) {
    throw new Error(`Git command failed: ${error.message}`);
  }
}

/**
 * Rollback manager for git-based restoration
 */
export class RollbackManager {
  private projectRoot: string;
  private config: RollbackConfig;
  private isGitRepo: boolean = false;

  constructor(
    projectRoot: string,
    config: Partial<RollbackConfig> = {}
  ) {
    this.projectRoot = projectRoot;
    this.config = {
      enabled: config.enabled ?? true,
      autoCommit: config.autoCommit ?? true,
      commitMessage: config.commitMessage ?? 'kode: checkpoint',
    };
    this.isGitRepo = this.checkGitRepo();
  }

  /**
   * Check if project is a git repository
   */
  private checkGitRepo(): boolean {
    try {
      const gitDir = path.join(this.projectRoot, '.git');
      return fs.existsSync(gitDir);
    } catch {
      return false;
    }
  }

  /**
   * Check if rollback is enabled and available
   */
  isAvailable(): boolean {
    return this.config.enabled && this.isGitRepo;
  }

  /**
   * Create restoration point before destructive action
   * Returns commit hash or null if not applicable
   */
  async createRestorePoint(
    actionType: string,
    filePath?: string
  ): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      // Check if there are changes to commit
      const status = safeGitCommand(['status', '--porcelain'], this.projectRoot);

      if (!status) {
        // No changes, no need for commit
        return null;
      }

      // Create commit with meaningful message
      const target = filePath ? filePath : 'all changes';
      const message = `${this.config.commitMessage}: before ${actionType} on ${target}`;

      // Stage all changes
      safeGitCommand(['add', '-A'], this.projectRoot);

      // Create commit
      safeGitCommand(['commit', '-m', message], this.projectRoot);

      // Get current commit hash
      const hash = safeGitCommand(['rev-parse', 'HEAD'], this.projectRoot);

      return hash;
    } catch (error) {
      console.warn(
        `⚠️ Could not create restore point: ${(error as Error).message}`
      );
      return null;
    }
  }

  /**
   * Rollback to a specific commit
   */
  async rollback(commitHash: string): Promise<boolean> {
    if (!this.isGitRepo) {
      console.warn('⚠️ Not a git repository, cannot rollback');
      return false;
    }

    try {
      // Reset to the commit
      safeGitCommand(['reset', '--hard', commitHash], this.projectRoot);

      // Clean untracked files
      safeGitCommand(['clean', '-fd'], this.projectRoot);

      return true;
    } catch (error) {
      console.error(`❌ Rollback failed: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * List available rollback points (kode commits)
   */
  listRestorePoints(limit: number = 20): Checkpoint[] {
    if (!this.isGitRepo) return [];

    try {
      const output = safeGitCommand(
        ['log', '--oneline', '--grep=^kode:', `-n ${limit}`],
        this.projectRoot
      );

      if (!output) return [];

      return output
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const spaceIndex = line.indexOf(' ');
          const hash = line.substring(0, spaceIndex);
          const message = line.substring(spaceIndex + 1);

          const dateStr = safeGitCommand(
            ['log', '-1', '--format=%ci', hash],
            this.projectRoot
          );

          return {
            hash,
            message,
            date: new Date(dateStr),
            timestamp: new Date(dateStr).getTime(),
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      return [];
    }
  }

  /**
   * Get the latest restore point
   */
  getLatestRestorePoint(): Checkpoint | null {
    const points = this.listRestorePoints(1);
    return points.length > 0 ? points[0] : null;
  }

  /**
   * Create a file backup (non-git fallback)
   */
  async createFileBackup(filePath: string): Promise<string | null> {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      console.warn(
        `⚠️ Could not create file backup for ${filePath}: ${(error as Error).message}`
      );
      return null;
    }
  }

  /**
   * Restore file from backup
   */
  async restoreFileBackup(filePath: string, content: string): Promise<boolean> {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.promises.mkdir(dir, { recursive: true });

      // Write backup content
      await fs.promises.writeFile(filePath, content, 'utf-8');
      return true;
    } catch (error) {
      console.error(
        `❌ Failed to restore file backup for ${filePath}: ${(error as Error).message}`
      );
      return false;
    }
  }

  /**
   * Display restore points in a table format
   */
  displayRestorePoints(): void {
    const points = this.listRestorePoints();

    if (points.length === 0) {
      console.log('No restore points available.');
      return;
    }

    console.log('\n📋 Available Restore Points:');
    console.log('');

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const timeAgo = this.getTimeAgo(point.date);
      console.log(
        `${i + 1}. ${point.hash} - ${point.message} (${timeAgo})`
      );
    }

    console.log('');
  }

  /**
   * Get human-readable time ago string
   */
  private getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) {
      return `${seconds}s ago`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  /**
   * Check if there are uncommitted changes
   */
  hasUncommittedChanges(): boolean {
    if (!this.isGitRepo) return false;

    try {
      const status = safeGitCommand(['status', '--porcelain'], this.projectRoot);
      return status.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get current git status
   */
  getStatus(): string {
    if (!this.isGitRepo) {
      return 'Not a git repository';
    }

    try {
      return safeGitCommand(['status', '--short'], this.projectRoot);
    } catch {
      return 'Error getting git status';
    }
  }
}
