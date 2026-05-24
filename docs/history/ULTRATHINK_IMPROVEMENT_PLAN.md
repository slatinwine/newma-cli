# Ultrathink 改进计划

## 📊 当前状态分析

### 架构概览
- **总代码量**: 6,131 行（11 个文件）
- **核心组件**:
  - Tree of Thoughts (ToT) 引擎 - 756 行
  - ReAct 循环验证器 - 512 行
  - Multi-Plan 生成器 - 776 行
  - 项目缓存 - 536 行
  - 推理追踪器 - 711 行
  - 上下文管理器 - 435 行

### 测试状态
- **通过率**: 91% (50/55 测试)
- **语句覆盖**: 68.28%
- **分支覆盖**: 49.82% ⚠️
- **关键文件覆盖率**:
  - planner.ts: 91.01% ✅
  - react-loop.ts: 89.53% ✅
  - verifier.ts: 85.48% ✅
  - tree-of-thoughts.ts: 78.4% ✅
  - utils.ts: 23.39% ❌

### 性能特征
| 算法 | 时间 | API 调用 | 用途 |
|------|------|---------|------|
| ToT | 10-30s | 15-30 | 复杂任务深度推理 |
| FFT (Phase 7) | 1-2s | 1-3 | 默认快速规划 |
| ReAct 验证 | 15-30s | 5-10 | 智能验证 |

### 与 Phase 7 的关系
```
任务复杂度识别
    ↓
简单任务 (60%) → FFT (1-2s) → 直接执行
中等任务 (30%) → Landmark (3-5s) → 里程碑规划
复杂任务 (10%) → ToT (10-30s) → 深度推理 [ultrathink=true]
```

## 🎯 改进方向（优先级排序）

---

## 优先级 1: 性能优化 🚀

### 问题
- ToT 需要 10-30 秒，对用户体验影响大
- API 调用次数多（15-30 次），成本高
- 与 FFT 相比，速度慢 60-80%

### 改进方案

#### 1.1 增量缓存机制
**目标**: 减少 50% API 调用

```typescript
// src/ultrathink/incremental-cache.ts (新文件)

export interface IncrementalCacheEntry {
  requirementHash: string;    // 需求哈希
  projectHash: string;        // 项目结构哈希
  thoughtTree: ThoughtTree;   // 缓存的思维树
  actionPlan: ActionPlan;     // 缓存的行动计划
  createdAt: number;
  hitCount: number;
}

export class IncrementalCache {
  private cache: Map<string, IncrementalCacheEntry> = new Map();

  /**
   * 生成缓存键
   */
  private generateKey(requirement: string, projectHash: string): string {
    return crypto.createHash('md5')
      .update(requirement + projectHash)
      .digest('hex');
  }

  /**
   * 查找缓存
   */
  async find(
    requirement: string,
    projectHash: string,
    similarityThreshold: number = 0.85
  ): Promise<IncrementalCacheEntry | null> {
    const exactKey = this.generateKey(requirement, projectHash);
    const exactMatch = this.cache.get(exactKey);

    if (exactMatch) {
      exactMatch.hitCount++;
      return exactMatch;
    }

    // 相似度匹配（使用嵌入向量）
    const similarEntry = await this.findSimilar(requirement, similarityThreshold);
    return similarEntry;
  }

  /**
   * 相似度匹配（使用 AI embeddings）
   */
  private async findSimilar(
    requirement: string,
    threshold: number
  ): Promise<IncrementalCacheEntry | null> {
    // TODO: 实现嵌入向量相似度搜索
    // 1. 生成当前需求的 embedding
    // 2. 与缓存中的 embeddings 计算余弦相似度
    // 3. 返回最相似且超过阈值的缓存项

    return null;
  }

  /**
   * 存储缓存
   */
  async store(
    requirement: string,
    projectHash: string,
    thoughtTree: ThoughtTree,
    actionPlan: ActionPlan
  ): Promise<void> {
    const key = this.generateKey(requirement, projectHash);
    this.cache.set(key, {
      requirementHash: crypto.createHash('md5').update(requirement).digest('hex'),
      projectHash,
      thoughtTree,
      actionPlan,
      createdAt: Date.now(),
      hitCount: 0,
    });
  }

  /**
   * 清理过期缓存（LRU）
   */
  cleanup(maxEntries: number = 100): void {
    if (this.cache.size <= maxEntries) return;

    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].hitCount - b[1].hitCount);

    const toRemove = entries.slice(0, this.cache.size - maxEntries);
    toRemove.forEach(([key]) => this.cache.delete(key));
  }
}
```

