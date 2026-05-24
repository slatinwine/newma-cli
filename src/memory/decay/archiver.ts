/**
 * Memory Decay - Memory Archiver
 *
 * Archives low-score memories to keep the system performant
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';
import { gzipSync, gunzipSync } from 'zlib';
import { MemoryScorer, MemoryScore } from './scorer';

/**
 * Archive operation result
 */
export interface ArchiveResult {
  /**
   * Number of memories archived
   */
  archivedCount: number;

  /**
   * Number of memories skipped
   */
  skippedCount: number;

  /**
   * Number of errors encountered
   */
  errorCount: number;

  /**
   * Space saved (in bytes)
   */
  spaceSaved: number;

  /**
   * List of archived memory IDs
   */
  archivedIds: string[];

  /**
   * Errors that occurred
   */
  errors: Array<{ id: string; error: string }>;
}

/**
 * Archive statistics
 */
export interface ArchiveStatistics {
  /**
   * Total number of archived memories
   */
  totalArchived: number;

  /**
   * Total size of archive (in bytes)
   */
  totalSize: number;

  /**
   * Compression ratio (original / compressed)
   */
  compressionRatio: number;

  /**
   * Oldest archive date
   */
  oldestArchive: string;

  /**
   * Newest archive date
   */
  newestArchive: string;

  /**
   * Archives by type
   */
  byType: Record<string, number>;
}

/**
 * Memory Archiver
 *
 * Moves low-score memories to archive storage and compresses them
 */
export class MemoryArchiver {
  private projectRoot: string;
  private archiveDir: string;
  private scorer: MemoryScorer;

  constructor(projectRoot: string, scorer: MemoryScorer) {
    this.projectRoot = projectRoot;
    this.archiveDir = join(projectRoot, '.memo', 'archive');
    this.scorer = scorer;
  }

  /**
   * Initialize the archiver
   */
  async initialize(): Promise<void> {
    if (!existsSync(this.archiveDir)) {
      await fs.mkdir(this.archiveDir, { recursive: true });
    }
  }

  /**
   * Archive memories with scores below threshold
   */
  async archiveLowScoreMemories(
    threshold: number,
    dataProviders: Map<string, (id: string) => Promise<any>>
  ): Promise<ArchiveResult> {
    const result: ArchiveResult = {
      archivedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      spaceSaved: 0,
      archivedIds: [],
      errors: [],
    };

    try {
      // Get low-score memories
      const lowScores = this.scorer.getLowScoreMemories(threshold);

      for (const score of lowScores) {
        try {
          // Get data provider for this memory type
          const provider = dataProviders.get(score.type);
          if (!provider) {
            result.skippedCount++;
            result.errors.push({
              id: score.id,
              error: `No data provider for type: ${score.type}`,
            });
            continue;
          }

          // Get the memory data
          const data = await provider(score.id);
          if (!data) {
            result.skippedCount++;
            continue;
          }

          // Calculate size before compression
          const jsonData = JSON.stringify(data);
          const originalSize = Buffer.byteLength(jsonData, 'utf8');

          // Compress the data
          const compressed = gzipSync(Buffer.from(jsonData, 'utf8'));

          // Generate archive filename
          const archiveFilename = this.generateArchiveFilename(score);
          const archivePath = join(this.archiveDir, archiveFilename);

          // Write to archive
          await fs.writeFile(archivePath, compressed);

          // Update result
          result.archivedCount++;
          result.archivedIds.push(score.id);
          result.spaceSaved += originalSize - compressed.length;

          // Remove from scorer
          this.scorer.removeScore(score.id);

        } catch (error) {
          result.errorCount++;
          result.errors.push({
            id: score.id,
            error: String(error),
          });
        }
      }

      // Clean up empty archive directories
      await this.cleanupEmptyDirectories();

    } catch (error) {
      result.errors.push({
        id: 'system',
        error: `Archive operation failed: ${String(error)}`,
      });
    }

    return result;
  }

  /**
   * Restore a memory from archive
   */
  async restoreFromArchive(
    archiveId: string,
    dataRestorer: (data: any) => Promise<void>
  ): Promise<boolean> {
    try {
      // Find the archive file
      const archivePath = await this.findArchiveFile(archiveId);
      if (!archivePath) {
        return false;
      }

      // Read and decompress
      const compressed = await fs.readFile(archivePath);
      const decompressed = gunzipSync(compressed);
      const data = JSON.parse(decompressed.toString('utf8'));

      // Restore the data
      await dataRestorer(data);

      // Delete the archive file
      await fs.unlink(archivePath);

      // Re-initialize score
      this.scorer.initializeScore(
        archiveId,
        data.type || 'unknown',
        data.importance || 0.5,
        data.metadata || {}
      );

      return true;
    } catch (error) {
      console.error(`Failed to restore archive ${archiveId}:`, error);
      return false;
    }
  }

