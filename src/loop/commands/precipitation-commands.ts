/**
 * Precipitation System Commands
 *
 * 经验沉淀系统的 REPL 命令
 */

import { Command, CommandContext } from '../commands/types';
import { PrecipitationCoordinator } from '../../memory/precipitation-coordinator';
import { DraftSkill } from '../../memory/types-precipitation';
import chalk from 'chalk';

/**
 * 创建沉淀系统命令
 */
export function createPrecipitationCommands(coordinator: PrecipitationCoordinator): Command[] {
  const commands: Command[] = [];

  // ========== 查看草稿列表 ==========
  commands.push({
    name: '/drafts',
    description: '查看技能草稿列表',
    handler: async (context: CommandContext) => {
      const draftManager = coordinator.getDraftManager();
      const args = context.args;

      // 解析参数
      const statusFilter = args.includes('--pending')
        ? 'draft'
        : args.includes('--approved')
        ? 'approved'
        : args.includes('--rejected')
        ? 'rejected'
        : undefined;

      const drafts = await draftManager.listDrafts(
        statusFilter ? { status: statusFilter as any } : undefined
      );

      if (drafts.length === 0) {
        console.log(chalk.gray('No drafts found.'));
        return {
          success: true,
          output: 'No drafts found',
        };
      }

      // 显示草稿列表
      console.log(chalk.bold('\n📝 Skill Drafts\n'));

      drafts.forEach((draft, index) => {
        const statusIcon = draft.status === 'draft' ? '📋' : draft.status === 'approved' ? '✅' : '❌';
        const confidenceColor =
          draft.suggestion.confidence >= 0.8
            ? 'green'
            : draft.suggestion.confidence >= 0.6
            ? 'yellow'
            : 'red';

        console.log(`${statusIcon} [${index + 1}] ${chalk.cyan(draft.suggestion.name)}`);
        console.log(`   ${chalk.gray(draft.suggestion.description)}`);
        console.log(
          `   ${chalk.gray('ID:')} ${chalk.gray(draft.id)} | ${chalk.gray('Confidence:')} ${chalk[confidenceColor](
            `${(draft.suggestion.confidence * 100).toFixed(1)}%`
          )}`
        );
        console.log(
          `   ${chalk.gray('Created:')} ${chalk.gray(draft.createdAt.toLocaleDateString())} | ${chalk.gray(
            `Type: ${draft.suggestion.type}`
          )}`
        );
        console.log('');
      });

      console.log(chalk.gray(`Total: ${drafts.length} draft(s)\n`));

      return {
        success: true,
        output: `Listed ${drafts.length} draft(s)`,
      };
    },
  });

  // ========== 批准草稿 ==========
  commands.push({
    name: '/approve',
    description: '批准技能草稿',
    handler: async (context: CommandContext) => {
      const args = context.args;

      if (args.length === 0) {
        console.log(chalk.red('Error: Draft ID is required'));
        console.log(chalk.gray('Usage: /approve <draft-id>'));
        return { success: false, output: 'Missing draft ID' };
      }

      const draftId = args[0];
      const note = args.slice(1).join(' ') || 'Approved by user';

      const draftManager = coordinator.getDraftManager();

      try {
        await draftManager.approve(draftId, note);
        console.log(chalk.green(`✅ Approved draft: ${draftId}`));

        return {
          success: true,
          output: `Approved draft ${draftId}`,
        };
      } catch (error: any) {
        console.log(chalk.red(`✗ Failed to approve: ${error.message}`));
        return {
          success: false,
          output: error.message,
        };
      }
    },
  });

  // ========== 拒绝草稿 ==========
  commands.push({
    name: '/reject',
    description: '拒绝技能草稿',
    handler: async (context: CommandContext) => {
      const args = context.args;

      if (args.length === 0) {
        console.log(chalk.red('Error: Draft ID is required'));
        console.log(chalk.gray('Usage: /reject <draft-id>'));
        return { success: false, output: 'Missing draft ID' };
      }

      const draftId = args[0];
      const note = args.slice(1).join(' ') || 'Rejected by user';

      const draftManager = coordinator.getDraftManager();

      try {
        await draftManager.reject(draftId, note);
        console.log(chalk.yellow(`⚠ Rejected draft: ${draftId}`));

        return {
          success: true,
          output: `Rejected draft ${draftId}`,
        };
      } catch (error: any) {
        console.log(chalk.red(`✗ Failed to reject: ${error.message}`));
        return {
          success: false,
          output: error.message,
        };
      }
    },
  });

  // ========== 查看草稿详情 ==========
  commands.push({
    name: '/view-draft',
    description: '查看草稿详情',
    handler: async (context: CommandContext) => {
      const args = context.args;

      if (args.length === 0) {
        console.log(chalk.red('Error: Draft ID is required'));
        console.log(chalk.gray('Usage: /view-draft <draft-id>'));
        return { success: false, output: 'Missing draft ID' };
      }

      const draftId = args[0];
      const draftManager = coordinator.getDraftManager();

      try {
        const draft = await draftManager.getDraft(draftId);

        if (!draft) {
          console.log(chalk.red(`Draft not found: ${draftId}`));
          return { success: false, output: 'Draft not found' };
        }

        // 显示草稿详情
        console.log(chalk.bold(`\n📄 ${draft.suggestion.name}\n`));
        console.log(`${chalk.gray('Description:')} ${draft.suggestion.description}`);
        console.log(
          `${chalk.gray('Type:')} ${chalk.cyan(draft.suggestion.type)} | ${chalk.gray(
            'Complexity:'
          )} ${chalk.yellow(draft.suggestion.complexity.toString())}`
        );
        console.log(
          `${chalk.gray('Confidence:')} ${chalk.green(
            `${(draft.suggestion.confidence * 100).toFixed(1)}%`
          )} | ${chalk.gray('Status:')} ${chalk.cyan(draft.status)}`
        );
        console.log(`${chalk.gray('Created:')} ${draft.createdAt.toLocaleString()}`);

        if (draft.suggestion.tags.length > 0) {
          console.log(`${chalk.gray('Tags:')} ${draft.suggestion.tags.map((t) => chalk.cyan(`#${t}`)).join(' ')}`);
        }

        console.log(chalk.bold('\n使用场景'));
        draft.suggestion.whenToUse.forEach((scenario) => {
          console.log(`  • ${scenario}`);
        });

        if (draft.suggestion.evidence.length > 0) {
          console.log(chalk.bold('\n支持证据'));
          draft.suggestion.evidence.forEach((evidence) => {
            console.log(`  • ${chalk.cyan(evidence.source)}: ${evidence.description}`);
            console.log(`    出现次数: ${evidence.count || 'N/A'}`);
          });
        }

        console.log('');

        return {
          success: true,
          output: `Viewed draft ${draftId}`,
        };
      } catch (error: any) {
        console.log(chalk.red(`✗ Failed to view draft: ${error.message}`));
        return {
          success: false,
          output: error.message,
        };
      }
    },
  });

  // ========== 手动触发沉淀 ==========
  commands.push({
    name: '/precipitate',
    description: '手动触发经验沉淀',
    handler: async (_context: CommandContext) => {
      console.log(chalk.bold('\n⏰ Triggering experience precipitation...\n'));

      try {
        const result = await coordinator.trigger();

        if (result.success) {
          console.log(chalk.green('✅ Precipitation completed successfully!\n'));
          console.log(`${chalk.gray('Suggestions generated:')} ${chalk.cyan(result.suggestionsGenerated.toString())}`);
          console.log(`${chalk.gray('Drafts saved:')} ${chalk.cyan(result.draftsSaved.toString())}`);
          if (result.autoApproved > 0) {
            console.log(`${chalk.gray('Auto-approved:')} ${chalk.green(result.autoApproved.toString())}`);
          }
          if (result.autoRejected > 0) {
            console.log(`${chalk.gray('Auto-rejected:')} ${chalk.yellow(result.autoRejected.toString())}`);
          }
          console.log(`${chalk.gray('Duration:')} ${chalk.gray(`${result.endTime.getTime() - result.startTime.getTime()}ms`)}`);
          console.log('');

          console.log(chalk.gray('Use /drafts to view pending drafts.\n'));

          return {
            success: true,
            output: `Precipitation completed: ${result.draftsSaved} drafts created`,
          };
        } else {
          console.log(chalk.red('✗ Precipitation failed!\n'));
          console.log(chalk.red(`Error: ${result.error}`));
          console.log('');

          return {
            success: false,
            output: result.error || 'Precipitation failed',
          };
        }
      } catch (error: any) {
        console.log(chalk.red(`✗ Error: ${error.message}\n`));
        return {
          success: false,
          output: error.message,
        };
      }
    },
  });

  // ========== 查看沉淀系统状态 ==========
  commands.push({
    name: '/precipitation-status',
    description: '查看沉淀系统状态',
    handler: async (_context: CommandContext) => {
      const status = coordinator.getStatus();
      const scheduler = status.scheduler;
      const drafts = status.drafts;

      console.log(chalk.bold('\n⚙️ Precipitation System Status\n'));

      // 调度器状态
      console.log(chalk.bold('Scheduler:'));
      console.log(`  Status: ${scheduler.isRunning ? chalk.green('Running') : chalk.red('Stopped')}`);
      if (scheduler.nextExecution) {
        console.log(`  Next run: ${chalk.gray(scheduler.nextExecution.toLocaleString())}`);
      }
      if (scheduler.jobs.length > 0) {
        scheduler.jobs.forEach((job: any) => {
          console.log(`  • ${chalk.cyan(job.name)}: ${chalk.gray(job.cronExpression)}`);
        });
      }

      // 草稿统计
      console.log(chalk.bold('\nDrafts:'));
      console.log(`  Pending: ${chalk.cyan(drafts.pending.toString())}`);
      console.log(`  Approved: ${chalk.green(drafts.approved.toString())}`);
      console.log(`  Rejected: ${chalk.yellow(drafts.rejected.toString())}`);
      console.log(
        `  Avg Confidence: ${chalk.gray(`${(drafts.averageConfidence * 100).toFixed(1)}%`)}`
      );

      // 配置
      console.log(chalk.bold('\nConfiguration:'));
      const config = status.config;
      console.log(`  Enabled: ${config.enabled !== false ? chalk.green('Yes') : chalk.red('No')}`);
      console.log(`  Schedule: ${chalk.gray(config.schedule || '0 2 * * *')}`);
      console.log(`  Confidence Threshold: ${chalk.gray((config.confidenceThreshold || 0.6).toString())}`);
      console.log(`  Max Daily Skills: ${chalk.gray((config.maxDailySkills || 5).toString())}`);
      console.log(`  Draft Retention: ${chalk.gray((config.draftRetentionDays || 30).toString())} days`);

      console.log('');

      return {
        success: true,
        output: 'Precipitation system status displayed',
      };
    },
  });

  // ========== 查看下次执行时间 ==========
  commands.push({
    name: '/precipitation-schedule',
    description: '查看下次执行时间',
    handler: async (_context: CommandContext) => {
      const scheduler = coordinator.getScheduler();
      const nextRun = scheduler.getNextExecution();

      if (!nextRun) {
        console.log(chalk.gray('Scheduler is not running'));
        return { success: false, output: 'Scheduler not running' };
      }

      const now = new Date();
      const diff = nextRun.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      console.log(chalk.bold('\n⏰ Next Precipitation Schedule\n'));
      console.log(`${chalk.gray('Next run:')} ${chalk.cyan(nextRun.toLocaleString())}`);
      console.log(`${chalk.gray('In:')} ${chalk.cyan(`${hours}h ${minutes}m`)}`);
      console.log('');

      return {
        success: true,
        output: `Next precipitation in ${hours}h ${minutes}m`,
      };
    },
  });

  // ========== 删除草稿 ==========
  commands.push({
    name: '/delete-draft',
    description: '删除技能草稿',
    handler: async (context: CommandContext) => {
      const args = context.args;

      if (args.length === 0) {
        console.log(chalk.red('Error: Draft ID is required'));
        console.log(chalk.gray('Usage: /delete-draft <draft-id>'));
        return { success: false, output: 'Missing draft ID' };
      }

      const draftId = args[0];
      const draftManager = coordinator.getDraftManager();

      try {
        await draftManager.delete(draftId);
        console.log(chalk.yellow(`🗑 Deleted draft: ${draftId}`));

        return {
          success: true,
          output: `Deleted draft ${draftId}`,
        };
      } catch (error: any) {
        console.log(chalk.red(`✗ Failed to delete: ${error.message}`));
        return {
          success: false,
          output: error.message,
        };
      }
    },
  });

  return commands;
}

/**
 * 获取帮助文本
 */
export function getPrecipitationCommandsHelp(): string {
  return `
${chalk.bold('Precipitation System Commands:')}

  ${chalk.cyan('/drafts [--pending|--approved|--rejected]')}
    查看技能草稿列表

  ${chalk.cyan('/approve <draft-id> [note]')}
    批准技能草稿

  ${chalk.cyan('/reject <draft-id> [note]')}
    拒绝技能草稿

  ${chalk.cyan('/view-draft <draft-id>')}
    查看草稿详情

  ${chalk.cyan('/delete-draft <draft-id>')}
    删除技能草稿

  ${chalk.cyan('/precipitate')}
    手动触发经验沉淀

  ${chalk.cyan('/precipitation-status')}
    查看沉淀系统状态

  ${chalk.cyan('/precipitation-schedule')}
    查看下次执行时间
`;
}
