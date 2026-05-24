# Search Feature

## 概述

为 Newma (牛码) CLI 添加了完整的网络搜索和内容获取功能,包括:
1. **搜索**: 使用 Bing 搜索引擎进行网络搜索
2. **抓取**: 获取单个网页的完整内容
3. **组合**: 搜索并自动获取多个结果的内容
4. **AI 集成**: 格式化搜索结果发送给 AI 分析

## 功能特性

- 🔍 **Web 搜索**: 使用 Bing 搜索引擎进行网络搜索
- 📄 **网页抓取**: 获取网页完整内容,智能提取主要文本
- 🤖 **AI 集成**: 自动格式化为 AI 可读的 Markdown 格式
- 📊 **批量获取**: 搜索并并行获取多个页面内容
- 🛡️ **权限控制**: 基于 NETWORK_ACCESS 权限的安全控制
- 📝 **历史记录**: 自动记录操作到执行历史
- ⚙️ **可配置**: 支持自定义返回结果数量和内容长度

## 安装依赖

搜索功能需要以下依赖包:

```bash
npm install axios cheerio @types/cheerio
```

## 可用工具

### 1. `search` - 基础搜索工具

- **描述**: 使用 Bing 搜索引擎进行网络搜索
- **类别**: `ANALYSIS`
- **权限**: `NETWORK_ACCESS`
- **参数**:
  - `query` (必需): 搜索查询字符串
  - `max_results` (可选): 最大返回结果数,默认 10,范围 1-50

### 2. `web_scrape` - 网页抓取工具 ⭐ 新增

- **描述**: 获取单个网页的完整内容
- **类别**: `ANALYSIS`
- **权限**: `NETWORK_ACCESS`
- **参数**:
  - `url` (必需): 网页 URL
  - `max_length` (可选): 最大字符数,默认 10000,范围 100-100000
  - `include_html` (可选): 是否包含 HTML 结构,默认 false

### 3. `search_and_fetch` - 组合工具 ⭐ 推荐

- **描述**: 搜索并自动获取多个结果的完整内容
- **类别**: `ANALYSIS`
- **权限**: `NETWORK_ACCESS`
- **参数**:
  - `query` (必需): 搜索查询字符串
  - `max_results` (可选): 获取内容的数量,默认 3,最大 5
  - `content_length` (可选): 每页最大字符数,默认 5000,范围 500-50000

## 使用方法

### 方式 1: 基础搜索

```typescript
import { searchTool } from './src/tools/builtin/search';

const result = await searchTool.handler(
  { query: 'TypeScript tutorial', max_results: 5 },
  context
);

// 访问搜索结果
const results = result.metadata.results;
results.forEach((r) => {
  console.log(`${r.title}\n${r.url}\n${r.snippet}`);
});
```

### 方式 2: 网页抓取

```typescript
import { webScrapeTool } from './src/tools/builtin/web-scrape';

const result = await webScrapeTool.handler(
  {
    url: 'https://example.com/article',
    max_length: 5000,
  },
  context
);

// 获取页面内容
console.log(`Title: ${result.metadata.title}`);
console.log(`Content: ${result.metadata.text}`);
```

### 方式 3: 搜索并获取 (推荐) ⭐

```typescript
import { searchAndFetchTool } from './src/tools/builtin/search-and-fetch';
import { formatSearchMetadataForAI } from './src/tools/builtin/search-and-fetch';

const result = await searchAndFetchTool.handler(
  {
    query: 'TypeScript vs JavaScript',
    max_results: 3,
    content_length: 5000,
  },
  context
);

// 格式化为 AI 可读格式
const formatted = formatSearchMetadataForAI(result.metadata);
console.log(formatted);

// 现在可以发送给 AI 分析
const aiPrompt = `
Analyze the following search results:

${formatted}

Provide a comprehensive comparison.
`;
```

## 快速示例

### 示例 1: 研究助手

```typescript
// 搜索并研究一个主题
const result = await searchAndFetchTool.handler(
  {
    query: 'React 19 new features',
    max_results: 5,
    content_length: 8000,
  },
  context
);

// 格式化并发送给 AI
const formatted = formatSearchMetadataForAI(result.metadata);
const aiResponse = await callAI(config, projectInfo, `
Summarize the key new features in React 19:

${formatted}
`, 'chat', []);
```

### 示例 2: 问题诊断

```typescript
// 搜索解决方案
const solutions = await searchAndFetchTool.handler(
  {
    query: 'fix React useEffect dependency warning',
    max_results: 3,
    content_length: 5000,
  },
  context
);

// 让 AI 分析最佳解决方案
const formatted = formatSearchMetadataForAI(solutions.metadata);
const diagnosis = await callAI(config, projectInfo, `
Based on these search results:
${formatted}

What is the best solution and why?
`, 'chat', []);
```

## AI 集成

详细的 AI 集成指南请参考: [SEARCH_AI_INTEGRATION.md](./SEARCH_AI_INTEGRATION.md)

主要集成模式:

1. **直接内容注入**: 将搜索结果直接注入到 AI 系统提示
2. **多轮对话研究**: 迭代搜索和分析
3. **自动化研究助手**: 结合搜索和 AI 分析
4. **规划模式增强**: 在项目规划时进行网络研究

## 测试

### 测试所有功能

```bash
# 测试基础搜索
npx ts-node test-search.ts

# 测试搜索和抓取
npx ts-node test-search-and-fetch.ts

# 测试 AI 集成示例
npx ts-node test-search-with-ai.ts
```

## 返回结果格式

### search 工具

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

### web_scrape 工具

```typescript
{
  success: boolean;
  metadata: {
    url: string;
    title: string;
    text: string;
    text_length: number;
    html_length: number;
  };
}
```

### search_and_fetch 工具

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

## 性能优化

- **并行抓取**: `search_and_fetch` 工具自动并行抓取多个页面
- **内容限制**: 合理设置 `content_length` 避免处理过大的页面
- **结果数量**: 通常 3-5 个结果足够,更多会增加处理时间
- **超时设置**: 默认超时 15 秒,适用于大多数网站

## 错误处理

所有工具都包含完善的错误处理:

- ✅ URL 格式验证
- ✅ 网络超时处理
- ✅ 404 页面处理
- ✅ 部分失败处理 (某些页面抓取失败不影响其他页面)

## 相关文件

- **工具实现**:
  - `src/tools/builtin/search.ts` - 搜索工具
  - `src/tools/builtin/web-scrape.ts` - 网页抓取工具
  - `src/tools/builtin/search-and-fetch.ts` - 组合工具

- **工具注册**: `src/executor-v2.ts`

- **测试文件**:
  - `test-search.ts` - 基础搜索测试
  - `test-search-and-fetch.ts` - 搜索+抓取测试
  - `test-search-with-ai.ts` - AI 集成示例

- **文档**:
  - `SEARCH_FEATURE.md` - 本文档
  - `SEARCH_AI_INTEGRATION.md` - AI 集成指南
