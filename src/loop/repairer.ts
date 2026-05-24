/**
 * 修复器 (Repairer)
 *
 * 职责：基于观测结果，生成修复方案
 * 这是四步循环的第四步
 */

import { callAI } from '../ai';
import { Config } from '../config';
import { RepairResult, Repair, Issue } from './types';
import chalk from 'chalk';

export class Repairer {
  constructor(
    private config: Config,
    private projectRoot: string
  ) {}

  /**
   * 修复：基于观测结果，生成修复方案
   *
   * @param requirement 原始需求
   * @param projectInfo 当前项目状态
   * @param issues 发现的问题
   * @param gaps 与预期的差距
   * @returns 修复结果
   */
  async repair(
    requirement: string,
    projectInfo: Record<string, string>,
    issues: Issue[],
    gaps: string[]
  ): Promise<RepairResult> {
    console.log(chalk.cyan('\n🔧 步骤 4: 修复\n'));
    console.log(chalk.gray('基于观测结果，生成修复方案...\n'));

    const prompt = this.buildRepairPrompt(requirement, projectInfo, issues, gaps);

    try {
      const response = await callAI(
        this.config,
        projectInfo,
        prompt,
        'plan',
        undefined,
        undefined,
        undefined,
        undefined,
        this.projectRoot
      );

      const result = this.parseRepairResponse(response);

      // 显示修复结果
      this.displayRepairResult(result);

      return result;

    } catch (error: any) {
      console.error(chalk.red('❌ 修复方案生成失败：'), error.message);

      // 降级：生成简单修复方案
      return this.fallbackRepair(issues);
    }
  }

  /**
   * 构建修复提示词
   */
  private buildRepairPrompt(
    requirement: string,
    projectInfo: Record<string, string>,
    issues: Issue[],
    gaps: string[]
  ): string {
    const issuesSummary = issues.map((issue, idx) => {
      return `${idx + 1}. [${issue.type.toUpperCase()} 严重度:${issue.severity}] ${issue.description}
   位置：${issue.location || '未知'}
   建议：${issue.suggestedFix || '无'}`;
    }).join('\n');

    return `你是 KODE 的修复器。你的任务是分析问题，生成修复方案。

**原始需求**：
${requirement}

**发现的问题**：
${issuesSummary || '无问题'}

**与预期的差距**：
${gaps.join('\n') || '无差距'}

**当前项目状态**：
${JSON.stringify(projectInfo, null, 2).substring(0, 1500)}...

**你的任务**：
1. 分析每个问题的根本原因
2. 生成具体的修复方案
3. 决定是否需要重新规划整个方案
4. 预测修复后的效果

**返回格式**（JSON）：
{
  "type": "task",
  "todo": ["修复步骤1", "修复步骤2", ...],
  "actions": [
    {"type": "modify", "path": "文件", "oldContent": "...", "newContent": "..."},
    {"type": "run", "command": "命令"},
    ...
  ],
  "needsRepair": true,
  "repairs": [
    {
      "type": "fix|retry|skip|replan|complete",
      "targetAction": {"type": "...", ...},
      "repairActions": [...],
      "explanation": "修复说明"
    }
  ],
  "reasoning": "修复理由和逻辑",
  "expectedOutcome": "修复后的预期效果",
  "shouldReplan": false
}

**修复类型说明**：
- fix: 修复错误（修改文件、修正代码）
- retry: 重试失败的操作
- skip: 跳过不关键的操作
- replan: 重新规划整个方案
- complete: 已经完成，无需修复

**重要**：
- 优先修复严重度高的问题（severity >= 4）
- 如果问题太多或太严重，考虑重新规划
- 每个修复方案都要有明确的理由
- 预测修复后的效果`;
  }

  /**
   * 解析修复响应
   */
  private parseRepairResponse(response: any): RepairResult {
    const actions = response.actions || [];
    const repairs: Repair[] = response.repairs || [];
    const reasoning = response.reasoning || '基于观测结果生成修复方案';
    const expectedOutcome = response.expectedOutcome || '修复问题，满足需求';
    const shouldReplan = response.shouldReplan || false;

    // 如果没有 repairs，根据 actions 生成
    let finalRepairs = repairs;
    if (finalRepairs.length === 0 && actions.length > 0) {
      finalRepairs = [{
        type: 'fix',
        repairActions: actions,
        explanation: '执行修复操作',
      }];
    }

    return {
      needsRepair: true,
      repairs: finalRepairs,
      reasoning,
      expectedOutcome,
      shouldReplan,
    };
  }

  /**
   * 降级修复（AI调用失败时）
   */
  private fallbackRepair(issues: Issue[]): RepairResult {
    console.log(chalk.yellow('⚠️  使用降级修复模式\n'));

    const repairs: Repair[] = [];

    // 为每个问题生成简单修复
    issues.forEach(issue => {
      if (issue.type === 'error' && issue.severity >= 4) {
        repairs.push({
          type: 'fix',
          repairActions: [],
          explanation: `修复错误：${issue.description}`,
        });
      }
    });

    // 如果有严重问题，建议重新规划
    const criticalIssues = issues.filter(i => i.severity >= 4);
    const shouldReplan = criticalIssues.length > 2;

    return {
      needsRepair: repairs.length > 0,
      repairs,
      reasoning: '基于问题列表生成修复方案',
      expectedOutcome: '修复发现问题',
      shouldReplan,
    };
  }

  /**
   * 显示修复结果
   */
  private displayRepairResult(result: RepairResult): void {
    // 是否需要修复
    if (!result.needsRepair) {
      console.log(chalk.green('✅ 无需修复，任务完成！\n'));
      return;
    }

    // 修复理由
    console.log(chalk.cyan('💭 修复理由：'));
    console.log(chalk.gray(`  ${result.reasoning}`));

    // 修复方案
    if (result.repairs.length > 0) {
      console.log(chalk.cyan(`\n🔧 修复方案 (${result.repairs.length})：`));
      result.repairs.forEach((repair, idx) => {
        const typeIcon = {
          fix: '🔨',
          retry: '🔄',
          skip: '⏭️ ',
          replan: '📋',
          complete: '✅',
        }[repair.type] || '🔧';

        console.log(chalk.gray(`  ${idx + 1}. ${typeIcon} [${repair.type.toUpperCase()}]`));
        console.log(chalk.gray(`     ${repair.explanation}`));

        if (repair.repairActions.length > 0) {
          console.log(chalk.gray(`     操作：${repair.repairActions.length} 个`));
        }
      });
    }

    // 是否重新规划
    if (result.shouldReplan) {
      console.log(chalk.yellow(`\n📋 建议重新规划整个方案`));
      console.log(chalk.yellow(`  原因：当前方案存在根本性问题`));
    }

    // 预期效果
    console.log(chalk.cyan(`\n🎯 预期效果：`));
    console.log(chalk.gray(`  ${result.expectedOutcome}`));

    console.log(chalk.gray('\n' + '─'.repeat(50)));
  }
}
