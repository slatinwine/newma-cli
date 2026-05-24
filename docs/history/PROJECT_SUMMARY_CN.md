# Newma (牛码) AI 项目总结

## 项目概述

**Newma (牛码)** 是一个高级 AI 驱动的命令行开发助手，遵循 `计划 → 搜索 → 执行 → 验证` 的循环模式。它通过多智能体系统、工具化架构、权限控制、自动验证等特性，帮助开发者更高效地完成编程任务。

**当前版本**: 3.1.0（自然交互增强版）

**核心定位**: 企业级 AI 开发助手，支持先进推理能力

---

## 核心特性

### 1. 🤖 多智能体系统
- **专业化智能体**: Frontend Agent、Backend Agent 等
- **任务分解**: 自动将复杂需求拆分为可管理的子任务
- **协作执行**: 智能体间并行处理和依赖解析
- **结果聚合**: 整合多个智能体的输出

### 2. 🔧 可扩展工具架构
- **插件化设计**: 轻松注册自定义工具
- **内置工具**: 文件操作、命令执行等核心工具
- **参数验证**: 所有工具的参数自动验证
- **类型安全**: 完整的 TypeScript 类型支持

### 3. 🔒 四级权限控制
```
read_only  → 只读访问文件
safe       → 读写文件 + 安全命令（默认）
standard   → 所有操作 + 运行命令
dangerous  → 包括破坏性操作的所有权限
```

### 4. ✅ 自动验证系统
- **多阶段检查**: 语法检查 → Lint → 测试 → 构建
- **自动修复**: 验证失败时 AI 自动修复问题
- **智能检测**: 根据项目自动选择验证阶段
- **ReAct 验证**: AI 驱动的智能验证循环

### 5. ↩️ Git 回滚机制
- **自动检查点**: 危险操作前自动创建 git commit
- **即时恢复**: 一键回滚到任意检查点
- **完整审计**: 所有操作都有完整历史记录

### 6. 💬 交互式 REPL 模式（Phase 4）
- **持续会话**: 不再是一次性执行，保持上下文
- **可中断操作**: Ctrl+C 取消正在进行的 AI 请求
- **特殊命令**: `/status`、`/history`、`/clear`、`/help`、`/exit`
- **会话管理**: 实时统计和历史跟踪

### 7. 🌳 Tree of Thoughts 推理（Phase 5）
- **多路径探索**: BFS、DFS、Beam Search 算法
- **多方案生成**: 生成 5 个备选方案并 AI 评估
- **思维可视化**: ASCII 树形图展示推理过程
- **智能选择**: AI 评分并选择最佳方案

### 8. 🔄 ReAct 验证循环（Phase 5）
- **Think-Act-Observe**: 推理-行动-观察的循环
- **自纠正验证**: 最多 5 次迭代自动修复错误
- **渐进式验证**: 预执行检查 → 快速验证 → 深度验证

### 9. 💬 默认聊天模式（Phase 6）
- **对话优先**: 默认输入为自然语言聊天
- **任务执行**: 使用 `/plan` 或 `/do` 执行复杂任务
- **调试增强**: 原始请求/响应日志
- **使用统计**: Token 计数和计时信息

### 10. 👤 用户侧写（Phase 6.1）
- **自动学习**: 每 5 次对话分析用户偏好
- **语言检测**: 记住你的首选语言（中文、英文等）
- **风格适应**: 适应你的交流风格（简洁、详细、正式）
- **技术栈记忆**: 记住你偏好的语言和框架
- **持久化存储**: 保存到 `用户侧写.md`

---

## 技术栈

### 核心技术
- **Node.js 22+**: 运行时环境
- **TypeScript 5.6+**: 主要开发语言
- **Git**: 版本控制和回滚

