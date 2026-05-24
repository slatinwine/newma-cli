# 计划模式修复文档

## 问题概述

**日期**: 2026-01-17
**版本**: v3.1.0
**影响范围**: `/plan` 命令（计划模式）

### 用户报告的问题

```
不行，计划模式还是不行
```

用户在使用 `/plan` 命令时，AI 返回了乱码响应，包含大量 "---" 重复字符和格式错误的内容，而不是标准的 JSON 格式计划。

### 错误示例

```javascript
// 预期的 JSON 响应：
{
  "todo": ["任务1", "任务2"],
  "actions": [
    { "type": "create", "path": "test.js", "content": "..." }
  ]
}

// 实际收到的响应：
\n// ✅ 1: Tests Passed!\\n' +\n```\n---\n    <script>...
```

---

## 根本原因分析

### 1. API 参数冲突

**位置**: `src/ai.ts:838-859`

**问题代码**:
```typescript
if (mode !== 'think') {
  // 强制 JSON 模式
  requestBody.response_format = { type: "json_object" };

  // 同时添加工具定义
  if (availableTools && availableTools.length > 0) {
    requestBody.tools = availableTools.map(toolName => ({
      type: "function",
      function: {
        name: toolName,
        description: `Capability: ${toolName}`,
        parameters: {
          type: "object",
          properties: {},
        }
      }
    }));
  }
}
```

**问题**: 同时使用了 `response_format` 和 `tools` 参数

### 2. OpenAI API 限制

根据 OpenAI API 文档：
- **`response_format: { type: "json_object" }`** - 强制 AI 返回有效 JSON
- **`tools: [...]`** - 提供 Function Calling 功能

**这两个参数是互斥的！**

当同时使用时：
- API 可能返回错误或不可预测的结果
- AI 可能返回格式混乱的内容
- 某些 API 提供商可能完全拒绝请求

### 3. 为什么会产生乱码？

1. **API 响应混乱**: 互斥参数导致 API 返回不一致的格式
2. **JSON 解析失败**: `extractJSON()` 无法从混乱内容中提取有效 JSON
3. **错误处理不足**: 代码没有正确处理 Function Calling 的 `tool_calls` 响应

---

## 解决方案

### 修复 1: 移除 API 参数冲突

**文件**: `src/ai.ts:838-854`

```typescript
// ✅ 正确实现：优先使用 tools，回退到 response_format
if (availableTools && availableTools.length > 0) {
  // 使用 Function Calling - 不使用 response_format（互斥）
  requestBody.tools = availableTools.map(toolName => ({
    type: "function",
    function: {
      name: toolName,
      description: `Capability: ${toolName}`,
      parameters: {
        type: "object",
        properties: {},
      }
    }
  }));
} else if (mode !== 'think') {
  // 无工具时才使用 JSON 模式
  requestBody.response_format = { type: "json_object" };
}
```

**原则**:
- **有工具时**: 使用 `tools`，允许 AI 调用工具或返回 JSON
- **无工具时**: 使用 `response_format` 强制 JSON 输出

### 修复 2: 添加 Function Calling 响应处理

**文件**: `src/ai.ts:1000-1022`

```typescript
// 处理 Function Calling 响应
if (message?.tool_calls && message.tool_calls.length > 0) {
  const duration = Date.now() - startTime;
  const usage = data.usage ? {
    prompt_tokens: data.usage.prompt_tokens,
    completion_tokens: data.usage.completion_tokens,
    total_tokens: data.usage.total_tokens
  } : undefined;

  // 返回 tool_calls 给调用者处理
  const response: ExtendedAIResponse = {
    todo: [],
    actions: [],
    done: false,
    duration,
    usage,
    ultrathinkEnabled: false,
    content: JSON.stringify(message.tool_calls, null, 2),
    toolCalls: message.tool_calls,
    type: 'tool_calls',
  };
  return response;
}
```

### 修复 3: 更新类型定义

**文件**: `src/ai.ts:165-173`

```typescript
export interface ExtendedAIResponse extends AIResponse {
  thoughtTree?: ThoughtTree;
  planAlternatives?: PlanAlternatives;
  ultrathinkEnabled?: boolean;
  content?: string;
  type?: 'task' | 'analysis' | 'error' | 'tool_calls'; // 添加 'tool_calls'
  message?: string;
  toolCalls?: any[]; // 添加 toolCalls 字段
}
```

---

## 技术洞察

### ReAct 模式最佳实践

根据对 AI Agent 架构的研究（参考 Anthropic "Building effective agents"）：

#### ❌ 错误做法：强制 JSON 模式 + Function Calling
```typescript
// 这样做会导致 API 冲突
const requestBody = {
  response_format: { type: "json_object" },
  tools: [...], // 冲突！
};
```

#### ✅ 正确做法：纯 Function Calling + 客户端循环
```typescript
// 只使用 tools，不使用 response_format
const requestBody = {
  tools: buildToolDefinitions(registry),
  // ❌ 不要加 response_format
};