**集成到 planner.ts**:
```typescript
export class MultiPlanGenerator {
  private incrementalCache: IncrementalCache;

  constructor(...) {
    // ...
    this.incrementalCache = new IncrementalCache();
  }

  async generateAndSelectPlans(requirement: string, context: string) {
    // 检查缓存
    const projectHash = await this.getProjectHash();
    const cached = await this.incrementalCache.find(requirement, projectHash);

    if (cached) {
      console.log(chalk.green('🎯 [Ultrathink] 使用缓存的计划'));
      return {
        selected: cached.actionPlan,
        rejected: [],
        thoughtTree: cached.thoughtTree,
        reasoning: '来自缓存',
      };
    }

    // 正常生成流程
    const result = await this.generatePlansInternal(requirement, context);

    // 存储缓存
    await this.incrementalCache.store(
      requirement,
      projectHash,
      result.thoughtTree,
      result.selected
    );

    return result;
  }
}
```

**预期效果**:
- 相似需求复用率: 30-40%
- 减少 API 调用: 50%
- 速度提升: 2-3x

---

#### 1.2 并行思维生成
**目标**: 减少等待时间 60%

```typescript
// src/ultrathink/tree-of-thoughts.ts (修改)

export async function runToTSearch(
  config: Config,
  projectInfo: any,
  initialThought: string,
  options: ToTOptions
): Promise<{ tree: ThoughtTree; bestNode: ThoughtNode }> {
  // ...

  // 原有方式（串行）:
  // for (const thought of thoughtsToExpand) {
  //   await expandThought(thought);
  // }

  // 改进方式（并行）:
  const thoughtBatches = chunk(thoughtsToExpand, options.parallelism || 3);

  for (const batch of thoughtBatches) {
    await Promise.all(
      batch.map(thought => expandThought(thought))
    );
  }

  // ...
}
```

**预期效果**:
- 3x 并行度 → 减少 60% 等待时间
- 10-30s → 4-12s

---

#### 1.3 智能搜索深度调整
**目标**: 根据任务复杂度动态调整深度

```typescript
// src/ultrathink/adaptive-depth.ts (新文件)

export interface ComplexityAnalysis {
  taskComplexity: 'simple' | 'medium' | 'complex';
  recommendedDepth: number;
  recommendedAlternatives: number;
  reasoning: string;
}

export function analyzeComplexity(requirement: string): ComplexityAnalysis {
  const keywords = {
    simple: ['添加', '创建', '修改', 'fix', 'add', 'create'],
    medium: ['重构', '优化', '集成', 'refactor', 'optimize', 'integrate'],
    complex: ['架构', '迁移', '系统', 'architecture', 'migration', 'system'],
  };

  const scores = {
    simple: 0,
    medium: 0,
    complex: 0,
  };

  for (const [category, words] of Object.entries(keywords)) {
    for (const word of words) {
      if (requirement.includes(word)) {
        scores[category as keyof typeof scores]++;
      }
    }
  }

  if (scores.complex > 0) {
    return {
      taskComplexity: 'complex',
      recommendedDepth: 5,
      recommendedAlternatives: 5,
      reasoning: '检测到复杂架构级任务',
    };
  } else if (scores.medium > 0) {
    return {
      taskComplexity: 'medium',
      recommendedDepth: 3,
      recommendedAlternatives: 3,
      reasoning: '检测到中等复杂度重构任务',
    };
  } else {
    return {
      taskComplexity: 'simple',
      recommendedDepth: 2,
      recommendedAlternatives: 2,
      reasoning: '简单任务，快速处理',
    };
  }
}
```