### 主要依赖
```json
{
  "commander": "^12.1.0",      // CLI 参数解析
  "node-fetch": "^2.7.0",      // HTTP 客户端（AI API 调用）
  "inquirer": "^9.2.23",       // 交互式提示
  "chalk": "^5.3.0",           // 终端颜色输出
  "dotenv": "^16.4.5"          // 环境变量管理
}
```

### 开发依赖
```json
{
  "@types/node": "^22.5.1",    // Node.js 类型定义
  "jest": "^30.2.0",           // 测试框架
  "ts-jest": "^29.4.6",        // Jest TypeScript 预处理器
  "ts-node": "^10.9.2"         // TypeScript 直接执行
}
```

### AI 服务
- **默认**: Zhipu AI GLM-4.7（智谱 AI）
- **兼容**: 所有 OpenAI 兼容的 API
  - OpenAI GPT-4/GPT-4o
  - Azure OpenAI
  - 本地 LLM（通过 OpenAI 兼容 API）

---

## 架构设计

### 六阶段演进架构

```
┌─────────────────────────────────────────────────────────────┐
│                    KODE CLI v3.1                            │
├─────────────────────────────────────────────────────────────┤
│  Phase 6: 自然交互增强                                       │
│  ┌─────────────┐  ┌─────────────┐                          │
│  │ Chat Mode   │  │ User        │                          │
│  │ (Default)   │  │ Profiling   │                          │
│  └─────────────┘  └─────────────┘                          │
├───────────────────────┼────────────────────────────────────┤
│  Phase 5: Ultrathink AI 推理                                │
│  ┌─────────────┐  ┌─────────────┐                          │
│  │ Tree of     │  │  ReAct      │                          │
│  │ Thoughts    │  │  Loop       │                          │
│  │ (Planning)  │  │(Verification)│                         │
│  └─────────────┘  └─────────────┘                          │
├───────────────────────┼────────────────────────────────────┤
│  Phase 4: 交互式 REPL                                       │
│  ┌─────────────┐  ┌─────────────┐                          │
│  │   REPL      │  │  Session    │                          │
│  │  Manager    │  │  Manager    │                          │
│  └─────────────┘  └─────────────┘                          │
├───────────────────────┼────────────────────────────────────┤
│  Phase 3: 多智能体系统                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Frontend    │  │ Backend     │  │ Future      │         │
│  │ Agent       │  │ Agent       │  │ Agents      │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                 │                 │               │
│         └─────────────────┴─────────────────┘               │
│                       │                                     │
│              ┌────────▼────────┐                            │
│              │   Coordinator   │                            │
│              └────────┬────────┘                            │
├───────────────────────┼────────────────────────────────────┤
│  Phase 2: 工具与权限系统                                     │
│  ┌─────────────┐  ┌─────────────┐                          │
│  │ File Tool   │  │Command Tool │                          │
│  └─────────────┘  └─────────────┘                          │
│         │                 │                                 │
│  ┌──────▼──────┐                                            │
│  │ Permissions │  ┌──────────────┐                         │
│  │ Manager     │  │ Verifier     │                         │
│  └─────────────┘  └──────────────┘                         │
├───────────────────────┼────────────────────────────────────┤
│  Phase 1: 核心基础设施                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Execution   │  │  Rollback   │  │    Retry    │         │
│  │  Tracker    │  │  Manager    │  │    Logic    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                       │                                     │
│              ┌────────▼────────┐                            │
│              │   Verifier      │                            │
│              └─────────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

### 模块边界

| 模块 | 职责 | 阶段 |
|------|------|------|
| `src/session.ts` | 会话状态管理 + 用户侧写 | 4 + 6.1 |
| `src/repl.ts` | 交互式 REPL 接口 + 侧写生成 | 4 + 6.1 |
| `src/agents/` | 多智能体系统 | 3 |
| `src/tools/` | 工具系统 | 2 |
| `src/executor-v2.ts` | 工具执行器 | 2 |
| `src/permissions.ts` | 权限管理 | 2 |
| `src/verifier.ts` | 验证系统 | 2 |
| `src/ultrathink/` | AI 推理引擎 | 5 |
| `src/history.ts` | 执行跟踪 | 1 |
| `src/rollback.ts` | Git 回滚 | 1 |
| `src/retry.ts` | 重试逻辑 | 1 |
| `src/errors.ts` | 错误处理 | 1 |

### 核心执行流程

**REPL 路径**（交互模式）:
```
初始化 → 读取输入 → 处理命令/执行需求 → 执行动作 → 循环 → 退出
```

**单智能体路径**（Phase 1-2）:
```
扫描项目 → 计划/验证 → 用户确认 → 执行动作 → 自动验证
```

**多智能体路径**（Phase 3）:
```
计划 → 任务分配 → 并行执行 → 结果聚合 → 最终验证
```

**Ultrathink 路径**（Phase 5）:
```
ToT 计划 → 生成多方案 → AI 评估 → 选择最佳 → ReAct 验证
```

---

## 关键实现

### 1. 工具系统实现

**工具接口**:
```typescript
interface Tool {
  name: string;
  description: string;
  category: ToolCategory;
  permissions: Permission[];
  handler: (params: any, context: ToolContext) => Promise<ToolResult>;
}
```

**自定义工具示例**:
```typescript
const customTool: Tool = {
  name: 'my-tool',
  description: '执行特定操作',
  category: ToolCategory.ANALYSIS,
  permissions: [Permission.READ_FILES],
  handler: async (params, context) => {
    return { success: true, output: '操作完成' };
  },
};

