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
    // 修改文件
    lines.push('📝 修改文件');
    lines.push('');
    
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    // 简单的行对比
    const maxLines = Math.max(oldLines.length, newLines.length);
    const changedLines: { old: string | null; new: string | null; lineNum: number }[] = [];
    
    for (let i = 0; i < maxLines; i++) {
      const oldLine = i < oldLines.length ? oldLines[i] : null;
      const newLine = i < newLines.length ? newLines[i] : null;
      
      if (oldLine !== newLine) {
        changedLines.push({ old: oldLine, new: newLine, lineNum: i + 1 });
      }
    }
    
    // 只显示变更的行（最多显示 30 行变更）
    const displayChanges = changedLines.slice(0, 30);
    
    displayChanges.forEach(({ old, new: newL, lineNum }) => {
      if (old !== null && newL !== null) {
        lines.push(`~ ${lineNum}: "${old}" → "${newL}"`);
      } else if (old !== null) {
        lines.push(`- ${lineNum}: "${old}"`);
      } else {
        lines.push(`+ ${lineNum}: "${newL}"`);
      }
    });
    
    if (changedLines.length > 30) {
      lines.push(`... (${changedLines.length - 30} more changes)`);
    }
    
    lines.push('');
    lines.push(`📊 统计: ${changedLines.length} 行变更 (原 ${oldLines.length} 行 → 新 ${newLines.length} 行)`);
  }
  
  lines.push('─'.repeat(60));
  
  return lines.join('\n');
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
        await rollback.createRestorePoint(change.type, change.path);
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
