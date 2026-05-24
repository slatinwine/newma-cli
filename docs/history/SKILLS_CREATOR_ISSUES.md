# Skills Creator 问题分析

## 问题描述

通过 `/create-plugin` 创建插件时，生成的文件包含 AI 的思考过程（JSON格式），而不是纯 TypeScript 代码。

## 根本原因

### 1. **使用了错误的 AI 模式**
```typescript
// src/skills-creator/generator.ts:129
const response = await callAI(
  this.config,
  {},
  prompt,
  'think',  // ❌ 'think' 模式会让 AI 输出思考过程
  [],
  ...
);
```

### 2. **代码提取逻辑不够健壮**
```typescript
// src/skills-creator/generator.ts:178-187
private extractCodeFromResponse(response: string, filename: string): string {
  // 只能处理标准代码块
  const codeBlockMatch = response.match(/```(?:typescript|ts)?\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // ❌ 如果没有代码块，直接返回整个响应（包括思考过程）
  return response.trim();
}
```

### 3. **AI 响应格式混乱**
在 'think' 模式下，AI 可能输出：
```
1 The user wants me to generate...
  ~~~
{
  "todo": [...],
  "actions": [...]
}

import { Plugin } from ...  // 代码被混在思考过程中
```

## 解决方案

### 方案 1：改用不输出思考过程的模式（推荐）

```typescript
// 修改 generator.ts:129
const response = await callAI(
  this.config,
  {},
  prompt,
  'plan',  // ✅ 使用 'plan' 模式，或直接不指定模式
  [],
  ...
);
```

### 方案 2：改进代码提取逻辑

```typescript
private extractCodeFromResponse(response: string, filename: string): string {
  // 1. 先尝试提取代码块
  const codeBlockMatch = response.match(/```(?:typescript|ts)?\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // 2. 尝试找到 import 语句作为代码开始
  const importMatch = response.match(/(?:^|\n)(import\s+.*$)/m);
  if (importMatch) {
    const startIndex = response.indexOf(importMatch[1]);
    const lines = response.substring(startIndex).split('\n');
    const codeLines: string[] = [];

    for (const line of lines) {
      // 停止条件：遇到 JSON 或非代码行
      if (line.trim().startsWith('```')) break;
      if (line.trim().startsWith('{') && line.includes(':')) break;
      if (line.trim().match(/^\d+\s+/)) break; // "1 The user wants..."

      codeLines.push(line);
    }

    return codeLines.join('\n').trim();
  }

  // 3. 如果都失败了，返回原响应
  console.warn('[Skills Creator] Could not extract code from AI response');
  return response.trim();
}
```

### 方案 3：使用 Function Calling API（最佳方案）

```typescript
private async generatePluginCode(
  requirement: PluginRequirement,
  context: TemplateContext,
  template: string
): Promise<string> {
  const prompt = this.buildCodeGenerationPrompt(requirement, context, template);

  // ✅ 使用 Function Calling API 获取结构化响应
  const response = await callAIWithFunctionCalling(
    this.config,
    prompt,
    [
      {
        name: 'generate_plugin',
        description: 'Generate plugin code',
        parameters: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'Complete TypeScript plugin code'
            }
          },
          required: ['code']
        }
      }
    ]
  );

  // 从 Function Calling 结果中提取代码
  if (response.functionCalls?.[0]?.arguments?.code) {
    return response.functionCalls[0].arguments.code;
  }

  // Fallback to regular extraction
  return this.extractCodeFromResponse(response.content || '', 'plugin.ts');
}
```

## 建议实施顺序

1. **立即修复**：方案 1 - 改用 'plan' 模式（最简单）
2. **短期改进**：方案 2 - 改进代码提取逻辑（防止类似问题）
3. **长期优化**：方案 3 - 使用 Function Calling API（最可靠）

## 测试用例

```typescript
// 测试代码提取
const testCases = [
  {
    name: '标准代码块',
    input: '```typescript\nimport { Plugin } from ...\n```',
    expected: 'import { Plugin } from ...'
  },
  {
    name: '包含思考过程',
    input: '1 The user wants...\n```json\n{...}\n```\n\nimport { Plugin } from ...',
    expected: 'import { Plugin } from ...'
  },
  {
    name: '无代码块',
    input: 'import { Plugin } from ...\n\nexport const plugin: Plugin = {...}',
    expected: 'import { Plugin } from ...'
  }
];
```

## 相关文件

- `src/skills-creator/generator.ts:118-187` - 代码生成和提取逻辑
- `src/skills-creator/analyzer.ts` - 需求分析逻辑
- `src/ai.ts` - AI 调用接口
