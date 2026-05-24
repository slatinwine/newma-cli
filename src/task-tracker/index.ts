/**
 * Task Tracker - Public API
 */

export * from './types';
export * from './storage';
export * from './tracker';
export * from './display';
export * from './commands';
export * from './plugin';

import { TaskStorage } from './storage';
import { TaskTracker } from './tracker';
import { TaskDisplay } from './display';
import { TaskCommands } from './commands';
import { TaskLifecyclePlugin } from './plugin';
import { TaskStorageConfig } from './types';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * 迁移旧任务数据到新位置
 */
async function migrateOldTasks(projectRoot: string): Promise<void> {
  const oldDir = join(projectRoot, '.newma', 'tasks');
  const newDir = join(projectRoot, '.memo', 'tasks');

  try {
    // 检查旧目录是否存在
    await fs.access(oldDir);
  } catch {
    // 旧目录不存在，无需迁移
    return;
  }

  try {
    // 读取旧目录下的所有文件
    const files = await fs.readdir(oldDir);

    if (files.length === 0) {
      return;
    }

    // 创建新目录
    await fs.mkdir(newDir, { recursive: true });

    // 移动每个文件
    for (const file of files) {
      const oldPath = join(oldDir, file);
      const newPath = join(newDir, file);
      await fs.rename(oldPath, newPath);
    }

    // 删除旧目录
    await fs.rmdir(oldDir);

    console.log('📦 Migrated tasks from .newma/tasks/ to .memo/tasks/');
  } catch (error) {
    // 静默失败 - 迁移失败不影响主流程
    console.log('⚠️  Task migration skipped (may have already migrated)');
  }
}

/**
 * Create task tracking system with default configuration
 */
export async function createTaskTracker(projectRoot: string) {
  // 🔥 先迁移旧数据
  await migrateOldTasks(projectRoot);

  const config: TaskStorageConfig = {
    dataDir: `${projectRoot}/.memo/tasks`,  // 🔥 修改：统一存储到 .memo/ 目录
    compressAfterDays: 30,
    compressionLevel: 9,
    algorithm: 'gzip',
  };

  const storage = new TaskStorage(config);
  const tracker = new TaskTracker(storage);
  const display = new TaskDisplay();
  const commands = new TaskCommands(tracker, display);
  const plugin = new TaskLifecyclePlugin(tracker);

  return {
    tracker,
    display,
    commands,
    plugin,
    storage,
  };
}
