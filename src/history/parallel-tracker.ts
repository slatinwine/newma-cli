/**
 * Parallel Execution Tracker
 * 跟踪并行 subagent 执行的详细历史记录
 */

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  SubTask,
  SubTaskStatus,
  SubTaskResult,
  ParallelExecutionSummary,
  TimelineEvent,
  ToolCallRecord
} from '../agents/subagent/subtask';

/**
 * 并行执行记录
 */
export interface ParallelExecutionRecord {
  /**
   * 执行 ID
   */
  id: string;

  /**
   * 执行时间戳
   */
  timestamp: Date;

  /**
   * 原始需求
   */
  requirement: string;

  /**
   * 项目根目录
   */
  projectRoot: string;

  /**
   * 执行摘要
   */
  summary: ParallelExecutionSummary;

  /**
   * 所有子任务详情
   */
  tasks: SubTask[];

  /**
   * 执行状态
   */
  status: 'running' | 'completed' | 'failed' | 'cancelled';

  /**
   * 错误信息（如果失败）
   */
  error?: string;

  /**
   * 执行时长（毫秒）
   */
  duration: number;
}

/**
 * Subagent 执行详情
 */
export interface SubagentExecutionDetail {
  /**
   * Subtask ID
   */
  taskId: string;

  /**
   * Agent 类型
   */
  agentType: string;

  /**
   * 执行状态
   */
  status: SubTaskStatus;

  /**
   * 开始时间
   */
  startTime: Date;

  /**
   * 结束时间
   */
  endTime?: Date;

  /**
   * 执行时长
   */
  duration?: number;

  /**
   * 完整对话历史
   */
  conversationHistory: {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    timestamp: Date;
  }[];

  /**
   * 推理过程
   */
  reasoning: string[];

  /**
   * 工具调用记录
   */
  toolCalls: ToolCallRecord[];

  /**
   * Token 使用统计
   */
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };

  /**
   * 输出结果
   */
  output?: any;

  /**
   * 错误信息
   */
  error?: string;
}

export class ParallelExecutionTracker {
  private records: ParallelExecutionRecord[] = [];
  private currentRecord?: ParallelExecutionRecord;
  private storageDir: string;

  constructor(projectRoot: string) {
    this.storageDir = path.join(projectRoot, '.memo', 'parallel-executions');
    this.ensureStorageDir();
  }

  /**
   * 开始跟踪新的并行执行
   */
  async startExecution(requirement: string, projectRoot: string, tasks: SubTask[]): Promise<string> {
    const recordId = uuidv4();

    this.currentRecord = {
      id: recordId,
      timestamp: new Date(),
      requirement,
      projectRoot,
      summary: {
        totalTasks: tasks.length,
        successfulTasks: 0,
        failedTasks: 0,
        totalDuration: 0,
        totalTokenUsage: {
          prompt: 0,
          completion: 0,
          total: 0
        },
        agentDurations: {
          'code-analysis': 0,
          'architecture': 0,
          'implementation': 0,
          'testing': 0,
          'documentation': 0,
          'general': 0
        },
        results: [],
        timeline: []
      },
      tasks,
      status: 'running',
      duration: 0
    };

    // 记录开始事件
    this.addTimelineEvent({
      timestamp: new Date(),
      type: 'execution_started',
      description: `Started parallel execution with ${tasks.length} tasks`
    });

    this.records.push(this.currentRecord);

    return recordId;
  }

  /**
   * 记录子任务开始
   */
  async recordTaskStart(taskId: string): Promise<void> {
    if (!this.currentRecord) {
      throw new Error('No active execution record');
    }

    const task = this.currentRecord.tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = SubTaskStatus.RUNNING;
    task.startedAt = new Date();

    this.addTimelineEvent({
      timestamp: new Date(),
      type: 'task_started',
      taskId,
      agentType: task.agentType,
      description: `Started task: ${task.description}`
    });
  }

