/**
 * Logger Utility
 *
 * 提供统一的日志输出接口，支持不同日志级别和输出目标
 * 用于替代直接使用 console.log，以便在静默模式下禁用所有日志
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4, // 完全静默，不输出任何日志
}

/**
 * 日志颜色
 */
const LOG_COLORS = {
  DEBUG: '\x1b[36m', // Cyan
  INFO: '\x1b[32m',  // Green
  WARN: '\x1b[33m',  // Yellow
  ERROR: '\x1b[31m', // Red
  RESET: '\x1b[0m',
};

/**
 * 日志级别名称
 */
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.SILENT]: 'SILENT',
};

/**
 * Logger 类
 */
export class Logger {
  private logLevel: LogLevel;
  private logFile?: string;
  private useColors: boolean;

  /**
   * 创建 Logger 实例
   *
   * @param logLevel - 日志级别（默认：INFO）
   * @param logFile - 可选的日志文件路径（如果提供，日志将写入文件而非 stderr）
   * @param useColors - 是否使用颜色（默认：true）
   */
  constructor(
    logLevel: LogLevel = LogLevel.INFO,
    logFile?: string,
    useColors: boolean = true
  ) {
    this.logLevel = logLevel;
    this.logFile = logFile;
    this.useColors = useColors && process.stderr.isTTY; // 只在 TTY 终端使用颜色
  }

  /**
   * 输出 DEBUG 级别日志
   */
  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  /**
   * 输出 INFO 级别日志
   */
  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  /**
   * 输出 WARN 级别日志
   */
  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  /**
   * 输出 ERROR 级别日志
   */
  error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  /**
   * 核心日志方法
   */
  private log(level: LogLevel, message: string, ...args: any[]): void {
    // 检查日志级别
    if (level < this.logLevel) {
      return;
    }

    // SILENT 模式不输出任何日志
    if (this.logLevel >= LogLevel.SILENT) {
      return;
    }

    // 格式化日志消息
    const timestamp = new Date().toISOString();
    const levelName = LOG_LEVEL_NAMES[level];
    const prefix = `[${timestamp}] [${levelName}]`;

    // 构建完整消息
    let fullMessage = `${prefix} ${message}`;
    if (args.length > 0) {
      fullMessage += ' ' + args.map(arg => this.formatArg(arg)).join(' ');
    }

    // 输出日志
    if (this.logFile) {
      // 写入文件
      try {
        fs.appendFileSync(this.logFile, fullMessage + '\n', 'utf-8');
      } catch (error) {
        // 如果文件写入失败，回退到 stderr
        process.stderr.write(fullMessage + '\n');
      }
    } else {
      // 输出到 stderr（带颜色）
      if (this.useColors) {
        const levelName = LOG_LEVEL_NAMES[level] as keyof typeof LOG_COLORS;
        const color = LOG_COLORS[levelName];
        process.stderr.write(`${color}${fullMessage}${LOG_COLORS.RESET}\n`);
      } else {
        process.stderr.write(fullMessage + '\n');
      }
    }
  }

  /**
   * 格式化参数
   */
  private formatArg(arg: any): string {
    if (typeof arg === 'string') {
      return arg;
    }
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }

  /**
   * 设置日志级别
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * 获取当前日志级别
   */
  getLogLevel(): LogLevel {
    return this.logLevel;
  }
}

/**
 * 创建默认的全局 Logger
 *
 * @param silent - 是否静默模式
 * @param logFile - 可选的日志文件路径
 * @returns Logger 实例
 */
export function createDefaultLogger(silent: boolean = false, logFile?: string): Logger {
  const logLevel = silent ? LogLevel.SILENT : LogLevel.INFO;
  return new Logger(logLevel, logFile);
}

/**
 * 从字符串解析日志级别
 *
 * @param levelStr - 日志级别字符串（debug, info, warn, error, silent）
 * @returns LogLevel 枚举值
 */
export function parseLogLevel(levelStr: string): LogLevel {
  const normalized = levelStr.toLowerCase();
  switch (normalized) {
    case 'debug':
      return LogLevel.DEBUG;
    case 'info':
      return LogLevel.INFO;
    case 'warn':
    case 'warning':
      return LogLevel.WARN;
    case 'error':
      return LogLevel.ERROR;
    case 'silent':
    case 'quiet':
    case 'none':
      return LogLevel.SILENT;
    default:
      return LogLevel.INFO;
  }
}
