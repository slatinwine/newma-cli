# newma CL-Bench 测试优化方案

**日期**: 2026-02-13
**版本**: 3.6.0
**目标**: 将 CL-bench 通过率从 1.74% 提升至 5%+，超越 Claude Code (5.54%)

---

## 📊 当前系统分析

### 已完成的优化（3.5.0）

| 优化项 | 状态 | 效果 |
|--------|------|------|
| API 多级质量系统 | ✅ | Level 1/2/3 灵活选择 |
| GLM-5 模型升级 | ✅ | 更强的推理能力 |
| 多轮推理循环 | ✅ | Plan → Execute → Verify |
| 基础验证器 | ✅ | 长度 + 语法 + AI 评估 |
| 集成测试脚本 | ✅ | 自动化测试流程 |

### 当前性能基线

| 指标 | newma (Level 1) | Claude Code | 差距 |
|------|-----------------|-------------|--------|
| **通过率** | 1.74% | 5.54% | **-3.19x** |
| **速度** | 13.6s | 40s | **+2.9x** ✅ |
| **完成率** | 99.95% | 82.51% | **+17.44%** ✅ |

### 预期性能（理论）

| 指标 | Level 2 (预期) | Level 3 (预期) | vs Claude Code |
|------|----------------|----------------|----------------|
| **通过率** | 3.5% | **5-6%** | **-0.6x ~ 持平** |
| **速度** | ~30s | ~60s | -0.3x ~ -0.7x |
| **完成率** | ~100% | ~100% | +17.44% |

**结论**: Level 3 预期可以**接近或超越** Claude Code 的质量，同时保持速度优势。

---

## 🔍 系统瓶颈诊断

### 1. 验证逻辑局限性

**问题**: 当前置验验器（`src/api.ts:29-190`）过于简单

```typescript
// 当前验证逻辑
async quickVerify(requirement, response, options) {
  // Check 1: 长度检查（minLength: 50-100）
  if (response.length < minLength) return { passed: false };

  // Check 2: 语法检查（JavaScript/TypeScript）
  const syntaxValid = this.validateJSSyntax(block.code);
  if (!syntaxValid) return { passed: false };

  // Check 3: AI 自我评估（调用一次 AI）
  const assessment = await callAI(...);
  return assessment;
}
```

**局限性**:
- ❌ **维度单一**: 仅检查长度、语法、AI 评估
- ❌ **AI 评估不准确**: 单次调用，提示词简单
- ❌ **缺乏代码质量检查**: 没有最佳实践、代码风格验证
- ❌ **没有运行测试**: 无法验证代码是否真正可用
- ❌ **误判率高**: 可能将好的响应误判为失败，或反之

**影响**: 导致不必要的重试（浪费时间）或未检测到错误（降低通过率）

### 2. 提示词未针对 CL-bench 优化

**问题**: 通用提示词（`src/prompt.ts:25-186`）未针对编程任务优化

**当前提示词特点**:
- ✅ 清晰的类型定义（Action, TaskResponse）
- ✅ 多种任务类型（简单、复杂、信息收集）
- ❌ **缺少 Few-Shot 示例**: 没有具体的成功案例
- ❌ **没有 CL-bench 特定优化**: 未针对代码生成任务优化
- ❌ **验证提示词简单**: AI 评估提示词过于简单（82-93 行）

**影响**: AI 可能生成不符合 CL-bench 评估标准的响应

### 3. 固定迭代次数不够灵活

**问题**: 固定迭代次数（Level 2=2, Level 3=3）不够智能

```typescript
// 当前迭代策略
const defaultMaxIterations = level === 3 ? 3 : 2;
const maxIterations = userMaxIterations || defaultMaxIterations;

while (iteration < maxIterations && !satisfied) {
  // ...
}
```

