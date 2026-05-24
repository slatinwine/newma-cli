/**
 * Parallel Subagent Coordinator
 * 并行 subagent 协调器，实现类似 Claude Code 的多任务分派机制
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SubTask,
  SubTaskStatus,
  AgentType,
  SubTaskResult,
  ParallelExecutionConfig,
  ParallelExecutionSummary,
  TimelineEvent,
  ToolCallRecord
} from './subtask';
import { BaseSubAgent } from './base-subagent';
import { callAIWithFunctionCalling } from '../../ai';
import { SessionManager } from '../../session';
import { ExecutionTracker } from '../../history';

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<ParallelExecutionConfig> = {
  maxSubagents: 5,
  taskTimeout: 60000,
  totalTimeout: 300000,
  enableDependencies: true,
  continueOnFailure: true,
  agentConfigs: {
    'code-analysis': {
      enabled: true,
      temperature: 0.3,
      maxIterations: 10,
      tools: ['read_file', 'list_directory', 'find_files', 'search_content'],
      systemPrompt: 'You are a code analysis expert. Analyze code structure, patterns, and relationships.'
    },
    'architecture': {
      enabled: true,
      temperature: 0.7,
      maxIterations: 8,
      systemPrompt: 'You are a software architecture expert. Design scalable and maintainable systems.'
    },
    'implementation': {
      enabled: true,
      temperature: 0.3,
      maxIterations: 15,
      tools: ['create_file', 'modify_file', 'delete_file', 'run_command'],
      systemPrompt: 'You are an implementation expert. Write clean, efficient, and well-documented code.'
    },
    'testing': {
      enabled: true,
      temperature: 0.3,
      maxIterations: 10,
      tools: ['run_command', 'read_file', 'create_file'],
      systemPrompt: 'You are a testing expert. Write comprehensive tests and ensure code quality.'
    },
    'documentation': {
      enabled: true,
      temperature: 0.5,
      maxIterations: 8,
      tools: ['read_file', 'modify_file', 'create_file'],
      systemPrompt: 'You are a documentation expert. Create clear and comprehensive documentation.'
    },
    'general': {
      enabled: true,
      temperature: 0.5,
      maxIterations: 10
    }
  }
};

export class ParallelSubAgentCoordinator {
  private config: Required<ParallelExecutionConfig>;
  private session: SessionManager;
  private tracker: ExecutionTracker;
  private timeline: TimelineEvent[] = [];
  private abortController?: AbortController;

  constructor(
    session: SessionManager,
    config?: ParallelExecutionConfig
  ) {
    this.session = session;
    this.tracker = session.getTracker();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      agentConfigs: {
        ...DEFAULT_CONFIG.agentConfigs,
        ...config?.agentConfigs
      }
    };
  }

  /**
   * 执行并行 subagent 任务
   */
  async execute(
    requirement: string,
    subTasks: SubTask[]
  ): Promise<ParallelExecutionSummary> {
    const startTime = Date.now();
    this.abortController = new AbortController();

    // 记录执行开始
    this.addTimelineEvent({
      timestamp: new Date(),
      type: 'execution_started',
      description: `开始并行执行 ${subTasks.length} 个子任务`
    });

    // 初始化所有子任务
    const initializedTasks = subTasks.map(task => ({
      ...task,
      status: SubTaskStatus.PENDING,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 3
    }));

    // 按优先级和依赖关系排序
    const sortedTasks = this.sortTasksByPriority(initializedTasks);

    // 执行子任务
    const results: SubTaskResult[] = [];
    for (const task of sortedTasks) {
      // 检查是否被取消
      if (this.abortController.signal.aborted) {
        task.status = SubTaskStatus.CANCELLED;
        continue;
      }

      // 检查依赖是否满足
      if (this.config.enableDependencies) {
        await this.waitForDependencies(task, results);
      }

      // 执行子任务
      const result = await this.executeSubTask(task);
      results.push(result);

      // 如果失败且不继续，则中断
      if (!result.success && !this.config.continueOnFailure) {
        break;
      }
    }

    // 记录执行结束
    this.addTimelineEvent({
      timestamp: new Date(),
      type: 'execution_finished',
      description: `并行执行完成: ${results.filter(r => r.success).length}/${results.length} 成功`
    });

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    // 构建摘要
    return this.buildSummary(results, totalDuration);
  }

  /**
   * 执行单个子任务
   */
  private async executeSubTask(task: SubTask): Promise<SubTaskResult> {
    const startTime = Date.now();
    task.status = SubTaskStatus.RUNNING;
    task.startedAt = new Date();

    this.addTimelineEvent({
      timestamp: new Date(),
      type: 'task_started',
      taskId: task.id,
      agentType: task.agentType,
      description: `开始执行子任务: ${task.description}`
    });

    try {
      // 设置超时
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), this.config.taskTimeout);
      });

      // 执行任务
      const executionPromise = this.runAgent(task);

      // 等待执行或超时
      const result = await Promise.race([executionPromise, timeoutPromise]);

      task.status = SubTaskStatus.COMPLETED;
      task.completedAt = new Date();
      task.duration = Date.now() - startTime;
      task.output = result;

      this.addTimelineEvent({
        timestamp: new Date(),
        type: 'task_completed',
        taskId: task.id,
        agentType: task.agentType,
        description: `子任务完成: ${task.description}`
      });

      return {
        task,
        success: true,
        summary: this.generateTaskSummary(task)
      };

    } catch (error: any) {
      task.status = SubTaskStatus.FAILED;
      task.completedAt = new Date();
      task.duration = Date.now() - startTime;
      task.output = {
        error: error.message
      };

      this.addTimelineEvent({
        timestamp: new Date(),
        type: 'task_failed',
        taskId: task.id,
        agentType: task.agentType,
        description: `子任务失败: ${error.message}`
      });

      return {
        task,
        success: false,
        summary: `执行失败: ${error.message}`
      };
    }
  }

  /**
   * 运行 Agent
   */
  private async runAgent(task: SubTask): Promise<any> {
    const agentConfig = this.config.agentConfigs[task.agentType];
    if (!agentConfig || !agentConfig.enabled) {
      throw new Error(`Agent type ${task.agentType} is not enabled`);
    }

    // 构建系统提示词
    const systemPrompt = this.buildSystemPrompt(task, agentConfig);

    // 构建用户消息
    const userMessage = this.buildUserMessage(task);

    // 调用 AI
    const response = await callAIWithFunctionCalling(
      this.session.getConfig(),
      {}, // projectInfo (空对象，因为 subagent 有自己的上下文)
      userMessage,
      [], // history (空数组)
      { getAllTools: () => [] } as any, // ToolRegistry (临时空实现)
      this.abortController?.signal
    );

    // 记录 Token 使用
    if (response.usage) {
      task.tokenUsage = {
        prompt: response.usage.prompt_tokens,
        completion: response.usage.completion_tokens,
        total: response.usage.total_tokens
      };
    }

    // 解析响应
    return this.parseResponse(response, task);
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(task: SubTask, agentConfig: any): string {
    const basePrompt = agentConfig.systemPrompt || this.getDefaultSystemPrompt(task.agentType);

    return `${basePrompt}

**Task Context:**
- Goal: ${task.input.goal}
- Related Files: ${task.input.relatedFiles?.join(', ') || 'None'}
- Constraints: ${task.input.constraints?.join(', ') || 'None'}

**Your Role:**
You are a specialized ${task.agentType} agent working as part of a parallel team. Focus on your specific expertise.

**Instructions:**
1. Stay focused on your assigned task
2. Use the available tools efficiently
3. Provide clear and actionable results
4. If you encounter issues, report them clearly

**Response Format:**
Provide your results in a structured format with:
- Summary of what you did
- Key findings or changes
- Any recommendations or next steps
`;
  }

  /**
   * 构建用户消息
   */
  private buildUserMessage(task: SubTask): string {
    let message = `**Task:** ${task.description}\n\n`;
    message += `**Goal:** ${task.input.goal}\n\n`;

    if (task.input.context) {
      message += `**Context:**\n${JSON.stringify(task.input.context, null, 2)}\n\n`;
    }

    if (task.input.relatedFiles && task.input.relatedFiles.length > 0) {
      message += `**Related Files:**\n`;
      message += task.input.relatedFiles.map(f => `- ${f}`).join('\n');
      message += '\n\n';
    }

    if (task.input.constraints && task.input.constraints.length > 0) {
      message += `**Constraints:**\n`;
      message += task.input.constraints.map(c => `- ${c}`).join('\n');
      message += '\n\n';
    }

    return message;
  }

  /**
   * 解析 AI 响应
   */
  private parseResponse(response: any, task: SubTask): any {
    // 如果是工具调用响应
    if (response.type === 'tool_calls' && response.toolCalls) {
      return {
        type: 'tool_calls',
        toolCalls: response.toolCalls,
        reasoning: response.reasoning || []
      };
    }

    // 如果是文本响应
    if (response.type === 'text' && response.content) {
      return {
        type: 'text',
        content: response.content,
        reasoning: response.reasoning || []
      };
    }

    // 默认返回原始响应
    return {
      type: 'raw',
      data: response,
      reasoning: []
    };
  }

  /**
   * 获取默认系统提示词
   */
  private getDefaultSystemPrompt(agentType: AgentType): string {
    const prompts: Record<AgentType, string> = {
      'code-analysis': 'You are a code analysis expert. Analyze code structure, patterns, and relationships.',
      'architecture': 'You are a software architecture expert. Design scalable and maintainable systems.',
      'implementation': 'You are an implementation expert. Write clean, efficient, and well-documented code.',
      'testing': 'You are a testing expert. Write comprehensive tests and ensure code quality.',
      'documentation': 'You are a documentation expert. Create clear and comprehensive documentation.',
      'general': 'You are a helpful AI assistant. Complete the assigned task efficiently and accurately.'
    };

    return prompts[agentType] || prompts['general'];
  }

  /**
   * 按优先级和依赖关系排序任务
   */
  private sortTasksByPriority(tasks: SubTask[]): SubTask[] {
    // 拓扑排序（考虑依赖关系）
    const sorted: SubTask[] = [];
    const visited = new Set<string>();

    const visit = (task: SubTask) => {
      if (visited.has(task.id)) return;
      visited.add(task.id);

      // 先访问依赖
      for (const depId of task.dependencies) {
        const depTask = tasks.find(t => t.id === depId);
        if (depTask) {
          visit(depTask);
        }
      }

      sorted.push(task);
    };

    for (const task of tasks) {
      visit(task);
    }

    // 按优先级排序（不破坏依赖顺序）
    return sorted.sort((a, b) => {
      // 如果有依赖关系，保持依赖顺序
      if (a.dependencies.includes(b.id)) return 1;
      if (b.dependencies.includes(a.id)) return -1;

      // 否则按优先级排序
      return b.priority - a.priority;
    });
  }

  /**
   * 等待依赖完成
   */
  private async waitForDependencies(
    task: SubTask,
    completedResults: SubTaskResult[]
  ): Promise<void> {
    const dependencies = task.dependencies;
    if (dependencies.length === 0) return;

    // 检查所有依赖是否完成
    const checkInterval = 100; // 100ms
    const maxWaitTime = this.config.taskTimeout;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const allCompleted = dependencies.every(depId =>
        completedResults.some(r => r.task.id === depId)
      );

      if (allCompleted) break;

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }

  /**
   * 生成任务摘要
   */
  private generateTaskSummary(task: SubTask): string {
    const parts: string[] = [];

    parts.push(`**Task:** ${task.description}`);
    parts.push(`**Status:** ${task.status}`);
    parts.push(`**Duration:** ${task.duration}ms`);

    if (task.tokenUsage) {
      parts.push(`**Tokens:** ${task.tokenUsage.total}`);
    }

    if (task.output?.error) {
      parts.push(`**Error:** ${task.output.error}`);
    } else if (task.output?.analysis) {
      parts.push(`**Analysis:** ${task.output.analysis.substring(0, 100)}...`);
    }

    return parts.join('\n');
  }

  /**
   * 构建执行摘要
   */
  private buildSummary(
    results: SubTaskResult[],
    totalDuration: number
  ): ParallelExecutionSummary {
    const successfulTasks = results.filter(r => r.success).length;
    const failedTasks = results.filter(r => !r.success).length;

    // 统计 Token 使用量
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    for (const result of results) {
      if (result.task.tokenUsage) {
        totalPromptTokens += result.task.tokenUsage.prompt;
        totalCompletionTokens += result.task.tokenUsage.completion;
      }
    }

    // 统计各 Agent 的执行时间
    const agentDurations: Record<AgentType, number> = {
      'code-analysis': 0,
      'architecture': 0,
      'implementation': 0,
      'testing': 0,
      'documentation': 0,
      'general': 0
    };

    for (const result of results) {
      if (result.task.duration) {
        agentDurations[result.task.agentType] += result.task.duration;
      }
    }

    return {
      totalTasks: results.length,
      successfulTasks,
      failedTasks,
      totalDuration,
      totalTokenUsage: {
        prompt: totalPromptTokens,
        completion: totalCompletionTokens,
        total: totalPromptTokens + totalCompletionTokens
      },
      agentDurations,
      results,
      timeline: this.timeline
    };
  }

  /**
   * 添加时间线事件
   */
  private addTimelineEvent(event: TimelineEvent): void {
    this.timeline.push(event);
  }

  /**
   * 取消执行
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * 获取配置
   */
  getConfig(): Required<ParallelExecutionConfig> {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ParallelExecutionConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      agentConfigs: {
        ...this.config.agentConfigs,
        ...config.agentConfigs
      }
    };
  }
}

