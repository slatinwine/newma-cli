// src/review-mode.ts
/**
 * Review Mode - 审查模式
 * 在 AI 修改文件前显示 diff 并等待用户确认
 * 支持单次批准/拒绝 + 会话免审
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { RollbackManager } from './rollback';

export interface ReviewModeConfig {
  enabled: boolean;           // 是否启用审查模式
  autoBackup: boolean;        // 自动创建 restore point
  showDiff: boolean;          // 显示 diff
  requireConfirm: boolean;    // 需要用户确认
}

export interface FileChange {
  type: 'create' | 'modify' | 'delete';
  path: string;
  oldContent?: string;
  newContent?: string;
}

export type ReviewDecision = 'approve' | 'reject' | 'approve-all' | 'reject-all';

export interface ReviewResult {
  approved: boolean;
  reason?: string;
  sessionBypass?: boolean;  // 是否进入会话免审模式
}

const DEFAULT_CONFIG: ReviewModeConfig = {
  enabled: true,
  autoBackup: true,
  showDiff: true,
  requireConfirm: true,
};

/**
 * 会话级别的免审状态
 */
let sessionBypassEnabled = false;

/**
 * 🎮 批准时自动存档钩子（由 REPL 注入 TimeTravelManager 的存档逻辑）
 * review-mode 保持解耦：不直接依赖记忆系统
 */
export type ReviewAutoSaveHook = (
  change: FileChange,
  gitHash?: string
) => Promise<void>;

let reviewAutoSaveHook: ReviewAutoSaveHook | null = null;

/**
 * 设置/清除批准时自动存档钩子
 */
export function setReviewAutoSaveHook(hook: ReviewAutoSaveHook | null): void {
  reviewAutoSaveHook = hook;
}

/**
 * 触发自动存档（静默失败）
 */
async function triggerAutoSave(change: FileChange, gitHash?: string): Promise<void> {
  if (!reviewAutoSaveHook) return;
  try {
    await reviewAutoSaveHook(change, gitHash);
  } catch {
    // 自动存档失败不影响审查流程
  }
}

/**
 * 设置会话免审状态
 */
export function setSessionBypass(enabled: boolean): void {
  sessionBypassEnabled = enabled;
  if (enabled) {
    console.log('🔓 会话免审已开启：后续所有变更将自动批准');
  } else {
    console.log('🔒 会话免审已关闭：恢复逐项审查');
  }
}

/**
 * 获取会话免审状态
 */
export function isSessionBypassEnabled(): boolean {
  return sessionBypassEnabled;
}

/**
 * 生成简单的 diff 输出
 */
