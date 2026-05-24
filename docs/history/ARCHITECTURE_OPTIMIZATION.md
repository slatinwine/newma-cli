# Newma (牛码) 架构优化方案 - 基于 Claude Code 设计理念

**Version**: 1.0.0
**Date**: 2025-01-08
**Status**: Draft
**Based on**: Claude Code v2.0.31 design philosophy

---

## 执行摘要

本方案旨在将 newma 从当前的复杂架构（327 文件，10.6万行代码）优化为一个更接近 Claude Code 设计理念的高效系统。

**核心目标**：
- 减少文件数量 40%（327 → ~200）
- 减少代码行数 30%（10.6万 → ~7.4万）
- 消除模块重叠（executors, verifiers, REPLs）
- 统一工具集为 18 个核心工具
- 实现 TimeMachine 功能

---

## Claude Code 设计理念提取

### 1. 工具系统（18 个工具）

**核心原则**：少而精，每个工具都有清晰 schema 和 JSDoc

```
1.  Bash              - 后台执行、超时、沙盒
2.  BashOutput        - 检索后台输出
3.  KillShell         - 终止后台进程
4.  FileRead          - 读取文件
5.  FileWrite         - 写入文件（会覆盖）
6.  FileEdit          - 精确替换（old_string→new_string）
7.  Glob              - 文件模式匹配
8.  Grep              - ripgrep 搜索
9.  Agent             - 子 agent（model 选择 + resume）
10. TodoWrite         - 任务管理
11. WebFetch          - HTTP GET
12. WebSearch         - 网络搜索
13. TimeMachine       - 回退状态 + 重新执行
14. MultipleChoiceQuestion - AI 主动提问
15. NotebookEdit      - Jupyter 编辑
16. MCP (协议集成)    - MCP 工具调用
17. AskUser           - 向用户收集信息
18. Function         - 函数定义/调用
```

**设计亮点**：
- **后台执行是一等公民**：Bash + BashOutput + KillShell 完整三件套
- **TodoWrite 内置**：AI 自己管理任务列表，而不是由用户显式创建
- **TimeMachine 独特**：可以回到之前对话节点重新执行
- **Agent 可选择模型**：不同任务用不同模型（sonnet/opus/haiku）
- **精确替换**：FileEdit 用 old_string→new_string，而非行号

### 2. 工具 Schema 设计

每个工具都有严格的 TypeScript 类型定义：

```typescript
interface Tool {
  name: string;
  description: string;
  parameters?: ToolParameter[];
  handler: (params: any) => Promise<any>;
}

interface ToolParameter {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  default?: any;
}
```

### 3. 子 Agent 设计

```typescript
interface AgentTool {
  subagent_type: string;  // 'general-purpose', 'code-explorer', etc.
  model?: 'sonnet' | 'opus' | 'haiku';
  resume?: string;        // Agent ID to resume
  prompt: string;
}
```

---

## Newma 当前架构分析

### 代码库统计

| 指标 | 当前数量 |
|------|---------|
| TypeScript 文件 | 327 |
| 代码行数 | ~106,000 |
| 目录数量 | ~40 |
| 开发阶段 | 9 个主要阶段 |

### 模块重叠问题

#### 1. 三套执行器系统

| 系统 | 位置 | 状态 | 用途 |
|------|------|------|------|
| Legacy Executor | `src/executor.ts` | 已弃用 | 原始 action 执行 |
| ToolExecutor v2 | `src/executor-v2.ts` | 当前使用 | 工具系统 + MCP + 插件 |
| Event Executors | `src/executors/` | Phase 8 | 事件驱动架构 |

#### 2. 三套验证器系统

| 系统 | 位置 | 用途 |
|------|------|------|
| Classic Verifier | `src/verifier.ts` | 自动化检查（syntax, lint, tests, build） |
| Enhanced Verifier | `src/verification/enhanced-verifier.ts` | 质量评分（0-1 分数） |
| ReAct Verifier | `src/ultrathink/verifier.ts` | AI 推理验证 |

#### 3. 两套 REPL 系统

| 系统 | 位置 | 代码量 | 架构 |
|------|------|--------|------|
| Main REPL | `src/repl.ts` | 2000+ 行 | 单体式 |
| Loop REPL | `src/repl-loop.ts` + `src/loop/` | 40+ 文件 | 模块化插件式 |

#### 4. 两套 Agent 系统

- **Multi-Agent System**（`src/agents/`）：领域专家（frontend, backend, testing, documentation）
- **SubAgent System**（`src/agents/subagent/`）：两阶段执行（plan → execute）

#### 5. Action vs ToolCall 并存

- **Action**（遗留）：`{ type, path, content, command }`
- **ToolCall**（现代）：`{ tool, parameters, id }`
- **Adapter**：`src/action-adapter.ts` (296 lines)

