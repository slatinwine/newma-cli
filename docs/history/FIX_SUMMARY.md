# 修复总结：AI 返回代码片段而非 JSON 的问题

## 🐛 问题描述

**触发条件**：
```bash
[kode] (PLAN) ❯ /plan 你好
```

**错误行为**：
- AI 返回了测试文件代码片段，而不是预期的 JSON 格式
- 系统报错：`❌ AI Response Validation Error - Expected JSON but got:`

## 🔍 根本原因

1. **输入不当**：用户输入 `/plan 你好` 是简单问候，不是编程任务
2. **系统提示词冲突**：prompt.ts 要求严格的 JSON 输出
3. **项目文件干扰**：scanner.ts 扫描了所有测试文件（test-*.ts）
4. **AI 混淆**：不知道如何将"你好"转换为行动计划的 JSON，返回了项目中的测试代码

## ✅ 实施的修复

### 方案 1：输入验证（src/repl.ts:884-969）

**添加了 `handlePlanCommand` 中的验证逻辑**：
- 检查输入长度（最小 3 字符）
- 检测纯问候语（hi, hello, 你好, etc.）
- 优先检测编程关键词（add, create, fix, etc.）
- 无效输入时显示友好的错误消息和示例

**新增 `isValidTaskRequirement` 方法**：
```typescript
private isValidTaskRequirement(requirement: string): boolean {
  // 1. 长度检查
  // 2. 优先检查编程关键词
  // 3. 检查是否是纯问候语
  // 4. 其他情况拒绝
}
```

### 方案 2：改进系统提示词（src/prompt.ts:77-85）

**添加了边缘情况处理**：
```typescript
**EDGE CASE HANDLING**
🔸 If the user input is NOT a valid programming task,
   return: {"error": "invalid_input", "message": "..."}
🔸 If the requirement is too vague,
   return: {"error": "unclear_requirement", "message": "..."}
🔸 If cannot generate a valid action plan,
   return: {"error": "cannot_plan", "message": "..."}

IMPORTANT: Always return a valid JSON object, even for errors.
```

## 🧪 测试验证

创建了 `test-input-validation.ts`，包含 19 个测试用例：

**应该拒绝的输入**：
- ✅ 你好
- ✅ hello
- ✅ hi
- ✅ 早上好
- ✅ a, ab（太短）

**应该接受的输入**：
- ✅ Add user authentication
- ✅ Create a REST API
- ✅ Fix the login bug
- ✅ 添加登录功能
- ✅ hello world add feature（包含关键词）

**测试结果**：🎉 19/19 通过

## 📊 修复效果

### 修复前：
```bash
[kode] (PLAN) ❯ /plan 你好
🤖 Thinking...
❌ AI Response Validation Error
❌ Expected JSON but got:
#!/usr/bin/env ts-node
... (code dump)
```

### 修复后：
```bash
[kode] (PLAN) ❯ /plan 你好

⚠️  Invalid task requirement
The /plan command is for programming tasks, not casual conversation.

Examples of valid tasks:
  • /plan Add user authentication
  • /plan Create a REST API
  • /plan Fix the login bug
  • /plan Implement a search feature

💡 For casual conversation, just type without /plan:

  [newma] ❯ 你好
  [newma] ❯ hello
```

## 💡 用户体验改进

1. **即时反馈**：无效输入立即被拦截，不浪费 API 调用
2. **清晰引导**：显示有效任务示例，帮助用户理解如何使用
3. **友好提示**：引导用户使用默认聊天模式进行对话
4. **多语言支持**：同时支持中文和英文关键词

## 🎯 关键特性

- ✅ **零额外成本**：输入验证在本地完成，无需 API 调用
- ✅ **向后兼容**：所有有效任务继续正常工作
- ✅ **双重保护**：客户端验证 + 服务器端提示词改进
- ✅ **可扩展**：易于添加更多关键词或规则

## 📝 相关文件

| 文件 | 修改内容 |
|------|---------|
| `src/repl.ts` | 添加输入验证逻辑（894-969行） |
| `src/prompt.ts` | 添加边缘情况处理（77-85行） |
| `test-input-validation.ts` | 新建测试文件 |

## 🚀 后续建议

1. **监控日志**：收集无效输入模式，持续优化关键词列表
2. **智能建议**：考虑基于项目上下文提供任务建议
3. **可配置规则**：允许用户自定义验证规则（如 `.kodeignore`）
4. **机器学习**：未来可以使用 ML 模型更智能地识别任务类型

---

**修复日期**：2025-01-17
**版本**：3.1.0+
**状态**：✅ 已实施并测试通过
