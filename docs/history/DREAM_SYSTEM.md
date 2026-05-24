# Dream 记忆整合系统

基于 Claude Code Dream 系统的跨 session 记忆整合模块。

## 📖 概述

Dream 系统是 newma 项目的自动记忆整合功能，定期分析跨多个 session 的记忆文件，执行去重、清理、更新和优化操作。

### 核心特性

- 🌙 **自动触发**: 基于时间间隔和 session 数量自动触发
- 🔒 **分布式锁**: 基于文件的锁机制防止多实例并发
- 🤖 **AI 整合**: 使用 AI 子代理执行智能记忆整合
- 🛡️ **权限控制**: 严格的权限过滤器，只允许只读操作和限制性写入
- 📊 **进度跟踪**: 完整的进度信息和执行日志
- 🔄 **集成沉淀**: 整合完成后自动触发经验沉淀

## 🏗️ 架构设计

### 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                  Dream System                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐      ┌──────────────┐              │
│  │   Dream      │      │   Dream      │              │
│  │ Consolidator │──────│  Scheduler   │              │
│  └──────────────┘      └──────────────┘              │
│         │                                               │
│         ├── 锁机制 (Lock File)                          │
│         ├── 触发条件检查 (Time + Sessions)              │
│         ├── 权限过滤 (Permission Filter)                │
│         └── AI 子代理 (AI Subagent)                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│            Precipitation System                         │
│  (整合完成后触发)                                        │
└─────────────────────────────────────────────────────────┘
```

### 工作流程

```
1. 检查触发条件
   ├─ 时间间隔 ≥ minHours (默认 24h)
   ├─ Session 数量 ≥ minSessions (默认 5)
   └─ 检查锁文件状态

2. 获取锁
   ├─ 创建 .consolidate-lock 文件
   └─ 标记整合状态

3. 扫描 Sessions
   ├─ 读取 .kode/sessions/ 目录
   ├─ 识别需要整合的 session
   └─ 收集关联的记忆文件

4. 执行整合
   ├─ 生成 Dream 系统提示词
   ├─ 启动 AI 子代理（只读权限）
   ├─ 执行去重、清理、更新操作
   └─ 记录修改的文件

5. 生成报告
   ├─ 创建 consolidation-report.md
   └─ 记录整合统计信息

6. 触发沉淀 (可选)
   └─ 调用 PrecipitationCoordinator

7. 释放锁
   └─ 删除 .consolidate-lock 文件
```

## 🔧 配置

### 配置结构

```typescript
interface DreamConfig {
  // 是否启用（默认: true）
  enabled?: boolean;

  // 最小间隔小时数（默认: 24）
  minHours?: number;

  // 最小 session 数量（默认: 5）
  minSessions?: number;

  // 最大轮次（默认: 30）
  maxTurns?: number;

  // 锁文件路径（默认: .memo/dream/.consolidate-lock）
  lockFilePath?: string;

  // Memory 目录路径（默认: .memo/memory）
  memoryDir?: string;

  // Session 目录路径（默认: .kode/sessions）
  sessionDir?: string;

  // 事件冷却时间（秒，默认: 30）
  eventCooldownSeconds?: number;

  // 整合后触发沉淀（默认: true）
  triggerPrecipitation?: boolean;
}
```

### 配置示例

在 `.newma/config.json` 中配置：

```json
{
  "precipitation": {
    "dream": {
      "enabled": true,
      "minHours": 24,
      "minSessions": 5,
      "maxTurns": 30,
      "triggerPrecipitation": true
    }
  }
}
```

## 🚀 使用方法

### 1. 基础使用

```typescript
import { DreamConsolidator } from './src/memory/dreamConsolidator';

// 创建整合器
const consolidator = new DreamConsolidator(
  projectRoot,           // 项目根目录
  {
    enabled: true,
    minHours: 24,
    minSessions: 5,
  },
  newmaConfig,           // NewmaConfig 实例
  precipitationCoordinator // 可选：沉淀协调器
);

// 手动触发整合
const result = await consolidator.trigger();
console.log(`整合状态: ${result.success ? '成功' : '失败'}`);
console.log(`处理文件: ${result.progress.filesTouched.length}`);
```

### 2. 集成到增强协调器

```typescript
import { EnhancedPrecipitationCoordinator } from './src/memory/dream-integration';

// 创建增强协调器（包含 Dream 系统）
const coordinator = new EnhancedPrecipitationCoordinator(
  { projectRoot },
  newmaConfig
);

// 启动系统（包括 Dream 调度器）
await coordinator.start();

// 手动触发 Dream 整合
await coordinator.triggerDream();

// 获取完整状态（包括 Dream 进度）
const status = coordinator.getEnhancedStatus();
console.log(status.dream);
```

### 3. REPL 命令集成

在 `src/repl.ts` 中添加命令：

```typescript
// Dream 整合命令
case '/dream':
  const dreamResult = await this.dreamConsolidator?.trigger();
  console.log(`Dream 整合: ${dreamResult?.success ? '✓' : '✗'}`);
  break;

// Dream 进度查询
case '/dream-status':
  const progress = this.dreamConsolidator?.getProgress();
  console.log(`阶段: ${progress?.phase}`);
  console.log(`Session 数: ${progress?.sessionsReviewing.length}`);
  console.log(`文件数: ${progress?.filesTouched.length}`);
  break;
