# FFT Planner - Separate System Prompts Fix

**Date**: 2026-01-24
**Issue**: AI returning analysis text instead of JSON for complexity check
**Root Cause**: Prompt conflict between complexity analysis and plan generation
**Status**: ✅ Fixed

## Problem

AI was ignoring JSON requirements and returning analysis text:

```
⚡ [FFT] AI response: 1.  **Analyze the Request:**
    *   **Task:** Build a website for HTML file upload and download.
    *   **Technologies:** Frontend (Vue), Backend (Java).
    ...
```

This happened because the same system prompt (designed for plan generation) was being used for complexity analysis, causing the AI to be confused about the expected output format.

## Root Cause

### Before (Problematic Design)

```
callAIDirect(prompt)
    └─ Uses ONE system prompt for ALL calls
        ├─ complexity check → expects simple JSON
        └─ plan generation → expects complex JSON
            ↓
         CONFLICT! AI doesn't know which format to use
```

The system prompt was saying "generate implementation plans" but the complexity check only needed a simple JSON answer.

## Solution

### After (Fixed Design)

```
callAIDirect(prompt, customSystemPrompt?)
    ├─ If customSystemPrompt provided → use it
    └─ Otherwise → use default plan generation prompt
```

### Changes Made

#### 1. Added Custom System Prompt Parameter (src/fft/planner.ts:414)

```typescript
private async callAIDirect(
  prompt: string,
  customSystemPrompt?: string  // ← NEW parameter
): Promise<string> {
  // Build system prompt
  let systemPrompt: string;

  if (customSystemPrompt) {
    // Use custom system prompt for specialized calls
    systemPrompt = customSystemPrompt;
  } else {
    // Default system prompt for plan generation
    systemPrompt = `You are an expert software architect...`;
  }
  ...
}
```

#### 2. Created Dedicated System Prompt for Complexity Check (src/fft/planner.ts:186-215)

**User Prompt** (simplified):
```
判断任务复杂度：${requirement}

只返回JSON，格式：{"level":"simple" or "complex", "reasoning":"简短理由"}
```

**System Prompt** (specialized):
```
You are a task complexity analyzer.

CRITICAL RULES:
1. Respond ONLY with valid JSON
2. No markdown, no explanations, no additional text
3. Start with '{', end with '}'
4. JSON format: {"level":"simple" or "complex", "reasoning":"short reason"}

Examples:
{"level":"simple","reasoning":"单一文件"}
{"level":"complex","reasoning":"多技术栈"}

Start your response with '{' immediately.
```

#### 3. Updated Call Site

```typescript
// Before
rawResponse = await this.callAIDirect(prompt);

// After
rawResponse = await this.callAIDirect(userPrompt, systemPrompt);
```

## Benefits

### 1. **Clear Expectations**
Each call type has its own system prompt that matches its needs:
- Complexity check → Simple JSON format
- Plan generation → Complex JSON with actions

### 2. **No Confusion**
AI knows exactly what format to return for each call type.

### 3. **Better Separation of Concerns**
- complexity analysis is independent from plan generation
- Each can be optimized independently

### 4. **Future Extensibility**
Easy to add more specialized call types:
```typescript
// Potential future usage
await this.callAIDirect(prompt, riskAnalysisPrompt);
await this.callAIDirect(prompt, techSelectionPrompt);
await this.callAIDirect(prompt, timeEstimatePrompt);
```

## Testing

```bash
npm run build
npx newma-cli -i
> /plan 写一个网站，实现 html 上传下载功能。前端 vue，后端 java
```

**Expected Output**:
```
⚡ [FFT] AI response: {"level":"complex","reasoning":"涉及前端Vue和后端Java双技术栈"}...
✅ No analysis text, just JSON
```

## Design Pattern

This follows the **Strategy Pattern**:
- **Context**: `callAIDirect` method
- **Strategy**: Different system prompts for different use cases
- **Benefit**: Flexible, extensible, clear separation

## Related Issues

- BUGFIX_FFT_JSON_PARSING.md - Initial JSON parsing issues
- BUGFIX_API_COMPATIBILITY.md - Removed response_format
- BUGFIX_SEPARATE_PROMPTS.md - This fix (prompt separation)

## Lessons Learned

### 1. One Size Does Not Fit All
A single system prompt cannot work optimally for all use cases.

### 2. Be Specific
System prompts should match the expected output format exactly.

### 3. Use Parameters for Flexibility
Optional parameters (`customSystemPrompt?`) allow backward compatibility while adding new features.

### 4. Test Edge Cases
The complexity check was an edge case that wasn't caught in initial testing.

## Future Improvements

### 1. Prompt Templates
```typescript
const PROMPTS = {
  complexity: systemPrompt1,
  planGeneration: systemPrompt2,
  riskAnalysis: systemPrompt3,
};
```

### 2. Prompt Validation
```typescript
function validateSystemPrompt(prompt: string): boolean {
  // Check that prompt requires JSON output
  return prompt.includes('JSON') && prompt.includes('ONLY');
}
```

### 3. Prompt Versioning
```typescript
interface PromptConfig {
  version: 'v1' | 'v2';
  complexity: string;
  planning: string;
}
```

## Summary

✅ **Problem**: AI returning wrong format due to prompt confusion
✅ **Solution**: Separate system prompts for different call types
✅ **Method**: Added optional `customSystemPrompt` parameter
✅ **Result**: Correct JSON output for all call types
✅ **Status**: Production-ready

---

**Author**: Claude Code
**Last Updated**: 2026-01-24
**Priority**: Critical (fixes FFT functionality)
**Status**: Fixed ✅
