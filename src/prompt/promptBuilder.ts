// src/prompt/promptBuilder.ts
/**
 * 系统提示词架构重构
 * 参考 Claude Code 的静态+动态分区设计
 *
 * 功能：
 * 1. 静态+动态分区（SYSTEM_PROMPT_BOUNDARY 标记）
 * 2. 静态区可缓存（SOUL、角色定义等不变内容）
 * 3. 动态区按需生成（git 状态、文件树等）
 * 4. 与 SoulLoader 集成
 */

import { loadSoul, buildSoulPrompt, type SoulConfig } from '../context/soulLoader';
import { ConfigScanner, type ProjectContext } from '../context/configScanner';

/**
 * 静态+动态分区标记
 * OpenAI API 使用此标记识别可缓存区域
 */
export const SYSTEM_PROMPT_BOUNDARY = '__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__';

/**
 * 提示词分区类型
 */
export type PromptSectionType = 'static' | 'dynamic';

/**
 * 提示词分区
 */
export interface PromptSection {
  type: PromptSectionType;
  content: string;
  priority: number; // 优先级（数字越小越重要）
  cacheable: boolean; // 是否可缓存（仅 static 区）
}

/**
 * 提示词构建选项
 */
export interface PromptBuildOptions {
  includeSoul?: boolean;         // 是否包含 SOUL
  includeGitStatus?: boolean;    // 是否包含 git 状态
  includeFileTree?: boolean;     // 是否包含文件树
  includeUserProfile?: boolean;  // 是否包含用户侧写
  maxTokens?: number;            // 最大 token 数量
  agentType?: 'explore' | 'verify' | 'plan' | 'general'; // 代理类型
}

/**
 * 提示词构建结果
 */
export interface PromptBuildResult {
  fullPrompt: string;            // 完整提示词
  staticSection: string;         // 静态分区（可缓存）
  dynamicSection: string;        // 动态分区
  staticTokens: number;          // 静态区 token 估算
  dynamicTokens: number;         // 动态区 token 估算
  totalTokens: number;           // 总 token 估算
  cacheable: boolean;            // 是否可缓存
}

/**
 * 系统提示词构建器
 */
export class PromptBuilder {
  private staticSections: PromptSection[] = [];
  private dynamicSections: PromptSection[] = [];
  private soulConfig?: SoulConfig;
  private projectContext?: ProjectContext;

  /**
   * 添加静态分区
   */
  addStatic(content: string, priority: number = 0, cacheable: boolean = true): this {
    if (!content || content.trim().length === 0) {
      return this;
    }

    this.staticSections.push({
      type: 'static',
      content: content.trim(),
      priority,
      cacheable,
    });

    // 按优先级排序
    this.staticSections.sort((a, b) => a.priority - b.priority);

    return this;
  }

  /**
   * 添加动态分区
   */
  addDynamic(content: string, priority: number = 0): this {
    if (!content || content.trim().length === 0) {
      return this;
    }

    this.dynamicSections.push({
      type: 'dynamic',
      content: content.trim(),
      priority,
      cacheable: false, // 动态区不可缓存
    });

    // 按优先级排序
    this.dynamicSections.sort((a, b) => a.priority - b.priority);

    return this;
  }

  /**
   * 加载 SOUL 配置
   */
  async loadSoul(cwd: string): Promise<this> {
    this.soulConfig = await loadSoul(cwd);
    this.projectContext = {
      globalSoul: this.soulConfig.globalSoul,
      projectSoul: this.soulConfig.projectSoul,
      projectRules: this.soulConfig.projectRules,
      subDirRules: this.soulConfig.subDirRules,
      projectRoot: this.soulConfig.projectRoot || cwd,
    };

    return this;
  }

  /**
   * 添加 SOUL 提示词
   */
  addSoulPrompt(): this {
    if (!this.soulConfig) {
      console.warn('⚠️  Soul config not loaded. Call loadSoul() first.');
      return this;
    }

    // SOUL 是静态内容（很少变化）
    this.addStatic(this.soulConfig.prompt, 0, true);
    return this;
  }

  /**
   * 添加项目上下文
   */
  addProjectContext(options: PromptBuildOptions = {}): this {
    if (!this.projectContext) {
      console.warn('⚠️  Project context not loaded. Call loadSoul() first.');
      return this;
    }

    // Git 状态是动态内容
    if (options.includeGitStatus) {
      const gitStatus = this.generateGitStatus();
      if (gitStatus) {
        this.addDynamic(gitStatus, 10);
      }
    }

    // 文件树是动态内容
    if (options.includeFileTree) {
      const fileTree = this.generateFileTree();
      if (fileTree) {
        this.addDynamic(fileTree, 20);
      }
    }

    return this;
  }

  /**
   * 构建完整提示词
   */
  build(options: PromptBuildOptions = {}): PromptBuildResult {
    // 添加 SOUL 和项目上下文（如果未手动添加）
    if (options.includeSoul !== false && this.soulConfig && this.staticSections.length === 0) {
      this.addSoulPrompt();
    }

    if ((options.includeGitStatus || options.includeFileTree) && this.dynamicSections.length === 0) {
      this.addProjectContext(options);
    }

    // 构建静态分区
    const staticSection = this.staticSections.map(s => s.content).join('\n\n');

    // 构建动态分区
    const dynamicSection = this.dynamicSections.map(s => s.content).join('\n\n');

    // 组合完整提示词（用边界标记分隔）
    const fullPrompt = [staticSection, SYSTEM_PROMPT_BOUNDARY, dynamicSection]
      .filter(p => p.trim().length > 0)
      .join('\n\n');

    // 估算 token 数量
    const staticTokens = this.estimateTokens(staticSection);
    const dynamicTokens = this.estimateTokens(dynamicSection);
    const totalTokens = staticTokens + dynamicTokens;

    // 检查是否可缓存（静态区存在且动态区较小）
    const cacheable = staticSection.length > 1000 && dynamicTokens < staticTokens * 0.5;

    return {
      fullPrompt,
      staticSection,
      dynamicSection,
      staticTokens,
      dynamicTokens,
      totalTokens,
      cacheable,
    };
  }

