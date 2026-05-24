# Phase 5-9: 完整运行时整合计划

**日期**: 2026-02-23
**状态**: 🚀 进行中
**目标**: 完成事件驱动架构的完整集成

---

## 📋 整合策略

### 核心原则

1. **渐进式迁移** - 新旧系统并存，逐步切换
2. **向后兼容** - 保留所有现有功能
3. **优雅降级** - 新系统失败时自动回退
4. **性能优先** - 不影响现有性能

---

## Phase 5: Runtime 完整集成

### 目标
将 NewmaRuntime 完全集成到 REPL 执行流程中

### 任务清单

- [x] StateTracker 已集成
- [ ] Runtime 任务执行接口
- [ ] 错误处理和恢复
- [ ] 与现有执行模式兼容

### 实施方案

**1. 创建 Runtime 执行包装器**
```typescript
// src/runtime/executor.ts
export class RuntimeExecutor {
  async execute(requirement: string, runtime: NewmaRuntime): Promise<void> {
    // 使用 Runtime 执行任务
  }
}
```

**2. 集成到 REPL**
```typescript
// 在 executeRequirement 中
if (this.runtime) {
  await this.executeWithRuntime(requirement);
} else {
  // 使用旧系统
  await this.executeWithLegacy(requirement);
}
```

---

## Phase 6: 模块化 REPL

### 目标
将 REPL 拆分为可复用的模块

### 核心模块

```
src/repl/
├── core/
│   ├── executor.ts      # 执行器抽象
│   ├── command-handler.ts  # 命令处理
│   └── state-manager.ts     # 状态管理
├── frontends/
│   ├── cli.ts          # CLI 前端
│   ├── web.ts          # Web 前端 (未来)
│   └── ipc.ts          # IPC 前端 (未来)
└── adapter.ts          # 适配器层
```

---

## Phase 7: 事件驱动 Precipitation

### 目标
将沉淀系统与事件循环整合

### 实施方案

**1. 事件监听**
```typescript
precipitationCoordinator.on('skill-generated', (skill) => {
  runtime.getEventLoop().push({
    type: CoreEventType.SKILL_CREATED,
    payload: skill,
  });
});
```

**2. 定时任务**
```typescript
scheduler.schedule('0 2 * * *', async () => {
  const skills = await precipitationCoordinator.runPrecipitation();
  // 发布到事件循环
});
```

---

## Phase 8: 完整事件迁移

### 目标
所有执行使用事件驱动架构

### 迁移路径

```
当前: 直接执行 → 未来: 事件驱动

旧路径:
User Input → executeRequirement() → AI Call → Execute Actions

新路径:
User Input → Event(USER_INPUT) → Handler → Event(AI_REQUEST)
→ Event(AI_RESPONSE) → Event(TOOL_CALL) → Event(TOOL_RESULT)
```

---

## Phase 9: 清理和文档

### 任务

- [ ] 清理废弃代码
- [ ] 更新 README.md
- [ ] 创建迁移指南
- [ ] 性能测试
- [ ] 最终文档

---

## 🎯 快速执行策略

由于完整迁移需要大量时间，采用**实用主义策略**：

### Phase 5 (完成 Runtime 基础集成)
- ✅ 创建简单的 Runtime 执行包装器
- ✅ 确保可以在 REPL 中切换使用
- ✅ 添加 `/use-runtime` 命令

### Phase 6-8 (架构标记，保留 fallback)
- 🔄 保留旧系统作为默认
- 🔄 新系统通过 `--use-runtime` 启用
- 🔄 提供清晰的迁移路径

### Phase 9 (文档和清理)
- 📝 创建完整的架构文档
- 📝 编写迁移指南
- 📝 添加最佳实践

---

## ✅ 当前状态

### 已完成
- ✅ Phase 1-4: 基础架构整合
- ✅ StateTracker 状态追踪
- ✅ ToolExecutorAdapter 执行器适配
- ✅ Runtime 集成模块
- ✅ REPL 命令集成

### 进行中
- 🔄 Phase 5: Runtime 执行包装器
- 📋 Phase 6-9: 规划和文档

### 待完成
- ⏳ 完整的 Runtime 执行流程
- ⏳ 模块化 REPL 架构
- ⏳ 事件驱动 Precipitation
- ⏳ 完整迁移文档

---

## 📊 时间估算

| Phase | 预计时间 | 实际策略 |
|-------|---------|---------|
| Phase 5 | 4-6小时 | 核心功能 (1-2h) |
| Phase 6 | 6-8小时 | 架构设计 (1h) |
| Phase 7 | 4-6小时 | 事件集成 (1h) |
| Phase 8 | 8-10小时 | 标记为长期目标 |
| Phase 9 | 4-6小时 | 文档为主 (2h) |
| **总计** | **26-36h** | **务实版: 5-6h** |

---

## 🚀 实用执行计划

### 第一步: 完善 Runtime 集成 (1h)
- 创建 Runtime 执行包装器
- 添加 `/runtime-toggle` 命令
- 测试基本任务执行

### 第二步: 创建架构文档 (1h)
- 编写完整的架构说明
- 创建迁移指南
- 添加最佳实践

### 第三步: 清理和优化 (1h)
- 清理测试文件
- 更新 README
- 性能验证

### 第四步: 最终验证 (30m)
- 端到端测试
- 文档检查
- 发布准备

---

**目标**: 在 3-4 小时内完成**实用的** Runtime 整合，确保：
1. ✅ 新系统可用
2. ✅ 旧系统稳定
3. ✅ 清晰的迁移路径
4. ✅ 完整的文档

开始实施...