export function generateDiff(
  filePath: string,
  oldContent: string | undefined,
  newContent: string | undefined
): string {
  const lines: string[] = [];
  
  lines.push(`\n📄 ${filePath}`);
  lines.push('─'.repeat(60));
  
  if (oldContent === undefined) {
    // 新文件
    lines.push('✨ 新文件');
    if (newContent) {
      lines.push('');
      const newLines = newContent.split('\n').slice(0, 20);
      newLines.forEach((line, i) => {
        lines.push(`+ ${line}`);
      });
      if (newContent.split('\n').length > 20) {
        lines.push(`... (${newContent.split('\n').length - 20} more lines)`);
      }
    }
  } else if (newContent === undefined) {
    // 删除文件
    lines.push('❌ 删除文件');
    lines.push('');
    const oldLines = oldContent.split('\n').slice(0, 10);
    oldLines.forEach((line) => {
      lines.push(`- ${line}`);
    });
    if (oldContent.split('\n').length > 10) {
      lines.push(`... (${oldContent.split('\n').length - 10} more lines)`);
    }
  } else {
    // 修改文件：LCS 行级 diff
    lines.push('📝 修改文件');
    lines.push('');

    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    // 超大文件退化为前后采样（LCS 矩阵 O(n·m) 会爆内存）
    if (oldLines.length * newLines.length > 4_000_000) {
      lines.push(`⚠️  文件过大（${oldLines.length} → ${newLines.length} 行），显示首部采样：`);
      lines.push('--- old (first 10) ---');
      oldLines.slice(0, 10).forEach((l) => lines.push(`- ${l}`));
      lines.push('--- new (first 10) ---');
      newLines.slice(0, 10).forEach((l) => lines.push(`+ ${l}`));
      lines.push('─'.repeat(60));
      return lines.join('\n');
    }

    // 公共前后缀先剪掉（多数编辑是局部的，能把 LCS 矩阵大幅缩小）
    let prefix = 0;
    while (
      prefix < oldLines.length &&
      prefix < newLines.length &&
      oldLines[prefix] === newLines[prefix]
    ) {
      prefix++;
    }
    let suffix = 0;
    while (
      suffix < oldLines.length - prefix &&
      suffix < newLines.length - prefix &&
      oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
    ) {
      suffix++;
    }

    const midOld = oldLines.slice(prefix, oldLines.length - suffix);
    const midNew = newLines.slice(prefix, newLines.length - suffix);

    let removed = 0;
    let added = 0;

    if (midOld.length === 0 || midNew.length === 0) {
      // 纯增或纯删
      midOld.forEach((l) => { lines.push(`- ${l}`); removed++; });
      midNew.forEach((l) => { lines.push(`+ ${l}`); added++; });
    } else {
      // LCS 对齐（替换原先"按行号一一对比"——旧实现在文件头部插入一行
      // 会导致后续所有行都被判为变更）
      const lcs = lcsLengthMatrix(midOld, midNew);
      let i = 0;
      let j = 0;
      let shown = 0;
      const MAX_DIFF_LINES = 200;

      while (i < midOld.length && j < midNew.length && shown < MAX_DIFF_LINES) {
        if (midOld[i] === midNew[j]) {
          i++;
          j++;
        } else if (
          j < midNew.length &&
          (i >= midOld.length || lcs[i + 1][j] <= lcs[i][j + 1])
        ) {
          lines.push(`+ ${midNew[j]}`); added++; j++; shown++;
        } else {
          lines.push(`- ${midOld[i]}`); removed++; i++; shown++;
        }
      }
      while (i < midOld.length && shown < MAX_DIFF_LINES) {
        lines.push(`- ${midOld[i]}`); removed++; i++; shown++;
      }
      while (j < midNew.length && shown < MAX_DIFF_LINES) {
        lines.push(`+ ${midNew[j]}`); added++; j++; shown++;
      }
      if (i < midOld.length || j < midNew.length) {
        lines.push(`... (${midOld.length - i + midNew.length - j} more changed lines)`);
      }
    }

    if (prefix > 0) lines.push(`  (${prefix} unchanged leading lines)`);
    if (suffix > 0) lines.push(`  (${suffix} unchanged trailing lines)`);
    lines.push('');
    lines.push(`📊 统计: +${added} / -${removed} (原 ${oldLines.length} 行 → 新 ${newLines.length} 行)`);
  }

  lines.push('─'.repeat(60));

  return lines.join('\n');
}

/**
 * LCS 长度矩阵（dp[i][j] = a[i:] 与 b[j:] 的最长公共子序列长度）
 */
function lcsLengthMatrix(a: string[], b: string[]): number[][] {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  return dp;
}

/**
 * 创建 readline 接口用于用户交互
 */