  /**
   * 记录子任务完成
   */
  async recordTaskComplete(
    taskId: string,
    result: SubTaskResult
  ): Promise<void> {
    if (!this.currentRecord) {
      throw new Error('No active execution record');
    }

    const task = this.currentRecord.tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = result.success ? SubTaskStatus.COMPLETED : SubTaskStatus.FAILED;
    task.completedAt = new Date();
    task.duration = task.completedAt.getTime() - (task.startedAt?.getTime() || 0);
    task.output = result.task.output;

    this.addTimelineEvent({
      timestamp: new Date(),
      type: result.success ? 'task_completed' : 'task_failed',
      taskId,
      agentType: task.agentType,
      description: result.success
        ? `Completed task: ${task.description}`
        : `Failed task: ${result.summary}`
    });

    // 更新摘要
    if (result.success) {
      this.currentRecord.summary.successfulTasks++;
    } else {
      this.currentRecord.summary.failedTasks++;
    }

    if (task.tokenUsage) {
      this.currentRecord.summary.totalTokenUsage.prompt += task.tokenUsage.prompt;
      this.currentRecord.summary.totalTokenUsage.completion += task.tokenUsage.completion;
      this.currentRecord.summary.totalTokenUsage.total += task.tokenUsage.total;
    }

    if (task.duration) {
      this.currentRecord.summary.agentDurations[task.agentType] += task.duration;
    }

    this.currentRecord.summary.results.push(result);
  }

  /**
   * 记录对话历史
   */
  async recordConversation(
    taskId: string,
    role: 'system' | 'user' | 'assistant' | 'tool',
    content: string
  ): Promise<void> {
    if (!this.currentRecord) {
      throw new Error('No active execution record');
    }

    const task = this.currentRecord.tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // 初始化对话历史（如果不存在）
    if (!task.output) {
      task.output = {
        rawResponse: {
          conversationHistory: []
        }
      };
    }
    if (!task.output.rawResponse) {
      task.output.rawResponse = {
        conversationHistory: []
      };
    }

    task.output.rawResponse.conversationHistory.push({
      role,
      content,
      timestamp: new Date()
    });
  }

  /**
   * 记录工具调用
   */
  async recordToolCall(
    taskId: string,
    toolCall: ToolCallRecord
  ): Promise<void> {
    if (!this.currentRecord) {
      throw new Error('No active execution record');
    }

    const task = this.currentRecord.tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // 初始化工具调用记录（如果不存在）
    if (!task.toolCalls) {
      task.toolCalls = [];
    }

    task.toolCalls.push(toolCall);
  }

  /**
   * 记录推理过程
   */
  async recordReasoning(taskId: string, reasoning: string[]): Promise<void> {
    if (!this.currentRecord) {
      throw new Error('No active execution record');
    }

    const task = this.currentRecord.tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.reasoning = reasoning;
  }

  /**
   * 完成执行
   */
  async completeExecution(): Promise<ParallelExecutionRecord> {
    if (!this.currentRecord) {
      throw new Error('No active execution record');
    }

    this.currentRecord.status = 'completed';
    this.currentRecord.duration = Date.now() - this.currentRecord.timestamp.getTime();
    this.currentRecord.summary.totalDuration = this.currentRecord.duration;

    this.addTimelineEvent({
      timestamp: new Date(),
      type: 'execution_finished',
      description: `Execution completed: ${this.currentRecord.summary.successfulTasks}/${this.currentRecord.summary.totalTasks} tasks succeeded`
    });

    // 持久化记录
    await this.persistRecord(this.currentRecord);

    const record = this.currentRecord;
    this.currentRecord = undefined;

    return record;
  }

  /**
   * 记录执行失败
   */
  async failExecution(error: string): Promise<void> {
    if (!this.currentRecord) {
      throw new Error('No active execution record');
    }

    this.currentRecord.status = 'failed';
    this.currentRecord.error = error;
    this.currentRecord.duration = Date.now() - this.currentRecord.timestamp.getTime();

    this.addTimelineEvent({
      timestamp: new Date(),
      type: 'execution_finished',
      description: `Execution failed: ${error}`
    });

    await this.persistRecord(this.currentRecord);
    this.currentRecord = undefined;
  }

  /**
   * 添加时间线事件
   */
  private addTimelineEvent(event: TimelineEvent): void {
    if (!this.currentRecord) {
      return;
    }

    this.currentRecord.summary.timeline.push(event);
  }

  /**
   * 持久化记录到文件
   */
  private async persistRecord(record: ParallelExecutionRecord): Promise<void> {
    try {
      await this.ensureStorageDir();

      const filename = `execution-${record.id}.json`;
      const filepath = path.join(this.storageDir, filename);

      await fs.writeFile(
        filepath,
        JSON.stringify(record, null, 2),
        'utf-8'
      );

      // 同时保存一个最新的记录
      const latestPath = path.join(this.storageDir, 'latest.json');
      await fs.writeFile(latestPath, JSON.stringify(record, null, 2), 'utf-8');

    } catch (error) {
      console.error('Failed to persist parallel execution record:', error);
    }
  }

