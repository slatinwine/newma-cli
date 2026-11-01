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
 * 确认回调：由调用方注入。注入非阻塞实现（如 ConfirmationQueue）后，
 * Worker 等确认期间会话可继续响应其他输入（文章 4.1 全双工交互）。
 * 未注入时保持原有的 inquirer 阻塞式交互（向后兼容）。
 */
export type ConfirmationResolver = (title: string, detail?: string) => Promise<boolean>;

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

    // 用户确认：优先使用注入的非阻塞 resolver，否则回退 inquirer 阻塞式
    if (!options?.skipConfirmation) {
      const resolver = options?.confirmationResolver ?? this.defaultBlockingConfirmation();
      const confirmed = await resolver(
        'Continue to execution phase?',
        this.summarizePlan(plan)
      );

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
   * 提示用户确认（默认阻塞实现，仅向后兼容保留；
   * 新代码请注入 non-blocking 的 confirmationResolver）
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

  /** 默认的阻塞式确认（inquirer）。保持旧行为，仅在未注入 resolver 时使用。 */
  private defaultBlockingConfirmation(): ConfirmationResolver {
    return async () => this.promptForConfirmation();
  }

  /** 生成给确认流程展示的计划摘要（Inline 最小信息，详情按需查看）。 */
  private summarizePlan(plan: unknown): string | undefined {
    if (!plan) return undefined;
    try {
      const p = plan as { todo?: string[]; actions?: Array<{ description?: string }> };
      const lines: string[] = [];
      if (Array.isArray(p.todo) && p.todo.length > 0) {
        lines.push('TODO:');
        for (const t of p.todo.slice(0, 10)) lines.push(`  - ${t}`);
      }
      if (Array.isArray(p.actions) && p.actions.length > 0) {
        lines.push('Actions:');
        for (const a of p.actions.slice(0, 10)) lines.push(`  - ${a.description ?? JSON.stringify(a)}`);
      }
      return lines.length > 0 ? lines.join('\n') : undefined;
    } catch {
      return undefined;
    }
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
