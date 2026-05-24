# Dream 记忆整合系统 - 快速开始

## 🚀 5分钟快速上手

### 1. 编译项目

```bash
npm run build
```

### 2. 运行测试

```bash
# 完整测试
npx ts-node test-dream-complete.ts

# 简单测试
npx ts-node test-dream-simple.ts
```

### 3. 基础使用

```typescript
import { DreamConsolidator } from './dist/memory/dreamConsolidator';

// 创建整合器
const consolidator = new DreamConsolidator(
  '/path/to/project',  // 项目根目录
  {
    enabled: true,
    minHours: 24,      // 至少24小时间隔
    minSessions: 5,    // 至少5个新session
  },
  newmaConfig          // NewmaConfig 实例
);

// 检查是否应该触发
if (await consolidator.shouldTrigger()) {
  // 执行整合
  const result = await consolidator.trigger();
  console.log(`成功: ${result.success}`);
  console.log(`处理文件: ${result.progress.filesTouched.length}`);
}
```

### 4. 集成到现有系统

```typescript
import { EnhancedPrecipitationCoordinator } from './dist/memory/dream-integration';

// 使用增强协调器（自动包含 Dream 系统）
const coordinator = new EnhancedPrecipitationCoordinator(
  { projectRoot: '/path/to/project' },
  newmaConfig
);

// 启动系统（Dream 调度器自动启动）
await coordinator.start();

// 手动触发 Dream 整合
await coordinator.triggerDream();

// 查看完整状态（包括 Dream）
const status = coordinator.getEnhancedStatus();
console.log(status.dream);
```

## ⚙️ 配置示例

在 `.newma/config.json` 中添加：

```json
{
  "precipitation": {
    "enabled": true,
    "schedule": "0 2 * * *",
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

## 📋 配置参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `enabled` | `true` | 是否启用 Dream 系统 |
| `minHours` | `24` | 最小间隔小时数 |
| `minSessions` | `5` | 最小 session 数量 |
| `maxTurns` | `30` | 最大整合轮次 |
| `memoryDir` | `.memo/memory` | 记忆文件目录 |
| `sessionDir` | `.kode/sessions` | Session 文件目录 |
| `eventCooldownSeconds` | `30` | 事件冷却时间（秒） |
| `triggerPrecipitation` | `true` | 整合后触发沉淀 |

## 🔍 查看进度

```typescript
// 获取当前进度
const progress = consolidator.getProgress();

if (progress) {
  console.log(`阶段: ${progress.phase}`);
  console.log(`Sessions: ${progress.sessionsReviewing.length}`);
  console.log(`文件: ${progress.filesTouched.length}`);

  // 查看日志
  progress.logs.forEach(log => console.log(log));
}
```

## 🛡️ 安全特性

- ✅ **文件锁**: 防止多实例并发
- ✅ **权限控制**: 只读工具 + 限制性写入
- ✅ **事件冷却**: 防止重复触发
- ✅ **失败回滚**: 自动恢复锁状态

## 📊 整合报告

整合完成后，会在 `.memo/memory/consolidation-report.md` 生成报告：

```markdown
# Memory Consolidation Report

**Generated**: 2026-04-01T10:38:49.271Z
**Sessions Reviewed**: 5
**Memory Files**: 2
**Files Touched**: 2

## Sessions Analyzed
- **session-xxx** (2 memory files)

## Files Modified
- .memo/memory/user.md
- .memo/memory/feedback.md
```

## 🧪 测试命令

```bash
# 完整测试（推荐）
npx ts-node test-dream-complete.ts

# 基础测试
npx ts-node test-dream-simple.ts

# 查看测试输出
npx ts-node test-dream-complete.ts 2>&1 | less
```

## 📚 更多文档

- **完整文档**: [DREAM_SYSTEM.md](./DREAM_SYSTEM.md)
- **实现总结**: [DREAM_IMPLEMENTATION_SUMMARY.md](./DREAM_IMPLEMENTATION_SUMMARY.md)
- **沉淀系统**: [PRECIPITATION_SYSTEM.md](./PRECIPITATION_SYSTEM.md)

## 🐛 故障排除

### 问题：整合不触发

**检查**:
1. 是否满足 `minHours` 条件？
2. 是否有足够的 sessions（`minSessions`）？
3. 是否被锁住（查看 `.memo/dream/.consolidate-lock`）？

**解决**:
```bash
# 手动删除锁文件
rm .memo/dream/.consolidate-lock

# 或在代码中
await consolidator.releaseLock();
```

### 问题：编译错误

**解决**:
```bash
# 清理并重新编译
rm -rf dist/
npm run build
```

### 问题：测试失败

**检查**:
1. 是否已编译（`npm run build`）？
2. 是否有权限创建测试文件？
3. 端口是否被占用？

## 💡 使用建议

1. **开发环境**: 使用较小的触发条件（minHours=1, minSessions=2）
2. **生产环境**: 使用默认值（minHours=24, minSessions=5）
3. **测试**: 始终在测试环境先验证
4. **监控**: 定期检查整合报告和日志

## 🎯 下一步

1. 集成到 REPL（添加 `/dream` 命令）
2. 配置定时任务（自动触发）
3. 监控整合效果
4. 根据项目调整参数

---

**快速帮助**:
- 查看配置: `consolidator.getConfig()`
- 查看进度: `consolidator.getProgress()`
- 查看状态: `consolidator.isConsolidating()`
- 手动触发: `await consolidator.trigger()`
