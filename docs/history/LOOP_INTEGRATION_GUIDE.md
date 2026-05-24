# Loop 系统集成指南

## 概述

Loop 系统是 Newma (牛码) CLI 的插件化重构架构，允许完全自定义执行流程和前端交互。

## 核心组件

### 1. LoopFrontend（前端抽象）

```typescript
import { CliFrontend } from './loop/frontends/cli-frontend';

const frontend = new CliFrontend({
  prompt: '[newma] ❯ ',
  colors: true,
  debug: false,
});
```

### 2. LoopSession（会话管理）

```typescript
import { LoopSessionManagerAdapter } from './loop/core/session-adapter';
import { SessionManager } from './session';

const sessionManager = new SessionManager(projectRoot, config, options);
const session = new LoopSessionManagerAdapter(
  sessionManager,
  frontend,
  hookSystem,
  { maxIterations: 10 }
);
```

### 3. FlowController（流程控制）

```typescript
import { DefaultFlowController } from './loop/core/default-flow-controller';

const flowController = new DefaultFlowController({
  commandManager,
  session,
  frontend,
  aiHandler: async (input, mode) => {
    // AI 处理逻辑
    return result;
  },
});
```

### 4. LoopEngine（核心引擎）

```typescript
import { LoopEngine } from './loop/core/loop-engine';

const engine = new LoopEngine(
  frontend,
  flowController,
  session,
  {
    enableCommands: true,
    enablePlugins: true,
    maxRedirects: 10,
  }
);

// 启动引擎
await engine.start();
```

## 使用 Loop 系统

### 基础用法

```typescript
// src/cli.ts
import { CliFrontend } from './loop/frontends/cli-frontend';
import { LoopSessionManagerAdapter } from './loop/core/session-adapter';
import { DefaultFlowController } from './loop/core/default-flow-controller';
import { LoopEngine } from './loop/core/loop-engine';
import { CommandManager } from './loop/commands/command-manager';
import { CorePluginCommands } from './loop/plugins/core-plugin';

async function startInteractiveMode(options: any): Promise<void> {
  // 1. 创建前端
  const frontend = new CliFrontend({
    prompt: '[newma] ❯ ',
    colors: true,
  });

  // 2. 创建会话
  const sessionManager = new SessionManager(projectRoot, config, options);
  const hookSystem = new HookSystem({ enabled: false });
  const session = new LoopSessionManagerAdapter(
    sessionManager,
    frontend,
    hookSystem
  );

  // 3. 创建命令管理器
  const commandManager = new CommandManager();

  // 注册核心命令
  const coreCommands = CorePluginCommands.getAllCommands(commandManager);
  for (const cmd of coreCommands) {
    commandManager.register(cmd, 'core');
  }

  // 4. 创建流程控制器
  const flowController = new DefaultFlowController({
    commandManager,
    session,
    frontend,
    aiHandler: async (input, mode) => {
      // 集成现有的 AI 处理逻辑
      if (mode === 'chat') {
        return await chatAI(config, input, signal);
      } else if (mode === 'plan') {
        return await callAI(config, projectInfo, input, 'plan');
      }
    },
  });

  // 5. 创建引擎
  const engine = new LoopEngine(
    frontend,
    flowController,
    session,
    {
      enableCommands: true,
      enablePlugins: true,
    }
  );

  // 6. 启动
  await engine.start();
}
```

### 注册自定义命令

```typescript
import { Command } from './loop/commands/types';

// 创建自定义命令
const customCommand: Command = {
  name: 'greet',
  description: 'Greet the user',
  handler: async (context) => {
    const { args } = context;
    const name = args[0] || 'World';
    console.log(`Hello, ${name}!`);
    return { success: true, output: `Greeted ${name}` };
  },
  config: {
    aliases: ['hello', 'hi'],
  },
  help: {
    name: 'greet',
    description: 'Greet the user',
    usage: '/greet [name]',
    examples: ['/greet', '/greet Alice'],
    category: 'custom',
  },
};

// 注册命令
commandManager.register(customCommand, 'my-plugin');
```

