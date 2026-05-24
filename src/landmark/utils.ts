/**
 * Landmark Utilities - 工具函数
 *
 * 提供路标验证、循环依赖检测、路标合并等实用功能。
 */

import chalk from 'chalk';
import { Landmark, LandmarkType } from './types';

/**
 * 验证路标列表的完整性
 */
export function validateLandmarks(landmarks: Landmark[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 检查1：所有路标必须有唯一ID
  const ids = new Set<string>();
  const duplicateIds: string[] = [];
  for (const lm of landmarks) {
    if (ids.has(lm.id)) {
      duplicateIds.push(lm.id);
    }
    ids.add(lm.id);
  }

  if (duplicateIds.length > 0) {
    errors.push(`Duplicate landmark IDs: ${duplicateIds.join(', ')}`);
  }

  // 检查2：依赖的路标必须存在
  for (const lm of landmarks) {
    for (const depId of lm.dependsOn) {
      if (!ids.has(depId)) {
        errors.push(`Landmark ${lm.id} depends on non-existent landmark ${depId}`);
      }
    }
  }

  // 检查3：描述不能为空
  for (const lm of landmarks) {
    if (!lm.description || lm.description.trim().length === 0) {
      errors.push(`Landmark ${lm.id} has empty description`);
    }
  }

  // 检查4：必须有至少一个动作
  for (const lm of landmarks) {
    if (!lm.actions || lm.actions.length === 0) {
      errors.push(`Landmark ${lm.id} has no actions`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 检测循环依赖
 *
 * 使用DFS检测图中是否存在环
 */
export function detectCircularDependencies(landmarks: Landmark[]): string[] | null {
  const landmarkMap = new Map(landmarks.map(lm => [lm.id, lm]));
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[] = [];

  function dfs(nodeId: string, path: string[]): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const landmark = landmarkMap.get(nodeId);
    if (!landmark) return false;

    for (const depId of landmark.dependsOn) {
      if (!visited.has(depId)) {
        if (dfs(depId, [...path])) {
          return true;
        }
      } else if (recursionStack.has(depId)) {
        // 找到环
        const cycleStart = path.indexOf(depId);
        const cycle = path.slice(cycleStart).concat(depId);
        cycles.push(cycle.join(' → '));
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const lm of landmarks) {
    if (!visited.has(lm.id)) {
      if (dfs(lm.id, [])) {
        break;
      }
    }
  }

  return cycles.length > 0 ? cycles : null;
}

/**
 * 合并小的路标
 *
 * 将预估步骤少于threshold的路标合并到前一个路标中
 */
export function mergeSmallLandmarks(
  landmarks: Landmark[],
  threshold: number = 2
): Landmark[] {
  if (landmarks.length <= 1) return landmarks;

  const merged: Landmark[] = [];
  let currentLandmark = { ...landmarks[0] };

  for (let i = 1; i < landmarks.length; i++) {
    const nextLandmark = landmarks[i];

    // 如果当前路标很小（步骤数 < threshold），合并到前一个
    if (nextLandmark.estimatedSteps < threshold) {
      // 合并动作
      currentLandmark.actions = [...currentLandmark.actions, ...nextLandmark.actions];
      currentLandmark.estimatedSteps = currentLandmark.actions.length;

      // 更新描述
      currentLandmark.description = `${currentLandmark.description} + ${nextLandmark.description}`;

      // 更新依赖（合并所有依赖）
      const allDeps = new Set([
        ...currentLandmark.dependsOn,
        ...nextLandmark.dependsOn.filter(d => d !== nextLandmark.id),
      ]);
      currentLandmark.dependsOn = Array.from(allDeps);

      // 更新优先级（取更高的）
      if (nextLandmark.priority === 'high' && currentLandmark.priority !== 'high') {
        currentLandmark.priority = 'high';
      }
    } else {
      // 当前路标足够大，保存并开始新的路标
      merged.push(currentLandmark);
      currentLandmark = { ...nextLandmark };
    }
  }

  // 添加最后一个路标
  merged.push(currentLandmark);

  return merged;
}

/**
 * 估算路标计划的复杂度
 */
export function estimateComplexity(landmarks: Landmark[]): 'simple' | 'medium' | 'complex' {
  if (landmarks.length === 0) return 'simple';

  const totalSteps = landmarks.reduce((sum, lm) => sum + lm.estimatedSteps, 0);
  const maxDependencies = Math.max(...landmarks.map(lm => lm.dependsOn.length));

  // 简单：少于5个路标，总步骤少于10，最大依赖少于2
  if (landmarks.length < 5 && totalSteps < 10 && maxDependencies < 2) {
    return 'simple';
  }

  // 复杂：超过8个路标，总步骤超过20，或有超过3个依赖
  if (landmarks.length > 8 || totalSteps > 20 || maxDependencies > 3) {
    return 'complex';
  }

  // 中等：介于简单和复杂之间
  return 'medium';
}

/**
 * 生成路标执行的推理说明
 */
export function generateReasoning(
  landmarks: Landmark[],
  executionOrder: string[]
): string {
  const parts: string[] = [];

  parts.push(`识别了 ${landmarks.length} 个关键里程碑：`);

  // 列出所有路标
  executionOrder.forEach((lmId, idx) => {
    const lm = landmarks.find(l => l.id === lmId);
    if (lm) {
      const depInfo = lm.dependsOn.length > 0
        ? ` (依赖: ${lm.dependsOn.join(', ')})`
        : '';
      parts.push(`  ${idx + 1}. ${lm.description}${depInfo}`);
    }
  });

  // 总步骤估算
  const totalSteps = landmarks.reduce((sum, lm) => sum + lm.estimatedSteps, 0);
  parts.push(`\n预计需要 ${totalSteps} 个步骤完成所有里程碑。`);

  // 复杂度评估
  const complexity = estimateComplexity(landmarks);
  parts.push(`\n任务复杂度: ${complexity === 'simple' ? '简单' : complexity === 'medium' ? '中等' : '复杂'}`);

  return parts.join('\n');
}

/**
 * 格式化路标显示（用于REPL输出）
 */
export function formatLandmarks(
  landmarks: Landmark[],
  executionOrder: string[]
): string {
  const lines: string[] = [];

  lines.push(chalk.cyan('\n📍 Identified Landmarks:'));
  lines.push(chalk.cyan('═'.repeat(50)));

  executionOrder.forEach((lmId, idx) => {
    const lm = landmarks.find(l => l.id === lmId);
    if (!lm) return;

    const priorityColor =
      lm.priority === 'high' ? chalk.red :
      lm.priority === 'medium' ? chalk.yellow :
      chalk.green;

    const typeIcon =
      lm.type === LandmarkType.FILE_CREATION ? '📄' :
      lm.type === LandmarkType.FILE_MODIFICATION ? '✏️ ' :
      lm.type === LandmarkType.COMMAND_EXECUTION ? '⚙️ ' :
      lm.type === LandmarkType.TEST ? '🧪' :
      lm.type === LandmarkType.VERIFICATION ? '✅' :
      lm.type === LandmarkType.DEPENDENCY_INSTALL ? '📦' : '📝';

    lines.push(
      chalk.gray(`\n  ${idx + 1}. ${typeIcon} ${lm.description}`)
    );
    lines.push(chalk.gray(`     ID: ${lm.id}`));
    lines.push(chalk.gray(`     Priority: ${priorityColor(lm.priority)}`));
    lines.push(chalk.gray(`     Steps: ${lm.estimatedSteps}`));

    if (lm.dependsOn.length > 0) {
      lines.push(chalk.gray(`     Depends on: ${lm.dependsOn.join(', ')}`));
    }

    if (lm.actions.length > 0) {
      lines.push(chalk.gray(`     Actions: ${lm.actions.length}`));
    }
  });

  const totalSteps = landmarks.reduce((sum, lm) => sum + lm.estimatedSteps, 0);
  lines.push(chalk.cyan('\n' + '═'.repeat(50)));
  lines.push(chalk.gray(`Total landmarks: ${landmarks.length}`));
  lines.push(chalk.gray(`Estimated steps: ${totalSteps}`));
  lines.push(chalk.cyan('═'.repeat(50)) + '\n');

  return lines.join('\n');
}

/**
 * 计算路标的入度（用于拓扑排序）
 */
export function calculateInDegree(landmarks: Landmark[]): Map<string, number> {
  const inDegree = new Map<string, number>();

  // 初始化所有路标的入度为0
  for (const lm of landmarks) {
    inDegree.set(lm.id, 0);
  }

  // 计算每个路标的入度
  for (const lm of landmarks) {
    for (const depId of lm.dependsOn) {
      const current = inDegree.get(depId) || 0;
      inDegree.set(depId, current + 1);
    }
  }

  return inDegree;
}
