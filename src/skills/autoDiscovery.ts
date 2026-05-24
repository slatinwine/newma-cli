/**
 * 技能自动发现系统
 *
 * 自动发现和管理项目中的技能，支持多来源扫描：
 * - .kode/skills/ 目录扫描
 * - NEWMA.md 中的 skill 指令解析
 * - package.json 的 skills 字段读取
 * - 技能使用频率统计
 *
 * 特性：
 * - 按名称缓存已发现的技能
 * - 支持技能元数据（名称、描述、触发条件）
 * - 技能使用频率统计（SkillUsageTracker）
 * - 自动同步到 SkillRegistry
 *
 * @author P3 Implementation
 * @version 1.0.0
 */

import { readFile, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { parseSkillFrontmatter, SimpleSkill, SimpleSkillMetadata } from './simple-loader';
import { SkillRegistry, SkillRegistryEntry } from './registry';

/**
 * 技能来源类型
 */
export type SkillSourceType = 'directory' | 'newma_md' | 'package_json' | 'registry';

/**
 * 发现的技能信息
 */
export interface DiscoveredSkill {
  /** 技能名称 */
  name: string;
  /** 技能描述 */
  description: string;
  /** 技能来源 */
  source: SkillSourceType;
  /** 技能路径（目录或SKILL.md路径） */
  path: string;
  /** 技能元数据 */
  metadata?: SimpleSkillMetadata;
  /** 技能内容 */
  content?: string;
  /** 是否已启用 */
  enabled?: boolean;
  /** 发现时间戳 */
  discoveredAt: number;
}

/**
 * 技能使用统计
 */
export interface SkillUsageStats {
  /** 技能名称 */
  name: string;
  /** 使用次数 */
  count: number;
  /** 最后使用时间 */
  lastUsed: number;
  /** 平均执行时间（毫秒） */
  avgExecutionTime: number;
  /** 成功率（0-1） */
  successRate: number;
}

/**
 * 技能发现选项
 */
export interface SkillDiscoveryOptions {
  /** 技能目录列表（默认：['.kode/skills']） */
  skillDirectories?: string[];
  /** NEWMA.md 文件路径（默认：'NEWMA.md'） */
  newmaMdPath?: string;
  /** package.json 文件路径（默认：'package.json'） */
  packageJsonPath?: string;
  /** 是否递归扫描子目录（默认：true） */
  recursive?: boolean;
  /** 技能注册表实例 */
  registry?: SkillRegistry | undefined;
  /** 是否自动同步到注册表（默认：true） */
  autoSync?: boolean;
}

/**
 * 技能发现事件
 */
export type SkillDiscoveryEvent =
  | { type: 'skill_found'; skill: DiscoveredSkill }
  | { type: 'skill_removed'; name: string; path: string }
  | { type: 'skill_updated'; skill: DiscoveredSkill }
  | { type: 'scan_complete'; count: number; duration: number }
  | { type: 'error'; error: Error };

/**
 * 事件监听器类型
 */
export type SkillDiscoveryListener = (event: SkillDiscoveryEvent) => void;

/**
 * 技能使用追踪器
 *
 * 跟踪技能使用情况，用于统计和分析。
 */
class SkillUsageTracker {
  private usage: Map<string, {
    count: number;
    lastUsed: number;
    totalExecutionTime: number;
    successCount: number;
    failureCount: number;
  }> = new Map();

  /**
   * 记录技能使用
   */
  recordUsage(
    name: string,
    executionTime: number,
    success: boolean
  ): void {
    const current = this.usage.get(name) || {
      count: 0,
      lastUsed: 0,
      totalExecutionTime: 0,
      successCount: 0,
      failureCount: 0,
    };

    current.count++;
    current.lastUsed = Date.now();
    current.totalExecutionTime += executionTime;

    if (success) {
      current.successCount++;
    } else {
      current.failureCount++;
    }

    this.usage.set(name, current);
  }

  /**
   * 获取技能使用统计
   */
  getStats(name: string): SkillUsageStats | null {
    const data = this.usage.get(name);
    if (!data) {
      return null;
    }

    return {
      name,
      count: data.count,
      lastUsed: data.lastUsed,
      avgExecutionTime: data.totalExecutionTime / data.count,
      successRate: data.successCount / (data.successCount + data.failureCount),
    };
  }

  /**
   * 获取所有技能统计
   */
  getAllStats(): SkillUsageStats[] {
    return Array.from(this.usage.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        lastUsed: data.lastUsed,
        avgExecutionTime: data.totalExecutionTime / data.count,
        successRate: data.successCount / (data.successCount + data.failureCount),
      }))
      .sort((a, b) => b.count - a.count); // 按使用次数降序
  }

  /**
   * 清除统计数据
   */
  clear(name?: string): void {
    if (name) {
      this.usage.delete(name);
    } else {
      this.usage.clear();
    }
  }
}