**集成**:
```typescript
// src/ultrathink/planner.ts
async generateAndSelectPlans(requirement: string, context: string) {
  // 分析复杂度
  const analysis = analyzeComplexity(requirement);

  console.log(chalk.gray(`⏱️  [Ultrathink] 任务复杂度: ${analysis.taskComplexity}`));
  console.log(chalk.gray(`⏱️  [Ultrathink] 推荐深度: ${analysis.recommendedDepth}`));

  // 使用动态参数
  const result = await this.generatePlansInternal(requirement, context, {
    maxDepth: analysis.recommendedDepth,      // 动态调整
    numAlternatives: analysis.recommendedAlternatives,
  });

  return result;
}
```

**预期效果**:
- 简单任务: 3-5s (2x 速度)
- 中等任务: 8-15s (1.5x 速度)
- 复杂任务: 保持深度 (质量优先)

---

## 优先级 2: 测试覆盖提升 🧪

### 问题
- utils.ts 只有 23.39% 覆盖率
- 分支覆盖率 49.82% → 边界情况未测试
- 5 个失败测试

### 改进方案

#### 2.1 补全 utils.ts 测试
```typescript
// test-ultrathink/utils.test.ts (新文件)

describe('Ultrathink Utils', () => {
  describe('formatThoughtTree', () => {
    it('should format simple tree correctly', () => {
      const tree = createMockTree();
      const formatted = formatThoughtTree(tree);
      expect(formatted).toContain('Root');
      expect(formatted).toContain('├─');
    });

    it('should handle empty tree', () => {
      const formatted = formatThoughtTree(null);
      expect(formatted).toBe('Empty tree');
    });
  });

  describe('extractActionDescription', () => {
    it('should extract create action', () => {
      const action = { type: 'create', path: '/test', content: 'foo' };
      const desc = extractActionDescription(action);
      expect(desc).toContain('create');
      expect(desc).toContain('/test');
    });

    it('should handle unknown action type', () => {
      const action = { type: 'unknown' } as any;
      const desc = extractActionDescription(action);
      expect(desc).toContain('unknown');
    });
  });

  // ... 更多测试
});
```

**目标**: utils.ts 从 23.39% → 80%+

---

#### 2.2 修复失败测试
```typescript
// test-ultrathink/verifier.test.ts (修复)

describe('ReAct Verifier - Observation Statistics', () => {
  it('should correctly count observation types', async () => {
    const mockRecords = createMockExecutionRecords([
      { type: 'create', success: true },
      { type: 'modify', success: false },
      { type: 'run', success: true },
    ]);

    const stats = await buildObservationStatistics(mockRecords);

    expect(stats.totalActions).toBe(3);
    expect(stats.successfulActions).toBe(2);
    expect(stats.failedActions).toBe(1);
  });
});
```

**目标**: 测试通过率 91% → 100%

---

## 优先级 3: 与 FFT 智能集成 🤖

### 问题
- ToT 和 FFT 是分离的系统
- 没有自动选择机制
- 用户需要手动启用 ultrathink

### 改进方案

#### 3.1 三层自动选择
```typescript
// src/ultrathink/hybrid-planner.ts (新文件)

export async function hybridPlan(
  requirement: string,
  context: string,
  config: Config
): Promise<ActionPlan> {
  // 第 1 层: FFT 快速判断 (60-70% 任务)
  const fftResult = await fftAnalyze(requirement);
  if (fftResult.confidence > 0.8 && fftResult.complexity === 'low') {
    console.log(chalk.green('⚡ [Hybrid] 使用 FFT 快速规划'));
    return fftResult.plan;
  }

  // 第 2 层: Landmark Counting (20-30% 任务)
  const landmarkResult = await landmarkPlan(requirement, context);
  if (landmarkResult.confidence > 0.7) {
    console.log(chalk.yellow('📍 [Hybrid] 使用 Landmark 里程碑规划'));
    return landmarkResult.plan;
  }

  // 第 3 层: ToT 深度推理 (10% 任务)
  console.log(chalk.red('🌳 [Hybrid] 使用 ToT 深度推理'));
  const totResult = await totPlan(requirement, context, config);
  return totResult.plan;
}
```

