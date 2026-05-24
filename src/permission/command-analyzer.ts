/**
 * 命令安全分析器
 *
 * 参考 Claude Code 的设计，实现 7 个串行检查器：
 * 1. IncompleteCommandCheck — 不完整命令片段
 * 2. CommandInjectionCheck — shell 注入检测
 * 3. DangerousPatternCheck — 危险模式检测
 * 4. HeredocCheck — 不安全的 heredoc
 * 5. ObfuscatedFlagCheck — 混淆的 flag
 * 6. PathValidationCheck — 路径白名单验证
 * 7. SubcommandSplitCheck — 子命令拆分验证
 */

import * as fs from 'fs';
import * as path from 'path';
import { PermissionContext, PermissionDecision, PermissionSuggestion } from './types';

/** 检查器类型 */
type Checker = (command: string, context: PermissionContext) => PermissionDecision | null;

/** 从命令中提取完全未引用的部分 */
function getFullyUnquoted(command: string): string {
  // 移除单引号和双引号包裹的内容
  return command.replace(/'(?:[^'\\]|\\.)*'/g, '').replace(/"(?:[^"\\]|\\.)*"/g, '');
}

// ─── 1. 不完整命令检测 ───────────────────────────────
const incompleteCommandCheck: Checker = (command, _ctx) => {
  if (/^\s*\t/.test(command)) {
    return { behavior: 'ask', message: '命令以 tab 开头，可能是不完整的命令片段' };
  }
  const trimmed = command.trim();
  if (/^-/.test(trimmed)) {
    return { behavior: 'ask', message: '命令以 flag 开头，可能是不完整的命令片段' };
  }
  if (/^\s*(&&|\|\||;|>>?|<)/.test(command)) {
    return { behavior: 'ask', message: '命令以 operator 开头，可能是不完整的命令片段' };
  }
  return null;
};

