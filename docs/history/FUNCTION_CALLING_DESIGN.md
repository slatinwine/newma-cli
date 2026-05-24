# Function Calling API 集成设计文档

## 📋 概述

本文档描述如何将 Newma (牛码) CLI 从当前的"间接工具调用"（Indirect Tool Calling）迁移到 OpenAI 的"Function Calling API"（Direct Tool Calling）。

**目标**：让 AI 直接选择并调用工具，无需适配器层转换。

---

## 🔍 当前实现 vs Function Calling

### 当前实现（Indirect）

```typescript
// 1. AI 返回 JSON（包含旧格式 actions）
{
  "todo": ["扫描文件", "读取配置"],
  "actions": [
    { "type": "run", "command": "ls -la" },
    { "type": "run", "command": "cat package.json" }
  ]
}

// 2. ActionAdapter 转换
const toolCall = actionToToolCall(
  { type: "run", command: "ls -la" },
  registry
);
// → { tool: "list_files", parameters: {...} }

// 3. ToolExecutor 执行
await toolExecutor.executeToolCall(toolCall);
```

**特点**：
- ✅ 简单：AI 返回固定 JSON 格式
- ✅ 可控：我们自己解析和执行
- ❌ 冗余：需要适配器层转换
- ❌ 限制：AI 不能根据工具执行结果调整

---

### Function Calling API（Direct）

```typescript
// 1. AI 直接返回 tool_calls
{
  "tool_calls": [
    {
      "id": "call_abc123",
      "type": "function",
      "function": {
        "name": "list_files",
        "arguments": "{\"path\": \"src\", \"longFormat\": true}"
      }
    }
  ]
}

// 2. 直接执行（无需转换）
for (const call of response.tool_calls) {
  const args = JSON.parse(call.function.arguments);
  const result = await toolExecutor.executeToolCall({
    tool: call.function.name,
    parameters: args
  });
}

// 3. 将结果反馈给 AI（多轮对话）
await callAI({
  messages: [
    ...history,
    { role: "assistant", tool_calls: [...] },
    { role: "tool", tool_call_id: "call_abc123", content: result }
  ]
});
```

**特点**：
- ✅ 直接：AI 原生支持工具调用
- ✅ 智能：AI 根据工具结果动态调整
- ✅ 标准：OpenAI 官方推荐方式
- ❌ 复杂：需要处理多轮对话

---

## 🎯 设计决策

### 1. 渐进式迁移

**策略**：保持向后兼容，通过配置启用

```typescript
// 配置选项
interface Config {
  // 新增：是否启用 Function Calling
  functionCallingEnabled?: boolean;
}

// 默认：false（使用当前的 JSON 方式）
// 用户可以通过 --function-calling 启用
```

**好处**：
- ✅ 不破坏现有功能
- ✅ 用户可以逐步测试
- ✅ 出问题可以快速回退

---

### 2. 两套执行路径

```typescript
// src/ai.ts
export async function callAI(...) {
  if (config.functionCallingEnabled) {
    // 新路径：Function Calling
    return await callAIWithFunctionCalling(...);
  } else {
    // 旧路径：JSON + ActionAdapter
    return await callAIWithJSON(...);
  }
}
```

**实现**：

**路径 1：Function Calling（新）**
```typescript
async function callAIWithFunctionCalling(...) {
  const requestBody = {
    model: config.model,
    messages: history,
    tools: buildToolDefinitions(registry),  // 完整工具定义
    // ❌ 不使用 response_format（与 tools 冲突）
  };

  const response = await fetch(endpoint, {
    body: JSON.stringify(requestBody)
  });

  const message = response.choices[0].message;

  // 检查是否有 tool_calls
  if (message.tool_calls && message.tool_calls.length > 0) {
    return {
      type: 'tool_calls',
      toolCalls: message.tool_calls,
      done: false
    };
  }

  // 没有 tool_calls，解析普通文本响应
  return {
    type: 'text',
    content: message.content,
    done: checkDone(message.content)
  };
}
```

