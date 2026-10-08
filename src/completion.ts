/**
 * Tab Auto-Completion System
 *
 * 为 REPL 提供智能 tab 补全功能
 * 支持命令、文件路径、选项值等多种补全
 */

import readline from 'readline';
import fs from 'fs';
import path from 'path';

/**
 * 补全类型
 */
export enum CompletionType {
  COMMAND = 'command',       // 命令补全
  FILE = 'file',            // 文件路径补全
  OPTION = 'option',        // 选项值补全
  HISTORY = 'history',      // 历史命令补全
}

/**
 * 补全结果
 */
export interface CompletionResult {
  /**
   * 补全候选列表
   */
  candidates: string[];

  /**
   * 补全类型
   */
  type: CompletionType;
}

/**
 * 补全配置
 */
export interface CompletionConfig {
  /**
   * 可用命令列表
   */
  commands: string[];

  /**
   * 命令别名映射
   */
  aliases: Map<string, string>;

  /**
   * 命令选项映射（命令名 -> 选项列表）
   */
  commandOptions: Map<string, string[]>;

  /**
   * 选项值映射（选项名 -> 可选值列表）
   */
  optionValues: Map<string, string[]>;

  /**
   * 历史命令列表
   */
  history: string[];

  /**
   * 项目根目录（用于文件补全）
   */
  projectRoot: string;
}

/**
 * 自动补全器
 */
export class AutoCompleter {
  private config: CompletionConfig;

