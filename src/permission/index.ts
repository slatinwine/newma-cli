/**
 * 权限验证模块
 *
 * 提供分层权限验证链，包括：
 * - 类型定义（types.ts）
 * - 规则引擎（rule-engine.ts）
 * - 命令安全分析器（command-analyzer.ts）
 * - 验证链主入口（permission-chain.ts）
 */

export type {
  PermissionBehavior,
  PermissionDecision,
  PermissionRule,
  PermissionSuggestion,
  PermissionContext,
} from './types';

export { checkPermission } from './permission-chain';
export { checkRules } from './rule-engine';
export { analyzeCommand, checkers } from './command-analyzer';
