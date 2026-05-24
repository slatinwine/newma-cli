# Two-Phase Agent System - 使用指南

## 快速开始

### 1. 使用 CLI 标志

```bash
# 启用两阶段模式
npx newma-cli --two-phase "add user authentication"

# 或使用 executionMode 参数
npx newma-cli --execution-mode two-phase "create REST API"

# 在交互模式中启用
npx newma-cli -i --two-phase
```

### 2. 使用配置文件

在项目根目录创建或编辑 `settings.json`：

```json
{
  "project": {
    "executionMode": "two-phase"
  }
}
```

### 3. 在交互模式中动态切换 ✨

```bash
# 启动交互模式
npx newma-cli -i

# 在 REPL 中切换执行模式
[newma] ❯ /set executionMode two-phase

✅ Execution mode set to: two-phase
• Using Two-Phase Agent system
• PlanAgent analyzes, ExecuteAgent implements
• Higher success rate for complex tasks

# 现在执行任务将使用两阶段模式
[newma] ❯ /plan add login page
```

## 可用的执行模式

### standard（标准模式）
- 默认模式
- 单次 AI 调用返回完整计划
- 适合简单任务

### function-calling（函数调用模式）
- 使用 OpenAI Function Calling API
- AI 自主决定调用哪些工具
- 多轮对话直到完成

### two-phase（两阶段模式）⭐
- **PlanAgent**: 分析需求，生成结构化计划
- **ExecuteAgent**: 基于计划生成具体实现
- 两个确认点，更高的成功率
- 适合复杂任务

### multi-agent（多智能体模式）
- 多个专业 agent 协作（前端、后端、测试等）
- 适合大型项目

## 交互模式命令

### 查看当前设置

```bash
[newma] ❯ /set

⚙️  Configuration Options
══════════════════════════════════════════════════
/set functionCalling true   - Enable Function Calling API
/set functionCalling false  - Disable Function Calling API (use JSON mode)
/set executionMode <mode>    - Set execution mode
  Modes: function-calling, two-phase, multi-agent, standard
════════════════════════════════════════════════════

Current settings:
• Function Calling: disabled
• Execution Mode: standard
```

### 切换执行模式

```bash
# 切换到两阶段模式
[newma] ❯ /set executionMode two-phase

✅ Execution mode set to: two-phase
• Using Two-Phase Agent system
• PlanAgent analyzes, ExecuteAgent implements
• Higher success rate for complex tasks

# 切换到标准模式
[newma] ❯ /set mode standard

✅ Execution mode set to: standard
• Using standard JSON mode
• Single AI call with structured response

# 切换到函数调用模式
[newma] ❯ /set executionMode function-calling

✅ Execution mode set to: function-calling
• Using OpenAI Function Calling API
• AI autonomously calls tools
```

### 使用快捷方式

```bash
# "executionMode" 可以简写为 "mode"
[newma] ❯ /set mode two-phase

# 效果相同
[newma] ❯ /set executionMode two-phase
```

## 两阶段模式工作流程

### Phase 1: Planning（规划阶段）

```
🧠 Phase 1: Planning...
──────────────────────────────────────────────────────────

📋 Execution Plan:
──────────────────────────────────────────────────────────
  1. Analyze existing authentication implementation
  2. Design authentication component structure
  3. Create authentication utilities
  4. Integrate authentication into app

📝 Planned Actions:
──────────────────────────────────────────────────────────
  1. [RUN] Find existing authentication files
  2. [RUN] Read app entry point to understand structure
  3. [CREATE] Create authentication context for state management
  4. [CREATE] Create login utility functions
  5. [MODIFY] Integrate authentication context into app
──────────────────────────────────────────────────────────

Continue to execution phase? (y/n)
```

### Phase 2: Execution（执行阶段）

```
⚡ Phase 2: Executing...
──────────────────────────────────────────────────────────

⚡ Ready to Execute:
──────────────────────────────────────────────────────────
  1. Create src/auth/AuthContext.tsx
  2. Create src/auth/login.ts
  3. Create src/auth/types.ts
  4. Modify src/App.tsx
  5. Create src/pages/LoginPage.tsx
──────────────────────────────────────────────────────────

Execute these actions? (y/n)
```

## 优势

### 1. 更高的成功率
- 职责分离：规划 vs 执行
- 两个确认点，避免错误
- 每个 agent 专注于自己的任务

### 2. 更好的可控性
- 可以在规划阶段就发现问题
- 用户可以审查计划后再执行
- 渐进式执行，更容易调试

### 3. 更灵活的模式切换
- 在交互模式中随时切换
- 不同任务使用不同模式
- 完全向后兼容

## 使用场景

### 推荐使用两阶段模式

- ✅ 复杂的任务（多个文件、多个步骤）
- ✅ 需要仔细规划的任务
- ✅ 不确定最佳实现方案时
- ✅ 需要高成功率的任务

### 推荐使用标准模式

- ✅ 简单的单文件任务
- ✅ 快速原型开发
- ✅ 已经很明确的任务

### 推荐使用函数调用模式

- ✅ 需要大量信息收集的任务
- ✅ 探索性任务（不确定需要做什么）
- ✅ 使用 OpenAI API 时

## 示例

### 示例 1：添加用户认证

```bash
# 切换到两阶段模式
[newma] ❯ /set mode two-phase

# 执行任务
[newma] ❯ /plan add user authentication with JWT tokens

# Phase 1: 查看 PlanAgent 生成的计划
# Phase 2: 查看 ExecuteAgent 生成的具体实现
# 确认后自动执行
```

### 示例 2：创建 API 端点

```bash
# 切换模式
[newma] ❯ /set executionMode two-phase

# 执行任务
[newma] ❯ /do create REST API for user management with CRUD operations

# 查看两阶段规划并执行
```

### 示例 3：在模式间切换

```bash
# 简单任务使用标准模式
[newma] ❯ /set mode standard
[newma] ❯ /plan create a simple logger utility

# 复杂任务切换到两阶段模式
[newma] ❯ /set mode two-phase
[newma] ❯ /plan implement complete authentication system with OAuth2
```

## 故障排除

### Q: 切换模式后没有生效？
A: 模式切换对下一个命令生效，不是当前正在运行的命令。

### Q: 如何知道当前使用的是哪个模式？
A: 使用 `/set` 命令查看当前设置，或使用 `/status` 查看完整状态。

### Q: 两阶段模式失败了怎么办？
A: 可以尝试切换到标准模式或函数调用模式：
```bash
[newma] ❯ /set mode standard
```

### Q: 可以设置默认模式吗？
A: 可以在 `settings.json` 中设置：
```json
{
  "project": {
    "executionMode": "two-phase"
  }
}
```

## 总结

两阶段 Agent 系统通过职责分离显著提高了任务执行的成功率。在交互模式中，你可以：

1. ✅ 随时使用 `/set executionMode` 切换模式
2. ✅ 为不同类型的任务选择最合适的模式
3. ✅ 享受更高的成功率和更好的可控性

试试看吧！🚀
