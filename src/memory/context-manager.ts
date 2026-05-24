/**
 * Project Context Manager
 *
 * 管理项目上下文记忆，提供缓存和更新功能
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  ProjectContext,
  ProjectStructure,
  DependencyInfo,
  ProjectConfig,
  FileChange,
  ContextCacheOptions,
  ContextUpdateResult,
} from './types';
import { scanDirectory } from '../scanner';

/**
 * 项目上下文管理器
 */
export class ContextManager {
  private projectRoot: string;
  private cacheDir: string;
  private contextFile: string;
  private changesFile: string;
  private ttl: number;
  private maxChanges: number;
  private currentContext: ProjectContext | null = null;

  constructor(projectRoot: string, options: ContextCacheOptions = {}) {
    this.projectRoot = projectRoot;
    this.cacheDir = options.cacheDir || join(projectRoot, '.memo', 'context');
    this.contextFile = join(this.cacheDir, 'structure.json');
    this.changesFile = join(this.cacheDir, 'recent-changes.json');
    this.ttl = options.ttl || 3600; // 1 hour
    this.maxChanges = options.maxChanges || 50;
  }

  /**
   * 初始化上下文管理器
   */
  async initialize(): Promise<void> {
    if (!existsSync(this.cacheDir)) {
      await fs.mkdir(this.cacheDir, { recursive: true });
    }

    // 尝试加载现有上下文
    await this.loadContext();
  }

  /**
   * 加载缓存的上下文
   */
  private async loadContext(): Promise<void> {
    try {
      if (!existsSync(this.contextFile)) {
        this.currentContext = null;
        return;
      }

      const content = await fs.readFile(this.contextFile, 'utf-8');
      this.currentContext = JSON.parse(content);
    } catch (error) {
      console.error(`Failed to load context: ${error}`);
      this.currentContext = null;
    }
  }

  /**
   * 保存上下文到磁盘
   */
  private async saveContext(context: ProjectContext): Promise<void> {
    try {
      const content = JSON.stringify(context, null, 2);
      await fs.writeFile(this.contextFile, content, 'utf-8');
      this.currentContext = context;
    } catch (error) {
      console.error(`Failed to save context: ${error}`);
    }
  }

