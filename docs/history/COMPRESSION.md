# Token 压缩功能文档

## 📊 概述

Newma (牛码) 现在支持智能 Token 压缩，通过多种策略显著减少 API 调用的 token 使用量，从而**降低成本并提高响应速度**。

## 🎯 压缩策略

### 1. 智能上下文压缩 (Context Compression)

**功能**: 自动精简发送给 LLM 的项目文件树

**特点**:
- ✅ 自动排除 `node_modules`, `dist`, `build` 等目录
- ✅ 优先保留源代码文件 (`.ts`, `.js`, `.py` 等)
- ✅ 限制文件数量，只保留最相关的文件
- ✅ 支持自定义排除模式

**压缩效果**: **86%** 节省

**示例**:
```typescript
import { ContextCompressor } from './src/compressor';

const compressor = new ContextCompressor({
  excludePatterns: ['node_modules', 'dist', '*.log'],
  maxFiles: 100,
  prioritizeExtensions: ['.ts', '.js', '.json'],
});

const result = compressor.compress(fileTree, projectRoot);
console.log(`节省: ${result.stats.reduction.toFixed(1)}%`);
```

---

### 2. 执行历史摘要 (History Summarization)

**功能**: 对执行历史进行智能摘要，避免发送完整历史

**特点**:
- ✅ 保留最近 N 次迭代（默认 3 次）
- ✅ 将旧迭代摘要为单条记录
- ✅ 优先保留失败的迭代用于错误分析
- ✅ 自动去重

**压缩效果**: **67%** 节省

**示例**:
```typescript
import { HistorySummarizer } from './src/compressor';

const summarizer = new HistorySummarizer({
  keepRecent: 3,
  summarizeOld: true,
  focusOnErrors: true,
});

const result = summarizer.summarize(executionHistory);
console.log(`原始记录: ${executionHistory.length}`);
console.log(`摘要后: ${result.data.length}`);
```

---

### 3. 文件内容优化 (Content Optimization)

**功能**: 优化文件内容，移除不必要的部分

**特点**:
- ✅ 移除注释（单行、多行、JSDoc）
- ✅ 移除空行
- ✅ 可选只保留函数/类签名
- ✅ 智能截断超长文件
- ✅ 支持多种语言（TS, JS, Python 等）

**压缩效果**: **48%** 节省

**示例**:
```typescript
import { ContentOptimizer } from './src/compressor';

const optimizer = new ContentOptimizer({
  maxLength: 2000,
  removeComments: true,
  removeEmptyLines: true,
  keepSignatures: false,
});

const result = optimizer.optimize(filePath, content);
console.log(`优化后: ${result.data.length} chars`);
```

---

### 4. 增量上下文跟踪 (Incremental Tracking)

**功能**: 只发送自上次调用后的变化部分

**特点**:
- ✅ 跟踪文件变化（MD5 哈希）
- ✅ 只发送新增/修改的文件
- ✅ 标记删除的文件
- ✅ 自动设置基线

**压缩效果**: 变化量越大，节省越多

**示例**:
```typescript
import { IncrementalTracker } from './src/compressor';

const tracker = new IncrementalTracker();

// 设置基线
tracker.setBaseline(fileMap);

// 获取 delta
const delta = tracker.getDelta(currentFiles);
console.log(`变化文件数: ${delta.data.size}`);
```

---

## 🚀 使用方法

### 方法 1: 通过 CLI 启用

```bash
# 启用压缩（默认模式）
npx newma-cli --compress "add a new feature"

# 启用激进压缩模式
npx newma-cli --compress --aggressive "fix bugs"

# 自定义压缩目标
npx newma-cli --compress --target-reduction 70 "optimize code"
```

### 方法 2: 在代码中使用

```typescript
import { callAI } from './src/ai';
import { CompressionConfig } from './src/compressor';

const compression: CompressionConfig = {
  enabled: true,
  maxTokens: 8000,
  targetReduction: 50,
  aggressive: false,
};

const response = await callAI(
  config,
  projectInfo,
  requirement,
  'plan',
  executionHistory,
  availableTools,
  grantedPermissions,
  compression,  // 启用压缩
  projectRoot
);
```

### 方法 3: 使用压缩管理器

```typescript
import { CompressionManager } from './src/compressor';

const manager = new CompressionManager({
  enabled: true,
  targetReduction: 50,
});

const result = manager.compressAll({
  context: fileTree,
  contextRoot: projectRoot,
  history: executionHistory,
  files: fileMap,
});

// 查看压缩报告
manager.printReport(result.report);
```

---

## 📈 压缩效果

### 综合测试结果

| 策略 | 压缩率 | Token 节省 |
|------|--------|-----------|
| 上下文压缩 | 86.0% | ~748 chars |
| 历史摘要 | 66.9% | ~2,521 chars |
| 内容优化 | 47.5% | ~171 chars |
| **集成压缩** | **73.0%** | **~1,208 chars** |
| **大数据集** | **37.2%** | **~1,826 tokens** |

### 实际场景收益

