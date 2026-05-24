/**
 * Landmark Planner - 基于路标的规划器
 *
 * 核心算法：
 * 1. 识别路标（里程碑）
 * 2. 拓扑排序（Kahn算法）- 处理依赖关系
 * 3. 生成有序执行计划
 */

import chalk from 'chalk';
import { Config } from '../config';
import { Landmark, LandmarkPlan, LandmarkConfig } from './types';
import { LandmarkIdentifier } from './identifier';
import { Action } from '../types';
import {
  validateLandmarks,
  detectCircularDependencies,
  mergeSmallLandmarks,
  estimateComplexity,
  generateReasoning,
  formatLandmarks,
  calculateInDegree,
} from './utils';

/**
 * 基于路标的规划器
 */
export class LandmarkPlanner {
  private identifier: LandmarkIdentifier;
  private config: LandmarkConfig;

  constructor(config: LandmarkConfig) {
    this.identifier = new LandmarkIdentifier();
    this.config = config;
  }

  /**
   * 生成基于路标的计划（主入口）
   *
   * @param config OpenAI配置
   * @param requirement 用户需求
   * @param projectInfo 项目信息
   * @param context 额外上下文
   * @returns LandmarkPlan 完整的路标计划
   */
  async generatePlan(
    config: Config,
    requirement: string,
    projectInfo: Record<string, string>,
    context: string = ''
  ): Promise<LandmarkPlan & { actions: Action[] }> {
    console.log(chalk.gray('📍 [Landmark] Identifying key milestones...\n'));

    // Step 1: 识别路标
    let landmarks = await this.identifier.identifyLandmarks(
      config,
      requirement,
      projectInfo,
      context
    );

    if (landmarks.length === 0) {
      throw new Error('No landmarks identified from requirement');
    }

    console.log(chalk.gray(`📍 [Landmark] Identified ${landmarks.length} landmarks\n`));

    // Step 2: 合并小路标（可选优化）
    if (this.config.mergeThreshold > 0) {
      const beforeMerge = landmarks.length;
      landmarks = mergeSmallLandmarks(landmarks, this.config.mergeThreshold);
      if (landmarks.length !== beforeMerge) {
        console.log(chalk.gray(`📍 [Landmark] Merged ${beforeMerge - landmarks.length} small landmarks\n`));
      }
    }

    // Step 3: 验证路标
    const validation = validateLandmarks(landmarks);
    if (!validation.valid) {
      throw new Error(`Invalid landmarks: ${validation.errors.join(', ')}`);
    }

    // Step 4: 检测循环依赖
    const cycles = detectCircularDependencies(landmarks);
    if (cycles) {
      console.log(chalk.yellow(`⚠️  [Landmark] Circular dependencies detected:`));
      cycles.forEach(cycle => console.log(chalk.yellow(`  ${cycle}`)));
      console.log(chalk.yellow('⚠️  [Landmark] Attempting to resolve...\n'));

      // 尝试修复：移除导致循环的依赖
      landmarks = this.resolveCircularDependencies(landmarks, cycles);
    }

    // Step 5: 拓扑排序（Kahn算法 - 核心算法）
    const executionOrder = this.topologicalSort(landmarks);

    console.log(chalk.gray(`📍 [Landmark] Generated execution order with ${executionOrder.length} steps\n`));

    // Step 6: 生成动作序列
    const actions = this.buildActionsFromLandmarks(landmarks, executionOrder);

    // Step 7: 生成推理说明
    const reasoning = generateReasoning(landmarks, executionOrder);

    // Step 8: 估算复杂度
    const complexity = estimateComplexity(landmarks);

    // 显示路标（如果启用）
    if (this.config.showReasoning) {
      console.log(formatLandmarks(landmarks, executionOrder));
    }

    return {
      requirement,
      landmarks,
      executionOrder,
      estimatedTotalSteps: actions.length,
      reasoning,
      complexity,
      actions,
    };
  }

