// src/adventure.ts
import inquirer from 'inquirer';
import chalk from 'chalk';
import { Choice, Action } from './types';

/**
 * Adventure Mode Manager
 * Handles interactive choice presentation for branching execution paths
 */
export class AdventureManager {
  /**
   * Display choices and get user selection
   */
  async presentChoices(scenario: string, choices: Choice[]): Promise<Choice> {
    console.log(chalk.cyan('\n' + '═'.repeat(60)));
    console.log(chalk.cyan.bold('   ' + scenario));
    console.log(chalk.cyan('═'.repeat(60) + '\n'));

    const choicesList = choices.map(c => ({
      name: `${chalk.green(c.id)} - ${chalk.bold(c.title)}`,
      value: c.id,
      short: c.id,
    }));

    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: '你的选择:',
        choices: [
          ...choicesList,
          new inquirer.Separator(),
          { name: chalk.yellow('? 查看详细信息'), value: '?details' },
        ],
      }
    ]);

    if (selected === '?details') {
      return this.presentWithDetails(scenario, choices);
    }

    return choices.find(c => c.id === selected)!;
  }

  /**
   * Show detailed information about each choice
   */
  async presentWithDetails(scenario: string, choices: Choice[]): Promise<Choice> {
    console.log(chalk.gray('\n' + '─'.repeat(60)));
    console.log(chalk.yellow.bold('  详细信息'));
    console.log(chalk.gray('─'.repeat(60) + '\n'));

    choices.forEach(choice => {
      console.log(chalk.bold.green(`[${choice.id}] ${choice.title}`));
      console.log(chalk.gray(choice.description));
      console.log('');

      if (choice.pros.length > 0) {
        console.log(chalk.green('  优点:'));
        choice.pros.forEach(pro => {
          console.log(chalk.green(`    ✓ ${pro}`));
        });
        console.log('');
      }

      if (choice.cons.length > 0) {
        console.log(chalk.red('  缺点:'));
        choice.cons.forEach(con => {
          console.log(chalk.red(`    ✗ ${con}`));
        });
        console.log('');
      }

      if (choice.todo.length > 0) {
        console.log(chalk.yellow('  执行步骤:'));
        choice.todo.forEach((step, i) => {
          console.log(chalk.yellow(`    ${i + 1}. ${step}`));
        });
        console.log('');
      }

      console.log(chalk.gray('─'.repeat(60) + '\n'));
    });

    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: '你的选择:',
        choices: choices.map(c => ({ name: c.id, value: c.id })),
      }
    ]);

    return choices.find(c => c.id === selected)!;
  }

  /**
   * Extract actions from selected choice
   */
  executeChoice(choice: Choice): { todo: string[]; actions: Action[] } {
    return {
      todo: choice.todo,
      actions: choice.actions,
    };
  }

  /**
   * Format choice as text (for logging)
   */
  formatChoiceSummary(choice: Choice): string {
    return `选择了: ${choice.id} - ${choice.title}`;
  }
}