**路径 2：JSON（旧）**
```typescript
async function callAIWithJSON(...) {
  const requestBody = {
    model: config.model,
    messages: history,
    response_format: { type: "json_object" },
    tools: availableTools.map(name => ({  // 简化工具定义
      type: "function",
      function: { name, description: `Capability: ${name}` }
    }))
  };

  const response = await fetch(...);
  const rawMessage = response.choices[0].message.content;

  // 解析 JSON
  const jsonStr = extractJSON(rawMessage);
  const parsed = JSON.parse(jsonStr);

  return {
    todo: parsed.todo,
    actions: parsed.actions,  // 旧格式
    done: parsed.done
  };
}
```

---

### 3. 工具定义格式

**问题**：Function Calling 需要完整的参数 schema（JSON Schema），而当前只提供名称和描述。

**当前**：
```typescript
requestBody.tools = availableTools.map(toolName => ({
  type: "function",
  function: {
    name: toolName,
    description: `Capability: ${toolName}`,
    parameters: {
      type: "object",
      properties: {}  // ❌ 空的
    }
  }
}));
```

**改进**：
```typescript
function buildToolDefinitions(registry: ToolRegistry): any[] {
  const tools = registry.list();

  return tools.map(tool => {
    // 从 Tool.parameters 构建 JSON Schema
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const param of tool.parameters || []) {
      properties[param.name] = {
        type: param.type,
        description: param.description
      };

      if (param.required) {
        required.push(param.name);
      }

      if (param.default !== undefined) {
        properties[param.name].default = param.default;
      }

      if (param.enum) {
        properties[param.name].enum = param.enum;
      }
    }

    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object",
          properties,
          required: required.length > 0 ? required : undefined
        }
      }
    };
  });
}
```

**示例**：
```typescript
// list_files 工具
{
  "type": "function",
  "function": {
    "name": "list_files",
    "description": "List directory contents (ls command)",
    "parameters": {
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "Directory path to list"
        },
        "showHidden": {
          "type": "boolean",
          "description": "Show hidden files"
        },
        "longFormat": {
          "type": "boolean",
          "description": "Use long listing format"
        },
        "recursive": {
          "type": "boolean",
          "description": "List subdirectories recursively"
        }
      },
      "required": []
    }
  }
}
```

---

### 4. 多轮对话支持

**场景**：AI 调用工具后，需要根据结果决定下一步

**示例**：
```bash
用户: "总结一下项目"
    ↓
AI: 调用 list_files({path: "src"})
    ↓
系统: 返回文件列表
    ↓
AI: 看到有很多 TypeScript 文件，调用 search_files({pattern: "export"})
    ↓
系统: 返回搜索结果
    ↓
AI: 读取关键文件...
    ↓
系统: 返回文件内容
    ↓
AI: 完成，返回总结
```

**实现**：
```typescript
// src/repl.ts
async function executeRequirement(requirement: string) {
  const history: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: requirement }
  ];

  let maxIterations = 10;  // 防止无限循环
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;

    // 调用 AI
    const aiResp = await callAI(config, ..., history);

    // 情况 1：AI 返回 tool_calls
    if (aiResp.type === 'tool_calls') {
      // 执行所有工具调用
      const toolResults = await Promise.all(
        aiResp.toolCalls.map(async (call) => {
          const args = JSON.parse(call.function.arguments);
          const result = await toolExecutor.executeToolCall({
            tool: call.function.name,
            parameters: args
          });

          // 构造 tool 消息
          return {
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result)
          };
        })
      );

      // 添加 assistant 消息（包含 tool_calls）
      history.push({
        role: "assistant",
        tool_calls: aiResp.toolCalls,
        content: null
      });

      // 添加 tool 消息（执行结果）
      history.push(...toolResults);

      // 继续循环，让 AI 决定下一步
      continue;
    }

    // 情况 2：AI 返回文本（完成或错误）
    if (aiResp.type === 'text') {
      // 添加最后的 assistant 消息
      history.push({
        role: "assistant",
        content: aiResp.content
      });

      // 显示结果
      console.log(aiResp.content);
      break;
    }

    // 情况 3：旧格式（向后兼容）
    if (aiResp.actions) {
      // 使用 ActionAdapter + ToolExecutor
      await executeActions(aiResp.actions);
      break;
    }
  }

  if (iteration >= maxIterations) {
    console.log(chalk.yellow('⚠️  达到最大迭代次数'));
  }
}
```

---

### 5. 错误处理