// 注册工具
registry.register(customTool);
```

### 2. 智能体系统实现

**基础智能体类**:
```typescript
abstract class BaseAgent {
  abstract canHandle(task: Task): boolean;
  abstract process(task: Task, context: Context): Promise<Result>;
}
```

**专业智能体**:
```typescript
class FrontendAgent extends BaseAgent {
  canHandle(task: Task): boolean {
    return task.type === 'frontend' || task.technologies.includes('React');
  }

  async process(task: Task, context: Context): Promise<Result> {
    // 前端专业处理逻辑
  }
}
```

### 3. 权限系统实现

**权限级别**:
```typescript
enum PermissionLevel {
  READ_ONLY = 'read_only',
  SAFE = 'safe',
  STANDARD = 'standard',
  DANGEROUS = 'dangerous'
}
```

**权限检查**:
```typescript
class PermissionManager {
  canExecute(operation: Operation, level: PermissionLevel): boolean {
    const requiredLevel = this.getRequiredLevel(operation);
    return this.compareLevels(level, requiredLevel) >= 0;
  }
}
```

### 4. Tree of Thoughts 实现

**思维树结构**:
```typescript
interface ThoughtNode {
  id: string;
  content: string;
  parentId: string | null;
  children: ThoughtNode[];
  depth: number;
  score?: number;
  state: ThoughtState;
}
```

**多路径推理**:
```typescript
class TreeOfThoughtsEngine {
  async generatePlans(requirement: string): Promise<Plan[]> {
    // 1. 初始化思维树
    // 2. 广度优先搜索生成多个方案
    // 3. AI 评估每个方案
    // 4. 选择最佳方案
  }
}
```

### 5. ReAct 验证实现

**ReAct 循环**:
```typescript
class ReActLoop {
  async verify(requirement: string, history: ExecutionRecord[]): Promise<VerificationResult> {
    for (let i = 0; i < maxIterations; i++) {
      // Think: 分析问题
      // Act: 执行修复
      // Observe: 观察结果
      if (satisfied) break;
    }
  }
}
```

### 6. 用户侧写实现

**侧写生成流程**:
```typescript
class SessionManager {
  async trackConversation(input: string) {
    this.userInputs.push(input);
    this.conversationCount++;

    if (this.conversationCount % 5 === 0) {
      await this.generateProfile();
    }
  }

