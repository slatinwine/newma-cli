/**
 * Plan State Machine
 *
 * Manages the interactive planning workflow with navigation options:
 * - Back to previous step
 * - Continue planning (regenerate options)
 * - Confirm execution
 * - Exit
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  PlanState,
  NavigationAction,
  StateHistoryEntry,
  PlanContext,
  StateMachineConfig,
  StateTransition,
  NavigationMenuItem,
  StateMachineResult,
} from './types';
import { FFTPlanOption } from '../fft/types';

/**
 * Plan State Machine Class
 */
export class PlanStateMachine {
  private currentState: PlanState;
  private history: StateHistoryEntry[] = [];
  private context: PlanContext;
  private config: StateMachineConfig;
  private regenerationCount = 0;

  constructor(
    initialState: PlanState,
    context: PlanContext,
    config?: Partial<StateMachineConfig>
  ) {
    this.currentState = initialState;
    this.context = context;
    this.config = {
      allowRegenerate: config?.allowRegenerate ?? true,
      maxRegenerations: config?.maxRegenerations ?? 3,
    };
  }

  /**
   * Get current state
   */
  getState(): PlanState {
    return this.currentState;
  }

  /**
   * Get context
   */
  getContext(): PlanContext {
    return this.context;
  }

  /**
   * Update context data
   */
  updateContext(updates: Partial<PlanContext>): void {
    this.context = { ...this.context, ...updates };
  }

  /**
   * Push state to history
   */
  private pushToHistory(data?: any): void {
    this.history.push({
      state: this.currentState,
      timestamp: Date.now(),
      data,
    });
  }

  /**
   * Get available navigation options for current state
   */
  getNavigationOptions(): NavigationMenuItem[] {
    switch (this.currentState) {
      case PlanState.OPTION_SELECTION:
        return [
          {
            key: '1',
            label: '选择方案',
            description: '从可用的实施方案中选择一个',
            action: NavigationAction.CONTINUE,
            emoji: '✅',
          },
          {
            key: '2',
            label: '重新生成选项',
            description: '生成新的实施方案选项',
            action: NavigationAction.REGENERATE,
            emoji: '🔄',
          },
          {
            key: '3',
            label: '退出',
            description: '取消计划流程',
            action: NavigationAction.EXIT,
            emoji: '❌',
          },
        ];

      case PlanState.PLAN_CONFIRMATION:
        return [
          {
            key: '1',
            label: '确认执行',
            description: '开始执行此计划',
            action: NavigationAction.CONFIRM,
            emoji: '✅',
          },
          {
            key: '2',
            label: '返回上一步',
            description: '重新选择实施方案',
            action: NavigationAction.BACK,
            emoji: '⬅️',
          },
          {
            key: '3',
            label: '重新生成选项',
            description: '生成新的实施方案选项',
            action: NavigationAction.REGENERATE,
            emoji: '🔄',
          },
          {
            key: '4',
            label: '退出',
            description: '取消计划流程',
            action: NavigationAction.EXIT,
            emoji: '❌',
          },
        ];

      default:
        return [];
    }
  }

