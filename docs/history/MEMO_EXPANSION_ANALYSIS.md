# Memo 存储扩展分析

**Date**: 2026-01-31
**Status**: 探索中

## 当前已实现 ✅

| 数据类型 | 存储位置 | 实现状态 | 用途 |
|---------|---------|---------|------|
| **任务历史** | `.memo/tasks/` | ✅ 已实现 | 记录所有任务执行历史 |
| **项目决策** | `.memo/decisions.json` | ✅ 已实现 | 记录重要架构和技术决策 |
| **代码索引** | `.memo/index.json` | ✅ 已实现 | 快速查找类、函数、文件 |
| **用户侧写** | `用户侧写.md` | ✅ 已实现 | AI 适配用户偏好 |

## 可扩展的记忆类型 🚀

### 1. 执行历史记忆 ⚡

**当前实现**: `src/history.ts` - `ExecutionTracker`
**当前存储**: 内存中 (session 级别)

**建议扩展**:
```typescript
// .memo/executions/
// ├── 2026-01/
// │   ├── session-1.json
// │   ├── session-2.json.gz
// │   └── index.json
// ├── 2026-02/
// └── archive/
//     └── 2025/  // 永久归档

interface ExecutionHistory {
  sessionId: string;
  startTime: string;
  endTime: string;
  commands: Array<{
    input: string;
    mode: string;
    duration: number;
    success: boolean;
  }>;
  totalActions: number;
  successRate: number;
}
```

**收益**:
- 跨会话的执行模式分析
- 成功率趋势追踪
- 常用命令识别
- 失败模式学习

**AI 上下文增强**:
```typescript
// 在 AI 调用时注入
"用户最近 10 次执行记录：
- 成功率: 85%
- 常用命令: /plan, /execute
- 最近失败: 测试相关任务 (2次)
"
```

---

### 2. 推理过程记忆 🧠

**当前实现**: `src/ultrathink/tracker.ts` - `ReasoningTracker`
**当前存储**: 文件系统 (可配置 traceDir)

**建议扩展**:
```typescript
// .memo/reasoning/
// ├── 2026-01/
// │   ├── fft-{timestamp}.json
// │   ├── landmark-{timestamp}.json
// │   ├── tot-{timestamp}.json.gz
// │   └── patterns.json
// └── archive/
//     └── 2025/

interface ReasoningTrace {
  id: string;
  algorithm: 'fft' | 'landmark' | 'tot';
  timestamp: string;
  input: string;
  thoughts: any;
  outcome: 'success' | 'failed';
  duration: number;
}

interface ReasoningPattern {
  patternType: string;
  frequency: number;
  averageDuration: number;
  successRate: number;
  commonKeywords: string[];
}
```

**收益**:
- 学习用户的思维模式
- 识别成功/失败模式
- 自动选择最佳算法
- 推理性能优化

**AI 上下文增强**:
```typescript
// 在规划时注入
"用户的历史推理模式：
- FFT 成功率: 90% (简单任务)
- Landmark 成功率: 75% (中等任务)
- ToT 成功率: 60% (复杂任务)
- 推荐算法: FFT (当前任务匹配度: 95%)
"
```

---

### 3. 错误与解决方案记忆 🔧

**当前实现**: 分散在各个地方
**当前存储**: 没有专门存储

**建议扩展**:
```typescript
// .memo/errors/
// ├── errors.json         // 当前活跃错误
// ├── solutions.json      // 解决方案库
// └── history/
//     ├── 2026-01.json.gz
//     └── 2025-12.json.gz

interface ErrorRecord {
  id: string;
  timestamp: string;
  errorType: string;
  errorMessage: string;
  context: {
    command: string;
    mode: string;
    task: string;
  };
  solution?: string;
  resolved: boolean;
  occurrenceCount: number;
}

interface SolutionPattern {
  errorType: string;
  solution: string;
  successRate: number;
  lastUsed: string;
}
```

**收益**:
- 自动记录错误模式
- 快速复用解决方案
- 减少重复错误
- 错误预防提示

**AI 上下文增强**:
```typescript
// 当检测到错误时注入
"类似错误的解决方案：
- 错误: 'Module not found'
- 常见解决方案: npm install, 检查导入路径
- 用户历史成功率: 80% (使用方案 A)
"
```

