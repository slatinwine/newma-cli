# Skills Creator - 插件生成器

Skills Creator 是 Newma (牛码) 的智能插件生成器，可以根据对话历史或用户需求自动生成、打包和测试插件。

## 功能特性

- ✨ **智能分析** - 从对话历史中提取插件需求
- 🔧 **代码生成** - AI 驱动的插件代码生成
- 📦 **打包系统** - 自动生成完整的插件包
- 🧪 **自动测试** - 生成测试代码并运行验证
- 🎨 **模板系统** - 多种插件模板可选

## 快速开始

### REPL 模式

```bash
# 启动交互模式
kode -i

# 创建插件（交互式）
> /create-plugin

# 从对话历史创建
> /create-plugin from-chat

# 从需求描述创建
> /create-plugin "创建一个天气查询插件"

# 查看帮助
> /create-plugin help
```

### 独立 CLI

```bash
# 交互式创建
kode-create-plugin interactive

# 从需求描述创建
kode-create-plugin from-requirement "创建一个天气查询插件"

# 从文件创建
kode-create-plugin from-file requirements.md

# 从聊天记录创建
kode-create-plugin from-chat chat-history.json

# 验证插件
kode-create-plugin validate ./plugins/my-plugin

# 测试插件
kode-create-plugin test ./plugins/my-plugin
```

### API 使用

```typescript
import { SkillsCreator } from './src/skills-creator';

const creator = new SkillsCreator(config, projectInfo);

// 从需求创建
await creator.createFromRequirement('创建一个天气查询插件', './plugins');

// 从对话历史创建
const messages = [
  { role: 'user', content: '我需要一个天气查询工具' },
  { role: 'assistant', content: '我可以帮你创建...' },
];
await creator.createFromChat(messages, './plugins/weather-plugin');

// 交互式创建
await creator.createInteractive('./plugins');
```

## 使用流程

### 1. 交互式创建

最简单的方式是使用交互式模式：

```bash
kode -i
> /create-plugin
```

系统会引导你完成：
1. 输入插件名称
2. 输入插件描述
3. 选择模板类型
4. 定义工具
5. 生成并打包

### 2. 从对话历史创建

如果你在 REPL 中讨论过插件需求，可以直接使用：

```bash
> /create-plugin from-chat
```

系统会：
1. 分析对话历史
2. 提取工具定义
3. 生成插件代码
4. 打包到 `plugins/` 目录

### 3. 从需求描述创建

直接提供插件需求：

```bash
> /create-plugin "创建一个天气查询插件，可以查询城市天气"
```

或使用文件：

```bash
# requirements.md
创建一个天气查询插件

功能：
- 查询城市当前天气
- 查询城市天气预报
- 支持多个城市

参数：
- city: 城市名称
- days: 预报天数（可选）
```

```bash
kode-create-plugin from-file requirements.md
```

## 插件模板

Skills Creator 支持多种模板：

### Basic（基础工具）

```bash
/create-plugin
选择模板: basic
```

适合简单的工具插件，提供基本的工具结构。

### Transformer（转换器）

用于数据转换和处理。

### Analyzer（分析器）

用于代码分析和检查。

### Integrator（集成）

用于第三方服务集成。

## 生成文件结构

```
plugins/my-plugin/
├── plugin.ts           # 主插件文件
├── package.json        # NPM 包配置
├── README.md           # 文档
├── types.ts            # TypeScript 类型定义
└── plugin.test.ts      # 测试文件
```

## 插件结构

### plugin.ts

```typescript
import type { Plugin } from '../../src/plugins/types';

const myPlugin: Plugin = {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  description: 'Plugin description',

  tools: [
    {
      name: 'my-tool',
      description: 'Tool description',
      category: 'utility',
      permissions: ['read_only'],

      handler: async (params, context) => {
        // Tool implementation
        return {
          success: true,
          output: 'Result',
        };
      },
    },
  ],

  async initialize(context) {
    console.log('Plugin initialized');
  },

  async cleanup(context) {
    console.log('Plugin cleaned up');
  },
};

export default myPlugin;
```