**工具执行失败**：
```typescript
const result = await toolExecutor.executeToolCall(toolCall);

if (!result.success) {
  // 将错误返回给 AI，让 AI 决定如何处理
  history.push({
    role: "tool",
    tool_call_id: call.id,
    content: JSON.stringify({
      error: true,
      message: result.error
    })
  });
}
```

**AI 看到错误后可以**：
- 尝试其他参数
- 调用其他工具
- 向用户报告错误

---

## 📐 实现计划

### Phase 1：基础结构（1-2 天）

**任务**：
1. ✅ 在 `Config` 中添加 `functionCallingEnabled` 选项
2. ✅ 在 `cli.ts` 中添加 `--function-calling` flag
3. ✅ 创建 `buildToolDefinitions()` 函数
4. ✅ 创建 `callAIWithFunctionCalling()` 函数骨架

**验收标准**：
- 配置选项生效
- 不破坏现有功能

---

### Phase 2：Function Calling 核心逻辑（2-3 天）

**任务**：
1. ✅ 实现完整的 `buildToolDefinitions()`（从 Tool 生成 JSON Schema）
2. ✅ 实现 `callAIWithFunctionCalling()` 的响应解析
3. ✅ 处理 `tool_calls` 响应
4. ✅ 处理普通文本响应

**验收标准**：
- AI 能返回 `tool_calls`
- 工具调用参数正确解析
- 单轮工具调用成功

---

### Phase 3：多轮对话（2-3 天）

**任务**：
1. ✅ 修改 `repl.ts` 支持多轮对话
2. ✅ 实现 tool 结果反馈给 AI
3. ✅ 添加最大迭代次数保护
4. ✅ 处理错误情况

**验收标准**：
- AI 可以连续调用多个工具
- 工具结果影响 AI 的下一步决策
- 不会陷入无限循环

---

### Phase 4：测试与优化（2-3 天）

**任务**：
1. ✅ 编写单元测试
2. ✅ 编写集成测试
3. ✅ 性能优化（并行工具调用）
4. ✅ 文档更新

**验收标准**：
- 测试覆盖率 > 80%
- 性能不低于当前实现
- 文档完整

---

### Phase 5：默认启用（1 天）

**任务**：
1. ✅ 收集用户反馈
2. ✅ 修复已知问题
3. ✅ 将默认值改为 `true`
4. ✅ 保留旧方式作为 fallback

**验收标准**：
- 默认启用 Function Calling
- 用户可以通过 `--no-function-calling` 禁用

---

## 🎯 关键代码示例

### 示例 1：完整的工具定义

```typescript
// src/ai.ts
function buildToolDefinitions(registry: ToolRegistry): any[] {
  const tools = registry.list();

  return tools.map(tool => {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const param of tool.parameters || []) {
      properties[param.name] = {
        type: param.type,
        description: param.description
      };

      if (param.required) {
        required.push(param.name);
      }

      if (param.default !== undefined) {
        properties[param.name].default = param.default;
      }

      // 枚举类型
      if (param.enum) {
        properties[param.name].enum = param.enum;
      }

      // 数组类型
      if (param.type === 'array' && param.itemType) {
        properties[param.name].items = {
          type: param.itemType
        };
      }
    }

    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object",
          properties,
          required: required.length > 0 ? required : undefined
        }
      }
    };
  });
}
```

---

### 示例 2：Function Calling 调用