/**
 * 默认任务分解器
 */
export class DefaultTaskDecomposer {
  /**
   * 将需求分解为子任务
   */
  async decompose(
    requirement: string,
    agentTypes: AgentType[],
    context?: any
  ): Promise<SubTask[]> {
    const tasks: SubTask[] = [];

    // 为每个 agent 类型创建子任务
    for (const agentType of agentTypes) {
      const task = this.createTaskForAgent(agentType, requirement, context);
      tasks.push(task);
    }

    // 设置依赖关系
    this.setupDependencies(tasks);

    return tasks;
  }

  /**
   * 为特定 agent 创建子任务
   */
  private createTaskForAgent(
    agentType: AgentType,
    requirement: string,
    context?: any
  ): SubTask {
    const description = this.getTaskDescription(agentType, requirement);
    const goal = this.getTaskGoal(agentType, requirement);
    const priority = this.getTaskPriority(agentType);
    const relatedFiles = this.getRelatedFiles(agentType, context);

    return {
      id: uuidv4(),
      description,
      agentType,
      status: SubTaskStatus.PENDING,
      input: {
        goal,
        context,
        relatedFiles,
        constraints: this.getConstraints(agentType)
      },
      dependencies: [],
      createdAt: new Date(),
      priority,
      retryCount: 0,
      maxRetries: 3
    };
  }