  async generateProfile() {
    const existingProfile = this.loadProfile();
    const newProfile = await callAIToAnalyze(this.userInputs, existingProfile);
    this.saveProfile(newProfile);
    this.userInputs = []; // 清空输入历史
  }
}
```

---

## 设计原则

### 1. 简约不简单
- **清晰的接口**: 简单的工具和智能体接口
- **最小依赖**: 只使用必要的 npm 包
- **易于理解**: 代码自解释，良好的文档

### 2. 不要重复你自己（DRY）
- **工具复用**: 通用操作封装为工具
- **智能体复用**: 专业能力可在多个任务中复用
- **模块化设计**: 功能独立，避免重复

### 3. 如无必要，勿增实体（奥卡姆剃刀）
- **向后兼容**: 所有新功能都是可选的
- **渐进式增强**: 从基础到高级，按需启用
- **谨慎添加**: 只添加有价值的功能

### 4. 安全第一
- **权限控制**: 四级权限防止误操作
- **Git 回滚**: 任何时候都可以恢复
- **确认提示**: 危险操作前需要用户确认

### 5. 用户体验优先
- **交互式 REPL**: 持续会话，保持上下文
- **可中断**: Ctrl+C 取消长时间操作
- **清晰反馈**: 彩色输出，进度提示
- **错误友好**: 用户友好的错误消息

---

## 测试策略

### 测试覆盖
- **Phase 2**: 6/6 测试通过（工具执行器、权限、注册表、验证器）
- **Phase 3**: 5/5 测试通过（协调器、智能体、任务选择、依赖）
- **Phase 5**: 50/55 测试通过（91% 通过率）
  - ToT Engine: 11/11 ✅
  - ReAct Loop: 19/19 ✅
  - Multi-Plan Generator: 9/12 (75%)
  - Verifier: 10/13 (77%)

### 测试框架
```json
{
  "jest": "^30.2.0",
  "ts-jest": "^29.4.6",
  "@jest/globals": "^30.2.0"
}
```

### 运行测试
```bash
# 所有测试
npm test

# 特定阶段
npx ts-node test-phase2.ts
npx ts-node test-phase3.ts

# 覆盖率报告
npm run test:coverage
```

---

## 性能优化

### 优化策略
1. **并行执行**: 独立任务并行处理
2. **结果缓存**: TypeScript、ESLint 检测结果缓存
3. **懒加载**: 智能体和工具按需加载
4. **渐进式验证**: 快速检查失败时跳过深度验证

### 性能指标
- **Ultrathink**: 预期提升 40-50% 任务完成质量
- **验证优化**: 预执行检查节省 5-10 秒
- **API 调用**: 渐进式验证减少不必要的 API 调用

---

## 未来改进

### 短期计划
1. **流式响应**: 实时显示 AI 输出
2. **更多智能体**: Testing Agent、Documentation Agent、DevOps Agent
3. **命令历史持久化**: 保存 REPL 历史到文件

### 中期计划
4. **高级协作**: 智能体间协作、动态重分配
5. **学习适应**: 分析历史执行，优化策略
6. **协作功能**: 团队共享、远程执行、Web UI

### 长期愿景
7. **API 模式**: 提供 REST API 集成
8. **插件生态**: 社区贡献工具和智能体
9. **多模型支持**: 同时使用多个 AI 模型

---

## 配置指南

### 快速配置（推荐）
```bash
npm run init-settings
```

### 手动配置

**方式一：settings.json（推荐）**
```json
{
  "openai": {
    "apiKey": "your-api-key",
    "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
    "model": "glm-4.7"
  }
}
```

**方式二：.env 文件**
```bash
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
OPENAI_MODEL=glm-4.7
```

### 配置优先级
1. 命令行参数（最高）
2. settings.json（项目/全局）
3. .env 文件
4. 默认值（最低）

---

## 使用示例

### 基础使用
```bash
# 安装
npm install -g newma-cli

# 简单任务
npx newma-cli "添加登录页面"

