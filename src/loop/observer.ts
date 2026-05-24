/**
 * 观测器 (Observer)
 *
 * 职责：分析执行结果，判断是否满足需求
 * 这是四步循环的第三步
 */

import { callAI } from '../ai';
import { Config } from '../config';
import { ObservationResult, ExecutionResult, Issue } from './types';
import chalk from 'chalk';

export class Observer {
  constructor(
    private config: Config,
    private projectRoot: string
  ) {}

  /**
   * 观测：分析执行结果，判断是否需要修复
   *
   * @param requirement 原始需求
   * @param projectInfo 当前项目状态
   * @param executionResult 执行结果
   * @param expectedOutcome 预期结果（来自推理阶段）
   * @returns 观测结果
   */
  async observe(
    requirement: string,
    projectInfo: Record<string, string>,
    executionResult: ExecutionResult,
    expectedOutcome: string
  ): Promise<ObservationResult> {
    console.log(chalk.cyan('\n👀 步骤 3: 观测\n'));
    console.log(chalk.gray('分析执行结果，判断是否满足需求...\n'));

    const prompt = this.buildObservationPrompt(
      requirement,
      projectInfo,
      executionResult,
      expectedOutcome
    );

    try {
      const response = await callAI(
        this.config,
        projectInfo,
        prompt,
        'verify',
        undefined,
        undefined,
        undefined,
        undefined,
        this.projectRoot
      );

      const result = this.parseObservationResponse(response);

      // 显示观测结果
      this.displayObservationResult(result);

      return result;

    } catch (error: any) {
      console.error(chalk.red('❌ 观测失败：'), error.message);

      // 降级：基于执行结果做简单判断
      return this.fallbackObservation(executionResult);
    }
  }

  /**
   * 构建观测提示词
   */
  private buildObservationPrompt(
    requirement: string,
    projectInfo: Record<string, string>,
    executionResult: ExecutionResult,
    expectedOutcome: string
  ): string {
    // 格式化执行结果
    const executionSummary = this.formatExecutionResult(executionResult);

    return `你是 KODE 的观测器。你的任务是分析执行结果，判断需求是否被满足。

**原始需求**：
${requirement}

**预期结果**：
${expectedOutcome}

**实际执行结果**：
${executionSummary}

**当前项目状态**：
${JSON.stringify(projectInfo, null, 2).substring(0, 1500)}...

**你的任务**：
1. 分析执行结果是否满足需求
2. 识别所有问题、错误和警告
3. 找出与预期的差距
4. 判断是否需要修复

**返回格式**（JSON）：
{
  "type": "task",
  "todo": ["观测项1", "观测项2", ...],
  "actions": [],
  "satisfied": true/false,
  "observations": ["发现1", "发现2", ...],
  "issues": [
    {
      "type": "error|warning|inefficient|missing|conflict",
      "severity": 1-5,
      "description": "问题描述",
      "location": "文件路径",
      "suggestedFix": "修复建议"
    }
  ],
  "gaps": ["差距1", "差距2"],
  "confidence": 0.8,
  "recommendation": "continue|repair|replan|complete"
}

**重要**：
- 仔细分析，不要遗漏任何问题
- 严重程度：5=致命，4=严重，3=中等，2=轻微，1=提示
- 如果有错误，必须标记为需要修复
- 如果完全满足需求，标记为 complete`;
  }

