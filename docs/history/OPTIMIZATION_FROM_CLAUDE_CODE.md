# Newma 架构优化方案：基于 Claude Code 2.1.88 逆向源码分析

**分析日期**: 2026-03-31
**对比对象**: Newma v3.1.0 vs Claude Code 2.1.88

---

## 1. 工具系统设计

### 现状差距

| 特性 | Newma | Claude Code |
|------|-------|-------------|
| 工具定义 | 简单 `Tool` interface (name/description/execute) | `Tool` 抽象类，含 `inputSchema` (zod)、`await` 标记、`mcpTool` 支持 |
| 权限系统 | `Permission` enum，运行时检查 | 分层：`bashPermissions`、`bashSecurity`、`pathValidation`、`readOnlyValidation`、`sedValidation`、`shouldUseSandbox`、`destructiveCommandWarning` — 7 个独立验证模块 |
| 并行执行 | 无 | `toolOrchestration.ts` — 工具并行调度 |
| Hook 系统 | 简单 pre/post | `toolHooks.ts` — `beforeToolUse`、`afterToolUse`、`onToolError` |
| 工具结果存储 | 无 | `toolResultStorage.ts` — 持久化工具输出 |
| Bash 安全 | 基本权限检查 | sed 注入检测、路径验证、危险命令警告、沙箱决策 |

### 优化方案

**1.1 分层权限验证链**

```typescript
// src/tools/validation/chain.ts
export interface ValidationRule {
  name: string;
  validate(context: ToolExecutionContext): ValidationResult;
}

export class PermissionChain {
  private rules: ValidationRule[] = [];

  addRule(rule: ValidationRule): this {
    this.rules.push(rule);
    return this;
  }

  async validate(context: ToolExecutionContext): Promise<ValidationResult> {
    for (const rule of this.rules) {
      const result = rule.validate(context);
      if (!result.allowed) return result;
    }
    return { allowed: true };
  }
}

// 使用示例
const bashChain = new PermissionChain()
  .addRule(new PathValidationRule())
  .addRule(new DestructiveCommandRule())
  .addRule(new SedInjectionRule())
  .addRule(new SandboxDecisionRule());
```

**1.2 工具并行编排**

```typescript
// src/tools/orchestration.ts (参考 Claude Code toolOrchestration.ts)
export class ToolOrchestrator {
  async executeParallel(calls: ToolCall[]): Promise<ToolResult[]> {
    const independent = this.findIndependent(calls);
    const dependent = calls.filter(c => !independent.includes(c));
    
    const [parallelResults, serialResults] = await Promise.all([
      Promise.all(independent.map(c => this.executeOne(c))),
      this.executeSerial(dependent),
    ]);
    
    return this.mergeResults(parallelResults, serialResults, calls);
  }
  
  private findIndependent(calls: ToolCall[]): ToolCall[] {
    // 无依赖关系的工具可以并行（参考 Claude Code 的依赖分析）
    return calls.filter(c => !this.hasDependency(c, calls));
  }
}
```

**1.3 工具 Hook 系统**

```typescript
// src/tools/hooks.ts (参考 Claude Code toolHooks.ts)
export type ToolHook = {
  beforeToolUse?: (tool: string, input: unknown) => 
    { proceed: true } | { proceed: false; reason: string };
  afterToolUse?: (tool: string, input: unknown, output: unknown) => void;
  onToolError?: (tool: string, error: Error) => { retry?: boolean; message?: string };
};

export class ToolHookManager {
  private hooks: Map<string, ToolHook[]> = new Map();
  
  register(toolName: string, hook: ToolHook) { /* ... */ }
  async runBefore(tool: string, input: unknown) { /* ... */ }
  async runAfter(tool: string, input: unknown, output: unknown) { /* ... */ }
  async runError(tool: string, error: Error) { /* ... */ }
}
```

---

## 2. 流式响应处理

### 现状差距

| 特性 | Newma | Claude Code |
|------|-------|-------------|
| 流式实现 | `ai-streaming.ts` 基础 SSE | `Stream<T>` 泛型类，支持背压、错误传播、多消费者 |
| 变换管道 | 无 | `streamlinedTransform.ts` — 链式变换 |
| JSON Guard | 无 | `streamJsonStdoutGuard.ts` — 安全输出 |

### 优化方案

**2.1 泛型 Stream 类（参考 Claude Code `utils/stream.ts`）**

