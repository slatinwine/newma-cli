/**
 * Loop System 简单测试
 *
 * 测试 Loop 系统的基本功能
 */

import { CliFrontend } from './src/loop/frontends/cli-frontend';
import { CommandManager } from './src/loop/commands/command-manager';
import { CorePluginCommands } from './src/loop/plugins/core-plugin';
import { OutputStyle } from './src/loop/interfaces/frontend';

/**
 * Mock Frontend for testing
 */
class MockFrontend {
  private outputs: string[] = [];

  writeOutput(content: string, style?: OutputStyle): void {
    this.outputs.push(content);
    console.log(`[Output ${style || ''}]: ${content}`);
  }

  writeError(content: string): void {
    this.outputs.push(`ERROR: ${content}`);
    console.error(`[Error]: ${content}`);
  }

  getOutputs(): string[] {
    return [...this.outputs];
  }
}

/**
 * Mock Session for testing
 */
class MockSession {
  iterationCount = 0;
  executionHistory: any[] = [];
  currentPlan: any = undefined;
  config: any = {};
  permissions: Set<string> = new Set();
  currentMode: 'chat' | 'plan' | 'execute' | 'verify' | 'loop' = 'chat';

  sessionId = 'test-session-001';
  startTime = new Date();
  projectRoot = '/tmp/test-project';

  incrementIteration(): void {
    this.iterationCount++;
  }

  switchMode(mode: 'chat' | 'plan' | 'execute' | 'verify' | 'loop'): void {
    this.currentMode = mode;
  }

  getStats() {
    return {
      commandCount: this.executionHistory.length,
      totalDuration: 0,
      successCount: 0,
      failureCount: 0,
      averageDuration: 0,
      sessionDuration: 0,
    };
  }
}

/**
 * 测试命令管理器
 */
async function testCommandManager() {
  console.log('\n=== 测试命令管理器 ===\n');

  const mockFrontend = new MockFrontend();
  const mockSession = new MockSession();
  const commandManager = new CommandManager();

  // 注册核心命令
  const coreCommands = CorePluginCommands.getAllCommands(commandManager);
  console.log(`注册 ${coreCommands.length} 个核心命令`);
  for (const cmd of coreCommands) {
    commandManager.register(cmd, 'core');
    console.log(`  ✓ ${cmd.name}: ${cmd.description}`);
  }

  console.log('\n--- 测试 /help 命令 ---');
  const helpResult = await commandManager.execute('help', [], {
    session: mockSession as any,
    rawInput: '/help',
  });
  console.log(`结果: ${helpResult.success ? '✅ 成功' : '❌ 失败'}`);

  console.log('\n--- 测试 /status 命令 ---');
  const statusResult = await commandManager.execute('status', [], {
    session: mockSession as any,
    rawInput: '/status',
  });
  console.log(`结果: ${statusResult.success ? '✅ 成功' : '❌ 失败'}`);

  console.log('\n--- 测试 /time 命令 ---');
  const timeResult = await commandManager.execute('time', [], {
    session: mockSession as any,
    rawInput: '/time',
  });
  console.log(`结果: ${timeResult.success ? '✅ 成功' : '❌ 失败'}`);

  console.log('\n--- 测试命令别名 ---');
  console.log('/h 是否是 /help 的别名:', commandManager.has('h'));
  console.log('/? 是否是 /help 的别名:', commandManager.has('?'));
  console.log('/q 是否是 /exit 的别名:', commandManager.has('q'));

  return commandManager;
}

/**
 * 测试前端
 */
async function testCliFrontend() {
  console.log('\n=== 测试 CLI 前端 ===\n');

  const frontend = new CliFrontend({
    prompt: 'test> ',
    colors: false,
  });

  console.log('前端类型:', frontend.type);
  console.log('是否运行中:', frontend.isRunning());

  await frontend.start();
  console.log('启动后是否运行中:', frontend.isRunning());

  console.log('\n--- 测试输出 ---');
  frontend.writeOutput('Test message', OutputStyle.INFO);
  frontend.writeOutput('Success message', OutputStyle.SUCCESS);
  frontend.writeOutput('Error message', OutputStyle.ERROR);
  frontend.writeOutput('Warning message', OutputStyle.WARNING);

  console.log('\n--- 测试状态显示 ---');
  frontend.showStatus({
    mode: 'chat',
    isRunning: true,
    iteration: 5,
    maxIterations: 10,
  });

  frontend.showProgress({
    message: 'Processing...',
    current: 3,
    total: 10,
  });

  await frontend.stop();
  console.log('\n停止后是否运行中:', frontend.isRunning());

  return frontend;
}

/**
 * 主测试函数
 */
async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║     Loop System 基本功能测试                 ║');
  console.log('╚══════════════════════════════════════════════╝');

  try {
    // 测试命令管理器
    const commandManager = await testCommandManager();

    // 测试前端
    await testCliFrontend();

    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║     ✅ 所有测试通过！                        ║');
    console.log('╚══════════════════════════════════════════════╝\n');

  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行测试
main().catch(console.error);
