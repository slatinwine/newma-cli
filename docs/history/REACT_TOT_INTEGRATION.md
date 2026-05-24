# ReAct + ToT Integration Guide

## 概述

Newma (牛码) v3.0.0 集成了两大 AI 推理技术：

1. **Tree of Thoughts (ToT)** - 多路径规划系统，用于生成和评估多个行动方案
2. **ReAct (Reasoning + Acting)** - 智能验证系统，通过 Think-Act-Observe 循环自我修正

这两者结合形成了一个强大的 AI 驱动开发助手，能够：
- 🌳 探索多种解决方案并选择最佳方案
- 🔄 自动验证需求是否满足
- 🔧 智能检测和修复错误
- 📊 提供完整的推理和执行轨迹

---

## 架构

### 系统流程

```
用户需求
    │
    ├─→ [规划模式] → ToT 多方案生成
    │                  ├─ 生成 5 个候选方案
    │                  ├─ 使用 BFS/DFS/Beam 搜索
    │                  ├─ AI 评估每个方案
    │                  └─ 选择最佳方案
    │                      │
    │                      ▼
    │                  用户确认
    │                      │
    │                      ▼
    │                  执行 Actions
    │                      │
    └─→ [验证模式] ←────────┘
              │
              ├─→ 预执行 ReAct 验证 (检查历史)
              │       ├─ 构建观察 (execution history)
              │       ├─ Think: 分析是否满足需求
              │       ├─ Act: 决定是否需要更多 actions
              │       └─ Observe: 更新状态
              │           │
              │           ├─ 满足 → 完成 ✅
              │           └─ 未满足 → 继续执行
              │
              ├─→ 阶段1: 快速检查 (syntax, lint, tests, build)
              │       │
              │       ├─ 通过 → 阶段2
              │       └─ 失败 → 跳过 AI 验证
              │
              └─→ 阶段2: ReAct 深度验证
                      ├─ 运行 ReAct 循环 (最多 5 次)
                      ├─ 每个 iteration:
                      │   ├─ Think: 分析当前状态
                      │   ├─ Act: 执行验证命令
                      │   └─ Observe: 记录结果
                      └─ 自我修正或确认完成
```

### 模块架构

```
┌─────────────────────────────────────────────┐
│              REPL Interface                 │
│         (src/repl.ts - REPLManager)         │
└──────────────┬──────────────────────────────┘
               │
     ┌─────────┴──────────┐
     │                    │
     ▼                    ▼
┌──────────────┐   ┌─────────────────┐
│ AI Module    │   │ Session Manager │
│ (src/ai.ts)  │   │ (src/session.ts) │
└──────┬───────┘   └─────────────────┘
       │
       ├─→ ToT Planner (src/ultrathink/planner.ts)
       │   └─→ MultiPlanGenerator
       │       ├─→ generateInitialThought()
       │       ├─→ runToTSearch() (tree-of-thoughts.ts)
       │       ├─→ generatePlansFromThoughts()
       │       ├─→ evaluatePlans()
       │       └─→ generateAndSelectPlans()
       │
       └─→ ReAct Verifier (src/ultrathink/verifier.ts)
           └─→ ReActVerifier
               ├─→ verifyWithReAct()
               ├─→ buildObservationFromHistory()
               ├─→ runReActLoop() (react-loop.ts)
               └─→ autoFix()
```

---

## 使用方式

### 1. 基本使用

```bash
# 标准模式（无 ultrathink）
npx newma-cli "Add authentication system"

# 启用 ToT 规划
npx newma-cli --ultrathink "Add authentication system"

# 启用 ToT + ReAct 验证
npx newma-cli --ultrathink --verify "Add authentication system"
```

### 2. 交互式模式

```bash
# 启动 REPL
npx newma-cli -i

# 在 REPL 中
> /mode plan
> /set ultrathink true
> Add user login feature

# 自动切换到验证模式后
> /mode verify
> /set verify true
# 系统会自动验证需求是否满足
```

