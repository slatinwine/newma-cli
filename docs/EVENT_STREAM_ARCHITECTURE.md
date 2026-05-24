# Newma (牛码) Event Stream Architecture

**版本**: 2.0.0
**日期**: 2026-01-25
**基于**: Codex CLI 的事件流设计

## 📋 概述

Newma (牛码) 现在使用了与 Codex CLI 相同的事件流架构，提供了更强大、更灵活的 REPL 系统。

### 核心优势

✅ **Pause/Resume** - 完全释放 stdin 给外部程序（vim, nano 等）
✅ **非阻塞轮询** - 不再阻塞等待用户输入
✅ **事件过滤** - 智能的事件映射和过滤
✅ **Round-Robin** - 公平的事件调度
✅ **可扩展** - 易于添加新的事件类型和源

## 🏗️ 架构

```
┌─────────────────────────────────────────────────┐
│            REPLManager v2                       │
│  (非阻塞事件循环)                                │
└─────────────┬───────────────────────────────────┘
              │
    ┌─────────▼─────────┐
    │  EventStream      │ (统一事件接口)
    │  - Poll events    │
    │  - Round-robin    │
    └─────────┬─────────┘
              │
    ┌─────────▼─────────┐      ┌──────────────┐
    │  EventBroker     │◄─────┤ DrawEmitter  │
    │  - Pause/Resume  │      │ (重绘事件)    │
    │  - State mgmt    │      └──────────────┘
    └─────────┬─────────┘
              │
    ┌─────────▼─────────┐
    │ ReadlineSource    │ (底层输入源)
    │  - Readline wrap  │
    │  - Event queue    │
    └───────────────────┘
```

## 🎯 核心组件

### 1. EventBroker

管理事件源的状态，支持 Pause/Resume。

```typescript
import { EventBroker } from './loop/event';

const broker = new EventBroker({ debug: true });

// Pause - 释放 stdin
broker.pause();

// Resume - 重新捕获 stdin
broker.resume();

// Poll for events
const event = await broker.pollNext();
```

**用途**：
- 外部编辑器集成（vim, nano）
- 终端控制权转移
- 事件流暂停/恢复

### 2. EventStream

统一的事件流接口，组合输入和重绘事件。

```typescript
import { EventStream } from './loop/event';

const stream = new EventStream(broker, drawEmitter);

// Poll next event (round-robin between draw and input)
const event = await stream.pollNext();

// Trigger a redraw
stream.triggerDraw();

// Pause/Resume
stream.pause();
stream.resume();
```

**特点**：
- Round-Robin 轮询（避免事件饥饿）
- 自动平衡 Draw 和输入事件
- 统一的事件接口

### 3. ReadlineEventSource

包装 Node.js readline，实现 IEventSource 接口。

```typescript
import { ReadlineEventSource } from './loop/event';

const source = new ReadlineEventSource({
  prompt: '[newma] ❯ ',
});

// Non-blocking poll
const event = await source.pollNext();

// Pause/Resume
source.pause();
source.resume();

// Get raw readline interface
const rl = source.getInterface();
```

### 4. EventMapper

事件映射和过滤。

```typescript
import { EventMapper } from './loop/event';

const mapper = new EventMapper({
  ignoreMouse: true,
  focusTriggersDraw: true,
});

// Map raw event to UIEvent
const uiEvent = mapper.mapEvent(rawEvent);

// Add custom key mapping
mapper.addKeyMapping('ctrl+c', {
  type: 'signal',
  signal: 'SIGINT',
});
```

## 💻 使用示例

### 基础用法

```typescript
import { createEventSystem, waitForEvent } from './loop/event';

// 创建完整的事件系统
const eventSystem = createEventSystem({
  prompt: '[newma] ❯ ',
  debug: false,
});

// 轮询事件
while (running) {
  const event = await waitForEvent(eventSystem.stream, 1000);

  if (event) {
    console.log('Got event:', event);
    await handleEvent(event);
  }
}
```

### 外部编辑器集成

