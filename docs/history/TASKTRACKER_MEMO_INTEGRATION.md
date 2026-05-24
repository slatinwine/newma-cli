# TaskTracker 与 Memo 集成方案

## 建议：混合方案（推荐）

### 核心思路
- **保持 TaskTracker 独立** - 因为职责和需求不同
- **统一数据存储** - 将任务数据移到 `.memo/` 目录
- **增强搜索能力** - 让 Memo 能搜索历史任务
- **统一命令接口** - 添加任务相关命令到 Memo

## 实施方案

### 1. 存储层统一

**修改 TaskStorage**：
```typescript
// src/task-tracker/storage.ts

export class TaskStorage {
  private dataDir: string; // 改为 .memo/tasks/

  constructor(config: TaskStorageConfig) {
    // 从 .kode/tasks 改为 .memo/tasks
    this.dataDir = join(config.projectRoot, '.memo', 'tasks');
    // ...
  }
}
```

**好处**：
- ✅ 所有项目记忆数据集中在一个目录
- ✅ 便于备份和迁移
- ✅ 与 Memo 的 decisions.json 和 index.json 在一起

### 2. 添加任务搜索到 Memo Plugin

**扩展 MemoCliPlugin**：
```typescript
// src/loop/plugins/memo-cli-plugin.ts

export class MemoCliPlugin implements LoopPlugin {
  // 现有方法...

  /**
   * 搜索相关任务
   */
  async searchTasks(query: string): Promise<TaskDocument[]> {
    const tasksPath = join(this.projectRoot, '.memo', 'tasks');

    // 读取所有任务文件
    const files = await readdir(tasksPath);
    const tasks: TaskDocument[] = [];

    for (const file of files) {
      const task = JSON.parse(
        await readFile(join(tasksPath, file), 'utf-8')
      );

      // 匹配查询
      if (task.requirement?.includes(query) ||
          task.id?.includes(query)) {
        tasks.push(task);
      }
    }

    return tasks;
  }
}
```

### 3. 添加任务命令

**扩展 memo-commands.ts**：
```typescript
// src/loop/commands/memo-commands.ts

export function registerMemoCommands(
  commandManager: CommandManager,
  memoPlugin: MemoCliPlugin,
  taskTracker?: TaskTracker // 新增参数
): void {
  // 现有命令...

  /**
   * /tasks - 查看任务历史
   */
  commandManager.register({
    name: 'tasks',
    description: 'Show task history',
    handler: async (context: CommandContext): Promise<CommandResult> => {
      if (!taskTracker) {
        return {
          success: false,
          error: 'Task tracker not available',
        };
      }

      const args = context.args;
      const filter: any = {};

      // 解析过滤参数
      if (args.includes('--completed')) {
        filter.status = 'completed';
      } else if (args.includes('--failed')) {
        filter.status = 'failed';
      }

      // 获取任务列表
      const tasks = await taskTracker.list(filter);

      let output = chalk.bold(`📋 Task History (${tasks.length} tasks)\n\n`);

      tasks.slice(0, 10).forEach((task) => {
        const date = new Date(task.createdAt).toLocaleDateString();
        const status = task.metadata.status;

        output += `${chalk.cyan(`[${date}]`)} ${task.requirement.substring(0, 50)}...\n`;
        output += `  Status: ${chalk.bold(status)} | Mode: ${task.mode}\n\n`;
      });

      return {
        success: true,
        output,
      };
    },
    help: {
      name: 'tasks',
      description: 'Show task history',
      usage: '/tasks [--completed|--failed]',
      examples: ['/tasks', '/tasks --completed'],
      category: 'memory',
    },
  }, 'memo');

  /**
   * /task-search - 搜索任务
   */
  commandManager.register({
    name: 'task-search',
    description: 'Search tasks by keyword',
    handler: async (context: CommandContext): Promise<CommandResult> => {
      const query = context.args[0];

      if (!query) {
        return {
          success: false,
          error: 'Usage: /task-search <query>',
        };
      }

      // 使用 Memo Plugin 搜索任务
      const tasks = await memoPlugin.searchTasks(query);

      let output = chalk.bold(`🔍 Found ${tasks.length} task(s)\n\n`);

      tasks.forEach((task) => {
        const date = new Date(task.createdAt).toLocaleDateString();
        output += `${chalk.cyan(`[${date}]`)} ${task.requirement}\n`;
        output += `  Status: ${task.metadata.status} | ID: ${task.id}\n\n`;
      });

      return {
        success: true,
        output,
      };
    },
    help: {
      name: 'task-search',
      description: 'Search tasks by keyword',
      usage: '/task-search <query>',
      examples: ['/task-search "auth"', '/task-search "refactor"'],
      category: 'memory',
    },
  }, 'memo');
}
```

### 4. AI 上下文增强（包含任务）

