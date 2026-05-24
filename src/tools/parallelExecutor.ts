/**
 * 工具并行编排器
 *
 * 实现 LLM 返回的多个 tool_use 调用的智能编排执行：
 * - 解析多个 tool_use 调用
 * - 分析依赖关系
 * - 无依赖的工具并行执行
 * - 有依赖的串行执行
 * - 超时控制和错误隔离
 *
 * @author Newma (牛码) Development Team
 * @version 1.0.0
 */

import { ToolResult } from './types';

/**
 * 简化的工具接口（用于并行执行）
 */
export interface SimpleTool {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description?: string;
  /** 处理函数 */
  handler: (params: Record<string, unknown>) => Promise<ToolResult>;
}

/**
 * 工具调用参数
 */
export interface ToolCall {
  /** 工具名称 */
  name: string;
  /** 调用参数 */
  parameters: Record<string, unknown>;
  /** 调用 ID */
  id: string;
  /** 优先级（可选） */
  priority?: number;
}

/**
 * 工具执行结果
 */
export interface ToolExecutionResult {
  /** 调用 ID */
  id: string;
  /** 工具名称 */
  name: string;
  /** 执行结果 */
  result: ToolResult;
  /** 执行耗时（毫秒） */
  duration: number;
  /** 开始时间 */
  startTime: Date;
  /** 结束时间 */
  endTime: Date;
}

/**
 * 执行统计
 */
export interface ExecutionStats {
  /** 总工具数 */
  total: number;
  /** 成功数 */
  succeeded: number;
  /** 失败数 */
  failed: number;
  /** 总耗时（毫秒） */
  totalDuration: number;
  /** 平均耗时（毫秒） */
  averageDuration: number;
}

/**
 * 依赖关系图节点
 */
interface DependencyNode {
  /** 工具调用 */
  call: ToolCall;
  /** 依赖的工具 ID 列表 */
  dependencies: string[];
  /** 被依赖的工具 ID 列表 */
  dependents: string[];
  /** 执行状态 */
  status: 'pending' | 'running' | 'completed' | 'failed';
}

/**
 * 执行配置
 */
export interface ExecutionConfig {
  /** 单个工具超时时间（毫秒） */
  singleTimeout?: number;
  /** 整体超时时间（毫秒） */
  totalTimeout?: number;
  /** 最大并发数 */
  maxConcurrency?: number;
  /** 是否在错误时继续 */
  continueOnError?: boolean;
  /** 调试模式 */
  debug?: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<ExecutionConfig> = {
  singleTimeout: 30000, // 30 秒
  totalTimeout: 120000, // 120 秒
  maxConcurrency: 5,
  continueOnError: true,
  debug: false,
};

/**
 * 工具并行编排器类
 */
export class ParallelToolExecutor {
  /** 工具注册表 */
  private readonly tools: Map<string, SimpleTool> = new Map();
  /** 执行配置 */
  private config: Required<ExecutionConfig>;

  constructor(tools: SimpleTool[], config: ExecutionConfig = {}) {
    // 注册工具
    tools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });

