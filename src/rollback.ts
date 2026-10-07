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
   *
   * 注意：.memo/.kode（记忆与会话产物）被排除在 checkpoint 之外——
   * 它们是运行时数据，不应污染用户的提交历史。
   */
  async createRestorePoint(
    actionType: string,
    filePath?: string
  ): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      // Check if there are changes to commit (excluding runtime dirs)
      const status = safeGitCommand(
        ['status', '--porcelain', '--', ':!.memo', ':!.kode'],
        this.projectRoot
      );

      if (!status) {
        // No changes, no need for commit
        return null;
      }

      // Create commit with meaningful message
      const target = filePath ? filePath : 'all changes';
      const message = `${this.config.commitMessage}: before ${actionType} on ${target}`;

      // Stage all changes (excluding runtime dirs)
      safeGitCommand(['add', '-A', '--', ':!.memo', ':!.kode'], this.projectRoot);

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
   *
   * 注意：默认不再执行 `git clean -fd`——那会连带删除用户未跟踪的文件。
   * 仅在调用方明确传入 cleanUntracked: true 时才清理。
   */
  async rollback(
    commitHash: string,
    options: { cleanUntracked?: boolean } = {}
  ): Promise<boolean> {
    if (!this.isGitRepo) {
      console.warn('⚠️ Not a git repository, cannot rollback');
      return false;
    }

    try {
      // Reset to the commit
      safeGitCommand(['reset', '--hard', commitHash], this.projectRoot);

      // Clean untracked files (opt-in: destructive to user files)
      if (options.cleanUntracked) {
        safeGitCommand(['clean', '-fd'], this.projectRoot);
      }

      return true;
    } catch (error) {
      console.error(`❌ Rollback failed: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Check if a commit is a kode-created checkpoint
   */
  isKodeCheckpoint(commitHash: string): boolean {
    if (!this.isGitRepo) return false;

    try {
      const subject = safeGitCommand(
        ['log', '-1', '--format=%s', commitHash],
        this.projectRoot
      );
      return subject.startsWith(this.config.commitMessage);
    } catch {
      return false;
    }
  }

  /**
   * Get current HEAD hash (null if not a git repo)
   */
  getCurrentHash(): string | null {
    if (!this.isGitRepo) return null;

    try {
      return safeGitCommand(['rev-parse', 'HEAD'], this.projectRoot);
    } catch {
      return null;
    }
  }

  /**
   * Create a git branch (used by time travel to preserve abandoned work)
   */
  createBranch(branchName: string, fromHash?: string): boolean {
    if (!this.isGitRepo) return false;

    try {
      const args = fromHash
        ? ['branch', branchName, fromHash]
        : ['branch', branchName];
      safeGitCommand(args, this.projectRoot);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checkout a branch (creates it from a hash if provided)
   */
  checkoutBranch(branchName: string, createFromHash?: string): boolean {
    if (!this.isGitRepo) return false;

    try {
      if (createFromHash) {
        safeGitCommand(
          ['checkout', '-b', branchName, createFromHash],
          this.projectRoot
        );
      } else {
        safeGitCommand(['checkout', branchName], this.projectRoot);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Commit all pending changes with a message (no-op when clean tree)
   * 排除 .memo/.kode（与 createRestorePoint 一致）
   */
  commitPending(message: string): string | null {
    if (!this.isGitRepo) return null;

    try {
      const status = safeGitCommand(
        ['status', '--porcelain', '--', ':!.memo', ':!.kode'],
        this.projectRoot
      );
      if (!status) {
        return this.getCurrentHash();
      }

      safeGitCommand(['add', '-A', '--', ':!.memo', ':!.kode'], this.projectRoot);
      safeGitCommand(['commit', '-m', message], this.projectRoot);
      return this.getCurrentHash();
    } catch {
      return null;
    }
  }

  /**
   * Get current branch name (null if detached or not a repo)
   */
  getCurrentBranch(): string | null {
    if (!this.isGitRepo) return null;

    try {
      return safeGitCommand(
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        this.projectRoot
      );
    } catch {
      return null;
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
   * 排除 .memo/.kode（与 checkpoint 语义一致：运行时数据不算"未提交变更"）
   */
  hasUncommittedChanges(): boolean {
    if (!this.isGitRepo) return false;

    try {
      const status = safeGitCommand(
        ['status', '--porcelain', '--', ':!.memo', ':!.kode'],
        this.projectRoot
      );
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