  /**
   * 获取任务描述
   */
  private getTaskDescription(agentType: AgentType, requirement: string): string {
    const descriptions: Record<AgentType, string> = {
      'code-analysis': `Analyze the codebase for: ${requirement}`,
      'architecture': `Design the architecture for: ${requirement}`,
      'implementation': `Implement the solution for: ${requirement}`,
      'testing': `Create tests for: ${requirement}`,
      'documentation': `Document the solution for: ${requirement}`,
      'general': `Complete the task: ${requirement}`
    };

    return descriptions[agentType];
  }

  /**
   * 获取任务目标
   */
  private getTaskGoal(agentType: AgentType, requirement: string): string {
    const goals: Record<AgentType, string> = {
      'code-analysis': 'Analyze existing code structure, patterns, and identify potential issues',
      'architecture': 'Design a scalable and maintainable solution architecture',
      'implementation': 'Implement the required functionality with clean and efficient code',
      'testing': 'Ensure code quality through comprehensive testing',
      'documentation': 'Create clear and comprehensive documentation',
      'general': 'Complete the assigned task efficiently and accurately'
    };

    return goals[agentType];
  }

  /**
   * 获取任务优先级
   */
  private getTaskPriority(agentType: AgentType): number {
    const priorities: Record<AgentType, number> = {
      'code-analysis': 10,
      'architecture': 9,
      'implementation': 8,
      'testing': 5,
      'documentation': 3,
      'general': 1
    };

    return priorities[agentType];
  }

