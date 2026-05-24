# Search + AI Integration Guide

## 概述

Newma (牛码) 现在支持完整的网络搜索和内容获取功能,可以轻松集成到 AI 工作流中。本文档展示如何使用这些功能并将结果发送给 AI 进行分析。

## 可用工具

### 1. `search` - 基础搜索工具

执行 Bing 搜索并返回结果列表。

**参数**:
- `query` (必需): 搜索查询
- `max_results` (可选): 结果数量,默认 10

**返回**:
```typescript
{
  success: boolean;
  metadata: {
    query: string;
    count: number;
    results: Array<{
      title: string;
      url: string;
      snippet: string;
    }>;
  };
}
```

### 2. `web_scrape` - 网页抓取工具

获取单个网页的内容。

**参数**:
- `url` (必需): 网页 URL
- `max_length` (可选): 最大字符数,默认 10000
- `include_html` (可选): 是否包含 HTML,默认 false

**返回**:
```typescript
{
  success: boolean;
  metadata: {
    url: string;
    title: string;
    text: string;
    text_length: number;
  };
}
```

### 3. `search_and_fetch` - 组合工具 ⭐ 推荐

搜索并自动获取前几个结果的完整内容。

**参数**:
- `query` (必需): 搜索查询
- `max_results` (可选): 获取内容的数量,默认 3,最大 5
- `content_length` (可选): 每页最大字符数,默认 5000

**返回**:
```typescript
{
  success: boolean;
  metadata: {
    query: string;
    total_results: number;
    fetched_count: number;
    successful_count: number;
    total_content_length: number;
    results: Array<{
      title: string;
      url: string;
      snippet: string;
      content?: string;
      content_length?: number;
      error?: string;
    }>;
  };
}
```

## 使用场景

### 场景 1: 研究助手

```typescript
import { searchAndFetchTool } from './src/tools/builtin/search-and-fetch';
import { formatSearchMetadataForAI } from './src/tools/builtin/search-and-fetch';

// 1. 搜索并获取内容
const result = await searchAndFetchTool.handler(
  {
    query: 'TypeScript vs JavaScript comparison',
    max_results: 3,
    content_length: 5000,
  },
  context
);

// 2. 格式化为 AI 可读格式
const formattedContent = formatSearchMetadataForAI(result.metadata);

// 3. 发送给 AI
const aiPrompt = `
Based on the following research, provide a comprehensive comparison:

${formattedContent}

Please analyze the differences, advantages, and use cases.
`;

// 4. 调用 AI (在 Newma (牛码) 中自动完成)
const aiResponse = await callAI(config, projectInfo, aiPrompt, 'chat', []);
```

### 场景 2: 技术文档生成

```typescript
// 搜索多个相关主题
const topics = [
  'TypeScript type system',
  'TypeScript generics',
  'TypeScript decorators',
];

const allResearch = [];

for (const topic of topics) {
  const result = await searchAndFetchTool.handler(
    { query: topic, max_results: 2, content_length: 3000 },
    context
  );

  if (result.success) {
    allResearch.push(formatSearchMetadataForAI(result.metadata));
  }
}

// 创建文档提示
const docPrompt = `
# TypeScript Advanced Features Guide

Research Data:
${allResearch.join('\n\n---\n\n')}

Please create a comprehensive guide covering:
1. Type System
2. Generics
3. Decorators

Include code examples and best practices.
`;
```

### 场景 3: 问题诊断

```typescript
// 用户遇到问题
const userProblem = "React useEffect dependency warning";

// 搜索解决方案
const solutions = await searchAndFetchTool.handler(
  {
    query: `${userProblem} stackoverflow`,
    max_results: 5,
    content_length: 8000,
  },
  context
);

// 让 AI 分析并选择最佳解决方案
const diagnosisPrompt = `
# Problem Diagnosis

User Issue: ${userProblem}

Research Data:
${formatSearchMetadataForAI(solutions.metadata)}

Please:
1. Identify the root cause
2. List 3-5 possible solutions
3. Recommend the best approach with explanation
4. Provide code examples
`;
```

## AI 集成模式

### 模式 1: 直接内容注入

```typescript
// 在 Newma (牛码) 的 repl.ts 或 ai.ts 中
async function chatWithSearch(query: string) {
  // 1. 搜索相关信息
  const searchResult = await searchAndFetchTool.handler(
    { query, max_results: 3, content_length: 5000 },
    context
  );

  if (searchResult.success) {
    // 2. 将搜索内容注入到 AI 系统提示
    const systemPrompt = `
You are an AI assistant with access to web search results.

Search Results:
${formatSearchMetadataForAI(searchResult.metadata)}