---

### 4. 代码片段记忆 💻

**当前实现**: 无
**当前存储**: 无

**建议扩展**:
```typescript
// .memo/snippets/
// ├── utils.json
// ├── components.json
// ├── patterns.json
// └── archive/
//     └── 2025/

interface CodeSnippet {
  id: string;
  title: string;
  code: string;
  language: string;
  tags: string[];
  usageCount: number;
  lastUsed: string;
  context: {
    task: string;
    file?: string;
  };
}

interface SnippetPattern {
  pattern: string;
  category: string;
  frequency: number;
  examples: string[];
}
```

**收益**:
- 复用常用代码模式
- 加速开发速度
- 代码一致性
- 学习用户编码风格

**AI 上下文增强**:
```typescript
// 在生成代码时注入
"用户常用代码模式：
- React 组件结构: Function Component + Hooks
- 状态管理: useState, useReducer
- API 调用: async/await with try-catch
"
```

---

### 5. 项目上下文记忆 📁

**当前实现**: `src/scanner.ts` - 每次扫描
**当前存储**: 内存中

**建议扩展**:
```typescript
// .memo/context/
// ├── structure.json      // 当前项目结构
// ├── dependencies.json   // 依赖关系
// ├── config.json         // 配置快照
// ├── recent-changes.json // 最近变更
// └── history/
//     ├── 2026-01-structure.json.gz
//     └── 2025-12-structure.json.gz

interface ProjectContext {
  lastUpdated: string;
  structure: {
    directories: string[];
    fileTypes: Record<string, number>;
    totalFiles: number;
    totalLines: number;
  };
  dependencies: {
    runtime: Record<string, string>;
    dev: Record<string, string>;
  };
  config: {
    framework: string;
    buildTool: string;
    testing: string[];
  };
  recentChanges: Array<{
    file: string;
    timestamp: string;
    type: 'create' | 'modify' | 'delete';
  }>;
}
```

**收益**:
- 避免重复扫描
- 快速项目理解
- 智能依赖管理
- 变更追踪和历史回溯

**AI 上下文增强**:
```typescript
// 在任务执行时注入
"项目上下文：
- 框架: React + TypeScript
- 构建: Vite
- 测试: Vitest + Jest
- 最近变更: 新增 auth 模块 (3 files)
"
```

---

### 6. 用户偏好设置记忆 ⚙️

**当前实现**: 分散在各种配置中
**当前存储**: `.env`, 配置文件

**建议扩展**:
```typescript
// .memo/preferences.json

interface UserPreferences {
  // 编辑偏好
  editor: {
    indent: 'spaces' | 'tabs';
    indentSize: number;
    quoteStyle: 'single' | 'double';
    trailingComma: boolean;
  };

  // 开发偏好
  development: {
    autoSave: boolean;
    autoTest: boolean;
    defaultMode: 'plan' | 'execute' | 'loop';
    verificationLevel: 'fast' | 'standard' | 'thorough';
  };

  // AI 交互偏好
  ai: {
    language: 'zh' | 'en' | 'auto';
    verbosity: 'concise' | 'normal' | 'detailed';
    planningAlgorithm: 'auto' | 'fft' | 'landmark' | 'tot';
    includeContext: boolean;
  };

  // 工具偏好
  tools: {
    preferredPackageManager: 'npm' | 'yarn' | 'pnpm';
    testFramework: string;
    linter: string[];
  };
}
```

**收益**:
- 代码风格一致性
- 自动化配置
- 减少重复配置
- 个性化体验

**应用场景**:
```typescript
// 自动应用用户偏好
function generateCode(userPrefs: UserPreferences): string {
  const indent = userPrefs.editor.indentSize;
  const quote = userPrefs.editor.quoteStyle;
  // 生成符合偏好的代码
}
```

---

### 7. 会话上下文记忆 💬

**当前实现**: `src/session.ts` - SessionManager (临时)
**当前存储**: 内存中 (会话结束即丢失)

**建议扩展**:
```typescript
// .memo/sessions/
// ├── 2026-01/
// │   ├── session-{id}.json
// │   ├── session-{id}.json.gz
// │   └── summary.json
// └── archive/
//     └── 2025/

interface SessionContext {
  sessionId: string;
  startTime: string;
  endTime: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  tasksCompleted: number;
  totalDuration: number;
  topics: string[];
}

interface SessionSummary {
  totalSessions: number;
  lastSession: string;
  commonTopics: string[];
  averageDuration: number;
  mostUsedCommands: string[];
}
```

