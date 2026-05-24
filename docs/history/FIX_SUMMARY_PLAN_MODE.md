# 计划模式修复总结

**日期**: 2026-01-17
**版本**: v3.1.0
**状态**: ✅ 已完成

## 🎯 问题描述

`/plan` 命令返回乱码响应，包含大量重复的 "---" 和格式错误的内容，而不是有效的 JSON 计划。

## 🔍 根本原因

**OpenAI API 参数冲突**: 同时使用了互斥的参数 `response_format` 和 `tools`

```typescript
// ❌ 错误代码（src/ai.ts:838-859）
if (mode !== 'think') {
  requestBody.response_format = { type: "json_object" }; // 强制 JSON
  if (availableTools && availableTools.length > 0) {
    requestBody.tools = [...]; // Function Calling - 冲突！
  }
}
```

## ✅ 解决方案

### 1. 移除 API 参数冲突（优先使用 tools）

```typescript
// ✅ 正确实现（src/ai.ts:838-854）
if (availableTools && availableTools.length > 0) {
  // 使用 Function Calling - 不使用 response_format
  requestBody.tools = [...];
} else if (mode !== 'think') {
  // 无工具时才使用 JSON 模式
  requestBody.response_format = { type: "json_object" };
}
```

### 2. 添加 tool_calls 响应处理（src/ai.ts:1000-1022）

```typescript
if (message?.tool_calls && message.tool_calls.length > 0) {
  return {
    type: 'tool_calls',
    toolCalls: message.tool_calls,
    // ...
  };
}
```

### 3. 更新类型定义（src/ai.ts:165-173）

```typescript
export interface ExtendedAIResponse extends AIResponse {
  type?: 'task' | 'analysis' | 'error' | 'tool_calls';
  toolCalls?: any[];
}
```

## 📝 修改文件

- ✅ `src/ai.ts` - 修复 API 参数冲突，添加 tool_calls 处理
- ✅ `BUGFIX_PLAN_MODE.md` - 详细的技术文档
- ✅ `CLAUDE.md` - 添加经验教训和修复指南
- ✅ `test-plan-mode.js` - 测试脚本（已创建，需有效 API Key）

## 🎓 关键经验

### API 参数互斥性
- **Function Calling (`tools`)** vs **JSON Mode (`response_format`)** - 不能同时使用
- 优先使用 `tools`，允许 AI 调用工具或返回 JSON
- 无工具时才回退到 `response_format`

### ReAct 最佳实践
```typescript
// ✅ 正确：纯 Function Calling + 客户端循环
const requestBody = { tools: [...] };

while (!taskDone) {
  const response = await callAIWithTools();
  if (response.tool_calls) {
    await executeTools(response.tool_calls);
  } else {
    taskDone = true;
  }
}
```

### 响应处理完整性
- 必须处理 `tool_calls` 响应
- 必须处理 `content` 响应
- 必须处理错误情况
- 类型安全很重要

## 🧪 测试说明

由于 `.env` 中的 API Key 是占位符，无法运行实际测试。

**要测试修复**:
```bash
# 1. 配置有效的 API Key
echo "OPENAI_API_KEY=你的真实key" > .env

# 2. 构建项目
npm run build

# 3. 启动 REPL
npx newma-cli -i

# 4. 测试计划模式
[newma] ❯ /plan 总结项目
[newma] ❯ /plan 添加用户认证功能
```

**预期结果**:
- ✅ 不再出现乱码响应
- ✅ AI 可以正常调用工具（如需要）
- ✅ AI 返回有效的 JSON 计划或 tool_calls
- ✅ `/plan` 命令正常工作

## 📚 相关文档

- **详细技术文档**: `BUGFIX_PLAN_MODE.md`
- **开发指南**: `CLAUDE.md` (Integration Lessons #7)
- **修复指南**: `CLAUDE.md` (Common Tasks → Fix API compatibility issues)

## 🔗 外部参考

- [OpenAI API - Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [OpenAI API - Response Format](https://platform.openai.com/docs/api-reference/chat/create#chat-create-response_format)
- [Anthropic - Building effective agents](https://docs.anthropic.com/en/docs/build-with-claude/agentic-systems)
- [ReAct Paper](https://arxiv.org/abs/2210.03629)

---

**维护**: Newma (牛码) Development Team
**最后更新**: 2026-01-17
