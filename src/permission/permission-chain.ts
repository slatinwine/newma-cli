/**
 * 分层权限验证链 — 主入口
 *
 * 串联所有验证层：
 * 1. bypassPermissions 模式 → 直接放行
 * 2. 规则引擎检查（deny > ask > allow）
 * 3. 命令安全分析器（7 个检查器）
 * 4. 默认 ask（安全优先）
 */

import { PermissionContext, PermissionDecision } from './types';
import { checkRules } from './rule-engine';
import { analyzeCommand } from './command-analyzer';

/** 运行完整的权限验证链 */
export function checkPermission(context: PermissionContext): PermissionDecision {
  // 1. bypassPermissions 模式直接放行
  if (context.mode === 'bypassPermissions') {
    return {
      behavior: 'allow',
      decisionReason: { type: 'mode', reason: 'bypassPermissions 模式' },
    };
  }

  // 2. 规则引擎检查
  const ruleResult = checkRules(context);
  if (ruleResult) return ruleResult;

  // 3. 命令安全分析器（仅对 command 类工具）
  if (context.toolName === 'shell' || context.toolName === 'exec' || context.toolName === 'run') {
    const analysisResult = analyzeCommand(context.action, context);
    if (analysisResult) return analysisResult;
  }

  // 4. 默认 ask（安全优先）
  return {
    behavior: 'ask',
    message: `未找到匹配规则，需要确认: ${context.toolName} - ${context.action.substring(0, 80)}`,
    decisionReason: { type: 'other', reason: '无匹配规则，默认需要确认' },
  };
}