**收益**:
- 跨会话的上下文连续性
- 话题追踪
- 使用习惯分析
- 会话恢复

**AI 上下文增强**:
```typescript
// 在新会话开始时注入
"上次会话摘要：
- 完成任务: 用户认证, API 设计
- 讨论话题: 架构重构, 测试策略
- 建议继续: API 设计 (未完成)
"
```

---

### 8. 性能指标记忆 📊

**当前实现**: 分散在各个地方
**当前存储**: 没有持久化

**建议扩展**:
```typescript
// .memo/metrics/
// ├── 2026-01/
// │   ├── performance.json
// │   ├── tokens.json
// │   └── analytics.json
// └── archive/
//     └── 2025/

interface PerformanceMetrics {
  timestamp: string;
  task: {
    id: string;
    requirement: string;
    mode: string;
  };
  duration: {
    planning: number;
    execution: number;
    verification: number;
    total: number;
  };
  success: boolean;
  algorithm?: string;
}

interface TokenUsage {
  date: string;
  total: number;
  byMode: Record<string, number>;
  averagePerTask: number;
}

interface AnalyticsData {
  dailyTasks: number;
  successRate: number;
  averageDuration: number;
  mostUsedFeatures: string[];
  peakUsageHours: number[];
}
```

**收益**:
- 成本追踪和控制
- 性能优化识别
- 使用趋势分析
- 资源规划

**AI 上下文增强**:
```typescript
// 智能成本控制
"用户本月 token 使用：
- 已用: 45,000 / 100,000 (45%)
- 平均每任务: 1,500 tokens
- 预计剩余: 36 个任务
- 建议: 启用 FFT 模式节省 token (节省 30%)
"
```

---

## 优先级建议 🎯

### 高优先级 (立即实施)

1. **执行历史记忆** ⚡⚡⚡
   - 实施难度: 低
   - 价值: 高
   - 代码位置: `src/history.ts`
   - 集成点: `SessionManager`, `MemoCliPlugin`

2. **项目上下文记忆** ⚡⚡⚡
   - 实施难度: 低
   - 价值: 高
   - 代码位置: `src/scanner.ts`
   - 集成点: 项目初始化, AI 调用前

3. **错误与解决方案记忆** ⚡⚡
   - 实施难度: 中
   - 价值: 高
   - 代码位置: `src/errors.ts`, `src/retry.ts`
   - 集成点: 错误处理, AI 上下文

### 中优先级 (逐步实施)

4. **推理过程记忆** 🧠
   - 实施难度: 中
   - 价值: 中
   - 代码位置: `src/ultrathink/tracker.ts`
   - 集成点: 算法选择, 性能优化

5. **用户偏好设置记忆** ⚙️
   - 实施难度: 低
   - 价值: 中
   - 代码位置: `src/config.ts`, `src/session.ts`
   - 集成点: 代码生成, AI 交互

6. **会话上下文记忆** 💬
   - 实施难度: 中
   - 价值: 中
   - 代码位置: `src/session.ts`
   - 集成点: 会话恢复, 上下文连续性

### 低优先级 (未来增强)

7. **代码片段记忆** 💻
   - 实施难度: 高
   - 价值: 中
   - 需求: 代码分析, 模式识别

8. **性能指标记忆** 📊
   - 实施难度: 低
   - 价值: 低
   - 需求: 数据分析, 可视化

---

## 实施路线图 🗺️

### Phase 1: 基础记忆扩展 (1-2 周)

**目标**: 扩展现有记忆系统,增加高价值数据

- [ ] 实现执行历史记忆 (`.memo/executions/`)
- [ ] 实现项目上下文记忆 (`.memo/context/`)
- [ ] 实现 AI 上下文自动注入
- [ ] 更新文档

### Phase 2: 智能记忆 (2-3 周)

**目标**: 添加模式学习和预测能力

- [ ] 实现错误与解决方案记忆
- [ ] 实现推理过程记忆
- [ ] 实现用户偏好设置记忆
- [ ] 添加记忆搜索 API

