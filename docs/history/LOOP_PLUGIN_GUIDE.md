# Loop 插件开发指南

**版本**: 3.3.0
**最后更新**: 2026-01-24

## 📋 目录

- [插件类型](#插件类型)
- [快速开始](#快速开始)
- [命令插件开发](#命令插件开发)
- [Loop 插件开发](#loop-插件开发)
- [示例插件](#示例插件)
- [安全最佳实践](#安全最佳实践)

---

## 插件类型

### 1. 命令插件 (Command Plugin)
添加自定义 `/` 命令

### 2. Loop 插件 (Loop Plugin)
控制执行流程，拦截输入/输出

---

## 快速开始

### 创建最简单的命令

```typescript
import { Command } from './src/loop/commands/types';

export const helloCommand: Command = {
  name: 'hello',
  description: 'Say hello',

  handler: async (context) => {
    const { args } = context;
    const name = args[0] || 'World';
    console.log(`Hello, ${name}!`);

    return { success: true, output: `Greeted ${name}` };
  },

  help: {
    name: 'hello',
    description: 'Say hello to someone',
    usage: '/hello [name]',
    examples: ['/hello', '/hello Claude'],
    category: 'custom',
  },
};

// 注册命令
import { CommandManager } from './src/loop/commands/command-manager';
const manager = new CommandManager();
manager.register(helloCommand, 'my-plugin');
```

---

## 命令插件开发

### 基本结构

```typescript
import { Command, CommandContext, CommandResult } from './src/loop/commands/types';

interface Command {
  name: string;
  description: string;
  handler: (context: CommandContext) => Promise<CommandResult>;
  config?: {
    enabled?: boolean;
    aliases?: string[];
  };
  help?: {
    name: string;
    description: string;
    usage?: string;
    examples?: string[];
    category?: string;
  };
}

interface CommandContext {
  session: LoopSession;
  args: string[];
  rawInput: string;
  userData: Map<string, any>;
}

interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, any>;
}
```

### 示例：Git 命令

```typescript
import { Command } from './src/loop/commands/types';
import { execFileNoThrow } from './utils/execFileNoThrow';

export const gitCommand: Command = {
  name: 'git',
  description: 'Git operations shortcut',

  handler: async (context): Promise<CommandResult> => {
    const { args, session } = context;

    if (args.length === 0) {
      return {
        success: false,
        error: 'Usage: /git <command> [args...]'
      };
    }

    // ✅ 安全：使用 execFileNoThrow
    const result = await execFileNoThrow('git', args, {
      cwd: session.projectRoot,
    });

    if (result.status !== 0) {
      return {
        success: false,
        error: `Git failed: ${result.stderr}`,
      };
    }

    console.log(result.stdout);
    return {
      success: true,
      output: `Git: ${args.join(' ')}`,
    };
  },

  config: {
    aliases: ['g'],
  },

  help: {
    name: 'git',
    description: 'Execute git commands',
    usage: '/git <command> [args...]',
    examples: ['/git status', '/git log -5'],
    category: 'development',
  },
};
```

---

## Loop 插件开发

### 基本结构

```typescript
import { LoopPlugin, LoopPluginContext, BeforeInputResult } from './src/loop/interfaces/plugin';

export interface LoopPlugin {
  // 基本信息
  id: string;
  name: string;
  description: string;
  version: string;
  type: 'loop' | 'command' | 'standard';

  // 工具和配置
  tools: Tool[];
  config: Record<string, any>;

  // 生命周期
  initialize?(context: any): Promise<void>;
  cleanup?(context: any): Promise<void>;

  // 钩子函数
  onBeforeInput?(input: string, context: LoopPluginContext): Promise<BeforeInputResult>;
  onAfterInput?(result: any, context: LoopPluginContext): Promise<any>;
  onModeChange?(oldMode: string, newMode: string, context: LoopPluginContext): Promise<void>;
  onError?(error: Error, context: LoopPluginContext): Promise<boolean>;
}

interface BeforeInputResult {
  shouldContinue: boolean;
  modifiedInput?: string;
  shouldSkip?: boolean;
  redirectTo?: string;
}
```

### 示例：快捷键插件

```typescript
import chalk from 'chalk';
import { LoopPlugin, LoopPluginContext, BeforeInputResult } from './src/loop/interfaces/plugin';

export class ShortcutPlugin implements LoopPlugin {
  id = 'shortcut-plugin';
  name = 'Shortcut Plugin';
  description = 'Keyboard shortcuts';
  version = '1.0.0';
  type = 'loop';

  tools = [];
  config = {
    enabled: true,
    shortcuts: {
      '!': '/plan ',
      '??': '/help',
      'h': '/history',
    },
  };

  async initialize(context: any): Promise<void> {
    console.log(chalk.gray('[Shortcut Plugin] Initialized'));
    console.log(chalk.gray('  ! → /plan, ?? → /help'));
  }

  async onBeforeInput(
    input: string,
    context: LoopPluginContext
  ): Promise<BeforeInputResult> {
    // 检查快捷键
    for (const [shortcut, replacement] of Object.entries(this.config.shortcuts)) {
      if (input.startsWith(shortcut)) {
        const modifiedInput = input.replace(shortcut, replacement);

        console.log(chalk.gray(`[Shortcut] ${shortcut} → ${replacement}`));

        return {
          shouldContinue: true,
          modifiedInput,
        };
      }
    }

    return { shouldContinue: true };
  }
}

export default new ShortcutPlugin();
```

### 示例：调试插件

```typescript
import chalk from 'chalk';
import { LoopPlugin, LoopPluginContext } from './src/loop/interfaces/plugin';

export class DebugPlugin implements LoopPlugin {
  id = 'debug-plugin';
  name = 'Debug Plugin';
  description = 'Debug logging';
  version = '1.0.0';
  type = 'loop';

  tools = [];
  config = { enabled: true };

  private stats = {
    totalInputs: 0,
    executionTimes: [] as number[],
  };

  async onBeforeInput(input: string): Promise<any> {
    const startTime = Date.now();

    // 保存到上下文
    (this as any).currentStartTime = startTime;
    this.stats.totalInputs++;

    console.log(chalk.gray(`[Debug] Input: "${input}"`));

    return { shouldContinue: true };
  }

  async onAfterInput(result: any, context: any): Promise<any> {
    const startTime = (this as any).currentStartTime;
    const duration = Date.now() - startTime;

    this.stats.executionTimes.push(duration);

    console.log(chalk.gray(`[Debug] Result: ${result.type}`));
    console.log(chalk.gray(`[Debug] Timing: ${duration}ms`));

    return { shouldContinue: true };
  }

  getStats() {
    const avgTime = this.stats.executionTimes.length > 0
      ? this.stats.executionTimes.reduce((a, b) => a + b, 0) / this.stats.executionTimes.length
      : 0;

    return {
      totalInputs: this.stats.totalInputs,
      averageTime: Math.round(avgTime),
      executionTimes: this.stats.executionTimes,
    };
  }
}

export default new DebugPlugin();
```

---

## 示例插件

### 1. 自定义命令插件

**文件**: `examples/loop-plugins/custom-commands-plugin.ts`

功能：
- `/git` - Git 操作快捷命令
- `/npm` - NPM 操作快捷命令
- `/env` - 环境变量管理
- `/config` - 项目配置查看

### 2. 快捷键插件

**文件**: `examples/loop-plugins/shortcut-plugin.ts`

功能：
- `!` → `/plan`
- `??` → `/help`
- 自动纠正常见拼写错误

### 3. 调试插件

**文件**: `examples/loop-plugins/debug-plugin.ts`

功能：
- 记录所有输入
- 记录执行时间
- 统计命令使用情况

---

## 安全最佳实践

### ⚠️ 命令执行安全

**❌ 危险 - 不要使用**:
```typescript
import { exec } from 'child_process';
exec(`git ${userInput}`);  // 命令注入风险
```

**✅ 安全 - 使用工具**:
```typescript
import { execFileNoThrow } from './utils/execFileNoThrow';

const result = await execFileNoThrow('git', args, {
  cwd: session.projectRoot,
});

if (result.status !== 0) {
  return {
    success: false,
    error: `Command failed: ${result.stderr}`,
  };
}
```

### ✅ 其他安全建议

1. **输入验证**
```typescript
if (args.length === 0) {
  return {
    success: false,
    error: 'Usage: /command <required-arg>',
  };
}
```

2. **路径安全**
```typescript
import path from 'path';

const safePath = path.resolve(session.projectRoot, userPath);
if (!safePath.startsWith(session.projectRoot)) {
  return {
    success: false,
    error: 'Access denied: path outside project root',
  };
}
```

3. **权限控制**
```typescript
config: {
  permissionLevel: 'safe',  // read_only | safe | standard | dangerous
}
```

4. **错误处理**
```typescript
try {
  const result = await someOperation();
  return { success: true, output: result };
} catch (error: any) {
  return {
    success: false,
    error: error.message,  // 总是返回错误信息
  };
}
```

---

## API 参考

### CommandManager

```typescript
class CommandManager {
  register(command: Command, pluginId?: string): void;
  unregister(commandName: string): void;
  get(commandName: string): Command | undefined;
  has(commandName: string): boolean;
  async execute(command: string, args: string[], context): Promise<CommandResult>;
  printHelp(category?: string): void;
}
```

### LoopFrontend

```typescript
interface LoopFrontend {
  readInput(prompt?: string): Promise<string>;
  writeOutput(content: string, style?: OutputStyle): void;
  writeError(content: string): void;
  clearScreen(): void;
  showStatus(status: LoopStatus): void;
  showProgress(progress: ProgressInfo): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}
```

### LoopSession

```typescript
interface LoopSession {
  sessionId: string;
  projectRoot: string;
  currentMode: string;
  iterationCount: number;
  config: Config;

  switchMode(mode: string): void;
  getStats(): SessionStats;
  getState(): LoopSessionState;
}
```

---

## 测试插件

### 手动测试

```typescript
// test-my-plugin.ts
import { CliFrontend } from './src/loop/frontends/cli-frontend';
import { CommandManager } from './src/loop/commands/command-manager';
import { myCommand } from './my-plugin';

const frontend = new CliFrontend();
const session = new MockSession();
const manager = new CommandManager();

// 注册命令
manager.register(myCommand, 'test');

// 执行命令
const result = await manager.execute('mycommand', ['arg1', 'arg2'], {
  session: session as any,
  rawInput: '/mycommand arg1 arg2',
});

console.log('Result:', result);
```

---

## 常见问题

### Q: 如何持久化插件数据？

**A**: 使用文件系统：
```typescript
import fs from 'fs';
import path from 'path';

async initialize(context: any) {
  const dataFile = path.join(context.projectRoot, '.kode', 'plugin-data.json');

  if (fs.existsSync(dataFile)) {
    this.data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
  }
}

async cleanup(context: any) {
  const dataFile = path.join(context.projectRoot, '.kode', 'plugin-data.json');
  fs.writeFileSync(dataFile, JSON.stringify(this.data, null, 2));
}
```

### Q: 如何处理权限？

**A**: 在命令配置中指定：
```typescript
config: {
  permissionLevel: 'standard',  // read_only | safe | standard | dangerous
}
```

### Q: 如何集成到 REPLManager？

**A**: 参考 [Loop 集成指南](./LOOP_INTEGRATION_GUIDE.md)

---

## 相关文档

- [Loop 系统集成指南](./LOOP_INTEGRATION_GUIDE.md)
- [测试报告](./LOOP_TEST_REPORT.md)
- [CLAUDE.md](./CLAUDE.md) - Phase 8

---

**最后更新**: 2026-01-24
**维护者**: Newma (牛码) Team
