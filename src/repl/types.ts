/**
 * REPL 类型定义
 */

import { SessionManager } from '../session';
import { HookSystem } from '../hooks';
import { ToolExecutor } from '../executor-v2';
import { PluginSystem } from '../plugins';
import { PrecipitationCoordinator } from '../memory/precipitation-coordinator';
import { MemoCliPlugin } from '../loop/plugins/memo-cli-plugin';

/**
 * 命令处理结果
 */
export interface CommandResult {
  handled: boolean;
  shouldContinue?: boolean;
  message?: string;
}

/**
 * REPL 配置
 */
export interface REPLConfig {
  silent?: boolean;
  enableMemory?: boolean;
  enablePrecipitation?: boolean;
  enableHistory?: boolean;
}

/**
 * REPL 状态
 */
export interface REPLState {
  isClosed: boolean;
  commandHistory: string[];
  historyIndex: number;
  pendingInput?: string;
  currentMode: 'chat' | 'plan' | 'loop';
}

/**
 * 命令处理器类型
 */
export type CommandHandler = (
  args: string[],
  context: REPLContext
) => Promise<CommandResult> | CommandResult;

/**
 * REPL 上下文
 */
export interface REPLContext {
  session: SessionManager;
  hookSystem?: HookSystem;
  toolExecutor?: ToolExecutor;
  pluginSystem?: PluginSystem;
  precipitationCoordinator?: PrecipitationCoordinator;
  memoPlugin?: MemoCliPlugin;
  state: REPLState;
}

/**
 * 预设配置
 */
export const PRESETS = {
  fast: {
    useTools: false,
    verify: false,
    ultrathink: false
  },
  standard: {
    useTools: true,
    verify: false,
    ultrathink: false
  },
  thorough: {
    useTools: true,
    verify: true,
    ultrathink: false
  },
  expert: {
    useTools: true,
    verify: true,
    ultrathink: true
  }
} as const;

/**
 * 内置命令列表
 */
export const BUILTIN_COMMANDS = [
  '/help', '/exit', '/quit', '/clear', '/status',
  '/history', '/preset', '/mode', '/chat', '/loop',
  '/ultrathink', '/tasks', '/task', '/resume',
  '/skills', '/memory-stats', '/drafts'
] as const;
