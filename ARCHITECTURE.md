# Newma (牛码) 项目架构文档

## 项目概述

Newma (牛码) 是一个企业级的 AI 驱动多智能体代码助手，基于 TypeScript 构建，采用 `plan → search → execute → verify` 循环模式。

- **版本**: 3.4.0
- **运行环境**: Node.js 22+
- **默认 AI 提供商**: Zhipu AI GLM-4.7 (OpenAI 兼容格式)

## 目录结构

```
/Users/mac/kode/
├── src/                    # 核心源代码
├── dist/                   # 编译输出
├── test/                   # 测试文件
├── examples/               # 示例代码
├── docs/                   # 文档
├── plugins/                # 插件目录
├── prompts/                # AI 提示词模板
├── public/                 # 公共资源
├── python/                 # Python 脚本
├── scripts/                # 脚本工具
├── backend/                # 后端相关
├── frontend/               # 前端相关
├── bin/                    # 可执行文件
└── templates/              # 模板文件
```

## 核心架构分层

```
┌─────────────────────────────────────────────────────────────┐
│                     用户交互层 (UI)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  CLI REPL  │  │  TUI 界面   │  │      Web 前端       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   循环引擎层 (Loop Engine)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │ 流程控制器   │  │ 插件管理器   │  │   事件源管理器    │ │
│  └──────────────┘  └──────────────┘  └───────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   执行策略层 (Strategy)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ FFT 策略    │  │ 多智能体    │  │  函数调用策略      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ 标准策略    │  │ Claude Code │  │   状态机策略        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   智能体协调层 (Agents)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │ 主协调器     │  │  子智能体    │  │   专用智能体      │ │
│  └──────────────┘  └──────────────┘  └───────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  前端智能体 │ 后端智能体 │ 文档智能体 │ 测试智能体      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   插件与技能层 (Plugins & Skills)            │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │ 插件注册表   │  │ 技能发现器   │  │   技能编译器      │ │
│  └──────────────┘  └──────────────┘  └───────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  缓存加载器 │ 并行加载器 │ 流式加载器 │ Bun 加载器    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   工具与命令层 (Tools)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │ 内置工具     │  │ Unix 命令    │  │   搜索工具        │ │
│  └──────────────┘  └──────────────┘  └───────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   内存与记忆层 (Memory)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │ 上下文管理   │  │ 执行历史     │  │   错误记忆        │ │
│  └──────────────┘  └──────────────┘  └───────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │ 推理管理器   │  │ 体验分析器   │  │   降水系统        │ │
│  └──────────────┘  └──────────────┘  └───────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   AI 集成层 (AI Integration)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │ AI 流式处理  │  │ 进度重试     │  │   压缩器          │ │
│  └──────────────┘  └──────────────┘  └───────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 核心模块详解

### 1. 循环引擎层 (src/loop/)

**核心职责**: 协调整个系统的执行流程

```
loop/
├── core/                   # 核心引擎
│   ├── loop-engine.ts      # 主循环引擎
│   ├── ai-flow-controller.ts
│   ├── default-flow-controller.ts
│   ├── loop-plugin-manager.ts
│   └── session-adapter.ts
├── commands/               # 命令管理
│   ├── command-manager.ts
│   ├── memo-commands.ts
│   ├── precipitation-commands.ts
│   └── types.ts
├── event/                  # 事件系统
│   ├── event-broker.ts
│   ├── event-source-manager.ts
│   ├── file-watcher-source.ts
│   ├── http-source.ts
│   ├── readline-source.ts
│   └── websocket-source.ts
├── frontends/              # 前端适配器
│   ├── cli-frontend.ts
│   ├── tui-frontend.ts
│   └── web-frontend.ts
├── plugins/                # 核心插件
│   ├── core-plugin.ts
│   ├── do-mode-plugin.ts
│   ├── mode-commands-plugin.ts
│   ├── plan-mode-plugin.ts
│   └── ...
└── interfaces/             # 接口定义
    ├── flow-controller.ts
    ├── frontend.ts
    ├── plugin.ts
    └── session.ts
