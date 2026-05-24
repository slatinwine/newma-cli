/**
 * Skill Draft Manager
 *
 * 草稿技能管理器，管理待确认的技能草稿
 */

import { readdir, readFile, stat, writeFile, unlink, rename, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  DraftSkill,
  DraftStatus,
  SkillSuggestion,
  DraftManagerOptions,
} from './types-precipitation';

/**
 * 草稿列表过滤器
 */
export interface DraftFilter {
  /** 按状态过滤 */
  status?: DraftStatus | DraftStatus[];
  /** 最小置信度 */
  minConfidence?: number;
  /** 最大置信度 */
  maxConfidence?: number;
  /** 标签过滤 */
  tags?: string[];
  /** 搜索关键词 */
  search?: string;
}

/**
 * 草稿管理器
 */
export class SkillDraftManager {
  private projectRoot: string;
  private options: DraftManagerOptions;

  constructor(projectRoot: string, options?: Partial<DraftManagerOptions>) {
    this.projectRoot = projectRoot;
    this.options = {
      draftsDir: options?.draftsDir || join(projectRoot, '.kode', 'skills', 'drafts'),
      approvedDir: options?.approvedDir || join(projectRoot, '.kode', 'skills', 'approved'),
      rejectedDir: options?.rejectedDir || join(projectRoot, '.kode', 'skills', 'rejected'),
      retentionDays: options?.retentionDays || 30,
    };
  }

  /**
   * 初始化目录结构
   */
  async initialize(): Promise<void> {
    console.log('[DraftManager] Initializing directory structure...');

    const dirs = [
      this.options.draftsDir,
      this.options.approvedDir,
      this.options.rejectedDir,
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
        console.log(`[DraftManager] ✓ Created: ${dir}`);
      }
    }

