/**
 * 技能热重载系统
 *
 * 监听技能文件系统变化，自动重新加载技能。
 * 使用防抖机制避免频繁重载，确保系统稳定性。
 *
 * 特性：
 * - 文件系统监听（fs.watch）
 * - 技能文件变更时自动重新加载
 * - 防抖机制（避免频繁重载）
 * - 变更事件通知回调
 * - 支持递归监听子目录
 *
 * @author P3 Implementation
 * @version 1.0.0
 */

import { watch, FSWatcher } from 'fs';
import { readFile } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { existsSync } from 'fs';
import { parseSkillFrontmatter, SimpleSkillMetadata } from './simple-loader';
import { DiscoveredSkill, SkillDiscoveryEvent, SkillSourceType } from './autoDiscovery';

/**
 * 文件变更类型
 */
export type FileChangeType = 'create' | 'update' | 'delete';

/**
 * 文件变更事件
 */
export interface FileChangeEvent {
  /** 变更类型 */
  type: FileChangeType;
  /** 文件路径 */
  path: string;
  /** 技能名称（如果是技能文件） */
  skillName?: string;
  /** 变更时间戳 */
  timestamp: number;
}

/**
 * 热重载事件
 */
export type HotReloadEvent =
  | { type: 'skill_created'; skill: DiscoveredSkill }
  | { type: 'skill_updated'; skill: DiscoveredSkill; changes: FileChangeEvent[] }
  | { type: 'skill_deleted'; skillName: string; path: string }
  | { type: 'reload_error'; error: Error; path: string }
  | { type: 'batch_reload'; skills: DiscoveredSkill[] };

/**
 * 热重载事件监听器
 */
export type HotReloadListener = (event: HotReloadEvent) => void;

/**
 * 热重载配置选项
 */
export interface HotReloadOptions {
  /** 要监听的目录列表（默认：['.kode/skills']） */
  watchDirectories?: string[];
  /** 是否递归监听子目录（默认：true） */
  recursive?: boolean;
  /** 防抖延迟（毫秒，默认：300ms） */
  debounceDelay?: number;
  /** 是否启用热重载（默认：true） */
  enabled?: boolean;
  /** 要监听的文件扩展名（默认：['.md']） */
  watchExtensions?: string[];
  /** 忽略的目录/文件模式（默认：['node_modules', '.git']） */
  ignorePatterns?: string[];
}

/**
 * 防抖函数
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * 技能热重载系统
 *
 * 监听文件系统变化，自动重新加载技能。
 */
export class SkillHotReload {
  private watchers: Map<string, FSWatcher> = new Map();
  private listeners: Set<HotReloadListener> = new Set();
  private pendingChanges: Map<string, FileChangeEvent[]> = new Map();
  private reloadScheduled: Map<string, NodeJS.Timeout> = new Map();
  private options: Required<HotReloadOptions>;
  private enabled: boolean = false;

  constructor(options: HotReloadOptions = {}) {
    this.options = {
      watchDirectories: options.watchDirectories || ['.kode/skills'],
      recursive: options.recursive ?? true,
      debounceDelay: options.debounceDelay ?? 300,
      enabled: options.enabled ?? true,
      watchExtensions: options.watchExtensions || ['.md'],
      ignorePatterns: options.ignorePatterns || ['node_modules', '.git'],
    };
  }

  /**
   * 启动热重载
   */
  async start(): Promise<void> {
    if (this.enabled) {
      return; // 已经启动
    }

    if (!this.options.enabled) {
      return; // 已禁用
    }

    for (const dir of this.options.watchDirectories) {
      await this.watchDirectory(dir);
    }

    this.enabled = true;
  }

  /**
   * 停止热重载
   */
  stop(): void {
    if (!this.enabled) {
      return;
    }

    // 停止所有监听器
    for (const [path, watcher] of this.watchers) {
      watcher.close();
    }

    // 清除所有定时器
    for (const timeoutId of this.reloadScheduled.values()) {
      clearTimeout(timeoutId);
    }

    // 清空状态
    this.watchers.clear();
    this.pendingChanges.clear();
    this.reloadScheduled.clear();
    this.enabled = false;
  }

  /**
   * 监听目录
   */
  private async watchDirectory(directory: string): Promise<void> {
    if (!existsSync(directory)) {
      return;
    }

    try {
      const watcher = watch(
        directory,
        { recursive: this.options.recursive },
        (eventType, filename) => {
          if (!filename) {
            return;
          }

          const fullPath = join(directory, filename);
          this.handleFileChange(eventType, fullPath);
        }
      );

      this.watchers.set(directory, watcher);
    } catch (error: any) {
      this.emit({
        type: 'reload_error',
        error,
        path: directory,
      });
    }
  }