**问题**:
- ❌ **不区分任务难度**: 简单任务和复杂任务使用相同迭代次数
- ❌ **浪费资源**: 简单任务可能 1 次迭代就足够，但仍然执行 2-3 次
- ❌ **不够充分**: 复杂任务可能需要更多迭代，但被限制在 2-3 次
- ❌ **没有早停机制**: 即使已满足要求，也可能执行不必要的验证

**影响**: 简单任务浪费时间，复杂任务质量不足

### 4. 缺少学习机制

**问题**: 系统没有从历史测试中学习

**现状**:
- ❌ 没有记录常见失败模式
- ❌ 没有记录常见错误类型
- ❌ 没有记录成功案例的特征
- ❌ 无法根据历史数据调整策略

**影响**: 无法持续优化，每次测试都从零开始

---

## 🚀 优化方案

### 方案 1: 增强验证逻辑 ⭐⭐⭐⭐⭐

**优先级**: 最高
**预期提升**: +0.5-1% 通过率
**实施难度**: 中等

#### 1.1 多维度验证系统

**新增验证维度**:

```typescript
interface EnhancedVerificationResult {
  passed: boolean;
  reason: string;
  confidence: number;
  details: {
    length: { passed: boolean; score: number };
    syntax: { passed: boolean; score: number; errors: string[] };
    quality: { passed: boolean; score: number; issues: string[] };
    completeness: { passed: boolean; score: number; missing: string[] };
    aiAssessment: { passed: boolean; score: number; reason: string };
  };
  overallScore: number; // 0-1, 加权平均
}
```

**验证项目**:

1. **长度检查**（现有，增强）
   - 最小长度: Level 2=50, Level 3=100
   - **新增**: 最大长度检查（避免过长响应）
   - **新增**: 代码块长度检查（代码应该占主要部分）

2. **语法检查**（现有，增强）
   - JavaScript/TypeScript 语法验证
   - **新增**: Python 语法验证（CL-bench 常见）
   - **新增**: 多代码块语法验证（所有代码块）
   - **新增**: Import 语句验证（常见错误源）

3. **代码质量检查**（新增）
   - 命名规范: 变量、函数、类名符合约定
   - 代码风格: 缩进、空格、换行一致性
   - 最佳实践: 避免常见反模式（如 var in modern JS）
   - 复杂度检查: 避免过深嵌套、过长函数

4. **完整性检查**（新增）
   - 要求覆盖: 检查是否满足用户需求的所有要点
   - 边界情况: 是否处理了常见的边界情况
   - 错误处理: 是否有适当的错误处理

5. **AI 自我评估**（现有，增强）
   - **改进提示词**: 更详细的评估标准和示例
   - **多次评估**: Level 3 使用 2-3 次 AI 评估取平均值
   - **一致性检查**: 多次评估结果应该一致

6. **运行测试**（新增，可选）
   - 如果任务包含测试命令，运行测试
   - 检查测试是否通过
   - **注意**: 需要沙箱环境，安全考虑

#### 1.2 加权评分系统

```typescript
interface VerificationWeights {
  length: number;        // 0.1 (10%)
  syntax: number;       // 0.3 (30%)
  quality: number;      // 0.2 (20%)
  completeness: number;  // 0.2 (20%)
  aiAssessment: number; // 0.2 (20%)
}

const overallScore =
  result.details.length.score * weights.length +
  result.details.syntax.score * weights.syntax +
  result.details.quality.score * weights.quality +
  result.details.completeness.score * weights.completeness +
  result.details.aiAssessment.score * weights.aiAssessment;

// 通过阈值: Level 2=0.6, Level 3=0.7
const passed = overallScore >= (level === 3 ? 0.7 : 0.6);
```

**优势**:
- ✅ 细粒度评估
- ✅ 可调节权重
- ✅ 降低误判率
- ✅ 提供改进建议

#### 1.3 改进 AI 评估提示词

**当前提示词**（简单）:
```
You are a quality assessor. Check if response satisfies requirement.

Requirement: "${requirement}"
Response (truncated): "${responsePreview}"

Answer strictly in JSON format:
{
  "satisfied": true/false,
  "reason": "brief explanation",
  "confidence": 0.0-1.0
}
```