  /**
   * 确保存储目录存在
   */
  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create storage directory:', error);
    }
  }

  /**
   * 获取所有记录
   */
  getAllRecords(): ParallelExecutionRecord[] {
    return [...this.records];
  }

  /**
   * 获取当前记录
   */
  getCurrentRecord(): ParallelExecutionRecord | undefined {
    return this.currentRecord;
  }

  /**
   * 根据 ID 获取记录
   */
  getRecordById(id: string): ParallelExecutionRecord | undefined {
    return this.records.find(r => r.id === id);
  }

  /**
   * 从文件加载记录
   */
  async loadRecords(): Promise<void> {
    try {
      await this.ensureStorageDir();

      const files = await fs.readdir(this.storageDir);
      const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'latest.json');

      for (const file of jsonFiles) {
        const filepath = path.join(this.storageDir, file);
        const content = await fs.readFile(filepath, 'utf-8');
        const record = JSON.parse(content) as ParallelExecutionRecord;

        // 转换日期字符串回 Date 对象
        record.timestamp = new Date(record.timestamp);
        record.summary.timeline.forEach(event => {
          event.timestamp = new Date(event.timestamp);
        });

        this.records.push(record);
      }

    } catch (error) {
      console.error('Failed to load parallel execution records:', error);
    }
  }

  /**
   * 清理旧记录（保留最近 N 条）
   */
  async cleanupOldRecords(keepCount: number = 100): Promise<void> {
    try {
      const sortedRecords = [...this.records].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );

      const toDelete = sortedRecords.slice(keepCount);

      for (const record of toDelete) {
        const filename = `execution-${record.id}.json`;
        const filepath = path.join(this.storageDir, filename);

        try {
          await fs.unlink(filepath);
        } catch {
          // 忽略删除失败的文件
        }

        this.records = this.records.filter(r => r.id !== record.id);
      }

    } catch (error) {
      console.error('Failed to cleanup old records:', error);
    }
  }

  /**
   * 格式化记录为 LLM 可读格式
   */
  formatRecordForLLM(record: ParallelExecutionRecord): string {
    const lines: string[] = [];

    lines.push(`## Parallel Execution: ${record.id}`);
    lines.push(`**Requirement:** ${record.requirement}`);
    lines.push(`**Status:** ${record.status}`);
    lines.push(`**Duration:** ${record.duration}ms`);
    lines.push('');

    lines.push('### Summary');
    lines.push(`- Total Tasks: ${record.summary.totalTasks}`);
    lines.push(`- Successful: ${record.summary.successfulTasks}`);
    lines.push(`- Failed: ${record.summary.failedTasks}`);
    lines.push(`- Total Tokens: ${record.summary.totalTokenUsage.total}`);
    lines.push('');

    lines.push('### Task Breakdown');
    for (const task of record.tasks) {
      lines.push(`#### ${task.agentType}: ${task.description}`);
      lines.push(`- Status: ${task.status}`);
      lines.push(`- Duration: ${task.duration}ms`);

      if (task.reasoning && task.reasoning.length > 0) {
        lines.push('- Reasoning:');
        task.reasoning.forEach(r => lines.push(`  - ${r}`));
      }

      if (task.toolCalls && task.toolCalls.length > 0) {
        lines.push(`- Tool Calls (${task.toolCalls.length}):`);
        task.toolCalls.forEach(call => {
          lines.push(`  - ${call.tool} (${call.duration}ms) - ${call.success ? '✓' : '✗'}`);
        });
      }

      lines.push('');
    }

    lines.push('### Timeline');
    for (const event of record.summary.timeline) {
      const time = event.timestamp.toISOString();
      lines.push(`- ${time}: ${event.description}`);
    }

    return lines.join('\n');
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageDuration: number;
    totalTokensUsed: number;
  } {
    const completed = this.records.filter(r => r.status === 'completed');

    return {
      totalExecutions: this.records.length,
      successfulExecutions: completed.filter(r => r.status === 'completed').length,
      failedExecutions: this.records.filter(r => r.status === 'failed').length,
      averageDuration: completed.reduce((sum, r) => sum + r.duration, 0) / (completed.length || 1),
      totalTokensUsed: this.records.reduce((sum, r) => sum + r.summary.totalTokenUsage.total, 0)
    };
  }
}