### 3. 配置选项

#### ToT 规划选项

```typescript
interface UltrathinkOptions {
  enabled?: boolean;              // 启用 ToT (默认: false)
  numAlternatives?: number;       // 生成方案数量 (默认: 5)
  searchStrategy?: 'bfs' | 'dfs' | 'beam';  // 搜索策略 (默认: 'bfs')
  maxDepth?: number;              // 最大深度 (默认: 4)
  beamWidth?: number;             // Beam 宽度 (默认: 3)
  showThoughts?: boolean;         // 显示思维树 (默认: false)
  showRejected?: boolean;         // 显示被拒方案 (默认: false)
}
```

#### ReAct 验证选项

```typescript
// 验证模式配置
const verifyOptions = {
  maxIterations: 5,               // 最大 ReAct 迭代次数
  initialObservation?: string;    // 初始观察状态
  onStep?: (step: ReActStep) => void;  // 步骤回调
};
```

---

## 工作流程详解

### ToT 规划流程

1. **初始思考生成** (`generateInitialThought`)
   ```
   输入: 需求 + 项目上下文
   输出: 高层次策略思考
   ```

2. **思维树搜索** (`runToTSearch`)
   ```
   策略: BFS (广度优先) / DFS (深度优先) / Beam (束搜索)

   思维树结构:
   - Root Thought (初始策略)
     ├─ Thought 1.1 (分支1)
     │   ├─ Thought 1.1.1
     │   └─ Thought 1.1.2
     └─ Thought 1.2 (分支2)
         └─ ...

   评估: AI 给每个 thought 打分 (0.0 - 1.0)
   选择: 保留高分 thoughts，剪枝低分
   ```

3. **方案生成** (`generatePlansFromThoughts`)
   ```
   每个 top thought → 具体行动方案

   方案格式:
   {
     reasoning: "为什么选择这个方法",
     actions: [
       {type: "create_file", path: "...", content: "..."},
       {type: "modify_file", path: "...", ...},
       {type: "execute_command", command: "..."}
     ],
     estimatedTime: 5000,
     riskLevel: "low" | "medium" | "high"
   }
   ```

4. **方案评估** (`evaluatePlans`)
   ```
   评估标准:
   - Quality: 需求满足程度
   - Efficiency: 是否最高效
   - Risk: 潜在问题
   - Completeness: 是否完整

   输出: 按得分排序的方案列表
   ```

5. **方案选择** (`generateAndSelectPlans`)
   ```
   选择: 得分最高的方案
   拒绝: 其他方案作为备选
   返回: PlanAlternatives {
     selected: ActionPlan,
     rejected: ActionPlan[],
     selectionReason: string,
     comparison: {...}
   }
   ```

### ReAct 验证流程

#### 预执行验证 (Pre-execution Check)

```
执行前检查: 历史记录是否已满足需求

if (previousHistory.length > 0) {
  运行 ReAct (3 iterations, 快速检查)

  if (satisfied) {
    跳过执行，直接完成 ✅
  } else {
    继续执行新 actions
  }
}
```

#### 执行后验证 (Post-execution Verification)

**阶段1: 快速检查**
```typescript
// 自动检测项目类型
stages = autoDetectStages(projectRoot)

// 运行快速检查
for (stage in stages) {
  if (stage == 'syntax')   运行 TypeScript 检查
  if (stage == 'lint')     运行 ESLint
  if (stage == 'tests')    运行 npm test
  if (stage == 'build')    运行 npm run build
}

if (all passed) → 进入阶段2
else → 跳过 AI 验证
```

**阶段2: ReAct 深度验证**
```typescript
运行 ReAct 循环 (最多 5 iterations)

每次 iteration:
  1. Think: AI 分析当前状态
     "当前状态: 文件已创建，测试通过。需求: 认证系统。
      评估: 需要登录页面和 API"

  2. Act: 执行验证操作
     {type: "verify", command: "npm test"}
     或
     {type: "satisfy"}  // 表示已满足

  3. Observe: 记录结果
     "测试通过: ✅"

重复直到:
  - satisfied = true (完成)
  - maxSteps = 5 (未完成但停止)
  - 检测到可修复的错误
```