```typescript
// src/ai.ts
async function callAIWithFunctionCalling(
  config: Config,
  projectInfo: Record<string, string>,
  userRequirement: string,
  history: Message[],
  registry: ToolRegistry,
  signal?: AbortSignal
): Promise<FunctionCallingResponse> {
  const endpoint = config.endpoint ||
    `${config.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;

  const systemMessage = buildSystemPrompt(projectInfo, 'plan');
  const userMessage = buildUserPrompt(userRequirement, projectInfo);

  const requestBody: any = {
    model: config.model,
    temperature: 0,
    messages: [
      { role: "system", content: systemMessage },
      ...history,
      { role: "user", content: userMessage }
    ],
    tools: buildToolDefinitions(registry),
    // ❌ 不使用 response_format
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal,
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const message = data.choices[0].message;

  // 检查 tool_calls
  if (message.tool_calls && message.tool_calls.length > 0) {
    return {
      type: 'tool_calls',
      toolCalls: message.tool_calls,
      done: false
    };
  }

  // 普通文本响应
  return {
    type: 'text',
    content: message.content || '',
    done: checkIfDone(message.content)
  };
}

function checkIfDone(content: string): boolean {
  // 检查是否包含完成标记
  const doneKeywords = [
    'done',
    'completed',
    'finished',
    '总结',
    '完成'
  ];

  const lowerContent = content.toLowerCase();
  return doneKeywords.some(keyword => lowerContent.includes(keyword));
}
```

---

### 示例 3：REPL 集成

```typescript
// src/repl.ts
async function executeWithFunctionCalling(requirement: string) {
  const history: Message[] = [
    { role: "system", content: buildSystemPrompt(...) }
  ];

  let iteration = 0;
  const maxIterations = 10;

  while (iteration < maxIterations) {
    iteration++;

    console.log(chalk.gray(`\n[迭代 ${iteration}] 调用 AI...\n`));

    // 调用 AI
    const aiResp = await callAIWithFunctionCalling(
      this.session.getConfig(),
      projectInfo,
      requirement,
      history,
      this.toolExecutor.getRegistry(),
      this.getAbortSignal()
    );

    // 处理 tool_calls
    if (aiResp.type === 'tool_calls') {
      console.log(chalk.cyan(`🔧 AI 调用了 ${aiResp.toolCalls.length} 个工具\n`));

      // 添加 assistant 消息
      history.push({
        role: "assistant",
        tool_calls: aiResp.toolCalls,
        content: null
      });

      // 并行执行所有工具调用
      const toolResults = await Promise.all(
        aiResp.toolCalls.map(async (call) => {
          const toolName = chalk.cyan(call.function.name);
          console.log(`  ⚙️  [${toolName}] ${call.function.arguments}`);

          const args = JSON.parse(call.function.arguments);
          const result = await this.toolExecutor.executeToolCall({
            tool: call.function.name,
            parameters: args
          });

          if (result.success) {
            console.log(chalk.green(`  ✅ [${toolName}] 成功`));
            // 截断长输出
            const output = result.output?.slice(0, 200) ||
                         result.data?.slice(0, 200) ||
                         'Done';
            if (result.output?.length > 200) {
              console.log(chalk.gray(`  📄 ${output}... (truncated)`));
            } else {
              console.log(chalk.gray(`  📄 ${output}`));
            }
          } else {
            console.log(chalk.red(`  ❌ [${toolName}] 失败: ${result.error}`));
          }

          return {
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result)
          };
        })
      );

      // 添加 tool 结果到历史
      history.push(...toolResults);

      // 继续循环
      continue;
    }

    // 处理文本响应
    if (aiResp.type === 'text') {
      console.log(chalk.gray('\n─'.repeat(50)));
      console.log(chalk.cyan('📝 AI 响应：\n'));
      console.log(aiResp.content);
      console.log(chalk.gray('\n' + '─'.repeat(50)) + '\n');

      // 添加到历史
      history.push({
        role: "assistant",
        content: aiResp.content
      });

      break;
    }
  }

  if (iteration >= maxIterations) {
    console.log(chalk.yellow('⚠️  达到最大迭代次数，终止循环\n'));
  }
}
```

---

## 🔑 关键要点

### 1. response_format 与 tools 互斥

```typescript
// ❌ 错误：不能同时使用
{
  response_format: { type: "json_object" },
  tools: [...]
}

// ✅ 正确：只选一个
{
  tools: [...]  // Function Calling
}

// 或者

{
  response_format: { type: "json_object" }  // JSON 模式
}
```

---

### 2. JSON Schema 必须完整

```typescript
// ❌ 不完整：AI 不知道需要什么参数
{
  "parameters": {
    "type": "object",
    "properties": {}
  }
}

