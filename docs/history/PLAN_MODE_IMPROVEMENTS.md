# Newma (牛码) 计划模式改进总结

**日期**: 2025-01-18
**基于**: Claude Code 的成功经验
**改进文件**: `src/ai.ts`, `prompts/SYSTEM_PROMPT.md`

## 📊 改进背景

### 发现的问题

1. **过度强调 JSON 格式**
   - 旧提示词使用 "🚨 MOST CRITICAL", "NEVER", "ALWAYS" 等强烈语言
   - 导致 AI 紧张，反而产生混乱输出

2. **缺少任务复杂度评估**
   - 所有任务都要求完整的 todo + actions
   - 简单任务也被过度规划

3. **缺少实用性指导**
   - 没有渐进式执行的概念
   - 缺少简单 vs 复杂任务的对比示例

## ✨ 改进内容

### 1. 添加任务复杂度评估

**位置**: `src/ai.ts` 第 688-704 行

```typescript
**Task Complexity Assessment:**

**SIMPLE TASKS** (direct execution):
- Single command (e.g., "run tests", "build project")
- Read 1-2 files for information
- Can be completed in <3 steps

→ Generate minimal actions (1-2 actions), todo can be empty array

**COMPLEX TASKS** (structured planning):
- Requires 3+ steps
- Multiple files or components
- Needs analysis or design

→ Break down into clear todo items with corresponding actions
```

### 2. 简化语言，去除过度强调

**改进前**:
```
**🚨 MOST CRITICAL: YOU MUST ALWAYS RETURN JSON WITH ACTIONS**
- NEVER directly answer questions in text
- NEVER provide explanations without actions
```

**改进后**:
```
**Task Complexity Assessment:**
Before generating actions, quickly assess the task:

**Important:**
- Return valid JSON only (no markdown, no extra text)
- Simple tasks → minimal planning
- Complex tasks → structured todo + actions
```

### 3. 添加实用示例

**位置**: `src/ai.ts` 第 723-757 行

**示例 1 - 简单任务**:
```json
{
  "todo": [],
  "actions": [
    {"type": "run", "command": "npm test"}
  ]
}
```

**示例 2 - 中等任务**:
```json
{
  "todo": ["Read package.json"],
  "actions": [
    {"type": "run", "command": "cat package.json"}
  ]
}
```

**示例 3 - 复杂任务**:
```json
{
  "todo": [
    "Analyze existing code structure",
    "Design authentication system",
    "Implement authentication utilities",
    "Integrate into application"
  ],
  "actions": [
    {"type": "run", "command": "find . -name '*.ts' | head -20"},
    {"type": "run", "command": "cat src/index.ts"},
    {"type": "create", "path": "src/auth.ts", "content": "..."}
  ]
}
```

### 4. 强调渐进式执行

**新增指导**:
```typescript
3. **Be practical and incremental**:
   - Start with exploration if uncertain
   - Don't over-plan simple tasks
   - Use verify actions for checks: {"type": "verify", "command": "npm test"}
```

### 5. 更新 SYSTEM_PROMPT.md

**位置**: `prompts/SYSTEM_PROMPT.md` 第 126-180 行

添加了与 `src/ai.ts` 一致的任务复杂度评估和示例。

## 📈 预期效果

### 改进前

**问题**: 简单任务也生成过度规划
```json
// 用户: "Run tests"
// AI 可能返回:
{
  "todo": [
    "Check if tests exist",
    "Run test command",
    "Verify results",
    "Check exit code"
  ],
  "actions": [...]
}
```

### 改进后

**效果**: 简单任务直接执行
```json
// 用户: "Run tests"
// AI 返回:
{
  "todo": [],
  "actions": [
    {"type": "run", "command": "npm test"}
  ]
}
```

## 🎯 关键改进点

1. ✅ **任务复杂度判断** - 简单任务不过度规划
2. ✅ **语言更友好** - 去除过度强调，保持专业性
3. ✅ **实用示例** - 简单/中等/复杂任务对比
4. ✅ **渐进式思维** - 强调探索 → 执行 → 验证
5. ✅ **与 Claude Code 一致** - 采用简洁高效的工作方式

## 📝 文件变更清单

### 修改的文件

1. **src/ai.ts** (第 684-763 行)
   - 重写 `modePrompt` 中的 plan 模式提示词
   - 添加任务复杂度评估
   - 添加实用示例
   - 简化语言

2. **prompts/SYSTEM_PROMPT.md** (第 126-180 行)
   - 更新 "AI Working Guidelines" 章节
   - 添加任务复杂度评估
   - 添加简单/中等/复杂任务示例

### 新增的文件

3. **test-improved-plan.ts**
   - 测试改进后的计划模式
   - 验证简单任务的响应
   - 验证复杂任务的响应

## 🚀 使用建议

### 对于简单任务

```bash
npx newma-cli "Run tests"
npx newma-cli "Build the project"
npx newma-cli "Check package.json"
```

**预期**: 快速响应，1-2 个 actions，todo 可以为空

### 对于复杂任务

```bash
npx newma-cli "Add user authentication"
npx newma-cli "Implement REST API"
npx newma-cli "Refactor authentication system"
```

**预期**: 结构化的 todo (3-7 项)，对应的 actions

## 📚 相关文档

- `AI_ASSISTANT_GUIDE.md` - Claude Code 工作指南
- `CLAUDE.md` - Newma (牛码) 项目文档
- `prompts/SYSTEM_PROMPT.md` - 系统提示词

## ✅ 结论

通过引入任务复杂度评估、简化语言、添加实用示例，Newma (牛码) 的计划模式现在：

- **更简洁** - 简单任务不再过度规划
- **更实用** - 强调渐进式执行
- **更清晰** - 明确的简单 vs 复杂任务区分
- **更一致** - 与 Claude Code 的成功经验对齐

这些改进将显著提升用户体验，使 Newma (牛码) 更加高效和易用！