**预期效果**:
- 60-70% 任务使用 FFT（1-2s）
- 20-30% 任务使用 Landmark（3-5s）
- 10% 任务使用 ToT（10-30s）
- 平均响应时间: 2-5s（比单独 ToT 快 3-5x）

---

#### 3.2 ToT 结果用于训练 FFT
```typescript
// src/ultrathink/learning-bridge.ts (新文件)

export class LearningBridge {
  /**
   * 从 ToT 思维树中提取模式
   */
  async extractPatterns(thoughtTree: ThoughtTree): Promise<ThoughtPattern[]> {
    const patterns: ThoughtPattern[] = [];

    // 遍历思维树，提取成功的推理路径
    for (const node of thoughtTree.nodes.values()) {
      if (node.state === ThoughtState.SOLVED) {
        const pattern = await this.extractPatternFromPath(node);
        if (pattern) {
          patterns.push(pattern);
        }
      }
    }

    return patterns;
  }

  /**
   * 将模式转化为 FFT 决策树
   */
  async convertToFFTPatterns(patterns: ThoughtPattern[]): Promise<FFTPattern[]> {
    return patterns.map(p => ({
      trigger: p.trigger,
      action: p.thoughtTemplate,
      confidence: p.successRate,
    }));
  }

  /**
   * 更新 FFT 决策树
   */
  async updateFFTKnowledge(patterns: ThoughtPattern[]): Promise<void> {
    const fftPatterns = await this.convertToFFTPatterns(patterns);
    // 调用 FFT 的知识更新接口
    await fftEngine.addPatterns(fftPatterns);

    console.log(chalk.green(`🧠 [Learning] 从 ToT 学习了 ${patterns.length} 个模式`));
  }
}
```

**预期效果**:
- FFT 从 ToT 学习复杂决策模式
- 逐步提高 FFT 的准确率和覆盖率
- 最终 FFT 能处理更多任务，减少 ToT 调用

---

## 优先级 4: 用户体验改进 🎨

### 问题
- ToT 输出过于技术化
- 用户看不懂思维树
- 没有进度指示

### 改进方案

#### 4.1 简化输出
```typescript
// src/ultrathink/user-friendly-output.ts (新文件)

export function formatToTResultForUser(result: ToTResult): string {
  const lines: string[] = [];

  lines.push(chalk.bold('📋 智能规划结果\n'));

  // 选定的计划
  lines.push(chalk.cyan('✅ 推荐方案:'));
  lines.push(`  ${result.selected.reasoning}`);
  lines.push(`  预计时间: ${formatTime(result.selected.estimatedTime)}`);
  lines.push(`  包含 ${result.selected.actions.length} 个步骤\n`);

  // 替代方案（如果启用）
  if (options.showRejected && result.rejected.length > 0) {
    lines.push(chalk.gray('其他考虑过的方案:'));
    result.rejected.forEach((plan, i) => {
      lines.push(chalk.gray(`  ${i + 1}. ${plan.reasoning}`));
    });
  }

  // 可视化进度条
  lines.push(chalk.bold('\n⏳ 推理过程:'));
  lines.push(formatProgressBar(result.thoughtTree.metadata.evaluatedNodes));

  return lines.join('\n');
}

function formatProgressBar(evaluated: number): string {
  const total = 20; // 假设最多 20 个节点
  const filled = Math.min(evaluated, total);
  const bar = '█'.repeat(filled) + '░'.repeat(total - filled);
  return chalk.cyan(`  [${bar}] ${evaluated} 个思维节点评估完成`);
}
```

**输出示例**:
```
📋 智能规划结果

✅ 推荐方案:
  创建用户认证系统，使用 JWT + OAuth2
  预计时间: 约 15 秒
  包含 8 个步骤

⏳ 推理过程:
  [███████████░░░░░░░░░] 11 个思维节点评估完成
```

