/**
 * 分层权限验证链
 *
 * 实现三层权限验证系统：
 * 1. 全局规则：~/.newma/permissions.json
 * 2. 项目规则：.newma/permissions.json
 * 3. 工具级规则：工具自身声明的权限要求
 *
 * @author Newma (牛码) Development Team
 * @version 1.0.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * 权限操作类型
 */
export type PermissionAction = 'read' | 'write' | 'delete' | 'execute' | 'network';

/**
 * 权限决策结果
 */
export type PermissionDecision = 'allow' | 'deny' | 'confirm';

/**
 * 权限规则
 */
export interface PermissionRule {
  /** 操作类型 */
  action: PermissionAction;
  /** 资源模式（支持 glob） */
  pattern: string;
  /** 决策 */
  decision: PermissionDecision;
  /** 是否继承到子目录 */
  inherit?: boolean;
  /** 过期时间（可选） */
  expiresAt?: Date;
  /** 备注 */
  note?: string;
}

/**
 * 权限配置文件
 */
export interface PermissionConfig {
  /** 版本号 */
  version: string;
  /** 规则列表 */
  rules: PermissionRule[];
  /** 最后更新时间 */
  lastUpdated?: string;
}

/**
 * 工具权限要求
 */
export interface ToolPermissionRequirement {
  /** 工具名称 */
  toolName: string;
  /** 所需权限 */
  requiredActions: PermissionAction[];
  /** 默认决策（未配置规则时） */
  defaultDecision?: PermissionDecision;
  /** 权限描述 */
  description?: string;
}

/**
 * 权限验证请求
 */
export interface PermissionRequest {
  /** 操作类型 */
  action: PermissionAction;
  /** 资源路径 */
  resourcePath: string;
  /** 工具名称（可选） */
  toolName?: string;
  /** 项目根目录 */
  projectRoot: string;
}

/**
 * 权限验证结果
 */
export interface PermissionResult {
  /** 决策结果 */
  decision: PermissionDecision;
  /** 匹配的规则来源 */
  source: 'global' | 'project' | 'tool' | 'default';
  /** 匹配的规则（如果有） */
  rule?: PermissionRule;
  /** 理由说明 */
  reason: string;
  /** 缓存键 */
  cacheKey?: string;
}

/**
 * 权限缓存项
 */
interface CacheItem {
  result: PermissionResult;
  expiresAt: Date;
}

/**
 * 权限验证链类
 */
export class PermissionChain {
  /** 全局配置文件路径 */
  private readonly globalConfigPath: string;
  /** 权限缓存 */
  private readonly cache: Map<string, CacheItem> = new Map();
  /** 缓存过期时间（秒） */
  private readonly cacheTTL: number = 300; // 5 分钟
  /** 工具权限要求注册表 */
  private readonly toolRequirements: Map<string, ToolPermissionRequirement> = new Map();

  constructor() {
    this.globalConfigPath = path.join(os.homedir(), '.newma', 'permissions.json');
  }

  /**
   * 注册工具权限要求
   */
  registerToolRequirement(requirement: ToolPermissionRequirement): void {
    this.toolRequirements.set(requirement.toolName, requirement);
  }

  /**
   * 批量注册工具权限要求
   */
  registerToolRequirements(requirements: ToolPermissionRequirement[]): void {
    requirements.forEach(req => this.registerToolRequirement(req));
  }