  /**
   * Get archive statistics
   */
  async getStatistics(): Promise<ArchiveStatistics> {
    const stats: ArchiveStatistics = {
      totalArchived: 0,
      totalSize: 0,
      compressionRatio: 0,
      oldestArchive: new Date().toISOString(),
      newestArchive: new Date(0).toISOString(),
      byType: {},
    };

    try {
      // Read archive directory
      const files = await fs.readdir(this.archiveDir);

      for (const file of files) {
        if (!file.endsWith('.gz')) {
          continue;
        }

        const filePath = join(this.archiveDir, file);
        const fileStat = await fs.stat(filePath);

        stats.totalArchived++;
        stats.totalSize += fileStat.size;

        // Parse filename to get type and date
        const parts = file.replace('.json.gz', '').split('-');
        if (parts.length >= 3) {
          const type = parts[0];
          const dateStr = parts.slice(1, 3).join('-'); // YYYY-MM

          stats.byType[type] = (stats.byType[type] || 0) + 1;

          // Update date range
          if (dateStr < stats.oldestArchive.substring(0, 7)) {
            stats.oldestArchive = dateStr + '-01';
          }
          if (dateStr > stats.newestArchive.substring(0, 7)) {
            stats.newestArchive = dateStr + '-28';
          }
        }
      }

      // Calculate compression ratio (estimate)
      // Assume original data was 3x larger before compression
      stats.compressionRatio = stats.totalSize > 0 ? 3.0 : 0;

    } catch (error) {
      console.error('Failed to get archive statistics:', error);
    }

    return stats;
  }

  /**
   * List all archived memories
   */
  async listArchives(): Promise<Array<{
    id: string;
    type: string;
    date: string;
    size: number;
    path: string;
  }>> {
    const archives: Array<{
      id: string;
      type: string;
      date: string;
      size: number;
      path: string;
    }> = [];

    try {
      const files = await fs.readdir(this.archiveDir);

      for (const file of files) {
        if (!file.endsWith('.gz')) {
          continue;
        }

        const filePath = join(this.archiveDir, file);
        const fileStat = await fs.stat(filePath);

        // Parse filename
        const parts = file.replace('.json.gz', '').split('-');
        if (parts.length >= 4) {
          const type = parts[0];
          const date = parts.slice(1, 3).join('-');
          const id = parts.slice(3).join('-');

          archives.push({
            id,
            type,
            date,
            size: fileStat.size,
            path: filePath,
          });
        }
      }

    } catch (error) {
      console.error('Failed to list archives:', error);
    }

    return archives;
  }

  /**
   * Delete old archives
   */
  async deleteOldArchives(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let deletedCount = 0;

    try {
      const files = await fs.readdir(this.archiveDir);

      for (const file of files) {
        if (!file.endsWith('.gz')) {
          continue;
        }

        const filePath = join(this.archiveDir, file);
        const fileStat = await fs.stat(filePath);

        // Check if file is older than cutoff
        if (fileStat.mtime < cutoffDate) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

    } catch (error) {
      console.error('Failed to delete old archives:', error);
    }

    return deletedCount;
  }

  /**
   * Clear all archives
   */
  async clearAllArchives(): Promise<number> {
    let deletedCount = 0;

    try {
      const files = await fs.readdir(this.archiveDir);

      for (const file of files) {
        const filePath = join(this.archiveDir, file);
        await fs.unlink(filePath);
        deletedCount++;
      }

    } catch (error) {
      console.error('Failed to clear archives:', error);
    }

    return deletedCount;
  }

  /**
   * Generate archive filename
   */
  private generateArchiveFilename(score: MemoryScore): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    // Format: type-year-month-id.json.gz
    const filename = `${score.type}-${year}-${month}-${score.id}.json.gz`;

    return filename;
  }

  /**
   * Find archive file by ID
   */
  private async findArchiveFile(id: string): Promise<string | null> {
    try {
      const files = await fs.readdir(this.archiveDir);

      for (const file of files) {
        if (file.includes(id) && file.endsWith('.gz')) {
          return join(this.archiveDir, file);
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clean up empty directories
   */
  private async cleanupEmptyDirectories(): Promise<void> {
    try {
      // This is a placeholder for future enhancement
      // Currently all archives go into a single directory
      // In the future, we might organize by type or date
    } catch (error) {
      console.error('Failed to cleanup directories:', error);
    }
  }
}