// src/execution/dependency-graph.ts
/**
 * 依赖图和并行执行模块
 *
 * 实现操作依赖分析、拓扑排序和并行执行
 * 基于最佳实践报告的建议
 */

import { Action } from '../types';

/**
 * 图节点
 */
interface Node {
  id: string;
  action: Action;
  dependencies: string[]; // 依赖的节点 ID 列表
  dependents: string[];   // 依赖此节点的节点 ID 列表
}

/**
 * 依赖图
 */
class Graph {
  private nodes: Map<string, Node> = new Map();

  addNode(action: Action, id: string): void {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, {
        id,
        action,
        dependencies: [],
        dependents: [],
      });
    }
  }

  getNode(id: string): Node | undefined {
    return this.nodes.get(id);
  }

  addEdge(fromId: string, toId: string): void {
    const from = this.nodes.get(fromId);
    const to = this.nodes.get(toId);

    if (from && to) {
      from.dependencies.push(toId);
      to.dependents.push(fromId);
    }
  }

  getNodes(): Node[] {
    return Array.from(this.nodes.values());
  }

  /**
   * 获取没有依赖的节点（可以立即执行）
   */
  getIndependentNodes(): Node[] {
    return this.getNodes().filter(node => node.dependencies.length === 0);
  }

  /**
   * 移除节点（执行完成后）
   */
  removeNode(id: string): void {
    const node = this.nodes.get(id);
    if (!node) return;

    // 从依赖此节点的节点中移除依赖
    for (const dependentId of node.dependents) {
      const dependent = this.nodes.get(dependentId);
      if (dependent) {
        dependent.dependencies = dependent.dependencies.filter(depId => depId !== id);
      }
    }

    // 删除节点
    this.nodes.delete(id);
  }

  isEmpty(): boolean {
    return this.nodes.size === 0;
  }
}

/**
 * 判断两个操作是否存在依赖关系
 *
 * @param action - 操作 A
 * @param other - 操作 B
 * @returns true 如果 A 依赖 B
 */
export function dependsOn(action: Action, other: Action): boolean {
  // 创建操作通常不依赖其他操作（除非修改同一个文件）
  if (action.type === 'create') {
    // 如果 other 创建了同名文件，可能存在依赖
    return other.type === 'create' && action.path === other.path;
  }

  // 修改操作可能依赖创建操作
  if (action.type === 'modify') {
    // 如果 other 创建了文件，modify 可能依赖 create
    if (other.type === 'create' && action.path === other.path) {
      return true;
    }
  }

  // 运行命令通常依赖文件操作
  if (action.type === 'run') {
    // 如果有文件创建/修改操作，命令可能依赖它们
    if (other.type === 'create' || other.type === 'modify') {
      return true;
    }
  }

  // 验证操作通常依赖所有之前的操作
  if (action.type === 'verify') {
    return true;
  }

  // 默认无依赖
  return false;
}

/**
 * 构建操作依赖图
 *
 * @param actions - 操作列表
 * @returns 依赖图和 ID 映射
 */
export function buildDependencyGraph(actions: Action[]): {
  graph: Graph;
  idMap: Map<Action, string>;
} {
  const graph = new Graph();
  const idMap = new Map<Action, string>();

  // 添加所有节点
  actions.forEach((action, index) => {
    const id = `action-${index}`;
    idMap.set(action, id);
    graph.addNode(action, id);
  });

  // 添加依赖边
  actions.forEach((action, i) => {
    const fromId = `action-${i}`;

    actions.forEach((other, j) => {
      if (i === j) return;

      const toId = `action-${j}`;

      if (dependsOn(action, other)) {
        graph.addEdge(fromId, toId);
      }
    });
  });

  return { graph, idMap };
}

/**
 * 拓扑排序 - 返回可以并行执行的层
 *
 * @param graph - 依赖图
 * @returns 操作层列表，每层可以并行执行
 */
export function topologicalSort(graph: Graph): Action[][] {
  const layers: Action[][] = [];
  const visited = new Set<string>();

  // 复制图以避免修改原始图
  const workingGraph = cloneGraph(graph);

  // Kahn's algorithm
  while (!workingGraph.isEmpty()) {
    // 获取当前层（没有依赖的节点）
    const currentLayer = workingGraph.getIndependentNodes();

    if (currentLayer.length === 0) {
      // 循环依赖检测
      throw new Error('检测到循环依赖，无法执行');
    }

    // 提取操作
    const actions = currentLayer.map(node => node.action);
    layers.push(actions);

    // 标记为已访问并从图中移除
    currentLayer.forEach(node => {
      visited.add(node.id);
      workingGraph.removeNode(node.id);
    });
  }

  return layers;
}

/**
 * 克隆图（深拷贝）
 */
function cloneGraph(graph: Graph): Graph {
  const cloned = new Graph();
  const nodes = graph.getNodes();

  nodes.forEach(node => {
    cloned.addNode(node.action, node.id);
  });

  nodes.forEach(node => {
    node.dependencies.forEach(depId => {
      cloned.addEdge(node.id, depId);
    });
  });

  return cloned;
}

/**
 * 分析操作的并行性
 *
 * @param actions - 操作列表
 * @returns 分析结果
 */
export function analyzeParallelism(actions: Action[]): {
  totalActions: number;
  layers: number;
  maxParallel: number;
  speedup: number; // 理论加速比
  parallelizable: number; // 可并行操作数量
} {
  if (actions.length === 0) {
    return {
      totalActions: 0,
      layers: 0,
      maxParallel: 0,
      speedup: 1,
      parallelizable: 0,
    };
  }

  const { graph } = buildDependencyGraph(actions);
  const layers = topologicalSort(graph);

  const maxParallel = Math.max(...layers.map(layer => layer.length));
  const parallelizable = actions.length - layers.length; // 非第一层的操作都可以并行

  // 估算加速比（简化模型）
  // 假设每个操作耗时相同，加速比 = 串行总时间 / 并行总时间
  const serialTime = actions.length;
  const parallelTime = layers.length;
  const speedup = serialTime / parallelTime;

  return {
    totalActions: actions.length,
    layers: layers.length,
    maxParallel,
    speedup: Math.round(speedup * 100) / 100,
    parallelizable,
  };
}

/**
 * 打印并行执行计划
 *
 * @param actions - 操作列表
 */
export function printExecutionPlan(actions: Action[]): void {
  const analysis = analyzeParallelism(actions);
  const { graph } = buildDependencyGraph(actions);
  const layers = topologicalSort(graph);

  console.log('\n📊 并行执行分析:');
  console.log(`   总操作数: ${analysis.totalActions}`);
  console.log(`   执行层数: ${analysis.layers}`);
  console.log(`   最大并行: ${analysis.maxParallel}`);
  console.log(`   理论加速: ${analysis.speedup}x`);
  console.log(`   可并行: ${analysis.parallelizable}/${analysis.totalActions}`);

  console.log('\n📋 执行计划:');
  layers.forEach((layer, index) => {
    console.log(`\n   层 ${index + 1} (${layer.length} 个操作):`);
    layer.forEach((action, i) => {
      const icon = getActionIcon(action.type);
      console.log(`      ${i + 1}. ${icon} ${action.type}: ${action.path || action.command}`);
    });
  });
  console.log('');
}

/**
 * 获取操作图标
 */
function getActionIcon(type: string): string {
  const icons: Record<string, string> = {
    create: '📝',
    modify: '✏️',
    delete: '🗑️',
    read: '📖',
    run: '⚡',
  };

  return icons[type] || '•';
}