  /**
   * Display navigation menu and get user choice
   */
  async promptNavigation(): Promise<NavigationAction> {
    const options = this.getNavigationOptions();

    if (options.length === 0) {
      return NavigationAction.CONTINUE;
    }

    console.log(chalk.cyan('\n' + '═'.repeat(60)));
    console.log(chalk.cyan('请选择下一步操作:\n'));

    const choices = options.map(opt => {
      const regenerateNote = opt.action === NavigationAction.REGENERATE && this.regenerationCount > 0
        ? chalk.gray(` (已使用 ${this.regenerationCount}/${this.config.maxRegenerations})`)
        : '';

      return {
        name: `${opt.emoji} ${opt.label}${regenerateNote}\n    ${chalk.gray(opt.description)}`,
        value: opt.action,
        short: `${opt.emoji} ${opt.label}`,
      };
    });

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '请选择:',
        choices,
        pageSize: 10,
      },
    ]);

    return action;
  }

  /**
   * Transition to next state based on action
   */
  async transition(action: NavigationAction): Promise<StateTransition> {
    this.pushToHistory();

    switch (this.currentState) {
      case PlanState.OPTION_SELECTION:
        return this.transitionFromOptionSelection(action);

      case PlanState.PLAN_CONFIRMATION:
        return this.transitionFromPlanConfirmation(action);

      default:
        return {
          nextState: this.currentState,
          action,
          shouldExit: false,
        };
    }
  }

  /**
   * Transition from OPTION_SELECTION state
   */
  private transitionFromOptionSelection(action: NavigationAction): StateTransition {
    switch (action) {
      case NavigationAction.CONTINUE:
        // User selected an option (already set in context)
        return {
          nextState: PlanState.PLAN_CONFIRMATION,
          action,
          shouldExit: false,
        };

      case NavigationAction.REGENERATE:
        if (!this.config.allowRegenerate) {
          console.log(chalk.yellow('\n⚠️  重新生成选项功能未启用\n'));
          return {
            nextState: PlanState.OPTION_SELECTION,
            action: NavigationAction.CONTINUE,
            shouldExit: false,
          };
        }

        if (this.regenerationCount >= this.config.maxRegenerations) {
          console.log(chalk.yellow(`\n⚠️  已达到最大重新生成次数 (${this.config.maxRegenerations})\n`));
          return {
            nextState: PlanState.OPTION_SELECTION,
            action: NavigationAction.CONTINUE,
            shouldExit: false,
          };
        }

        this.regenerationCount++;
        // Signal to regenerate options
        return {
          nextState: PlanState.ANALYZING,  // Go back to analyzing to regenerate
          action,
          shouldExit: false,
        };

      case NavigationAction.EXIT:
        return {
          nextState: PlanState.CANCELLED,
          action,
          shouldExit: true,
        };

      default:
        return {
          nextState: this.currentState,
          action,
          shouldExit: false,
        };
    }
  }

  /**
   * Transition from PLAN_CONFIRMATION state
   */
  private transitionFromPlanConfirmation(action: NavigationAction): StateTransition {
    switch (action) {
      case NavigationAction.CONFIRM:
        return {
          nextState: PlanState.EXECUTING,
          action,
          shouldExit: false,
        };

      case NavigationAction.BACK:
        // Remove the confirmation state from history
        this.history.pop();
        // Return to option selection
        return {
          nextState: PlanState.OPTION_SELECTION,
          action,
          shouldExit: false,
        };

      case NavigationAction.REGENERATE:
        if (!this.config.allowRegenerate) {
          console.log(chalk.yellow('\n⚠️  重新生成选项功能未启用\n'));
          return {
            nextState: PlanState.PLAN_CONFIRMATION,
            action: NavigationAction.CONTINUE,
            shouldExit: false,
          };
        }

        if (this.regenerationCount >= this.config.maxRegenerations) {
          console.log(chalk.yellow(`\n⚠️  已达到最大重新生成次数 (${this.config.maxRegenerations})\n`));
          return {
            nextState: PlanState.PLAN_CONFIRMATION,
            action: NavigationAction.CONTINUE,
            shouldExit: false,
          };
        }

        this.regenerationCount++;
        // Clear selected option
        this.context.selectedOption = undefined;
        // Go back to analyzing to regenerate
        return {
          nextState: PlanState.ANALYZING,
          action,
          shouldExit: false,
        };

      case NavigationAction.EXIT:
        return {
          nextState: PlanState.CANCELLED,
          action,
          shouldExit: true,
        };

      default:
        return {
          nextState: this.currentState,
          action,
          shouldExit: false,
        };
    }
  }

  /**
   * Set current state
   */
  setState(state: PlanState): void {
    this.currentState = state;
  }

  /**
   * Display plan confirmation details
   */
  displayPlanConfirmation(): void {
    const plan = this.context.selectedOption;
    if (!plan) {
      console.log(chalk.yellow('\n⚠️  没有选定的计划\n'));
      return;
    }

    console.log(chalk.cyan('\n📋 计划确认'));
    console.log(chalk.cyan('═'.repeat(60)));
    console.log(chalk.white(`方案: ${plan.name}`));
    console.log(chalk.gray(plan.description));
    console.log(chalk.gray(`⏱️  预计时间: ${plan.estimatedTime}ms`));
    console.log(chalk.gray(`⚠️  风险等级: ${plan.riskLevel}`));
    console.log(chalk.gray(`信心度: ${(plan.confidence * 100).toFixed(0)}%`));

    if (plan.pros.length > 0 || plan.cons.length > 0) {
      console.log(chalk.gray('\n📊 优缺点分析:'));
      if (plan.pros.length > 0) {
        console.log(chalk.green('  ✅ ' + plan.pros.join('\n  ✅ ')));
      }
      if (plan.cons.length > 0) {
        console.log(chalk.yellow('  ❌ ' + plan.cons.join('\n  ❌ ')));
      }
    }

    if (plan.actions.length > 0) {
      console.log(chalk.gray(`\n📝 执行步骤 (${plan.actions.length} actions):`));
      plan.actions.forEach((action, idx) => {
        const typeColor =
          action.type === 'create' ? chalk.green :
          action.type === 'modify' ? chalk.yellow :
          action.type === 'run' ? chalk.cyan :
          chalk.blue;

        const actionDesc =
          action.type === 'create' ? action.path :
          action.type === 'modify' ? action.path :
          action.type === 'run' ? action.command :
          action.type === 'verify' ? action.command :
          JSON.stringify(action);

        console.log(chalk.gray(`  ${idx + 1}. [${typeColor(action.type)}] ${actionDesc}`));
      });
    }

    console.log(chalk.cyan('\n' + '═'.repeat(60)));
  }

  /**
   * Get final result
   */
  getResult(): StateMachineResult {
    return {
      state: this.currentState,
      planToExecute: this.context.selectedOption,
      cancelled: this.currentState === PlanState.CANCELLED,
    };
  }
}

/**
 * Create state machine for FFT planning
 */
export function createPlanStateMachine(
  requirement: string,
  projectInfo: Record<string, string>,
  initialState: PlanState = PlanState.ANALYZING
): PlanStateMachine {
  const context: PlanContext = {
    requirement,
    projectInfo,
  };

  return new PlanStateMachine(initialState, context);
}

// Re-export types for convenience
export { PlanState, NavigationAction, PlanContext, StateMachineResult } from './types';

