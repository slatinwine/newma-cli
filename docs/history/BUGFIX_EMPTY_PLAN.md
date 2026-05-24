# Bug Fix Summary: Empty Plan Issue

## Problem Description

When executing `/do 总结一下当前项目`, the system:

1. ✅ Correctly detected that AI returned non-JSON response
2. ❌ Showed empty TODO and Action Plan
3. ❌ Displayed "All actions completed successfully!"
4. ❌ Auto-switched to VERIFY mode incorrectly
5. ❌ VERIFY mode received wrong input ("y" confirmation)

## Root Causes

### Cause 1: AI Not Returning JSON

**Why**: AI models (especially GLM-4.7) sometimes return plain text instead of JSON, even when instructed to do so.

**Evidence**:
```
AI返回了中文文本：
"根据文件 test-ultrathink/integration.test.ts 中的测试用例，我需要：
1. 读取文件的完整路径
2. 验证 getDefaultPrompt 函数的实现逻辑
..."
```

**Solution**:
- Added `response_format: { type: "json_object" }` to force JSON output
- Added fallback: if API doesn't support this parameter, retry without it
- System prompt already contains "JSON" keyword (required for `response_format`)

### Cause 2: Empty Plan Treated as Success

**Why**: When AI returned non-JSON, the code returned empty arrays for `todo` and `actions`, which the REPL interpreted as "successful execution of zero actions".

**Evidence** (`src/ai.ts:588-610` before fix):
```typescript
const fallbackResponse: ExtendedAIResponse = {
  todo: [],      // ❌ Empty arrays
  actions: [],   // ❌ cause "success" message
  done: false,
  ...
};
```

**Solution**:
- Return `type: 'error'` and `message` field instead
- Add validation in `src/repl.ts` to check for empty plans
- Stop execution before showing "success" message

### Cause 3: No Validation in REPL

**Why**: `src/repl.ts` didn't validate that `todo` and `actions` are non-empty arrays before proceeding.

**Evidence** (`src/repl.ts:616-636` before fix):
```typescript
const todo = (aiResp as any).todo || aiResp.todo;
const actions = (aiResp as any).actions || aiResp.actions;

// ❌ No validation - directly displayed empty arrays
todo.forEach(...)  // Loop doesn't execute if empty
actions.forEach(...) // Loop doesn't execute if empty

// ❌ Empty loop = "success"
console.log('✅ All actions completed successfully!');
```

**Solution**:
- Added array type validation
- Added empty plan check with helpful error message
- Early return before execution loop

## Changes Made

### File 1: `src/ai.ts`

**Change 1.1**: Added `response_format` enforcement
```typescript
// Line 507-522
const requestBody: any = {
  model: config.model,
  temperature: 0,
  max_tokens: 4096,
  messages: [...],
};

// Force JSON output for plan/verify modes
if (mode !== 'think') {
  requestBody.response_format = { type: "json_object" };
}
```

**Change 1.2**: Added error handling for unsupported `response_format`
```typescript
// Line 537-653
if (!fetchResponse.ok) {
  const err = await fetchResponse.text();

  // Retry without response_format if not supported
  if (err.includes('response_format') || err.includes('invalid request')) {
    console.log(chalk.yellow('⚠️  API does not support response_format parameter'));
    // ... retry logic
  }
}
```

**Change 1.3**: Return error response instead of empty response
```typescript
// Line 615-627 (was 598-610)
if (!jsonStr) {
  // ... warning messages ...

  // Return error response instead of empty response
  const errorResponse: ExtendedAIResponse = {
    todo: [],
    actions: [],
    done: false,
    duration,
    usage,
    ultrathinkEnabled: false,
    content: rawMessage,
    type: 'error',           // ✅ NEW
    message: 'AI returned non-JSON response. Please try rephrasing your requirement.', // ✅ NEW
  };

  return errorResponse;
}
```

**Change 1.4**: Extended type definition
```typescript
// Line 102-109
export interface ExtendedAIResponse extends AIResponse {
  thoughtTree?: ThoughtTree;
  planAlternatives?: PlanAlternatives;
  ultrathinkEnabled?: boolean;
  content?: string;
  type?: 'task' | 'analysis' | 'error'; // ✅ NEW
  message?: string; // ✅ NEW
}
```

### File 2: `src/repl.ts`

