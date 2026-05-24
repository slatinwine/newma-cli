# Phase 8: 完整事件迁移路径设计

**日期**: 2026-02-23
**状态**: 设计完成
**目标**: 定义从当前执行模式到完全事件驱动架构的迁移路径

---

## 📋 迁移策略概述

### 核心原则

1. **渐进式迁移** - 分阶段迁移，每步都可回退
2. **双轨运行** - 新旧系统并存，保证稳定性
3. **功能对等** - 确保所有现有功能在新架构中可用
4. **性能优先** - 不降低现有性能

---

## 🔄 当前执行流程（旧系统）

```
用户输入
    ↓
REPLManager.handleInput()
    ↓
判断是否命令
    ├─ 是: dispatchCommand()
    └─ 否: executeRequirement()
            ↓
        根据模式选择
            ├─ chat: chatMode()
            ├─ plan: executeRequirement() → callAI()
            ├─ do: executeRequirement() → callAI() → executeActions()
            └─ loop: executeRequirement() → plan → do → verify
```

**特点**:
- ✅ 直接调用，简单直接
- ❌ 紧耦合，难以扩展
- ❌ 缺乏统一的状态管理
- ❌ 难以插件化

---

## 🚀 目标执行流程（新系统）

```
用户输入
    ↓
Event(USER_INPUT)
    ↓
EventLoop.push()
    ↓
EventProcessor
    ├─ 判断事件类型
    ├─ 路由到对应处理器
    └─ 处理器发布新事件
        ↓
    Event(AI_REQUEST)
        ↓
    Event(AI_RESPONSE)
        ↓
    Event(TOOL_CALL)
        ↓
    Event(TOOL_RESULT)
        ↓
    Event(OBSERVATION_END)
        ↓
    Event(LOOP_END)
```

**特点**:
- ✅ 解耦，易于扩展
- ✅ 统一的状态管理
- ✅ 易于插件化
- ✅ 完整的可观测性

---

## 📊 迁移阶段

### 阶段 1: 事件包装器（当前）

**目标**: 不改变现有逻辑，用事件包装现有调用

**实施**:
```typescript
// 旧代码
async executeRequirement(requirement: string, mode: string) {
  const response = await callAI(...);
  // ...
}

// 新代码（事件包装）
async executeRequirement(requirement: string, mode: string) {
  // 发布输入事件
  if (this.runtime) {
    this.runtime.getEventLoop().push({
      type: CoreEventType.USER_INPUT,
      payload: { input: requirement, mode },
    });
  }

  // 保持原有逻辑
  const response = await callAI(...);

  // 发布响应事件
  if (this.runtime) {
    this.runtime.getEventLoop().push({
      type: CoreEventType.AI_RESPONSE,
      payload: { response },
    });
  }
}
```

**状态**: ✅ Phase 1-5 已完成

**优点**:
- 零破坏性
- 兼容现有系统
- 易于回退

**缺点**:
- 重复代码
- 不彻底

---

### 阶段 2: 双路径执行（Phase 5）

**目标**: 根据配置选择执行路径

**实施**:
```typescript
async executeRequirement(requirement: string, mode: string) {
  if (this.session.isUsingRuntime()) {
    // 新路径：事件驱动
    return await this.executeWithRuntime(requirement, mode);
  } else {
    // 旧路径：直接执行
    return await this.executeWithLegacy(requirement, mode);
  }
}

async executeWithRuntime(requirement: string, mode: string) {
  const runtime = this.runtime;
  if (!runtime) {
    throw new Error('Runtime not initialized');
  }

  // 发布事件到事件循环
  runtime.getEventLoop().push({
    type: CoreEventType.USER_INPUT,
    payload: { input: requirement, mode },
  });

  // 等待完成
  return await this.waitForRuntimeCompletion();
}
```

**状态**: ✅ Phase 5 已完成

**优点**:
- 用户可选择
- 性能对比直观
- 逐步迁移

**缺点**:
- 维护两套代码

---

### 阶段 3: 完全事件驱动（Phase 8 - 长期目标）

**目标**: 所有执行都通过事件循环

**实施**:

#### 3.1 事件处理器注册

```typescript
// 注册事件处理器
runtime.getEventLoop().registerHandler(CoreEventType.USER_INPUT, async (event) => {
  const { input, mode } = event.payload;

  // 发布 AI 请求事件
  return {
    type: CoreEventType.AI_REQUEST,
    payload: { prompt: input, mode },
  };
});

runtime.getEventLoop().registerHandler(CoreEventType.AI_REQUEST, async (event) => {
  const { prompt, mode } = event.payload;

  // 调用 AI
  const response = await callAI(...);

  // 发布 AI 响应事件
  return {
    type: CoreEventType.AI_RESPONSE,
    payload: { response },
  };
});

runtime.getEventLoop().registerHandler(CoreEventType.AI_RESPONSE, async (event) => {
  const { response } = event.payload;

  // 处理工具调用
  if (response.toolCalls && response.toolCalls.length > 0) {
    return {
      type: CoreEventType.TOOL_CALL,
      payload: { toolCalls: response.toolCalls },
    };
  }

  // 否则结束
  return {
    type: CoreEventType.LOOP_END,
    payload: { response },
  };
});

runtime.getEventLoop().registerHandler(CoreEventType.TOOL_CALL, async (event) => {
  const { toolCalls } = event.payload;

  // 执行工具调用
  const results = await Promise.all(
    toolCalls.map(call => executeToolCall(call))
  );

  // 发布工具结果事件
  return {
    type: CoreEventType.TOOL_RESULT,
    payload: { results },
  };
});

runtime.getEventLoop().registerHandler(CoreEventType.TOOL_RESULT, async (event) => {
  const { results } = event.payload;

  // 继续循环
  return {
    type: CoreEventType.OBSERVATION_END,
    payload: { results },
  };
});
```

