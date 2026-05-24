# Plan: AI Code Review GitHub Action — 从零到 MVP

> 图灵原则：最简单的机制，最大的能力。11 万行代码库是累赘，不是资产。一个 GitHub Action 本质上是：**收到 webhook → 拿 diff → 调 AI → 发评论**。4 步，不需要更多。

## 核心决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 新项目还是复用？ | **新建独立仓库** | 11 万行 newma 代码 90% 无用。独立仓库零负担 |
| 语言 | TypeScript (ESM) | GitHub Actions 生态原生支持，你熟悉 |
| AI 模型 | **可配置，默认 GPT-4o-mini** | 性价比最优（$0.15/1M input tokens），用户可换成任何 OpenAI 兼容 API |
| 包管理 | **零依赖** | 只用 Node.js 内置 `fetch`（Node 18+），不加 axios/node-fetch |
| GitHub API | `@octokit/rest` | 唯一外部依赖，GitHub Actions 场景标配 |

## 架构设计

```
newma-review-action/          ← 全新仓库
├── action.yml                ← GitHub Action 入口定义（~30 行）
├── package.json              ← 最小依赖
├── tsconfig.json
├── src/
│   └── index.ts              ← 主逻辑（~200 行，单文件搞定）
├── dist/
│   └── index.js              ← 编译产物（Actions 运行这个）
├── .github/
│   └── workflows/
│       └── test.yml          ← 自测 workflow
└── README.md
```

## 代码量估算

| 模块 | 行数 | 说明 |
|------|------|------|
| action.yml | 30 | 定义 inputs/outputs/entrypoint |
| src/index.ts | 200 | 全部逻辑 |
| - GitHub API 调用 | 40 | 获取 PR diff、发评论 |
| - AI 调用 | 50 | OpenAI 兼容 API，带 robust JSON 解析 |
| - Prompt 构建 | 60 | review prompt + JSON schema 约束 |
| - 主流程 | 50 | 参数解析 → 调用 → 输出 |
| tsconfig.json | 15 | 标准 ESM 配置 |
| package.json | 20 | name + 1 个依赖 |
| **总计** | **~265 行** | |

## 从 newma-action 可复用的代码

**只复用知识，不复用代码：**

1. **AI review prompt 模板** → `src/gitlab/reviewer.ts` 的 `buildReviewPrompt()` — 提炼 prompt 结构，简化为 GitHub PR 场景
2. **Robust JSON 解析** → `parseJSONResponse()` 的 4 层解析策略（code block → balanced `{}` → balanced `[]` → 全文）
3. **Trailing comma 修复** → `removeTrailingCommas()` 的字符串感知实现

## 详细实施计划

### Week 1: MVP（Day 1-7）

#### Day 1-2: 骨架搭建
- [ ] 创建 `newma-review-action` 仓库
- [ ] 写 `action.yml`（inputs: github-token, ai-api-key, ai-model, ai-base-url）
- [ ] 写 `package.json`（依赖: @octokit/rest, typescript）
- [ ] 写 `tsconfig.json`（ESM, Node 18+ target）
- [ ] 写 `src/index.ts` 骨架（main 函数，参数解析）

#### Day 3-4: 核心逻辑
- [ ] 实现 `getPRDiff()` — 用 Octokit 获取 PR 的 files + patch
- [ ] 实现 `callAIForReview()` — 直接 fetch 调 OpenAI 兼容 API
  - 复用 robust JSON 解析策略（从 newma-action 提炼）
  - 智谱/GPT/Claude 统一兼容
- [ ] 实现 `buildReviewPrompt()` — 简化版 review prompt
  - 输出格式：`{ "reviews": [{ "path", "line", "body", "severity" }] }`
- [ ] 实现 `postReviewComments()` — 用 Octokit 发 PR review comments