Use this information to provide accurate, up-to-date answers.
    `;

    // 3. 调用 AI
    const response = await callAI(
      config,
      projectInfo,
      query,
      'chat',
      [],
      systemPrompt
    );

    return response;
  }
}
```

### 模式 2: 多轮对话研究

```typescript
async function deepResearch(topic: string) {
  const iterations = 3;

  for (let i = 0; i < iterations; i++) {
    // 第1轮: 初始搜索
    if (i === 0) {
      const result = await searchAndFetchTool.handler(
        { query: topic, max_results: 3, content_length: 5000 },
        context
      );

      // 发送给 AI 分析
      await callAI(config, projectInfo, `
        Research this topic: ${topic}
        Data: ${formatSearchMetadataForAI(result.metadata)}
        Provide key insights and follow-up questions.
      `, 'chat', []);
    }
    // 第2轮: 深入挖掘
    else if (i === 1) {
      const followUp = await searchAndFetchTool.handler(
        { query: `${topic} best practices examples`, max_results: 3 },
        context
      );

      await callAI(config, projectInfo, `
        Based on additional research:
        ${formatSearchMetadataForAI(followUp.metadata)}
        Synthesize all findings into practical recommendations.
      `, 'chat', []);
    }
    // 第3轮: 总结
    else {
      await callAI(config, projectInfo, `
        Create a comprehensive summary of all research about ${topic}.
        Include actionable insights and recommendations.
      `, 'chat', []);
    }
  }
}
```

## 实际应用示例

### 示例 1: 在 Newma (牛码) REPL 中使用

```bash
$ npx newma-cli -i --use-tools

[newma] ❯ /search search the web for "TypeScript 5.0 new features"
🔍 Searching...
✅ Found 10 results, fetching top 3...
✅ Fetched 3 pages with content
🤖 Analyzing with AI...
[AI provides comprehensive summary of TypeScript 5.0 features]

[newma] ❯ Based on the search, explain how to use the new decorator syntax
[AI uses search context to provide accurate answer]
```

### 示例 2: 在规划模式中使用

```bash
$ npx newma-cli -i --use-tools

[newma] ❯ /plan Research and implement TypeScript decorators in our project
🔍 Step 1: Searching for "TypeScript decorators implementation guide"
✅ Found 8 resources

🔍 Step 2: Searching for "TypeScript decorators best practices"
✅ Found 12 resources

📋 Plan:
1. Review decorator syntax and types
2. Implement class decorators
3. Implement method decorators
4. Add decorator composition
5. Write tests and documentation

✅ Plan ready! Execute? (y/n)
```

## 格式化输出

`formatSearchMetadataForAI()` 函数会创建结构化的 Markdown 输出:

````markdown
# Search and Fetch Results for: "query"

Total results: 10
Successfully fetched: 3/3

---

## Result 1
**Title**: Page Title
**URL**: https://example.com/page
**Snippet**: Brief description...

**Content**:
Full page content here...
Up to content_length characters...

---

## Result 2
**Title**: Another Page
...

````

这种格式非常适合:
- AI 理解和分析
- 生成报告
- 创建文档
- 研究总结

## 性能考虑

1. **网络请求**: 每次搜索约 1-2 秒,每次抓取约 2-5 秒
2. **并行处理**: `search_and_fetch` 工具自动并行抓取多个页面
3. **内容限制**: 建议每页 3000-8000 字符,避免 token 溢出
4. **结果数量**: 建议 2-5 个结果,平衡质量和速度

## 错误处理

```typescript
const result = await searchAndFetchTool.handler(params, context);

if (!result.success) {
  if (result.error?.includes('timeout')) {
    console.log('⏰ Request timeout, try again');
  } else if (result.error?.includes('404')) {
    console.log('❌ Page not found');
  } else {
    console.log(`❌ Error: ${result.error}`);
  }
} else {
  // 处理部分失败的情况
  const { successful_count, fetched_count } = result.metadata;
  if (successful_count < fetched_count) {
    console.log(`⚠️  Some pages failed to load`);
  }
}
```

## 测试

运行完整示例:

```bash
# 测试搜索功能
npx ts-node test-search.ts

# 测试搜索+抓取
npx ts-node test-search-and-fetch.ts

# 测试 AI 集成示例
npx ts-node test-search-with-ai.ts
```

## 总结

通过这些工具,你可以:

✅ 自动搜索网络获取最新信息
✅ 抓取完整网页内容进行分析
✅ 将研究结果格式化发送给 AI
✅ 创建智能的研究助手
✅ 增强决策能力
✅ 保持技术知识更新

这些功能完全集成到 Newma (牛码) 的工具系统中,可以在任何模式下使用!
