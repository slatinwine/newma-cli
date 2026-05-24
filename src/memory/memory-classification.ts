/**
 * 记忆分类系统
 *
 * 基于 Claude Code 的记忆系统设计，提供四种记忆类型分类：
 * - user: 用户角色、目标、知识
 * - feedback: 用户对工作方式的指导
 * - project: 项目工作、目标、事件
 * - reference: 外部系统资源指针
 *
 * 特性：
 * - 记忆验证规则（推荐前检查文件/函数是否仍存在）
 * - 不保存规则（代码模式、架构、git历史、调试方案）
 * - 记忆过期和清理
 * - 跨会话记忆持久化
 *
 * @author P3 Implementation
 * @version 1.0.0
 * @reference Claude Code memory system
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { glob } from 'glob';

/**
 * 记忆类型
 */
export type MemoryType = 'user' | 'feedback' | 'project' | 'reference';

/**
 * 记忆条目
 */
export interface MemoryEntry {
  /** 记忆类型 */
  type: MemoryType;
  /** 记忆内容 */
  content: string;
  /** 创建时间戳 */
  createdAt: number;
  /** 更新时间戳 */
  updatedAt: number;
  /** 来源（哪个会话产生的） */
  source: string;
  /** 记忆标题 */
  title: string;
  /** 关联的文件路径（可选） */
  relatedFiles?: string[];
  /** 关联的函数/标识符（可选） */
  relatedIdentifiers?: string[];
  /** 标签 */
  tags?: string[];
  /** 过期时间戳（0 = 不过期） */
  expiresAt?: number;
  /** 记忆ID */
  id: string;
}

/**
 * 记忆验证结果
 */
export interface MemoryValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 无效原因 */
  reasons?: string[];
  /** 缺失的文件 */
  missingFiles?: string[];
  /** 缺失的标识符 */
  missingIdentifiers?: string[];
}

/**
 * 记忆搜索过滤器
 */
export interface MemorySearchFilters {
  /** 记忆类型 */
  type?: MemoryType;
  /** 标签 */
  tags?: string[];
  /** 搜索关键词 */
  query?: string;
  /** 来源 */
  source?: string;
  /** 是否包含过期记忆 */
  includeExpired?: boolean;
}

/**
 * 记忆存储选项
 */
export interface MemoryStoreOptions {
  /** 记忆存储路径（默认：'.newma/memory.json'） */
  memoryPath?: string;
  /** 是否启用验证（默认：true） */
  enableValidation?: boolean;
  /** 默认过期时间（毫秒，0 = 不过期，默认：30天） */
  defaultExpiration?: number;
}

/**
 * 记忆统计信息
 */
export interface MemoryStats {
  /** 总记忆数 */
  total: number;
  /** 按类型统计 */
  byType: Record<MemoryType, number>;
  /** 过期记忆数 */
  expired: number;
  /** 即将过期记忆数（7天内） */
  expiringSoon: number;
  /** 最后更新时间 */
  lastUpdated: number;
}

/**
 * 记忆指南（Claude Code 风格）
 */
export const MEMORY_GUIDELINES = {
  /**
   * 用户记忆
   *
   * 时机：了解用户任何细节时保存
   * 内容：用户角色、目标、知识、偏好
   */
  user: {
    description: '用户角色、目标、知识 — 了解用户任何细节时保存',
    examples: [
      '用户是数据科学家，专注于日志系统',
      '用户写了10年Go代码，第一次接触React',
      '用户偏好中文，喜欢简洁的回答',
    ],
    shouldSave: '当了解到用户的角色、技术栈、沟通风格、工作偏好时',
  },

  /**
   * 反馈记忆
   *
   * 时机：用户纠正或确认方法时保存
   * 内容：用户对工作方式的指导
   */
  feedback: {
    description: '用户对工作方式的指导 — 用户纠正或确认方法时保存',
    examples: [
      '不要mock数据库 — 我们在上个季度因此出过问题',
      '停止在每个响应后总结 — 我能看到diff',
      '是的，单次打包的PR是对的，拆分只会增加工作量',
    ],
    shouldSave: '当用户纠正你的方法、确认或拒绝某种方法、表达明确的偏好时',
  },

  /**
   * 项目记忆
   *
   * 时机：了解谁做什么、为什么、何时
   * 内容：项目工作、目标、事件
   */
  project: {
    description: '项目工作、目标、事件 — 了解谁做什么、为什么、何时',
    examples: [
      '移动团队将在星期四后冻结所有非关键合并',
      '移除旧认证中间件是法律要求，不是技术债清理',
      '登录功能应由前端团队处理',
    ],
    shouldSave: '当了解到项目时间线、团队分工、任务优先级、技术决策原因时',
  },

  /**
   * 参考记忆
   *
   * 时机：了解外部资源和用途时
   * 内容：外部系统资源指针
   */
  reference: {
    description: '外部系统资源指针 — 了解外部资源和用途时',
    examples: [
      '管道Bug在Linear的"INGEST"项目中跟踪',
      'grafana.internal/d/api-latency是oncall延迟仪表板',
      'Slack频道#alerts用于生产告警',
    ],
    shouldSave: '当了解到外部系统的位置、用途、如何使用时',
  },
};

