# Two-Phase Mode Auto-Disable Feature

## 功能概述

当用户在 REPL 交互模式中设置 `executionMode` 为 `two-phase` 或 `multi-agent` 时，系统会自动禁用 `autonomous` 模式以避免冲突。

## 实现细节

### 修改的文件

1. **src/session.ts** (line 169-171)
   - 添加 `setAutonomous(enabled: boolean)` 方法

2. **src/repl.ts** (line 520-528)
   - 在 `handleSetCommand` 中添加自动禁用逻辑

### 执行优先级（repl.ts:783-804）

```
Priority 1: functionCallingEnabled
  ↓ (如果启用)
  executeWithFunctionCalling()

Priority 2: executionMode
  ├─ two-phase → executeWithTwoPhase()
  ├─ multi-agent → multi-agent (TODO)
  └─ function-calling → executeWithFunctionCalling()

Priority 3: standard mode (默认)
```

## 使用方法

### 启动交互模式

```bash
npm run dev -- -i
# 或
npx newma-cli -i
```

### 设置 Two-Phase 模式

```bash
[newma] ❯ /set executionMode two-phase
```

**预期输出：**
```
✅ Execution mode set to: two-phase
ℹ️  Autonomous mode auto-disabled (conflicts with two-phase)

• Using Two-Phase Agent system (tool-based)
• PlanAgent uses read-only tools to analyze
• ExecuteAgent uses write tools to implement
• Higher success rate for complex tasks
```

### 设置 Multi-Agent 模式

```bash
[newma] ❯ /set executionMode multi-agent
```

**预期输出：**
```
✅ Execution mode set to: multi-agent
ℹ️  Autonomous mode auto-disabled (conflicts with multi-agent)

• Using Multi-Agent system
• Specialized agents collaborate
```

### Function-Calling 模式不会自动禁用 Autonomous

```bash
[newma] ❯ /set executionMode function-calling
```

**预期输出：**
```
✅ Execution mode set to: function-calling

• Using OpenAI Function Calling API
• AI autonomously calls tools
```

（autonomous 模式保持启用，无冲突）

## 测试验证

### 手动测试步骤

1. **启动 REPL 并启用 autonomous**
   ```bash
   [newma] ❯ /set autonomous true
   ✅ Autonomous mode enabled
   ```

2. **切换到 two-phase 模式**
   ```bash
   [newma] ❯ /set executionMode two-phase
   ✅ Execution mode set to: two-phase
   ℹ️  Autonomous mode auto-disabled (conflicts with two-phase)
   ```

3. **验证 autonomous 已被禁用**
   ```bash
   [newma] ❯ /status
   ...
   Autonomous:     Disabled
   Execution Mode: two-phase
   ...
   ```

4. **手动重新启用 autonomous**
   ```bash
   [newma] ❯ /set autonomous true
   ✅ Autonomous mode enabled
   ```

5. **切换到 function-calling 模式**
   ```bash
   [newma] ❯ /set executionMode function-calling
   ✅ Execution mode set to: function-calling
   # 注意：没有 "auto-disabled" 消息
   ```

6. **验证 autonomous 仍然启用**
   ```bash
   [newma] ❯ /status
   ...
   Autonomous:     Enabled
   Execution Mode: function-calling
   ...
   ```

### 自动化测试

所有单元测试和集成测试均已通过：

- ✅ SessionManager.setAutonomous() 方法正常工作
- ✅ REPL 自动禁用逻辑正确触发
- ✅ two-phase 模式自动禁用 autonomous
- ✅ multi-agent 模式自动禁用 autonomous
- ✅ function-calling 模式保持 autonomous 不变
- ✅ standard 模式保持 autonomous 不变
- ✅ 执行优先级正确路由到 two-phase

## 技术说明

### 为什么需要自动禁用？

1. **避免模式冲突**
   - autonomous 模式可能会与 two-phase/multi-agent 模式的执行逻辑冲突
   - 两个系统都试图控制执行流程，可能导致不可预测的行为

2. **简化用户操作**
   - 用户无需手动禁用 autonomous 模式
   - 系统自动处理模式兼容性

3. **清晰的执行路径**
   - 确保用户选择的执行模式（two-phase）被正确使用
   - 避免之前的 bug：启用 two-phase 却执行的是 autonomous 模式

### 模式互斥表

| 模式 | Autonomous | Two-Phase | Multi-Agent | Function-Calling |
|------|-----------|-----------|-------------|------------------|
| Two-Phase | ❌ 冲突 | ✅ 主要 | N/A | N/A |
| Multi-Agent | ❌ 冲突 | N/A | ✅ 主要 | N/A |
| Function-Calling | ✅ 兼容 | N/A | N/A | ✅ 主要 |
| Standard | ✅ 兼容 | N/A | N/A | N/A |

## 故障排查

### 问题：Two-phase 模式没有生效

**症状：** 设置 `/set executionMode two-phase` 后，仍然使用 standard 或 function-calling 模式

**可能原因：**
1. `functionCallingEnabled` 为 `true`，优先级更高
2. `useTools` 为 `false`，two-phase 需要 tools

**解决方案：**
```bash
[newma] ❯ /set functionCalling false
[newma] ❯ /set tools true
[newma] ❯ /set executionMode two-phase
```

### 问题：Autonomous 模式没有自动禁用

**症状：** 设置 two-phase 后，autonomous 仍然启用

**检查步骤：**
```bash
[newma] ❯ /status
# 查看 "Autonomous" 和 "Execution Mode" 的值
```

**手动禁用：**
```bash
[newma] ❯ /set autonomous false
```

## 相关文件

- `src/session.ts` - SessionManager.setAutonomous()
- `src/repl.ts` - REPL 命令处理和执行路由
- `src/agents/two-phase/coordinator-v2.ts` - Two-phase 协调器
- `src/agents/two-phase/plan-agent-v2.ts` - 规划代理
- `src/agents/two-phase/execute-agent-v2.ts` - 执行代理

## 后续改进

1. **添加冲突检测警告**
   - 如果用户尝试手动启用 autonomous 与 two-phase 同时使用，显示警告

2. **模式兼容性矩阵**
   - 在 `/set` 命令中显示哪些模式可以组合使用

3. **智能模式推荐**
   - 根据任务类型自动推荐最合适的执行模式

## 版本信息

- **实现版本**: v3.1.0
- **实现日期**: 2025-01-18
- **测试状态**: ✅ 所有测试通过