    // 合并配置
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<ExecutionConfig>;
  }

  /**
   * 执行多个工具调用
   */
  async execute(calls: ToolCall[]): Promise<ToolExecutionResult[]> {
    if (calls.length === 0) {
      return [];
    }

    // 验证工具存在
    this.validateCalls(calls);

    // 分析依赖关系
    const dependencyGraph = this.buildDependencyGraph(calls);

    if (this.config.debug) {
      this.logDependencyGraph(dependencyGraph);
    }

    // 执行工具
    const results = await this.executeWithDependencies(dependencyGraph);

    // 按调用顺序排序返回
    const resultMap = new Map(results.map(r => [r.id, r]));
    const sortedResults: ToolExecutionResult[] = [];

    for (const call of calls) {
      const result = resultMap.get(call.id);
      if (result) {
        sortedResults.push(result);
      }
    }

    return sortedResults;
  }

  /**
   * 验证工具调用
   */
  private validateCalls(calls: ToolCall[]): void {
    for (const call of calls) {
      if (!this.tools.has(call.name)) {
        throw new Error(`工具 ${call.name} 未注册`);
      }
    }
  }

  /**
   * 构建依赖关系图
   */
  private buildDependencyGraph(calls: ToolCall[]): Map<string, DependencyNode> {
    const graph = new Map<string, DependencyNode>();

    // 创建所有节点
    for (const call of calls) {
      graph.set(call.id, {
        call,
        dependencies: [],
        dependents: [],
        status: 'pending',
      });
    }

    // 分析依赖关系
    for (const call of calls) {
      const node = graph.get(call.id)!;
      const dependencies = this.analyzeDependencies(call, calls);

      for (const depId of dependencies) {
        const depNode = graph.get(depId);
        if (depNode) {
          node.dependencies.push(depId);
          depNode.dependents.push(call.id);
        }
      }
    }

    return graph;
  }

  /**
   * 分析工具调用的依赖关系
   */
  private analyzeDependencies(call: ToolCall, allCalls: ToolCall[]): string[] {
    const dependencies: string[] = [];
    const params = call.parameters;

    // 检查参数中是否引用了其他工具的输出
    // 策略：如果参数值包含 {{tool_call_id}} 这样的占位符，则表示依赖
    for (const [key, value] of Object.entries(params)) {
      const references = this.extractToolReferences(value);
      dependencies.push(...references);
    }

    // 去重
    return [...new Set(dependencies)];
  }

  /**
   * 从值中提取工具引用
   */
  private extractToolReferences(value: unknown): string[] {
    const references: string[] = [];

    if (typeof value === 'string') {
      // 匹配 {{tool_call_id}} 格式
      const matches = value.match(/\{\{([a-zA-Z0-9_-]+)\}\}/g);
      if (matches) {
        references.push(...matches.map(m => m.slice(2, -2)));
      }
    } else if (Array.isArray(value)) {
      for (const item of value) {
        references.push(...this.extractToolReferences(item));
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const v of Object.values(value)) {
        references.push(...this.extractToolReferences(v));
      }
    }

    return references;
  }

  /**
   * 执行工具（考虑依赖关系）
   */
  private async executeWithDependencies(
    graph: Map<string, DependencyNode>
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];
    const startTime = Date.now();
    const totalDeadline = startTime + this.config.totalTimeout;

    // 找出所有没有依赖的节点（第一批可执行）
    const readyNodes = this.getReadyNodes(graph);

    // 分批执行
    let batch = readyNodes;
    while (batch.length > 0) {
      // 检查总超时
      if (Date.now() > totalDeadline) {
        throw new Error('工具执行超时');
      }

      // 并行执行当前批次
      const batchResults = await this.executeBatch(batch, graph);

      // 更新节点状态
      for (const result of batchResults) {
        const node = graph.get(result.id);
        if (node) {
          node.status = result.result.success ? 'completed' : 'failed';
        }
        results.push(result);
      }

      // 如果配置为错误时停止，且有失败，则终止
      if (!this.config.continueOnError) {
        const hasFailure = batchResults.some(r => !r.result.success);
        if (hasFailure) {
          break;
        }
      }

      // 准备下一批次（依赖的节点都已完成）
      batch = this.getNextBatch(graph);
    }

    return results;
  }

  /**
   * 获取可执行的节点（无未完成的依赖）
   */
  private getReadyNodes(graph: Map<string, DependencyNode>): DependencyNode[] {
    const readyNodes: DependencyNode[] = [];

    for (const node of graph.values()) {
      if (node.status !== 'pending') {
        continue;
      }

      // 检查所有依赖是否都已完成
      const allDepsCompleted = node.dependencies.every(depId => {
        const depNode = graph.get(depId);
        return depNode?.status === 'completed';
      });

      if (allDepsCompleted) {
        readyNodes.push(node);
      }
    }

    return readyNodes;
  }

  /**
   * 获取下一批可执行的节点
   */
  private getNextBatch(graph: Map<string, DependencyNode>): DependencyNode[] {
    return this.getReadyNodes(graph);
  }

  /**
   * 执行一批工具（并行）
   */
  private async executeBatch(
    nodes: DependencyNode[],
    graph: Map<string, DependencyNode>
  ): Promise<ToolExecutionResult[]> {
    // 限制并发数
    const chunks = this.chunkArray(nodes, this.config.maxConcurrency);

    const allResults: ToolExecutionResult[] = [];

    for (const chunk of chunks) {
      // 并行执行
      const promises = chunk.map(node => this.executeSingle(node));

      // 等待所有执行完成（使用 Promise.allSettled 以隔离错误）
      const settledResults = await Promise.allSettled(promises);

      // 处理结果
      for (let i = 0; i < settledResults.length; i++) {
        const settled = settledResults[i];
        const node = chunk[i];

        if (settled.status === 'fulfilled') {
          allResults.push(settled.value);
        } else {
          // 执行失败，返回错误结果
          allResults.push({
            id: node.call.id,
            name: node.call.name,
            result: {
              success: false,
              error: settled.reason?.message || '执行失败',
            },
            duration: 0,
            startTime: new Date(),
            endTime: new Date(),
          });
        }
      }
    }

    return allResults;
  }

  /**
   * 执行单个工具
   */
  private async executeSingle(node: DependencyNode): Promise<ToolExecutionResult> {
    const tool = this.tools.get(node.call.name)!;
    const startTime = new Date();

    try {
      // 创建超时 Promise
      const timeoutPromise = new Promise<ToolResult>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`工具 ${node.call.name} 执行超时`));
        }, this.config.singleTimeout);
      });

      // 执行工具（带超时）
      const result = await Promise.race([
        tool.handler(node.call.parameters),
        timeoutPromise,
      ]);

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        id: node.call.id,
        name: node.call.name,
        result,
        duration,
        startTime,
        endTime,
      };
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        id: node.call.id,
        name: node.call.name,
        result: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
        duration,
        startTime,
        endTime,
      };
    }
  }

  /**
   * 将数组分块
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 打印依赖关系图（调试用）
   */
  private logDependencyGraph(graph: Map<string, DependencyNode>): void {
    console.log('工具依赖关系图:');
    for (const [id, node] of graph.entries()) {
      const deps = node.dependencies.length > 0
        ? node.dependencies.join(', ')
        : '无';
      console.log(`  ${id} (${node.call.name}): 依赖 [${deps}]`);
    }
  }

  /**
   * 计算执行统计
   */
  calculateStats(results: ToolExecutionResult[]): ExecutionStats {
    const succeeded = results.filter(r => r.result.success).length;
    const failed = results.filter(r => !r.result.success).length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = results.length > 0 ? totalDuration / results.length : 0;

    return {
      total: results.length,
      succeeded,
      failed,
      totalDuration,
      averageDuration,
    };
  }

  /**
   * 打印执行摘要
   */
  printSummary(results: ToolExecutionResult[]): void {
    const stats = this.calculateStats(results);

    console.log('\n工具执行摘要:');
    console.log(`  总计: ${stats.total} 个工具`);
    console.log(`  成功: ${stats.succeeded} 个`);
    console.log(`  失败: ${stats.failed} 个`);
    console.log(`  总耗时: ${stats.totalDuration} ms`);
    console.log(`  平均耗时: ${stats.averageDuration.toFixed(2)} ms`);

    // 打印失败的工具
    const failures = results.filter(r => !r.result.success);
    if (failures.length > 0) {
      console.log('\n失败的工具:');
      for (const failure of failures) {
        console.log(`  - ${failure.name} (${failure.id}): ${failure.result.error}`);
      }
    }
  }
}