    console.log('[DraftManager] ✓ Directory structure ready');
  }

  /**
   * 列出所有草稿
   */
  async listDrafts(filter?: DraftFilter): Promise<DraftSkill[]> {
    const drafts: DraftSkill[] = [];

    // 读取所有子目录
    const dirs = await readdir(this.options.draftsDir);

    for (const dir of dirs) {
      try {
        const draft = await this.loadDraft(dir);
        if (this.matchesFilter(draft, filter)) {
          drafts.push(draft);
        }
      } catch (error: any) {
        console.warn(`[DraftManager] Failed to load draft ${dir}: ${error.message}`);
      }
    }

    // 排序：按创建时间倒序
    drafts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return drafts;
  }

  /**
   * 批准草稿
   */
  async approve(draftId: string, reviewNote?: string): Promise<void> {
    const draft = await this.getDraft(draftId);
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    console.log(`[DraftManager] Approving draft: ${draft.suggestion.name}`);

    // 移动到 approved 目录
    const sourceDir = join(this.options.draftsDir, draftId);
    const targetDir = join(this.options.approvedDir, draftId);

    await this.moveDirectory(sourceDir, targetDir);

    // 更新状态
    await this.updateDraftStatus(targetDir, 'approved', reviewNote);

    console.log(`[DraftManager] ✓ Approved: ${draft.suggestion.name}`);
  }

  /**
   * 拒绝草稿
   */
  async reject(draftId: string, reviewNote?: string): Promise<void> {
    const draft = await this.getDraft(draftId);
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    console.log(`[DraftManager] Rejecting draft: ${draft.suggestion.name}`);

    // 移动到 rejected 目录
    const sourceDir = join(this.options.draftsDir, draftId);
    const targetDir = join(this.options.rejectedDir, draftId);

    await this.moveDirectory(sourceDir, targetDir);

    // 更新状态
    await this.updateDraftStatus(targetDir, 'rejected', reviewNote);

    console.log(`[DraftManager] ✓ Rejected: ${draft.suggestion.name}`);
  }

  /**
   * 删除草稿
   */
  async delete(draftId: string): Promise<void> {
    const draft = await this.getDraft(draftId);
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    console.log(`[DraftManager] Deleting draft: ${draft.suggestion.name}`);

    // 删除整个目录
    const { rmdir } = require('fs/promises');
    const { rm } = require('fs/promises');

    try {
      await rm(join(this.options.draftsDir, draftId), { recursive: true, force: true });
      console.log(`[DraftManager] ✓ Deleted: ${draft.suggestion.name}`);
    } catch (error: any) {
      console.error(`[DraftManager] Failed to delete: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取单个草稿
   */
  async getDraft(draftId: string): Promise<DraftSkill | null> {
    try {
      return await this.loadDraft(draftId);
    } catch (error) {
      return null;
    }
  }

  /**
   * 获取草稿路径
   */
  getDraftPath(draftId: string): string {
    return join(this.options.draftsDir, draftId, 'SKILL.md');
  }

  /**
   * 清理过期草稿
   */
  async cleanupOldDrafts(): Promise<number> {
    console.log('[DraftManager] Cleaning up old drafts...');

    const drafts = await this.listDrafts();
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - this.options.retentionDays * 24 * 60 * 60 * 1000);

    let cleaned = 0;

    for (const draft of drafts) {
      if (draft.createdAt < cutoffDate) {
        try {
          await this.delete(draft.id);
          cleaned++;
        } catch (error: any) {
          console.warn(`[DraftManager] Failed to cleanup ${draft.id}: ${error.message}`);
        }
      }
    }

    console.log(`[DraftManager] ✓ Cleaned up ${cleaned} old drafts`);

    return cleaned;
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    averageConfidence: number;
  }> {
    const pending = await this.listDrafts({ status: 'draft' });

    // 计算平均置信度
    const totalConfidence = pending.reduce((sum, draft) => sum + draft.suggestion.confidence, 0);
    const averageConfidence = pending.length > 0 ? totalConfidence / pending.length : 0;

    return {
      total: pending.length,
      pending: pending.length,
      approved: await this.countInDirectory(this.options.approvedDir),
      rejected: await this.countInDirectory(this.options.rejectedDir),
      averageConfidence,
    };
  }

  // ========== 私有方法 ==========

  /**
   * 加载草稿
   */
  private async loadDraft(draftId: string): Promise<DraftSkill> {
    const draftDir = join(this.options.draftsDir, draftId);
    const skillFile = join(draftDir, 'SKILL.md');

    // 读取 SKILL.md
    const content = await readFile(skillFile, 'utf-8');

    // 解析 YAML Frontmatter
    const suggestion = this.parseSkillFile(content);

    // 读取目录统计信息
    const stats = await stat(draftDir);

    return {
      id: draftId,
      path: skillFile,
      suggestion,
      createdAt: stats.birthtime,
      status: this.extractStatus(content) || 'draft',
    };
  }

  /**
   * 解析技能文件
   */
  private parseSkillFile(content: string): SkillSuggestion {
    // 提取 YAML Frontmatter
    const yamlMatch = content.match(/^---\n([\s\S]+?)\n---/);
    if (!yamlMatch) {
      throw new Error('Invalid skill file format');
    }

    const yaml = yamlMatch[1];
    const lines = yaml.split('\n');

    const suggestion: Partial<SkillSuggestion> = {};

    // 解析 YAML 字段
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        switch (key) {
          case 'name':
            suggestion.name = value.replace(/^["']|["']$/g, '');
            break;
          case 'description':
            suggestion.description = value.replace(/^["']|["']$/g, '');
            break;
          case 'type':
            suggestion.type = value as 'knowledge' | 'action' | 'analysis';
            break;
          case 'complexity':
            suggestion.complexity = parseInt(value, 10);
            break;
          case 'confidence':
            suggestion.confidence = parseFloat(value);
            break;
          case 'tags':
            suggestion.tags = JSON.parse(value);
            break;
        }
      }
    }

    // 提取 Markdown 内容（用于 coreKnowledge 等）
    const markdown = content.substring(yamlMatch[0].length).trim();

    return suggestion as SkillSuggestion;
  }

  /**
   * 提取状态
   */
  private extractStatus(content: string): DraftStatus | null {
    const statusMatch = content.match(/^status:\s*(\w+)$/m);
    if (statusMatch) {
      return statusMatch[1] as DraftStatus;
    }
    return null;
  }

  /**
   * 检查是否匹配过滤器
   */
  private matchesFilter(draft: DraftSkill, filter?: DraftFilter): boolean {
    if (!filter) return true;

    // 状态过滤
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      if (!statuses.includes(draft.status)) {
        return false;
      }
    }

    // 置信度过滤
    if (filter.minConfidence !== undefined && draft.suggestion.confidence < filter.minConfidence) {
      return false;
    }
    if (filter.maxConfidence !== undefined && draft.suggestion.confidence > filter.maxConfidence) {
      return false;
    }

    // 标签过滤
    if (filter.tags && filter.tags.length > 0) {
      const hasTag = filter.tags.some((tag) => draft.suggestion.tags.includes(tag));
      if (!hasTag) {
        return false;
      }
    }

    // 搜索关键词
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      const nameMatch = draft.suggestion.name.toLowerCase().includes(searchLower);
      const descMatch = draft.suggestion.description.toLowerCase().includes(searchLower);
      if (!nameMatch && !descMatch) {
        return false;
      }
    }

    return true;
  }

  /**
   * 移动目录
   */
  private async moveDirectory(source: string, target: string): Promise<void> {
    // 确保目标目录的父目录存在
    const { dirname } = require('path');
    await mkdir(dirname(target), { recursive: true });

    // 如果目标目录已存在，先删除它
    const { existsSync } = require('fs');
    const { rm } = require('fs/promises');

    if (existsSync(target)) {
      await rm(target, { recursive: true, force: true });
    }

    // 使用 rename 移动目录
    await rename(source, target);
  }

  /**
   * 更新草稿状态
   */
  private async updateDraftStatus(draftDir: string, status: DraftStatus, reviewNote?: string): Promise<void> {
    const skillFile = join(draftDir, 'SKILL.md');
    let content = await readFile(skillFile, 'utf-8');

    // 更新 status 字段
    if (content.includes('status:')) {
      content = content.replace(/^status:\s*\w+$/m, `status: ${status}`);
    } else {
      // 在 YAML Frontmatter 的末尾添加
      const yamlEnd = content.indexOf('\n---');
      const insertPos = content.lastIndexOf('\n', yamlEnd);
      content = content.slice(0, insertPos) + `\nstatus: ${status}` + content.slice(insertPos);
    }

    // 添加审批信息
    if (reviewNote) {
      const metadata = `\n\n**Review Note**: ${reviewNote}\n**Reviewed At**: ${new Date().toISOString()}\n`;
      content += metadata;
    }

    await writeFile(skillFile, content, 'utf-8');
  }

  /**
   * 计算目录中的技能数量
   */
  private async countInDirectory(dir: string): Promise<number> {
    try {
      const items = await readdir(dir);
      return items.length;
    } catch (error) {
      return 0;
    }
  }
}
