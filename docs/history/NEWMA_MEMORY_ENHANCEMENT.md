# Newma 记忆系统增强方案

> 基于 `/Users/mac/kode/src/memory/` 现有代码分析，2026-04-12

---

## 一、现状分析

### 1.1 架构概览

现有记忆系统由 6 个核心管理器 + 沉淀管道组成，全部基于文件存储（`.memo/` 目录）：

| 管理器 | 存储路径 | 功能 |
|--------|----------|------|
| ContextManager | `.memo/context/` | 项目结构、依赖、配置、文件变更 |
| ExecutionHistoryManager | `.memo/executions/` | 命令执行记录（gzip 压缩） |
| ErrorMemoryManager | `.memo/errors/` | 错误记录 + 解决方案 + 错误模式 |
| ReasoningManager | `.memo/reasoning.json` | 推理链、推理步骤、推理模式 |
| PreferencesManager | `.memo/preferences.json` | 用户偏好（代码风格、工作流等） |
| SessionContextManager | `.memo/sessions.json` | 跨会话对话历史 |

沉淀管道：`MemoryScheduler → ExperienceAnalyzer → SkillGenerator → SkillDraftManager`

### 1.2 做得好的地方

- **模块化清晰**：每个管理器职责单一，类型定义完整
- **有压缩机制**：ExecutionHistory 支持 gzip 老数据
- **有经验沉淀**：Precipitation 管道能从历史中提取技能
- **有模式识别**：ErrorMemory 和 Reasoning 都有 pattern 抽象

### 1.3 核心问题

#### 问题 1：没有语义检索，只有结构化查询
所有管理器都只支持 `filter` / `find` 式查询（按类型、时间、标签过滤）。没有向量索引，无法"找到跟当前错误相似的历史记录"。

#### 问题 2：记忆之间没有关联
错误记录不知道它属于哪个推理链，推理链不知道它产出了什么技能，技能不知道它解决过哪些问题。每个管理器是孤岛。

#### 问题 3：沉淀管道太重
ExperienceAnalyzer 每次都要调 AI 来分析全部记忆数据，token 消耗大，而且生成的是静态技能文件——不是实时可用的知识。

#### 问题 4：没有遗忘机制
所有数据只增不减。ContextManager 有 `maxChanges` 限制，但其他管理器没有。长期使用后 `.memo/` 会膨胀。

#### 问题 5：会话上下文是全量 JSON
SessionContextManager 把所有历史会话存在一个 JSON 文件里。会话多了之后加载和搜索都会变慢。

#### 问题 6：没有优先级和衰减
所有记忆平等对待。一个月前的错误和刚发生的错误权重一样，没有时间衰减。

---

## 二、增强方案

### Phase 1：轻量级语义检索（不依赖外部服务）

**目标**：让记忆可以"语义搜索"，不引入向量数据库依赖。

**方案**：基于 TF-IDF + BM25 的本地全文检索

```
src/memory/
├── search/
│   ├── index.ts          # SearchIndex 统一接口
│   ├── bm25.ts           # BM25 实现（轻量，纯 TS）
│   ├── tokenizer.ts      # 中英文分词
│   └── memory-search.ts  # MemorySearchEngine - 聚合搜索
```

**核心接口**：
```typescript
interface MemorySearchResult {
  source: 'error' | 'execution' | 'reasoning' | 'session';
  id: string;
  score: number;
  snippet: string;
  timestamp: string;
  metadata: Record<string, any>;
}

interface MemorySearchEngine {
  indexAll(): Promise<void>;           // 重建索引
  search(query: string, opts?: { source?: string, limit?: number }): Promise<MemorySearchResult[]>;
  addDocument(doc: SearchableDocument): Promise<void>;
  removeDocument(source: string, id: string): Promise<void>;
}
```

**为什么选 BM25 而不是向量**：
- 零外部依赖（不需要 embedding 模型或数据库）
- 索引文件小（几十 KB 级别）
- 对代码和错误信息的检索效果够用
- 构建速度快（<100ms）

### Phase 2：记忆关联图谱

**目标**：让不同类型的记忆之间建立关联。

**方案**：轻量图结构（邻接表存储）

```
src/memory/
├── graph/
│   ├── memory-graph.ts   # MemoryGraph 核心类
│   ├── types.ts          # 图节点和边类型
│   └── traversal.ts      # 图遍历算法
```

**关联类型**：
```typescript
type RelationType = 
  | 'caused'        // 错误 → 导致这个错误的原因
  | 'solved_by'     // 错误 → 解决它的方案
  | 'produced'      // 执行 → 产出的文件变更
  | 'reasoned_for'  // 推理链 → 它服务的任务
  | 'evolved_into'  // 技能 → 从经验沉淀而来
  | 'related_to';   // 通用关联

interface MemoryNode {
  id: string;
  type: 'error' | 'execution' | 'reasoning' | 'skill' | 'session';
  sourceId: string;     // 源管理器中的 ID
  embedding?: number[]; // 预留向量接口
  createdAt: string;
  updatedAt: string;
}
```

**存储**：`.memo/graph.json`（邻接表，通常 <1MB）

**使用场景**：
- 查错误时自动带出相关推理链和解决方案
- 沉淀管道知道哪些经验已经生成了技能
- "这个错误之前见过吗？" → 遍历 `caused` + `solved_by` 链

### Phase 3：智能遗忘与衰减

