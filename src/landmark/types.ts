/**
 * Landmark Counting Heuristic - Type Definitions
 *
 * Landmark (路标) 是规划中的关键里程碑或子目标。
 * 通过识别路标、分析依赖关系、拓扑排序，生成智能的分步执行计划。
 */

import { Action } from '../types';

/**
 * 路标类型
 */
export enum LandmarkType {
  FILE_CREATION = 'file_creation',           // 创建文件
  FILE_MODIFICATION = 'file_modification',   // 修改文件
  COMMAND_EXECUTION = 'command_execution',   // 执行命令
  TEST = 'test',                              // 运行测试
  VERIFICATION = 'verification',             // 验证结果
  DEPENDENCY_INSTALL = 'dependency_install', // 安装依赖
  REFACTORING = 'refactoring',               // 代码重构
  DOCUMENTATION = 'documentation',           // 文档编写
}

/**
 * 路标 - 子目标或里程碑
 */
export interface Landmark {
  id: string;                  // 唯一标识符
  description: string;         // 人类可读的描述
  type: LandmarkType;          // 路标类型
  dependsOn: string[];         // 依赖的路标 ID（必须在这些路标完成后才能执行）
  actions: Action[];           // 完成此路标所需的动作
  estimatedSteps: number;      // 预计需要多少步骤（动作数量）
  priority: 'high' | 'medium' | 'low';  // 优先级
}

/**
 * 基于路标的计划
 */
export interface LandmarkPlan {
  requirement: string;         // 原始需求
  landmarks: Landmark[];       // 识别的所有路标
  executionOrder: string[];    // 路标执行顺序（拓扑排序后的ID列表）
  estimatedTotalSteps: number; // 预计总步骤数
  reasoning: string;           // 推理说明（为什么这样分步）
  complexity: 'simple' | 'medium' | 'complex';  // 任务复杂度评估
}

/**
 * Landmark 配置
 */
export interface LandmarkConfig {
  enabled: boolean;            // 是否启用
  maxLandmarks: number;        // 最多识别多少个路标（默认10）
  mergeThreshold: number;      // 合并小路标的阈值（默认2步）
  showReasoning: boolean;      // 是否显示推理过程（默认true）
  allowParallel: boolean;      // 是否允许并行执行无依赖的路标（默认false）
}

/**
 * 路标识别结果（AI返回的原始格式）
 */
export interface RawLandmark {
  description: string;
  type: LandmarkType;
  estimatedSteps?: number;
  priority?: 'high' | 'medium' | 'low';
}

/**
 * 依赖关系分析结果
 */
export interface DependencyAnalysis {
  landmarkId: string;
  dependsOn: string[];         // 依赖的路标ID列表
  reason: string;              // 为什么需要这些依赖
}
