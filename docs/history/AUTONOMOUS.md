# Newma (牛码) 工具调用与主动 Action 能力

## 🎯 概述

Newma (牛码) 拥有强大的**工具调用系统**和**主动 Action 能力**，使其能够：
- 调用各种工具完成复杂任务
- 主动检测问题并修复
- 自主执行工作流程
- 根据情况调整策略

## 📚 目录

- [现有工具系统](#现有工具系统)
- [工具调用能力](#工具调用能力)
- [主动 Action 能力](#主动-action-能力)
- [使用示例](#使用示例)
- [创建自定义工具](#创建自定义工具)
- [自主模式](#自主模式)
- [安全最佳实践](#安全最佳实践)

## 🔧 现有工具系统

### Phase 2 工具架构

Newma (牛码) 在 Phase 2 实现了完整的工具系统：

**核心组件**:
- `src/tools/types.ts` - 工具接口定义
- `src/tools/registry.ts` - 工具注册中心
- `src/tools/builtin/file.ts` - 文件操作工具
- `src/tools/builtin/command.ts` - 命令执行工具
- `src/executor-v2.ts` - 工具执行器

### 内置工具

#### 1. File Tool (文件工具)

**能力**:
- ✅ 创建文件
- ✅ 修改文件
- ✅ 删除文件
- ✅ 读取文件内容
- ✅ 检测敏感文件
- ✅ 自动创建目录

**使用示例**:
```typescript
{
  tool: 'file',
  parameters: {
    operation: 'create',
    path: 'src/components/Header.tsx',
    content: `
      export function Header() {
        return <header>Newma (牛码) App</header>;
      }
    `
  }
}
```

**安全特性**:
- 自动检测敏感文件（.env, credentials.json）
- 路径验证防止目录遍历攻击
- 自动创建不存在的目录
- 原子性写入操作

#### 2. Command Tool (命令工具)

**能力**:
- ✅ 执行 shell 命令
- ✅ 超时管理
- ✅ 危险命令检测
- ✅ 输出捕获
- ✅ 错误处理

**使用示例**:
```typescript
{
  tool: 'command',
  parameters: {
    command: 'npm install',
    timeout: 60000
  }
}
```

**安全特性**:
- 危险命令检测（rm -rf, sudo, etc.）
- 超时保护防止挂起
- 权限级别控制
- 详细的错误报告

## 🎨 工具调用能力

### 基础工具调用

Newma (牛码) 通过 LLM 生成工具调用：

```bash
# LLM 自动决定使用哪个工具
npx newma-cli --use-tools "create a React component with TypeScript"
```

**执行流程**:
```
LLM 分析需求
  ↓
选择合适的工具 (file tool)
  ↓
生成工具调用参数
  ↓
执行工具调用
  ↓
返回结果给 LLM
```

### 并行工具调用

Newma (牛码) 支持并行执行多个工具调用：

```typescript
// executor-v2.ts
async executeParallel(calls: ToolCall[]): Promise<ToolResult[]> {
  return await Promise.all(
    calls.map(call => this.executeToolCall(call))
  );
}
```

**示例**:
```bash
# 同时创建多个文件
npx newma-cli --use-tools --multi-agent \
  "create Header, Footer, and Sidebar components"
```

### 工具链组合

工具可以组合成工作流：

```
1. file: create schema.ts
   ↓
2. file: create api.ts
   ↓
3. command: npm run build
   ↓
4. command: npm test
```

## 🤖 主动 Action 能力

### 当前已实现的主动能力

#### 1. 自动验证与修复 (Phase 2)

```bash
# --verify 标志启用主动验证
npx newma-cli --verify "add user authentication"

# 执行流程:
# 1. 执行任务
# 2. 自动运行验证
# 3. 如果失败 → 自动修复
# 4. 重新验证
# 5. 循环直到成功
```

**主动行为**:
- ✅ 自动检测语法错误
- ✅ 自动运行 Lint
- ✅ 自动执行测试
- ✅ 失败时自动修复
- ✅ 重新验证

#### 2. 多智能体自主协调 (Phase 3)

```bash
npx newma-cli --multi-agent \
  "build a complete feature with testing"
```

**主动行为**:
- ✅ 自动分解任务
- ✅ 自动选择合适的智能体
- ✅ 自动解决依赖关系
- ✅ 并行执行独立任务
- ✅ 聚合结果

#### 3. 自我优化 (Phase 4)

```bash
# 分析执行历史
npx ts-node src/cli-optimize.ts analyze

# 应用优化
npx ts-node src/cli-optimize.ts optimize
```

**主动行为**:
- ✅ 自动收集性能指标
- ✅ 自动识别成功模式
- ✅ 自动生成优化建议
- ✅ 自动应用性能优化

### 新增：完全自主模式

**文件**: `src/autonomous/agent.ts`

AutonomousAgent 提供完全自主的执行能力：

```typescript
export class AutonomousAgent {
  async executeAutonomously(
    requirement: string,
    options: AutonomousConfig = {}
  ): Promise<AutonomousResult>
}
```

**四大阶段**:

1. **Phase 1: 战略规划**
   - 自动分解任务
   - 识别依赖关系
   - 制定执行计划
   - 请求用户确认（可选）

2. **Phase 2: 自主执行**
   - 按迭代执行任务
   - 支持并行执行
   - 自动重试失败任务
   - 实时进度反馈

3. **Phase 3: 质量验证**
   - 自动运行测试
   - 代码质量检查
   - 构建验证
   - 生成验证报告

4. **Phase 4: 自我优化**
   - 分析执行模式
   - 识别改进机会
   - 应用优化建议
   - 建立性能基线

**配置选项**:

```typescript
interface AutonomousConfig {
  maxIterations?: number;      // 最大迭代次数 (default: 5)
  autoFix?: boolean;           // 自动修复 (default: true)
  autoOptimize?: boolean;      // 自动优化 (default: true)
  requireConfirmation?: boolean; // 需要确认 (default: false)
  stopOnError?: boolean;       // 错误时停止 (default: false)
  verbose?: boolean;           // 详细输出 (default: true)
}
```

## 💡 使用示例

### 示例 1: 基础工具调用

```typescript
// 使用 File Tool 创建文件
const result = await toolExecutor.executeToolCall({
  tool: 'file',
  parameters: {
    operation: 'create',
    path: 'src/utils/helpers.ts',
    content: `
      export function formatDate(date: Date): string {
        return date.toISOString();
      }
    `
  }
});

console.log(result.success ? '✅ File created' : '❌ Failed');
```

### 示例 2: 命令执行

```typescript
// 使用 Command Tool 运行测试
const result = await toolExecutor.executeToolCall({
  tool: 'command',
  parameters: {
    command: 'npm test',
    timeout: 30000
  }
});

if (result.success) {
  console.log('✅ Tests passed');
  console.log(result.output); // 测试输出
} else {
  console.log('❌ Tests failed');
  console.error(result.error);
}
```

### 示例 3: 并行工具调用

```typescript
// 同时执行多个操作
const results = await toolExecutor.executeParallel([
  {
    tool: 'file',
    parameters: {
      operation: 'create',
      path: 'src/components/Header.tsx',
      content: '...'
    }
  },
  {
    tool: 'file',
    parameters: {
      operation: 'create',
      path: 'src/components/Footer.tsx',
      content: '...'
    }
  },
  {
    tool: 'command',
    parameters: {
      command: 'npm run build'
    }
  }
]);

results.forEach((result, i) => {
  console.log(`Task ${i + 1}: ${result.success ? '✅' : '❌'}`);
});
```

### 示例 4: 自动验证和修复

```typescript
// 启用自动验证
const executor = new ToolExecutor(tracker, config, root);

// 执行任务
await executor.executeAction(action);

// 自动验证
const verifier = new Verifier();
const result = await verifier.verify(root, 'auto');

if (!result.passed) {
  console.log('⚠️ Verification failed, auto-fixing...');

  // 生成修复建议
  const fixes = await verifier.generateFixes(result.failedChecks);

  // 应用修复
  for (const fix of fixes) {
    await executor.executeAction(fix);
  }

  // 重新验证
  const retryResult = await verifier.verify(root, 'auto');
  console.log(retryResult.passed ? '✅ Fixed!' : '❌ Still failing');
}
```

### 示例 5: 多智能体协作

```typescript
// 使用协调器分配任务
const coordinator = new AgentCoordinator(
  toolExecutor,
  tracker,
  rollbackManager,
  config,
  root
);

// 分解需求
const plan = await coordinator.planDecomposition(
  "build a REST API with authentication"
);

// 自动执行计划
const results = await coordinator.executePlan(plan, requirement, {
  streaming: true
});

// 查看结果
results.forEach(result => {
  console.log(`${result.agentId}: ${result.success ? '✅' : '❌'}`);
});
```

### 示例 6: 完全自主模式

```typescript
// 创建自主代理
const autonomousAgent = new AutonomousAgent(
  toolExecutor,
  tracker,
  rollbackManager,
  config,
  root
);

// 自主执行任务
const result = await autonomousAgent.executeAutonomously(
  "create a full-stack CRUD application",
  {
    maxIterations: 5,
    autoFix: true,
    autoOptimize: true,
    requireConfirmation: true,
    verbose: true
  }
);

console.log(`
Status: ${result.finalStatus}
Tasks: ${result.successfulTasks}/${result.totalTasks}
Duration: ${(result.totalDuration! / 1000).toFixed(1)}s
`);
```

## 🔨 创建自定义工具

### 工具接口

```typescript
interface Tool {
  name: string;
  description: string;
  category: ToolCategory;
  permissions: PermissionLevel[];
  parameters: ToolParameter[];
  handler: ToolHandler;
}

type ToolHandler = (
  params: Record<string, any>,
  context: ToolContext
) => Promise<ToolResult>;
```

### 示例: Git 工具

```typescript
import { Tool, ToolCategory, PermissionLevel } from './types';

const gitTool: Tool = {
  name: 'git',
  description: 'Execute git commands',
  category: ToolCategory.VCS,
  permissions: [PermissionLevel.STANDARD],
  parameters: [
    {
      name: 'command',
      type: 'string',
      required: true,
      description: 'Git command to execute (e.g., status, commit, push)'
    },
    {
      name: 'args',
      type: 'array',
      required: false,
      description: 'Command arguments'
    }
  ],
  handler: async (params, context) => {
    try {
      // 安全地构建命令
      const { execFile } = require('child_process');
      const { promisify } = require('util');

      const execFilePromisified = promisify(execFile);

      // 使用 execFile 而不是 exec，更安全
      const { stdout, stderr } = await execFilePromisified(
        'git',
        [params.command, ...(params.args || [])],
        {
          cwd: context.projectRoot,
          timeout: 30000
        }
      );

      return {
        success: true,
        output: stdout,
        error: stderr
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }
};

// 注册工具
registry.register(gitTool);
```

### 示例: HTTP 请求工具

```typescript
const httpTool: Tool = {
  name: 'http',
  description: 'Make HTTP requests',
  category: ToolCategory.NETWORK,
  permissions: [PermissionLevel.SAFE],
  parameters: [
    {
      name: 'url',
      type: 'string',
      required: true,
      description: 'Request URL'
    },
    {
      name: 'method',
      type: 'string',
      required: false,
      description: 'HTTP method (default: GET)'
    },
    {
      name: 'headers',
      type: 'object',
      required: false,
      description: 'Request headers'
    },
    {
      name: 'body',
      type: 'object',
      required: false,
      description: 'Request body (JSON)'
    }
  ],
  handler: async (params, context) => {
    try {
      const response = await fetch(params.url, {
        method: params.method || 'GET',
        headers: params.headers || {},
        body: params.body ? JSON.stringify(params.body) : undefined
      });

      const data = await response.json();

      return {
        success: response.ok,
        output: data,
        status: response.status
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

registry.register(httpTool);
```

## 🚀 自主模式

### 激活自主模式

```typescript
import { AutonomousAgent } from './autonomous/agent';

// 创建自主代理
const agent = new AutonomousAgent(
  toolExecutor,
  tracker,
  rollbackManager,
  config,
  projectRoot
);

// 执行任务
const result = await agent.executeAutonomously(
  "build a complete e-commerce checkout system",
  {
    maxIterations: 5,
    autoFix: true,
    autoOptimize: true,
    requireConfirmation: false, // 完全自主，不需要确认
    stopOnError: false,
    verbose: true
  }
);
```

### 自主模式输出

```
🤖 Autonomous Mode Activated

📋 Phase 1: Strategic Planning
   Tasks: 12
   Groups: 4

⚙️ Phase 2: Autonomous Execution

   Iteration 1/4
      → Create product schema
      → Implement checkout API
      → Build payment integration
      → Add unit tests

   Iteration 2/4
      → Fix type errors
      → Update API endpoints

   Iteration 3/4
      → All tasks passed

✅ Phase 3: Quality Verification
   Verification: PASSED

🧠 Phase 4: Self-Optimization
   Analyzing patterns...

📊 Autonomous Execution Summary
===
Requirement: build a complete e-commerce checkout system
Status: SUCCESS
Duration: 45.2s
Tasks: 12/12 successful
===
```

## 🔒 安全最佳实践

### 1. 使用 execFile 而不是 exec

❌ **不安全**:
```typescript
const { exec } = require('child_process');
exec(`git ${userInput}`, (error, stdout, stderr) => {
  // 容易受到命令注入攻击
});
```

✅ **安全**:
```typescript
const { execFile } = require('child_process');
execFile('git', [userInput], (error, stdout, stderr) => {
  // 参数被安全地分隔
});
```

### 2. 验证和清理输入

```typescript
function validatePath(path: string): string {
  // 防止目录遍历
  const normalized = path.replace(/\.\./g, '');
  // 确保在项目根目录内
  const fullPath = resolve(projectRoot, normalized);
  if (!fullPath.startsWith(projectRoot)) {
    throw new Error('Path traversal detected');
  }
  return fullPath;
}
```

### 3. 使用权限级别

```typescript
// 根据操作危险程度设置权限
const dangerousTool: Tool = {
  name: 'delete-database',
  permissions: [PermissionLevel.DANGEROUS], // 需要明确授权
  // ...
};

const safeTool: Tool = {
  name: 'read-file',
  permissions: [PermissionLevel.READ_ONLY], // 最小权限
  // ...
};
```

### 4. 超时保护

```typescript
// 始终设置超时
await execFile('npm', ['install'], {
  timeout: 60000, // 60 秒超时
  cwd: projectRoot
});
```

### 5. 错误处理

```typescript
try {
  const result = await toolExecutor.executeToolCall(call);
  if (!result.success) {
    // 记录错误但不暴露敏感信息
    logger.error('Tool execution failed', {
      tool: call.tool,
      error: sanitizeError(result.error)
    });
  }
} catch (error) {
  // 统一错误处理
  handleError(error);
}
```

## 📊 性能考虑

### 并行执行

```typescript
// 独立任务可以并行执行
const results = await Promise.all([
  toolExecutor.executeToolCall(task1),
  toolExecutor.executeToolCall(task2),
  toolExecutor.executeToolCall(task3)
]);
```

### 缓存策略

```typescript
// 缓存昂贵的操作
const cache = new Map();

async function executeWithCache(call: ToolCall) {
  const cacheKey = JSON.stringify(call);

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const result = await toolExecutor.executeToolCall(call);
  cache.set(cacheKey, result);
  return result;
}
```

### 资源限制

```typescript
// 限制并发执行数量
class LimitedExecutor {
  private queue: ToolCall[] = [];
  private active = 0;
  private maxConcurrent = 5;

  async execute(call: ToolCall) {
    while (this.active >= this.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.active++;
    try {
      return await toolExecutor.executeToolCall(call);
    } finally {
      this.active--;
    }
  }
}
```

## 🎯 总结

Newma (牛码) 的工具调用和自主 Action 能力包括：

### ✅ 已实现
1. **完整的工具系统** - File Tool, Command Tool
2. **工具注册机制** - 可扩展的插件架构
3. **权限控制** - 四级安全系统
4. **自动验证** - 多阶段质量检查
5. **自动修复** - 失败时自动修正
6. **多智能体协调** - 自动任务分配
7. **自我优化** - 学习和改进
8. **完全自主模式** - 端到端自主执行

### 🚀 未来计划
1. **更多工具** - Database, Docker, K8s
2. **更智能的决策** - 基于历史的策略选择
3. **协作能力** - 多个 Newma (牛码) 实例协同
4. **实时监控** - 执行过程的实时反馈
5. **预测性优化** - 预防问题而非修复问题

---

**Newma (牛码) v3.1.0** - 不仅能执行命令，更能主动思考和行动 🤖✨