**目标**：自动清理低价值记忆，保持系统轻量。

**方案**：基于访问频率 + 时间衰减的评分系统

```typescript
interface MemoryScore {
  value: number;           // 当前分数 0-1
  lastAccessed: string;    // 最后访问时间
  accessCount: number;     // 访问次数
  createdAt: string;       // 创建时间
  importance: number;      // 重要性标记（0-1，可手动提升）
}

// 衰减公式：score = importance * recency * frequency
// recency = exp(-λ * days_since_access)
// frequency = log(1 + access_count)
```

**策略**：
- 默认保留 90 天
- 每次被搜索命中 → `accessCount++`，分数回升
- 低于 0.1 的记忆移入 `.memo/archive/`（不删，归档）
- `importance` 可通过 API 手动标记（比如用户说"记住这个"）

### Phase 4：会话上下文优化

**目标**：SessionContextManager 从单文件改为分片存储。

**方案**：
```
.memo/sessions/
├── index.json              # 会话索引（id, topic, time, summary）
├── 2026-01/
│   ├── 2026-01-15_abc123.json
│   └── 2026-01-18_def456.json
└── recent/                 # 最近 7 天的完整会话（快速访问）
```

**索引格式**：
```typescript
interface SessionIndex {
  sessions: Array<{
    id: string;
    date: string;
    topic: string;         // AI 自动生成的主题
    summary: string;       // 3-5 句话摘要
    messageCount: number;
    keyDecisions: string[];// 重要决策点
    filePath: string;      // 分片文件路径
  }>;
}
```

**好处**：
- 启动时只加载索引（几十 KB）
- 搜索时通过索引定位，按需加载分片
- 老会话自动压缩归档

### Phase 5：实时记忆注入（Context Injection）

**目标**：在 AI 调用前自动注入相关历史记忆。

**方案**：MemoryContextInjector，作为 AI 调用的前置钩子

```typescript
interface MemoryContextInjector {
  // 在 AI 调用前，根据当前任务自动检索相关记忆
  getRelevantContext(
    currentTask: string, 
    options: { maxTokens?: number, sources?: string[] }
  ): Promise<MemoryInjection>;
}

interface MemoryInjection {
  relevantErrors: ErrorRecord[];       // 相关的历史错误
  similarExecutions: CommandRecord[];  // 类似的历史操作
  applicableSkills: string[];          // 可用的技能
  reasoningPatterns: ReasoningPattern[]; // 相关的推理模式
  estimatedTokens: number;             // 估算 token 数
}
```

**接入点**：在 `src/ai.ts` 的 `callAI` 函数中，作为 system prompt 的一部分注入。

**Token 预算控制**：
- 默认 2000 tokens 给记忆注入
- 按相关性排序，截断
- 不同类型按比例分配（错误 40% + 推理 30% + 技能 20% + 会话 10%）

---

## 三、实施优先级

| 优先级 | Phase | 工作量 | 收益 |
|--------|-------|--------|------|
| P0 | Phase 1 语义检索 | 2-3 天 | 解决"找不到历史"的核心痛点 |
| P0 | Phase 4 会话优化 | 1 天 | 解决长期使用后的性能问题 |
| P1 | Phase 5 实时注入 | 2 天 | 让记忆真正有用（否则有记忆但不用） |
| P1 | Phase 2 关联图谱 | 3 天 | 让记忆形成网络而非孤岛 |
| P2 | Phase 3 智能遗忘 | 1-2 天 | 长期可维护性 |

**建议顺序**：Phase 4 → Phase 1 → Phase 5 → Phase 2 → Phase 3

理由：Phase 4 是基础修复（现有代码的性能隐患），Phase 1+5 是核心能力（从"存记忆"到"用记忆"），Phase 2+3 是锦上添花。

---

## 四、与现有代码的兼容

- **不破坏现有接口**：所有新功能通过新模块提供，现有管理器保持不变
- **渐进式迁移**：Phase 4 把 sessions.json 拆分时，保留兼容读取
- **可选启用**：每个 Phase 都有 feature flag，可以独立开关
- **存储格式**：新增 `.memo/search/`、`.memo/graph.json`、`.memo/sessions/`，不修改现有文件格式

---

## 五、文件结构规划

```
src/memory/
├── index.ts                    # 现有，保持
├── types.ts                    # 现有，保持
├── context-manager.ts          # 现有，保持
├── execution-history.ts        # 现有，保持
├── error-memory.ts             # 现有，保持
├── reasoning-manager.ts        # 现有，保持
├── preferences-manager.ts      # 现有，保持
├── session-context-manager.ts  # 现有，重构（Phase 4）
├── precipitation-coordinator.ts# 现有，保持
├── experience-analyzer.ts      # 现有，保持
├── skill-generator.ts          # 现有，保持
│
├── search/                     # 🆕 Phase 1
│   ├── index.ts
│   ├── bm25.ts
│   ├── tokenizer.ts
│   └── memory-search.ts
│
├── graph/                      # 🆕 Phase 2
│   ├── types.ts
│   ├── memory-graph.ts
│   └── traversal.ts
│
├── decay/                      # 🆕 Phase 3
│   ├── scorer.ts
│   ├── archiver.ts
│   └── decay-policy.ts
│
└── injection/                  # 🆕 Phase 5
    ├── context-injector.ts
    ├── token-budget.ts
    └── relevance-ranker.ts
```

---

*方案版本: 1.0 | 2026-04-12*