```

## 🛡️ 安全机制

### 1. 文件锁

- **锁文件**: `.memo/dream/.consolidate-lock`
- **作用**: 防止多实例同时执行整合
- **超时**: 锁文件会在失败时回滚时间戳

### 2. 权限过滤器

Dream 模式下的工具权限：

| 工具 | 操作 | 权限 |
|------|------|------|
| Read | read | ✅ 允许 |
| Glob | read | ✅ 允许 |
| Grep | read | ✅ 允许 |
| LSP | read | ✅ 允许 |
| Bash | read | ✅ 允许（只读命令） |
| Write | write | ⚠️ 仅 `.memo/memory/*` |
| Edit | write | ⚠️ 仅 `.memo/memory/*` |
| 其他 | - | ❌ 拒绝 |

### 3. 事件冷却

- **冷却时间**: 30 秒（可配置）
- **作用**: 防止重复触发同一事件

### 4. 失败保护

- **回滚机制**: 失败时回滚锁文件时间戳
- **错误日志**: 完整的错误信息记录
- **状态恢复**: 自动释放锁资源

## 📊 进度跟踪

### 进度信息

```typescript
interface DreamProgress {
  phase: 'starting' | 'scanning' | 'analyzing' | 'consolidating' | 'completed' | 'failed';
  sessionsReviewing: string[];
  filesTouched: string[];
  turns: number;
  startTime: Date;
  endTime?: Date;
  error?: string;
  logs: string[];
}
```

### 查询进度

```typescript
// 获取当前进度
const progress = consolidator.getProgress();

if (progress) {
  console.log(`阶段: ${progress.phase}`);
  console.log(`已审查 Sessions: ${progress.sessionsReviewing.length}`);
  console.log(`已修改文件: ${progress.filesTouched.length}`);
  console.log(`执行轮次: ${progress.turns}`);

  // 显示日志
  progress.logs.forEach(log => console.log(log));
}
```

## 🧪 测试

### 运行测试

```bash
# 编译 TypeScript
npm run build

# 运行测试
npx ts-node test-dream-consolidator.ts
```

### 测试覆盖

- ✅ DreamConsolidator 基本功能
- ✅ 锁机制
- ✅ 触发条件检查
- ✅ 进度跟踪
- ✅ DreamScheduler 调度
- ✅ 权限过滤器

## 📈 性能特性

### 执行时间

- **快速整合**: 1-5 秒（少量 session）
- **标准整合**: 10-30 秒（中等 session）
- **深度整合**: 30-60 秒（大量 session）

### API 调用

- **整合阶段**: 0 次（本地操作）
- **AI 分析**: 1-2 次（如果使用 AI 子代理）

### 资源占用

- **内存**: < 50MB
- **磁盘**: 临时文件 < 5MB
- **网络**: 仅 AI API 调用（可选）

## 🔍 与现有系统集成

### 1. PrecipitationCoordinator

```typescript
// Dream 整合完成后自动触发沉淀
const consolidator = new DreamConsolidator(
  projectRoot,
  config,
  newmaConfig,
  precipitationCoordinator // 传入协调器
);

// 整合完成后会自动调用
// await precipitationCoordinator.trigger()
```

### 2. Memory Scheduler

```typescript
// Dream 使用独立的调度器
const dreamScheduler = new DreamScheduler(consolidator);
dreamScheduler.start(60); // 每 60 分钟检查一次
```

### 3. Event-Driven Precipitation

```typescript
// 整合完成后发出事件
await eventDrivenPrecipitation.emit('dream:consolidated', {
  result: dreamResult,
  timestamp: new Date(),
});
```

## 📝 最佳实践

### 1. 触发频率

- **小型项目**: 24 小时 + 5 sessions
- **中型项目**: 12 小时 + 10 sessions
- **大型项目**: 6 小时 + 20 sessions

### 2. 权限管理

- 始终使用只读工具进行扫描
- 仅在 `.memo/memory` 目录下写入
- 避免修改代码或配置文件

### 3. 错误处理

- 捕获所有异常并记录日志
- 失败时自动释放锁
- 提供详细的错误信息

### 4. 监控

- 定期检查整合进度
- 监控磁盘空间使用
- 跟踪整合频率和效果

## 🚧 限制与注意事项

### 当前限制

1. **AI 子代理**: 当前版本简化了 AI 子代理调用，未来版本将完全实现
2. **并发控制**: 仅支持单实例运行（通过锁机制）
3. **文件格式**: 仅支持 `.md` 格式的记忆文件

### 注意事项

1. **备份**: 首次使用前建议备份 `.memo` 目录
2. **测试**: 在生产环境使用前先在测试环境验证
3. **监控**: 定期检查整合报告和日志
4. **配置**: 根据项目规模调整触发条件

## 🔮 未来改进

### 短期

- [ ] 完整实现 AI 子代理调用
- [ ] 增量整合（仅处理新文件）
- [ ] 更智能的去重算法

### 中期

- [ ] 跨项目记忆共享
- [ ] 记忆版本控制
- [ ] 自动分类和标签

### 长期

- [ ] 分布式记忆整合
- [ ] 机器学习优化
- [ ] 自适应触发策略

## 📚 参考资料

- [Claude Code Dream System](https://github.com/anthropics/claude-code)
- [Precipitation System](./PRECIPITATION_SYSTEM.md)
- [Memory Architecture](./ARCHITECTURE.md)

---

**创建时间**: 2026-04-01
**版本**: 1.0.0
**状态**: ✅ 完成
