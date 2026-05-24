# Bug Fix: Skills Creator JSON Code Field Implementation

**Date**: 2025-01-24
**Issue**: Plugin creation generated files containing AI thinking process instead of pure TypeScript code
**Status**: ✅ **RESOLVED**

## Problem Description

When using the `/create-plugin` command in Newma (牛码) REPL, the generated plugin files contained:
- AI thinking process (numbered lists)
- JSON metadata fields (`"todo"`, `"actions"`)
- Mixed content instead of clean TypeScript code

Example of problematic output:
```typescript
The user wants me to generate a complete TypeScript plugin file for Newma (牛码). Let me analyze the requirements:

1. Plugin Name: my-plugin
2. Description: ...
```json
{
  "code": "...",
  "todo": [...]
}
```
```

## Root Cause

The issue stemmed from conflicting requirements:
1. **System prompt** required JSON format with `todo` and `actions` fields
2. **User prompt** requested only TypeScript code
3. AI model was confused and output both thinking process AND JSON

## Solution

User's brilliant idea: **Have AI return JSON with a `code` field containing the generated code**

### Implementation

#### 1. Modified `buildCodeGenerationPrompt()` (src/skills-creator/generator.ts:145-188)

Changed the prompt to explicitly request JSON format with `code` field:

```typescript
CRITICAL - Return format:
You MUST respond with valid JSON in this exact format:
{
  "code": "完整的 TypeScript 代码放在这里，使用 \\n 转义换行符",
  "todo": ["生成插件代码"],
  "actions": []
}

IMPORTANT:
- The "code" field must contain the COMPLETE plugin.ts file content
- Use \\n for newlines in the code string
- Do NOT include any markdown formatting (no \`\`\` outside the JSON)
- The code should be ready to write directly to a file
```

#### 2. Modified `extractCodeFromResponse()` (src/skills-creator/generator.ts:193-267)

Implemented smart extraction logic to handle JSON with thinking process:

```typescript
private extractCodeFromResponse(response: string, filename: string): string {
  // 1. Try to extract JSON code block with 'code' field (优先)
  try {
    // 首先尝试找到 ```json ... ``` 代码块
    const jsonCodeBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    let jsonStr = '';

    if (jsonCodeBlockMatch) {
      // 从代码块中提取 JSON
      jsonStr = jsonCodeBlockMatch[1].trim();
      console.log('[Skills Creator] Found JSON code block');
    } else {
      // 如果没有代码块，尝试解析整个响应为 JSON
      jsonStr = response.trim();
    }

    // 尝试解析 JSON
    const jsonResponse = JSON.parse(jsonStr);

    if (jsonResponse.code && typeof jsonResponse.code === 'string') {
      console.log('[Skills Creator] ✓ Extracted code from JSON field');
      // 将 \n 转义换回实际换行符
      return jsonResponse.code.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
  } catch (e) {
    // JSON 解析失败，使用原有的代码块提取逻辑
    console.log('[Skills Creator] JSON parse failed, trying code block extraction...');
  }

  // 2-5. Fallback to original extraction methods...
}
```

#### 3. Fixed `config.baseUrl` undefined issue (src/ai.ts:255, 721, 1200)

Added fallback for undefined `config.baseUrl`:

```typescript
const endpoint = config.endpoint ||
  `${(config.baseUrl || 'https://api.openai.com').replace(/\/+$/, '')}/v1/chat/completions`;
```

## Testing

### Test Script: test-final-plugin-creation.mjs

Created comprehensive test to verify:
1. Plugin creation with real AI
2. Clean TypeScript code generation
3. No AI thinking process in output
4. Valid import statements

### Test Results: ✅ PASSED

```
📄 Generated plugin.ts preview:
════════════════════════════════════════════════════════════
import { Plugin } from '../../src/plugins/types';

/**
 * Empty Plugin - A basic example plugin for Newma (牛码)
 * @version 1.0.0
 * @description No requirements provided
 */
export default class EmptyPlugin implements Plugin {
  readonly name: string = 'empty-plugin';
  readonly version: string = '1.0.0';
  readonly description: string = 'No requirements provided';
  ...
}
════════════════════════════════════════════════════════════

✅ PASS: Generated file is clean TypeScript code!
   - No JSON thinking process
   - No numbered lists
   - Starts with valid import statement

🎉 Test PASSED!
```

## Key Improvements

### Before ❌
- Mixed content (thinking + code)
- JSON metadata in generated files
- Manual cleanup required
- Unusable plugin files

### After ✅
- Clean TypeScript code only
- Properly formatted with JSDoc comments
- Ready to use without modifications
- Smart extraction handles AI thinking

## Extraction Logic Flow

```
AI Response
  │
  ├─> 1. Find ```json ... ``` code block
  │     ├─> Yes: Extract JSON content
  │     │   ├─> Parse JSON
  │     │   ├─> Extract "code" field
  │     │   └─> Unescape \n and \"
  │     │      ✅ Return clean code
  │     │
  │     └─> No: Try parsing entire response as JSON
  │
  ├─> 2. Fallback: TypeScript code block
  │
  ├─> 3. Fallback: Any code block
  │
  ├─> 4. Fallback: Find import statement
  │
  └─> 5. Last resort: Return as-is with warning
```

## Files Modified

1. **src/skills-creator/generator.ts**
   - `buildCodeGenerationPrompt()`: Added JSON format requirement
   - `extractCodeFromResponse()`: Implemented smart JSON code block extraction

2. **src/ai.ts**
   - Fixed `config.baseUrl` undefined issue (3 locations)
   - Added fallback to `https://api.openai.com`

## Backward Compatibility

✅ **Fully backward compatible**
- Original extraction methods preserved as fallbacks
- Works with existing AI responses
- No breaking changes to API

## Lessons Learned

1. **User Innovation**: User's suggestion to use JSON `code` field was the key to solving this problem elegantly
2. **Smart Extraction**: Need to handle both pure JSON and mixed content (thinking + JSON)
3. **Robust Fallbacks**: Multiple extraction strategies ensure compatibility
4. **Config Safety**: Always provide fallbacks for potentially undefined config values

## Next Steps

- Monitor real-world usage
- Consider adding profile-based prompts for better code generation
- Add more test cases for edge cases

## Related Issues

- Initial issue: AI generating thinking process in plugin files
- Secondary issue: `config.baseUrl` undefined causing crashes
- Both issues resolved in this fix

---

**Resolution**: Plugin creation now generates clean, production-ready TypeScript code without AI thinking process. ✅