  /**
   * 生成 git 状态
   */
  private generateGitStatus(): string | null {
    // 简化实现：实际应该运行 git 命令获取状态
    const parts: string[] = ['<!-- Git Status -->'];

    // TODO: 实际执行 git status, git branch 等命令
    parts.push('Git status not yet implemented.');

    return parts.join('\n');
  }

  /**
   * 生成文件树
   */
  private generateFileTree(): string | null {
    if (!this.projectContext?.projectRoot) {
      return null;
    }

    const parts: string[] = ['<!-- Project File Tree -->'];

    // TODO: 实际扫描项目文件树
    parts.push('File tree not yet implemented.');

    return parts.join('\n');
  }

  /**
   * 估算 token 数量
   */
  private estimateTokens(text: string): number {
    if (!text || text.length === 0) return 0;

    // 检测中文字符比例
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const totalChars = text.length;
    const chineseRatio = chineseChars / totalChars;

    // 根据中英文比例选择估算方法
    let charsPerToken: number;
    if (chineseRatio > 0.7) {
      charsPerToken = 1.5; // 中文约 1.5 字/token
    } else if (chineseRatio < 0.3) {
      charsPerToken = 4.0; // 英文约 4 字/token
    } else {
      charsPerToken = 2.5; // 混合约 2.5 字/token
    }

    return Math.ceil(totalChars / charsPerToken);
  }

  /**
   * 清空所有分区
   */
  clear(): this {
    this.staticSections = [];
    this.dynamicSections = [];
    return this;
  }

  /**
   * 克隆构建器
   */
  clone(): PromptBuilder {
    const builder = new PromptBuilder();
    builder.staticSections = [...this.staticSections];
    builder.dynamicSections = [...this.dynamicSections];
    builder.soulConfig = this.soulConfig;
    builder.projectContext = this.projectContext;
    return builder;
  }
}

/**
 * 快速构建系统提示词
 */
export async function buildSystemPromptWithOptions(
  cwd: string,
  options: PromptBuildOptions = {}
): Promise<PromptBuildResult> {
  const builder = new PromptBuilder();
  await builder.loadSoul(cwd);

  // 添加默认静态内容
  if (options.includeSoul !== false) {
    builder.addSoulPrompt();
  }

  // 添加代理专用提示词
  if (options.agentType) {
    const agentPrompt = getAgentPrompt(options.agentType);
    builder.addStatic(agentPrompt, 5, true);
  }

  // 添加动态内容
  builder.addProjectContext(options);

  return builder.build(options);
}

/**
 * 获取代理专用提示词
 */
function getAgentPrompt(agentType: 'explore' | 'verify' | 'plan' | 'general'): string {
  const prompts: Record<string, string> = {
    explore: `You are operating in EXPLORE mode.
- Read-only access to files
- Focus on information gathering
- Use Glob and Grep efficiently
- Never modify the codebase`,

    verify: `You are operating in VERIFY mode.
- Your job is to BREAK things, not confirm they work
- Test edge cases, not just happy paths
- "Code looks correct" is NOT verification
- Run actual tests, don't just read code`,

    plan: `You are operating in PLAN mode.
- Break down complex tasks into clear steps
- Identify dependencies between tasks
- Propose multiple approaches when valid alternatives exist
- Consider trade-offs: speed, quality, maintainability`,

    general: '',
  };

  return prompts[agentType] || '';
}

/**
 * 构建缓存友好的提示词
 * 优化静态区，最小化动态区
 */
export async function buildCacheFriendlyPrompt(
  cwd: string,
  options: PromptBuildOptions = {}
): Promise<PromptBuildResult> {
  // 强制包含 SOUL（静态）
  options.includeSoul = true;

  // 默认不包含 git 状态和文件树（动态）
  options.includeGitStatus = options.includeGitStatus || false;
  options.includeFileTree = options.includeFileTree || false;

  return buildSystemPromptWithOptions(cwd, options);
}

/**
 * Prompt 构建器管理器
 * 管理多个构建器实例
 */
export class PromptBuilderManager {
  private builders: Map<string, PromptBuilder> = new Map();

  /**
   * 获取或创建构建器
   */
  getBuilder(id: string = 'default'): PromptBuilder {
    if (!this.builders.has(id)) {
      this.builders.set(id, new PromptBuilder());
    }
    return this.builders.get(id)!;
  }

  /**
   * 移除构建器
   */
  removeBuilder(id: string): boolean {
    return this.builders.delete(id);
  }

  /**
   * 清空所有构建器
   */
  clear(): void {
    this.builders.clear();
  }

  /**
   * 列出所有构建器 ID
   */
  listBuilders(): string[] {
    return Array.from(this.builders.keys());
  }
}

// 导出单例管理器
export const promptBuilderManager = new PromptBuilderManager();