**改进后的提示词**（详细）:
```
You are an expert code reviewer and quality assessor. Your task is to evaluate if a response satisfies the requirement.

**Requirement:**
${requirement}

**Response:**
${responsePreview}

**Evaluation Criteria:**

1. **Correctness** (40%):
   - Does the code solve the stated problem?
   - Are there any logical errors?
   - Does it handle edge cases?

2. **Completeness** (20%):
   - Does it address all aspects of the requirement?
   - Are there any missing features?
   - Is the explanation clear and complete?

3. **Code Quality** (20%):
   - Is the code well-structured and readable?
   - Does it follow best practices?
   - Are variable/function names appropriate?

4. **Testing** (10%):
   - Are there examples or test cases?
   - Do they demonstrate the solution works?

5. **Documentation** (10%):
   - Is the code well-commented?
   - Is the explanation helpful?

**Output Format (JSON only):**
{
  "satisfied": true/false,
  "confidence": 0.0-1.0,
  "reason": "2-3 sentence explanation",
  "scores": {
    "correctness": 0.0-1.0,
    "completeness": 0.0-1.0,
    "quality": 0.0-1.0,
    "testing": 0.0-1.0,
    "documentation": 0.0-1.0
  },
  "issues": ["list of specific issues found"],
  "suggestions": ["list of improvement suggestions"]
}
```

**改进**:
- ✅ 明确的评分标准
- ✅ 加权评分（40% + 20% + 20% + 10% + 10%）
- ✅ 具体的问题列表
- ✅ 改进建议（用于下一轮迭代）

#### 1.4 实现计划

**文件修改**:
```
src/api.ts:          - 增强 APIVerifier 类
                       + addQualityChecks()
                       + addCompletenessChecks()
                       + calculateOverallScore()
src/utils/code-quality.ts (新建)
                       + validateNaming()
                       + validateStyle()
                       + validateBestPractices()
test/test-verification.ts (新建)
                       + 测试各验证维度
                       + 测试加权评分
```

**工作量估计**: 4-6 小时
**风险**: 低
**测试策略**: 单元测试 + 小规模 CL-bench 测试（10 样本）

---

### 方案 2: 智能提示词系统 ⭐⭐⭐⭐

**优先级**: 高
**预期提升**: +0.3-0.5% 通过率
**实施难度**: 中等

#### 2.1 任务分类系统

**新增功能**: 自动识别任务类型并选择最佳提示词

```typescript
enum TaskCategory {
  CODE_GENERATION = 'code_generation',    // 生成代码
  CODE_DEBUGGING = 'code_debugging',      // 调试代码
  CODE_REFACTORING = 'code_refactoring',  // 重构代码
  CODE_EXPLANATION = 'code_explanation',  // 解释代码
  ALGORITHM_IMPLEMENTATION = 'algorithm',  // 算法实现
  API_DESIGN = 'api_design',             // API 设计
  DATA_STRUCTURE = 'data_structure',     // 数据结构
  OTHER = 'other'
}

function classifyTask(requirement: string): TaskCategory {
  // 使用关键词匹配 + AI 分类
  // 详见 2.2 节
}
```

#### 2.2 Few-Shot 示例库

**为每种任务类型提供 3-5 个成功示例**

**示例 1: 算法实现**

```markdown
**Task:** Implement binary search in Python

**Good Response:**
\`\`\`python
def binary_search(arr, target):
    left, right = 0, len(arr) - 1

    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1

    return -1

# Time complexity: O(log n)
# Space complexity: O(1)
\`\`\`

**Why it's good:**
- ✅ Correct implementation
- ✅ Handles empty array case (returns -1)
- ✅ Includes time/space complexity analysis
- ✅ Clear variable names
- ✅ Proper indentation and style
```

**示例 2: 代码调试**