/**
 * 不应保存的内容
 */
export const MEMORY_EXCLUSIONS = {
  /**
   * 可从代码推导的内容
   */
  codePatterns: '代码模式、架构、文件路径、项目结构',
  /**
   * Git历史
   */
  gitHistory: 'Git历史、谁改了什么、提交记录',
  /**
   * 调试方案
   */
  debuggingSolutions: '调试方案、修复方法（已在代码中）',
  /**
   * CLAUDE.md内容
   */
  claudeMdContent: 'CLAUDE.md中的内容（已有文档）',
  /**
   * 临时会话状态
   */
  sessionState: '当前会话上下文、临时状态',
};

/**
 * 记忆验证规则（Claude Code 风格）
 */
export const MEMORY_VERIFICATION_RULE = `Before recommending from memory:
- If the memory names a file path: check the file exists.
- If the memory names a function or flag: grep for it.
"The memory says X exists" is not the same as "X exists now."

Before saving:
- Code patterns, architecture, file paths: Don't save (derivable from code)
- Git history, who-changed-what: Don't save (use git log)
- Debugging solutions, fix recipes: Don't save (fix is in code, commit has context)
- Anything documented in CLAUDE.md: Don't save (already documented)`;

/**
 * 记忆存储管理器
 *
 * 管理记忆的存储、验证、搜索和清理。
 */
export class MemoryStore {
  private memories: Map<string, MemoryEntry> = new Map();
  private options: Required<MemoryStoreOptions>;
  private dirty: boolean = false;

  constructor(options: MemoryStoreOptions = {}) {
    this.options = {
      memoryPath: options.memoryPath || '.newma/memory.json',
      enableValidation: options.enableValidation ?? true,
      defaultExpiration: options.defaultExpiration || 30 * 24 * 60 * 60 * 1000, // 30天
    };
  }

  /**
   * 初始化（从磁盘加载或创建新存储）
   */
  async initialize(): Promise<void> {
    if (existsSync(this.options.memoryPath)) {
      await this.load();
    } else {
      await this.save();
    }
  }

  /**
   * 从磁盘加载记忆
   */
  async load(): Promise<void> {
    try {
      const content = await readFile(this.options.memoryPath, 'utf-8');
      const data = JSON.parse(content);

      this.memories.clear();
      for (const entry of data.memories || []) {
        this.memories.set(entry.id, entry);
      }

      this.dirty = false;
    } catch (error: any) {
      throw new Error(`Failed to load memory: ${error.message}`);
    }
  }

