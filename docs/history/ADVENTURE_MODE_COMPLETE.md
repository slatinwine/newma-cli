# Adventure Mode 完整实现文档

**日期**: 2025-01-18
**状态**: ✅ 已完成
**版本**: 1.0.0

## 概述

Newma (牛码) 现在支持两种文字冒险风格的交互：

1. **Adventure Mode** - AI 生成多个实现方案让用户选择
2. **Plan Choice** - 计划生成后的选项菜单

---

## 功能 1: Adventure Mode

### 何时触发？

当 AI 生成的响应包含 `"type": "choice"` 时，自动进入 Adventure Mode。

### 用户界面

```
═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═
   需要为应用添加用户认证功能
═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═

  [A] - JWT 认证
  [B] - Session 认证
  [?] 查看详细信息

你的选择:
```

### 详细信息视图

用户选择 `?` 后，会看到每个选项的详细信息：

```
────────────────────────────────────────────────────────

[A] JWT 认证
使用 JSON Web Token 进行无状态认证

  优点:
    ✓ 性能好
    ✓ 易于扩展
    ✓ 支持移动端

  缺点:
    ✗ 需要处理 token 刷新

  执行步骤:
    1. 安装 JWT 库
    2. 实现登录接口
    3. 添加 token 验证

────────────────────────────────────────────────────────
```

### 实现细节

**文件**: `src/adventure.ts`

**核心方法**:
- `presentChoices()` - 显示选项并获取用户选择
- `presentWithDetails()` - 显示详细信息
- `executeChoice()` - 执行选定的方案

**数据结构**:
```typescript
interface Choice {
  id: string;
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  todo: string[];
  actions: Action[];
}

interface AdventureResponse {
  type: 'choice';
  scenario: string;
  choices: Choice[];
}
```

---

## 功能 2: Plan Choice

### 何时触发？

**每次** AI 生成计划后，都会显示 Plan Choice 菜单（在 REPL 模式下）。

### 用户界面

```
════════════════════════════════════════════════════════════
   计划已生成 - 选择下一步操作
════════════════════════════════════════════════════════════

📋 计划概要:
  待办事项: 3 个
  执行步骤: 3 个

  A - 继续执行当前计划
  B - 修改需求后重新计划
  C - 查看详细信息
  D - 取消

你的选择:
```

### 可用选项

| 选项 | 说明 | 行为 |
|------|------|------|
| **A - 继续执行** | 直接执行当前计划 | 跳过确认，开始执行 |
| **B - 修改需求** | 调整需求并重新计划 | 让用户输入新需求，AI 重新生成计划 |
| **C - 查看详细信息** | 显示计划的完整详情 | 显示所有 todo 和 actions |
| **D - 取消** | 取消执行 | 返回到 REPL 提示符 |

### 实现细节

**文件**: `src/plan-choice.ts`

**核心方法**:
- `presentPlanOptions()` - 显示选项菜单
- `showPlanDetails()` - 显示计划详情
- `describeAction()` - 格式化 action 描述

**集成位置**:
- `src/repl.ts` (line 1044-1178)
- 在显示计划后、执行前调用

---

## 使用示例

### 示例 1: Adventure Mode

```bash
$ npx newma-cli -i

[newma] ❯ 添加用户认证

🎮 Adventure Mode: Multiple approaches available

════════════════════════════════════════════════════════════
   需要为应用添加用户认证功能
════════════════════════════════════════════════════════════

  A - JWT 认证
  B - Session 认证
  ? - 查看详细信息

你的选择: A

✓ 选择了: A - JWT 认证
执行步骤:
  1. 安装 JWT 库
  2. 实现登录接口
  3. 添加 token 验证

🚀 Executing selected choice...

✓ Success: 运行命令: npm install jsonwebtoken

✅ All actions completed successfully!
```

### 示例 2: Plan Choice

```bash
$ npx newma-cli -i

[newma] ❯ 创建一个登录页面

📋 TODO List:
──────────────────────────────────────────────────────────
  1. 创建登录组件
  2. 添加表单验证
  3. 连接后端 API
──────────────────────────────────────────────────────────

⚡ Action Plan:
──────────────────────────────────────────────────────────
  1. 创建文件: src/components/Login.tsx
  2. 创建文件: src/styles/login.css
  3. 修改文件: src/App.tsx
──────────────────────────────────────────────────────────

════════════════════════════════════════════════════════════
   计划已生成 - 选择下一步操作
════════════════════════════════════════════════════════════

📋 计划概要:
  待办事项: 3 个
  执行步骤: 3 个

  A - 继续执行当前计划
  B - 修改需求后重新计划
  C - 查看详细信息
  D - 取消

你的选择: C

────────────────────────────────────────────────────────
  详细计划
────────────────────────────────────────────────────────

📋 待办事项:
  1. 创建登录组件
  2. 添加表单验证
  3. 连接后端 API

⚡ 执行步骤:
  1. 创建文件: src/components/Login.tsx
  2. 创建文件: src/styles/login.css
  3. 修改文件: src/App.tsx

────────────────────────────────────────────────────────

执行此计划? (y/N): y

🚀 Executing...

✓ Success: 创建文件: src/components/Login.tsx

✅ All actions completed successfully!
```

### 示例 3: 修改需求

