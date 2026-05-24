/**
 * SubAgentCoordinator - Subagent 系统协调器
 *
 * 协调 PlanningSubAgent 和 ExecutionSubAgent 的两阶段执行流程
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import { PlanningSubAgent } from './planning-subagent';
import { ExecutionSubAgent } from './execution-subagent';
import {
  SubAgentContext,
  SubAgentCoordinatorResult,
  SubAgentExecutionOptions,
} from './types';

/**
 * SubAgent 协调器
 *
 * 负责协调整个两阶段执行流程
 */
export class SubAgentCoordinator {
  private planningSubAgent: PlanningSubAgent;
  private executionSubAgent: ExecutionSubAgent;
  private context: SubAgentContext;

  constructor(context: SubAgentContext) {
    this.context = context;
    this.planningSubAgent = new PlanningSubAgent(context);
    this.executionSubAgent = new ExecutionSubAgent(context);
  }

  /**
   * 执行完整的两阶段流程
   *
   * @param requirement 用户需求
   * @param options 执行选项
   * @returns 协调器结果
   */
  async execute(
    requirement: string,
    options?: SubAgentExecutionOptions
  ): Promise<SubAgentCoordinatorResult> {
    const startTime = Date.now();

    console.log(chalk.cyan('\n🤖 SubAgent System Starting...'));
    console.log(chalk.gray('═'.repeat(50)));
    console.log(chalk.gray(`Requirement: ${requirement}`));
    console.log(chalk.gray('═'.repeat(50)));

    // Phase 1: Planning
    const planningResult = await this.planningSubAgent.execute(requirement);

    if (!planningResult.success) {
      console.log(chalk.red('\n❌ Planning phase failed!\n'));
      return {
        planningResult,
        totalDuration: Date.now() - startTime,
      };
    }

    // 获取计划
    const plan = planningResult.metadata?.plan;

    // 用户确认
    if (!options?.skipConfirmation) {
      const confirmed = await this.promptForConfirmation();

      if (!confirmed) {
        console.log(chalk.yellow('\n⚠️  Execution cancelled by user.\n'));
        return {
          planningResult,
          totalDuration: Date.now() - startTime,
        };
      }
    }

    // Phase 2: Execution
    const executionResult = await this.executionSubAgent.execute(requirement, plan);

    // 显示总结果
    this.displayFinalResult({
      planningResult,
      executionResult,
      totalDuration: Date.now() - startTime,
    });

    return {
      planningResult,
      executionResult,
      totalDuration: Date.now() - startTime,
    };
  }

  /**
   * 提示用户确认
   */
  private async promptForConfirmation(): Promise<boolean> {
    console.log('');

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Continue to execution phase?',
        choices: [
          { name: '✅ Yes, execute the plan', value: 'yes' },
          { name: '❌ No, cancel execution', value: 'no' },
          { name: '📝 View plan details', value: 'view' },
        ],
        default: 'yes',
      },
    ]);

    if (action === 'view') {
      // TODO: 显示详细的计划信息
      console.log(chalk.gray('\n📋 Plan details:\n'));
      console.log(chalk.gray('(Plan details feature coming soon)\n'));

      // 重新提示
      return await this.promptForConfirmation();
    }

    return action === 'yes';
  }

  /**
   * 显示最终结果
   */
  private displayFinalResult(result: SubAgentCoordinatorResult): void {
    console.log(chalk.cyan('\n🎉 SubAgent Execution Completed!'));
    console.log(chalk.gray('═'.repeat(50)));

    // Planning 阶段统计
    console.log(chalk.magenta('\n📊 Planning Phase:'));
    console.log(chalk.gray(`  Status: ${result.planningResult.success ? '✅ Success' : '❌ Failed'}`));
    console.log(chalk.gray(`  Duration: ${result.planningResult.duration}ms`));
    console.log(chalk.gray(`  Tokens: ${result.planningResult.tokensUsed.total}`));

    // Execution 阶段统计
    if (result.executionResult) {
      console.log(chalk.magenta('\n⚡ Execution Phase:'));
      console.log(
        chalk.gray(
          `  Status: ${result.executionResult.success ? '✅ Success' : '❌ Failed'}`
        )
      );
      console.log(
        chalk.gray(`  Tools called: ${result.executionResult.toolCallsExecuted}`)
      );
      console.log(
        chalk.gray(`  Duration: ${result.executionResult.duration}ms`)
      );
      console.log(
        chalk.gray(`  Tokens: ${result.executionResult.tokensUsed.total}`)
      );
    }

    // 总体统计
    console.log(chalk.magenta('\n📈 Total:'));
    console.log(chalk.gray(`  Total duration: ${result.totalDuration}ms`));
    console.log(
      chalk.gray(
        `  Total tokens: ${
          result.planningResult.tokensUsed.total +
          (result.executionResult?.tokensUsed.total || 0)
        }`
      )
    );

    console.log(chalk.gray('═'.repeat(50)));
    console.log('');
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      planning: this.planningSubAgent,
      execution: this.executionSubAgent,
    };
  }
}