# 多智能体
npx newma-cli --multi-agent "创建用户管理 REST API"

# 带验证
npx newma-cli --verify "添加用户服务单元测试"
```

### 交互式模式
```bash
# 启动 REPL
npx newma-cli -i

# 聊天模式（默认）
[newma] ❯ 你好，帮我分析一下这个项目
# AI 自然语言回复

# 任务执行
[newma] ❯ /plan 添加 OAuth 认证
# 完整的计划和执行流程

# 查看状态
[newma] ❯ /status
# 显示会话统计
```

### 高级用法
```bash
# Ultrathink 推理
npx newma-cli --ultrathink "构建用户认证系统"

# 完整功能集
npx newma-cli --multi-agent --use-tools --permission-level standard --verify \
  "构建全栈待办应用，使用 React 和 Express"

# 自定义模型
npx newma-cli --model gpt-4o --base-url https://api.openai.com \
  "优化数据库查询性能"
```

---

## 项目结构

```
kode/
├── src/
│   ├── agents/              # 多智能体系统（Phase 3）
│   │   ├── types.ts
│   │   ├── agent.ts
│   │   ├── coordinator.ts
│   │   └── specialized/
│   │       ├── frontend.ts
│   │       └── backend.ts
│   ├── tools/               # 工具系统（Phase 2）
│   │   ├── types.ts
│   │   ├── registry.ts
│   │   └── builtin/
│   │       ├── file.ts
│   │       └── command.ts
│   ├── ultrathink/          # AI 推理引擎（Phase 5）
│   │   ├── types.ts
│   │   ├── utils.ts
│   │   ├── tree-of-thoughts.ts
│   │   ├── planner.ts
│   │   ├── react-loop.ts
│   │   ├── verifier.ts
│   │   └── observer.ts
│   ├── session.ts           # 会话管理（Phase 4 + 6.1）
│   ├── repl.ts              # REPL 接口（Phase 4 + 6.1）
│   ├── executor-v2.ts       # 工具执行器（Phase 2）
│   ├── permissions.ts       # 权限系统（Phase 2）
│   ├── verifier.ts          # 验证系统（Phase 2）
│   ├── history.ts           # 执行跟踪（Phase 1）
│   ├── rollback.ts          # Git 回滚（Phase 1）
│   ├── retry.ts             # 重试逻辑（Phase 1）
│   ├── errors.ts            # 错误处理（Phase 1）
│   ├── cli.ts               # 主入口
│   ├── ai.ts                # AI 集成
│   ├── scanner.ts           # 项目扫描
│   ├── prompt.ts            # 系统提示
│   ├── types.ts             # 共享类型
│   └── config.ts            # 配置管理
├── test-ultrathink/         # Phase 5 测试
│   ├── setup.ts
│   ├── tot.test.ts
│   ├── react.test.ts
│   ├── planner.test.ts
│   └── verifier.test.ts
├── scripts/
│   └── init-settings.ts     # 配置初始化向导
├── test-phase2.ts           # Phase 2 集成测试
├── test-phase3.ts           # Phase 3 集成测试
├── CLAUDE.md                # 开发者指南
├── README.md                # 用户文档
├── PROJECT_SUMMARY_CN.md    # 项目总结（本文档）
├── 用户侧写.md              # 自动生成的用户侧写
└── package.json
```

---

## 经验总结

### 技术经验

#### 1. 分阶段开发成功 ✅
- **增量特性**: 每个阶段构建在前一阶段之上
- **清晰进度**: 易于跟踪和调试
- **向后兼容**: 零破坏性更改
- **易于回滚**: 如果需要可以回退

#### 2. TypeScript 是必需的 ✅
- **编译时错误**: 在运行时前捕获错误
- **IDE 支持**: 更好的自动补全
- **自文档化**: 代码即文档
- **安全重构**: 类型检查保证重构安全

#### 3. 测试策略很重要 ✅
- **集成测试**: 用于复杂系统
- **单元测试**: 用于纯函数
- **测试命名**: `test-*.ts` 规范
- **覆盖率优先**: 关键路径优先测试

#### 4. 文档至关重要 ✅
- **阶段总结**: PHASE*.md 记录演进
- **README**: 面向用户
- **CLAUDE.md**: 面向开发者
- **内联注释**: 代码级文档

### 流程经验

#### 1. 向后兼容是王道 👑
- **可选特性**: 所有新功能都是 opt-in
- **保留 API**: 从不移除旧 API
- **迁移路径**: 提供清晰的升级路径
- **双重测试**: 同时测试新旧代码

#### 2. 用户反馈驱动设计 📊
- **痛点识别**: 发现实际问题（无回滚、无验证）
- **特性优先**: 基于需求优先级
- **迭代设计**: 根据反馈优化
- **真实场景**: 使用实际案例测试

#### 3. 简约获胜 🎯
- **清晰接口**: 易于理解和实现
- **最少依赖**: 减少 complex性
- **快速上手**: 学习曲线平缓
- **广泛采用**: 简单才能流行

#### 4. 安全第一 🔒
- **权限系统**: 四级安全控制
- **危险检测**: 识别破坏性操作
- **回滚能力**: 即时恢复机制
- **确认提示**: 防止误操作

### 架构经验

#### 1. 插件架构促进增长 📈
- **工具系统**: 任何人都可以注册工具
- **智能体系统**: 任何人都可以注册智能体
- **社区贡献**: 生态系统的力量

#### 2. 分层架构效果好 🏗️
- **关注点分离**: 每层有明确职责
- **易于测试**: 独立测试每层
- **可插拔**: 可以交换实现
- **并行开发**: 多层同时开发

#### 3. 设计模式提供结构 🎨
- **Strategy**: 不同任务使用不同智能体
- **Builder**: 系统提示构建器
- **Observer**: 执行跟踪
- **Command**: 动作执行
- **Factory**: 智能体/工具创建
- **Coordinator**: 智能体编排

---

## 最佳实践

### 添加新工具
```typescript
// 1. 定义工具
const myTool: Tool = {
  name: 'my-tool',
  description: '描述工具功能',
  category: ToolCategory.ANALYSIS,
  permissions: [Permission.READ_FILES],
  handler: async (params, context) => {
    return { success: true, output: '完成' };
  },
};