```bash
你的选择: B

请输入新的需求: 创建一个支持 Google 登录的登录页面

🔄 重新计划中...

📋 新 TODO List:
──────────────────────────────────────────────────────────
  1. 安装 Google OAuth 库
  2. 创建 Google 登录组件
  3. 配置 OAuth 凭证
  4. 添加回调处理
──────────────────────────────────────────────────────────

⚡ 新 Action Plan:
──────────────────────────────────────────────────────────
  1. 运行命令: npm install @react-oauth/google
  2. 创建文件: src/components/GoogleLogin.tsx
  3. 修改文件: src/App.tsx
──────────────────────────────────────────────────────────

执行新计划? (Y/n): Y

🚀 Executing...
```

---

## 测试

### 运行测试脚本

```bash
npx ts-node test-adventure-mode.ts
```

### 手动测试

```bash
# 1. 启动 REPL
npx newma-cli -i

# 2. 测试 Adventure Mode（需要 AI 生成 choices）
> 添加用户认证系统

# 3. 测试 Plan Choice
> 创建一个测试文件

# 4. 测试修改需求
> [在 Plan Choice 中选择 B]
> [输入新需求]
```

---

## 配置选项

### 启用/禁用 Adventure Mode

当前 Adventure Mode 和 Plan Choice 都已**默认启用**。

未来可能添加配置选项：

```typescript
// settings.json
{
  "project": {
    "adventureMode": {
      "enabled": true,
      "alwaysShowChoices": false  // 只在 AI 生成 choices 时显示
    },
    "planChoice": {
      "enabled": true,
      "showOptions": "always"  // "always" | "complex" | "manual"
    }
  }
}
```

### CLI 选项

```bash
# 禁用 Plan Choice（直接执行）
npx newma-cli --no-plan-choice "创建文件"

# 启用 Adventure Mode（默认）
npx newma-cli --adventure "添加功能"
```

---

## 技术细节

### 类型定义

**src/types.ts**:
```typescript
export interface Choice {
  id: string;
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  todo: string[];
  actions: Action[];
}

export interface AdventureResponse {
  type: 'choice';
  scenario: string;
  choices: Choice[];
}
```

### AI 提示词

**src/ai.ts** (modePrompt):
```
**TASKS WITH MULTIPLE APPROACHES** (adventure mode):
- Has 2+ valid implementation strategies
- User needs to make design decisions
- Different technical trade-offs to consider

→ Return AdventureResponse with choices for user to select
```

**示例**:
```json
{
  "type": "choice",
  "scenario": "需要为应用添加用户认证功能",
  "choices": [...]
}
```

### REPL 集成

**src/repl.ts**:
1. 检查响应类型 (`aiResp.type === 'choice'`)
2. 调用 `adventureManager.presentChoices()`
3. 用户选择后执行对应的 actions
4. 在计划显示后调用 `planChoiceManager.presentPlanOptions()`
5. 根据用户选择执行相应操作

---

## 常见问题

### Q: Adventure Mode 和 Plan Choice 有什么区别？

**A**:
- **Adventure Mode**: AI 生成多个**实现方案**（如 JWT vs Session），用户选择技术路线
- **Plan Choice**: 计划生成后的**操作选项**（如继续、修改、取消），用户决定如何处理计划

### Q: 如何让 AI 生成多个方案？

**A**: 在需求中明确说明有多种方式：
- "添加用户认证（比较 JWT 和 Session）"
- "选择一个数据库（PostgreSQL, MongoDB, SQLite）"
- "实现 API（REST 或 GraphQL）"

### Q: 可以跳过 Plan Choice 直接执行吗？

**A**: 当前版本默认显示 Plan Choice。未来版本可能添加：
- CLI 选项：`--no-plan-choice`
- 快捷键：在 REPL 中输入 `/fast` 跳过选项

### Q: "修改需求"后原来的计划会丢失吗？

**A**: 是的，"修改需求"会重新生成计划。如果只是想微调，建议：
- 先选择"查看详细信息"
- 取消执行
- 用修改后的需求重新开始

---

## 未来改进

### 短期（下一个版本）

1. **配置选项**
   - settings.json 支持
   - CLI 选项

2. **更多 Plan Choice 选项**
   - "保存计划到文件"
   - "编辑计划"
   - "查看历史计划"

3. **Adventure Mode 增强**
   - 推荐（标记最佳选项）
   - 比较（并排显示多个选项）

### 长期（未来版本）

4. **智能选项**
   - 根据任务复杂度自动决定是否显示选项
   - 学习用户偏好

5. **计划历史**
   - 保存所有生成的计划
   - 可以回到之前的计划

6. **协作功能**
   - 分享计划给团队
   - 计划审核和评论

---

## 总结

Adventure Mode 和 Plan Choice 为 Newma (牛码) 添加了强大的交互式决策能力：

✅ **Adventure Mode**: 让用户在多个技术方案中选择
✅ **Plan Choice**: 让用户控制计划的执行流程
✅ **无缝集成**: 与现有 REPL 完美配合
✅ **向后兼容**: 不影响现有功能
✅ **用户体验**: 类似文字冒险游戏的有趣交互

**开始使用**:
```bash
npx newma-cli -i
> 你的需求
```

---

**创建时间**: 2025-01-18
**状态**: 已完成并测试 ✅
**版本**: 1.0.0