### 创建 Loop 插件

```typescript
import { LoopPlugin, LoopPluginContext, BeforeInputResult } from './loop/interfaces/plugin';

export class MyPlugin implements LoopPlugin {
  id = 'my-plugin';
  name = 'My Plugin';
  description = 'My custom loop plugin';
  version = '1.0.0';
  type = 'loop';

  tools = [];
  config = { enabled: true };

  async initialize(context: any): Promise<void> {
    console.log('My plugin initialized!');
  }

  async onBeforeInput(
    input: string,
    context: LoopPluginContext
  ): Promise<BeforeInputResult> {
    // 预处理输入
    if (input.startsWith('!')) {
      // 特殊快捷命令
      return {
        shouldContinue: true,
        modifiedInput: `/plan ${input.slice(1)}`,
      };
    }

    return { shouldContinue: true };
  }

  async onAfterInput(
    result: any,
    context: LoopPluginContext
  ): Promise<any> {
    // 后处理结果
    console.log('Result:', result);
    return { shouldContinue: true };
  }
}
```

## 架构优势

### 1. 前端可替换

```typescript
// CLI 前端
const cliFrontend = new CliFrontend();

// Web 前端（未来）
const webFrontend = new WebFrontend(socket);

// IPC 前端（未来）
const ipcFrontend = new IpcFrontend(worker);
```

### 2. 流程可控制

插件可以在任何阶段介入：
- 输入前：修改、跳过、重定向
- 输入后：修改结果、停止执行
- 执行前：修改计划
- 执行后：处理错误、记录日志

### 3. 命令可扩展

```typescript
// 插件可以注册新命令
commandManager.register({
  name: 'deploy',
  description: 'Deploy to production',
  handler: async (context) => {
    // 部署逻辑
  },
});
```

### 4. 多前端支持

同一核心逻辑可以运行在：
- 终端（CLI）
- 浏览器（Web）
- 桌面应用（IPC）
- 测试环境（Mock Frontend）

## 迁移指南

### 从现有 REPLManager 迁移

```typescript
// 旧代码
const repl = new REPLManager(session);
repl.start();

// 新代码（逐步迁移）
const sessionManager = new SessionManager(projectRoot, config, options);
const frontend = new CliFrontend();
const session = new LoopSessionManagerAdapter(sessionManager, frontend);
const flowController = new DefaultFlowController({...});
const engine = new LoopEngine(frontend, flowController, session);
await engine.start();
```

### 兼容性

- ✅ REPLManager API 保持不变
- ✅ 所有现有命令继续工作
- ✅ 插件系统向下兼容
- ✅ Hook 系统向下兼容

## 测试

### 单元测试

```typescript
import { MockFrontend } from './test/mock-frontend';

describe('LoopEngine', () => {
  it('should process input correctly', async () => {
    const frontend = new MockFrontend();
    const session = new MockSession();
    const controller = new MockFlowController();

    const engine = new LoopEngine(frontend, controller, session);

    await engine.start();

    // 测试逻辑
  });
});
```

## 最佳实践

1. **使用适配器模式**：复用现有组件，逐步迁移
2. **保持接口简洁**：只暴露必要的功能
3. **插件独立性**：每个插件只做一件事
4. **错误处理**：所有异步操作都要 try-catch
5. **文档优先**：为每个插件编写清晰的文档

## 未来改进

- [ ] Web 前端实现
- [ ] IPC 前端实现
- [ ] 更多插件示例
- [ ] 插件市场
- [ ] 可视化流程编辑器
- [ ] 性能监控和优化

## 相关文档

- [CLAUDE.md](./CLAUDE.md) - 项目架构文档
- [LOOP_PLUGIN_API.md](./LOOP_PLUGIN_API.md) - 插件 API 参考（待创建）
- [EXAMPLES.md](./EXAMPLES.md) - 示例集合（待创建）
