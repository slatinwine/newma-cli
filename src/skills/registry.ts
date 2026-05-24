/**
 * Skill Registry
 *
 * Lightweight JSON-based registry for managing installed skills.
 * Inspired by OpenDeepWiki's SkillConfig database approach,
 * but simplified to use JSON files instead of a full database.
 *
 * Registry location: .kode/skills/registry.json
 *
 * Features:
 * - Record installed skills with metadata
 * - Track skill usage statistics
 * - Support skill search and filtering
 * - Version management
 * - Enable/disable skills
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { SimpleSkillMetadata } from './simple-loader';

/**
 * Registry entry for a skill
 */
export interface SkillRegistryEntry {
  // Core identity
  name: string;                   // Unique identifier (kebab-case)
  version: string;                // Semver version
  description: string;            // Short description

  // Source information
  source: 'local' | 'remote' | 'marketplace' | 'precipitation';
  sourceUrl?: string;             // URL if remote/marketplace
  installedAt: string;            // ISO timestamp

  // Metadata
  author?: string;
  license?: string;
  type: 'knowledge' | 'code' | 'hybrid';
  tags: string[];

  // State
  enabled: boolean;               // Whether skill is active
  hasScripts: boolean;
  hasReferences: boolean;
  hasAssets: boolean;

  // Usage statistics
  usageCount: number;             // Times executed
  lastUsedAt?: string;            // ISO timestamp

  // File location
  path: string;                   // Path to skill directory
  skillMdPath: string;            // Path to SKILL.md
}

/**
 * Registry data structure
 */
export interface SkillRegistryData {
  version: string;                // Registry format version
  lastUpdated: string;            // ISO timestamp
  skills: Record<string, SkillRegistryEntry>;  // name -> entry
}

/**
 * Search filters
 */
export interface SkillSearchFilters {
  enabled?: boolean;
  type?: 'knowledge' | 'code' | 'hybrid';
  source?: 'local' | 'remote' | 'marketplace' | 'precipitation';
  tags?: string[];
  author?: string;
  searchQuery?: string;           // Text search in name/description
}

/**
 * Sort options
 */
export type SkillSortOption = 'name' | 'installedAt' | 'usageCount' | 'lastUsedAt';

/**
 * Skill Registry Manager
 */
export class SkillRegistry {
  private registryPath: string;
  private data: SkillRegistryData;
  private dirty: boolean = false;

  constructor(registryPath: string = '.kode/skills/registry.json') {
    this.registryPath = registryPath;
    this.data = {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      skills: {},
    };
  }

  /**
   * Initialize registry (load from disk or create new)
   */
  async initialize(): Promise<void> {
    if (existsSync(this.registryPath)) {
      await this.load();
    } else {
      await this.save();
    }
  }

  /**
   * Load registry from disk
   */
  async load(): Promise<void> {
    try {
      const content = await readFile(this.registryPath, 'utf-8');
      this.data = JSON.parse(content);
      this.dirty = false;
    } catch (error: any) {
      throw new Error(`Failed to load skill registry: ${error.message}`);
    }
  }

  /**
   * Save registry to disk
   */
  async save(): Promise<void> {
    if (!this.dirty) {
      return; // No changes to save
    }

    try {
      // Ensure directory exists
      const dir = dirname(this.registryPath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      // Update timestamp
      this.data.lastUpdated = new Date().toISOString();

      // Write to file
      await writeFile(this.registryPath, JSON.stringify(this.data, null, 2), 'utf-8');
      this.dirty = false;
    } catch (error: any) {
      throw new Error(`Failed to save skill registry: ${error.message}`);
    }
  }

  /**
   * Register a skill
   */
  async registerSkill(entry: SkillRegistryEntry): Promise<void> {
    // Validate name format
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(entry.name)) {
      throw new Error(`Invalid skill name: ${entry.name} (must be kebab-case)`);
    }

    // Check for duplicates
    if (this.data.skills[entry.name]) {
      throw new Error(`Skill already registered: ${entry.name}`);
    }

    // Add to registry
    this.data.skills[entry.name] = entry;
    this.dirty = true;
    await this.save();
  }

  /**
   * Unregister a skill
   */
  async unregisterSkill(name: string): Promise<void> {
    if (!this.data.skills[name]) {
      throw new Error(`Skill not found: ${name}`);
    }

    delete this.data.skills[name];
    this.dirty = true;
    await this.save();
  }