  /**
   * 验证权限
   */
  async verify(request: PermissionRequest): Promise<PermissionResult> {
    // 生成缓存键
    const cacheKey = this.generateCacheKey(request);

    // 检查缓存
    const cachedResult = this.getFromCache(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // 第一层：全局规则验证
    const globalResult = await this.verifyWithGlobalRules(request);
    if (globalResult.decision === 'deny') {
      return this.cacheResult(cacheKey, globalResult);
    }
    if (globalResult.decision === 'allow') {
      return this.cacheResult(cacheKey, globalResult);
    }

    // 第二层：项目规则验证
    const projectResult = await this.verifyWithProjectRules(request);
    if (projectResult.decision === 'deny') {
      return this.cacheResult(cacheKey, projectResult);
    }
    if (projectResult.decision === 'allow') {
      return this.cacheResult(cacheKey, projectResult);
    }

    // 第三层：工具级规则验证
    const toolResult = await this.verifyWithToolRules(request);
    if (toolResult.decision === 'deny') {
      return this.cacheResult(cacheKey, toolResult);
    }
    if (toolResult.decision === 'allow') {
      return this.cacheResult(cacheKey, toolResult);
    }

    // 未匹配任何规则，返回默认决策
    const defaultResult = this.getDefaultDecision(request);
    return this.cacheResult(cacheKey, defaultResult);
  }

  /**
   * 使用全局规则验证
   */
  private async verifyWithGlobalRules(request: PermissionRequest): Promise<PermissionResult> {
    try {
      const config = await this.loadConfig(this.globalConfigPath);
      const matchedRule = this.findMatchingRule(config.rules, request.action, request.resourcePath);

      if (matchedRule) {
        // 检查规则是否过期
        if (matchedRule.expiresAt && matchedRule.expiresAt < new Date()) {
          return {
            decision: 'confirm',
            source: 'global',
            reason: '全局权限规则已过期',
          };
        }

        return {
          decision: matchedRule.decision,
          source: 'global',
          rule: matchedRule,
          reason: `匹配全局规则: ${matchedRule.pattern}`,
        };
      }
    } catch (error) {
      // 配置文件不存在或读取失败，继续下一层验证
    }

    return {
      decision: 'confirm',
      source: 'global',
      reason: '全局规则未匹配',
    };
  }

  /**
   * 使用项目规则验证
   */
  private async verifyWithProjectRules(request: PermissionRequest): Promise<PermissionResult> {
    try {
      const projectConfigPath = path.join(request.projectRoot, '.newma', 'permissions.json');
      const config = await this.loadConfig(projectConfigPath);

      // 检查资源是否在项目内
      const absoluteResourcePath = path.resolve(request.resourcePath);
      const absoluteProjectPath = path.resolve(request.projectRoot);

      if (!absoluteResourcePath.startsWith(absoluteProjectPath)) {
        return {
          decision: 'confirm',
          source: 'project',
          reason: '资源不在项目目录内',
        };
      }

      // 查找匹配的规则（支持继承）
      const matchedRule = this.findMatchingRuleWithInheritance(
        config.rules,
        request.action,
        request.resourcePath,
        request.projectRoot
      );

      if (matchedRule) {
        // 检查规则是否过期
        if (matchedRule.expiresAt && matchedRule.expiresAt < new Date()) {
          return {
            decision: 'confirm',
            source: 'project',
            reason: '项目权限规则已过期',
          };
        }

        return {
          decision: matchedRule.decision,
          source: 'project',
          rule: matchedRule,
          reason: `匹配项目规则: ${matchedRule.pattern}`,
        };
      }
    } catch (error) {
      // 配置文件不存在或读取失败，继续下一层验证
    }

    return {
      decision: 'confirm',
      source: 'project',
      reason: '项目规则未匹配',
    };
  }

  /**
   * 使用工具级规则验证
   */
  private async verifyWithToolRules(request: PermissionRequest): Promise<PermissionResult> {
    if (!request.toolName) {
      return {
        decision: 'confirm',
        source: 'tool',
        reason: '未指定工具名称',
      };
    }

    const toolRequirement = this.toolRequirements.get(request.toolName);
    if (!toolRequirement) {
      return {
        decision: 'confirm',
        source: 'tool',
        reason: `工具 ${request.toolName} 未注册权限要求`,
      };
    }

    // 检查工具是否支持该操作
    if (!toolRequirement.requiredActions.includes(request.action)) {
      return {
        decision: 'deny',
        source: 'tool',
        reason: `工具 ${request.toolName} 不支持 ${request.action} 操作`,
      };
    }

    // 使用工具的默认决策
    const decision = toolRequirement.defaultDecision || 'confirm';

    return {
      decision,
      source: 'tool',
      reason: `使用工具 ${request.toolName} 的默认策略`,
    };
  }

  /**
   * 获取默认决策
   */
  private getDefaultDecision(request: PermissionRequest): PermissionResult {
    // 危险操作默认需要确认
    const dangerousActions: PermissionAction[] = ['delete', 'execute', 'network'];

    if (dangerousActions.includes(request.action)) {
      return {
        decision: 'confirm',
        source: 'default',
        reason: `危险操作 ${request.action} 需要用户确认`,
      };
    }

    // 读写操作默认允许
    return {
      decision: 'allow',
      source: 'default',
      reason: '默认允许该操作',
    };
  }

  /**
   * 查找匹配的规则（支持 glob 模式）
   */
  private findMatchingRule(
    rules: PermissionRule[],
    action: PermissionAction,
    resourcePath: string
  ): PermissionRule | null {
    // 精确匹配优先
    for (const rule of rules) {
      if (rule.action === action && this.matchPattern(rule.pattern, resourcePath)) {
        return rule;
      }
    }

    return null;
  }

  /**
   * 查找匹配的规则（支持继承）
   */
  private findMatchingRuleWithInheritance(
    rules: PermissionRule[],
    action: PermissionAction,
    resourcePath: string,
    projectRoot: string
  ): PermissionRule | null {
    // 先尝试精确匹配
    const exactMatch = this.findMatchingRule(rules, action, resourcePath);
    if (exactMatch) {
      return exactMatch;
    }

    // 检查父目录的继承规则
    const relativePath = path.relative(projectRoot, resourcePath);
    const pathSegments = relativePath.split(path.sep);

    // 从当前目录向上查找
    for (let i = pathSegments.length - 1; i >= 0; i--) {
      const parentPath = path.join(projectRoot, ...pathSegments.slice(0, i));

      for (const rule of rules) {
        if (rule.action === action &&
            rule.inherit &&
            this.matchPattern(rule.pattern, parentPath)) {
          return rule;
        }
      }
    }

    return null;
  }

  /**
   * 匹配 glob 模式
   */
  private matchPattern(pattern: string, target: string): boolean {
    // 简单的 glob 匹配实现
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(target);
  }

  /**
   * 加载权限配置文件
   */
  private async loadConfig(configPath: string): Promise<PermissionConfig> {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(request: PermissionRequest): string {
    return `${request.action}:${request.resourcePath}:${request.toolName || 'no-tool'}`;
  }

  /**
   * 从缓存获取结果
   */
  private getFromCache(cacheKey: string): PermissionResult | null {
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      return cached.result;
    }

    // 清理过期缓存
    if (cached) {
      this.cache.delete(cacheKey);
    }

    return null;
  }

  /**
   * 缓存结果
   */
  private cacheResult(cacheKey: string, result: PermissionResult): PermissionResult {
    this.cache.set(cacheKey, {
      result,
      expiresAt: new Date(Date.now() + this.cacheTTL * 1000),
    });

    return result;
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { size: number; expired: number } {
    const now = new Date();
    let expired = 0;

    for (const item of this.cache.values()) {
      if (item.expiresAt < now) {
        expired++;
      }
    }

    return {
      size: this.cache.size,
      expired,
    };
  }

  /**
   * 创建默认全局配置文件
   */
  async createDefaultGlobalConfig(): Promise<void> {
    const defaultConfig: PermissionConfig = {
      version: '1.0.0',
      rules: [
        {
          action: 'read',
          pattern: '**/*',
          decision: 'allow',
          inherit: true,
          note: '默认允许读取所有文件',
        },
        {
          action: 'write',
          pattern: '**/*.log',
          decision: 'allow',
          inherit: true,
          note: '允许写入日志文件',
        },
        {
          action: 'delete',
          pattern: '**/*',
          decision: 'confirm',
          inherit: true,
          note: '删除操作需要确认',
        },
        {
          action: 'execute',
          pattern: '**/*',
          decision: 'confirm',
          inherit: true,
          note: '执行命令需要确认',
        },
        {
          action: 'network',
          pattern: '**/*',
          decision: 'confirm',
          inherit: true,
          note: '网络请求需要确认',
        },
      ],
      lastUpdated: new Date().toISOString(),
    };

    const configDir = path.dirname(this.globalConfigPath);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(this.globalConfigPath, JSON.stringify(defaultConfig, null, 2));
  }

  /**
   * 创建默认项目配置文件
   */
  async createDefaultProjectConfig(projectRoot: string): Promise<void> {
    const projectConfigPath = path.join(projectRoot, '.newma', 'permissions.json');
    const defaultConfig: PermissionConfig = {
      version: '1.0.0',
      rules: [
        {
          action: 'write',
          pattern: 'node_modules/**/*',
          decision: 'deny',
          note: '禁止修改 node_modules',
        },
        {
          action: 'write',
          pattern: '.git/**/*',
          decision: 'deny',
          note: '禁止修改 .git 目录',
        },
        {
          action: 'read',
          pattern: '**/*.ts',
          decision: 'allow',
          inherit: true,
          note: '允许读取 TypeScript 文件',
        },
      ],
      lastUpdated: new Date().toISOString(),
    };

    const configDir = path.dirname(projectConfigPath);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(projectConfigPath, JSON.stringify(defaultConfig, null, 2));
  }
}

/**
 * 创建单例实例
 */
export const permissionChain = new PermissionChain();

/**
 * 工具权限要求预设
 */
export const TOOL_PERMISSION_PRESETS: Record<string, ToolPermissionRequirement> = {
  'file-write': {
    toolName: 'file-write',
    requiredActions: ['write'],
    defaultDecision: 'confirm',
    description: '文件写入工具',
  },
  'file-read': {
    toolName: 'file-read',
    requiredActions: ['read'],
    defaultDecision: 'allow',
    description: '文件读取工具',
  },
  'file-delete': {
    toolName: 'file-delete',
    requiredActions: ['delete'],
    defaultDecision: 'confirm',
    description: '文件删除工具',
  },
  'command-execute': {
    toolName: 'command-execute',
    requiredActions: ['execute'],
    defaultDecision: 'confirm',
    description: '命令执行工具',
  },
  'network-request': {
    toolName: 'network-request',
    requiredActions: ['network'],
    defaultDecision: 'confirm',
    description: '网络请求工具',
  },
};