/**
 * 从 LLM 响应中解析工具调用
 */
export function parseToolCallsFromAIResponse(
  response: unknown
): ToolCall[] {
  // 这里假设响应格式类似于 OpenAI 的 tool_calls
  // 实际实现需要根据具体的 AI 响应格式调整
  const calls: ToolCall[] = [];

  // 示例：解析 OpenAI 格式的 tool_calls
  if (typeof response === 'object' && response !== null) {
    const resp = response as Record<string, unknown>;

    if ('tool_calls' in resp && Array.isArray(resp.tool_calls)) {
      for (const tc of resp.tool_calls) {
        if (typeof tc === 'object' && tc !== null) {
          const toolCall = tc as Record<string, unknown>;

          if ('id' in toolCall &&
              'function' in toolCall &&
              typeof toolCall.function === 'object') {
            const func = toolCall.function as Record<string, unknown>;

            calls.push({
              id: String(toolCall.id),
              name: String(func.name || ''),
              parameters: typeof func.arguments === 'string'
                ? JSON.parse(func.arguments)
                : (func.arguments || {}),
            });
          }
        }
      }
    }
  }

  return calls;
}

/**
 * 创建工具执行上下文（包含之前工具的结果）
 */
export function createToolExecutionContext(
  previousResults: ToolExecutionResult[]
): Record<string, unknown> {
  const context: Record<string, unknown> = {};

  for (const result of previousResults) {
    // 提供工具结果的便捷访问
    context[result.id] = result.result.output;

    // 也提供按工具名称的访问
    if (!context[result.name]) {
      context[result.name] = [];
    }
    (context[result.name] as unknown[]).push(result.result.output);
  }

  return context;
}

/**
 * 替换参数中的工具引用占位符
 */
export function replaceToolReferences(
  parameters: Record<string, unknown>,
  context: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(parameters)) {
    result[key] = replaceValue(value, context);
  }

  return result;
}

/**
 * 递归替换值中的引用
 */
function replaceValue(value: unknown, context: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    // 替换 {{tool_call_id}} 占位符
    return value.replace(/\{\{([a-zA-Z0-9_-]+)\}\}/g, (_, ref) => {
      return context[ref] !== undefined ? String(context[ref]) : ref;
    });
  } else if (Array.isArray(value)) {
    return value.map(item => replaceValue(item, context));
  } else if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = replaceValue(v, context);
    }
    return result;
  }

  return value;
}
