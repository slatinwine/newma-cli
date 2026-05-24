# Prompt修改验证报告

## ✅ 所有修改已成功编译并部署

### 1. System Prompt (dist/prompt.js)

**新增核心规则**：
```
🚨 CRITICAL RULE - ALWAYS GENERATE ACTIONS:
- **NEVER** directly answer the user's question or provide explanations
- **ALWAYS** generate executable actions that the system will run
- ALL tasks (including "summarize", "explain", "analyze") must be completed through actions
- Your response must ALWAYS be JSON with "todo" and "actions" fields
```

**删除的响应类型**：
- ❌ `type: "analysis"` - AI不允许直接回答问题
- ❌ `type: "error"` - 移除了错误类型

**新增示例**：
```json
Example 1 - "Summarize the project":
{
  "type": "task",
  "todo": ["Read project documentation", "Analyze code structure"],
  "actions": [
    {"type": "run", "command": "cat README.md"},
    {"type": "run", "command": "cat CLAUDE.md"},
    {"type": "run", "command": "ls -la src/"}
  ]
}
```

### 2. Mode Prompt (dist/ai.js)

**Plan模式增强**：
```
🚨 CRITICAL: ALWAYS GENERATE EXECUTABLE ACTIONS
- NEVER directly answer questions or provide explanations
- ALWAYS generate actions that the system will execute
- Even for "summarize" or "explain" tasks, generate actions to gather information
```

### 3. Few-shot Examples (dist/ai.js)

**新增示例**：
```
Example 1 - User: "Summarize this project"
AI Response:
{
  "type": "task",
  "todo": ["Read README", "Read CLAUDE.md", "List source files"],
  "actions": [
    {"type": "run", "command": "cat README.md"},
    {"type": "run", "command": "cat CLAUDE.md"},
    {"type": "run", "command": "ls -la src/"}
  ]
}

Example 2 - User: "Explain how authentication works"
AI Response:
{
  "type": "task",
  "todo": ["Find auth files", "Read auth implementation"],
  "actions": [
    {"type": "run", "command": "find . -name '*auth*' -type f"},
    {"type": "run", "command": "cat src/auth/login.ts"}
  ]
}
```

### 4. JSON降级处理 (dist/ai.js)

**新增安全网**：
```javascript
if (!jsonStr) {
  console.log('⚠️  AI未返回标准JSON格式\n');
  console.log('─'.repeat(50));
  console.log('📝 AI完整响应：\n');
  console.log(rawMessage);
  console.log('─'.repeat(50) + '\n');
  console.log('💡 提示：AI应该返回JSON格式的actions，而不是直接回答问题\n');

  // 返回降级响应，避免系统崩溃
  return {
    todo: [],
    actions: [],
    done: false,
    duration,
    usage,
    content: rawMessage,
  };
}
```

## 预期效果对比

### ❌ 修改前的问题

**用户输入**：`/plan 总结一下当前项目`

**AI错误响应**：
```
好的，我来帮你实现一个基于Ultrathink/ReAct...
（AI直接回答问题，没有生成JSON actions）
```

**系统行为**：
- ❌ JSON解析失败
- ❌ 抛出错误："AI response does not contain valid JSON"
- ❌ 系统崩溃，无法继续

---

### ✅ 修改后的预期行为

**用户输入**：`/plan 总结一下当前项目`

**AI正确响应**：
```json
{
  "type": "task",
  "todo": [
    "Read project documentation",
    "Analyze code structure",
    "List source files"
  ],
  "actions": [
    {"type": "run", "command": "cat README.md"},
    {"type": "run", "command": "cat CLAUDE.md"},
    {"type": "run", "command": "ls -la src/"}
  ]
}
```

**系统行为**：
1. ✅ 解析JSON成功
2. ✅ 显示TODO列表和Action Plan
3. ✅ 用户确认后执行：
   - 执行 `cat README.md` → 显示README内容
   - 执行 `cat CLAUDE.md` → 显示CLAUDE.md内容
   - 执行 `ls -la src/` → 显示源代码目录
4. ✅ 显示所有执行结果
5. ✅ 用户可以看到完整的项目信息

## 测试建议

### 方式1：使用REPL模式（推荐）

```bash
npx newma-cli -i

# 在REPL中输入：
> /plan 总结一下当前项目

# 预期：AI生成读取文件的命令
```

### 方式2：直接命令行

```bash
npx newma-cli "总结一下当前项目"

# 预期：AI生成读取文件的命令
```

### 方式3：查看编译后的代码

```bash
# 查看prompt
grep -A 5 "CRITICAL RULE" dist/prompt.js

# 查看mode prompt
grep -A 10 "ALWAYS GENERATE EXECUTABLE ACTIONS" dist/ai.js

# 查看examples
grep -A 15 "EXAMPLES OF CORRECT RESPONSES" dist/ai.js

# 查看降级处理
grep -A 10 "AI未返回标准JSON格式" dist/ai.js
```

## 关键改进点

1. **强制生成Actions**：AI现在必须生成可执行的命令，不能直接回答
2. **统一处理流程**：所有任务（包括分析类）都通过执行命令完成
3. **可追溯性**：用户能看到具体执行了什么命令
4. **可调试性**：所有命令的输出都会显示
5. **容错性**：即使AI没返回JSON，系统也不会崩溃

## 下一步

如果AI仍然返回非JSON格式，系统会：
1. 显示警告信息
2. 打印AI的完整响应
3. 返回空actions列表
4. 不会崩溃，可以继续使用

这提供了更好的用户体验和调试信息！
