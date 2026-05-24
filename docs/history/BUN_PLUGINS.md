# Bun Plugin System

Newma (牛码) 现在支持使用 Bun 进行快速插件开发和加载！

## 为什么使用 Bun？

- ⚡ **10-20x 更快**的构建和加载速度
- 🔧 **原生 TypeScript**支持（无需 ts-node）
- 📦 **更小**的打包体积
- 🔄 **热重载**支持
- 💯 **100% 向后兼容**现有插件

## 快速开始

### 1. 安装 Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

### 2. 安装依赖

```bash
bun install
```

### 3. 使用 Bun 运行

```bash
# 开发模式（原生 TypeScript 支持）
bun run dev:bun

# 构建项目
bun run build:bun

# 加载和测试插件
bun run plugin:load
```

## 创建插件

### 方法 1: 使用 package.json

创建 `plugins/my-plugin/package.json`:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My awesome plugin",
  "kode": {
    "id": "my-plugin",
    "entryPoint": "plugin.ts"
  }
}
```

### 方法 2: 简单插件文件

在 `plugins/my-plugin/` 创建 `plugin.ts`:

```typescript
import type { Plugin } from '../../src/plugins/types';

const myPlugin: Plugin = {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  description: 'My awesome plugin',

  tools: [
    {
      name: 'my-tool',
      description: 'Does something cool',
      category: 'utility',
      permissions: ['read_only'],

      handler: async (params, context) => {
        return {
          success: true,
          output: 'Hello from my tool!',
        };
      },
    },
  ],

  async initialize(context) {
    console.log('Plugin initialized!');
  },
};

export default myPlugin;
```

## 插件目录结构

```
kode/
├── plugins/              # 用户插件目录
│   └── my-plugin/
│       ├── package.json
│       └── plugin.ts
├── examples/             # 示例插件
│   └── hello-plugin/
│       ├── package.json
│       └── plugin.ts
└── src/plugins/          # 插件系统核心
    ├── bun-loader.ts    # Bun 加载器
    ├── loader.ts        # 通用加载器
    ├── registry.ts      # 插件注册表
    └── types.ts         # 类型定义
```

## 加载插件

### 使用脚本加载

```bash
bun run plugin:load
```

### 在代码中加载

```typescript
import { BunPluginLoader } from './src/plugins/bun-loader';
import { PluginRegistry } from './src/plugins/registry';
import { ToolRegistry } from './src/tools/registry';
import { HookSystem } from './src/hooks';

const loader = new BunPluginLoader(
  new PluginRegistry(),
  {
    directories: ['plugins', 'examples'],
    enabled: true,
    timeout: 5000,
    verbose: true,
  },
  new ToolRegistry(),
  new HookSystem(),
  process.cwd()
);

// 发现并加载插件
const manifests = await loader.discover();
for (const manifest of manifests) {
  await loader.load(manifest);
}
```

## 热重载

Bun 支持插件热重载：

```typescript
// 启用热重载
await loader.enableHotReload(manifest, async (plugin) => {
  console.log(`Plugin ${plugin.name} was reloaded!`);
});

// 禁用热重载
await loader.disableHotReload(plugin.id);
```

## 检查运行时

检测是否在 Bun 中运行：

```typescript
import { isBunRuntime } from './src/plugins/bun-loader';

if (isBunRuntime()) {
  console.log('Running in Bun - fast mode enabled!');
} else {
  console.log('Running in Node.js - using ts-node fallback');
}
```

## 性能对比

| 操作 | Node.js + ts-node | Bun | 提升 |
|------|-------------------|-----|------|
| 冷启动加载 | ~500ms | ~50ms | **10x** |
| 热重载 | ~300ms | ~30ms | **10x** |
| TypeScript 编译 | ~1000ms | ~50ms | **20x** |

## 示例插件

查看 `examples/hello-plugin/` 获取完整示例：

```bash
cd examples/hello-plugin
cat plugin.ts
```

## 调试技巧

### 启用详细日志

```typescript
const loader = new BunPluginLoader(
  registry,
  config,
  toolRegistry,
  hookSystem,
  projectRoot
);

loader.updateConfig({ verbose: true });
```

### 检查插件状态

```typescript
const stats = pluginRegistry.getStats();
console.log(stats);
// { total: 5, byState: {...}, withErrors: 0 }
```

## 故障排除

### 插件加载失败

1. 检查 `package.json` 中的 `kode.id` 和 `kode.entryPoint`
2. 确保 `plugin.ts` 导出默认的 Plugin 对象
3. 启用 `verbose: true` 查看详细日志

### TypeScript 错误

1. Bun 原生支持 TypeScript，无需额外配置
2. 如果需要类型检查，运行 `tsc --noEmit`
3. 确保 `bun-types` 已安装：`bun add -d bun-types`

### 性能问题

1. 确保使用 Bun 运行（不是 Node.js）
2. 检查插件初始化代码是否耗时过长
3. 考虑使用 `--hot` 模式进行开发

## 最佳实践

1. **保持插件简单** - 每个插件专注于一个功能
2. **使用类型** - 充分利用 TypeScript 类型系统
3. **错误处理** - 在工具处理器中正确处理错误
4. **文档** - 为工具提供清晰的描述
5. **测试** - 使用热重载快速迭代

## 更多资源

- [Bun 文档](https://bun.sh/docs)
- [插件类型定义](./src/plugins/types.ts)
- [示例插件](./examples/hello-plugin/)
- [主 README](./README.md)