/**
 * 技能自动发现系统
 *
 * 自动扫描和发现项目中的技能，支持多来源扫描和缓存。
 */
export class SkillAutoDiscovery {
  private cache: Map<string, DiscoveredSkill> = new Map();
  private listeners: Set<SkillDiscoveryListener> = new Set();
  private usageTracker: SkillUsageTracker;
  private options: {
    skillDirectories: string[];
    newmaMdPath: string;
    packageJsonPath: string;
    recursive: boolean;
    registry?: SkillRegistry;
    autoSync: boolean;
  };
  private scanInProgress: boolean = false;

  constructor(options: SkillDiscoveryOptions = {}) {
    this.usageTracker = new SkillUsageTracker();
    this.options = {
      skillDirectories: options.skillDirectories || ['.kode/skills'],
      newmaMdPath: options.newmaMdPath || 'NEWMA.md',
      packageJsonPath: options.packageJsonPath || 'package.json',
      recursive: options.recursive ?? true,
      registry: options.registry,
      autoSync: options.autoSync ?? true,
    };
  }

  /**
   * 扫描所有技能来源
   */
  async scan(): Promise<DiscoveredSkill[]> {
    if (this.scanInProgress) {
      throw new Error('Scan already in progress');
    }

    this.scanInProgress = true;
    const startTime = Date.now();
    const discovered: DiscoveredSkill[] = [];

    try {
      // 1. 扫描技能目录
      for (const dir of this.options.skillDirectories) {
        const skills = await this.scanDirectory(dir);
        discovered.push(...skills);
      }

      // 2. 扫描 NEWMA.md
      const newmaMdSkills = await this.scanNewmaMd();
      discovered.push(...newmaMdSkills);

      // 3. 扫描 package.json
      const packageJsonSkills = await this.scanPackageJson();
      discovered.push(...packageJsonSkills);

      // 4. 同步到注册表
      if (this.options.autoSync && this.options.registry) {
        await this.syncToRegistry(discovered);
      }

      // 5. 更新缓存
      this.updateCache(discovered);

      const duration = Date.now() - startTime;
      this.emit({
        type: 'scan_complete',
        count: discovered.length,
        duration,
      });

      return discovered;
    } catch (error: any) {
      this.emit({ type: 'error', error });
      throw error;
    } finally {
      this.scanInProgress = false;
    }
  }

