/**
 * ExecutionSubAgent - 执行阶段的 SubAgent
 *
 * 使用所有可用工具执行计划
 */

import chalk from 'chalk';
import { BaseSubAgent } from './base-subagent';
import {
  SubAgentConfig,
  SubAgentContext,
  SubAgentResult,
  ExecutionPlan,
} from './types';

/**
 * ExecutionSubAgent
 *
 * 负责执行 PlanningSubAgent 生成的计划
 * 可以使用所有工具
 */
export class ExecutionSubAgent extends BaseSubAgent {
  protected getSubAgentConfig(): SubAgentConfig {
    return {
      id: 'execution-subagent',
      name: 'Execution SubAgent',
      description: 'Executes plans by creating/modifying files and running commands',
      systemPrompt: `You are an execution specialist.

Your job is to implement the plan provided by the Planning SubAgent.

**YOUR ROLE**
1. Review the plan from the Planning SubAgent
2. Execute each action in the plan
3. Use the appropriate tools for each action
4. Return a summary when done

**AVAILABLE TOOLS**
- create_file: Create new files with content
- modify_file: Update existing files
- delete_file: Delete files
- run_command: Execute shell commands (npm, git, etc.)
- verify: Run tests and checks

**EXECUTION STRATEGY**
- Follow the plan step-by-step
- Use the most appropriate tool for each action
- Be efficient and direct
- Stop when all actions are completed
- Report any errors or issues

**OUTPUT FORMAT**
When you finish executing all actions, provide a summary:
\`\`
✅ Execution completed

**Summary:**
- Files created: X
- Files modified: Y
- Commands run: Z
- Total actions: N

**Details:**
- Brief description of what was done
- Any issues encountered
- Next steps (if applicable)
\`\`

**IMPORTANT**
- Execute all planned actions
- Be careful with destructive operations (delete, modify)
- Verify your work when possible
- Return a clear summary when done`,
      allowedTools: [
        'create_file',
        'modify_file',
        'delete_file',
        'run_command',
        'verify',
      ],
      maxIterations: 15,
      temperature: 0.3, // 更低的温度，更确定的执行
    };
  }

  /**
   * 执行任务
   *
   * @param requirement 原始用户需求
   * @param plan 可选的计划对象
   * @returns 执行结果
   */
  async execute(requirement: string, plan?: ExecutionPlan): Promise<SubAgentResult> {
    console.log(chalk.cyan('\n⚡ Phase 2: Executing (using tools)...'));
    console.log(chalk.gray('─'.repeat(50)));

    // 构建提示词
    let prompt = requirement;

    if (plan) {
      prompt = this.buildPromptWithPlan(requirement, plan);
    }

    // 创建初始历史
    const history = [
      {
        role: 'user',
        content: prompt,
      },
    ];

    // 执行 Function Calling
    const result = await this.executeWithFunctionCalling(requirement, history);

    console.log(chalk.gray('─'.repeat(50)));

    // 显示执行摘要
    this.displayExecutionSummary(result);

    return result;
  }

  /**
   * 构建包含计划的提示词
   */
  private buildPromptWithPlan(requirement: string, plan: ExecutionPlan): string {
    let prompt = `**Original Requirement**: ${requirement}\n\n`;

    prompt += `**Plan from Planning SubAgent**:\n\n`;
    prompt += `**TODO List**:\n`;
    plan.todo.forEach((item, idx) => {
      prompt += `${idx + 1}. ${item}\n`;
    });

    if (plan.actions && plan.actions.length > 0) {
      prompt += `\n**Planned Actions**:\n`;
      plan.actions.forEach((action, idx) => {
        prompt += `${idx + 1}. [${action.type.toUpperCase()}] ${action.description}`;
        if (action.path) {
          prompt += ` (Path: ${action.path})`;
        }
        if (action.command) {
          prompt += ` (Command: ${action.command})`;
        }
        prompt += `\n`;
      });
    }

    prompt += `\n**Your Task**: Execute this plan using the available tools.\n`;

    return prompt;
  }

  /**
   * 显示执行摘要
   */
  private displayExecutionSummary(result: SubAgentResult): void {
    console.log(chalk.magenta('\n⚡ Execution Summary:'));
    console.log(chalk.gray('─'.repeat(40)));

    console.log(chalk.gray(`  Status: ${result.success ? '✅ Success' : '❌ Failed'}`));
    console.log(chalk.gray(`  Tools called: ${result.toolCallsExecuted}`));
    console.log(chalk.gray(`  Tokens used: ${result.tokensUsed.total}`));
    console.log(chalk.gray(`  Duration: ${result.duration}ms`));

    if (result.output) {
      // 截断过长的输出
      const output =
        result.output.length > 500
          ? result.output.slice(0, 500) + '...'
          : result.output;
      console.log(chalk.gray(`\n  Output:\n${output}`));
    }

    console.log(chalk.gray('─'.repeat(40)));
    console.log('');
  }
}