```typescript
// src/utils/stream.ts
export class Stream<T> implements AsyncIterableIterator<T> {
  private queue: T[] = [];
  private readResolve?: (value: IteratorResult<T>) => void;
  private readReject?: (error: unknown) => void;
  private isDone = false;
  private started = false;

  push(value: T): void {
    if (this.readResolve) {
      this.readResolve({ done: false, value });
      this.readResolve = undefined;
    } else {
      this.queue.push(value);
    }
  }

  error(err: unknown): void {
    this.isDone = true;
    if (this.readReject) {
      this.readReject(err);
      this.readReject = undefined;
    }
  }

  end(): void {
    this.isDone = true;
    if (this.readResolve) {
      this.readResolve({ done: true, value: undefined as any });
      this.readResolve = undefined;
    }
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<T> {
    if (this.started) throw new Error('Stream can only be iterated once');
    this.started = true;
    return this;
  }

  next(): Promise<IteratorResult<T>> {
    if (this.queue.length > 0) {
      return Promise.resolve({ done: false, value: this.queue.shift()! });
    }
    if (this.isDone) {
      return Promise.resolve({ done: true, value: undefined as any });
    }
    return new Promise((resolve, reject) => {
      this.readResolve = resolve;
      this.readReject = reject;
    });
  }

  // 转换管道
  pipe<U>(transform: (value: T) => U | Promise<U>): Stream<U> {
    const output = new Stream<U>();
    (async () => {
      for await (const item of this) {
        output.push(await transform(item));
      }
      output.end();
    })();
    return output;
  }
}
```

**2.2 流式变换管道**

```typescript
// src/utils/streamTransform.ts
export class StreamPipeline {
  static create<T>() {
    return {
      from: (source: AsyncIterable<T>) => new StreamPipelineBuilder(source),
    };
  }
}

export class StreamPipelineBuilder<T> {
  constructor(private source: AsyncIterable<T>) {}

  map<U>(fn: (v: T) => U): StreamPipelineBuilder<U> {
    const stream = new Stream<U>();
    (async () => {
      for await (const item of this.source) stream.push(fn(item));
      stream.end();
    })();
    return new StreamPipelineBuilder(stream);
  }

  filter(fn: (v: T) => boolean): StreamPipelineBuilder<T> {
    const stream = new Stream<T>();
    (async () => {
      for await (const item of this.source) {
        if (fn(item)) stream.push(item);
      }
      stream.end();
    })();
    return new StreamPipelineBuilder(stream);
  }

  collect(): Promise<T[]> {
    const results: T[] = [];
    return (async () => {
      for await (const item of this.source) results.push(item);
      return results;
    })();
  }
}
```

---

## 3. 上下文管理

### 现状差距

| 特性 | Newma | Claude Code |
|------|-------|-------------|
| CLAUDE.md | 无 | 多层 `CLAUDE.md` 扫描（项目/目录/用户级） |
| 上下文注入 | 手动 prompt 拼接 | `context.ts` 自动注入：git 状态、分支、文件树、记忆文件 |
| Token 预算 | 简单压缩 | 动态预算分配：system prompt / 工具结果 / 对话历史 分层管理 |
| 上下文分析 | 无 | `contextAnalysis.ts` — 分析 token 使用率、建议截断策略 |

### 优化方案

**3.1 多层配置文件扫描（参考 Claude Code `bootstrap/state.ts` + `utils/claudemd.ts`）**

```typescript
// src/context/configScanner.ts
export interface ProjectContext {
  rootMd: string | null;      // 项目根 CLAUDE.md
  dirMds: Map<string, string>; // 子目录 CLAUDE.md
  globalMd: string | null;    // ~/.claude/CLAUDE.md
}

export class ConfigScanner {
  async scanProject(cwd: string): Promise<ProjectContext> {
    return {
      rootMd: await this.findFile(cwd, 'CLAUDE.md'),
      dirMds: await this.scanSubDirs(cwd, 'CLAUDE.md'),
      globalMd: await this.findFile(os.homedir(), '.claude/CLAUDE.md'),
    };
  }

  buildContextPrompt(ctx: ProjectContext): string {
    const parts: string[] = [];
    if (ctx.globalMd) parts.push(`# Global\n${ctx.globalMd}`);
    if (ctx.rootMd) parts.push(`# Project\n${ctx.rootMd}`);
    for (const [dir, content] of ctx.dirMds) {
      parts.push(`# ${dir}\n${content}`);
    }
    return parts.join('\n\n');
  }
}
```

**3.2 动态 Token 预算管理**

```typescript
// src/context/tokenBudget.ts (参考 Claude Code contextAnalysis)
export class TokenBudgetManager {
  constructor(private totalBudget: number) {}

