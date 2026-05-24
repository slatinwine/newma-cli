/**
 * User Preferences Memory Manager
 *
 * 管理用户偏好设置，自动学习和适应用户习惯
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  UserPreferences,
  CodeStylePreferences,
  WorkflowPreferences,
  AIInteractionPreferences,
  ToolPreferences,
  TechStackPreferences,
  NotificationPreferences,
  PreferencesUpdateOptions,
} from './preferences-types';

/**
 * 用户偏好管理器
 */
export class PreferencesManager {
  private projectRoot: string;
  private preferencesFile: string;
  private preferences: UserPreferences | null = null;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.preferencesFile = join(projectRoot, '.memo', 'preferences.json');
  }

  /**
   * 初始化偏好管理器
   */
  async initialize(): Promise<void> {
    // 确保目录存在
    const dir = join(this.projectRoot, '.memo');
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }

    // 加载偏好
    await this.loadPreferences();

    // 如果不存在，创建默认偏好
    if (!this.preferences) {
      await this.createDefaultPreferences();
    }
  }

  /**
   * 加载偏好设置
   */
  private async loadPreferences(): Promise<void> {
    try {
      if (!existsSync(this.preferencesFile)) {
        this.preferences = null;
        return;
      }

      const content = await fs.readFile(this.preferencesFile, 'utf-8');
      this.preferences = JSON.parse(content);
    } catch (error) {
      console.error(`[Preferences] Failed to load: ${error}`);
      this.preferences = null;
    }
  }

  /**
   * 保存偏好设置
   */
  private async savePreferences(): Promise<void> {
    if (!this.preferences) {
      return;
    }

    try {
      this.preferences.lastUpdated = new Date().toISOString();
      const content = JSON.stringify(this.preferences, null, 2);
      await fs.writeFile(this.preferencesFile, content, 'utf-8');
    } catch (error) {
      console.error(`[Preferences] Failed to save: ${error}`);
    }
  }

  /**
   * 创建默认偏好设置
   */
  private async createDefaultPreferences(): Promise<void> {
    this.preferences = {
      userId: this.generateUserId(),
      lastUpdated: new Date().toISOString(),
      codeStyle: {
        indent: 'spaces',
        indentSize: 2,
        quoteStyle: 'single',
        trailingComma: true,
        semicolons: true,
        namingConvention: 'camelCase',
        maxLineLength: 100,
        bracePosition: 'same-line',
      },
      workflow: {
        autoSave: false,
        autoTest: false,
        defaultMode: 'chat',
        verificationLevel: 'standard',
        verbose: false,
        colors: true,
      },
      aiInteraction: {
        language: 'auto',
        verbosity: 'normal',
        planningAlgorithm: 'auto',
        includeContext: true,
        useEmojis: true,
        proactiveSuggestions: true,
        commentStyle: 'standard',
        errorHandling: 'suggest-fixes',
      },
      tools: {
        preferredPackageManager: 'npm',
        testFramework: 'jest',
        linters: ['eslint'],
        formatters: ['prettier'],
        buildTool: 'tsc',
        versionControl: {
          enabled: true,
          autoCommit: false,
          commitMessageFormat: '{type}: {message}',
        },
      },
      techStack: {
        primaryLanguages: ['TypeScript', 'JavaScript'],
        preferredFrameworks: [],
        preferredLibraries: {},
        avoidedTechnologies: [],
        learningMode: 'balanced',
      },
      notifications: {
        enabled: true,
        level: 'warnings-and-errors',
        onError: true,
        onWarning: true,
        onComplete: false,
        progressUpdateInterval: 5,
      },
      custom: {},
    };

    await this.savePreferences();
    console.log('[Preferences] Created default preferences');
  }

  /**
   * 生成用户 ID
   */
  private generateUserId(): string {
    // 基于项目路径和时间戳生成唯一 ID
    const hash = Buffer.from(this.projectRoot).toString('base64').substring(0, 16);
    const timestamp = Date.now().toString(36);
    return `user-${hash}-${timestamp}`;
  }

  /**
   * 获取完整偏好设置
   */
  async getPreferences(): Promise<UserPreferences | null> {
    return this.preferences;
  }

  /**
   * 获取代码风格偏好
   */
  async getCodeStylePreferences(): Promise<CodeStylePreferences> {
    if (!this.preferences) {
      await this.loadPreferences();
    }
    return this.preferences?.codeStyle || this.getDefaultCodeStyle();
  }

  /**
   * 获取 AI 交互偏好
   */
  async getAIInteractionPreferences(): Promise<AIInteractionPreferences> {
    if (!this.preferences) {
      await this.loadPreferences();
    }
    return this.preferences?.aiInteraction || this.getDefaultAIInteraction();
  }

  /**
   * 更新偏好设置
   */
  async updatePreferences(
    updates: Partial<UserPreferences>,
    options: PreferencesUpdateOptions = {}
  ): Promise<void> {
    if (!this.preferences) {
      await this.loadPreferences();
      if (!this.preferences) {
        await this.createDefaultPreferences();
      }
    }

    // 合并更新
    this.preferences = {
      ...this.preferences!,
      ...updates,
    };

    await this.savePreferences();

    if (options.reason) {
      console.log(`[Preferences] Updated: ${options.reason}`);
    }
  }

  /**
   * 更新代码风格偏好
   */
  async updateCodeStyle(updates: Partial<CodeStylePreferences>): Promise<void> {
    if (!this.preferences) {
      await this.loadPreferences();
    }

    this.preferences!.codeStyle = {
      ...this.preferences!.codeStyle,
      ...updates,
    };

    await this.savePreferences();
  }

  /**
   * 更新 AI 交互偏好
   */
  async updateAIInteraction(updates: Partial<AIInteractionPreferences>): Promise<void> {
    if (!this.preferences) {
      await this.loadPreferences();
    }

    this.preferences!.aiInteraction = {
      ...this.preferences!.aiInteraction,
      ...updates,
    };

    await this.savePreferences();
  }

  /**
   * 学习偏好（从用户行为中）
   */
  async learnFromBehavior(behavior: {
    commandType?: string;
    language?: string;
    verbosity?: string;
    framework?: string;
    tool?: string;
  }): Promise<void> {
    if (!this.preferences) {
      await this.loadPreferences();
    }

    let updated = false;

    // 学习语言偏好
    if (behavior.language) {
      const lang = behavior.language as 'zh' | 'en' | 'auto';
      if (lang !== 'auto' && this.preferences!.aiInteraction.language === 'auto') {
        // 检测到明确的语言偏好
        this.preferences!.aiInteraction.language = lang;
        updated = true;
      }
    }

    // 学习详细程度偏好
    if (behavior.verbosity) {
      const verbosity = behavior.verbosity as 'concise' | 'normal' | 'detailed';
      // 如果用户多次选择详细程度，可以更新偏好
      // 这里简化处理，实际可以统计频率
      if (this.preferences!.aiInteraction.verbosity === 'normal' && verbosity === 'concise') {
        // 不立即更新，需要更多数据
      }
    }

    // 学习规划算法偏好
    if (behavior.commandType === 'plan' || behavior.commandType === 'fft') {
      // 可以记录算法使用频率
    }

    if (updated) {
      await this.savePreferences();
      console.log('[Preferences] Learned from behavior');
    }
  }

  /**
   * 导入从用户侧写文件
   */
  async importFromUserProfile(): Promise<void> {
    const profilePath = join(this.projectRoot, '用户侧写.md');

    if (!existsSync(profilePath)) {
      return;
    }

    try {
      const content = await fs.readFile(profilePath, 'utf-8');

      // 解析用户侧写
      const language = content.includes('语言偏好') && content.includes('中文') ? 'zh' : 'en';
      const style = content.includes('简洁') ? 'concise' : content.includes('详细') ? 'detailed' : 'normal';

      await this.updateAIInteraction({
        language,
        verbosity: style,
      });

      console.log('[Preferences] Imported from 用户侧写.md');
    } catch (error) {
      console.error(`[Preferences] Failed to import profile: ${error}`);
    }
  }

  /**
   * 导出为用户侧写格式
   */
  async exportToUserProfile(): Promise<string> {
    if (!this.preferences) {
      await this.loadPreferences();
    }

    const prefs = this.preferences!;

    let profile = '# 用户侧写\n\n';
    profile += `## 基础信息\n\n`;
    profile += `- **语言偏好**: ${prefs.aiInteraction.language === 'zh' ? '中文' : prefs.aiInteraction.language === 'en' ? 'English' : 'Auto'}\n`;
    profile += `- **交流风格**: ${prefs.aiInteraction.verbosity === 'concise' ? '简洁直接' : prefs.aiInteraction.verbosity === 'detailed' ? '详细说明' : '正常'}\n`;
    profile += `- **更新时间**: ${new Date(prefs.lastUpdated).toLocaleString()}\n\n`;

    profile += `## 代码风格\n\n`;
    profile += `- **缩进**: ${prefs.codeStyle.indent === 'spaces' ? '空格' : '制表符'} (${prefs.codeStyle.indentSize})\n`;
    profile += `- **引号**: ${prefs.codeStyle.quoteStyle === 'single' ? '单引号' : '双引号'}\n`;
    profile += `- **命名**: ${prefs.codeStyle.namingConvention}\n`;
    profile += `- **最大行长度**: ${prefs.codeStyle.maxLineLength}\n\n`;

    profile += `## 开发偏好\n\n`;
    profile += `- **默认模式**: ${prefs.workflow.defaultMode}\n`;
    profile += `- **验证级别**: ${prefs.workflow.verificationLevel}\n`;
    profile += `- **包管理器**: ${prefs.tools.preferredPackageManager}\n`;
    profile += `- **测试框架**: ${prefs.tools.testFramework}\n\n`;

    if (prefs.techStack.preferredFrameworks.length > 0) {
      profile += `## 技术栈\n\n`;
      profile += `- **首选语言**: ${prefs.techStack.primaryLanguages.join(', ')}\n`;
      profile += `- **首选框架**: ${prefs.techStack.preferredFrameworks.join(', ')}\n\n`;
    }

    return profile;
  }

  /**
   * 生成代码风格配置
   */
  async generateCodeStyleConfig(): Promise<{
    [key: string]: any;
  }> {
    const style = await this.getCodeStylePreferences();

    return {
      indent: style.indent === 'spaces' ? style.indentSize : '\t',
      quotes: style.quoteStyle === 'single' ? 'single' : 'double',
      semi: style.semicolons,
      trailingComma: style.trailingComma,
      maxLineLength: style.maxLineLength,
      bracketSpacing: true,
    };
  }

  /**
   * 获取格式化的偏好摘要（用于 AI 上下文）
   */
  async getFormattedSummary(): Promise<string> {
    if (!this.preferences) {
      await this.loadPreferences();
    }

    if (!this.preferences) {
      return '';
    }

    const prefs = this.preferences;
    let summary = '⚙️ User Preferences:\n\n';

    // 代码风格
    summary += '📝 Code Style:\n';
    summary += `  Indent: ${prefs.codeStyle.indent} (${prefs.codeStyle.indentSize})\n`;
    summary += `  Quotes: ${prefs.codeStyle.quoteStyle}\n`;
    summary += `  Naming: ${prefs.codeStyle.namingConvention}\n\n`;

    // AI 交互
    summary += '🤖 AI Interaction:\n';
    summary += `  Language: ${prefs.aiInteraction.language}\n`;
    summary += `  Verbosity: ${prefs.aiInteraction.verbosity}\n`;
    if (prefs.aiInteraction.planningAlgorithm !== 'auto') {
      summary += `  Algorithm: ${prefs.aiInteraction.planningAlgorithm}\n`;
    }
    summary += `  Comments: ${prefs.aiInteraction.commentStyle}\n\n`;

    // 工作流
    summary += '🔧 Workflow:\n';
    summary += `  Default Mode: ${prefs.workflow.defaultMode}\n`;
    summary += `  Verification: ${prefs.workflow.verificationLevel}\n`;
    summary += `  Package Manager: ${prefs.tools.preferredPackageManager}\n`;

    return summary;
  }

  /**
   * 获取默认代码风格
   */
  private getDefaultCodeStyle(): CodeStylePreferences {
    return {
      indent: 'spaces',
      indentSize: 2,
      quoteStyle: 'single',
      trailingComma: true,
      semicolons: true,
      namingConvention: 'camelCase',
      maxLineLength: 100,
      bracePosition: 'same-line',
    };
  }

  /**
   * 获取默认 AI 交互偏好
   */
  private getDefaultAIInteraction(): AIInteractionPreferences {
    return {
      language: 'auto',
      verbosity: 'normal',
      planningAlgorithm: 'auto',
      includeContext: true,
      useEmojis: true,
      proactiveSuggestions: true,
      commentStyle: 'standard',
      errorHandling: 'suggest-fixes',
    };
  }

  /**
   * 重置为默认偏好
   */
  async resetToDefaults(): Promise<void> {
    this.preferences = null;
    await this.createDefaultPreferences();
    console.log('[Preferences] Reset to defaults');
  }

  /**
   * 验证偏好设置
   */
  async validatePreferences(): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    if (!this.preferences) {
      return { valid: false, errors: ['No preferences found'] };
    }

    // 验证代码风格
    if (this.preferences.codeStyle.indentSize < 1 || this.preferences.codeStyle.indentSize > 8) {
      errors.push('Indent size must be between 1 and 8');
    }

    if (this.preferences.codeStyle.maxLineLength < 80 || this.preferences.codeStyle.maxLineLength > 200) {
      errors.push('Max line length must be between 80 and 200');
    }

    // 验证通知
    if (this.preferences.notifications.progressUpdateInterval < 1) {
      errors.push('Progress update interval must be at least 1 second');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * 创建用户偏好管理器实例
 */
export function createPreferencesManager(projectRoot: string): PreferencesManager {
  return new PreferencesManager(projectRoot);
}
