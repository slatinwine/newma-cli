// src/logger.ts
/**
 * Central logger with levels
 *
 * 行业级 CLI 的输出纪律：error/warn 走 stderr（脚本重定向友好），
 * info/debug 走 stdout；级别可控（--verbose 提到 debug，--silent/-q
 * 降到 warn），环境变量 NEWMA_LOG 可覆盖默认级别。
 *
 * 迁移约定：库代码里"运行时噪声"（初始化提示、周期任务心跳、
 * 可恢复错误详情）用 logger；只有面向用户的交互结果才允许直接
 * console（REPL 的回答、命令输出等）。
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LEVEL_ORDER: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

let currentLevel: LogLevel = (() => {
  const env = (typeof process !== 'undefined' && process.env.NEWMA_LOG) as
    | LogLevel
    | undefined;
  if (env && env in LEVEL_ORDER) return env;
  return 'info';
})();

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

export function isVerbose(): boolean {
  return currentLevel === 'debug';
}

function enabled(level: LogLevel): boolean {
  return LEVEL_ORDER[level] <= LEVEL_ORDER[currentLevel];
}

function emit(level: LogLevel, stream: NodeJS.WriteStream, args: unknown[]): void {
  if (!enabled(level)) return;
  const prefix = level === 'info' ? '' : `[${level}] `;
  stream.write(prefix + args.map(String).join(' ') + '\n');
}

export const logger = {
  error(...args: unknown[]): void {
    emit('error', process.stderr, args);
  },
  warn(...args: unknown[]): void {
    emit('warn', process.stderr, args);
  },
  info(...args: unknown[]): void {
    emit('info', process.stdout, args);
  },
  debug(...args: unknown[]): void {
    emit('debug', process.stdout, args);
  },
};
