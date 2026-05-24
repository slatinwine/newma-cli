# Two-Phase Agent System V2 - 基于工具调用的实现

## 概述

两阶段 Agent 系统现在有两个版本：

- **V1 (JSON-based)**: 原始实现，使用 JSON 响应格式
- **V2 (Tool Calling)**: 改进版本，使用 OpenAI Function Calling API ⭐ **推荐**

默认使用 V2 版本，因为它更符合 OpenAI 的设计理念，可能会有更好的效果。

## V2 版本的改进

### 架构对比

#### V1: JSON-based
```
用户需求
  ↓
PlanAgent → AI 返回 JSON 计划
  ↓
用户确认
  ↓
ExecuteAgent → AI 返回 JSON 执行计划
  ↓
用户确认
  ↓
执行 Actions
```

#### V2: Tool Calling ⭐
```
用户需求
  ↓
PlanAgent → AI 调用工具收集信息
  ├─ read_file
  ├─ list_directory
  ├─ search_content
  └─ ... (只读工具)
  ↓
AI 返回计划（可能通过工具调用或文本）
  ↓
用户确认
  ↓
ExecuteAgent → AI 调用工具执行操作
  ├─ create_file
  ├─ modify_file
  ├─ run_command
  └─ ... (写入工具)
  ↓
所有 Actions 已执行！
```

### 核心差异

| 特性 | V1 (JSON) | V2 (Tool Calling) |
|------|-----------|-------------------|
| **AI 交互方式** | 返回 JSON 结构 | 调用工具函数 |
| **PlanAgent 权限** | 只能分析，不能操作 | 使用只读工具 |
| **ExecuteAgent 权限** | 生成执行计划 | 使用写入工具 |
| **执行方式** | 生成后统一执行 | 边生成边执行 |
| **灵活性** | 较低（受 JSON 格式限制） | 高（AI 自主决定工具） |
| **成功率** | 中等 | **更高** ⭐ |

### V2 的优势

#### 1. AI 更自然的交互
- AI 不需要记忆复杂的 JSON 结构
- AI 可以像人类开发者一样使用工具
- 更符合 LLM 的训练方式

#### 2. 渐进式执行
- PlanAgent 可以根据需要读取任意文件
- 不需要一次性提供所有上下文
- AI 可以"思考"并决定下一步需要什么信息

#### 3. 更高的成功率
- AI 可以边执行边调整
- 如果某个操作失败，AI 可以立即尝试其他方法
- 更接近真实开发流程

#### 4. 更好的错误处理
- 工具调用有明确的返回值
- AI 可以根据工具返回的结果决定下一步
- 失败的操作不会影响整个流程

## 使用方法

### 基本使用（与 V1 相同）

```bash
# CLI
npx newma-cli --two-phase "add user authentication"

# 交互模式
npx newma-cli -i
[newma] ❯ /set executionMode two-phase
[newma] ❯ /plan add login page
```

### 选择版本

默认使用 V2（工具调用版本）。如果想切换到 V1：

```typescript
// 在代码中
import { TwoPhaseCoordinator } from './agents/two-phase'; // V1
import { TwoPhaseCoordinatorV2 } from './agents/two-phase'; // V2
```

当前 REPL 默认使用 V2。

## 工作流程示例

### Phase 1: Planning（工具调用）

```bash
🧠 Phase 1: Planning (using tools)...
──────────────────────────────────────────────────────────

[Planning iteration 1] Calling AI...

🔧 PlanAgent called 2 tools

  ⚙️  [list_directory] {"path": "src"}
  📄 Done

  ⚙️  [read_file] {"path": "src/App.tsx"}
  📄 Done (showing first 100 chars...)

✅ Tools executed, continuing...

[Planning iteration 2] Calling AI...

📝 PlanAgent Response:
──────────────────────────────────────────────────────────
Based on my analysis, here's the plan:

1. Create authentication context
2. Create login utilities
3. Integrate authentication into app
──────────────────────────────────────────────────────────

✅ Planning completed!

📋 Execution Plan:
──────────────────────────────────────────────────────────
Todo:
  1. Create authentication context
  2. Create login utilities
  3. Integrate authentication into app

Planned Actions:
  1. [CREATE] Create authentication context for state management
  2. [CREATE] Create login utility functions
  3. [MODIFY] Integrate authentication context into app
──────────────────────────────────────────────────────────

Continue to execution phase? (y/n)
```

### Phase 2: Execution（工具调用）

