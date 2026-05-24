# 交互式计划模式使用指南

## 概述

计划模式 (`/plan`) 现在支持完整的交互式导航，让您可以在执行前充分审查和调整计划。

## 新增功能

### 🎯 复杂任务的交互式导航

当您使用 `/plan` 命令处理复杂任务时，系统会进入交互式计划模式，提供以下导航选项：

#### 1️⃣ 选项选择阶段

显示多个实施方案供您选择：

```
📊 Multiple Implementation Options
══════════════════════════════════════════════════

  [1] 保守方案 (MVP)
      快速实现基础功能
      ⏱️  10000ms  │  Risk: low  │  Confidence: 70%
      ✅ 快速上线  |  低风险
      ❌ 功能有限

  [2] 激进方案 (完整重构)
      完全重构，最佳实践
      ⏱️  30000ms  │  Risk: high  │  Confidence: 70%
      ✅ 长期质量高
      ❌ 耗时长  |  高风险

  [3] 平衡方案 (渐进式)
      平衡实施，预留扩展
      ⏱️  15000ms  │  Risk: medium  │  Confidence: 70%
      ✅ 可扩展
      ❌ 需后续迭代

══════════════════════════════════════════════════

请选择实施方案:
  [1] 保守方案 (MVP) (10s, low risk)
  [2] 激进方案 (完整重构) (30s, high risk)
  [3] 平衡方案 (渐进式) (15s, medium risk)
  ────────────────────────────────────────────────
  🔄 重新生成选项
  ❌ 退出
```

**可用操作**：
- 选择任一方案 → 进入确认阶段
- 🔄 **重新生成选项** - 生成新的实施方案（最多3次）
- ❌ **退出** - 取消计划流程

#### 2️⃣ 计划确认阶段

选定方案后，查看详细信息并确认：

```
📋 计划确认
══════════════════════════════════════════════════
方案: 平衡方案 (渐进式)
描述: 先实现基础，预留扩展接口
⏱️  预计时间: 15000ms
⚠️  风险等级: medium
信心度: 70%

📊 优缺点分析:
  ✅ 可扩展
  ❌ 需后续迭代

📝 执行步骤 (3 actions):
  1. [create] src/auth/login.ts
  2. [modify] src/App.tsx
  3. [run] npm test

══════════════════════════════════════════════════
请选择下一步操作:

  [1] ✅ 确认执行 - 开始执行此计划
  [2] ⬅️  返回上一步 - 重新选择方案
  [3] 🔄 继续计划 - 生成新的选项
  [4] ❌ 退出 - 取消计划
```

**可用操作**：
- ✅ **确认执行** - 开始执行计划
- ⬅️ **返回上一步** - 重新选择实施方案
- 🔄 **继续计划** - 生成新的选项（最多3次）
- ❌ **退出** - 取消计划流程

## 状态机流程

```
用户输入: /plan <requirement>
         ↓
    FFT 分析 (1-2s)
         ↓
   ┌────┴────┐
   │         │
简单任务   复杂任务
   │         │
直接执行   进入状态机
           ↓
      选项选择
      ├─ 选择方案 → 计划确认
      ├─ 重新生成 → FFT分析 → 选项选择
      └─ 退出 → 结束

      计划确认
      ├─ 确认执行 → 执行计划
      ├─ 返回上一步 → 选项选择
      ├─ 重新生成 → FFT分析 → 选项选择
      └─ 退出 → 结束
```

## 使用场景

### 场景 1: 简单任务（直接执行）

```bash
[newma] ❯ /plan 创建一个测试文件
⚡ FFT Planning Mode (Fast and Frugal)
⚡ [FFT Planner] Analyzing task complexity...
⚡ [FFT] Complexity: SIMPLE
⚡ [FFT] Reasoning: 任务描述简短

⏱️  FFT Analysis: 1247ms

✅ Simple task detected - executing single plan

📋 Execution Plan
─────────────────────────────────────────
Plan: 基础方案
⏱️  Estimated: 5000ms
⚠️  Risk: medium
─────────────────────────────────────────

Executing 1 actions...
✅ Done
```

### 场景 2: 复杂任务（交互式导航）

