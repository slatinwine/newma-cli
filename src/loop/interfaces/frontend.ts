/**
 * Loop Frontend Interface
 *
 * 抽象不同前端（CLI、Web、IPC）的输入输出操作
 * 使得 Loop 引擎可以在不同环境下运行
 */

/**
 * 输出样式枚举
 */
export enum OutputStyle {
  DEFAULT = 'default',
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  DEBUG = 'debug',
  CODE = 'code',
}

/**
 * 兼容性别名
 */
export type OutputStyleType = OutputStyle;

/**
 * Loop 状态信息
 */
export interface LoopStatus {
  mode: 'chat' | 'plan' | 'execute' | 'verify' | 'loop';
  isRunning: boolean;
  iteration?: number;
  maxIterations?: number | null;
}

/**
 * 进度信息
 */
export interface ProgressInfo {
  message: string;
  current?: number;
  total?: number;
  percentage?: number;
}

/**
 * 前端接口
 *
 * 定义了 Loop 引擎与用户交互的抽象接口
 * 任何前端（CLI、Web、IPC）都需要实现这个接口
 */
export interface LoopFrontend {
  /**
   * 前端类型标识
   */
  readonly type: 'cli' | 'web' | 'ipc' | 'test' | 'tui';

  /**
   * 读取用户输入
   * @param prompt - 可选的提示符
   * @returns 用户输入的文本
   */
  readInput(prompt?: string): Promise<string>;

  /**
   * 输出内容
   * @param content - 要输出的内容
   * @param style - 输出样式
   */
  writeOutput(content: string, style?: OutputStyle): void;

  /**
   * 输出错误信息
   * @param content - 错误内容
   */
  writeError(content: string): void;

  /**
   * 清空屏幕
   */
  clearScreen(): void;

  /**
   * 显示状态信息
   * @param status - 当前 loop 状态
   */
  showStatus(status: LoopStatus): void;

  /**
   * 显示进度信息
   * @param progress - 进度信息
   */
  showProgress(progress: ProgressInfo): void;

  /**
   * 启动前端
   */
  start(): Promise<void>;

  /**
   * 停止前端
   */
  stop(): Promise<void>;

  /**
   * 检查前端是否正在运行
   */
  isRunning(): boolean;

  /**
   * 设置中断处理器
   * @param handler - 中断处理函数
   */
  setInterruptHandler(handler: () => void): void;
}

/**
 * 前端配置基类
 */
export interface FrontendConfig {
  /**
   * 提示符
   */
  prompt?: string;

  /**
   * 是否启用颜色
   */
  colors?: boolean;

  /**
   * 是否启用调试模式
   */
  debug?: boolean;

  /**
   * 其他配置选项
   */
  [key: string]: any;
}