  /**
   * 获取相关文件
   */
  private getRelatedFiles(agentType: AgentType, context?: any): string[] {
    if (context?.relatedFiles) {
      return context.relatedFiles;
    }

    // 根据 agent 类型返回默认文件模式
    const patterns: Record<AgentType, string[]> = {
      'code-analysis': ['src/**/*.ts', 'lib/**/*.ts'],
      'architecture': ['src/**/*.ts', 'package.json'],
      'implementation': ['src/**/*.ts'],
      'testing': ['**/*.test.ts', '**/*.spec.ts'],
      'documentation': ['README.md', 'docs/**/*.md'],
      'general': ['src/**/*']
    };

    return patterns[agentType] || [];
  }

  /**
   * 获取约束条件
   */
  private getConstraints(agentType: AgentType): string[] {
    const constraints: Record<AgentType, string[]> = {
      'code-analysis': [
        'Focus on code structure and patterns',
        'Identify potential issues and improvements'
      ],
      'architecture': [
        'Ensure scalability and maintainability',
        'Follow best practices and design patterns'
      ],
      'implementation': [
        'Write clean and efficient code',
        'Follow existing code style',
        'Include proper error handling'
      ],
      'testing': [
        'Write comprehensive test cases',
        'Ensure high code coverage'
      ],
      'documentation': [
        'Be clear and concise',
        'Include usage examples'
      ],
      'general': [
        'Complete the task efficiently',
        'Provide clear results'
      ]
    };

    return constraints[agentType];
  }

  /**
   * 设置依赖关系
   */
  private setupDependencies(tasks: SubTask[]): void {
    // 实现依赖于分析和架构
    const implementationTask = tasks.find(t => t.agentType === AgentType.IMPLEMENTATION);
    const analysisTask = tasks.find(t => t.agentType === AgentType.CODE_ANALYSIS);
    const architectureTask = tasks.find(t => t.agentType === AgentType.ARCHITECTURE);

    if (implementationTask && analysisTask) {
      implementationTask.dependencies.push(analysisTask.id);
    }

    if (implementationTask && architectureTask) {
      implementationTask.dependencies.push(architectureTask.id);
    }

    // 测试依赖于实现
    const testingTask = tasks.find(t => t.agentType === AgentType.TESTING);
    if (testingTask && implementationTask) {
      testingTask.dependencies.push(implementationTask.id);
    }

    // 文档依赖于实现和测试
    const documentationTask = tasks.find(t => t.agentType === AgentType.DOCUMENTATION);
    if (documentationTask && implementationTask) {
      documentationTask.dependencies.push(implementationTask.id);
    }

    if (documentationTask && testingTask) {
      documentationTask.dependencies.push(testingTask.id);
    }
  }
}