```bash
[newma] ❯ /plan 添加用户认证系统
⚡ FFT Planning Mode (Fast and Frugal)
⚡ [FFT Planner] Analyzing task complexity...
⚡ [FFT] Complexity: COMPLEX
⚡ [FFT] Reasoning: 包含复杂关键词: 系统

⏱️  FFT Analysis: 1892ms

💡 Complex task detected - entering interactive planning

📊 Multiple Implementation Options
══════════════════════════════════════════════════
[显示3个选项...]
══════════════════════════════════════════════════

? 请选择实施方案: [3]
✅ Selected: 平衡方案 (渐进式)

📋 计划确认
══════════════════════════════════════════════════
[显示详细信息...]
══════════════════════════════════════════════════

? 请选择 [1-4]: 1
✅ 确认执行

Executing 3 actions...
✅ Done
```

### 场景 3: 不满意选项（重新生成）

```bash
[newma] ❯ /plan 添加用户认证系统
[显示选项...]

? 请选择实施方案: 🔄 重新生成选项

═══════════════════════════════════════════════════
请选择下一步操作:

  [1] ✅ 选择方案 - 从可用的实施方案中选择一个
  [2] 🔄 重新生成选项 (已使用 1/3)
  [3] ❌ 退出 - 取消计划流程

? 请选择 [1-3]: 2

🔄 重新生成方案选项...

⚡ [FFT Planner] Analyzing task complexity...
⏱️  FFT Analysis: 1456ms

📊 Multiple Implementation Options
[显示新的选项...]
```

### 场景 4: 返回上一步

```bash
📋 计划确认
[显示确认信息...]

? 请选择 [1-4]: 2  ← 返回上一步

📊 Multiple Implementation Options
[返回到选项选择...]
```

## 配置选项

### 最大重新生成次数

默认情况下，您可以重新生成选项最多 **3次**。这个限制可以在代码中配置：

```typescript
// src/plan-state-machine/index.ts
const config = {
  allowRegenerate: true,
  maxRegenerations: 3,  // 可调整
};
```

### 禁用重新生成

如果您想禁用重新生成功能，可以修改配置：

```typescript
const config = {
  allowRegenerate: false,
  maxRegenerations: 0,
};
```

## 技术实现

### 状态机架构

交互式计划使用状态机模式管理流程：

- **状态定义**: `ANALYZING` → `OPTION_SELECTION` → `PLAN_CONFIRMATION` → `EXECUTING`
- **状态转换**: 基于用户导航操作
- **状态历史**: 保存历史记录以支持返回功能

### 文件结构

```
src/
├── plan-state-machine/
│   ├── types.ts          # 状态机类型定义
│   └── index.ts          # 状态机实现
├── fft/
│   ├── planner.ts        # FFT 规划器
│   └── types.ts          # FFT 类型
└── repl.ts               # REPL 集成
```

### 关键类和方法

- `PlanStateMachine` - 状态机核心类
  - `transition(action)` - 状态转换
  - `promptNavigation()` - 显示导航菜单
  - `displayPlanConfirmation()` - 显示计划确认

- `REPLManager` - REPL 管理器
  - `executeWithFFTPlanner()` - FFT 规划入口
  - `executeWithStateMachine()` - 状态机执行
  - `handleOptionSelectionState()` - 处理选项选择
  - `handlePlanConfirmationState()` - 处理计划确认
  - `handleRegenerateState()` - 处理重新生成

## 向后兼容性

✅ **完全向后兼容**

- 简单任务继续直接执行（无状态机开销）
- 复杂任务自动使用状态机
- 现有 `/plan` 命令行为保持不变
- 新导航选项是额外功能，不影响原有流程

## 故障排除

### Q: 重新生成选项失败怎么办？

**A**: 系统会自动保留原有选项，显示错误信息并允许您继续：

```
❌ 重新生成失败: API error
使用原有选项...
```

### Q: 如何取消正在进行的计划？

**A**: 在任何导航菜单中选择 "❌ 退出" 选项：

```
? 请选择 [1-4]: 4
⚠️  计划已取消
```

### Q: 达到最大重新生成次数后还能继续吗？

**A**: 可以。达到限制后：

- "重新生成选项" 选项仍然显示
- 系统提示已达到上限
- 您可以选择其他选项（选择方案、退出）

```
⚠️  已达到最大重新生成次数 (3)
```

## 最佳实践

### 1. 充分利用重新生成功能