  /**
   * 拓扑排序 - Kahn算法
   *
   * 这是计数启发式的核心：
   * - 计算每个节点的入度（依赖数量）
   * - 从入度为0的节点开始处理
   * - 逐个移除节点，更新其他节点的入度
   * - 最终得到拓扑排序的执行顺序
   *
   * @param landmarks 路标列表
   * @returns 拓扑排序后的路标ID列表
   */
  private topologicalSort(landmarks: Landmark[]): string[] {
    const landmarkMap = new Map(landmarks.map(l => [l.id, l]));
    const inDegree = calculateInDegree(landmarks);
    const order: string[] = [];

    // 队列：存储入度为0的节点
    const queue: string[] = [];

    // 初始化：将所有入度为0的节点加入队列
    landmarks.forEach(l => {
      if ((inDegree.get(l.id) || 0) === 0) {
        queue.push(l.id);
      }
    });

    // Kahn算法主循环
    while (queue.length > 0) {
      // 从队列中取出一个节点
      const current = queue.shift()!;
      order.push(current);

      // 找到所有依赖当前节点的路标
      const dependents = landmarks.filter(l => l.dependsOn.includes(current));

      // 更新这些路标的入度
      for (const dependent of dependents) {
        const newDegree = (inDegree.get(dependent.id) || 0) - 1;
        inDegree.set(dependent.id, newDegree);

        // 如果入度变为0，加入队列
        if (newDegree === 0) {
          queue.push(dependent.id);
        }
      }
    }

    // 检查是否所有节点都被处理（检测循环依赖）
    if (order.length !== landmarks.length) {
      const processed = new Set(order);
      const unprocessed = landmarks
        .filter(l => !processed.has(l.id))
        .map(l => l.id);

      throw new Error(
        `Circular dependency detected. Cannot determine execution order. ` +
        `Unprocessed landmarks: ${unprocessed.join(', ')}`
      );
    }

    return order;
  }

  /**
   * 将路标转换为动作序列
   *
   * 按照拓扑排序的顺序，将每个路标的动作拼接起来
   */
  private buildActionsFromLandmarks(
    landmarks: Landmark[],
    executionOrder: string[]
  ): Action[] {
    const actions: Action[] = [];
    const landmarkMap = new Map(landmarks.map(l => [l.id, l]));

    // 按照执行顺序遍历路标
    for (const landmarkId of executionOrder) {
      const landmark = landmarkMap.get(landmarkId);
      if (!landmark) {
        console.log(chalk.yellow(`⚠️  [Landmark] Skipping unknown landmark: ${landmarkId}`));
        continue;
      }

      // 将路标的动作添加到序列中
      if (landmark.actions && landmark.actions.length > 0) {
        actions.push(...landmark.actions);
      } else {
        // 如果路标没有动作，生成一个占位符动作
        console.log(chalk.yellow(`⚠️  [Landmark] No actions for ${landmark.id}, generating placeholder`));
        actions.push({
          type: 'create',
          path: `temp/${landmark.id}.md`,
          content: `# ${landmark.description}\n\nTODO: Implement this milestone`,
        } as Action);
      }
    }

    return actions;
  }

  /**
   * 解决循环依赖
   *
   * 策略：移除导致循环的依赖关系中的最后一个
   */
  private resolveCircularDependencies(
    landmarks: Landmark[],
    cycles: string[]
  ): Landmark[] {
    const landmarkMap = new Map(landmarks.map(l => [l.id, l]));

    // 对于每个循环，移除导致循环的依赖
    for (const cycle of cycles) {
      const ids = cycle.split(' → ');
      if (ids.length < 2) continue;

      // 移除最后一个路标对第一个路标的依赖
      const lastId = ids[ids.length - 1];
      const firstId = ids[0];

      const lastLandmark = landmarkMap.get(lastId);
      if (lastLandmark) {
        lastLandmark.dependsOn = lastLandmark.dependsOn.filter(id => id !== firstId);
        console.log(chalk.gray(`📍 [Landmark] Removed dependency: ${lastId} → ${firstId}`));
      }
    }

    return landmarks;
  }

  /**
   * 获取配置
   */
  getConfig(): LandmarkConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<LandmarkConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

/**
 * 导出便捷函数：使用默认配置生成路标计划
 *
 * @param config OpenAI配置
 * @param requirement 用户需求
 * @param projectInfo 项目信息
 * @param context 额外上下文
 * @param landmarkConfig 路标配置（可选）
 * @returns LandmarkPlan 完整的路标计划
 */
export async function generatePlanWithLandmarks(
  config: Config,
  requirement: string,
  projectInfo: Record<string, string>,
  context: string = '',
  landmarkConfig?: Partial<LandmarkConfig>
): Promise<LandmarkPlan & { actions: Action[] }> {
  const finalConfig: LandmarkConfig = {
    enabled: true,
    maxLandmarks: 10,
    mergeThreshold: 2,
    showReasoning: true,
    allowParallel: false,
    ...landmarkConfig,
  };

  const planner = new LandmarkPlanner(finalConfig);
  return await planner.generatePlan(config, requirement, projectInfo, context);
}