**扩展 getMemoContext**：
```typescript
// src/ai.ts

async function getMemoContext(
  requirement: string,
  memoPlugin?: MemoCliPlugin,
  taskTracker?: TaskTracker // 新增参数
): Promise<string> {
  if (!memoPlugin) {
    return '';
  }

  try {
    let context = '\n\n📚 PROJECT MEMORY:\n';

    // 1. 搜索相关决策（现有）
    const decisions = await memoPlugin.searchDecisions(requirement);
    if (decisions.length > 0) {
      context += '\nRelevant Decisions:\n';
      decisions.slice(0, 5).forEach((d) => {
        const date = new Date(d.timestamp).toLocaleDateString();
        context += `- [${date}] ${d.title}\n`;
      });
    }

    // 2. 查找相关代码（现有）
    const relatedCode = await memoPlugin.findRelated(requirement);
    if (relatedCode.length > 0) {
      context += '\nRelated Code:\n';
      relatedCode.slice(0, 5).forEach(({ file }) => {
        context += `- ${file}\n`;
      });
    }

    // 3. 🔥 新增：搜索相关任务
    if (taskTracker) {
      const tasks = await taskTracker.list({ limit: 3 });
      const recentTasks = tasks.filter(t =>
        t.requirement?.toLowerCase().includes(requirement.toLowerCase()) ||
        requirement.toLowerCase().includes(t.requirement?.split(' ')[0]?.toLowerCase() || '')
      );

      if (recentTasks.length > 0) {
        context += '\nRecent Tasks:\n';
        recentTasks.forEach((t) => {
          const date = new Date(t.createdAt).toLocaleDateString();
          const status = t.metadata.status;
          context += `- [${date}] ${status.toUpperCase()}: ${t.requirement.substring(0, 60)}...\n`;
        });
      }
    }

    return context;
  } catch (error) {
    console.log(chalk.gray(`[Memo] Failed to get context: ${error}`));
    return '';
  }
}
```

## 数据结构对比

### TaskTracker（保持不变）
```
.memo/
└── tasks/
    ├── session-123.json      # 当前任务（未压缩）
    ├── session-456.json.gz   # 旧任务（压缩）
    └── session-789.json.gz
```

### Memo（现有）
```
.memo/
├── decisions.json    # 决策记录
├── index.json        # 代码索引
└── tags.json         # 标签索引
```

### 统一后（推荐）
```
.memo/                          # 统一的记忆目录
├── decisions.json              # 决策
├── index.json                  # 代码索引
├── tags.json                   # 标签
└── tasks/                      # 任务（新增）
    ├── session-123.json
    ├── session-456.json.gz
    └── session-789.json.gz
```

## 使用示例

### 查看任务历史
```bash
[newma] ❯ /tasks
📋 Task History (156 tasks)

[2026-01-31] 添加用户认证功能
  Status: completed | Mode: plan

[2026-01-30] 重构状态管理
  Status: failed | Mode: plan

[2026-01-29] 优化性能
  Status: completed | Mode: execute
```

### 搜索任务
```bash
[newma] ❯ /task-search "auth"
🔍 Found 3 task(s):

[2026-01-31] 添加用户认证功能
  Status: completed | ID: session-123

[2026-01-25] 修复认证 bug
  Status: completed | ID: session-100

[2026-01-20] 设计认证架构
  Status: completed | ID: session-080
```

### AI 使用任务上下文
```bash
[newma] ❯ /plan 优化认证性能

📚 PROJECT MEMORY:

Relevant Decisions:
- [2026-01-20] 认证方案选择
  JWT + Refresh Token...

Related Code:
- src/services/auth.service.ts (classes: AuthService)

Recent Tasks:                        # 🔥 新增
- [2026-01-31] COMPLETED: 添加用户认证功能...
- [2026-01-25] COMPLETED: 修复认证 bug...

📋 Plan Generated:
# AI 基于过去的任务经验，生成更现实的计划
```

## 实施步骤

### Phase 1: 存储迁移（低风险）
1. 修改 TaskStorage 的 dataDir 为 `.memo/tasks/`
2. 添加迁移逻辑（自动将旧任务移到新位置）
3. 测试向后兼容

### Phase 2: 搜索集成（中风险）
1. 在 MemoCliPlugin 中添加 searchTasks 方法
2. 添加 /tasks 和 /task-search 命令
3. 测试搜索功能

### Phase 3: AI 上下文（低风险）
1. 修改 getMemoContext，添加 taskTracker 参数
2. 在 AI 调用时传递 taskTracker
3. 测试 AI 是否正确使用任务历史

## 优缺点分析

### 优点
✅ 统一数据存储（.memo/ 目录）
✅ 统一命令接口（所有记忆相关命令）
✅ AI 可以使用完整的上下文（决策+代码+任务）
✅ 便于备份和迁移
✅ 保持 TaskTracker 的独立性和专业性

### 缺点
⚠️ 需要修改存储路径（可能影响现有用户）
⚠️ 需要处理迁移逻辑
⚠️ 增加了一点复杂度

## 结论

**推荐采用混合方案**：
- 保持 TaskTracker 独立（职责分离）
- 统一存储到 `.memo/` 目录
- 增强 Memo 的搜索能力
- 让 AI 使用完整的上下文

这样既保持了系统的清晰性，又实现了数据的统一管理。