**场景 1: 小型项目**
- 文件数: ~50
- 历史记录: ~10
- **节省**: ~1,200 tokens (~30%)
- **成本节省**: ~$0.002/次调用

**场景 2: 中型项目**
- 文件数: ~200
- 历史记录: ~50
- **节省**: ~5,000 tokens (~50%)
- **成本节省**: ~$0.01/次调用

**场景 3: 大型项目**
- 文件数: ~1000
- 历史记录: ~200
- **节省**: ~20,000 tokens (~60%)
- **成本节省**: ~$0.04/次调用

---

## 🔧 配置选项

### CompressionConfig

```typescript
interface CompressionConfig {
  enabled?: boolean;        // 启用压缩 (default: true)
  maxTokens?: number;       // 最大 tokens (default: 8000)
  targetReduction?: number; // 目标压缩率% (default: 50)
  aggressive?: boolean;     // 激进模式 (default: false)
}
```

### ContextCompressionOptions

```typescript
interface ContextCompressionOptions {
  excludePatterns?: string[];  // 排除模式
  maxDepth?: number;           // 最大深度
  maxFiles?: number;           // 最大文件数
  prioritizeExtensions?: string[]; // 优先扩展名
}
```

### HistorySummarizationOptions

```typescript
interface HistorySummarizationOptions {
  maxIterations?: number;   // 最大迭代数
  keepRecent?: number;      // 保留最近 N 次
  summarizeOld?: boolean;   // 摘要旧记录
  focusOnErrors?: boolean;  // 关注错误
}
```

### FileContentOptions

```typescript
interface FileContentOptions {
  maxLength?: number;         // 最大长度
  keepStructure?: boolean;    // 保留结构
  removeComments?: boolean;   // 移除注释
  removeEmptyLines?: boolean; // 移除空行
  keepSignatures?: boolean;   // 只保留签名
}
```

---

## 🧪 测试

运行压缩测试：

```bash
npx ts-node test-compression.ts
```

测试包括：
- ✅ 上下文压缩测试
- ✅ 历史摘要测试
- ✅ 内容优化测试
- ✅ 集成压缩测试
- ✅ 压缩效果测试

---

## 💡 最佳实践

### 1. 选择合适的压缩模式

**保守模式**（适合开发阶段）:
```typescript
{
  enabled: true,
  targetReduction: 30,
  aggressive: false,
}
```

**标准模式**（适合日常使用）:
```typescript
{
  enabled: true,
  targetReduction: 50,
  aggressive: false,
}
```

**激进模式**（适合大型项目）:
```typescript
{
  enabled: true,
  targetReduction: 70,
  aggressive: true,
}
```

### 2. 根据项目调整

**小型项目** (< 100 files):
- 重点：上下文压缩
- 预期压缩率：30-40%

**中型项目** (100-500 files):
- 重点：上下文 + 历史
- 预期压缩率：40-50%

**大型项目** (> 500 files):
- 重点：全部策略
- 预期压缩率：50-60%

### 3. 监控压缩效果

```typescript
const result = manager.compressAll({...});

// 打印报告
manager.printReport(result.report);

// 检查是否达到目标
if (result.report.total.reduction < config.targetReduction) {
  console.warn('压缩未达到目标，考虑启用激进模式');
}
```

---

## 🔮 未来增强

### 计划中的功能

1. **语义压缩** (v4.1)
   - 基于代码语义的智能压缩
   - 保留关键逻辑，移除冗余

2. **缓存优化** (v4.2)
   - 缓存常见模式的压缩结果
   - 进一步减少处理时间

3. **自适应压缩** (v4.3)
   - 根据项目特点自动调整策略
   - 机器学习驱动的优化

4. **实时监控** (v4.4)
   - 实时显示压缩进度
   - 可视化压缩效果

---

## 🎓 技术细节

### 架构

```
┌─────────────────────────────────────────┐
│         CompressionManager              │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐  ┌──────────────┐   │
│  │   Context    │  │   History    │   │
│  │  Compressor  │  │ Summarizer   │   │
│  └──────────────┘  └──────────────┘   │
│                                         │
│  ┌──────────────┐  ┌──────────────┐   │
│  │   Content    │  │  Incremental │   │
│  │  Optimizer   │  │   Tracker    │   │
│  └──────────────┘  └──────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### 性能

- **压缩时间**: < 10ms (中型项目)
- **内存开销**: < 5MB
- **CPU 使用**: 单核，< 5%

---

## 📝 总结

Newma (牛码) 的 Token 压缩功能可以：

✅ **显著降低成本** - 节省 30-60% 的 token 使用
✅ **提高响应速度** - 更少的 token = 更快的 API 响应
✅ **保持质量** - 智能压缩，保留关键信息
✅ **易于使用** - 一行代码启用，自动优化
✅ **灵活配置** - 多种策略，按需调整

**立即开始节省 token 吧！** 🚀

---

**最后更新**: v3.1.0 (2025-01-16)
**维护者**: Newma (牛码) Development Team