  /**
   * 扫描技能目录
   */
  private async scanDirectory(directory: string): Promise<DiscoveredSkill[]> {
    const discovered: DiscoveredSkill[] = [];

    if (!existsSync(directory)) {
      return discovered;
    }

    const scan = async (dir: string) => {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          // 检查是否是技能目录（包含 SKILL.md）
          const skillMdPath = join(fullPath, 'SKILL.md');
          if (existsSync(skillMdPath)) {
            const skill = await this.loadSkillFromPath(skillMdPath, 'directory');
            if (skill) {
              discovered.push(skill);
            }
          } else if (this.options.recursive) {
            // 递归扫描子目录
            await scan(fullPath);
          }
        }
      }
    };

    await scan(directory);
    return discovered;
  }

  /**
   * 从路径加载技能
   */
  private async loadSkillFromPath(
    skillMdPath: string,
    source: SkillSourceType
  ): Promise<DiscoveredSkill | null> {
    try {
      const content = await readFile(skillMdPath, 'utf-8');
      const metadata = parseSkillFrontmatter(content);

      return {
        name: metadata.name,
        description: metadata.description,
        source,
        path: dirname(skillMdPath),
        metadata,
        content,
        enabled: true,
        discoveredAt: Date.now(),
      };
    } catch (error: any) {
      this.emit({
        type: 'error',
        error: new Error(`Failed to load skill from ${skillMdPath}: ${error.message}`),
      });
      return null;
    }
  }

  /**
   * 扫描 NEWMA.md 中的 skill 指令
   */
  private async scanNewmaMd(): Promise<DiscoveredSkill[]> {
    const discovered: DiscoveredSkill[] = [];

    if (!existsSync(this.options.newmaMdPath)) {
      return discovered;
    }

    try {
      const content = await readFile(this.options.newmaMdPath, 'utf-8');
      const skillReferences = this.parseSkillReferences(content);

      for (const ref of skillReferences) {
        // 检查是否已存在于缓存中
        const existing = this.cache.get(ref.name);
        if (existing) {
          discovered.push(existing);
          continue;
        }

        // 尝试加载技能
        const skillMdPath = join(ref.path, 'SKILL.md');
        if (existsSync(skillMdPath)) {
          const skill = await this.loadSkillFromPath(skillMdPath, 'newma_md');
          if (skill) {
            discovered.push(skill);
          }
        }
      }
    } catch (error: any) {
      this.emit({
        type: 'error',
        error: new Error(`Failed to scan NEWMA.md: ${error.message}`),
      });
    }

    return discovered;
  }

  /**
   * 解析 NEWMA.md 中的 skill 引用
   *
   * 支持格式：
   * - skill: skill-name
   * - skill: .kode/skills/skill-name
   * - /skill skill-name
   */
  private parseSkillReferences(content: string): Array<{ name: string; path: string }> {
    const references: Array<{ name: string; path: string }> = [];
    const lines = content.split('\n');

    for (const line of lines) {
      // 匹配 "skill:" 指令
      const skillMatch = line.match(/^\s*skill:\s*(.+)$/i);
      if (skillMatch) {
        const ref = skillMatch[1].trim();
        const name = basename(ref);
        references.push({ name, path: ref });
      }

      // 匹配 "/skill" 命令
      const commandMatch = line.match(/\/skill\s+(\S+)/);
      if (commandMatch) {
        const ref = commandMatch[1].trim();
        const name = basename(ref);
        references.push({ name, path: ref });
      }
    }

    return references;
  }

  /**
   * 扫描 package.json 的 skills 字段
   */
  private async scanPackageJson(): Promise<DiscoveredSkill[]> {
    const discovered: DiscoveredSkill[] = [];

    if (!existsSync(this.options.packageJsonPath)) {
      return discovered;
    }

    try {
      const content = await readFile(this.options.packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      // 读取 skills 字段
      const skillsField = packageJson.skills;
      if (!skillsField) {
        return discovered;
      }

      // 处理不同格式
      const skillEntries: Array<{ name: string; path: string }> = [];

      if (Array.isArray(skillsField)) {
        // 格式：["skill-name1", "skill-name2"]
        for (const skillName of skillsField) {
          skillEntries.push({
            name: skillName,
            path: join('.kode/skills', skillName),
          });
        }
      } else if (typeof skillsField === 'object') {
        // 格式：{ "skill-name": { "path": "..." } }
        for (const [name, config] of Object.entries(skillsField)) {
          const skillPath = typeof config === 'string'
            ? config
            : (config as any).path || join('.kode/skills', name);
          skillEntries.push({ name, path: skillPath });
        }
      }

      // 加载技能
      for (const entry of skillEntries) {
        const existing = this.cache.get(entry.name);
        if (existing) {
          discovered.push(existing);
          continue;
        }

        const skillMdPath = join(entry.path, 'SKILL.md');
        if (existsSync(skillMdPath)) {
          const skill = await this.loadSkillFromPath(skillMdPath, 'package_json');
          if (skill) {
            discovered.push(skill);
          }
        }
      }
    } catch (error: any) {
      this.emit({
        type: 'error',
        error: new Error(`Failed to scan package.json: ${error.message}`),
      });
    }

    return discovered;
  }

  /**
   * 同步到注册表
   */
  private async syncToRegistry(discovered: DiscoveredSkill[]): Promise<void> {
    if (!this.options.registry) {
      return;
    }

    const registry = this.options.registry;

    for (const skill of discovered) {
      if (!skill.metadata) {
        continue;
      }

      // 检查是否已存在
      const existing = registry.getSkill(skill.name);
      if (!existing) {
        // 创建新条目
        const entry = SkillRegistry.createEntryFromMetadata(
          skill.metadata,
          skill.path,
          'local'
        );
        await registry.registerSkill(entry);
      }
    }
  }

  /**
   * 更新缓存
   */
  private updateCache(discovered: DiscoveredSkill[]): void {
    // 标记所有现有缓存为待删除
    const toRemove = new Set(this.cache.keys());

    for (const skill of discovered) {
      const existing = this.cache.get(skill.name);
      toRemove.delete(skill.name);

      if (!existing) {
        // 新技能
        this.cache.set(skill.name, skill);
        this.emit({ type: 'skill_found', skill });
      } else if (
        existing.path !== skill.path ||
        existing.discoveredAt < skill.discoveredAt
      ) {
        // 更新技能
        this.cache.set(skill.name, skill);
        this.emit({ type: 'skill_updated', skill });
      }
    }

    // 移除不存在的技能
    for (const name of toRemove) {
      const skill = this.cache.get(name);
      if (skill) {
        this.cache.delete(name);
        this.emit({
          type: 'skill_removed',
          name,
          path: skill.path,
        });
      }
    }
  }

  /**
   * 获取技能（从缓存）
   */
  getSkill(name: string): DiscoveredSkill | undefined {
    return this.cache.get(name);
  }

  /**
   * 获取所有技能（从缓存）
   */
  getAllSkills(): DiscoveredSkill[] {
    return Array.from(this.cache.values());
  }

  /**
   * 搜索技能
   */
  searchSkills(query: string): DiscoveredSkill[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllSkills().filter(
      (skill) =>
        skill.name.toLowerCase().includes(lowerQuery) ||
        skill.description.toLowerCase().includes(lowerQuery) ||
        skill.metadata?.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * 记录技能使用
   */
  recordUsage(
    name: string,
    executionTime: number,
    success: boolean
  ): void {
    this.usageTracker.recordUsage(name, executionTime, success);

    // 同步到注册表
    if (this.options.registry) {
      this.options.registry.recordUsage(name).catch((error) => {
        this.emit({ type: 'error', error });
      });
    }
  }

  /**
   * 获取技能使用统计
   */
  getUsageStats(name: string): SkillUsageStats | null {
    return this.usageTracker.getStats(name);
  }

  /**
   * 获取所有使用统计
   */
  getAllUsageStats(): SkillUsageStats[] {
    return this.usageTracker.getAllStats();
  }

  /**
   * 清除使用统计
   */
  clearUsageStats(name?: string): void {
    this.usageTracker.clear(name);
  }

  /**
   * 添加事件监听器
   */
  addListener(listener: SkillDiscoveryListener): void {
    this.listeners.add(listener);
  }

  /**
   * 移除事件监听器
   */
  removeListener(listener: SkillDiscoveryListener): void {
    this.listeners.delete(listener);
  }

  /**
   * 发射事件
   */
  private emit(event: SkillDiscoveryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in skill discovery listener:', error);
      }
    }
  }

  /**
   * 获取缓存大小
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * 导出使用追踪器类
 */
export { SkillUsageTracker };