  /**
   * Update a skill entry
   */
  async updateSkill(name: string, updates: Partial<SkillRegistryEntry>): Promise<void> {
    const entry = this.data.skills[name];
    if (!entry) {
      throw new Error(`Skill not found: ${name}`);
    }

    // Merge updates
    Object.assign(entry, updates);
    this.dirty = true;
    await this.save();
  }

  /**
   * Get skill by name
   */
  getSkill(name: string): SkillRegistryEntry | undefined {
    return this.data.skills[name];
  }

  /**
   * Check if skill exists
   */
  hasSkill(name: string): boolean {
    return name in this.data.skills;
  }

  /**
   * Get all skills
   */
  getAllSkills(): SkillRegistryEntry[] {
    return Object.values(this.data.skills);
  }

  /**
   * Get enabled skills only
   */
  getEnabledSkills(): SkillRegistryEntry[] {
    return this.getAllSkills().filter((s) => s.enabled);
  }

  /**
   * Search skills with filters
   */
  searchSkills(filters: SkillSearchFilters): SkillRegistryEntry[] {
    let results = this.getAllSkills();

    // Filter by enabled
    if (filters.enabled !== undefined) {
      results = results.filter((s) => s.enabled === filters.enabled);
    }

    // Filter by type
    if (filters.type) {
      results = results.filter((s) => s.type === filters.type);
    }

    // Filter by source
    if (filters.source) {
      results = results.filter((s) => s.source === filters.source);
    }

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter((s) =>
        filters.tags!.some((tag) => s.tags.includes(tag))
      );
    }

    // Filter by author
    if (filters.author) {
      results = results.filter((s) => s.author === filters.author);
    }

    // Text search
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      results = results.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query)
      );
    }

    return results;
  }

  /**
   * Sort skills
   */
  sortSkills(skills: SkillRegistryEntry[], sortBy: SkillSortOption = 'name'): SkillRegistryEntry[] {
    return [...skills].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'installedAt':
          return b.installedAt.localeCompare(a.installedAt);
        case 'usageCount':
          return b.usageCount - a.usageCount;
        case 'lastUsedAt':
          if (!a.lastUsedAt) return 1;
          if (!b.lastUsedAt) return -1;
          return b.lastUsedAt.localeCompare(a.lastUsedAt);
        default:
          return 0;
      }
    });
  }

  /**
   * Record skill usage
   */
  async recordUsage(name: string): Promise<void> {
    const entry = this.data.skills[name];
    if (!entry) {
      throw new Error(`Skill not found: ${name}`);
    }

    entry.usageCount++;
    entry.lastUsedAt = new Date().toISOString();
    this.dirty = true;
    await this.save();
  }

  /**
   * Enable/disable a skill
   */
  async setSkillEnabled(name: string, enabled: boolean): Promise<void> {
    await this.updateSkill(name, { enabled });
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    enabled: number;
    disabled: number;
    byType: Record<string, number>;
    bySource: Record<string, number>;
    totalUsage: number;
  } {
    const skills = this.getAllSkills();

    return {
      total: skills.length,
      enabled: skills.filter((s) => s.enabled).length,
      disabled: skills.filter((s) => !s.enabled).length,
      byType: skills.reduce((acc, s) => {
        acc[s.type] = (acc[s.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      bySource: skills.reduce((acc, s) => {
        acc[s.source] = (acc[s.source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      totalUsage: skills.reduce((sum, s) => sum + s.usageCount, 0),
    };
  }

  /**
   * Create registry entry from skill metadata
   */
  static createEntryFromMetadata(
    metadata: SimpleSkillMetadata,
    path: string,
    source: SkillRegistryEntry['source'] = 'local',
    sourceUrl?: string
  ): SkillRegistryEntry {
    return {
      name: metadata.name.toLowerCase().replace(/\s+/g, '-'),
      version: metadata.version || '1.0.0',
      description: metadata.description,
      source,
      sourceUrl,
      installedAt: new Date().toISOString(),
      author: metadata.author,
      license: metadata.license,
      type: metadata.type,
      tags: metadata.tags,
      enabled: true,
      hasScripts: metadata.hasScripts || false,
      hasReferences: metadata.hasReferences || false,
      hasAssets: metadata.hasAssets || false,
      usageCount: 0,
      path,
      skillMdPath: join(path, 'SKILL.md'),
    };
  }
}
