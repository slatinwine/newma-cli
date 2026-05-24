/**
 * 权限规则引擎
 *
 * 负责匹配和评估权限规则：
 * - 规则优先级：deny > ask > allow
 * - 匹配模式：exact（完全匹配）和 prefix（xxx:* 前缀匹配）
 * - 作用域合并：global + local + session，高优先级覆盖低优先级
 */

import { PermissionContext, PermissionDecision, PermissionRule } from './types';

/** 检查工具名是否匹配规则（支持 '*' 通配符） */
function toolNameMatches(ruleToolName: string, contextToolName: string): boolean {
  if (ruleToolName === '*') return true;
  return ruleToolName === contextToolName;
}

/** 检查规则内容是否匹配 action（支持 exact 和 prefix 匹配） */
export function ruleContentMatches(ruleContent: string | undefined, action: string): boolean {
  if (!ruleContent) return true; // 无内容限制则匹配所有 action
  if (ruleContent.endsWith(':*')) {
    // 前缀匹配：git:* 匹配 git status, git commit 等
    const prefix = ruleContent.slice(0, -2); // "git:*" → "git"
    const actionPrefix = action.split(/\s+/)[0]; // 取命令第一部分
    return actionPrefix === prefix || actionPrefix.startsWith(prefix + ' ');
  }
  return ruleContent === action;
}

/** 合并所有作用域的规则，按优先级排序（deny > ask > allow，session > local > global） */
function mergeAndSortRules(context: PermissionContext): PermissionRule[] {
  const scopePriority = { session: 3, local: 2, global: 1 };
  const behaviorPriority = { deny: 3, ask: 2, allow: 1 };

  return [...context.globalRules, ...context.localRules, ...context.sessionRules].sort(
    (a, b) => {
      const bp = behaviorPriority[b.behavior] - behaviorPriority[a.behavior];
      if (bp !== 0) return bp;
      return scopePriority[b.scope] - scopePriority[a.scope];
    }
  );
}

/** 检查规则引擎，返回决策或 null（无匹配规则时） */
export function checkRules(context: PermissionContext): PermissionDecision | null {
  const rules = mergeAndSortRules(context);

  for (const rule of rules) {
    if (toolNameMatches(rule.toolName, context.toolName) &&
        ruleContentMatches(rule.ruleContent, context.action)) {
      return {
        behavior: rule.behavior,
        message: rule.behavior === 'deny'
          ? `被规则拒绝: ${rule.id}`
          : rule.behavior === 'allow'
            ? `规则允许: ${rule.id}`
            : undefined,
        decisionReason: { type: 'rule', rule },
      };
    }
  }

  return null;
}