  /**
   * 格式化执行结果
   */
  private formatExecutionResult(result: ExecutionResult): string {
    const lines: string[] = [];

    lines.push(`执行状态：${result.success ? '✅ 成功' : '❌ 失败'}`);
    lines.push(`执行操作：${result.executedActions.length} 个`);
    lines.push(`耗时：${(result.duration / 1000).toFixed(2)}s`);

    if (result.errors.length > 0) {
      lines.push(`\n错误 (${result.errors.length})：`);
      result.errors.forEach((err, idx) => {
        lines.push(`  ${idx + 1}. [${err.type}] ${err.message}`);
      });
    }

    if (result.outputs.length > 0) {
      lines.push(`\n输出 (${result.outputs.length})：`);
      result.outputs.slice(0, 3).forEach((out, idx) => {
        lines.push(`  ${idx + 1}. ${out.substring(0, 100)}${out.length > 100 ? '...' : ''}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * 解析观测响应
   */
  private parseObservationResponse(response: any): ObservationResult {
    const satisfied = response.satisfied ?? false;
    const observations = response.observations || [];
    const issues: Issue[] = response.issues || [];
    const gaps = response.gaps || [];
    const confidence = response.confidence || 0.5;
    const recommendation = response.recommendation || this.inferRecommendation(satisfied, issues);

    return {
      satisfied,
      observations,
      issues,
      gaps,
      confidence,
      recommendation,
    };
  }

  /**
   * 推断建议
   */
  private inferRecommendation(satisfied: boolean, issues: Issue[]): 'continue' | 'repair' | 'replan' | 'complete' {
    if (satisfied) {
      return 'complete';
    }

    const criticalIssues = issues.filter(i => i.severity >= 4);
    if (criticalIssues.length > 0) {
      return 'repair';
    }

    const manyIssues = issues.filter(i => i.severity >= 3);
    if (manyIssues.length > 3) {
      return 'replan';
    }

    return issues.length > 0 ? 'repair' : 'continue';
  }

  /**
   * 降级观测（AI调用失败时）
   */
  private fallbackObservation(executionResult: ExecutionResult): ObservationResult {
    console.log(chalk.yellow('⚠️  使用降级观测模式\n'));

    const issues: Issue[] = [];
    const observations: string[] = [];

    // 检查错误
    if (executionResult.errors.length > 0) {
      executionResult.errors.forEach(err => {
        issues.push({
          type: err.type === 'runtime' || err.type === 'syntax' ? 'error' : 'warning',
          severity: err.type === 'syntax' ? 5 : 4,
          description: err.message,
          suggestedFix: '修复错误后重试',
        });
        observations.push(`发现错误：${err.message}`);
      });
    }

    // 检查失败的操作
    const failedActions = executionResult.executedActions.filter(a => a.status === 'failed');
    if (failedActions.length > 0) {
      failedActions.forEach(action => {
        issues.push({
          type: 'error',
          severity: 4,
          description: `操作失败：${JSON.stringify(action.action)}`,
          suggestedFix: '检查操作参数并重试',
        });
      });
    }

    const satisfied = executionResult.success && executionResult.errors.length === 0;

    return {
      satisfied,
      observations: observations.length > 0 ? observations : ['执行完成'],
      issues,
      gaps: satisfied ? [] : ['需求未完全满足'],
      confidence: 0.6,
      recommendation: satisfied ? 'complete' : 'repair',
    };
  }

  /**
   * 显示观测结果
   */
  private displayObservationResult(result: ObservationResult): void {
    // 满足状态
    const statusIcon = result.satisfied ? '✅' : '❌';
    const statusText = result.satisfied ? '需求已满足' : '需求未满足';
    console.log(chalk.cyan(`${statusIcon} 状态：${statusText}`));

    // 观测发现
    if (result.observations.length > 0) {
      console.log(chalk.cyan(`\n📋 观测发现：`));
      result.observations.forEach((obs, idx) => {
        console.log(chalk.gray(`  ${idx + 1}. ${obs}`));
      });
    }

    // 问题列表
    if (result.issues.length > 0) {
      console.log(chalk.yellow(`\n⚠️  发现问题 (${result.issues.length})：`));
      result.issues.forEach((issue, idx) => {
        const severityColor = issue.severity >= 4 ? 'red' : issue.severity >= 3 ? 'yellow' : 'white';
        console.log(chalk[severityColor](
          `  ${idx + 1}. [${issue.type.toUpperCase()}] ${issue.description}`
        ));
        if (issue.suggestedFix) {
          console.log(chalk.gray(`     💡 ${issue.suggestedFix}`));
        }
      });
    }

    // 差距
    if (result.gaps.length > 0) {
      console.log(chalk.yellow(`\n📊 与预期的差距：`));
      result.gaps.forEach((gap, idx) => {
        console.log(chalk.gray(`  ${idx + 1}. ${gap}`));
      });
    }

    // 建议
    let recMessage = `\n💡 建议：${result.recommendation.toUpperCase()}`;
    if (result.recommendation === 'complete') {
      console.log(chalk.green(recMessage));
    } else if (result.recommendation === 'repair') {
      console.log(chalk.yellow(recMessage));
    } else if (result.recommendation === 'replan') {
      console.log(chalk.red(recMessage));
    } else {
      console.log(chalk.cyan(recMessage));
    }

    // 置信度
    let confMessage = `📊 置信度：${(result.confidence * 100).toFixed(0)}%`;
    if (result.confidence > 0.7) {
      console.log(chalk.green(confMessage));
    } else if (result.confidence > 0.4) {
      console.log(chalk.yellow(confMessage));
    } else {
      console.log(chalk.red(confMessage));
    }

    console.log(chalk.gray('\n' + '─'.repeat(50)));
  }
}