---

## 完整示例

### 示例1: 简单任务（无 ToT）

```bash
# 不使用 ultrathink
npx newma-cli "Create a hello world function"
```

**流程**:
1. AI 生成 TODO 和 actions
2. 用户确认
3. 执行 actions
4. 运行快速检查（如果 --verify）
5. 完成

### 示例2: 复杂任务（使用 ToT）

```bash
npx newma-cli --ultrathink "Add JWT authentication system"
```

**流程**:
1. **ToT 规划阶段**:
   ```
   🧠 Ultrathink enabled: Using Tree of Thoughts...

   Generating 5 alternative approaches...
   ├─ Approach 1: Use passport-jwt (score: 0.85)
   ├─ Approach 2: Custom JWT middleware (score: 0.72)
   ├─ Approach 3: Firebase Auth (score: 0.68)
   ├─ Approach 4: Auth0 SDK (score: 0.65)
   └─ Approach 5: NextAuth.js (score: 0.61)

   Selected: Approach 1 - passport-jwt
   Reasoning: Best balance of security and simplicity
   ```

2. **执行阶段**:
   ```
   ⚡ Action Plan:
   1. Create auth/jwt.strategy.ts
   2. Create auth/auth.controller.ts
   3. Modify app.ts to add auth routes
   4. Create middleware/auth.middleware.ts

   Execute? (Y/n) > Y
   ```

3. **验证阶段** (如果 --verify):
   ```
   🔍 Stage 1: Quick checks
   ✅ Syntax: TypeScript compilation passed
   ✅ Lint: ESLint passed
   ✅ Tests: 5/5 tests passing
   ✅ Build: Build successful

   🔍 Stage 2: AI-powered ReAct verification

   Step 1: Analyzing authentication system
   💭 Thought: Check if JWT middleware is properly integrated
   ⚡ Action: Verify - npm test
   👁️  Observation: All tests passing, auth routes working

   Step 2: Verifying security measures
   💭 Thought: Verify token validation and error handling
   ⚡ Action: Satisfied
   👁️  Observation: Authentication system complete

   ✅ Stage 2 passed!
   Reasoning: JWT authentication working correctly with proper security
   ```

### 示例3: 迭代改进（ReAct 自我修正）

```bash
npx newma-cli -i
> /set ultrathink true
> /set verify true
> Add user profile page
```

**第1轮**:
```
🎯 Processing: Add user profile page

[执行 actions...]

🔍 Stage 1: Quick checks
❌ Tests: 2/5 tests failing
⚠️  Stage 1 failed

Stage 2 skipped due to Stage 1 failure
```

**第2轮** (自动切换到 verify 模式):
```
> /mode verify
🔄 Current Mode: VERIFY

🎯 Processing: Add user profile page

🔍 Pre-execution ReAct verification...

Step 1: Analyzing test failures
💭 Thought: Tests failing due to missing component props
⚡ Action: Generate fix
👁️  Observation: Need to add userId prop to UserProfile

[自动修复...]

Step 2: Verifying fix
💭 Thought: Re-run tests to confirm fix
⚡ Action: Verify - npm test
👁️  Observation: 5/5 tests passing ✅

✅ Requirement satisfied!
```

---

## 高级功能

### 1. 思维树可视化

启用 `showThoughts` 查看完整的 ToT 推理过程：

```bash
npx newma-cli --ultrathink --show-thoughts "Refactor API architecture"
```

输出:
```
🌳 Tree of Thoughts Visualization
══════════════════════════════════

Root: Restructure API with layered architecture
├─ ✅ Thought 1.1 (score: 0.85)
│  └─ Use controller-service-repository pattern
│     ├─ Thought 1.1.1 (score: 0.92)
│     │  └─ Separate business logic from routes ✅ SELECTED
│     └─ Thought 1.1.2 (score: 0.78)
│        └─ Use dependency injection
└─ ❌ Thought 1.2 (score: 0.62)
   └─ Microservices architecture (PRUNED - too complex)

Statistics:
- Total nodes: 15
- Evaluated: 15
- Pruned: 5
- Best score: 0.92
- Search time: 2.3s
```

