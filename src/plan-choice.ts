// src/plan-choice.ts
import inquirer from 'inquirer';
import chalk from 'chalk';
import { Action } from './types';

/**
 * Plan Choice Manager
 * Handles interactive choices after AI generates a plan
 */
export class PlanChoiceManager {
  /**
   * Present plan options to user
   */
  async presentPlanOptions(
    todo: string[],
    actions: Action[],
    hasAlternatives: boolean = false
  ): Promise<string> {
    console.log(chalk.cyan('\n' + '═'.repeat(60)));
    console.log(chalk.cyan.bold('   计划已生成 - 选择下一步操作'));
    console.log(chalk.cyan('═'.repeat(60) + '\n'));

    // Show brief plan summary
    console.log(chalk.gray('📋 计划概要:'));
    console.log(chalk.gray(`  待办事项: ${todo.length} 个`));
    console.log(chalk.gray(`  执行步骤: ${actions.length} 个\n`));

    // Build choices
    const choices = [
      { name: chalk.green('A - 继续执行当前计划'), value: 'execute', short: 'A' },
      { name: chalk.yellow('B - 修改需求后重新计划'), value: 'modify', short: 'B' },
      { name: chalk.blue('C - 查看详细信息'), value: 'details', short: 'C' },
    ];

    // Add "regenerate" option only if there might be alternatives
    if (hasAlternatives) {
      choices.splice(2, 0, {
        name: chalk.magenta('B - 重新生成计划'),
        value: 'regenerate',
        short: 'B'
      });
    }

    choices.push({ name: chalk.red('D - 取消'), value: 'cancel', short: 'D' });

    // Re-label to ensure sequential letters
    const letterMap = ['A', 'B', 'C', 'D', 'E'];
    choices.forEach((choice, index) => {
      const letter = letterMap[index];
      choice.name = choice.name.replace(/[A-E]\s*-\s*/, `${letter} - `);
      choice.short = letter;
    });

    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: '你的选择:',
        choices: choices,
      }
    ]);

    return selected;
  }

  /**
   * Show detailed plan information
   */
  showPlanDetails(todo: string[], actions: Action[]): void {
    console.log(chalk.gray('\n' + '─'.repeat(60)));
    console.log(chalk.yellow.bold('  详细计划'));
    console.log(chalk.gray('─'.repeat(60) + '\n'));

    if (todo.length > 0) {
      console.log(chalk.magenta('📋 待办事项:'));
      todo.forEach((item, i) => {
        console.log(chalk.gray(`  ${i + 1}. ${item}`));
      });
      console.log('');
    }

    if (actions.length > 0) {
      console.log(chalk.magenta('⚡ 执行步骤:'));
      actions.forEach((action, i) => {
        const desc = this.describeAction(action);
        console.log(chalk.gray(`  ${i + 1}. ${desc}`));
      });
      console.log('');
    }

    console.log(chalk.gray('─'.repeat(60) + '\n'));
  }

  /**
   * Simple action description
   */
  private describeAction(action: Action): string {
    switch (action.type) {
      case 'run':
        return `运行命令: ${action.command}`;
      case 'create':
        return `创建文件: ${action.path}`;
      case 'modify':
        return `修改文件: ${action.path}`;
      case 'delete':
        return `删除文件: ${action.path}`;
      case 'verify':
        return `验证: ${action.command}`;
      default:
        return `未知操作: ${action.type}`;
    }
  }
}