function createReadlineInterface(): readline.ReadLine {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * 询问用户审查决定（支持多选项）
 */
export async function askReviewDecision(
  message: string = '选择操作'
): Promise<ReviewDecision> {
  const rl = createReadlineInterface();
  
  return new Promise((resolve) => {
    console.log('\n选择操作:');
    console.log('  [y] 允许本次');
    console.log('  [n] 拒绝本次');
    console.log('  [a] 全部允许（会话免审）');
    console.log('  [q] 全部拒绝');
    
    rl.question(`${message} [y/n/a/q]: `, (answer) => {
      rl.close();
      
      const trimmed = answer.trim().toLowerCase();
      
      switch (trimmed) {
        case 'y':
        case 'yes':
          resolve('approve');
          break;
        case 'n':
        case 'no':
          resolve('reject');
          break;
        case 'a':
        case 'all':
          resolve('approve-all');
          break;
        case 'q':
        case 'quit':
          resolve('reject-all');
          break;
        case '':
          resolve('reject');  // 默认拒绝
          break;
        default:
          resolve('reject');
      }
    });
  });
}

/**
 * 询问用户确认（简单版，用于其他场景）
 */
export async function askConfirmation(
  message: string,
  defaultYes: boolean = false
): Promise<boolean> {
  const rl = createReadlineInterface();
  
  return new Promise((resolve) => {
    const hint = defaultYes ? '[Y/n]' : '[y/N]';
    rl.question(`${message} ${hint}: `, (answer) => {
      rl.close();
      
      const trimmed = answer.trim().toLowerCase();
      
      if (trimmed === '') {
        resolve(defaultYes);
      } else if (trimmed === 'y' || trimmed === 'yes') {
        resolve(true);
      } else if (trimmed === 'n' || trimmed === 'no') {
        resolve(false);
      } else {
        resolve(defaultYes);
      }
    });
  });
}

/**
 * 审查文件变更
 */
export async function reviewFileChange(
  change: FileChange,
  config: Partial<ReviewModeConfig> = {},
  projectRoot: string
): Promise<ReviewResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // 如果审查模式未启用，直接批准
  if (!finalConfig.enabled) {
    return { approved: true };
  }
  
  // 如果会话免审已开启，直接批准
  if (sessionBypassEnabled) {
    console.log(`\n📄 ${change.path} - ✅ 自动批准（会话免审）`);

    // 仍然创建备份（如果配置了）
    if (finalConfig.autoBackup && projectRoot) {
      try {
        const rollback = new RollbackManager(projectRoot);
        const hash = await rollback.createRestorePoint(change.type, change.path);
        await triggerAutoSave(change, hash ?? undefined);
      } catch (error) {
        // 静默失败
      }
    }

    return { approved: true, sessionBypass: true };
  }
  
  // 生成并显示 diff
  if (finalConfig.showDiff) {
    const diff = generateDiff(change.path, change.oldContent, change.newContent);
    console.log(diff);
  }
  
  // 如果不需要确认，直接批准
  if (!finalConfig.requireConfirm) {
    console.log('✅ 自动批准（无需确认）');
    return { approved: true };
  }
  
  // 询问用户决定
  const decision = await askReviewDecision('应用这些变更？');
  
  switch (decision) {
    case 'approve':
      console.log('✅ 已批准');

      // 创建备份
      if (finalConfig.autoBackup && projectRoot) {
        try {
          const rollback = new RollbackManager(projectRoot);
          const hash = await rollback.createRestorePoint(change.type, change.path);
          if (hash) {
            console.log(`📦 已创建还原点: ${hash.substring(0, 7)}`);
          }
          await triggerAutoSave(change, hash ?? undefined);
        } catch (error) {
          console.warn('⚠️  创建还原点失败:', (error as Error).message);
        }
      }

      return { approved: true };

    case 'approve-all':
      setSessionBypass(true);
      console.log('✅ 已批准');

      // 创建备份
      if (finalConfig.autoBackup && projectRoot) {
        try {
          const rollback = new RollbackManager(projectRoot);
          const hash = await rollback.createRestorePoint(change.type, change.path);
          if (hash) {
            console.log(`📦 已创建还原点: ${hash.substring(0, 7)}`);
          }
          await triggerAutoSave(change, hash ?? undefined);
        } catch (error) {
          console.warn('⚠️  创建还原点失败:', (error as Error).message);
        }
      }

      return { approved: true, sessionBypass: true };
      
    case 'reject-all':
      console.log('❌ 已拒绝（后续也将拒绝）');
      setSessionBypass(false);
      return { approved: false, reason: 'User rejected and disabled further changes' };
      
    case 'reject':
    default:
      console.log('❌ 已拒绝');
      return { approved: false, reason: 'User rejected the changes' };
  }
}

/**
 * 批量审查多个文件变更
 */
export async function reviewMultipleChanges(
  changes: FileChange[],
  config: Partial<ReviewModeConfig> = {},
  projectRoot: string
): Promise<Map<string, ReviewResult>> {
  const results = new Map<string, ReviewResult>();
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  console.log(`\n📋 审查模式: ${changes.length} 个文件待审查\n`);
  
  for (const change of changes) {
    const result = await reviewFileChange(change, config, projectRoot);
    results.set(change.path, result);
    
    // 如果是全部拒绝，直接退出
    if (result.reason?.includes('disabled further changes')) {
      break;
    }
    
    // 如果已进入会话免审模式，继续处理但不再询问
    if (result.sessionBypass) {
      // 继续处理剩余文件
      continue;
    }
    
    if (!result.approved) {
      // 如果有一个被拒绝，询问是否继续审查其余的
      const continueReview = await askConfirmation('继续审查其他文件？', true);
      if (!continueReview) {
        break;
      }
    }
  }
  
  return results;
}

/**
 * 从配置文件获取审查模式设置
 */
export function getReviewModeConfig(settings: any): ReviewModeConfig {
  return {
    enabled: settings?.reviewMode?.enabled ?? true,
    autoBackup: settings?.reviewMode?.autoBackup ?? true,
    showDiff: settings?.reviewMode?.showDiff ?? true,
    requireConfirm: settings?.reviewMode?.requireConfirm ?? true,
  };
}

/**
 * 显示审查统计
 */
export function displayReviewStats(results: Map<string, ReviewResult>): void {
  const approved = Array.from(results.values()).filter(r => r.approved).length;
  const rejected = results.size - approved;
  const sessionBypass = Array.from(results.values()).filter(r => r.sessionBypass).length > 0;
  
  console.log('\n📊 审查统计:');
  console.log(`   ✅ 已批准: ${approved}`);
  console.log(`   ❌ 已拒绝: ${rejected}`);
  if (sessionBypass) {
    console.log(`   🔓 会话免审: 已开启`);
  }
}

/**
 * 重置会话状态（用于新会话）
 */
export function resetSessionState(): void {
  sessionBypassEnabled = false;
}
