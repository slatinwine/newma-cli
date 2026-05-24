/**
 * 四步循环协调器
 *
 * 整合：推理 → 执行 → 观测 → 修复 → 推理...
 * 实现智能循环，直到任务完成
 */

import { Reasoner } from './reasoner';
import { Observer } from './observer';
import { Repairer } from './repairer';
import { ToolExecutor } from '../executor-v2';
import { RollbackManager } from '../rollback';
import { ExecutionTracker } from '../history';
import { scanDirectory } from '../scanner';
import { Config } from '../config';
import {
  LoopState,
  LoopIteration,
  ReasoningResult,
  ExecutionResult,
  ObservationResult,
  RepairResult,
  Action,
} from './types';
import chalk from 'chalk';
import inquirer from 'inquirer';

export class LoopCoordinator {
  private state: LoopState;
  private reasoner: Reasoner;
  private observer: Observer;
  private repairer: Repairer;
  private rollbackManager: RollbackManager;
  private tracker: ExecutionTracker;
  private toolExecutor: ToolExecutor;

  constructor(
    private config: Config,
    private projectRoot: string,
    maxIterations: number = Infinity,
    private autonomous: boolean = false,
    private abortSignal?: AbortSignal
  ) {
    this.state = {
      iteration: 0,
      maxIterations,
      completed: false,
      history: [],
    };

    this.reasoner = new Reasoner(config, projectRoot);
    this.observer = new Observer(config, projectRoot);
    this.repairer = new Repairer(config, projectRoot);
    this.rollbackManager = new RollbackManager(projectRoot);
    this.tracker = new ExecutionTracker();
    this.toolExecutor = new ToolExecutor(
      this.tracker,
      this.rollbackManager,
      this.config
    );
  }