// ✅ 完整：AI 知道所有可用参数
{
  "parameters": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Directory path to list"
      },
      "showHidden": {
        "type": "boolean",
        "description": "Show hidden files"
      }
    },
    "required": []
  }
}
```

---

### 3. 多轮对话的消息顺序

```typescript
// 正确的顺序
[
  { role: "system", content: "..." },
  { role: "user", content: "用户需求" },
  { role: "assistant", tool_calls: [...] },  // AI 调用工具
  { role: "tool", tool_call_id: "call_1", content: "结果1" },  // 工具1结果
  { role: "tool", tool_call_id: "call_2", content: "结果2" },  // 工具2结果
  { role: "assistant", content: "最终答案" }  // AI 返回答案
]
```

**关键**：
- `assistant` 消息（包含 `tool_calls`）必须在 `tool` 消息之前
- 所有 `tool` 消息必须在下一个 `assistant` 消息之前

---

### 4. 并行工具调用

```typescript
// 如果 AI 返回多个 tool_calls，可以并行执行
const toolCalls = [
  { id: "call_1", function: { name: "list_files", ... } },
  { id: "call_2", function: { name: "read_file", ... } },
  { id: "call_3", function: { name: "search_files", ... } }
];

// ✅ 并行执行（更快）
const results = await Promise.all(
  toolCalls.map(call => executeToolCall(call))
);

// ❌ 串行执行（更慢）
for (const call of toolCalls) {
  const result = await executeToolCall(call);
}
```

**注意**：如果工具调用有依赖关系，AI 会自然地分多轮返回。

---

## 📊 性能对比

| 指标 | 当前实现（JSON） | Function Calling |
|------|----------------|------------------|
| **单轮任务** | ~3-5 秒 | ~3-5 秒（相同） |
| **多轮任务** | ~10-15 秒 | ~8-12 秒（更快） |
| **Token 使用** | 较高（固定格式） | 较低（AI 自主决策） |
| **错误恢复** | 无 | AI 自动重试 |
| **并行执行** | 不支持 | 支持 |
| **实现复杂度** | 简单 | 中等 |

---

## 🚀 使用示例

### 启用 Function Calling

```bash
# 命令行 flag
$ npx newma-cli --function-calling "总结一下项目"

# 交互模式
$ npx newma-cli -i
[newma] ❯ /set functionCalling true
[newma] ❯ 总结一下项目
```

### 对比输出

**当前实现**：
```
📋 TODO List:
1. 扫描文件
2. 读取配置

📝 Action Plan:
1. ✅ [command] ls -la
2. ✅ [command] cat package.json

✅ All actions completed successfully!
```

**Function Calling**：
```
[迭代 1] 调用 AI...
🔧 AI 调用了 2 个工具
  ⚙️  [list_files] {"path": "src"}
  ✅ [list_files] 成功
    📄 file1.ts, file2.ts, file3.ts

[迭代 2] 调用 AI...
🔧 AI 调用了 1 个工具
  ⚙️  [read_file] {"path": "package.json"}
  ✅ [read_file] 成功
    📄 {"name": "kode", "version": "3.1.0"}

[迭代 3] 调用 AI...
────────────────────────────────────────
📝 AI 响应：

项目总结：
- 这是一个 TypeScript CLI 项目
- 名称：kode，版本：3.1.0
- 主要功能：AI 驱动的代码助手
- 包含 3 个核心源文件
────────────────────────────────────────
```

**优势**：
- 🎯 AI 自主决策每一步
- 🔧 自动选择最合适的工具
- 📊 可以看到执行过程
- 🔄 根据结果动态调整

---

## ⚠️ 风险与缓解

### 风险 1：OpenAI API 变更

**缓解**：
- 保持旧实现作为 fallback
- 添加 API 版本检查
- 充分的错误处理

---

### 风险 2：无限循环

**缓解**：
- 最大迭代次数限制（默认 10）
- 超时保护（默认 60 秒）
- 检测重复工具调用

---

### 风险 3：成本增加

**缓解**：
- Token 使用更高效（总体可能降低）
- 添加预算控制
- 提供 `--no-function-calling` 选项

---

### 风险 4：兼容性问题

**缓解**：
- 渐进式推出（opt-in）
- 收集用户反馈
- 保留旧实现

---

## 📚 参考资料

- [OpenAI Function Calling Documentation](https://platform.openai.com/docs/guides/function-calling)
- [Function Calling with Chat Completions API](https://platform.openai.com/docs/api-reference/chat/create)
- [JSON Schema Specification](https://json-schema.org/)

---

**版本**: v3.2.0（设计阶段）
**日期**: 2025-01-17
**状态**: 📋 设计完成，待实现

**下一步**: 开始 Phase 1 实现