// 客户端实现 ReAct 循环
while (!taskDone) {
  const response = await callAIWithTools();
  if (response.tool_calls) {
    // 执行工具调用
    const results = await executeTools(response.tool_calls);
    // 将结果返回给 AI
    messages.push(...results);
  } else {
    // AI 完成任务
    taskDone = true;
  }
}
```

### Function Calling vs JSON Mode

| 特性 | Function Calling | JSON Mode |
|------|------------------|-----------|
| **参数** | `tools: [...]` | `response_format: { type: "json_object" }` |
| **AI 能力** | 可调用工具 + 返回结构化数据 | 仅返回 JSON |
| **适用场景** | 需要收集信息、执行操作 | 只需要结构化输出 |
| **响应格式** | `tool_calls` 或 `content` | `content` (JSON) |
| **灵活性** | 高（AI 决策） | 低（固定格式） |

### Workflows vs Agents

- **Workflows（工作流）**: 预定义的代码路径，适合确定性任务
- **Agents（智能体）**: AI 动态决定自己的行动，适合复杂推理

计划模式应该采用 **Agent 模式**：
- AI 决定是否调用工具
- AI 决定何时返回最终计划
- 客户端管理 ReAct 循环

---

## 经验教训

### 1. API 文档的重要性

**教训**: 不要假设 API 参数可以随意组合

**改进**:
- ✅ 阅读官方 API 文档
- ✅ 注意参数限制和互斥性
- ✅ 测试边界情况

### 2. 错误处理必须完整

**教训**: 只处理成功场景是不够的

**改进**:
- ✅ 处理 `tool_calls` 响应
- ✅ 处理 `content` 响应
- ✅ 处理错误和异常情况
- ✅ 添加类型安全

### 3. 分层架构的价值

**教训**: 清晰的层次结构便于调试

**现有架构**:
```
callAI (通用) → 调用 OpenAI API
  ├─ 处理 response_format (无工具时)
  └─ 处理 tools (有工具时)
      ├─ 返回 tool_calls → executeWithFunctionCalling 处理
      └─ 返回 content → 提取 JSON
```

### 4. 渐进式修复策略

**采取的步骤**:
1. ✅ 研究最佳实践（Web Search）
2. ✅ 识别根本原因（API 参数冲突）
3. ✅ 最小化修改（只改必要部分）
4. ✅ 保持向后兼容（无工具时仍用 JSON mode）
5. ✅ 更新类型定义（类型安全）

---

## 测试验证

### 单元测试

**文件**: `test-plan-mode.js`

```javascript
// 测试 1: 有工具时应该返回 tool_calls 或 JSON actions
const response1 = await callAI(config, projectInfo, requirement, 'plan', undefined, ['list_files', 'read_file']);

// 测试 2: 无工具时应该返回 JSON actions
const response2 = await callAI(config, projectInfo, requirement, 'plan', undefined, undefined);
```

### 手动测试

```bash
# 1. 配置有效的 API Key
echo "OPENAI_API_KEY=sk-..." > .env

# 2. 构建
npm run build

# 3. 启动 REPL
npx newma-cli -i

# 4. 测试计划模式
[newma] ❯ /plan 总结项目
[newma] ❯ /plan 添加用户认证功能
```

### 预期结果

- ✅ 不再出现乱码响应
- ✅ AI 可以正常调用工具（如需要）
- ✅ AI 返回有效的 JSON 计划或 tool_calls
- ✅ `/plan` 命令正常工作

---

## 相关文档

### 内部文档
- `CLAUDE.md` - 项目架构和开发指南
- `PHASE6_SUMMARY.md` - Phase 6 实现细节
- `TWO_PHASE_GUIDE.md` - 两阶段执行模式指南
- `BUGFIX_EMPTY_PLAN.md` - 相关 bug 修复案例

### 外部参考
- [OpenAI API - Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [OpenAI API - Response Format](https://platform.openai.com/docs/api-reference/chat/create#chat-create-response_format)
- [Anthropic - Building effective agents](https://docs.anthropic.com/en/docs/build-with-claude/agentic-systems)
- [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)

---

## 未来改进

### 短期
1. ✅ 移除 API 参数冲突
2. ✅ 添加 tool_calls 响应处理
3. ✅ 更新类型定义
4. ⏳ 添加更多单元测试
5. ⏳ 改进错误消息

### 中期
1. ⏳ 实现 ReAct 循环优化
2. ⏳ 添加工具调用缓存
3. ⏳ 支持多轮工具调用
4. ⏳ 性能监控和日志

### 长期
1. ⏳ 简化架构（移除旧代码路径）
2. ⏳ 统一 Function Calling 接口
3. ⏳ 支持更多 AI 提供商
4. ⏳ 自动测试和回归检测

---

## 变更历史

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-01-17 | v3.1.0 | 初始版本 - 修复计划模式 API 参数冲突 |

---

## 维护者注记

**关键要点**:
- ❌ **永远不要**同时使用 `response_format` 和 `tools`
- ✅ Function Calling 应该优先于 JSON 模式
- ✅ 客户端应该管理 ReAct 循环，而不是强制 JSON
- ✅ 保持 API 调用的简洁性和可预测性

**代码审查检查清单**:
- [ ] 检查是否有 `response_format` 和 `tools` 同时使用
- [ ] 确认 `tool_calls` 响应被正确处理
- [ ] 验证类型定义包含所有必要字段
- [ ] 测试有工具和无工具两种场景

---

**文档版本**: 1.0
**最后更新**: 2026-01-17
**状态**: ✅ 已验证