#### Day 5: 打包 & 测试
- [ ] `npx @vercel/ncc build src/index.ts` → 打包成单文件 `dist/index.js`
- [ ] 在自己仓库创建 test workflow 触发 review
- [ ] 用 mock PR 验证全链路

#### Day 6-7: 边界处理
- [ ] 大 diff 处理（>100 文件时分批，或只 review 变更行数最多的前 20 文件）
- [ ] Token 限制处理（diff 超过 context window 时截断）
- [ ] 错误处理（API 限流、网络超时、JSON 解析失败）

### Week 2: 发布 & 验证

#### Day 8-9: Marketplace 发布
- [ ] 写 README.md（安装说明 + 配置示例 + 截图）
- [ ] 打 tag v0.1.0
- [ ] 发布到 GitHub Marketplace

#### Day 10-12: 手动推广
- [ ] 找 10 个活跃开源项目，在 issue 或 discussion 里推荐
- [ ] 在 Reddit r/github、Hacker News、V2EX 发帖
- [ ] 收集前 10 个用户的真实反馈

### Week 3: 迭代

- [ ] 根据反馈决定方向
- [ ] 可选：加 auto-fix（Pro 功能）
- [ ] 可选：支持 GitLab（复用 newma-action 的 GitLab 客户端逻辑）

## 技术要点

### action.yml 关键配置

```yaml
name: 'AI Code Review'
description: 'AI-powered code review for pull requests'
inputs:
  github-token:
    description: 'GitHub token (auto-available as ${{ github.token }})'
    required: true
  ai-api-key:
    description: 'AI API key (OpenAI, 智谱, etc.)'
    required: true
  ai-model:
    description: 'AI model name'
    required: false
    default: 'gpt-4o-mini'
  ai-base-url:
    description: 'AI API base URL (for non-OpenAI providers)'
    required: false
    default: 'https://api.openai.com/v1'
  max-files:
    description: 'Max number of files to review'
    required: false
    default: '20'
runs:
  using: 'node20'
  main: 'dist/index.js'
```

### src/index.ts 核心流程

```typescript
async function run() {
  // 1. 获取 inputs
  const { githubToken, aiApiKey, aiModel, aiBaseUrl, maxFiles } = getInputs();
  
  // 2. 获取 PR diff
  const octokit = new Octokit({ auth: githubToken });
  const { data: files } = await octokit.pulls.listFiles({ ... });
  
  // 3. 对每个文件调用 AI review
  for (const file of files.slice(0, maxFiles)) {
    const prompt = buildReviewPrompt(file);
    const review = await callAI(aiBaseUrl, aiApiKey, aiModel, prompt);
    if (review.issues.length > 0) {
      await postComments(octokit, review);
    }
  }
}
```

### 成本估算

| 模型 | 每 PR 成本（估算） | 月成本（100 PR） |
|------|---------------------|-------------------|
| GPT-4o-mini | $0.003-0.01 | $0.30-1.00 |
| GLM-4-Flash | ¥0.001-0.005 | ¥0.10-0.50 |
| GPT-4o | $0.03-0.10 | $3-10 |
| Claude Sonnet | $0.03-0.10 | $3-10 |

**结论：GPT-4o-mini 每月 100 个 PR 成本 < $1。白痴指数依然极高。**

## 与 newma-action 的关系

- **newma-action**（当前 `/Users/mac/mac/newma-action/`）→ 继续维护为 **GitLab CI 集成版**
- **newma-review-action**（新建仓库）→ **GitHub Action 版**，从零开始
- 两者共享 AI review 的**知识**（prompt 设计、JSON 解析经验），但不共享**代码**
- 未来可考虑提取共享的 `@newma/core` 包，但 MVP 阶段不需要

## 交由 Claude Code 执行的清单

1. 创建新仓库 `newma-review-action`
2. 初始化 package.json / tsconfig.json / action.yml
3. 实现 src/index.ts（~200 行）
4. 编译 + 打包（ncc）
5. 写 README.md
6. 验证编译通过