// ─── 2. Shell 注入检测 ───────────────────────────────
const commandInjectionCheck: Checker = (command, _ctx) => {
  // IFS 注入
  if (/\$IFS|\$\{IFS\}/.test(command)) {
    return { behavior: 'deny', message: '检测到 IFS 注入攻击' };
  }
  // $() 命令替换
  if (/\$\(/.test(command)) {
    return { behavior: 'ask', message: '检测到 $() 命令替换' };
  }
  // ${} 参数替换
  if (/\$\{/.test(command)) {
    return { behavior: 'ask', message: '检测到 ${} 参数替换' };
  }
  // 进程替换 <() 和 >()
  if (/<\(/.test(command) || />\(/.test(command)) {
    return { behavior: 'ask', message: '检测到进程替换 <() 或 >()' };
  }
  // Zsh 风格
  if (/~\[/.test(command)) {
    return { behavior: 'ask', message: '检测到 Zsh 风格参数扩展 ~[]' };
  }
  if (/\(e:/.test(command)) {
    return { behavior: 'ask', message: '检测到 Zsh 风格 glob qualifiers (e:)' };
  }
  return null;
};

// ─── 3. 危险模式检测 ─────────────────────────────────
const dangerousPatternCheck: Checker = (command, context) => {
  const unquoted = getFullyUnquoted(command);

  // 输入重定向（在未引用部分）
  if (/</.test(unquoted) && !/<\(/.test(unquoted)) {
    const inputMatch = unquoted.match(/<\s*(\S+)/);
    if (inputMatch) {
      const target = inputMatch[1];
      let resolvedTarget: string;
      try { resolvedTarget = path.resolve(context.cwd, target); } catch { resolvedTarget = target; }
      const inWhitelist = context.workingDirectories.length === 0 ||
        context.workingDirectories.some(dir => resolvedTarget.startsWith(dir));
      if (!inWhitelist) {
        return { behavior: 'ask', message: `输入重定向到白名单外路径: ${target}` };
      }
    }
  }
  // 输出重定向
  if (/>/.test(unquoted) && !/>\(/.test(unquoted) && !/>>/.test(unquoted)) {
    const redirectMatch = unquoted.match(/>\s*(\S+)/);
    if (redirectMatch) {
      const target = redirectMatch[1];
      let resolvedTarget: string;
      try { resolvedTarget = path.resolve(context.cwd, target); } catch { resolvedTarget = target; }
      const inWhitelist = context.workingDirectories.length === 0 ||
        context.workingDirectories.some(dir => resolvedTarget.startsWith(dir));
      if (!inWhitelist) {
        return { behavior: 'ask', message: `输出重定向到白名单外路径: ${target}` };
      }
    }
  }
  // 管道中的分隔符（未引用）
  if (/\|/.test(unquoted)) {
    // 检查管道后的命令是否被引号包裹
    const pipeParts = command.split(/\|/);
    for (const part of pipeParts.slice(1)) {
      const trimmed = part.trim();
      if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
          (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
        continue;
      }
      // 检查分隔符
      if (/[,;]/.test(getFullyUnquoted(trimmed))) {
        return { behavior: 'ask', message: '管道命令中包含未引用的分隔符' };
      }
    }
  }
  return null;
};

// ─── 4. Heredoc 检测 ──────────────────────────────────
const heredocCheck: Checker = (command, _ctx) => {
  // 检测 $(... << ... 模式 — 在命令替换中使用 heredoc
  if (/\$\(.*<</.test(command)) {
    return { behavior: 'ask', message: '检测到命令替换中的 heredoc，可能不安全' };
  }
  return null;
};

// ─── 5. 混淆 flag 检测 ───────────────────────────────
const obfuscatedFlagCheck: Checker = (command, _ctx) => {
  // 检测引号包裹的 flag 名，如 -'r'f 或 --"remove"
  if (/-['"][a-zA-Z]/.test(command) || /--['"][a-zA-Z]/.test(command)) {
    return { behavior: 'ask', message: '检测到引号包裹的 flag 名，可能用于混淆' };
  }
  return null;
};

// ─── 6. 路径白名单验证 ────────────────────────────────

/** 路径相关命令列表 */
const PATH_COMMANDS = [
  'cd', 'ls', 'find', 'mkdir', 'touch', 'rm', 'rmdir', 'mv', 'cp',
  'cat', 'head', 'tail', 'sort', 'uniq', 'wc', 'cut', 'paste', 'column',
  'file', 'stat', 'diff', 'awk', 'strings', 'hexdump', 'od', 'base64',
  'nl', 'grep', 'rg', 'sed', 'git',
];

/** 从命令中提取路径参数 */
function extractPaths(command: string): string[] {
  const parts = command.split(/\s+/);
  const paths: string[] = [];
  const baseCmd = parts[0];

  if (!PATH_COMMANDS.includes(baseCmd)) return paths;

  // 简单提取：跳过命令名和 flag，取剩余部分作为路径候选
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith('-')) continue; // skip flags
    if (part.startsWith('--') && part.includes('=')) continue; // skip --flag=value
    if (part) paths.push(part);
  }
  return paths;
}

const pathValidationCheck: Checker = (command, context) => {
  const paths = extractPaths(command);
  if (paths.length === 0) return null;
  if (context.workingDirectories.length === 0) return null; // 无白名单限制

  const suggestions: PermissionSuggestion[] = [];

  for (const p of paths) {
    let resolved: string;
    try {
      resolved = path.resolve(context.cwd, p);
      if (fs.existsSync(resolved)) {
        resolved = fs.realpathSync(resolved);
      }
    } catch {
      resolved = path.resolve(context.cwd, p);
    }

    const inWhitelist = context.workingDirectories.some(dir => {
      try {
        const resolvedDir = fs.existsSync(dir) ? fs.realpathSync(dir) : dir;
        return resolved.startsWith(resolvedDir);
      } catch {
        return resolved.startsWith(dir);
      }
    });

    if (!inWhitelist) {
      suggestions.push({
        type: 'addDirectories',
        directories: [path.dirname(resolved)],
        destination: 'localSettings',
      });
      return {
        behavior: 'ask',
        message: `路径 "${p}" 不在允许的工作目录白名单中`,
        suggestions,
      };
    }
  }
  return null;
};

// ─── 7. 子命令拆分验证 ────────────────────────────────

/** 所有检查器的列表（不含 SubcommandSplitCheck 自身） */
const innerCheckers: Checker[] = [
  incompleteCommandCheck,
  commandInjectionCheck,
  dangerousPatternCheck,
  heredocCheck,
  obfuscatedFlagCheck,
  pathValidationCheck,
];

const subcommandSplitCheck: Checker = (command, context) => {
  // 拆分 && || ; 但不在引号内拆分
  const subcommands = command
    .replace(/'(?:[^'\\]|\\.)*'/g, '""')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .split(/(&&|\|\||;)/)
    .map(s => s.trim())
    .filter(s => s && s !== '&&' && s !== '||' && s !== ';');

  if (subcommands.length <= 1) return null;

  for (const sub of subcommands) {
    for (const checker of innerCheckers) {
      const result = checker(sub, context);
      if (result && result.behavior !== 'allow') {
        return {
          ...result,
          message: `子命令 "${sub.substring(0, 50)}" 触发安全检查: ${result.message}`,
        };
      }
    }
  }
  return null;
};

// ─── 导出：运行所有检查器 ─────────────────────────────
/** 运行命令安全分析器的所有检查器，返回第一个非 null 的决策 */
export function analyzeCommand(command: string, context: PermissionContext): PermissionDecision | null {
  // subcommandSplitCheck handles multi-command strings by checking each subcommand
  // For single commands, it returns null, so we still need direct checkers
  const directCheckers: Checker[] = [
    incompleteCommandCheck,
    commandInjectionCheck,
    dangerousPatternCheck,
    heredocCheck,
    obfuscatedFlagCheck,
    pathValidationCheck,
  ];

  for (const checker of directCheckers) {
    const result = checker(command, context);
    if (result) return result;
  }

  // For multi-command strings, also check each subcommand individually
  return subcommandSplitCheck(command, context);
}

// 导出供测试使用
export const checkers = {
  incompleteCommandCheck,
  commandInjectionCheck,
  dangerousPatternCheck,
  heredocCheck,
  obfuscatedFlagCheck,
  pathValidationCheck,
  subcommandSplitCheck,
};