---

#### 4.2 实时进度指示
```typescript
// src/ultrathink/progress-tracker.ts (新文件)

import * as ora from 'ora';

export class ToTProgressTracker {
  private spinner: ora.Ora;
  private currentStep: number;
  private totalSteps: number;

  constructor() {
    this.spinner = ora();
    this.currentStep = 0;
    this.totalSteps = 0;
  }

  /**
   * 开始进度跟踪
   */
  start(totalSteps: number, message: string) {
    this.totalSteps = totalSteps;
    this.currentStep = 0;
    this.spinner.start(message);
  }

  /**
   * 更新进度
   */
  update(message: string) {
    this.currentStep++;
    const progress = Math.floor((this.currentStep / this.totalSteps) * 100);
    this.spinner.text = `${message} (${progress}%)`;
  }

  /**
   * 完成进度
   */
  succeed(message: string) {
    this.spinner.succeed(message);
  }

  /**
   * 失败
   */
  fail(message: string) {
    this.spinner.fail(message);
  }
}
```

**使用示例**:
```typescript
const progress = new ToTProgressTracker();
progress.start(5, '🤔 分析需求...');

// 思维生成
progress.update('💡 生成 5 个思维路径');

// 思维评估
progress.update('🔍 评估思维路径质量');

// 计划生成
progress.update('📋 生成行动计划');

// 计划选择
progress.update('✅ 选择最佳计划');

progress.succeed('✨ 规划完成！');
```

---

## 📊 实施路线图

### 第一阶段 (1-2 周): 性能优化
- [ ] 实现增量缓存机制
- [ ] 并行思维生成
- [ ] 智能搜索深度调整
- **目标**: ToT 速度提升 2-3x

### 第二阶段 (1 周): 测试覆盖
- [ ] 补全 utils.ts 测试
- [ ] 修复 5 个失败测试
- [ ] 提高分支覆盖率到 70%+
- **目标**: 测试通过率 100%

### 第三阶段 (1-2 周): 智能集成
- [ ] 实现三层自动选择
- [ ] ToT → FFT 学习桥接
- [ ] 自动模式切换
- **目标**: 平均响应时间 2-5s

### 第四阶段 (1 周): 用户体验
- [ ] 简化输出格式
- [ ] 实时进度指示
- [ ] 可视化思维树（可选）
- **目标**: 用户满意度提升

---

## 🎯 最终目标

### 性能指标
| 指标 | 当前 | 目标 | 提升 |
|------|------|------|------|
| 简单任务速度 | N/A | 1-2s | - |
| 中等任务速度 | N/A | 3-5s | - |
| 复杂任务速度 | 10-30s | 10-20s | 33% |
| 平均 API 调用 | 15-30 | 5-10 | 50% |
| 缓存命中率 | 0% | 30-40% | - |

### 质量指标
| 指标 | 当前 | 目标 | 提升 |
|------|------|------|------|
| 测试通过率 | 91% | 100% | +9% |
| 语句覆盖 | 68.28% | 85% | +16.7% |
| 分支覆盖 | 49.82% | 70% | +20.2% |
| 用户体验 | 技术化 | 友好 | 主观 |

### 智能化指标
- FFT 准确率: 85% → 90%（从 ToT 学习）
- ToT 调用频率: 10% → 5%（更多任务被 FFT 处理）
- 平均响应时间: N/A → 2-5s（三层选择）

---

## 🤔 需要讨论的问题

1. **优先级确认**: 这四个优先级是否符合你的期望？
2. **实施方式**: 一次性全部实施 vs. 分阶段逐步实施？
3. **向后兼容**: 是否需要保持现有 API 不变？
4. **测试策略**: 是否需要添加性能基准测试？
5. **用户反馈**: 是否需要先收集真实用户的使用反馈？

---

**建议下一步**: 从**优先级 1（性能优化）**开始，因为影响最大且风险最低。具体先实现**增量缓存机制**，可以快速看到效果。

你觉得这个改进计划如何？有什么想法或调整吗？