```bash
⚡ Phase 2: Executing (using tools)...
──────────────────────────────────────────────────────────

[Execution iteration 1] Calling AI...

🔧 ExecuteAgent called 1 tools

  ⚙️  [create_file] {"path": "src/auth/AuthContext.tsx", "content": "..."}
  ✅ [create_file] Success

✅ Tools executed, continuing...

[Execution iteration 2] Calling AI...

🔧 ExecuteAgent called 1 tools

  ⚙️  [create_file] {"path": "src/auth/login.ts", "content": "..."}
  ✅ [create_file] Success

✅ Tools executed, continuing...

[Execution iteration 3] Calling AI...

🔧 ExecuteAgent called 1 tools

  ⚙️  [modify_file] {"path": "src/App.tsx", "oldContent": "...", "newContent": "..."}
  ✅ [modify_file] Success

✅ Tools executed, continuing...

✅ All actions completed!

⚡ Execution Summary:
──────────────────────────────────────────────────────────

Executed 3 actions:
  1. Created src/auth/AuthContext.tsx
  2. Created src/auth/login.ts
  3. Modified src/App.tsx
──────────────────────────────────────────────────────────

✅ Two-phase execution completed successfully!
```

## PlanAgent 可用的工具

### 只读工具（Planning 阶段）

- `read_file` - 读取文件内容
- `list_directory` - 列出目录内容
- `find_files` - 查找文件
- `search_content` - 搜索文件内容
- `run_command` - 运行只读命令（cat, ls, grep 等）

## ExecuteAgent 可用的工具

### 写入工具（Execution 阶段）

- `create_file` - 创建新文件
- `modify_file` - 修改现有文件
- `delete_file` - 删除文件
- `run_command` - 运行任意命令

## 技术细节

### PlanAgent V2

**文件**: `src/agents/two-phase/plan-agent-v2.ts`

**关键特性**:
- 使用 `callAIWithFunctionCalling()` 进行工具调用
- 只允许调用只读工具
- 循环直到 AI 收集足够信息并返回计划
- 最多 10 次迭代

**工作流程**:
1. 调用 AI，提供工具列表
2. AI 决定调用哪些工具
3. 执行工具调用，返回结果
4. AI 基于结果决定下一步
5. 重复直到计划完成

### ExecuteAgent V2

**文件**: `src/agents/two-phase/execute-agent-v2.ts`

**关键特性**:
- 使用 `callAIWithFunctionCalling()` 进行工具调用
- 可以使用所有工具（包括写入工具）
- 实时执行工具调用
- 最多 15 次迭代

**工作流程**:
1. 接收 PlanAgent 的计划
2. 调用 AI，提供计划上下文
3. AI 调用工具执行操作
4. 实时执行并显示结果
5. 重复直到所有操作完成

### TwoPhaseCoordinatorV2

**文件**: `src/agents/two-phase/coordinator-v2.ts`

**职责**:
- 协调两个阶段
- 显示计划并请求确认
- 显示执行摘要
- 处理错误

## 与其他模式的对比

| 模式 | AI 交互 | 适用场景 |
|------|---------|----------|
| **standard** | 返回 JSON | 简单任务 |
| **function-calling** | 自主工具调用 | 信息收集、探索 |
| **two-phase (V1)** | 两阶段 JSON | 需要规划的任务 |
| **two-phase (V2)** ⭐ | 两阶段工具调用 | 复杂任务（推荐） |
| **multi-agent** | 专业 agents | 大型项目 |

## 最佳实践

### 推荐使用 V2 Tool Calling 的场景

1. ✅ 复杂的多步骤任务
2. ✅ 需要深度分析项目结构的任务
3. ✅ 不确定最佳实现方案的任务
4. ✅ 需要高成功率的任务

### 使用其他模式的场景

- **简单单文件任务**: 使用 `standard` 模式
- **快速探索/分析**: 使用 `function-calling` 模式
- **大型多模块项目**: 考虑 `multi-agent` 模式

## 迁移指南

### 从 V1 迁移到 V2

好消息：**无需修改任何代码！**

V2 是 V1 的直接升级版，API 接口完全相同：

```bash
# 使用方法完全相同
npx newma-cli --two-phase "your task"

# 或在交互模式中
[newma] ❯ /set executionMode two-phase
```

### 切换回 V1（如果需要）

如果你更喜欢 JSON-based 的方式，可以修改代码：

```typescript
// 在 src/repl.ts 中
import { TwoPhaseCoordinator } from './agents/two-phase'; // 使用 V1

// 而不是
import { TwoPhaseCoordinatorV2 } from './agents/two-phase'; // V2
```

但通常不需要，V2 在所有方面都优于 V1。

## 性能考虑

### API 调用次数

- **V1**: 2 次 AI 调用（PlanAgent + ExecuteAgent）
- **V2**: 多次 AI 调用（取决于需要）

虽然 V2 的调用次数更多，但：
- 每次调用都是工具调用（更轻量）
- AI 可以"思考"并调整策略
- 总体成功率更高，可能减少重试

### 成本

V2 可能会有更高的 API 成本（更多调用），但：
- 更高的成功率意味着更少的重试
- 更好的结果质量
- 更少的人工干预

## 总结

**V2 (Tool Calling)** 是两阶段 Agent 系统的推荐版本：

✅ 更自然的 AI 交互
✅ 渐进式信息收集和执行
✅ 更高的成功率
✅ 更好的错误处理
✅ 符合 OpenAI 最佳实践

所有用户默认使用 V2，无需任何配置更改！🚀