  /**
   * 处理文件变更
   */
  private handleFileChange(eventType: string, filePath: string): void {
    // 检查是否应该忽略此文件
    if (this.shouldIgnore(filePath)) {
      return;
    }

    // 只处理指定扩展名的文件
    const ext = this.getFileExtension(filePath);
    if (!this.options.watchExtensions.includes(ext)) {
      return;
    }

    // 确定变更类型
    const changeType: FileChangeType = eventType === 'rename'
      ? (existsSync(filePath) ? 'create' : 'delete')
      : 'update';

    // 提取技能名称（如果是 SKILL.md）
    const skillName = this.extractSkillName(filePath);

    const changeEvent: FileChangeEvent = {
      type: changeType,
      path: filePath,
      skillName: skillName || undefined,
      timestamp: Date.now(),
    };

    // 添加到待处理变更
    const skillKey = skillName || filePath;
    if (!this.pendingChanges.has(skillKey)) {
      this.pendingChanges.set(skillKey, []);
    }
    this.pendingChanges.get(skillKey)!.push(changeEvent);

    // 防抖处理
    this.scheduleReload(skillKey);
  }

  /**
   * 检查是否应该忽略文件
   */
  private shouldIgnore(filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/');

    for (const pattern of this.options.ignorePatterns) {
      if (normalizedPath.includes(pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(filePath: string): string {
    const idx = filePath.lastIndexOf('.');
    return idx !== -1 ? filePath.slice(idx) : '';
  }

  /**
   * 提取技能名称（从 SKILL.md 路径）
   */
  private extractSkillName(filePath: string): string | null {
    if (basename(filePath) !== 'SKILL.md') {
      return null;
    }

    const skillDir = dirname(filePath);
    return basename(skillDir);
  }

  /**
   * 调度重载（防抖）
   */
  private scheduleReload(skillKey: string): void {
    // 清除现有定时器
    const existingTimeout = this.reloadScheduled.get(skillKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // 设置新的定时器
    const timeoutId = setTimeout(() => {
      this.processPendingChanges(skillKey);
      this.reloadScheduled.delete(skillKey);
    }, this.options.debounceDelay);

    this.reloadScheduled.set(skillKey, timeoutId);
  }

  /**
   * 处理待处理的变更
   */
  private async processPendingChanges(skillKey: string): Promise<void> {
    const changes = this.pendingChanges.get(skillKey);
    if (!changes || changes.length === 0) {
      return;
    }

    // 清空待处理变更
    this.pendingChanges.delete(skillKey);

    // 获取最终状态
    const finalChange = changes[changes.length - 1];
    const latestPath = finalChange.path;

    try {
      if (finalChange.type === 'delete') {
        // 技能被删除
        if (finalChange.skillName) {
          this.emit({
            type: 'skill_deleted',
            skillName: finalChange.skillName,
            path: latestPath,
          });
        }
      } else {
        // 技能被创建或更新
        const skill = await this.loadSkill(latestPath);
        if (skill) {
          if (finalChange.type === 'create') {
            this.emit({
              type: 'skill_created',
              skill,
            });
          } else {
            this.emit({
              type: 'skill_updated',
              skill,
              changes,
            });
          }
        }
      }
    } catch (error: any) {
      this.emit({
        type: 'reload_error',
        error,
        path: latestPath,
      });
    }
  }

  /**
   * 加载技能
   */
  private async loadSkill(skillMdPath: string): Promise<DiscoveredSkill | null> {
    try {
      const content = await readFile(skillMdPath, 'utf-8');
      const metadata = parseSkillFrontmatter(content);

      return {
        name: metadata.name,
        description: metadata.description,
        source: 'directory' as SkillSourceType,
        path: dirname(skillMdPath),
        metadata,
        content,
        enabled: true,
        discoveredAt: Date.now(),
      };
    } catch (error: any) {
      throw new Error(`Failed to load skill from ${skillMdPath}: ${error.message}`);
    }
  }

  /**
   * 添加事件监听器
   */
  addListener(listener: HotReloadListener): void {
    this.listeners.add(listener);
  }

  /**
   * 移除事件监听器
   */
  removeListener(listener: HotReloadListener): void {
    this.listeners.delete(listener);
  }

  /**
   * 发射事件
   */
  private emit(event: HotReloadEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in hot reload listener:', error);
      }
    }
  }

  /**
   * 检查是否正在运行
   */
  isActive(): boolean {
    return this.enabled;
  }

  /**
   * 获取正在监听的目录列表
   */
  getWatchedDirectories(): string[] {
    return Array.from(this.watchers.keys());
  }

  /**
   * 获取待处理的变更数量
   */
  getPendingChangesCount(): number {
    return this.pendingChanges.size;
  }

  /**
   * 手动触发重载（用于测试）
   */
  async triggerReload(skillMdPath: string): Promise<void> {
    this.handleFileChange('update', skillMdPath);
  }
}

/**
 * 创建热重载实例的工厂函数
 */
export function createHotReload(options?: HotReloadOptions): SkillHotReload {
  return new SkillHotReload(options);
}