  allocate(systemPromptTokens: number, toolResultsTokens: number) {
    const remaining = this.totalBudget - systemPromptTokens - toolResultsTokens;
    return {
      historyBudget: Math.floor(remaining * 0.6),
      contextBudget: Math.floor(remaining * 0.3),
      reserve: Math.floor(remaining * 0.1),
    };
  }

  truncateHistory(messages: Message[], budget: number): Message[] {
    let totalTokens = 0;
    const result: Message[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const msgTokens = this.estimateTokens(messages[i]);
      if (totalTokens + msgTokens > budget) break;
      result.unshift(messages[i]);
      totalTokens += msgTokens;
    }
    return result;
  }
}
```

---

## 4. REPL/交互体验

### 现状差距

| 特性 | Newma | Claude Code |
|------|-------|-------------|
| UI 框架 | readline + inquirer | Ink (React-based TUI) — `src/ink/` |
| 自动补全 | `AutoCompleter` 基础实现 | 文件路径补全、工具名补全、命令补全 |
| 输出渲染 | chalk 文本 | 富文本渲染：diff 高亮、代码块、工具调用折叠 |
| 权限交互 | 简单 y/n | 细粒度：`allowOnce`、`allowAlways`、`allowSession`、`deny` |

### 优化方案

**4.1 权限分级响应（参考 Claude Code 的权限模型）**

```typescript
// src/permissions/permissionResponse.ts
export type PermissionResponse = 
  | { action: 'allow_once' }
  | { action: 'allow_always'; tool: string; pattern?: string }
  | { action: 'allow_session'; tool: string }
  | { action: 'deny' };

export class PermissionPrompt {
  private alwaysAllowed: Map<string, Set<string>> = new Map();

  check(tool: string, input: unknown): PermissionResponse | null {
    const allowed = this.alwaysAllowed.get(tool);
    if (allowed && this.matchesAny(input, allowed)) {
      return { action: 'allow_always', tool };
    }
    return null; // 需要询问用户
  }

  async prompt(tool: string, input: unknown): Promise<PermissionResponse> {
    const cached = this.check(tool, input);
    if (cached) return cached;

    // 显示工具名、参数摘要、风险评估
    const risk = this.assessRisk(tool, input);
    // ... 使用 inquirer 或 ink 渲染交互界面
  }
}
```

---

## 5. 插件/技能系统

### 现状差距

| 特性 | Newma | Claude Code |
|------|-------|-------------|
| 技能发现 | 手动注册 | `SkillTool` — 自动发现 `CLAUDE.md` 中的 skill 指令 |
| MCP 支持 | 无 | 完整 MCP (Model Context Protocol) 客户端 — `src/services/mcp/` |
| 热加载 | 简单 loader | `streaming-skill-loader` + 文件监听变化自动重载 |
| 技能追踪 | 无 | `skillUsageTracking.ts` — 统计技能使用频率 |

### 优化方案

**5.1 MCP 客户端集成**

```typescript
// src/mcp/client.ts (参考 Claude Code services/mcp/)
export class MCPClient {
  private servers: Map<string, MCPServerConnection> = new Map();

  async connect(config: MCPServerConfig): Promise<void> {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: { ...process.env, ...config.env },
    });
    const client = new Client({ name: 'newma', version: '3.1.0' }, transport);
    await client.connect();
    
    // 注册 MCP 工具到本地 registry
    const tools = await client.listTools();
    for (const tool of tools.tools) {
      this.registry.register({
        name: `mcp:${config.name}:${tool.name}`,
        description: tool.description,
        execute: async (input) => {
          const result = await client.callTool({ name: tool.name, arguments: input });
          return this.formatResult(result);
        },
      });
    }
  }
}
```

**5.2 技能自动发现与热重载**

```typescript
// src/skills/autoDiscovery.ts
export class SkillAutoDiscovery {
  private watcher?: FSWatcher;
  private cache = new Map<string, Skill>();

  async scan(cwd: string): Promise<Map<string, Skill>> {
    // 扫描 CLAUDE.md、.skills/ 目录、package.json 的 skills 字段
    const files = await this.findSkillFiles(cwd);
    for (const file of files) {
      const skill = await this.loadSkill(file);
      this.cache.set(skill.name, skill);
    }
    return this.cache;
  }