// 2. 注册工具（在 executor-v2.ts）
this.registry.register(myTool);

// 3. 添加测试
// 4. 更新文档
```

### 添加新智能体
```typescript
// 1. 创建智能体类
class MyAgent extends BaseAgent {
  constructor(toolExecutor, tracker) {
    super(/* ... */);
  }

  canHandle(task: Task): boolean {
    return task.type === 'my-type';
  }

  async process(task: Task, context: Context): Promise<Result> {
    // 实现逻辑
  }
}

// 2. 注册智能体（在 coordinator.ts）
const myAgent = new MyAgent(toolExecutor, tracker);
this.registerAgent(myAgent);

// 3. 添加测试
// 4. 更新文档
```

### 错误处理
```typescript
import { Newma (牛码)Error, ErrorCode } from './errors';

// 抛出错误（带上下文）
throw new Newma (牛码)Error(
  '操作失败',
  ErrorCode.COMMAND_FAILED,
  true, // 可重试
  originalError
);

// 处理错误
try {
  await someOperation();
} catch (error) {
  const kodeError = handleError(error);
  if (isRetryable(kodeError)) {
    // 重试逻辑
  } else {
    // 用户友好的错误消息
    console.error(kodeError.getUserMessage());
  }
}
```

---

## 开发指南

### 环境设置
```bash
# 克隆和安装
git clone <repo>
cd kode
npm install

# 配置环境
cp .env.example .env
# 编辑 .env 填入 OPENAI_API_KEY

# 构建
npm run build

