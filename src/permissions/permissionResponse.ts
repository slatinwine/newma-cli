// src/permissions/permissionResponse.ts
/**
 * 权限分级响应系统
 * 参考 Claude Code 的 allowOnce/allowAlways/allowSession/deny 四级权限模型
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type PermissionAction = 'allow_once' | 'allow_always' | 'allow_session' | 'deny';

export interface PermissionResponse {
  action: PermissionAction;
  tool?: string;
  pattern?: string;
  reason?: string;
}

export interface PermissionRule {
  tool: string;
  pattern?: string; // glob pattern，如 "src/**/*.ts"
  action: PermissionAction;
}

interface StoredPermission {
  rules: PermissionRule[];
  sessionRules: PermissionRule[]; // 仅当前会话有效
}

function getPermissionsFilePath(): string {
  return path.join(os.homedir(), '.newma', 'permissions.json');
}

export class PermissionManager {
  private stored: StoredPermission = { rules: [], sessionRules: [] };
  private permissionsFile: string;

  constructor(customPath?: string) {
    this.permissionsFile = customPath || getPermissionsFilePath();
    this.load();
  }

  /**
   * 检查工具调用是否已被预先授权
   */
  check(tool: string, input: Record<string, unknown>): PermissionResponse | null {
    // 优先检查 always 规则
    for (const rule of this.stored.rules) {
      if (rule.action === 'allow_always' && this.matchesRule(rule, tool, input)) {
        return { action: 'allow_always', tool: rule.tool, pattern: rule.pattern };
      }
    }

    // 然后检查 session 规则
    for (const rule of this.stored.sessionRules) {
      if (rule.action === 'allow_session' && this.matchesRule(rule, tool, input)) {
        return { action: 'allow_session', tool: rule.tool, pattern: rule.pattern };
      }
    }

    return null; // 需要询问用户
  }

  /**
   * 记录用户的权限决定
   */
  record(response: PermissionResponse): void {
    if (response.action === 'allow_always' || response.action === 'deny') {
      this.stored.rules.push({
        tool: response.tool || '',
        pattern: response.pattern,
        action: response.action,
      });
      this.save();
    } else if (response.action === 'allow_session') {
      this.stored.sessionRules.push({
        tool: response.tool || '',
        pattern: response.pattern,
        action: 'allow_session',
      });
    }
  }

  /**
   * 清除会话级规则（新会话开始时调用）
   */
  clearSessionRules(): void {
    this.stored.sessionRules = [];
  }

  /**
   * 列出所有持久化规则
   */
  listRules(): PermissionRule[] {
    return [...this.stored.rules];
  }

  /**
   * 移除规则
   */
  removeRule(index: number): void {
    if (index >= 0 && index < this.stored.rules.length) {
      this.stored.rules.splice(index, 1);
      this.save();
    }
  }

  // ─── 内部方法 ───

  private matchesRule(rule: PermissionRule, tool: string, input: Record<string, unknown>): boolean {
    if (rule.tool !== '*' && rule.tool !== tool) return false;

    if (rule.pattern) {
      // 简单 glob 匹配
      const filePath = String(input.file_path || input.path || input.file || '');
      return this.globMatch(rule.pattern, filePath);
    }

    return true;
  }

  private globMatch(pattern: string, str: string): boolean {
    // Convert glob pattern to regex
    // ** matches any number of directories
    // * matches any characters except path separator
    let regexStr = '^' + pattern
      .replace(/\.\*/g, '###DOUBLESTAR###')  // Temporary placeholder
      .replace(/\*/g, '[^/]*')                // Single * = non-separator chars
      .replace(/###DOUBLESTAR###/g, '.*')     // ** = any chars
      .replace(/\?/g, '.')                     // ? = any single char
      + '$';
    const regex = new RegExp(regexStr);
    return regex.test(str);
  }

  private load(): void {
    try {
      const data = fs.readFileSync(this.permissionsFile, 'utf-8');
      this.stored = JSON.parse(data);
    } catch {
      this.stored = { rules: [], sessionRules: [] };
    }
  }

  private save(): void {
    const dir = path.dirname(this.permissionsFile);
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.permissionsFile, JSON.stringify(this.stored, null, 2), 'utf-8');
    } catch {
      // 保存失败不影响运行
    }
  }
}