### Phase 3: 高级记忆 (3-4 周)

**目标**: 深度集成和智能建议

- [ ] 实现代码片段记忆
- [ ] 实现会话上下文记忆
- [ ] 实现性能指标记忆
- [ ] 添加记忆可视化界面

---

## 技术考虑 🔧

### 存储策略 (永久保留)

```typescript
// .memo/ 目录结构
.memo/
├── decisions.json       # 已有: 项目决策
├── index.json           # 已有: 代码索引
├── tags.json            # 已有: 标签元数据
├── preferences.json     # 新增: 用户偏好
├── tasks/               # 已有: 任务历史
│   └── archive/         # 归档所有历史任务
├── executions/          # 新增: 执行历史
│   ├── 2026-01/
│   └── archive/
│       └── 2025/
├── reasoning/           # 新增: 推理过程
│   ├── 2026-01/
│   └── archive/
│       └── 2025/
├── errors/              # 新增: 错误记录
│   ├── errors.json
│   ├── solutions.json
│   └── history/
├── snippets/            # 新增: 代码片段
│   └── archive/
├── context/             # 新增: 项目上下文
│   ├── structure.json
│   └── history/
├── sessions/            # 新增: 会话上下文
│   └── archive/
└── metrics/             # 新增: 性能指标
    └── archive/
```

### 压缩策略 (保留但压缩)

- **最近 7 天**: 不压缩 (快速访问)
- **7-30 天**: gzip 压缩 (节省空间)
- **30 天以上**: 保持 gzip 压缩 (永久归档)

**重要**: 所有数据永久保留，仅做压缩处理，不删除任何历史数据！

### 索引策略

```typescript
// .memo/index-all.json (全局索引)
interface GlobalIndex {
  lastUpdated: string;
  sections: {
    decisions: number;
    tasks: number;
    executions: number;
    errors: number;
    snippets: number;
  };
  searchIndex: Record<string, string[]>; // keyword -> file paths
  archiveIndex: {
    byYear: Record<string, string[]>; // 2025 -> [file paths]
    bySize: {
      small: string[];   // < 1MB
      medium: string[];  // 1-10MB
      large: string[];   // > 10MB
    };
  };
}
```

### 存储空间预估

```
假设每天使用情况：
- 任务记录: 10 个 × 5KB = 50KB/天
- 执行历史: 20 个 × 2KB = 40KB/天
- 推理过程: 5 个 × 10KB = 50KB/天
- 错误记录: 2 个 × 1KB = 2KB/天
- 会话记录: 5 个 × 3KB = 15KB/天
- 性能指标: 1 个 × 1KB = 1KB/天

总计: ~158KB/天
一年 (365天): ~57MB/年
10年: ~570MB

gzip 压缩后 (70% 压缩率):
- 一年: ~17MB
- 10年: ~170MB

结论: 即使使用 10 年，存储空间也完全可以接受
```

---

## AI 上下文注入策略 🤖

### 注入时机

1. **任务规划前**: 注入相关决策、历史任务、项目上下文
2. **错误发生时**: 注入历史错误和解决方案
3. **算法选择时**: 注入推理模式、成功率数据
4. **代码生成时**: 注入代码片段、用户偏好
5. **会话开始时**: 注入上次会话摘要、常见话题

### 注入限制

- **最大 token 数**: 2000 tokens (约 1500 中文字符)
- **优先级排序**:
  1. 直接相关 (关键词匹配)
  2. 间接相关 (标签、类别匹配)
  3. 时间相关 (最近 7 天)
  4. 统计相关 (高频使用)

### 格式化示例

```typescript
function buildMemoContext(requirement: string): string {
  return `
📚 PROJECT MEMORY:

🎯 Relevant Decisions:
${formatDecisions(searchDecisions(requirement))}

📋 Related Tasks:
${formatTasks(searchTasks(requirement))}

🔧 Recent Errors:
${formatErrors(getRecentErrors(requirement))}

💡 Code Snippets:
${formatSnippets(findSnippets(requirement))}

📊 Project Context:
${formatProjectContext(getProjectContext())}

⚙️ User Preferences:
${formatPreferences(getUserPreferences())}

📈 Performance Insights:
${formatMetrics(getPerformanceMetrics())}
  `.trim();
}
```

---

## 测试策略 🧪