# 测试
npx ts-node test-phase2.ts
npx ts-node test-phase3.ts
npm test
```

### 调试技巧
```typescript
// 启用调试日志
console.log(chalk.gray(`[DEBUG] 值: ${someValue}`));

// 或使用 verbose 标志
if (options.verbose) {
  console.log(chalk.gray(`详细信息...`));
}
```

### 贡献检查清单
- [ ] 测试通过
- [ ] 构建成功
- [ ] 文档已更新
- [ ] 代码符合规范
- [ ] 提交消息清晰
- [ ] 添加了新功能的测试

---

## 常见问题

<details>
<summary><b>Newma (牛码) 安全吗？</b></summary>

是的！Newma (牛码) 包含多重安全特性：
- 四级权限控制系统
- 危险操作检测
- Git 回滚（即时恢复）
- 完整的审计跟踪
- 执行前确认提示
</details>

<details>
<summary><b>Newma (牛码) 支持哪些 AI 模型？</b></summary>

任何 OpenAI 兼容的 API：
- 智谱 AI（GLM-4.7, GLM-4-Plus）- **默认**
- OpenAI（GPT-4, GPT-4o, GPT-4o-mini）
- Azure OpenAI
- 本地 LLM（通过 OpenAI 兼容 API）
- 任何支持 OpenAI 格式的服务
</details>

<details>
<summary><b>多智能体系统如何工作？</b></summary>

1. 将需求分解为任务
2. 分配给专业智能体
3. 尽可能并行执行
4. 聚合结果并验证
5. 自动处理依赖关系
</details>

<details>
<summary><b>如何使用用户侧写功能？</b></summary>

1. 启动交互模式：`npx newma-cli -i`
2. 开始聊天（任意语言）
3. 每 5 次对话后自动生成侧写
4. 侧写保存到 `用户侧写.md`
5. 所有后续 AI 交互自动使用侧写
6. 可手动编辑 `用户侧写.md` 调整
</details>

---

## 版本历史

### v3.1.0（当前版本）
- ✅ 默认聊天模式（Phase 6）
- ✅ 用户侧写系统（Phase 6.1）
- ✅ 改进的调试工具
- ✅ 使用统计和计时

### v3.0.0
- ✅ Ultrathink AI 推理（Phase 5）
- ✅ Tree of Thoughts 计划
- ✅ ReAct 验证循环
- ✅ 多方案生成和评估

### v2.0.0
- ✅ 交互式 REPL 模式（Phase 4）
- ✅ 会话管理
- ✅ 可中断操作
- ✅ 特殊命令

### v1.0.0
- ✅ 多智能体系统（Phase 3）
- ✅ 工具化架构（Phase 2）
- ✅ 权限控制
- ✅ 自动验证
- ✅ Git 回滚（Phase 1）

---

## 相关文档

- **[CLAUDE.md](./CLAUDE.md)** - 开发者完整指南
- **[README.md](./README.md)** - 用户文档
- **[SETTINGS.md](./SETTINGS.md)** - 详细配置说明
- **[ZHIPU_AI_MIGRATION.md](./ZHIPU_AI_MIGRATION.md)** - 智谱 AI 迁移指南
- **[PHASE6_SUMMARY.md](./PHASE6_SUMMARY.md)** - Phase 6 详细文档
- **[ULTRATHINK_TEST_SUMMARY.md](./ULTRATHINK_TEST_SUMMARY.md)** - Phase 5 测试总结

---

## 致谢

- 灵感来自 Claude Code、GitHub Copilot 和 Cursor
- 为开发者社区用 ❤️ 构建
- 默认使用智谱 AI 的 GLM-4.7 提供动力

---

**维护团队**: Newma (牛码) Development Team
**版本**: 3.1.0
**最后更新**: 2025
**许可证**: MIT

---

<div align="center">

**用 ❤️ 构建 | 为开发者服务**

**Newma (牛码) - AI 驱动的多智能体代码助手**

</div>