```

### 2. 执行策略层 (src/execution/strategy/)

**核心职责**: 根据不同场景选择合适的执行策略

```
strategy/
├── claude-code-strategy.ts    # Claude Code 执行策略
├── fft-strategy.ts           # FFT 规划策略
├── function-calling-strategy.ts  # 函数调用策略
├── multi-agent-strategy.ts    # 多智能体策略
├── standard-strategy.ts       # 标准策略
├── state-machine-strategy.ts  # 状态机策略
├── sub-agent-strategy.ts      # 子智能体策略
├── strategy-executor.ts       # 策略执行器
└── types.ts
```

### 3. 智能体协调层 (src/agents/)

**核心职责**: 协调多个专业智能体完成复杂任务

```
agents/
├── agent.ts                    # 基础智能体
├── coordinator.ts              # 主协调器
├── types.ts
├── specialized/                # 专用智能体
│   ├── backend.ts             # 后端智能体
│   ├── documentation.ts       # 文档智能体
│   ├── frontend.ts            # 前端智能体
│   └── testing.ts             # 测试智能体
└── subagent/                   # 子智能体系统
    ├── base-subagent.ts
    ├── coordinator.ts
    ├── execution-subagent.ts
    ├── planning-subagent.ts
    ├── parallel-subagent.ts
    └── specialized-agents/
        ├── code-analysis-agent.ts
        ├── implementation-agent.ts
        └── testing-agent.ts
```

### 4. 插件与技能层 (src/plugins/ & src/skills/)

**核心职责**: 可扩展的插件系统和技能系统

```
plugins/
├── auto-skill-manager.ts      # 自动技能管理
├── bun-loader.ts              # Bun 加载器
├── cached-skill-loader.ts     # 缓存技能加载器
├── hybrid-manager.ts          # 混合管理器
├── parallel-skill-loader.ts   # 并行加载器
├── registry.ts                # 插件注册表
├── skill-loader.ts            # 技能加载器
└── streaming-skill-loader.ts   # 流式加载器

skills/
├── benchmark.ts               # 基准测试
├── cache.ts                   # 技能缓存
├── compiler/                  # 技能编译器
│   ├── compiler.ts
│   ├── packager.ts
│   └── types.ts
├── discovery.ts               # 技能发现
├── installer/                 # 技能安装器
├── loader.ts                  # 技能加载器
├── metadata.ts                # 元数据
├── registry/                  # 技能注册表
├── templates/                 # 技能模板
├── testing.ts                 # 技能测试
└── validation.ts              # 技能验证

