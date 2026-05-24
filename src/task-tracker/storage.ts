/**
 * Task Storage - File persistence with compression
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { gzipSync, gunzipSync } from 'zlib';
import { TaskDocument, TaskFilter, TaskStorageConfig, CompressionStats } from './types';

/**
 * Task storage class
 * Handles file I/O and compression
 */
export class TaskStorage {
  private dataDir: string;
  private compressAfterDays: number;
  private compressionLevel: number;

  constructor(config: TaskStorageConfig) {
    this.dataDir = config.dataDir;
    this.compressAfterDays = config.compressAfterDays;
    this.compressionLevel = config.compressionLevel;
  }

  /**
   * Save task to disk
   */
  async save(task: TaskDocument): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(this.dataDir, { recursive: true });

      // Determine file path
      const taskPath = this.getTaskPath(task.id, false);
      const json = JSON.stringify(task, null, 2);

      // Check if should compress
      if (this.shouldCompress(task)) {
        const compressed = gzipSync(Buffer.from(json));
        await fs.writeFile(taskPath + '.gz', compressed);
        task.compressedAt = new Date().toISOString();
      } else {
        await fs.writeFile(taskPath, json, 'utf-8');
      }
    } catch (error) {
      console.warn(`⚠️  Failed to save task ${task.id}:`, (error as Error).message);
      throw error;
    }
  }

  /**
   * Load task from disk
   */
  async load(id: string): Promise<TaskDocument | null> {
    try {
      // Try compressed first
      const compressedPath = this.getTaskPath(id, true);
      try {
        const compressed = await fs.readFile(compressedPath);
        const decompressed = gunzipSync(compressed);
        return JSON.parse(decompressed.toString()) as TaskDocument;
      } catch {
        // Fall back to plain
      }

      // Try plain
      const plainPath = this.getTaskPath(id, false);
      const json = await fs.readFile(plainPath, 'utf-8');
      return JSON.parse(json) as TaskDocument;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * List all tasks with optional filtering
   */
  async list(filter?: TaskFilter): Promise<TaskDocument[]> {
    try {
      const files = await fs.readdir(this.dataDir);
      const tasks: TaskDocument[] = [];

      for (const file of files) {
        if (!file.endsWith('.json') && !file.endsWith('.json.gz')) {
          continue;
        }

        // Extract ID from filename
        const id = file.replace('.json', '').replace('.gz', '');
        const task = await this.load(id);

        if (task && this.matchesFilter(task, filter)) {
          tasks.push(task);
        }
      }

      // Sort by creation date, newest first
      tasks.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Apply limit
      if (filter?.limit) {
        return tasks.slice(0, filter.limit);
      }

      return tasks;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Compress old tasks
   */
  async compressOldTasks(): Promise<CompressionStats> {
    const startTime = Date.now();
    let compressedCount = 0;
    let originalSize = 0;
    let compressedSize = 0;

    try {
      const files = await fs.readdir(this.dataDir);

      for (const file of files) {
        if (!file.endsWith('.json') || file.endsWith('.json.gz')) {
          continue;
        }

        const taskPath = join(this.dataDir, file);
        const task = await this.load(file.replace('.json', ''));

        if (!task || !this.shouldCompress(task)) {
          continue;
        }

        // Read original
        const original = await fs.readFile(taskPath, 'utf-8');
        originalSize += original.length;

        // Compress
        const compressed = gzipSync(Buffer.from(original));
        compressedSize += compressed.length;

        // Write compressed
        await fs.writeFile(taskPath + '.gz', compressed);

        // Delete original
        await fs.unlink(taskPath);

        compressedCount++;
      }

      const duration = Date.now() - startTime;
      const reduction = originalSize > 0 ? ((originalSize - compressedSize) / originalSize) * 100 : 0;

      return {
        compressedCount,
        originalSize,
        compressedSize,
        reduction,
        duration,
      };
    } catch (error) {
      console.warn('⚠️  Error during task compression:', (error as Error).message);
      return {
        compressedCount,
        originalSize,
        compressedSize,
        reduction: 0,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Delete task
   */
  async delete(id: string): Promise<void> {
    try {
      const plainPath = this.getTaskPath(id, false);
      const compressedPath = this.getTaskPath(id, true);

      // Try to delete both
      try {
        await fs.unlink(plainPath);
      } catch {
        // Ignore if doesn't exist
      }

      try {
        await fs.unlink(compressedPath);
      } catch {
        // Ignore if doesn't exist
      }
    } catch (error) {
      console.warn(`⚠️  Failed to delete task ${id}:`, (error as Error).message);
      throw error;
    }
  }

  /**
   * Get file path for task
   */
  private getTaskPath(id: string, compressed: boolean): string {
    const filename = `${id}.json${compressed ? '.gz' : ''}`;
    return join(this.dataDir, filename);
  }

  /**
   * Check if task should be compressed
   */
  private shouldCompress(task: TaskDocument): boolean {
    // Don't compress if already compressed
    if (task.compressedAt) {
      return false;
    }

    // Check age
    const createdAt = new Date(task.createdAt);
    const daysOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    return daysOld >= this.compressAfterDays;
  }

  /**
   * Check if task matches filter
   */
  private matchesFilter(task: TaskDocument, filter?: TaskFilter): boolean {
    if (!filter) {
      return true;
    }

    if (filter.status && task.metadata.status !== filter.status) {
      return false;
    }

    if (filter.mode && task.mode !== filter.mode) {
      return false;
    }

    if (filter.startDate) {
      const taskDate = new Date(task.createdAt);
      if (taskDate < filter.startDate) {
        return false;
      }
    }

    if (filter.endDate) {
      const taskDate = new Date(task.createdAt);
      if (taskDate > filter.endDate) {
        return false;
      }
    }

    return true;
  }
}
