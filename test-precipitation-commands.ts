/**
 * 测试沉淀系统 REPL 命令
 */

import { PrecipitationCoordinator } from './src/memory/precipitation-coordinator';
import { getPrecipitationConfig, NewmaConfig } from './src/config';
import chalk from 'chalk';

async function testCommands() {
  console.log(chalk.bold('\n🧪 测试沉淀系统命令\n'));

  // 1. 初始化协调器
  console.log(chalk.gray('1️⃣  初始化沉淀系统...'));
  const precipitationConfig = getPrecipitationConfig();
  const config: NewmaConfig = {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
    model: 'gpt-4o-mini',
    precipitation: precipitationConfig,
  };

  const coordinator = new PrecipitationCoordinator(
    {
      projectRoot: process.cwd(),
      precipitationConfig,
      initOnStart: false  // 手动启动
    },
    config
  );

  await coordinator.start();
  console.log(chalk.green('✓ 沉淀系统已启动\n'));

  // 2. 测试 /precipitation-status
  console.log(chalk.gray('2️⃣  测试 /precipitation-status 命令...'));
  const status = coordinator.getStatus();
  console.log(chalk.cyan('\n⚙️  Precipitation System Status\n'));
  console.log(chalk.gray(`Status: ${status.scheduler.isRunning ? '🟢 Running' : '🔴 Stopped'}`));
  console.log(chalk.gray(`Next run: ${status.scheduler.nextExecution ? status.scheduler.nextExecution.toLocaleString() : 'N/A'}`));
  console.log('');

  // 3. 测试 /drafts
  console.log(chalk.gray('3️⃣  测试 /drafts 命令...'));
  const draftManager = coordinator.getDraftManager();
  const drafts = await draftManager.listDrafts({ status: 'draft' });

  if (drafts.length === 0) {
    console.log(chalk.yellow('\n⚠️  No drafts found\n'));
  } else {
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
  }

  // 4. 测试 /precipitation-schedule
  console.log(chalk.gray('4️⃣  测试 /precipitation-schedule 命令...'));
  console.log(chalk.bold('\n⏰ Precipitation Schedule\n'));
  console.log(chalk.gray(`Next scheduled run:`));
  if (status.scheduler.nextExecution) {
    console.log(chalk.cyan(status.scheduler.nextExecution.toLocaleString()));
    const timeUntil = status.scheduler.nextExecution.getTime() - Date.now();
    const hours = Math.floor(timeUntil / (1000 * 60 * 60));
    const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
    console.log(chalk.gray(`(${hours}h ${minutes}m from now)\n`));
  } else {
    console.log(chalk.gray('Not scheduled\n'));
  }

  // 5. 测试统计信息
  console.log(chalk.gray('5️⃣  测试统计信息...'));
  const stats = await draftManager.getStats();
  console.log(chalk.bold('\n📊 Draft Statistics'));
  console.log(chalk.gray(`Pending: ${stats.pending}`));
  console.log(chalk.gray(`Approved: ${stats.approved}`));
  console.log(chalk.gray(`Rejected: ${stats.rejected}`));
  console.log(
    chalk.gray(
      `Avg Confidence: ${stats.averageConfidence > 0 ? `${(stats.averageConfidence * 100).toFixed(1)}%` : 'N/A'}`
    )
  );
  console.log('');

  // 6. 停止系统
  console.log(chalk.gray('6️⃣  停止沉淀系统...'));
  await coordinator.stop();
  console.log(chalk.green('✓ 沉淀系统已停止\n'));

  console.log(chalk.bold('✅ 所有测试完成！\n'));
}

// 运行测试
testCommands().catch((error) => {
  console.error(chalk.red('测试失败:'), error);
  process.exit(1);
});