  /**
   * 保存记忆到磁盘
   */
  async save(): Promise<void> {
    if (!this.dirty) {
      return;
    }

    try {
      // 确保目录存在
      const dir = dirname(this.options.memoryPath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      const data = {
        version: '1.0',
        lastUpdated: Date.now(),
        memories: Array.from(this.memories.values()),
      };

      await writeFile(
        this.options.memoryPath,
        JSON.stringify(data, null, 2),
        'utf-8'
      );

      this.dirty = false;
    } catch (error: any) {
      throw new Error(`Failed to save memory: ${error.message}`);
    }
  }

  /**
   * 添加记忆
   */
  async add(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryEntry> {
    // 如果未指定过期时间，使用默认值
    const expiresAt = entry.expiresAt ?? (this.options.defaultExpiration > 0
      ? Date.now() + this.options.defaultExpiration
      : 0);

    const memory: MemoryEntry = {
      ...entry,
      id: this.generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt,
    };

    this.memories.set(memory.id, memory);
    this.dirty = true;
    await this.save();

    return memory;
  }

  /**
   * 更新记忆
   */
  async update(id: string, updates: Partial<Omit<MemoryEntry, 'id' | 'createdAt'>>): Promise<MemoryEntry | null> {
    const memory = this.memories.get(id);
    if (!memory) {
      return null;
    }

    const updated: MemoryEntry = {
      ...memory,
      ...updates,
      id: memory.id, // 保持ID不变
      createdAt: memory.createdAt, // 保持创建时间不变
      updatedAt: Date.now(),
    };

    this.memories.set(id, updated);
    this.dirty = true;
    await this.save();

    return updated;
  }

  /**
   * 删除记忆
   */
  async delete(id: string): Promise<boolean> {
    const existed = this.memories.delete(id);
    if (existed) {
      this.dirty = true;
      await this.save();
    }
    return existed;
  }

  /**
   * 获取记忆
   */
  get(id: string): MemoryEntry | undefined {
    return this.memories.get(id);
  }

  /**
   * 验证记忆
   */
  async validate(memory: MemoryEntry): Promise<MemoryValidationResult> {
    if (!this.options.enableValidation) {
      return { valid: true };
    }

    const reasons: string[] = [];
    const missingFiles: string[] = [];
    const missingIdentifiers: string[] = [];

    // 检查关联的文件是否存在
    if (memory.relatedFiles && memory.relatedFiles.length > 0) {
      for (const filePath of memory.relatedFiles) {
        if (!existsSync(filePath)) {
          missingFiles.push(filePath);
          reasons.push(`File not found: ${filePath}`);
        }
      }
    }

    // 检查关联的标识符是否存在
    if (memory.relatedIdentifiers && memory.relatedIdentifiers.length > 0) {
      for (const identifier of memory.relatedIdentifiers) {
        const found = await this.searchIdentifier(identifier);
        if (!found) {
          missingIdentifiers.push(identifier);
          reasons.push(`Identifier not found: ${identifier}`);
        }
      }
    }

    const valid = reasons.length === 0;
    return {
      valid,
      reasons: valid ? undefined : reasons,
      missingFiles: valid ? undefined : missingFiles,
      missingIdentifiers: valid ? undefined : missingIdentifiers,
    };
  }

  /**
   * 搜索标识符（使用glob）
   */
  private async searchIdentifier(identifier: string): Promise<boolean> {
    try {
      // 使用glob搜索文件
      const files = await glob('**/*.{ts,js,tsx,jsx}', {
        cwd: process.cwd(),
        ignore: ['node_modules/**', 'dist/**', '.next/**'],
      });

      // 简单搜索：检查文件内容
      for (const file of files) {
        try {
          const content = await readFile(file, 'utf-8');
          if (content.includes(identifier)) {
            return true;
          }
        } catch {
          // 忽略读取错误
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * 搜索记忆
   */
  search(filters: MemorySearchFilters): MemoryEntry[] {
    let results = Array.from(this.memories.values());

    // 过滤类型
    if (filters.type) {
      results = results.filter((m) => m.type === filters.type);
    }

    // 过滤标签
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter((m) =>
        filters.tags!.some((tag) => m.tags?.includes(tag))
      );
    }

    // 过滤来源
    if (filters.source) {
      results = results.filter((m) => m.source === filters.source);
    }

    // 过滤过期
    if (!filters.includeExpired) {
      const now = Date.now();
      results = results.filter((m) => !m.expiresAt || m.expiresAt > now);
    }

    // 文本搜索
    if (filters.query) {
      const query = filters.query.toLowerCase();
      results = results.filter(
        (m) =>
          m.title.toLowerCase().includes(query) ||
          m.content.toLowerCase().includes(query)
      );
    }

    // 按更新时间排序（最新的在前）
    results.sort((a, b) => b.updatedAt - a.updatedAt);

    return results;
  }

  /**
   * 清理过期记忆
   */
  async cleanupExpired(): Promise<number> {
    const now = Date.now();
    const expired: string[] = [];

    for (const [id, memory] of this.memories) {
      if (memory.expiresAt && memory.expiresAt <= now) {
        expired.push(id);
      }
    }

    for (const id of expired) {
      this.memories.delete(id);
    }

    if (expired.length > 0) {
      this.dirty = true;
      await this.save();
    }

    return expired.length;
  }

  /**
   * 获取统计信息
   */
  getStats(): MemoryStats {
    const now = Date.now();
    const weekFromNow = now + 7 * 24 * 60 * 60 * 1000;

    const stats: MemoryStats = {
      total: this.memories.size,
      byType: {
        user: 0,
        feedback: 0,
        project: 0,
        reference: 0,
      },
      expired: 0,
      expiringSoon: 0,
      lastUpdated: now,
    };

    for (const memory of this.memories.values()) {
      // 按类型统计
      stats.byType[memory.type]++;

      // 过期统计
      if (memory.expiresAt && memory.expiresAt <= now) {
        stats.expired++;
      } else if (memory.expiresAt && memory.expiresAt <= weekFromNow) {
        stats.expiringSoon++;
      }
    }

    return stats;
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}

/**
 * 创建记忆存储实例
 */
export function createMemoryStore(options?: MemoryStoreOptions): MemoryStore {
  return new MemoryStore(options);
}