  watch(cwd: string, onUpdate: (skill: Skill) => void): void {
    this.watcher = watch(cwd, { recursive: true }, (event, file) => {
      if (this.isSkillFile(file)) {
        this.reloadSkill(file).then(onUpdate);
      }
    });
  }
}
```

---

## 6. 优先级建议

| 优先级 | 优化项 | 预估工作量 | 影响 |
|--------|--------|-----------|------|
| P0 | 分层权限验证链 | 2-3天 | 安全性大幅提升 |
| P0 | 泛型 Stream + 变换管道 | 1-2天 | 流式体验质变 |
| P1 | 多层 CLAUDE.md 配置扫描 | 2天 | 上下文质量提升 |
| P1 | 权限分级响应 (allowOnce/Always) | 1天 | 用户体验提升 |
| P1 | 工具 Hook 系统 | 2天 | 扩展性提升 |
| P2 | 工具并行编排 | 3天 | 执行效率提升 |
| P2 | MCP 客户端 | 5天 | 生态兼容 |
| P2 | 动态 Token 预算 | 2天 | 长对话稳定性 |
| P3 | 技能自动发现 + 热重载 | 3天 | 开发体验 |
| P3 | Ink TUI 迁移 | 10天+ | 视觉体验（大工程） |

---

## 7. 关键 Claude Code 源码参考路径

| 模块 | 路径 |
|------|------|
| 工具抽象 | `src/Tool.ts` |
| 工具注册 | `src/tools.ts` |
| Bash 安全 | `src/tools/BashTool/*.ts` (15个文件) |
| 工具编排 | `src/services/tools/toolOrchestration.ts` |
| 工具执行 | `src/services/tools/toolExecution.ts` |
| 工具 Hook | `src/services/tools/toolHooks.ts` |
| 流式处理 | `src/utils/stream.ts` |
| 流式变换 | `src/utils/streamlinedTransform.ts` |
| 上下文构建 | `src/context.ts` |
| 上下文分析 | `src/utils/contextAnalysis.ts` |
| CLAUDE.md 扫描 | `src/utils/claudemd.ts` |
| MCP 客户端 | `src/services/mcp/` |
| 技能工具 | `src/tools/SkillTool/` |
| 技能追踪 | `src/utils/suggestions/skillUsageTracking.ts` |

---

## 8. 系统提示词架构（基于泄露源码分析）

> 参考：`CLAUDE_CODE_PROMPTS_ANALYSIS.md`（Claude Code 完整提示词逆向分析）

### 现状差距

| 特性 | Newma | Claude Code |
|------|-------|-------------|
| 提示词结构 | 单一 system prompt 拼接 | 静态缓存区 + 动态区分离，`SYSTEM_PROMPT_DYNAMIC_BOUNDARY` 标记 |
| Prompt Cache | 无 | 静态内容 `scope: 'global'` 缓存，动态内容 `systemPromptSection()` memoization |
| 子代理提示词 | 无专用子代理提示词 | 5种专用代理提示词（Explore/Plan/Verify/Agent创建/通用） |
| 上下文压缩 | 简单 token 截断 | 9节结构化压缩摘要（Primary Request → Optional Next Step） |
| 记忆系统 | 基础记忆 | 4种分类（user/feedback/project/reference）+ 使用前验证规则 |
| 安全指令 | 无专用安全指令 | `CYBER_RISK_INSTRUCTION` 独立模块 |

### 优化方案

**8.1 静态+动态提示词分离**

```typescript
// src/prompt/promptBuilder.ts
const SYSTEM_PROMPT_BOUNDARY = '___DYNAMIC_SECTION___';

export class PromptBuilder {
  private staticSections: string[] = [];
  private dynamicSections: string[] = [];

  addStatic(section: string): this {
    this.staticSections.push(section);
    return this;
  }

  addDynamic(section: string): this {
    this.dynamicSections.push(section);
    return this;
  }

  build(): string {
    return [
      ...this.staticSections,
      SYSTEM_PROMPT_BOUNDARY,
      ...this.dynamicSections,
    ].join('\n');
  }
}
```

**8.2 9节结构化上下文压缩**

```typescript
// src/compressor/structuredSummary.ts
export interface CompactSummary {
  primaryRequest: string;       // 用户所有明确请求
  keyConcepts: string;          // 技术概念、框架
  filesAndCode: string;         // 文件和代码段（含完整代码片段）
  errorsAndFixes: string;       // 所有错误及修复方式
  problemSolving: string;       // 已解决问题和持续排查
  userMessages: string;         // 所有非工具结果的用户消息
  pendingTasks: string;         // 待完成任务
  currentWork: string;          // 最近正在做的工作
  optionalNextStep?: string;    // 下一步（必须直接对应用户最近请求）
}

export function formatCompact(summary: CompactSummary): string {
  return `# Conversation Summary

## 1. Primary Request and Intent
${summary.primaryRequest}

## 2. Key Technical Concepts
${summary.keyConcepts}

## 3. Files and Code Sections
${summary.filesAndCode}

## 4. Errors and Fixes
${summary.errorsAndFixes}

## 5. Problem Solving
${summary.problemSolving}

## 6. All User Messages
${summary.userMessages}

## 7. Pending Tasks
${summary.pendingTasks}

## 8. Current Work
${summary.currentWork}
${summary.optionalNextStep ? `## 9. Optional Next Step\n${summary.optionalNextStep}` : ''}`;
}
```

**8.3 专用子代理提示词**

```typescript
// src/agents/prompts.ts

export const EXPLORE_AGENT_PROMPT = `You are a file search specialist.
=== CRITICAL: READ-ONLY MODE - NO FILE MODIFICATIONS ===
You are STRICTLY PROHIBITED from creating/modifying/deleting files or running
commands that change system state.
Make efficient use of tools. Spawn parallel tool calls for grepping and reading.`;

export const VERIFY_AGENT_PROMPT = `You are a verification specialist.
Your job is not to confirm it works — it's to try to break it.
You have two documented failure patterns:
1. Verification avoidance: find reasons not to run checks
2. Being seduced by the first 80%
The first 80% is the easy part. Your entire value is in finding the last 20%.

Anti-rationalization checks:
- "代码看起来正确" — 阅读不是验证，运行它
- "实现者的测试已通过" — 实现者也是 LLM，独立验证
- "这可能没问题" — "可能"不是验证`;
```

**8.4 记忆分类系统**

```typescript
// src/memory/types.ts
export type MemoryType = 'user' | 'feedback' | 'project' | 'reference';

export interface MemoryEntry {
  type: MemoryType;
  content: string;
  createdAt: number;
  source: string;  // 哪个会话产生的
}

export const MEMORY_GUIDELINES = {
  user: '用户角色、目标、知识 — 了解用户任何细节时保存',
  feedback: '用户对工作方式的指导 — 用户纠正或确认方法时保存',
  project: '项目工作、目标、事件 — 了解谁做什么、为什么、何时',
  reference: '外部系统资源指针 — 了解外部资源和用途时保存',
  // 不应保存：代码模式、架构、git历史、调试方案、CLAUDE.md内容
};

export const MEMORY_VERIFICATION_RULE = `Before recommending from memory:
- If the memory names a file path: check the file exists.
- If the memory names a function or flag: grep for it.
"The memory says X exists" is not the same as "X exists now."`;
```

---

## 9. 更新后的优先级

| 优先级 | 优化项 | 状态 | 影响 |
|--------|--------|------|------|
| P0 | 泛型 Stream + 变换管道 | ✅ 已完成 | 流式体验质变 |
| P1 | 多层 CLAUDE.md 配置扫描 | 🔄 Claude Code 执行中 | 上下文质量提升 |
| P1 | 权限分级响应 | 🔄 Claude Code 执行中 | 用户体验提升 |
| P1 | 工具 Hook 系统 | 🔄 Claude Code 执行中 | 扩展性提升 |
| P1 | **系统提示词架构重构** | 🆕 待实施 | 提示词效率+缓存命中 |
| P2 | **9节结构化上下文压缩** | 🆕 待实施 | 长对话稳定性 |
| P2 | **专用子代理提示词** | 🆕 待实施 | 多代理协作质量 |
| P2 | 动态 Token 预算 | 待实施 | 上下文管理 |
| P3 | 技能自动发现 + 热重载 | 待实施 | 开发体验 |
| P3 | **记忆分类系统** | 🆕 待实施 | 跨会话记忆质量 |

---

## 10. SOUL 文件系统（人格与身份）

> 融合 OpenClaw SOUL.md 的灵魂定义 + Claude Code CLAUDE.md 的项目约定，给 newma 注入独特人格。

### 设计理念

Claude Code 的 CLAUDE.md 是纯项目约定（做什么、怎么做），没有"灵魂"。OpenClaw 的 SOUL.md 定义了人格、价值观、沟通风格。newma 应该两者兼备。

### 多层文件结构

```
~/.newma/SOUL.md              # 全局灵魂（人格、价值观、风格）— 跨项目生效
~/.newma/MEMORY.md             # 全局长期记忆
<project>/NEWMA.md             # 项目约定（等同于 CLAUDE.md）
<project>/src/NEWMA.md         # 子目录约定
<project>/.newma/SOUL.md       # 项目级灵魂覆盖（可选）
<project>/.newma/MEMORY.md     # 项目级记忆
```

### SOUL.md 模板

```markdown
# SOUL.md - Newma 灵魂定义

## 身份
- **名字**: 牛码 (Newma)
- **物种**: AI 编程助手
- **风格**: 直接、高效、不废话
- **Emoji**: 🐂

## 核心原则
- 先做再问，能自己查就别打扰用户
- 不装，不懂就说不懂
- 代码质量 > 代码速度 > 代码数量
- 安全第一，破坏性操作必须确认

## 沟通风格
- 简短精炼，直奔主题
- 用代码说话，少用形容词
- 出错了直接说原因和修复方案
- 不用 emoji（除非用户要求）

## 边界
- 不主动推送代码到远程
- 不修改 .env 和密钥文件
- 不删除用户没确认的东西
- 群聊中不代替用户发言

## 记忆
每次会话是新开始，SOUL.md 和 MEMORY.md 是连续性的保障。
```

### NEWMA.md 模板（项目约定，等同 CLAUDE.md）

```markdown
# NEWMA.md - 项目约定

## 技术栈
- TypeScript + Node.js
- 测试框架: Jest
- 包管理: npm

## 规范
- 使用 2 空格缩进
- 变量名用 camelCase
- 每个函数不超过 50 行
- 所有 public 函数必须有 JSDoc

## 命令
- `npm run build` — 编译
- `npm test` — 运行测试
- `npm run dev` — 开发模式

## 常见问题
- config-validator.ts 有模板字面量 + chalk 的 TS 解析 bug，用字符串拼接替代
```

### 实现方案

```typescript
// src/context/soulLoader.ts
export interface SoulConfig {
  globalSoul: string | null;     // ~/.newma/SOUL.md
  projectSoul: string | null;   // .newma/SOUL.md
  projectRules: string | null;  // NEWMA.md
  subDirRules: Map<string, string>; // 子目录 NEWMA.md
}

export class SoulLoader {
  async load(cwd: string): Promise<SoulConfig> {
    const home = os.homedir();
    const globalSoul = await this.readIfExists(
      path.join(home, '.newma', 'SOUL.md')
    );
    const projectSoul = await this.readIfExists(
      path.join(cwd, '.newma', 'SOUL.md')
    );
    const projectRules = await this.findFileUpward(cwd, 'NEWMA.md');
    const subDirRules = await this.scanSubDirs(cwd, 'NEWMA.md');

    return { globalSoul, projectSoul, projectRules, subDirRules };
  }

  buildSystemPrompt(soul: SoulConfig): string {
    const parts: string[] = [];

    // 全局灵魂 → 项目灵魂 → 项目约定 → 子目录约定
    if (soul.globalSoul) {
      parts.push('<!-- Global Soul -->\n' + soul.globalSoul);
    }
    if (soul.projectSoul) {
      parts.push('<!-- Project Soul Override -->\n' + soul.projectSoul);
    }
    if (soul.projectRules) {
      parts.push('<!-- Project Rules -->\n' + soul.projectRules);
    }

    return parts.join('\n\n');
  }

  private async readIfExists(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  private async findFileUpward(
    startDir: string, filename: string
  ): Promise<string | null> {
    let dir = startDir;
    while (dir !== path.dirname(dir)) {
      const filePath = path.join(dir, filename);
      if (await this.fileExists(filePath)) {
        return await fs.readFile(filePath, 'utf-8');
      }
      dir = path.dirname(dir);
    }
    return null;
  }
}
```

### 与 PromptBuilder 集成

```typescript
// 在 prompt 构建时自动注入 SOUL
const soulLoader = new SoulLoader();
const soul = await soulLoader.load(process.cwd());
const soulPrompt = soulLoader.buildSystemPrompt(soul);

const builder = new PromptBuilder();
builder.addStatic(soulPrompt);  // 静态缓存区（SOUL 很少变）
builder.addDynamic(contextInfo); // 动态区（git状态等）
```

### 优先级更新

| 优先级 | 优化项 | 说明 |
|--------|--------|------|
| **P1** | **SOUL 文件系统** | 定义人格 + 项目约定，多层扫描，注入 system prompt |