skills-creator/                # 技能创建器
├── analyzer.ts                # 技能分析器
├── compiler.ts                # 技能编译器
├── enhanced-creator.ts        # 增强创建器
├── generator.ts               # 技能生成器
├── packager.ts                # 技能打包器
├── validator.ts               # 技能验证器
└── templates/                 # 创建模板
```

### 5. 内存与记忆层 (src/memory/)

**核心职责**: 管理系统状态、历史记录和学习数据

```
memory/
├── context-manager.ts         # 上下文管理器
├── error-memory.ts            # 错误记忆
├── execution-history.ts       # 执行历史
├── experience-analyzer.ts     # 体验分析器
├── precipitation-coordinator.ts  # 降水系统协调器
├── preferences-manager.ts     # 偏好管理器
├── reasoning-manager.ts       # 推理管理器
├── scheduler.ts               # 调度器
├── session-context-manager.ts # 会话上下文
├── skill-draft-manager.ts     # 技能草稿
└── skill-generator.ts         # 技能生成器
```

### 6. 工具与命令层 (src/tools/)

**核心职责**: 提供内置工具和命令

```
tools/
├── builtin/                   # 内置工具
│   ├── command.ts            # 命令工具
│   ├── file.ts               # 文件工具
│   ├── search.ts             # 搜索工具
│   ├── search-and-fetch.ts   # 搜索并获取
│   ├── unix-commands.ts      # Unix 命令
│   └── web-scrape.ts         # 网页抓取
├── registry.ts                # 工具注册表
└── types.ts
```

### 7. 高级推理层 (src/ultrathink/)

**核心职责**: Tree of Thoughts 高级推理系统

```
ultrathink/
├── cache.ts                   # 推理缓存
├── context-manager.ts         # 上下文管理
├── observer.ts                # 观察器
├── planner.ts                 # 规划器
├── react-loop.ts              # ReAct 循环
├── serializer.ts              # 序列化器
├── tracker.ts                 # 跟踪器
├── tree-of-thoughts.ts        # 思维树
├── verifier.ts                # 验证器
└── utils.ts                   # 工具函数
```

### 8. FFT 规划系统 (src/fft/)

**核心职责**: Fast Fourier Thought 快速思维规划系统

```
fft/
├── chat-fft.ts                # 聊天 FFT
├── engine.ts                  # FFT 引擎
├── planner.ts                 # FFT 规划器
└── types.ts
```

### 9. 其他核心模块

```
├── ai/                        # AI 集成
│   └── progressive-retry.ts  # 进度重试
├── cache/                      # 缓存系统
│   ├── ai-cache.ts
│   ├── cache-manager.ts
│   └── skill-cache.ts
├── compressor/                 # 内容压缩
│   ├── content.ts
│   ├── context.ts
│   ├── history.ts
│   └── incremental.ts
├── execution/                  # 执行系统
│   ├── dependency-graph.ts
│   ├── parallel-executor.ts
│   └── strategy/
├── hooks/                      # 钩子系统
├── intent/                     # 意图识别
├── optimizer/                  # 优化器
├── self-healing/               # 自愈系统
│   ├── detector.ts
│   ├── manager.ts
│   ├── repair-engine.ts
│   └── tool-generator.ts
├── task-tracker/              # 任务追踪
│   ├── commands.ts
│   ├── display.ts
│   ├── plugin.ts
│   ├── storage.ts
│   └── tracker.ts
└── validation/                # 验证系统
    ├── schemas.ts
    └── validators.ts
```

## 关键设计模式

### 1. 策略模式 (Strategy Pattern)
不同的执行策略（FFT、多智能体、函数调用等）可以动态切换。

### 2. 插件系统 (Plugin System)
核心功能通过插件扩展，支持动态加载和卸载。

### 3. 观察者模式 (Observer Pattern)
事件驱动架构，支持多种事件源（CLI、HTTP、WebSocket、文件监听）。

### 4. 多智能体协调 (Multi-Agent Orchestration)
主协调器管理多个专用智能体，实现复杂任务分解。

### 5. 状态机模式 (State Machine)
Plan 模式使用状态机管理执行流程。

## 数据流

```
用户输入 → Frontend → Loop Engine → 策略选择 → 智能体协调 → 插件/技能执行 → 工具调用 → AI 处理 → 验证 → 结果返回
```

## 关键特性

1. **Plan-Search-Execute-Verify 循环**: 核心工作流程
2. **多智能体系统**: 前端、后端、文档、测试专用智能体
3. **工具调用**: 可扩展的工具系统
4. **权限控制**: 四级权限系统
5. **自动验证**: 多阶段质量检查
6. **Git 回滚**: 自动检查点和即时恢复
7. **执行追踪**: 完整的操作审计轨迹
8. **智能重试**: 指数退避策略
9. **交互模式**: REPL 风格持续交互
10. **Tree of Thoughts**: 多路径推理
11. **ReAct 验证**: 自纠错验证
12. **降水系统**: 从编码模式自动学习并生成可复用技能

## 配置文件

- `package.json`: 项目依赖和脚本配置
- `tsconfig.json`: TypeScript 编译配置
- `settings.json`: 用户配置
- `settings.plugins.json`: 插件配置
- `settings.hooks.example.json`: 钩子配置示例

## 入口点

- CLI: `src/cli.ts`
- REPL: `src/repl.ts`
- REPL Loop: `src/repl-loop.ts`
- REPL TUI: `src/repl-tui.ts`
- Daemon: `src/daemon.ts`

## 测试

项目包含大量测试文件，位于根目录和 `test/` 目录下，覆盖：
- 循环系统测试
- 智能体测试
- 插件测试
- 技能系统测试
- 内存系统测试
- FFT 规划测试
- 推理系统测试

---

**文档生成时间**: 2026-02-03
**项目版本**: 3.4.0