  /**
   * 执行四步循环
   *
   * @param requirement 用户需求
   * @returns 循环状态
   */
  async execute(requirement: string): Promise<LoopState> {
    const maxDisplay = this.state.maxIterations === Infinity ? '∞' : this.state.maxIterations;

    if (this.autonomous) {
      console.log(chalk.cyan(`\n🔁 Loop started (max: ${maxDisplay}, autonomous)\n`));
    } else {
      console.log(chalk.cyan('\n' + '█'.repeat(60)));
      console.log(chalk.cyan('█' + ' '.repeat(58) + '█'));
      console.log(chalk.cyan('█' + '  四步循环系统启动'.padEnd(58) + '█'));
      console.log(chalk.cyan('█' + '  推理 → 执行 → 观测 → 修复'.padEnd(58) + '█'));
      console.log(chalk.cyan('█' + ' '.repeat(58) + '█'));
      console.log(chalk.cyan('█'.repeat(60) + '\n'));
    }

    let previousReasoning: ReasoningResult | undefined;

    // 主循环
    while (!this.state.completed && this.state.iteration < this.state.maxIterations) {
      // 检查是否被中止
      if (this.abortSignal?.aborted) {
        console.log(chalk.yellow('\n⚠️  Loop cancelled by user\n'));
        break;
      }

      this.state.iteration++;

      if (this.autonomous) {
        console.log(chalk.cyan(`[${this.state.iteration}/${maxDisplay}] Planning...`));
      } else {
        console.log(chalk.cyan(`\n${'═'.repeat(60)}`));
        console.log(chalk.cyan(`📌 迭代 ${this.state.iteration}/${this.state.maxIterations}`));
        console.log(chalk.cyan('═'.repeat(60)));
      }

      try {
        // 步骤 1: 推理
        const reasoning = await this.reasoner.reason(
          requirement,
          await scanDirectory(this.projectRoot),
          previousReasoning
        );

        // 确认是否继续 (仅在非自主模式下)
        if (!this.autonomous) {
          const shouldContinue = await this.confirmExecution(reasoning);
          if (!shouldContinue) {
            console.log(chalk.yellow('\n⚠️  用户取消执行\n'));
            break;
          }
        }

        // 步骤 2: 执行
        if (this.autonomous) {
          console.log(chalk.cyan(`[${this.state.iteration}/${maxDisplay}] Executing...`));
        }
        const execution = await this.executeStep(reasoning.plan.actions);

        // 步骤 3: 观测
        if (this.autonomous) {
          console.log(chalk.cyan(`[${this.state.iteration}/${maxDisplay}] Observing...`));
        }
        const observation = await this.observer.observe(
          requirement,
          await scanDirectory(this.projectRoot),
          execution,
          reasoning.expectedOutcome
        );

        // 检查是否完成
        if (observation.recommendation === 'complete' || observation.satisfied) {
          if (this.autonomous) {
            console.log(chalk.green(`\n✅ Task completed (${this.state.iteration} iterations)\n`));
          } else {
            console.log(chalk.green('\n✅ 任务完成！\n'));
          }
          this.state.completed = true;
          this.recordIteration(reasoning, execution, observation);
          break;
        }

        // 检查是否需要重新规划
        if (observation.recommendation === 'replan') {
          if (this.autonomous) {
            console.log(chalk.yellow(`[${this.state.iteration}/${maxDisplay}] Replanning...`));
          } else {
            console.log(chalk.yellow('\n📋 重新规划...\n'));
          }
          previousReasoning = reasoning; // 保存失败的推理
          continue;
        }

        // 步骤 4: 修复
        if (this.autonomous) {
          console.log(chalk.cyan(`[${this.state.iteration}/${maxDisplay}] Repairing...`));
        }
        const repair = await this.repairer.repair(
          requirement,
          await scanDirectory(this.projectRoot),
          observation.issues,
          observation.gaps
        );

        // 检查是否应该重新规划
        if (repair.shouldReplan) {
          if (this.autonomous) {
            console.log(chalk.yellow(`[${this.state.iteration}/${maxDisplay}] Replanning...`));
          } else {
            console.log(chalk.yellow('\n📋 重新规划整个方案...\n'));
          }
          previousReasoning = reasoning;
          continue;
        }

        // 记录迭代
        this.recordIteration(reasoning, execution, observation, repair);

        // 如果不需要修复，也标记为完成
        if (!repair.needsRepair) {
          if (this.autonomous) {
            console.log(chalk.green(`\n✅ Task completed (${this.state.iteration} iterations)\n`));
          } else {
            console.log(chalk.green('\n✅ 任务完成！\n'));
          }
          this.state.completed = true;
          break;
        }

        // 执行修复操作
        if (repair.repairs.length > 0) {
          if (!this.autonomous) {
            console.log(chalk.cyan('\n🔧 执行修复...\n'));
          }

          for (const r of repair.repairs) {
            if (r.repairActions.length > 0) {
              const repairExecution = await this.executeStep(r.repairActions);

              if (!repairExecution.success) {
                if (this.autonomous) {
                  console.log(chalk.yellow(`[${this.state.iteration}/${maxDisplay}] Repair failed, will retry`));
                } else {
                  console.log(chalk.yellow('\n⚠️  修复失败，将在下一次迭代中重试\n'));
                }
              }
            }
          }
        }

      } catch (error: any) {
        if (this.autonomous) {
          console.log(chalk.red(`[${this.state.iteration}/${maxDisplay}] Error: ${error.message}`));
        } else {
          console.error(chalk.red('\n❌ 迭代失败：'), error.message);
          console.error(chalk.gray(error.stack));
        }

        // 记录失败
        this.state.history.push({
          iteration: this.state.iteration,
          reasoning: {
            reasoning: ['执行失败'],
            confidence: 0,
            plan: { description: '失败', actions: [] },
            expectedOutcome: '',
            risks: [error.message],
          },
          execution: {
            success: false,
            executedActions: [],
            outputs: [],
            errors: [{ type: 'unknown', message: error.message }],
            duration: 0,
          },
          observation: {
            satisfied: false,
            observations: ['执行失败'],
            issues: [],
            gaps: [],
            confidence: 0,
            recommendation: 'replan',
          },
          timestamp: Date.now(),
        });

        // 在非自主模式下询问用户是否继续
        if (!this.autonomous) {
          const { shouldContinue } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'shouldContinue',
              message: '继续下一次迭代？',
              default: false,
            },
          ]);

          if (!shouldContinue) {
            console.log(chalk.yellow('\n⚠️  用户终止循环\n'));
            break;
          }
        }
        // 自主模式下继续下一次迭代
      }
    }

    // 显示总结
    this.displaySummary();

    return this.state;
  }

  /**
   * 执行步骤
   */
  private async executeStep(actions: Action[]): Promise<ExecutionResult> {
    if (!this.autonomous) {
      console.log(chalk.cyan('\n⚙️  步骤 2: 执行\n'));
      console.log(chalk.gray(`执行 ${actions.length} 个操作...\n`));
    }

    // 处理空操作数组
    if (actions.length === 0) {
      return {
        success: false,
        executedActions: [],
        outputs: [],
        errors: [{ type: 'logic', message: 'No actions to execute' }],
        duration: 0,
      };
    }

    const startTime = Date.now();
    const executedActions: ExecutionResult['executedActions'] = [];
    const outputs: string[] = [];
    const errors: ExecutionResult['errors'] = [];

    let success = true;

    for (const action of actions) {
      try {
        const result = await this.toolExecutor.executeAction(action, this.rollbackManager);

        executedActions.push({
          action,
          status: result.success ? 'success' : 'failed',
          output: result.error ? undefined : 'Done',  // 简化输出
          error: result.error,
          duration: result.duration,
        });

        if (result.success) {
          outputs.push(`执行成功: ${this.describeAction(action)}`);
          if (!this.autonomous) {
            console.log(chalk.green(`  ✅ ${this.describeAction(action)}`));
          }
        } else {
          success = false;
          errors.push({
            type: 'runtime',
            message: result.error || '操作失败',
            relatedAction: action,
          });
          if (!this.autonomous) {
            console.log(chalk.red(`  ❌ ${this.describeAction(action)}`));
            console.log(chalk.red(`     ${result.error}`));
          }
        }

      } catch (error: any) {
        success = false;
        errors.push({
          type: 'unknown',
          message: error.message,
          relatedAction: action,
          stack: error.stack,
        });
        if (!this.autonomous) {
          console.log(chalk.red(`  ❌ ${this.describeAction(action)}`));
          console.log(chalk.red(`     ${error.message}`));
        }
      }
    }

    const duration = Date.now() - startTime;

    if (!this.autonomous) {
      console.log(chalk.gray(`\n✓ 完成 ${actions.length} 个操作，耗时 ${(duration / 1000).toFixed(2)}s`));
    }

    return {
      success,
      executedActions,
      outputs,
      errors,
      duration,
    };
  }

  /**
   * 确认执行
   */
  private async confirmExecution(reasoning: ReasoningResult): Promise<boolean> {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: '执行此计划？',
        default: true,
      },
    ]);

    return confirm;
  }

  /**
   * 记录迭代
   */
  private recordIteration(
    reasoning: ReasoningResult,
    execution: ExecutionResult,
    observation: ObservationResult,
    repair?: RepairResult
  ): void {
    this.state.history.push({
      iteration: this.state.iteration,
      reasoning,
      execution,
      observation,
      repair,
      timestamp: Date.now(),
    });
  }

  /**
   * 描述操作
   */
  private describeAction(action: Action): string {
    switch (action.type) {
      case 'create':
        return `创建 ${action.path}`;
      case 'modify':
        return `修改 ${action.path}`;
      case 'delete':
        return `删除 ${action.path}`;
      case 'run':
        return `执行 ${action.command}`;
      case 'verify':
        return `验证 ${action.command}`;
      default:
        return JSON.stringify(action);
    }
  }

  /**
   * 显示总结
   */
  private displaySummary(): void {
    if (this.autonomous) {
      // 简化总结输出
      const maxDisplay = this.state.maxIterations === Infinity ? '∞' : this.state.maxIterations;
      const status = this.state.completed ? '✅ Completed' : '❌ Incomplete';
      console.log(chalk.cyan(`\n📊 Summary: ${this.state.iteration}/${maxDisplay} iterations | ${status} | ${this.calculateDuration()}s\n`));
    } else {
      // 详细总结输出
      console.log(chalk.cyan('\n' + '█'.repeat(60)));
      console.log(chalk.cyan('█' + ' '.repeat(58) + '█'));
      console.log(chalk.cyan('█' + '  循环完成总结'.padEnd(58) + '█'));
      console.log(chalk.cyan('█' + ' '.repeat(58) + '█'));
      console.log(chalk.cyan('█'.repeat(60) + '\n'));

      console.log(chalk.gray(`总迭代次数：${this.state.iteration}`));
      console.log(chalk.gray(`状态：${this.state.completed ? '✅ 完成' : '❌ 未完成'}`));
      console.log(chalk.gray(`耗时：${this.calculateDuration()}s`));

      if (this.state.history.length > 0) {
        console.log(chalk.cyan('\n📊 迭代历史：\n'));

        this.state.history.forEach((iter, idx) => {
          const status = iter.execution.success ? '✅' : '❌';
          const recommendation = iter.observation.recommendation.toUpperCase();

          console.log(chalk.gray(`${idx + 1}. 迭代 ${iter.iteration}: ${status} → ${recommendation}`));
          console.log(chalk.gray(`   操作：${iter.execution.executedActions.length} 个`));
          console.log(chalk.gray(`   问题：${iter.observation.issues.length} 个`));
          console.log(chalk.gray(`   修复：${iter.repair?.repairs.length || 0} 个`));
        });
      }

      console.log(chalk.cyan('\n' + '█'.repeat(60) + '\n'));
    }
  }

  /**
   * 计算总耗时
   */
  private calculateDuration(): string {
    if (this.state.history.length === 0) {
      return '0.00';
    }

    const first = this.state.history[0].timestamp;
    const last = this.state.history[this.state.history.length - 1].timestamp;

    return ((last - first) / 1000).toFixed(2);
  }
}