---

## 优化方案（按优先级）

### P0: 精简工具集为 18 个核心工具

**目标**：从当前 20+ 个工具精简为 18 个核心工具

#### 实施步骤

**步骤 1：创建新的工具系统**

创建 `src/tools-v2/` 目录结构：
```
src/tools-v2/
├── types.ts           # 新的工具类型定义
├── registry.ts        # 工具注册表
└── builtin/
    ├── bash.ts
    ├── bash-output.ts
    ├── kill-shell.ts
    ├── file-read.ts
    ├── file-write.ts
    ├── file-edit.ts
    ├── glob.ts
    ├── grep.ts
    ├── agent.ts
    ├── todo-write.ts
    ├── web-fetch.ts
    ├── web-search.ts
    ├── time-machine.ts
    ├── multiple-choice.ts
    ├── ask-user.ts
    ├── notebook-edit.ts
    ├── mcp.ts
    └── function.ts
```

**步骤 2：实现后台执行支持**

```typescript
// src/tools-v2/builtin/bash.ts
export const BashTool: Tool = {
  name: 'Bash',
  description: 'Execute bash commands with optional background execution',
  parameters: [
    {
      name: 'command',
      description: 'The bash command to execute',
      type: 'string',
      required: true,
    },
    {
      name: 'description',
      description: 'Description of what the command does',
      type: 'string',
      required: false,
    },
    {
      name: 'timeout',
      description: 'Timeout in milliseconds (default: 120000)',
      type: 'number',
      default: 120000,
    },
    {
      name: 'run_in_background',
      description: 'Run the command in the background',
      type: 'boolean',
      default: false,
    },
    {
      name: 'dangerouslyDisableSandbox',
      description: 'Disable sandbox restrictions',
      type: 'boolean',
      default: false,
    },
  ],
  handler: async (params: BashParams) => {
    const result = await executeCommand(params.command, {
      timeout: params.timeout,
      background: params.run_in_background,
    });

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      background_id: result.backgroundId,
    };
  },
};
```

**步骤 3：实现 TodoWrite 工具**

```typescript
// src/tools-v2/builtin/todo-write.ts
export const TodoWriteTool: Tool = {
  name: 'TodoWrite',
  description: 'Create and manage a structured task list',
  parameters: [
    {
      name: 'todos',
      description: 'Array of todo items',
      type: 'array',
      required: true,
    },
  ],
  handler: async (params: TodoWriteParams) => {
    // Update todo list
    const todos = params.todos.map(todo => ({
      content: todo.content,
      status: todo.status || 'pending',
      activeForm: todo.activeForm || todo.content,
    }));

    // Display todos
    displayTodos(todos);

    return {
      updated: true,
      count: todos.length,
    };
  },
};
```

**步骤 4：实现 TimeMachine 工具**

```typescript
// src/tools-v2/builtin/time-machine.ts
export const TimeMachineTool: Tool = {
  name: 'TimeMachine',
  description: 'Travel back to a previous conversation turn and optionally restore code state',
  parameters: [
    {
      name: 'turn_number',
      description: 'The conversation turn to travel back to (0-indexed)',
      type: 'number',
      required: true,
    },
    {
      name: 'restore_code',
      description: 'Whether to restore files to their state at that turn',
      type: 'boolean',
      default: false,
    },
    {
      name: 'new_instruction',
      description: 'New instruction to execute from this point',
      type: 'string',
      required: false,
    },
  ],
  handler: async (params: TimeMachineParams) => {
    const snapshotManager = SnapshotManager.getInstance();
    const snapshot = await snapshotManager.restoreSnapshot(
      params.turn_number,
      params.restore_code ?? false
    );

    if (params.new_instruction) {
      return await executeWithNewContext(params.new_instruction, snapshot);
    }

    return {
      success: true,
      restored_turn: params.turn_number,
      files_changed: Array.from(snapshot.file_hashes.keys()),
    };
  },
};
```

**步骤 5：合并重复工具**

- `unix-commands.ts` → 拆分为独立工具或并入 Bash
- `search-and-fetch.ts` → 合并入 WebFetch + Grep
- `search.ts` → 合并入 Grep

**预期收益**：
- ✅ 减少工具数量 50%（20+ → 18）
- ✅ 统一工具接口
- ✅ 添加缺失的核心功能（TodoWrite, TimeMachine）
- ✅ 后台执行支持

---

### P1: 实现 TimeMachine 功能

**目标**：实现类似 Claude Code 的"时光倒流"功能

#### 设计方案

**核心功能**：
1. 记录每个用户消息点的文件快照
2. 支持回退到指定轮次
3. 支持注入新指令重新执行
4. 可选恢复文件状态

#### 实施步骤

**步骤 1：快照系统设计**