### 单元测试

```typescript
// test-memo-expansion.ts
describe('Execution History Memory', () => {
  it('should record execution history', async () => {
    // Test recording
  });

  it('should search execution history', async () => {
    // Test searching
  });

  it('should compress old executions', async () => {
    // Test compression
  });

  it('should never delete old data', async () => {
    // Test permanent retention
  });
});
```

### 集成测试

```typescript
describe('Memo Context Injection', () => {
  it('should inject relevant memories into AI context', async () => {
    // Test AI context enhancement
  });

  it('should respect token limits', async () => {
    // Test token limiting
  });

  it('should prioritize relevant memories', async () => {
    // Test prioritization
  });
});
```

---

## 潜在挑战 ⚠️

### 1. 存储空间管理

**问题**: 记忆数据持续增长
**解决方案**:
- ✅ **压缩而非删除**: gzip 压缩旧数据
- ✅ **归档策略**: 按年/月组织归档
- ✅ **智能索引**: 快速定位历史数据
- ✅ **用户控制**: 可选择导出/清理

### 2. 隐私和安全

**问题**: 敏感信息可能被记录
**解决方案**:
- 敏感信息过滤
- 可选加密存储
- 用户控制的删除选项
- 本地存储为主

### 3. 性能影响

**问题**: 大量历史数据检索可能影响性能
**解决方案**:
- 索引优化
- 缓存策略
- 异步加载
- 分层存储 (热数据/冷数据)

### 4. 上下文质量

**问题**: 注入不相关的记忆会干扰 AI
**解决方案**:
- 智能相关性评分
- A/B 测试不同策略
- 用户反馈机制

---

## 成功指标 📊

### 定量指标

- **记忆检索速度**: < 100ms (p95)
- **存储空间增长**: ~50MB/年 (可接受)
- **AI 上下文质量**: 相关性 > 80%
- **错误复用率**: > 30%
- **数据保留率**: 100% (永久保留)

### 定性指标

- **用户体验**: 更智能的 AI 响应
- **开发效率**: 更少的重复工作
- **学习曲线**: 更快的项目上手
- **决策质量**: 更好的技术决策
- **历史追溯**: 完整的项目发展记录

---

## 下一步行动 ✅

### 立即行动

1. **评审这份分析** - 与团队讨论优先级
2. **选择第一个实现** - 建议从执行历史记忆开始
3. **创建详细设计** - API 设计, 数据结构
4. **开始实施** - 按照路线图逐步推进

### 长期规划

1. **建立记忆治理** - 压缩、归档策略 (不删除)
2. **添加可视化** - 记忆浏览器、统计面板
3. **开放 API** - 允许插件访问记忆系统
4. **持续优化** - 基于使用反馈改进

---

## 数据保留策略 📦

### 核心原则

**所有记忆数据永久保留，不删除！**

### 分层存储策略

```
热数据 (最近 7 天)
├─ 不压缩
├─ 快速访问
└─ 内存缓存 + SSD

温数据 (7-30 天)
├─ gzip 压缩
├─ 按需解压
└─ SSD 存储

冷数据 (30 天以上)
├─ gzip 压缩
├─ 按年/月归档
└─ 可迁移到廉价存储
```

### 备份策略

```bash
# 定期备份脚本
memo-backup.sh:
  1. 导出所有 .memo/ 数据
  2. 打包为 tar.gz
  3. 上传到云存储 (可选)
  4. 验证备份完整性
```

### 数据迁移

```typescript
// 随着项目增长，可能需要迁移策略
interface MigrationPlan {
  // 当 .memo/ 超过 1GB 时
  // 1. 2 年前的数据 → 外部存储
  // 2. 保留索引在本地
  // 3. 按需加载外部数据
}
```

---

**结论**: Memo 系统有巨大的扩展潜力。通过系统性地添加更多类型的记忆，Newma 可以从一个简单的 AI CLI 成长为一个真正具有"记忆"和"学习能力"的智能助手。**所有数据永久保留，确保完整的项目发展历史。**

**建议**: 从高优先级项目开始，逐步实施，持续测量效果，迭代改进。

---

**文档版本**: 1.1
**最后更新**: 2026-01-31
**维护者**: Newma Development Team
**重要更新**: 明确永久保留策略，30天以上数据归档但不删除