### 2. 方案对比

启用 `showRejected` 查看被拒绝的方案：

```bash
npx newma-cli --ultrathink --show-rejected "Implement caching"
```

输出:
```
📊 Plan Comparison
════════════════════════════════════

✅ SELECTED PLAN: Redis Caching
- Confidence: 0.89
- Estimated Time: 4000ms
- Risk: low
- Reasoning: Best performance, industry standard

❌ REJECTED PLANS:

1. In-Memory Cache
   - Confidence: 0.72
   - Risk: medium
   - Rejection: Doesn't scale across instances

2. Memcached
   - Confidence: 0.68
   - Risk: low
   - Rejection: Less feature-rich than Redis

3. CDN Caching
   - Confidence: 0.65
   - Risk: high
   - Rejection: Not suitable for dynamic data
```

### 3. ReAct 轨迹

查看 ReAct 验证的完整推理过程：

```bash
npx newma-cli --ultrathink --verify "Add rate limiting"
```

输出:
```
🔄 ReAct Execution Trace
════════════════════════════════════════

Step 1:
  💭 Thought: Need to verify rate limiting middleware is properly configured
  ⚡ Action: Verify - npm run test:rate-limit
  👁️  Observation: Rate limiting tests passing (100 req/min)
  ⏱️  Time: 245ms

Step 2:
  💭 Thought: Check if rate limits are enforced correctly
  ⚡ Action: Verify - npm run test:load
  👁️  Observation: Load test shows proper rate limiting ✅
  ⏱️  Time: 1832ms

Step 3:
  💭 Thought: Verify error handling for rate limit exceeded
  ⚡ Action: Satisfied
  👁️  Observation: All requirements met, proper error responses
  ⏱️  Time: 0ms

Final Reasoning:
Rate limiting successfully implemented with:
- Proper middleware integration
- Correct rate limit enforcement
- Appropriate error handling
- Test coverage 100%

✅ Verification Complete
```

---

## 性能和成本

### 时间成本

| 模式 | 单次执行 | ToT 规划 | ReAct 验证 | 总计 |
|------|---------|---------|-----------|------|
| 标准模式 | ~10s | 0s | 0s | ~10s |
| ToT 模式 | ~10s | 15-30s | 0s | ~25-40s |
| 完整模式 | ~10s | 15-30s | 10-30s | ~35-70s |

### API 成本 (以 GPT-4o-mini 为例)

| 操作 | Tokens | 成本 |
|------|--------|------|
| 初始思考 | ~500 | $0.0001 |
| ToT 搜索 (5 thoughts × 3 depth) | ~7500 | $0.0015 |
| 方案生成 (5 plans) | ~5000 | $0.001 |
| 方案评估 | ~1000 | $0.0002 |
| ReAct 循环 (平均 3 steps) | ~3000 | $0.0006 |
| **总计** | **~17k** | **~$0.0034** |

**优化建议**:
- 使用 GPT-4o-mini (成本最低，速度最快)
- 简单任务禁用 ToT (`--no-ultrathink`)
- 减少方案数量: `--num-alternatives 3`
- 减少 ReAct 迭代: 预执行用 3 次，深度验证用 5 次

---

## 最佳实践

### 1. 何时使用 ToT

✅ **推荐使用**:
- 复杂的架构决策
- 多种实现方案
- 需要权衡利弊
- 不确定最佳路径

❌ **不推荐使用**:
- 简单的文件创建
- 明确的修改任务
- 快速原型开发
- 成本敏感场景

### 2. 何时使用 ReAct 验证

✅ **推荐使用**:
- 生产代码部署
- 安全相关功能
- 复杂业务逻辑
- 需要高质量保证