## 测试插件

```bash
# 运行测试
kode-create-plugin test ./plugins/my-plugin

# 或使用 Bun
cd plugins/my-plugin
bun test
```

## 加载插件

```bash
# 在 REPL 中加载
kode -i
> /plugin-load my-plugin

# 或使用脚本
bun run plugin:load
```

## 高级功能

### 自定义模板

创建自定义模板：

```typescript
// src/skills-creator/templates/custom.ts
export const customTemplate = `
// Your custom template here
`;
```

### 配置选项

```typescript
const creator = new SkillsCreator(config, projectInfo, {
  defaultTemplate: 'basic',
  defaultOutDir: './plugins',
  autoTest: true,        // 自动运行测试
  initGit: true,         // 初始化 Git
  verbose: true,         // 详细输出
});
```

### 验证插件

```bash
kode-create-plugin validate ./plugins/my-plugin
```

检查：
- 必需文件存在
- package.json 格式正确
- 插件结构有效

## 最佳实践

### 1. 需求描述

提供清晰的需求描述：

✅ 好的描述：
```
创建一个天气查询插件
- 工具1: 查询城市当前天气
  参数: city (string, required)
  权限: read_only
- 工具2: 查询未来3天天气预报
  参数: city (string, required), days (number, optional)
```

❌ 不好的描述：
```
做一个天气插件
```

### 2. 工具定义

明确定义每个工具：
- 名称（动词开头）
- 描述（清晰说明功能）
- 参数（类型、是否必需、默认值）
- 权限（read_only, safe, standard, dangerous）

### 3. 测试

生成后立即测试：

```bash
# 1. 生成插件
> /create-plugin "创建天气插件"

# 2. 验证
> !kode-create-plugin validate ./plugins/weather-plugin

# 3. 测试
> !kode-create-plugin test ./plugins/weather-plugin

# 4. 加载
> /plugin-load weather-plugin
```

### 4. 迭代

根据测试结果调整：

1. 检查生成的代码
2. 修改工具实现
3. 添加错误处理
4. 更新文档
5. 重新测试

## 故障排除

### 分析失败

```
⚠️ Low confidence in analysis
Missing: tool parameters
```

**解决**：提供更详细的需求描述或手动补充信息。

### 生成失败

```
❌ Failed to generate plugin
```

**解决**：
1. 检查 API 配置
2. 查看详细错误日志
3. 使用 `--verbose` 选项

### 测试失败

```
❌ Some tests failed
```

**解决**：
1. 检查工具实现
2. 验证参数处理
3. 查看测试输出

## 示例

### 创建简单的计算器插件

```bash
> /create-plugin "创建一个计算器插件，包含加法和乘法工具"
```

生成：

```typescript
const calculatorPlugin: Plugin = {
  id: 'calculator-plugin',
  name: 'Calculator Plugin',
  version: '1.0.0',
  description: 'A simple calculator plugin',

  tools: [
    {
      name: 'add',
      description: 'Add two numbers',
      category: 'utility',
      permissions: ['read_only'],

      handler: async (params) => {
        const { a, b } = params;
        return {
          success: true,
          output: Number(a) + Number(b),
        };
      },
    },
    {
      name: 'multiply',
      description: 'Multiply two numbers',
      category: 'utility',
      permissions: ['read_only'],

      handler: async (params) => {
        const { a, b } = params;
        return {
          success: true,
          output: Number(a) * Number(b),
        };
      },
    },
  ],
};
```

## 相关文档

- [Bun 插件系统](./BUN_PLUGINS.md)
- [插件类型定义](./src/plugins/types.ts)
- [示例插件](./examples/hello-plugin/)
- [主 README](./README.md)

## 下一步

1. ✨ 创建你的第一个插件
2. 🧪 运行测试验证
3. 📖 完善文档
4. 🚀 分享插件

开始使用 Skills Creator，快速构建你的插件！🎨