  constructor(config: Partial<CompletionConfig> = {}) {
    this.config = {
      commands: config.commands || [],
      aliases: config.aliases || new Map(),
      commandOptions: config.commandOptions || new Map(),
      optionValues: config.optionValues || new Map(),
      history: config.history || [],
      projectRoot: config.projectRoot || process.cwd(),
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<CompletionConfig>): void {
    if (config.commands) this.config.commands = config.commands;
    if (config.aliases) this.config.aliases = config.aliases;
    if (config.commandOptions) this.config.commandOptions = config.commandOptions;
    if (config.optionValues) this.config.optionValues = config.optionValues;
    if (config.history) this.config.history = config.history;
    if (config.projectRoot) this.config.projectRoot = config.projectRoot;
  }

  /**
   * 获取历史记录
   */
  getHistory(): string[] {
    return this.config.history;
  }

  /**
   * 更新历史记录
   */
  updateHistory(history: string[]): void {
    this.config.history = history;
  }

  /**
   * 创建 readline completer 函数
   */
  createCompleter(): readline.Completer {
    return (line: string) => {
      const result = this.complete(line);
      // Node.js readline completer 返回格式: [candidates, line]
      // 第二个参数是替换文本,应该是原始输入行,而不是补全类型
      return [result.candidates, line];
    };
  }

  /**
   * 执行补全
   */
  complete(line: string): CompletionResult {
    // 去除首尾空格用于空行检查
    const trimmed = line.trim();

    // 空行：补全所有命令
    if (!trimmed) {
      return {
        candidates: this.config.commands,
        type: CompletionType.COMMAND,
      };
    }

    // 命令补全 - 传入原始 line 以保留尾部空格信息
    // 检查是否以 / 开头或者是别名
    const isCommand = trimmed.startsWith('/') ||
                      this.config.aliases.has(trimmed.toLowerCase()) ||
                      this.config.aliases.has(trimmed);

    if (isCommand) {
      return this.completeCommand(line);
    }

    // 文件路径补全 - 传入原始 line 以保留尾部空格信息
    if (this.looksLikePath(trimmed)) {
      return this.completePath(line);
    }

    // 默认：返回空结果（不补全）
    return {
      candidates: [],
      type: CompletionType.COMMAND,
    };
  }

  /**
   * 命令补全
   */
  private completeCommand(input: string): CompletionResult {
    // 解析输入 - 使用更好的分割方法，保留尾部空格的信息
    const hasTrailingSpace = input.endsWith(' ');
    const parts = input.trim().split(/\s+/).filter(p => p.length > 0);
    const commandPart = parts[0] || ''; // /command
    const args = parts.slice(1);

    // 如果正在输入命令名（没有空格或只有一个部分）
    if (!hasTrailingSpace && parts.length <= 1) {
      const matches = this.filterCandidates(
        commandPart,
        this.getAllCommandNames()
      );
      return {
        candidates: matches,
        type: CompletionType.COMMAND,
      };
    }

    // 如果已经输入了命令，补全参数
    const commandName = commandPart.toLowerCase();

    // 检查是否是特殊命令（需要参数补全）
    if (commandName === '/set') {
      return this.completeSetCommand(args, hasTrailingSpace);
    }

    if (commandName === '/help') {
      return this.completeHelpCommand(args, hasTrailingSpace);
    }

    // 其他命令：尝试文件路径补全
    if (args.length > 0) {
      const lastArg = args[args.length - 1];
      if (hasTrailingSpace || this.looksLikePath(lastArg)) {
        return this.completePath(lastArg || '');
      }
    }

    // 默认：没有补全建议
    return {
      candidates: [],
      type: CompletionType.OPTION,
    };
  }

  /**
   * /set 命令补全
   */
  private completeSetCommand(args: string[], hasTrailingSpace: boolean): CompletionResult {
    // /set 命令的选项
    const setOptions = [
      'ultrathink',
      'fft',
      'landmark',
      'verify',
      'useTools',
      'debug',
      'compress',
      'autoFix',
      'autoOptimize',
      'executionMode',
      'permissionLevel',
    ];

    // 没有参数：补全选项名
    if (args.length === 0) {
      return {
        candidates: setOptions,
        type: CompletionType.OPTION,
      };
    }

    // 有一个参数
    if (args.length === 1) {
      // 没有尾部空格：补全选项名
      if (!hasTrailingSpace) {
        const matches = this.filterCandidates(args[0], setOptions);
        return {
          candidates: matches,
          type: CompletionType.OPTION,
        };
      }

      // 有尾部空格：检查第一个参数是否是有效的选项名
      const optionName = args[0].toLowerCase();
      if (setOptions.includes(optionName) || setOptions.some(o => o.toLowerCase() === optionName)) {
        // 是有效的选项名，补全值
        return this.completeSetValue(optionName, '');
      }

      // 不是有效的选项名，仍然补全选项名
      return {
        candidates: setOptions,
        type: CompletionType.OPTION,
      };
    }

    // 有两个或更多参数：补全值
    const optionName = args[0].toLowerCase();
    const valuePrefix = hasTrailingSpace ? '' : (args[args.length - 1] || '');

    return this.completeSetValue(optionName, valuePrefix);
  }

  /**
   * 补全 /set 命令的值
   */
  private completeSetValue(optionName: string, valuePrefix: string): CompletionResult {
    // Boolean 选项
    if (['ultrathink', 'fft', 'landmark', 'verify', 'useTools', 'debug', 'compress', 'autoFix', 'autoOptimize'].includes(optionName)) {
      const matches = this.filterCandidates(valuePrefix, ['true', 'false']);
      return {
        candidates: matches,
        type: CompletionType.OPTION,
      };
    }

    // executionMode 选项
    if (optionName === 'executionmode') {
      const matches = this.filterCandidates(valuePrefix, ['standard', 'function-calling', 'two-phase', 'multi-agent', 'subagent']);
      return {
        candidates: matches,
        type: CompletionType.OPTION,
      };
    }

    // permissionLevel 选项
    if (optionName === 'permissionlevel') {
      const matches = this.filterCandidates(valuePrefix, ['read_only', 'safe', 'standard', 'dangerous']);
      return {
        candidates: matches,
        type: CompletionType.OPTION,
      };
    }

    return {
      candidates: [],
      type: CompletionType.OPTION,
    };
  }

  /**
   * /help 命令补全
   */
  private completeHelpCommand(args: string[], hasTrailingSpace: boolean): CompletionResult {
    // /help 可以接受分类名称
    const categories = ['general', 'planning', 'execution', 'verification', 'advanced'];

    // 没有参数或有尾部空格：显示所有分类
    if (args.length === 0 || (args.length === 1 && hasTrailingSpace)) {
      return {
        candidates: categories,
        type: CompletionType.OPTION,
      };
    }

    // 有参数但没有尾部空格：补全分类名
    if (args.length === 1 && !hasTrailingSpace) {
      const matches = this.filterCandidates(args[0], categories);
      return {
        candidates: matches,
        type: CompletionType.OPTION,
      };
    }

    // 其他情况：没有补全
    return {
      candidates: [],
      type: CompletionType.OPTION,
    };
  }

  /**
   * 文件路径补全
   */
  private completePath(inputPath: string): CompletionResult {
    try {
      // 解析路径
      let searchDir = this.config.projectRoot;
      let prefix = '';

      // 处理绝对路径
      if (path.isAbsolute(inputPath)) {
        searchDir = path.dirname(inputPath) || '/';
        prefix = path.basename(inputPath);
      } else {
        // 相对路径
        const inputDir = path.dirname(inputPath);
        if (inputDir && inputDir !== '.') {
          searchDir = path.resolve(this.config.projectRoot, inputDir);
        }
        prefix = path.basename(inputPath);
      }

      // 读取目录
      if (!fs.existsSync(searchDir)) {
        return {
          candidates: [],
          type: CompletionType.FILE,
        };
      }

      const entries = fs.readdirSync(searchDir, { withFileTypes: true });

      // 过滤并格式化
      const candidates: string[] = [];
      for (const entry of entries) {
        if (entry.name.startsWith(prefix)) {
          // 添加目录标记
          const suffix = entry.isDirectory() ? '/' : '';
          candidates.push(entry.name + suffix);
        }
      }

      return {
        candidates,
        type: CompletionType.FILE,
      };
    } catch (error) {
      // 出错时返回空结果
      return {
        candidates: [],
        type: CompletionType.FILE,
      };
    }
  }

  /**
   * 判断输入是否像文件路径
   */
  private looksLikePath(input: string): boolean {
    // 包含路径分隔符
    if (input.includes('/') || input.includes('\\')) {
      return true;
    }

    // 包含文件扩展名
    if (input.includes('.')) {
      return true;
    }

    return false;
  }

  /**
   * 过滤候选列表
   */
  private filterCandidates(prefix: string, candidates: string[]): string[] {
    const lowerPrefix = prefix.toLowerCase();
    return candidates.filter(c => c.toLowerCase().startsWith(lowerPrefix));
  }

  /**
   * 获取所有命令名称（包括别名）
   */
  private getAllCommandNames(): string[] {
    const names = new Set(this.config.commands);

    // 添加别名（包括别名本身）
    for (const [alias, command] of this.config.aliases) {
      names.add(alias);
      names.add(command);
    }

    return Array.from(names).sort();
  }
}

/**
 * 创建默认的补全配置
 */
export function createDefaultCompletionConfig(projectRoot: string): Partial<CompletionConfig> {
  return {
    commands: [
      // Core commands
      '/help',
      '/status',
      '/history',
      '/clear',
      '/exit',
      '/time',
      '/skills',
      // Mode commands
      '/chat',
      '/plan',
      '/do',
      '/loop',
      '/execute',
      '/verify',
      // Settings commands
      '/set',
      '/fft',
      '/landmark',
      '/ultrathink',
      '/profile',
      // System commands
      '/plugins',
      '/hooks',
      // Event commands
      '/event-source',
      // Memory commands
      '/decision',
      '/decisions',
      '/memo-index',
      '/find',
      '/memo-doc',
      '/memo-stats',
      '/tasks',
      '/task-search',
      '/memory-history',
      '/memory-errors',
      '/memory-prefs',
      '/memory-sessions',
      '/memory-reasoning',
      '/memory-stats',
      // 🎮 Game save & galgame branch commands
      '/save',
      '/saves',
      '/load',
      '/tree',
      '/flags',
      '/back-to',
      '/next',
      '/continue',
      '/resume-session',
      // System & mode commands（与 handleSpecialCommand 分发保持一致）
      '/quit',
      '/state',
      '/state-history',
      '/runtime-toggle',
      '/use-runtime',
      '/runtime-status',
      '/preset',
      '/mode',
      '/modes',
      '/intent',
      '/init',
      '/create-plugin',
      '/plugin-list',
      '/undo',
      '/diff',
      '/task',
      '/resume',
      '/memory-search',
      // ⏰ Precipitation
      '/drafts',
      '/approve',
      '/reject',
      '/view-draft',
      '/delete-draft',
      '/precipitate',
      '/precipitation-status',
      '/precipitation-schedule',
      // 🤖 Subagent
      '/claude',
      '/complexity',
      '/subagents',
      // Skills
      '/skill-list',
      '/skill-info',
      '/skill-install',
      '/skill-uninstall',
      '/skill-search',
      // Review
      '/review-on',
      '/review-off',
      '/review-bypass',
    ],
    aliases: new Map([
      ['?', '/help'],
      ['h', '/help'],
      ['cls', '/clear'],
      ['quit', '/exit'],
      ['q', '/exit'],
    ]),
    projectRoot,
  };
}