#### 3.2 启动事件循环

```typescript
async startEventLoop() {
  const runtime = await createAndInitializeRuntime();

  // 注册所有处理器
  this.registerEventHandlers(runtime);

  // 启动事件循环
  await runtime.start();

  this.runtime = runtime;
}
```

#### 3.3 执行用户需求

```typescript
async executeRequirement(requirement: string, mode: string) {
  if (!this.runtime) {
    throw new Error('Event loop not started');
  }

  // 发布用户输入事件
  this.runtime.getEventLoop().push({
    type: CoreEventType.USER_INPUT,
    payload: { input: requirement, mode },
  });

  // 等待循环结束
  return await this.waitForLoopEnd();
}
```

**状态**: 📋 长期目标（Phase 8）

**优点**:
- 完全解耦
- 易于扩展
- 完整的可观测性

**缺点**:
- 需要大量重构
- 可能影响性能
- 需要充分测试

---

## 🎯 迁移时间线

### 短期（1-2个月）
- ✅ **Phase 1-5**: 事件包装 + 双路径执行（已完成）
- ✅ **Phase 6**: 模块化 REPL 接口（已完成）
- ✅ **Phase 7**: 事件驱动 Precipitation（已完成）

### 中期（3-6个月）
- 📋 **Phase 8.1**: 实现核心事件处理器
- 📋 **Phase 8.2**: 迁移常用执行路径
- 📋 **Phase 8.3**: 性能优化和测试

### 长期（6-12个月）
- 📋 **Phase 8.4**: 完全迁移到事件驱动
- 📋 **Phase 8.5**: 移除旧执行路径（可选）
- 📋 **Phase 9**: 清理和优化

---

## 🔧 技术细节

### 事件流设计

```typescript
// 完整的事件流
USER_INPUT
  → AI_REQUEST
  → AI_RESPONSE
  → TOOL_CALL? (如果需要)
  → TOOL_RESULT
  → OBSERVATION_END
  → LOOP_END
```

### 错误处理

```typescript
// 错误事件
runtime.getEventLoop().registerHandler(CoreEventType.ERROR, async (event) => {
  const { error } = event.payload;

  // 记录错误
  console.error('[EventLoop] Error:', error);

  // 发布错误恢复事件
  return {
    type: CoreEventType.ERROR_RECOVERY,
    payload: { error, action: 'retry' },
  };
});
```

### 优先级队列

```typescript
// 优先级事件
runtime.getEventLoop().steer({
  type: CoreEventType.ABORT,
  payload: { reason: 'User cancelled' },
});

// 普通事件
runtime.getEventLoop().push({
  type: CoreEventType.USER_INPUT,
  payload: { input: 'hello' },
});

// 后续事件
runtime.getEventLoop().followUp({
  type: CoreEventType.LOGGING,
  payload: { message: 'Task completed' },
});
```

---

## ✅ 验收标准

### 功能完整性
- [ ] 所有现有功能在事件驱动模式下可用
- [ ] 性能不低于旧系统
- [ ] 错误处理完整

### 可观测性
- [ ] 事件流可视化
- [ ] 性能指标收集
- [ ] 状态追踪完整

### 可扩展性
- [ ] 插件系统完善
- [ ] 事件处理器易于注册
- [ ] 支持自定义事件

---

## 📝 实施清单

### Phase 8.1: 核心事件处理器
- [ ] 实现 USER_INPUT 处理器
- [ ] 实现 AI_REQUEST 处理器
- [ ] 实现 AI_RESPONSE 处理器
- [ ] 实现 TOOL_CALL 处理器
- [ ] 实现 TOOL_RESULT 处理器

### Phase 8.2: 执行路径迁移
- [ ] 迁移 chat 模式
- [ ] 迁移 plan 模式
- [ ] 迁移 do 模式
- [ ] 迁移 loop 模式

### Phase 8.3: 优化和测试
- [ ] 性能基准测试
- [ ] 压力测试
- [ ] 集成测试
- [ ] 文档完善

---

## 🎓 经验总结

### 成功因素
1. **渐进式迁移** - 分阶段实施，每步可验证
2. **双轨运行** - 新旧系统并存，降低风险
3. **用户选择** - 用户掌控迁移节奏
4. **完整测试** - 每个阶段都有充分测试

### 注意事项
1. **性能监控** - 确保新系统性能不降低
2. **错误处理** - 完整的错误处理和恢复机制
3. **文档同步** - 代码和文档同步更新
4. **用户反馈** - 收集用户反馈，持续改进

---

**设计完成**: 2026-02-23
**版本**: 3.0.0 (Event-Driven Architecture)
**状态**: ✅ 设计完成，等待实施