❌ **不推荐使用**:
- 开发阶段原型
- 测试代码本身
- 文档更新
- 快速迭代

### 3. 配置建议

**快速开发**:
```bash
npx newma-cli "Quick feature"
# 无 ToT, 无验证
```

**标准开发**:
```bash
npx newma-cli --ultrathink "Feature with options"
# ToT 规划, 无验证
```

**生产就绪**:
```bash
npx newma-cli --ultrathink --verify "Critical feature"
# ToT + 完整验证
```

**高可靠性**:
```bash
npx newma-cli -i
> /set ultrathink true
> /set verify true
> /set num-alternatives 7
> Critical system
# 最大化方案探索 + 验证
```

---

## 故障排除

### 问题1: ToT 生成时间过长

**症状**: ToT 规划超过 30 秒

**解决方案**:
```bash
# 减少方案数量
npx newma-cli --ultrathink --num-alternatives 3 "Task"

# 使用更快的搜索策略
npx newma-cli --ultrathink --search-strategy beam "Task"

# 降低搜索深度
npx newma-cli --ultrathink --max-depth 3 "Task"
```

### 问题2: ReAct 验证失败

**症状**: ReAct 报告 "not satisfied" 但看起来已完成

**解决方案**:
```bash
# 手动检查
> /mode verify
> /status  # 查看当前状态

# 增加迭代次数
npx newma-cli --verify --max-iterations 7 "Task"

# 提供更明确的需求
npx newma-cli "Task with specific acceptance criteria"
```

### 问题3: 方案质量不高

**症状**: ToT 生成的方案不理想

**解决方案**:
```bash
# 增加方案数量
npx newma-cli --ultrathink --num-alternatives 7 "Task"

# 查看所有方案
npx newma-cli --ultrathink --show-rejected "Task"

# 使用更彻底的搜索
npx newma-cli --ultrathink --search-strategy dfs "Task"
```

---

## 扩展和定制

### 添加自定义搜索策略

```typescript
// src/ultrathink/tree-of-thoughts.ts

export async function customSearch(
  config: Config,
  projectInfo: any,
  requirement: string,
  initialThought: string,
  maxDepth: number
): Promise<ThoughtTree> {
  // 实现自定义搜索逻辑
  // 例如: A*, Monte Carlo Tree Search, etc.
}
```

### 自定义 ReAct 行为

```typescript
// src/ultrathink/react-loop.ts

export class CustomReActAgent extends ReActAgent {
  protected async think(
    requirement: string,
    observation: string
  ): Promise<string> {
    // 自定义思考过程
    // 例如: 添加领域知识、使用工具等
  }

  protected async act(
    thought: string
  ): Promise<ReActAction> {
    // 自定义行动决策
    // 例如: 集成外部工具、API 等
  }
}
```

### 添加新的验证阶段

```typescript
// src/verifier.ts

export const customStage: VerificationStage = {
  name: 'Custom Check',
  required: false,
  check: async (root: string) => {
    // 自定义验证逻辑
    // 例如: 安全扫描、性能测试等
    return { passed: true, message: 'Custom check passed' };
  },
};

verifier.addStage(customStage);
```

---

## 总结

ReAct 和 ToT 的集成使 Newma (牛码) 从一个简单的 AI 助手转变为一个智能的开发伙伴：

- **智能规划**: ToT 探索多种方案，选择最优解
- **自动验证**: ReAct 循环确保质量，自我修正
- **透明推理**: 完整的思维和执行轨迹
- **灵活配置**: 根据需求调整推理深度

**推荐工作流**:

```bash
# 1. 快速原型
npx newma-cli "Prototype feature"

# 2. 正式实现
npx newma-cli --ultrathink "Implement feature properly"

# 3. 生产验证
npx newma-cli --ultrathink --verify "Deploy to production"
```

---

**版本**: 3.0.0
**最后更新**: 2026-01-17
**维护者**: Newma (牛码) Development Team