创建 `src/timemachine/snapshot-manager.ts`：
```typescript
interface Snapshot {
  turn_number: number;
  timestamp: Date;
  git_commit?: string;
  file_hashes: Map<string, string>;
  user_message: string;
  ai_response: string;
}

class SnapshotManager {
  private snapshots: Map<number, Snapshot> = new Map();

  async createSnapshot(turn: number, message: string): Promise<Snapshot> {
    // 使用 git stash 或文件 hash
    const commit = await this.createGitSnapshot();
    const hashes = await this.hashFiles();

    const snapshot: Snapshot = {
      turn_number: turn,
      timestamp: new Date(),
      git_commit: commit,
      file_hashes: hashes,
      user_message: message,
      ai_response: '',
    };

    this.snapshots.set(turn, snapshot);
    return snapshot;
  }

  async restoreSnapshot(turn: number, restoreFiles: boolean): Promise<Snapshot> {
    const snapshot = this.snapshots.get(turn);
    if (!snapshot) {
      throw new Error(`Snapshot ${turn} not found`);
    }

    if (restoreFiles && snapshot.git_commit) {
      await this.restoreGitSnapshot(snapshot.git_commit);
    }

    return snapshot;
  }
}
```

**步骤 2：集成到 REPL**

修改 `src/repl.ts` 或 `src/loop/`：
```typescript
class REPLManager {
  private snapshotManager = SnapshotManager.getInstance();
  private turnCounter = 0;

  async executeRequirement(requirement: string) {
    // 创建快照
    await this.snapshotManager.createSnapshot(this.turnCounter, requirement);

    try {
      const result = await this.callAI(requirement);
      this.turnCounter++;
      return result;
    } catch (error) {
      throw error;
    }
  }
}
```

**步骤 3：命令行接口**

```bash
/timemachine list                    # 列出所有快照
/timemachine restore <turn>          # 回退到指定轮次
/timemachine branch <turn> <cmd>     # 从历史创建分支
/timemachine diff <turn1> <turn2>    # 比较两个快照
```

**预期收益**：
- ✅ 独特的"时光倒流"功能（Claude Code 独有）
- ✅ 支持分支探索（不改原历史）
- ✅ 快速迭代和试错
- ✅ Git 集成（可靠且不占空间）

---

### P2: 优化子 Agent 系统

**目标**：参考 Claude Code 的 Agent 工具设计

#### 优化方案

**步骤 1：统一 Agent 接口**

创建 `src/agents-v2/types.ts`：
```typescript
interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  model?: 'sonnet' | 'opus' | 'haiku';
  process(task: AgentTask, context: AgentContext): Promise<AgentResult>;
}

interface AgentResult {
  success: boolean;
  output: string;
  actions?: Action[];
  metadata?: Record<string, unknown>;
  agent_id?: string;  // 用于 resume
}
```

**步骤 2：实现模型选择**

```typescript
class ModelSelector {
  selectModel(complexity: number): 'sonnet' | 'opus' | 'haiku' {
    if (complexity < 0.3) return 'haiku';
    if (complexity < 0.7) return 'sonnet';
    return 'opus';
  }
}
```

**步骤 3：精简 Agent 类型**

从当前的 15+ 个 agent 精简为 6-8 个：

| Agent | 用途 | 模型 |
|-------|------|------|
| `general-purpose` | 通用任务 | sonnet |
| `code-explorer` | 快速代码探索 | haiku |
| `code-architect` | 架构设计 | opus |
| `code-reviewer` | 代码审查 | sonnet |
| `implementation-agent` | 代码实现 | sonnet |
| `testing-agent` | 测试生成 | sonnet |

**步骤 4：Agent 工具集成**

```typescript
export const AgentTool: Tool = {
  name: 'Agent',
  description: 'Launch a specialized sub-agent for complex tasks',
  parameters: [
    {
      name: 'subagent_type',
      description: 'Type of agent to launch',
      type: 'string',
      required: true,
      enum: ['general-purpose', 'code-explorer', 'code-architect', 'code-reviewer', 'implementation-agent', 'testing-agent'],
    },
    {
      name: 'model',
      description: 'Model to use for this agent',
      type: 'string',
      required: false,
      enum: ['sonnet', 'opus', 'haiku'],
      default: 'sonnet',
    },
    {
      name: 'resume',
      description: 'Agent ID to resume from previous execution',
      type: 'string',
      required: false,
    },
    {
      name: 'prompt',
      description: 'Task description for the agent',
      type: 'string',
      required: true,
    },
  ],
  handler: async (params: AgentParams) => {
    const agentManager = AgentManager.getInstance();

    if (params.resume) {
      return await agentManager.resume(params.resume, params.prompt);
    }

    const agent = agentManager.createAgent(params.subagent_type, params.model);
    return await agent.process({ description: params.prompt });
  },
};
```

