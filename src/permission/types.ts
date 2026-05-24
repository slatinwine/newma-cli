/**
 * 权限类型定义模块
 *
 * 定义分层权限验证链所需的所有类型，包括：
 * - 权限决策行为（allow/deny/ask）
 * - 权限规则（支持通配符和前缀匹配）
 * - 权限上下文（传递给验证链的完整上下文）
 * - 权限建议（审批时的快捷选项）
 */

/** 权限决策行为 */
export type PermissionBehavior = 'allow' | 'deny' | 'ask';

/** 权限决策结果 */
export interface PermissionDecision {
  behavior: PermissionBehavior;
  message?: string;
  decisionReason?: {
    type: 'rule' | 'mode' | 'other';
    rule?: PermissionRule;
    reason?: string;
  };
  suggestions?: PermissionSuggestion[];
}

/** 权限规则 */
export interface PermissionRule {
  id: string;
  /** 工具名，支持 '*' 通配符 */
  toolName: string;
  /** 命令/路径模式，支持 exact 和 prefix (xxx:*) */
  ruleContent?: string;
  behavior: PermissionBehavior;
  scope: 'session' | 'local' | 'global';
  createdAt: number;
}

/** 权限建议（审批时给用户的快捷选项） */
export interface PermissionSuggestion {
  type: 'addRules' | 'addDirectories' | 'setMode';
  rules?: Partial<PermissionRule>[];
  directories?: string[];
  mode?: string;
  destination: 'localSettings';
}

/** 权限上下文（传递给验证链） */
export interface PermissionContext {
  toolName: string;
  /** 如 "rm -rf /tmp/test" */
  action: string;
  cwd: string;
  mode: 'normal' | 'acceptEdits' | 'bypassPermissions';
  sessionRules: PermissionRule[];
  localRules: PermissionRule[];
  globalRules: PermissionRule[];
  /** 允许的工作目录白名单 */
  workingDirectories: string[];
}
