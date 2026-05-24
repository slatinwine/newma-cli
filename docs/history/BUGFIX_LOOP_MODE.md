# Bug Fix: /loop Command Not Generating Actions

**Date**: 2026-01-18
**Issue**: `/loop` command returns garbled AI responses instead of generating actionable commands

## Root Cause Analysis

### Issue 1: Weak System Prompt in Reasoner

The Reasoner class (`src/loop/reasoner.ts`) had a vague system prompt that didn't clearly instruct the AI to generate executable commands. The prompt emphasized "analysis" and "reasoning" but didn't sufficiently emphasize that the AI must return JSON with actionable commands.

**Symptoms**:
- AI returned thoughts and analysis instead of commands
- Actions array was empty or missing
- User feedback: "是没生成命令，你要设计 agent 的系统提示词，让他命令啊"

**Example of Bad Response**:
```json
{
  "actions": [],  // Empty - no commands generated
  "reasoning": ["分析项目结构", "总结功能"]
}
```

### Issue 2: API Compatibility with 智谱AI (Zhipu AI)

The user is using 智谱AI's GLM-4.7 model via OpenAI-compatible API (`https://open.bigmodel.cn/api/paas/v4`). This API doesn't fully support the `response_format: { type: "json_object" }` parameter that OpenAI uses for JSON mode, causing garbled responses.

**Symptoms**:
- AI returns garbled text with lots of `' + ' +`, `* * *`, escape sequences
- `response_format` parameter doesn't enforce JSON output
- AI hallucinates with random characters and incomplete code fragments

## Solutions Implemented

### Fix 1: Improved Reasoner System Prompt

**File**: `src/loop/reasoner.ts` (lines 70-152)

**Changes**:
1. **Emphasized command generation** - Changed prompt from "analyze and plan" to "generate executable commands"
2. **Added clear command type documentation**:
   - `run` - Execute shell commands (cat, ls, grep, npm test)
   - `create` - Create new files
   - `modify` - Modify existing files
3. **Provided concrete examples** for common tasks:
   - "总结项目" → Generate `cat`, `ls`, `find` commands
   - "添加用户认证" → Generate `ls`, `create`, `modify` commands
4. **Added reminders** that commands will be auto-executed

**Before**:
```
你的任务是分析需求，生成推理过程和行动计划
...
**你的任务**：
1. 分析需求，理解用户真正想要什么
2. 逐步推理，展示你的思考过程
3. 生成详细的行动计划
```

**After**:
```
你的任务是分析需求并生成**可执行的命令**
...
**🚨 最重要：你必须返回 JSON 格式的 actions，系统会自动执行这些命令**

**命令类型**：
1. **run** - 执行 shell 命令
   - 查看文件：{"type": "run", "command": "cat README.md"}
   - 列出文件：{"type": "run", "command": "ls -la src/"}
   ...

**重要提醒**：
- 不要只分析，要生成具体的命令
- 命令必须是可以直接执行的
- 所有命令会被系统自动执行，你只需要生成 JSON
```

### Fix 2: Auto-Retry for Non-JSON Responses

**File**: `src/ai.ts` (lines 940-1026)

**Changes**:
1. **Detect invalid JSON** in plan/verify modes
2. **Automatically retry** without `response_format` parameter
3. **Strengthen prompt** with explicit JSON instructions:
   ```
   🚨 CRITICAL: You MUST respond with valid JSON only.
   No markdown, no code blocks, no explanations.
   Response must start with { and end with }.
   ```
4. **Provide clear feedback** about retry status

**Retry Logic**:
```typescript
if (!jsonStr) {
  // Auto-retry for plan/verify modes without response_format
  if ((mode === 'plan' || mode === 'verify') && requestBody.response_format) {
    console.log(chalk.yellow('🔄 检测到JSON格式失败，尝试简化请求重试...\n'));

    // Remove response_format and retry
    const { response_format, ...retryBody } = requestBody;

    // Strengthen the prompt to force JSON
    const strengthenedMessages = [
      ...retryBody.messages.slice(0, -1),
      {
        ...retryBody.messages[retryBody.messages.length - 1],
        content: retryBody.messages[retryBody.messages.length - 1].content +
          '\n\n🚨 CRITICAL: You MUST respond with valid JSON only. ' +
          'No markdown, no code blocks, no explanations.\n' +
          'Response must start with { and end with }.'
      }
    ];

    // Retry request...
  }
}
```

**Benefits**:
- Works with OpenAI and non-OpenAI APIs (智谱AI, DeepSeek, etc.)
- Falls back gracefully if `response_format` isn't supported
- Stronger prompt instructions compensate for missing JSON mode
- Automatic - no user intervention needed

## Testing

### Manual Testing Steps

1. **Start the CLI**:
   ```bash
   npx newma-cli -i
   ```

2. **Test with a simple task**:
   ```
   /loop 总结项目
   ```

3. **Expected behavior**:
   - ✅ AI generates actionable commands (e.g., `cat README.md`, `ls -la src/`)
   - ✅ Commands are shown before execution
   - ✅ User can approve/reject the plan
   - ✅ If JSON parsing fails, auto-retry triggers
   - ✅ Clear status messages throughout

### Example of Good Response

```json
{
  "type": "task",
  "todo": [
    "读取项目文档",
    "查看项目结构",
    "列出源文件"
  ],
  "actions": [
    {"type": "run", "command": "cat README.md"},
    {"type": "run", "command": "cat CLAUDE.md"},
    {"type": "run", "command": "ls -la src/"},
    {"type": "run", "command": "find src -name '*.ts' | head -20"}
  ],
  "reasoning": [
    "需要先了解项目概览",
    "查看核心文档了解架构",
    "列出源文件了解实现"
  ],
  "confidence": 0.9,
  "expectedOutcome": "获得项目的完整概览，包括架构、功能和实现细节",
  "risks": ["文档可能不完整", "项目结构可能复杂"]
}
```

## Related Documentation

- `CLAUDE.md` - Architecture overview and four-step loop system
- `FOUR_STEP_LOOP.md` - Four-step loop implementation details
- `BUGFIX_PLAN_MODE.md` - Similar fix for `/plan` command (API compatibility)
- `src/loop/reasoner.ts` - Reasoner implementation
- `src/loop/coordinator.ts` - Loop coordinator implementation

## Lessons Learned

1. **Prompt Engineering Matters**
   - Vague prompts → Vague responses
   - Emphasize WHAT you want (commands) not just WHY (reasoning)
   - Provide concrete examples

2. **API Compatibility Varies**
   - Not all "OpenAI-compatible" APIs support all features
   - `response_format` for JSON mode is OpenAI-specific
   - Always test with actual API provider

3. **Graceful Degradation**
   - Auto-retry is better than failing outright
   - Strengthen prompts when API features aren't available
   - Clear user feedback builds trust

4. **User Feedback is Critical**
   - User identified the real issue: "没生成命令"
   - Initial diagnosis (API compatibility) was secondary
   - Main issue was weak prompt design

## Future Improvements

1. **Multi-API Support**
   - Detect API provider from base URL
   - Adjust prompts/features per provider
   - Provider-specific best practices

2. **Prompt Templates**
   - Separate templates for different modes
   - A/B testing for prompt effectiveness
   - User-customizable prompts

3. **Better Error Messages**
   - Explain WHY the AI didn't generate commands
   - Show examples of good vs. bad responses
   - Suggest how to rephrase requirements

4. **Validation Layer**
   - Validate AI responses before execution
   - Check for required fields (type, actions, todo)
   - Reject malformed responses with clear errors