**预期收益**：
- ✅ 统一的 Agent 接口
- ✅ 模型选择（成本优化）
- ✅ Resume 功能（断点续传）
- ✅ 减少 Agent 类型（15+ → 6-8）

---

### P3: 架构清理

**目标**：消除模块重叠，统一架构

#### 3.1 统一执行器系统

```typescript
// src/executor/unified-executor.ts
interface UnifiedExecutor {
  executeToolCall(call: ToolCall): Promise<ToolResult>;
  executeParallel(calls: ToolCall[]): Promise<ToolResult[]>;
  executeAction(action: Action): Promise<ExecutionResult>;
}
```

#### 3.2 澄清验证器系统

| 旧名称 | 新名称 | 用途 |
|--------|--------|------|
| `verifier.ts` | `classic-verifier.ts` | 自动化检查 |
| `enhanced-verifier.ts` | `quality-verifier.ts` | 质量评分 |
| `ultrathink/verifier.ts` | `react-verifier.ts` | AI 推理验证 |

#### 3.3 REPL 迁移到 Loop 架构

**迁移计划**：
1. 审计 `repl.ts` 中不在 `loop/` 的功能
2. 为缺失功能创建插件
3. 更新 `cli.ts` 使用 `repl-loop.ts`
4. 弃用 `repl.ts`

#### 3.4 统一类型定义

创建 `src/types/` 目录：
```
src/types/
├── core.ts           # 核心类型
├── tools.ts          # 工具类型
├── agents.ts         # Agent 类型
├── memory.ts         # 内存类型
├── config.ts         # 配置类型
└── index.ts          # 统一导出
```

**预期收益**：
- ✅ 单一执行器接口
- ✅ 清晰的验证器命名
- ✅ 统一的 REPL 架构
- ✅ 集中的类型定义
- ✅ 减少代码量 20-30%

---

## 实施计划

### 时间表（8-10 周）

**P0: 精简工具集**（3-4 周）
- Week 1-2: 设计新工具 schema + 实现核心工具
- Week 3: 实现新工具（TodoWrite, TimeMachine, Agent）
- Week 4: 合并重复工具 + 迁移指南

**P1: TimeMachine**（2 周）
- Week 1: 快照系统 + TimeMachine 工具
- Week 2: REPL 集成 + 命令行接口

**P2: 子 Agent 优化**（2 周）
- Week 1: 统一接口 + 模型选择
- Week 2: Resume 功能 + Agent 工具

**P3: 架构清理**（2-3 周）
- Week 1: 统一执行器
- Week 2: 澄清验证器
- Week 3: REPL 迁移 + 类型统一

### 里程碑

| 里程碑 | 交付物 | 验收标准 |
|--------|--------|---------|
| M1: P0 完成 | 18 个核心工具 | 工具数量 ≤ 18，所有测试通过 |
| M2: P1 完成 | TimeMachine 功能 | 可以回退并重新执行 |
| M3: P2 完成 | 优化的 Agent 系统 | Agent 类型 ≤ 8，支持模型选择 |
| M4: P3 完成 | 清理的架构 | 模块重叠消除，文档完整 |

---

## 成功指标

### 定量指标

| 指标 | 当前 | 目标 | 改进 |
|------|------|------|------|
| 文件数量 | 327 | ~200 | -39% |
| 代码行数 | 106,000 | ~74,000 | -30% |
| 工具数量 | 20+ | 18 | -50% |
| Agent 类型 | 15+ | 6-8 | -50% |
| 执行器系统 | 3 | 1 | -67% |
| REPL 系统 | 2 | 1 | -50% |

### 定性指标

- ✅ 清晰的模块边界
- ✅ 统一的接口设计
- ✅ 完整的文档
- ✅ 向后兼容
- ✅ 测试覆盖率 ≥ 80%

---

## 风险管理

### 风险 1：破坏现有功能
- **缓解**：完整的测试套件
- **回退**：每个优先级独立提交

### 风险 2：向后兼容性
- **缓解**：Adapter 层
- **文档**：迁移指南

### 风险 3：时间超期
- **缓解**：分阶段交付
- **优先级**：P0 > P1 > P2 > P3

---

## 下一步行动

建议按以下顺序实施：

1. **立即开始**（本周）：
   - 创建 `src/tools-v2/` 目录结构
   - 实现核心工具（Bash, FileRead/Write/Edit, Grep）
   - 设计 TimeMachine 快照系统

2. **近期计划**（本月）：
   - 完成 P0：精简工具集
   - 实现 TodoWrite 和 TimeMachine
   - 创建工具迁移指南

3. **中期目标**（本季度）：
   - 完成 P1：TimeMachine 功能
   - 完成 P2：优化 Agent 系统
   - 开始 P3：架构清理

---

**作者**: Newma (牛码) 架构优化团队
**状态**: Draft
**版本**: 1.0.0