```markdown
**Task:** Fix the bug in this function that returns wrong sum

```javascript
function sumArray(arr) {
  let sum = 0;
  for (i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return sum;
}
```

**Good Response:**
\`\`\`javascript
function sumArray(arr) {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {  // ✅ Added 'let'
    sum += arr[i];
  }
  return sum;
}
\`\`\`

**Bug fixed:**
- Added missing `let` keyword to declare loop variable `i`
- Without `let`, `i` becomes a global variable, which can cause issues

**Alternative solution:**
\`\`\`javascript
function sumArray(arr) {
  return arr.reduce((sum, num) => sum + num, 0);  // ✅ More idiomatic
}
\`\`\`
```

**示例 3: API 设计**

```markdown
**Task:** Design a REST API for user authentication

**Good Response:**
\`\`\`typescript
// API Endpoints
POST   /api/auth/register    - Register new user
POST   /api/auth/login       - Login user
POST   /api/auth/logout      - Logout user
POST   /api/auth/refresh    - Refresh access token
GET    /api/auth/profile    - Get current user profile

// Request/Response Types
interface RegisterRequest {
  email: string;
  password: string;  // Hashed with bcrypt
  name: string;
}

interface AuthResponse {
  accessToken: string;   // JWT, expires in 15min
  refreshToken: string;  // JWT, expires in 7 days
  user: User;
}

// Security Best Practices
// 1. Passwords hashed with bcrypt (salt rounds: 10)
// 2. Access tokens short-lived (15min)
// 3. Refresh tokens stored in HttpOnly cookies
// 4. Rate limiting on login endpoints
\`\`\`

**Why it's good:**
- ✅ RESTful design
- ✅ Clear endpoint naming
- ️️ TypeScript interfaces for type safety
- ✅ Security considerations documented
```

#### 2.3 动态提示词构建

```typescript
interface PromptBuilderOptions {
  taskCategory: TaskCategory;
  level: 1 | 2 | 3;
  includeExamples: boolean;
  customRules?: string[];
}

function buildEnhancedPrompt(
  requirement: string,
  options: PromptBuilderOptions
): string {
  const basePrompt = loadSystemPrompt('default');

  let categoryPrompt = '';
  let examples = '';

  // 添加类别特定指令
  switch (options.taskCategory) {
    case TaskCategory.ALGORITHM_IMPLEMENTATION:
      categoryPrompt = `
**Algorithm Implementation Guidelines:**
- Include time and space complexity analysis
- Handle edge cases (empty input, single element, etc.)
- Add comments explaining key steps
- Provide test examples
`;
      examples = loadExamples('algorithms', 3); // 3 examples
      break;

    case TaskCategory.CODE_DEBUGGING:
      categoryPrompt = `
**Code Debugging Guidelines:**
- Identify the bug clearly
- Explain why it's a bug
- Provide the fixed code
- Suggest how to prevent similar bugs
`;
      examples = loadExamples('debugging', 3);
      break;

    // ... 其他类别
  }

  // Level 特定指令
  const levelInstructions = options.level === 3 ? `
**Quality Requirements (Level 3 - Deep Mode):**
- Provide production-ready code
- Include comprehensive error handling
- Add unit tests where applicable
- Document assumptions and limitations
- Suggest optimizations and alternatives
` : `
**Quality Requirements (Level 2 - Standard Mode):**
- Provide working, clean code
- Handle common edge cases
- Include brief comments for complex logic
`;

  return `${basePrompt}\n${categoryPrompt}\n${levelInstructions}\n\n${examples}`;
}
```

#### 2.4 实现计划

**文件修改**:
```
src/prompt.ts:              - 添加任务分类
                             + classifyTask()
                             + buildEnhancedPrompt()
src/prompts/task-specific/ (新建目录)
                             algorithm.md
                             debugging.md
                             refactoring.md
                             api-design.md
                             explanation.md
src/prompts/examples/ (新建目录)
                             algorithm-examples.md
                             debugging-examples.md
                             ...
test/test-prompt-classification.ts (新建)
                             - 测试任务分类准确性
```

**工作量估计**: 6-8 小时
**风险**: 中
**测试策略**: 单元测试 + 人工审核提示词质量

---

### 方案 3: 自适应迭代策略 ⭐⭐⭐

**优先级**: 中高
**预期提升**: +0.2-0.3% 通过率，+10-20% 速度
**实施难度**: 中等

#### 3.1 动态迭代次数

**思路**: 根据任务复杂度调整迭代次数

```typescript
interface TaskComplexity {
  level: 'simple' | 'medium' | 'complex';
  estimatedIterations: number;
  confidence: number;
}

function estimateTaskComplexity(
  requirement: string,
  projectInfo: ProjectInfo
): TaskComplexity {
  // Heuristics-based estimation
  const keywords = {
    simple: ['sum', 'print', 'basic', 'simple', 'hello world'],
    complex: ['refactor', 'architecture', 'optimize', 'distributed', 'system']
  };

  const techStackCount = extractTechStack(requirement).length;
  const stepCount = extractSteps(requirement).length;

  let level: 'simple' | 'medium' | 'complex';
  let estimatedIterations: number;
  let confidence: number;

  if (matchesKeywords(requirement, keywords.complex) || techStackCount >= 3 || stepCount >= 5) {
    level = 'complex';
    estimatedIterations = 4; // Level 3 default
    confidence = 0.7;
  } else if (matchesKeywords(requirement, keywords.simple) && techStackCount <= 1 && stepCount <= 2) {
    level = 'simple';
    estimatedIterations = 1; // Skip verification
    confidence = 0.8;
  } else {
    level = 'medium';
    estimatedIterations = 2; // Level 2 default
    confidence = 0.6;
  }

  return { level, estimatedIterations, confidence };
}

// Use in runApiModeWithLoop
const complexity = estimateTaskComplexity(input, projectInfo);
const maxIterations = userMaxIterations || complexity.estimatedIterations;
```

#### 3.2 早停机制

**思路**: 如果已高质量满足要求，提前终止

```typescript
// 在验证后检查
const verifyResult = await verifier.quickVerify(input, lastResponse, verifyOptions);

// 早停条件
if (verifyResult.passed && verifyResult.confidence >= 0.9) {
  if (!silent) {
    console.error('✅ High confidence achieved, early stopping...');
  }
  satisfied = true;
  break;
}

// 早停条件 2: 连续 2 次验证通过
if (iteration >= 2 && verifyResult.passed) {
  const prevResult = iterationResults[iterationResults.length - 2];
  if (prevResult && prevResult.phase === 'verify' && prevResult.result.passed) {
    if (!silent) {
      console.error('✅ Consistent quality achieved, early stopping...');
    }
    satisfied = true;
    break;
  }
}
```

#### 3.3 降级策略

**思路**: 复杂任务在 Level 2 失败时自动降级到 Level 1

```typescript
// 在最后一次迭代仍未满足时
if (iteration === maxIterations && !satisfied && level === 2) {
  if (!silent) {
    console.error('⚠️  Level 2 did not achieve satisfaction, falling back to Level 1...');
  }

  // 重置为 Level 1（返回最后一次响应）
  satisfied = true; // Accept best effort
  verificationReason = 'Best effort (Level 2 → Level 1 fallback)';
}
```

#### 3.4 实现计划

**文件修改**:
```
src/api.ts:                  - 添加复杂度估算
                               + estimateTaskComplexity()
                               + addEarlyStoppingLogic()
                               + addFallbackStrategy()
src/utils/complexity.ts (新建)
                               + extractTechStack()
                               + extractSteps()
                               + matchesKeywords()
test/test-adaptive-iteration.ts (新建)
                               + 测试复杂度估算准确性
                               + 测试早停机制
```

**工作量估计**: 3-4 小时
**风险**: 低
**测试策略**: 小规模 CL-bench 测试（20-50 样本）

---

### 方案 4: 学习机制 ⭐⭐⭐

**优先级**: 中
**预期提升**: 长期 +0.5-1% 通过率
**实施难度**: 中高

#### 4.1 失败模式分析

**思路**: 记录和分析常见失败原因

```typescript
interface FailurePattern {
  type: 'syntax_error' | 'incomplete' | 'wrong_logic' | 'quality_issue';
  frequency: number;
  examples: string[];
  suggestedFixes: string[];
}

class FailureAnalyzer {
  private patterns: Map<string, FailurePattern> = new Map();

  recordFailure(requirement: string, result: VerificationResult): void {
    // 分类失败类型
    // 统计频率
    // 记录示例
  }

  analyzePatterns(): FailurePattern[] {
    // 返回最常见的失败模式
  }

  generateSuggestions(pattern: FailurePattern): string[] {
    // 基于失败模式生成改进建议
  }
}
```

#### 4.2 成功案例库

**思路**: 记录高质量响应，用于 Few-Shot 学习

```typescript
interface SuccessExample {
  requirement: string;
  response: string;
  score: number; // 0-1
  category: TaskCategory;
  timestamp: number;
}

class SuccessLibrary {
  private examples: SuccessExample[] = [];

  addSuccess(example: SuccessExample): void {
    this.examples.push(example);
    // 持久化到文件
  }

  getSimilarExamples(requirement: string, category: TaskCategory, n: number): SuccessExample[] {
    // 使用向量相似度或关键词匹配找到相似的成功案例
    // 返回 top-n
  }
}
```

#### 4.3 自适应优化

**思路**: 根据历史数据调整参数

```typescript
interface OptimizationParameters {
  verificationWeights: VerificationWeights;
  iterationLimits: { simple: number; medium: number; complex: number; };
  thresholds: { level2: number; level3: number; };
}

class AdaptiveOptimizer {
  private parameters: OptimizationParameters;

  updateParameters(testResults: TestResult[]): void {
    // 使用强化学习或梯度下降调整参数
    // 目标: 最大化通过率
  }

  getOptimalParameters(): OptimizationParameters {
    return this.parameters;
  }
}
```

#### 4.4 实现计划

**文件修改**:
```
src/learning/failure-analyzer.ts (新建)
src/learning/success-library.ts (新建)
src/learning/adaptive-optimizer.ts (新建)
src/learning/types.ts (新建)
.learning/ (数据目录)
                             failures.json
                             successes.json
                             parameters.json
test/test-learning.ts (新建)
```

**工作量估计**: 8-10 小时
**风险**: 中高（需要大量测试数据）
**测试策略**: 持续监控 A/B 测试效果

---

## 📋 实施计划

### Phase 1: 立即改进（1-2 周）

**目标**: 快速提升通过率 0.5-1%

| 优先级 | 方案 | 工作量 | 预期提升 | 风险 |
|--------|------|--------|----------|------|
| 1 | 增强验证逻辑（1.1, 1.2） | 4-6h | +0.5-1% | 低 |
| 2 | 改进 AI 评估提示词（1.3） | 1-2h | +0.2-0.3% | 低 |
| 3 | 运行小规模测试验证 | 2-3h | - | - |

**子任务**:
1. ✅ 实现多维度验证（长度、语法、质量、完整性）
2. ✅ 实现加权评分系统
3. ✅ 改进 AI 评估提示词
4. ✅ 编写单元测试
5. ✅ 运行 10 样本测试验证效果
6. ✅ 如果有效，运行 100 样本测试

### Phase 2: 短期优化（2-4 周）

**目标**: 累计提升通过率 1-1.5%

| 优先级 | 方案 | 工作量 | 预期提升 | 风险 |
|--------|------|--------|----------|------|
| 1 | Few-Shot 示例库（2.2） | 4-6h | +0.3-0.5% | 中 |
| 2 | 动态提示词构建（2.3） | 2-3h | +0.1-0.2% | 中 |
| 3 | 自适应迭代（3.1, 3.2） | 3-4h | +0.2-0.3% + 速度 | 低 |
| 4 | 测试和调优 | 4-6h | - | - |

**子任务**:
1. ✅ 创建 Few-Shot 示例库（5 种任务类型）
2. ✅ 实现任务分类器
3. ✅ 实现动态提示词构建
4. ✅ 实现自适应迭代策略
5. ✅ 运行 100 样本测试
6. ✅ 分析失败案例，优化提示词

### Phase 3: 中期优化（1-2 个月）

**目标**: 累计提升通过率 2-3%

| 优先级 | 方案 | 工作量 | 预期提升 | 风险 |
|--------|------|--------|----------|------|
| 1 | 完整学习机制（方案 4） | 8-10h | +0.5-1% | 中高 |
| 2 | 降级策略（3.3） | 1-2h | +0.1% | 低 |
| 3 | 全面优化和测试 | 10-15h | - | - |

**子任务**:
1. ✅ 实现失败模式分析器
2. ✅ 实现成功案例库
3. ✅ 实现自适应优化器
4. ✅ 运行完整 1898 样本测试
5. ✅ 对比基线，计算实际提升
6. ✅ 如果 < 5%，继续迭代优化

### Phase 4: 长期优化（持续）

**目标**: 持续提升，超越 Claude Code

| 频率 | 方案 | 工作量 |
|------|------|--------|
| 每周 | 分析失败案例，更新提示词 | 2-3h |
| 每月 | 运行完整测试，评估效果 | 4-6h |
| 每季度 | 重构架构，引入新特性 | 20-30h |

**方向**:
1. 集成 ReAct 验证系统（5 步推理循环）
2. 引入更先进的模型（GPT-5, Claude 4 等）
3. 实现工具执行能力（实际运行代码）
4. 多模型集成（投票机制）

---

## 🎯 成功标准

### 短期目标（1 个月）

- ✅ 通过率从 1.74% 提升至 **3.5%+** (+100%)
- ✅ 与 Claude Code 差距从 3.19x 缩小至 **1.6x**
- ✅ 保持速度优势（Level 2 < 35s）
- ✅ 保持完成率 > 95%

### 中期目标（3 个月）

- ✅ 通过率提升至 **5%+** (+200%)
- ✅ **接近或超越 Claude Code** (5.54%)
- ✅ Level 3 模式达到 **5-6%**
- ✅ 建立持续优化机制

### 长期目标（6 个月）

- ✅ 通过率提升至 **7%+** (+300%)
- ✅ **稳定超越 Claude Code** (> 5.54%)
- ✅ 在多个 CL-bench 类别中领先
- ✅ 建立业界标杆

---

## 📊 监控指标

### 关键指标

| 指标 | 当前 | 目标 (1个月) | 目标 (3个月) |
|------|------|--------------|--------------|
| **总体通过率** | 1.74% | 3.5% | 5%+ |
| **Level 1 通过率** | 1.74% | 1.8% | 2% |
| **Level 2 通过率** | - | 3.5% | 4.5% |
| **Level 3 通过率** | - | - | 5-6% |
| **平均响应时间** | 13.6s | < 35s | < 70s |
| **完成率** | 99.95% | > 95% | > 90% |

### 分类别指标

CL-bench 包含多个任务类别，需要分别监控：

1. **算法实现** - 理论通过率应该最高
2. **代码调试** - 需要精确识别错误
3. **代码重构** - 需要保持功能不变
4. **API 设计** - 需要系统化思维
5. **数据结构** - 需要深入的计算机科学知识

### 诊断指标

用于诊断问题：

- **验证准确率**: 验证器判断是否准确（人工抽检 100 样本）
- **假阳性率**: 好的响应被误判为失败（目标 < 10%）
- **假阴性率**: 坏的响应被误判为通过（目标 < 5%）
- **AI 评估一致性**: 多次评估结果的一致性（目标 > 80%）
- **早停率**: 早停机制触发的比例（目标 20-30%）

---

## 🔧 开发工具和流程

### 实验环境

```bash
# 1. 创建实验分支
git checkout -b experiment/cltest-optimization

# 2. 小规模测试（快速迭代）
cd /Users/mac/cltest/cl-bench
python3 infer_agent.py --agent newma \
  --input CL-bench-bing.jsonl \
  --samples 10 \
  --api-level 2

# 3. 评估结果
python3 eval.py --input outputs/newma_level_2_*.jsonl

# 4. 对比基线
# 查看通过率是否提升

# 5. 如果有效，扩大测试规模
python3 infer_agent.py --agent newma \
  --input CL-bench-bing.jsonl \
  --samples 100 \
  --api-level 2

# 6. 记录结果到文档
# 更新 CLTEST_OPTIMIZATION_RESULTS.md
```

### A/B 测试

```bash
# 测试不同配置的效果
# 配置 A: Level 2
python3 infer_agent.py --agent newma --samples 100 --api-level 2

# 配置 B: Level 3
python3 infer_agent.py --agent newma --samples 100 --api-level 3

# 对比通过率和速度
# 选择更优配置
```

### 失败案例分析

```bash
# 1. 提取失败案例
python3 extract_failures.py --input outputs/newma_level_2_*.jsonl --output failures.jsonl

# 2. 手工分析前 20 个失败案例
# 3. 分类失败原因
# 4. 生成改进建议
# 5. 实施改进
# 6. 重新测试验证
```

---

## 📚 参考资源

### 内部文档

- [API_LOOP_OPTIMIZATION.md](./API_LOOP_OPTIMIZATION.md) - API 多轮推理优化文档
- [COMPLETE_UPGRADE_REPORT.md](./COMPLETE_UPGRADE_REPORT.md) - GLM-5 升级报告
- [API_LOOP_TEST_REPORT.md](./API_LOOP_TEST_REPORT.md) - 测试报告
- [CLAUDE.md](./CLAUDE.md) - 项目架构文档

### 外部资源

- [CL-bench 官方文档](https://clbench.com/) - 测试标准
- [OpenAI API 文档](https://platform.openai.com/docs) - 模型能力
- [Few-Shot Learning 最佳实践](https://arxiv.org/abs/2305.14314) - 提示词工程
- [代码质量评估标准](https://google.github.io/styleguide/) - 最佳实践

---

## 🎉 总结

本优化方案提供了一个系统化、分阶段的路线图，用于提升 newma 在 CL-bench 测试中的表现：

**核心优势**:
- ✅ **渐进式优化**: 从简单到复杂，风险可控
- ✅ **量化目标**: 明确的预期提升和成功标准
- ✅ **可测量**: 每个改进都可以通过测试验证
- ✅ **持续迭代**: 建立长期优化机制

**关键突破点**:
1. **增强验证逻辑** - 最快见效的改进（+0.5-1%）
2. **智能提示词系统** - 提升响应质量（+0.3-0.5%）
3. **自适应迭代** - 平衡质量和速度（+0.2-0.3%）
4. **学习机制** - 长期持续改进（+0.5-1%）

**预期成果**:
- 🎯 **1 个月**: 通过率 3.5%+，缩小差距至 1.6x
- 🎯 **3 个月**: 通过率 5%+，接近或超越 Claude Code
- 🎯 **6 个月**: 通过率 7%+，稳定超越 Claude Code

**立即行动**:
1. ✅ 实现 Phase 1.1: 增强验证逻辑
2. ✅ 运行小规模测试验证
3. ✅ 如果有效，继续 Phase 2
4. ✅ 持续监控和优化

让我们开始优化，让 newma 在 CL-bench 测试中脱颖而出！🚀

---

**文档维护**: 请在每次重大改进后更新本文档的预期值和实际结果。
**最后更新**: 2026-02-13
**下一步**: 开始实施方案 1.1（增强验证逻辑）