**Change 2.1**: Added error type handling
```typescript
// Line 610-614
if ((aiResp as any).type === 'error') {
  // Error response
  console.log(chalk.yellow('\n⚠️  ' + (aiResp as any).message + '\n'));
  return; // ✅ Stop execution
}
```

**Change 2.2**: Added array validation
```typescript
// Line 620-625
// Validate that todo and actions are arrays
if (!Array.isArray(todo) || !Array.isArray(actions)) {
  console.log(chalk.yellow('\n⚠️  Invalid response format from AI\n'));
  console.log(chalk.gray('todo and actions must be arrays\n'));
  return; // ✅ Stop execution
}
```

**Change 2.3**: Added empty plan check
```typescript
// Line 627-636
// Check for empty plan
if (todo.length === 0 && actions.length === 0) {
  console.log(chalk.yellow('\n⚠️  AI generated an empty plan\n'));
  console.log(chalk.gray('This usually means the AI didn\'t understand the requirement.\n'));
  console.log(chalk.gray('💡 Tips:'));
  console.log(chalk.gray('  • Try rephrasing your requirement'));
  console.log(chalk.gray('  • Be more specific about what you want'));
  console.log(chalk.gray('  • Use /plan <requirement> for programming tasks\n'));
  return; // ✅ Stop execution
}
```

## Expected Behavior After Fix

### Scenario 1: AI returns non-JSON (e.g., "总结一下当前项目")

**Before**:
```
⚠️  AI未返回标准JSON格式
📋 TODO List: (empty)
⚡ Action Plan: (empty)
? Execute this action plan? Y
✅ All actions completed successfully!
Auto-switched to VERIFY mode.
```

**After**:
```
⚠️  AI未返回标准JSON格式
─'.repeat(50)
📝 AI完整响应：
根据文件 test-ultrathink/integration.test.ts 中的测试用例...
─'.repeat(50)

⚠️  AI returned non-JSON response. Please try rephrasing your requirement.

(kode) ❯ (prompt returns, no execution, no VERIFY mode switch)
```

### Scenario 2: API doesn't support response_format

**Behavior**:
```
⚠️  API does not support response_format parameter
Retrying without JSON mode enforcement...

(Falls back to prompt-based JSON enforcement)
```

### Scenario 3: Valid plan (normal operation)

**Behavior**: Works as before - displays TODO, asks for confirmation, executes actions.

## Testing

### Automated Tests
```bash
npx ts-node test-fix.ts
```

All 4 tests passed:
- ✅ Non-JSON response detection
- ✅ Empty plan with error type
- ✅ Valid plan should execute
- ✅ Array validation

### Manual Testing Steps

1. **Test non-JSON response**:
   ```bash
   $ npx newma-cli -i
   [newma] ❯ /do 总结一下当前项目
   ```
   Expected: Error message, no execution

2. **Test valid plan**:
   ```bash
   [newma] ❯ /plan list all typescript files
   ```
   Expected: TODO list, Action Plan, confirmation prompt

3. **Test API compatibility**:
   - With OpenAI API: Should use `response_format` successfully
   - With other APIs: Should fall back gracefully if unsupported

## Impact

### Positive
- ✅ Users no longer see misleading "success" messages
- ✅ Empty plans are detected and stopped early
- ✅ Clear error messages guide users to rephrase requirements
- ✅ Automatic retry if API doesn't support `response_format`

### Risks
- ⚠️ Some AI models may still return non-JSON despite `response_format`
  - Mitigation: Fallback error handling with clear messages
- ⚠️ Additional API call on retry (if `response_format` unsupported)
  - Mitigation: Only happens once per session, then continues without it

## Future Improvements

1. **Retry with different prompts**: If AI returns non-JSON, automatically retry with stronger JSON enforcement
2. **User preference**: Allow users to disable `response_format` via environment variable
3. **Better Chinese support**: Add explicit examples in prompt for Chinese inputs
4. **Metrics**: Track how often non-JSON responses occur per AI model

## Related Files

- `src/ai.ts` - AI integration and response parsing
- `src/repl.ts` - Interactive REPL and execution flow
- `src/prompt.ts` - System prompts with JSON examples
- `src/types.ts` - Type definitions for Action and AIResponse

## Version

- Fixed in: v3.1.0+
- First reported: Issue during "总结一下当前项目" command
- Status: ✅ Resolved