  /**
   * 加载变更历史
   */
  private async loadChanges(): Promise<FileChange[]> {
    try {
      if (!existsSync(this.changesFile)) {
        return [];
      }

      const content = await fs.readFile(this.changesFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Failed to load changes: ${error}`);
      return [];
    }
  }

  /**
   * 保存变更历史
   */
  private async saveChanges(changes: FileChange[]): Promise<void> {
    try {
      const content = JSON.stringify(changes, null, 2);
      await fs.writeFile(this.changesFile, content, 'utf-8');
    } catch (error) {
      console.error(`Failed to save changes: ${error}`);
    }
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid(): boolean {
    if (!this.currentContext) {
      return false;
    }

    const lastUpdated = new Date(this.currentContext.lastUpdated).getTime();
    const now = Date.now();
    const age = (now - lastUpdated) / 1000; // seconds

    return age < this.ttl;
  }

  /**
   * 扫描项目结构
   */
  private async scanStructure(): Promise<ProjectStructure> {
    const startTime = Date.now();

    // 使用 listOnly 模式快速扫描
    const files = await scanDirectory(this.projectRoot, {
      maxLinesPerFile: 0, // 不读取内容
      maxFiles: 10000,
      listOnly: true,
    });

    const directories = new Set<string>();
    const fileTypes: Record<string, number> = {};
    let totalLines = 0;

    for (const [filePath, content] of Object.entries(files)) {
      const dir = filePath.split('/').slice(0, -1).join('/');
      if (dir) {
        directories.add(dir);
      }

      const ext = filePath.split('.').pop() || '';
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;

      // 估算行数（基于文件大小）
      totalLines += content.split('\n').length;
    }

    // 确定主要语言
    const sortedExts = Object.entries(fileTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([ext]) => ext);

    return {
      lastScanned: new Date().toISOString(),
      projectRoot: this.projectRoot,
      directories: Array.from(directories).sort(),
      fileTypes,
      totalFiles: Object.keys(files).length,
      totalLines,
      primaryLanguages: sortedExts,
    };
  }

  /**
   * 读取依赖信息
   */
  private async scanDependencies(): Promise<DependencyInfo> {
    const runtime: Record<string, string> = {};
    const dev: Record<string, string> = {};

    try {
      const packageJsonPath = join(this.projectRoot, 'package.json');
      if (existsSync(packageJsonPath)) {
        const content = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(content);

        Object.assign(runtime, packageJson.dependencies || {});
        Object.assign(dev, packageJson.devDependencies || {});
      }
    } catch (error) {
      // Ignore errors
    }

    return {
      runtime,
      dev,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * 检测项目配置
   */
  private async detectConfig(): Promise<ProjectConfig> {
    const config: ProjectConfig = {
      testing: [],
      packageManager: 'unknown',
    };

    try {
      // 检测 TypeScript
      const tsconfigPath = join(this.projectRoot, 'tsconfig.json');
      if (existsSync(tsconfigPath)) {
        const content = await fs.readFile(tsconfigPath, 'utf-8');
        const tsconfig = JSON.parse(content);

        config.typescript = {
          enabled: true,
          strict: tsconfig.compilerOptions?.strict || false,
          target: tsconfig.compilerOptions?.target,
        };
      }

      // 检测框架
      const packageJsonPath = join(this.projectRoot, 'package.json');
      if (existsSync(packageJsonPath)) {
        const content = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(content);
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

        // 检测框架
        if (deps.react) config.framework = 'React';
        else if (deps.vue) config.framework = 'Vue';
        else if (deps.angular) config.framework = 'Angular';
        else if (deps.svelte) config.framework = 'Svelte';
        else if (deps.next) config.framework = 'Next.js';
        else if (deps.nuxt) config.framework = 'Nuxt';
        else if (deps.express) config.framework = 'Express';
        else if (deps.fastify) config.framework = 'Fastify';
        else if (deps.nest) config.framework = 'NestJS';

        // 检测构建工具
        if (deps.vite) config.buildTool = 'Vite';
        else if (deps.webpack) config.buildTool = 'Webpack';
        else if (deps.rollup) config.buildTool = 'Rollup';
        else if (deps.esbuild) config.buildTool = 'Esbuild';
        else if (deps.parcel) config.buildTool = 'Parcel';

        // 检测测试框架
        if (deps.jest) config.testing.push('Jest');
        if (deps.vitest) config.testing.push('Vitest');
        if (deps.mocha) config.testing.push('Mocha');
        if (deps['@testing-library/react']) config.testing.push('RTL');
        if (deps.jasmine) config.testing.push('Jasmine');

        // 检测包管理器
        if (existsSync(join(this.projectRoot, 'yarn.lock'))) {
          config.packageManager = 'yarn';
        } else if (existsSync(join(this.projectRoot, 'pnpm-lock.yaml'))) {
          config.packageManager = 'pnpm';
        } else if (existsSync(join(this.projectRoot, 'package-lock.json'))) {
          config.packageManager = 'npm';
        }
      }
    } catch (error) {
      // Ignore errors
    }

    return config;
  }

  /**
   * 生成版本号（基于文件内容哈希）
   */
  private generateVersion(structure: ProjectStructure): string {
    // 简单版本：基于文件数量和时间戳
    const hash = `${structure.totalFiles}-${structure.lastScanned}`;
    return Buffer.from(hash).toString('base64').substring(0, 16);
  }

  /**
   * 获取项目上下文（如果缓存有效则返回缓存）
   */
  async getContext(forceRefresh = false): Promise<ProjectContext> {
    // 如果缓存有效且不强制刷新，返回缓存
    if (!forceRefresh && this.isCacheValid() && this.currentContext) {
      return this.currentContext;
    }

    // 否则更新上下文
    return await this.updateContext();
  }

  /**
   * 更新项目上下文
   */
  async updateContext(): Promise<ProjectContext> {
    const startTime = Date.now();
    const result: ContextUpdateResult = {
      updated: false,
      duration: 0,
      changes: {},
    };

    try {
      // 扫描各个部分
      const structure = await this.scanStructure();
      const dependencies = await this.scanDependencies();
      const config = await this.detectConfig();
      const recentChanges = await this.loadChanges();

      // 创建新上下文
      const newContext: ProjectContext = {
        lastUpdated: new Date().toISOString(),
        structure,
        dependencies,
        config,
        recentChanges: recentChanges.slice(0, this.maxChanges),
        version: this.generateVersion(structure),
      };

      // 检测变化
      if (this.currentContext) {
        result.changes = {
          structure: structure.totalFiles !== this.currentContext.structure.totalFiles,
          dependencies:
            JSON.stringify(dependencies.runtime) !== JSON.stringify(this.currentContext.dependencies.runtime),
          config: config.framework !== this.currentContext.config.framework,
        };
      } else {
        result.updated = true;
        result.changes = { structure: true, dependencies: true, config: true };
      }

      // 保存上下文
      await this.saveContext(newContext);

      result.updated = true;
      result.duration = Date.now() - startTime;

      console.log(`✓ Context updated in ${result.duration}ms`);
      return newContext;
    } catch (error) {
      console.error(`Failed to update context: ${error}`);
      throw error;
    }
  }

  /**
   * 记录文件变更
   */
  async recordChange(change: Omit<FileChange, 'timestamp'>): Promise<void> {
    const newChange: FileChange = {
      ...change,
      timestamp: new Date().toISOString(),
    };

    let changes = await this.loadChanges();

    // 添加新变更到前面
    changes.unshift(newChange);

    // 限制数量
    if (changes.length > this.maxChanges) {
      changes = changes.slice(0, this.maxChanges);
    }

    // 保存
    await this.saveChanges(changes);

    // 更新上下文中的变更记录
    if (this.currentContext) {
      this.currentContext.recentChanges = changes;
      this.currentContext.lastUpdated = new Date().toISOString();
    }
  }

  /**
   * 获取项目摘要（用于 AI 上下文）
   */
  async getSummary(): Promise<string> {
    const context = await this.getContext();

    const parts: string[] = [];

    // 项目结构
    parts.push('📁 Project Structure:');
    parts.push(`  - Total Files: ${context.structure.totalFiles}`);
    parts.push(`  - Total Lines: ~${context.structure.totalLines.toLocaleString()}`);
    parts.push(`  - Languages: ${context.structure.primaryLanguages.join(', ')}`);
    parts.push(`  - Directories: ${context.structure.directories.length}`);

    // 框架和工具
    if (context.config.framework || context.config.buildTool) {
      parts.push('\n🔧 Tech Stack:');
      if (context.config.framework) parts.push(`  - Framework: ${context.config.framework}`);
      if (context.config.buildTool) parts.push(`  - Build Tool: ${context.config.buildTool}`);
      if (context.config.packageManager !== 'unknown') {
        parts.push(`  - Package Manager: ${context.config.packageManager}`);
      }
      if (context.config.testing.length > 0) {
        parts.push(`  - Testing: ${context.config.testing.join(', ')}`);
      }
    }

    // TypeScript
    if (context.config.typescript?.enabled) {
      parts.push('\n📘 TypeScript:');
      parts.push(`  - Enabled: Yes`);
      if (context.config.typescript.strict) parts.push(`  - Strict Mode: Yes`);
      if (context.config.typescript.target) parts.push(`  - Target: ${context.config.typescript.target}`);
    }

    // 主要依赖
    const mainDeps = Object.keys(context.dependencies.runtime)
      .slice(0, 10)
      .map(dep => `${dep}@${context.dependencies.runtime[dep]}`);
    if (mainDeps.length > 0) {
      parts.push('\n📦 Main Dependencies:');
      mainDeps.forEach(dep => parts.push(`  - ${dep}`));
    }

    // 最近变更
    if (context.recentChanges.length > 0) {
      const recentCount = Math.min(5, context.recentChanges.length);
      parts.push(`\n📝 Recent Changes (${recentCount}):`);
      context.recentChanges.slice(0, recentCount).forEach(change => {
        const icon = change.type === 'create' ? '➕' : change.type === 'delete' ? '❌' : '✏️';
        parts.push(`  ${icon} ${change.file} (${new Date(change.timestamp).toLocaleDateString()})`);
      });
    }

    return parts.join('\n');
  }

  /**
   * 搜索相关文件
   */
  async searchFiles(keyword: string): Promise<string[]> {
    const context = await this.getContext();
    const keywordLower = keyword.toLowerCase();

    // 搜索文件路径
    const files = Object.keys(context.structure.fileTypes).filter(ext => {
      // 这里简化处理，实际应该扫描文件列表
      return false; // TODO: 实现完整文件列表搜索
    });

    return files;
  }

  /**
   * 清除缓存
   */
  async clearCache(): Promise<void> {
    this.currentContext = null;
    if (existsSync(this.contextFile)) {
      await fs.unlink(this.contextFile);
    }
  }
}

/**
 * 创建上下文管理器实例
 */
export function createContextManager(projectRoot: string, options?: ContextCacheOptions): ContextManager {
  return new ContextManager(projectRoot, options);
}