如果首次生成的选项不符合预期：
- 优先尝试重新生成（最多3次）
- 每次生成可能提供不同的方案

### 2. 仔细审查执行步骤

在确认阶段：
- 查看所有执行步骤
- 确认风险等级和时间估算
- 理解优缺点权衡

### 3. 善用返回功能

如果进入确认阶段后改变主意：
- 选择 "返回上一步" 重新选择方案
- 不需要重新生成整个流程

### 4. 简单任务无需等待

对于明显简单的任务：
- FFT 会自动识别并直接执行
- 无需通过交互式导航

## 版本信息

- **功能版本**: Phase 7.1 Enhanced
- **实现日期**: 2026-01-24
- **相关文档**:
  - `CLAUDE.md` - 项目架构和设计原则
  - `PHASE7_PLANNING_ALGORITHMS.md` - FFT 和 Landmark 算法
  - `README.md` - 用户指南

## 示例会话

完整的交互式计划会话示例：

```bash
[newma] ❯ /plan 添加完整的用户认证系统

⚡ FFT Planning Mode (Fast and Frugal)
─────────────────────────────────────────
⚡ [FFT Planner] Analyzing task complexity...

⚡ [FFT] Complexity: COMPLEX
⚡ [FFT] Reasoning: 包含复杂关键词: 系统; 涉及 3 个技术栈

⏱️  FFT Analysis: 1892ms

💡 Complex task detected - entering interactive planning

📊 Multiple Implementation Options
══════════════════════════════════════════════════

  [1] 保守方案 (MVP)
      快速实现基础登录功能
      ⏱️  10000ms  │  Risk: low  │  Confidence: 70%
      ✅ 快速上线  |  低风险
      ❌ 功能有限

  [2] 激进方案 (完整重构)
      JWT + OAuth2 + 多因素认证
      ⏱️  30000ms  │  Risk: high  │  Confidence: 70%
      ✅ 长期质量高
      ❌ 耗时长  |  高风险

  [3] 平衡方案 (渐进式)
      先实现基础，预留扩展接口
      ⏱️  15000ms  │  Risk: medium  │  Confidence: 70%
      ✅ 可扩展
      ❌ 需后续迭代

══════════════════════════════════════════════════

? 请选择实施方案 (Select implementation option): 🔄 重新生成选项

═══════════════════════════════════════════════════
请选择下一步操作:

  [1] ✅ 选择方案 - 从可用的实施方案中选择一个
  [2] 🔄 重新生成选项 (已使用 1/3)
  [3] ❌ 退出 - 取消计划流程

? 请选择 [1-3]: 2

🔄 重新生成方案选项...

⚡ [FFT Planner] Analyzing task complexity...
⏱️  FFT Analysis: 1456ms

📊 Multiple Implementation Options
[显示新生成的选项...]

? 请选择实施方案 (Select implementation option): [3] 平衡方案 (渐进式)
✅ Selected: 平衡方案 (渐进式)

📋 计划确认
══════════════════════════════════════════════════
方案: 平衡方案 (渐进式)
描述: 先实现基础，预留扩展接口
⏱️  预计时间: 15000ms
⚠️  风险等级: medium
信心度: 70%

📊 优缺点分析:
  ✅ 可扩展
  ❌ 需后续迭代

📝 执行步骤 (3 actions):
  1. [create] src/auth/login.ts
  2. [modify] src/App.tsx
  3. [run] npm test

══════════════════════════════════════════════════
请选择下一步操作:

  [1] ✅ 确认执行 - 开始执行此计划
  [2] ⬅️  返回上一步 - 重新选择方案
  [3] 🔄 继续计划 - 生成新的选项
  [4] ❌ 退出 - 取消计划

? 请选择 [1-4]: 1

✅ 确认执行

Executing 3 actions...
✅ Done
```

## 总结

交互式计划模式为复杂任务提供了完整的导航能力，让您可以：

- ✅ **查看多个方案** - 不同策略和权衡
- ✅ **重新生成选项** - 不满意可再试（最多3次）
- ✅ **返回上一步** - 重新选择方案
- ✅ **最终确认执行** - 执行前最后审查
- ✅ **随时退出** - 任何阶段都可以取消

简单任务保持快速直接执行，复杂任务自动进入交互式导航模式。两者无缝衔接，提供最佳用户体验。
