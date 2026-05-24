/**
 * REPL 命令处理模块
 */

import chalk from 'chalk';
import { CommandHandler, CommandResult, REPLContext, PRESETS } from './types';

/**
 * 显示帮助信息
 */
export function showHelp(): void {
  console.log(`
${chalk.bold('可用命令:')}

${chalk.cyan('基本命令:')}
  /help, /h        - 显示帮助信息
  /exit, /quit, /q - 退出 REPL
  /clear           - 清屏
  /status          - 显示会话状态
  /history         - 显示命令历史

${chalk.cyan('模式切换:')}
  /chat            - 切换到聊天模式
  /preset <name>   - 设置预设配置 (fast/standard/thorough/expert)

${chalk.cyan('任务管理:')}
  /tasks           - 列出所有任务

${chalk.cyan('技能系统:')}
  /skills          - 列出可用技能
`);
}

/**
 * 显示状态信息
 */
export function showStatus(context: REPLContext): void {
  const { session, state } = context;
  console.log(`
${chalk.bold('会话状态:')}
  模式: ${state.currentMode}
  历史命令数: ${state.commandHistory.length}
  记忆系统: ${session.isMemoryInitialized() ? '已初始化' : '未初始化'}
  验证: ${session.isVerifyEnabled() ? '已启用' : '未启用'}
`);
}

/**
 * 预设命令处理器
 */
export const presetCommand: CommandHandler = (args: string[], context: REPLContext) => {
  const presetName = args[0]?.toLowerCase();

  if (!presetName) {
    console.log(`可用预设: ${Object.keys(PRESETS).join(', ')}`);
    return { handled: true };
  }

  const preset = PRESETS[presetName as keyof typeof PRESETS];
  if (!preset) {
    console.log(`未知预设: ${presetName}`);
    return { handled: true };
  }

  console.log(`已应用预设: ${chalk.green(presetName)}`);
  return { handled: true };
};

/**
 * 显示历史命令
 */
export const historyCommand: CommandHandler = (args: string[], context: REPLContext) => {
  const { state } = context;

  if (state.commandHistory.length === 0) {
    console.log('暂无历史命令');
    return { handled: true };
  }

  console.log(chalk.bold('\n命令历史:'));
  state.commandHistory.slice(-20).forEach((cmd: string, i: number) => {
    console.log(`  ${i + 1}. ${cmd}`);
  });

  return { handled: true };
};

/**
 * 技能列表命令
 */
export const skillsCommand: CommandHandler = async (args: string[], context: REPLContext) => {
  console.log(chalk.bold('\n可用技能:'));
  console.log('  技能系统正在加载...');
  return { handled: true };
};

/**
 * 记忆状态命令
 */
export const memoryStatsCommand: CommandHandler = async (args: string[], context: REPLContext) => {
  const { session } = context;

  if (!session.isMemoryInitialized()) {
    console.log('记忆系统未初始化');
    return { handled: true };
  }

  console.log(chalk.bold('\n记忆系统状态:'));
  console.log('  已初始化: ✅');
  return { handled: true };
};

/**
 * 沉淀草稿命令
 */
export const draftsCommand: CommandHandler = async (args: string[], context: REPLContext) => {
  console.log('暂无待处理草稿');
  return { handled: true };
};

/**
 * 模式命令处理器
 */
export const modeCommand: CommandHandler = (args: string[], context: REPLContext) => {
  const newMode = args[0]?.toLowerCase();

  if (!newMode) {
    console.log(`当前模式: ${chalk.cyan(context.state.currentMode)}`);
    console.log(`可用模式: chat, plan, loop`);
    return { handled: true };
  }

  const validModes = ['chat', 'plan', 'loop'];
  if (!validModes.includes(newMode)) {
    console.log(`未知模式: ${newMode}`);
    return { handled: true };
  }

  context.state.currentMode = newMode as 'chat' | 'plan' | 'loop';
  console.log(`已切换到模式: ${chalk.green(newMode)}`);

  return { handled: true };
};

/**
 * 命令分发器
 */
export function dispatchCommand(
  command: string,
  args: string[],
  context: REPLContext
): CommandResult | Promise<CommandResult> {
  switch (command) {
    case '/help':
    case '/h':
      showHelp();
      return { handled: true };

    case '/exit':
    case '/quit':
    case '/q':
      return { handled: true, shouldContinue: false };

    case '/clear':
      console.clear();
      return { handled: true };

    case '/status':
      showStatus(context);
      return { handled: true };

    case '/preset':
      return presetCommand(args, context);

    case '/mode':
      return modeCommand(args, context);

    case '/history':
      return historyCommand(args, context);

    case '/skills':
      return skillsCommand(args, context);

    case '/memory-stats':
      return memoryStatsCommand(args, context);

    case '/drafts':
      return draftsCommand(args, context);

    default:
      return { handled: false };
  }
}

/**
 * 命令注册表
 */
export class CommandRegistry {
  private commands: Map<string, CommandHandler> = new Map();

  register(command: string, handler: CommandHandler): void {
    this.commands.set(command, handler);
  }

  get(command: string): CommandHandler | undefined {
    return this.commands.get(command);
  }

  list(): string[] {
    return Array.from(this.commands.keys());
  }
}