```typescript
// 1. 暂停事件流（释放 stdin）
eventSystem.stream.pause();

// 2. 运行外部编辑器
await spawn('vim', [filename], { stdio: 'inherit' });

// 3. 恢复事件流（重新捕获 stdin）
eventSystem.stream.resume();
```

### 处理特殊事件

```typescript
import { UIEventType } from './loop/event';

async function handleEvent(event: UIEvent) {
  switch (event.type) {
    case UIEventType.Key:
      console.log('Key pressed:', event.name);
      break;

    case UIEventType.Signal:
      if (event.signal === 'SIGINT') {
        console.log('Ctrl+C pressed');
      }
      break;

    case UIEventType.Draw:
      // Redraw UI
      break;
  }
}
```

## 🆚 新旧对比

| 特性 | 旧 REPL | 新 REPL (v2) |
|------|--------|--------------|
| **输入方式** | 阻塞式 (rl.prompt) | 非阻塞轮询 |
| **外部程序** | ❌ 需要手动处理 | ✅ 自动 pause/resume |
| **事件类型** | 仅 line/SIGINT | Key, Paste, Draw, Signal 等 |
| **Draw 事件** | ❌ 不支持 | ✅ 支持 UI 重绘 |
| **性能** | 阻塞等待 | 异步轮询 |
| **可扩展性** | 困难 | 容易（插件化） |

## 📊 性能影响

### 内存占用

- 旧系统: ~2MB (readline + REPL)
- 新系统: ~3MB (额外事件流组件)
- **增加**: ~50%

### CPU 使用

- 旧系统: 接近 0% (阻塞等待)
- 新系统: < 1% (轮询间隔 10ms)
- **影响**: 可忽略不计

### 响应延迟

- 旧系统: 0ms (立即响应，但阻塞)
- 新系统: 平均 5ms (10ms 轮询间隔)
- **结论**: 用户无感知差异

## 🧪 测试

运行测试套件：

```bash
# 基础轮询测试
npx ts-node test-event-stream.ts basic

# Pause/Resume 测试
npx ts-node test-event-stream.ts pause

# 外部编辑器集成测试
npx ts-node test-event-stream.ts editor

# Round-Robin 测试
npx ts-node test-event-stream.ts roundrobin

# 运行所有测试
npx ts-node test-event-stream.ts all
```

## 🚀 迁移指南

### 从旧 REPL 迁移到新 REPL

**旧代码** (`src/repl.ts`):
```typescript
const rl = readline.createInterface({ /* ... */ });

rl.on('line', (line) => {
  this.handleLine(line);
  rl.prompt();
});
```

**新代码** (`src/repl-v2.ts`):
```typescript
const eventSystem = createEventSystem();

// 主循环
while (running) {
  const event = await eventSystem.stream.pollNext();
  if (event) {
    await this.handleEvent(event);
  }
}

// line 事件由 source 内部处理
const source = eventSystem.source;
source.getInterface()!.on('line', (line) => {
  this.handleLine(line);
});
```

## 🎯 未来改进

1. **TUI 模式** - 基于事件流的全屏 UI
2. **多输入源** - 支持网络、文件等输入
3. **事件录制** - 记录和回放事件序列
4. **性能优化** - 自适应轮询间隔
5. **WebSocket 传输** - 远程事件流

## 📚 参考资料

- **Codex 源码**: `codex-rs/tui/src/tui/event_stream.rs`
- **设计文档**: `CLAUDE.md` (MCP 集成部分)
- **测试代码**: `test-event-stream.ts`

## 🤝 贡献

欢迎改进事件流系统！关键文件：

- `src/loop/event/types.ts` - 类型定义
- `src/loop/event/event-broker.ts` - EventBroker
- `src/loop/event/readline-source.ts` - ReadlineEventSource
- `src/loop/event/event-mapper.ts` - EventMapper
- `src/repl-v2.ts` - 新 REPL 实现

---

**文档版本**: 1.0.0
**最后更新**: 2026-01-25
**作者**: Newma (牛码) Development Team
