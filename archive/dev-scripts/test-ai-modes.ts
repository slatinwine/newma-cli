/**
 * AI Modes Test
 *
 * 测试 Chat 和 Plan 模式是否正常工作
 */

import chalk from 'chalk';
import { getDefaultConfig } from './src/config';
import { CliFrontend } from './src/loop/frontends/cli-frontend';
import { OutputStyle } from './src/loop/interfaces/frontend';
import { CommandManager } from './src/loop/commands/command-manager';
import { CorePluginCommands } from './src/loop/plugins/core-plugin';
import { AIFlowController } from './src/loop/core/ai-flow-controller';
import { LoopSessionManagerAdapter } from './src/loop/core/session-adapter';
import { SessionManager } from './src/session';
import { HookSystem } from './src/hooks';
import { ToolExecutor } from './src/executor-v2';
import { RollbackManager } from './src/rollback';

/**
 * 检查 API 配置
 */
function checkAPIConfig(): boolean {
  try {
    const config = getDefaultConfig();
    const hasKey = Boolean(config.apiKey && config.apiKey.length > 0);
    const hasModel = Boolean(config.model && config.model.length > 0);

    console.log(chalk.cyan('\n📋 API Configuration Check:'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(chalk.white('API Key:   ') + (hasKey ? chalk.green('✓ Configured') : chalk.red('✗ Missing')));
    console.log(chalk.white('Model:     ') + (hasModel ? chalk.green(`✓ ${config.model}`) : chalk.red('✗ Missing')));
    console.log(chalk.white('Base URL:  ') + chalk.gray(config.baseUrl));
    console.log(chalk.cyan('═'.repeat(50)) + '\n');

    return hasKey && hasModel;
  } catch (error: any) {
    console.log(chalk.red('✗ Failed to load config:', error.message));
    return false;
  }
}

/**
 * 创建测试环境
 */
async function createTestEnvironment() {
  console.log(chalk.cyan('\n🔧 Setting up test environment...\n'));

  // 加载配置
  const config = getDefaultConfig();
  const projectRoot = process.cwd();

  // 创建 Hook 系统
  const hookSystem = new HookSystem({ enabled: false });

  // 创建 SessionManager
  const sessionManager = new SessionManager(
    projectRoot,
    config,
    {
      useTools: true,
      permissionLevel: 'safe' as any,
    }
  );

  // 创建前端
  const frontend = new CliFrontend({
    prompt: '[test] ❯ ',
    colors: true,
  });

  // 创建会话适配器
  const session = new LoopSessionManagerAdapter(
    sessionManager,
    frontend,
    hookSystem
  );

  // 创建命令管理器
  const commandManager = new CommandManager();
  const coreCommands = CorePluginCommands.getAllCommands(commandManager);
  coreCommands.forEach(cmd => commandManager.register(cmd, 'core'));

  // 创建工具执行器
  const rollbackManager = new RollbackManager(projectRoot);
  const toolExecutor = new ToolExecutor(
    sessionManager.getTracker(),
    rollbackManager,
    config,
    'safe' as any,
    hookSystem
  );

  // 创建 AI 流程控制器
  const flowController = new AIFlowController({
    commandManager,
    session,
    frontend,
    projectRoot,
    toolExecutor,
    rollbackManager,
  });

  console.log(chalk.green('✓ Test environment ready\n'));

  return { config, session, frontend, flowController };
}

/**
 * 测试 Chat 模式
 */
async function testChatMode(flowController: AIFlowController, input: string) {
  console.log(chalk.cyan('\n' + '═'.repeat(60)));
  console.log(chalk.white.bold('📝 Test 1: Chat Mode'));
  console.log(chalk.cyan('═'.repeat(60)));

  console.log(chalk.gray(`Input: "${input}"\n`));

  try {
    const result = await flowController.processInput(input);

    console.log(chalk.cyan('Result:'));
    console.log(chalk.gray(`  Type: ${result.type}`));
    console.log(chalk.gray(`  Should Continue: ${result.shouldContinue}`));
    console.log(chalk.gray(`  Has Data: ${result.data !== null}`));

    if (result.error) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return false;
    }

    console.log(chalk.green('\n✓ Chat mode test PASSED\n'));
    return true;
  } catch (error: any) {
    console.log(chalk.red(`\n✗ Chat mode test FAILED: ${error.message}\n`));
    console.error(error);
    return false;
  }
}

/**
 * 测试 Plan 模式
 */
async function testPlanMode(flowController: AIFlowController, input: string) {
  console.log(chalk.cyan('\n' + '═'.repeat(60)));
  console.log(chalk.white.bold('📋 Test 2: Plan Mode'));
  console.log(chalk.cyan('═'.repeat(60)));

  console.log(chalk.gray(`Input: "${input}"\n`));

  try {
    const result = await flowController.processInput(input);

    console.log(chalk.cyan('Result:'));
    console.log(chalk.gray(`  Type: ${result.type}`));
    console.log(chalk.gray(`  Should Continue: ${result.shouldContinue}`));
    console.log(chalk.gray(`  Has Data: ${result.data !== null}`));

    if (result.error) {
      console.log(chalk.red(`  Error: ${result.error}`));
      return false;
    }

    console.log(chalk.green('\n✓ Plan mode test PASSED\n'));
    return true;
  } catch (error: any) {
    console.log(chalk.red(`\n✗ Plan mode test FAILED: ${error.message}\n`));
    console.error(error);
    return false;
  }
}

/**
 * 主测试函数
 */
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║         AI Modes Test (Chat & Plan)                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // 检查 API 配置
  const hasAPIConfig = checkAPIConfig();

  if (!hasAPIConfig) {
    console.log(chalk.yellow('\n⚠️  API not configured. Please set up your API key:'));
    console.log(chalk.gray('   1. Create .env file with OPENAI_API_KEY'));
    console.log(chalk.gray('   2. Or run: npm run init-settings'));
    console.log(chalk.gray('   3. Then run this test again.\n'));
    process.exit(1);
  }

  try {
    // 创建测试环境
    const { flowController } = await createTestEnvironment();

    // 测试 Chat 模式
    const chatPassed = await testChatMode(
      flowController,
      '你好，请用一句话介绍你自己'
    );

    // 测试 Plan 模式
    const planPassed = await testPlanMode(
      flowController,
      '分析当前项目的结构'
    );

    // 总结
    console.log(chalk.cyan('\n' + '═'.repeat(60)));
    console.log(chalk.white.bold('📊 Test Summary'));
    console.log(chalk.cyan('═'.repeat(60)));
    console.log(`Chat Mode:  ${chatPassed ? chalk.green('✓ PASSED') : chalk.red('✗ FAILED')}`);
    console.log(`Plan Mode:  ${planPassed ? chalk.green('✓ PASSED') : chalk.red('✗ FAILED')}`);
    console.log(chalk.cyan('═'.repeat(60)) + '\n');

    if (chatPassed && planPassed) {
      console.log(chalk.green.bold('✓ All tests PASSED!\n'));
      process.exit(0);
    } else {
      console.log(chalk.red.bold('✗ Some tests FAILED\n'));
      process.exit(1);
    }
  } catch (error: any) {
    console.log(chalk.red(`\n✗ Test error: ${error.message}\n`));
    console.error(error);
    process.exit(1);
  }
}

// 运行测试
main().catch(console.error);
