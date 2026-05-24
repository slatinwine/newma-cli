# Task Tracker 快速使用指南

## 🚀 立即开始

### 启动 Loop REPL（自动启用任务跟踪）
```bash
npx ts-node src/cli.ts -i --loop-engine
```

### 你会看到
```
✅ Task Lifecycle Plugin registered

[kode] (loop) ❯
```

## 📋 基本使用

### 自动任务跟踪
```
[kode] (loop) ❯ 添加用户登录功能
# → 自动创建任务
# → 自动记录执行过程
# → 自动保存到磁盘

[kode] (loop) ❯ 创建数据库模型
# → 又一个新任务
# → 完整记录

[kode] (loop) ❯ /tasks
# → 查看所有任务
```

### 查看任务详情
```
[kode] (loop) ❯ /task <task-id>
# → 显示完整任务信息
```

## 📂 任务存储

### 位置
```
.newma/tasks/
├── <task-id-1>.json
├── <task-id-2>.json
└── <task-id-3>.json
```

### 任务文件内容
```json
{
  "id": "unique-id",
  "sessionId": "session-id",
  "status": "completed",
  "mode": "execute",
  "requirement": "添加用户登录功能",
  "reasoning": { ... },
  "execution": { ... },
  "metadata": { ... }
}
```

## 🔧 高级功能

### 插件开发
```typescript
// 创建自定义插件
class MyPlugin implements LoopPlugin {
  id = 'my-plugin';
  name = 'My Plugin';
  type = 'loop';

  async onBeforeInput(input: string, context: LoopPluginContext) {
    // 修改输入
    if (input.startsWith('!')) {
      return {
        modifiedInput: `/plan ${input.slice(1)}`
      };
    }
    return { shouldContinue: true };
  }
}

// 注册插件
engine.registerPlugin(new MyPlugin());
```

### 任务数据导出
```typescript
// 导出为 JSON
const task = await tracker.getTask('task-id');
const json = await tracker.exportTask('task-id', 'json');

// 导出为 Markdown
const md = await tracker.exportTask('task-id', 'markdown');
```

## 📊 任务状态

### 生命周期
```
pending → running → completed
                 ↘ failed
                 ↘ aborted
```

### 状态查询
```typescript
// 获取当前任务
const current = tracker.getCurrentTask();

// 列出所有任务
const all = await tracker.listTasks();

// 按状态筛选
const completed = await tracker.listTasks({ status: 'completed' });
const failed = await tracker.listTasks({ status: 'failed' });
```

## 🎯 最佳实践

### 1. 使用 Loop REPL 获得最佳体验
```bash
# ✅ 推荐：自动任务跟踪
npx ts-node src/cli.ts -i --loop-engine

# ❌ 不推荐：无自动跟踪
npx ts-node src/cli.ts -i
```

### 2. 定期查看任务历史
```
[kode] (loop) ❯ /tasks
# → 了解项目进展
# → 查看执行历史
# → 分析失败任务
```

### 3. 利用任务数据
- 生成项目报告
- 分析执行效率
- 追踪 Bug 修复
- 文档生成

## 🔍 故障排查

### 任务未创建？
1. 确认使用了 `--loop-engine` 标志
2. 检查是否看到 "Task Lifecycle Plugin registered" 消息
3. 输入的是非命令内容（不是 `/xxx`）

### 任务未保存？
1. 检查 `.newma/tasks/` 目录权限
2. 确认任务状态为 `completed`
3. 查看错误日志

### 插件未注册？
1. 确认 `enablePlugins: true`
2. 检查 `getTaskLifecyclePlugin()` 返回值
3. 查看编译错误

## 📞 更多信息

- **完整文档**: [TASK_TRACKER_INTEGRATION_COMPLETE.md](./TASK_TRACKER_INTEGRATION_COMPLETE.md)
- **Loop 系统指南**: [LOOP_INTEGRATION_GUIDE.md](./LOOP_INTEGRATION_GUIDE.md)
- **项目文档**: [CLAUDE.md](./CLAUDE.md)
- **README**: [README.md](./README.md)

## ✨ 新功能亮点

- ✅ **自动任务创建** - 任何输入自动创建任务
- ✅ **实时状态更新** - 任务状态实时跟踪
- ✅ **持久化存储** - 自动保存到磁盘
- ✅ **完整执行记录** - 记录每个操作
- ✅ **灵活查询** - 按状态、时间筛选
- ✅ **数据导出** - JSON/Markdown 格式
- ✅ **插件扩展** - 自定义插件支持

---

**立即开始**: `npx ts-node src/cli.ts -i --loop-engine`
**问题反馈**: 查看 TASK_TRACKER_INTEGRATION_COMPLETE.md
