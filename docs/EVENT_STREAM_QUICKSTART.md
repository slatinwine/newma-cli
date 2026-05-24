# Event Stream REPL - Quick Start Guide

**版本**: 2.0.0
**状态**: Experimental (Alpha)
**基于**: Codex CLI 的事件流架构

## 🚀 快速开始

### 1. 启动事件流 REPL

```bash
# 使用新的事件流 REPL
npx newma-cli -i --event-stream
```

你会看到：

```
🔄 Using Event Stream REPL v2 (Codex-style architecture)
──────────────────────────────────────────────────────────

🤖 Newma (牛码) REPL v2.0
──────────────────────────────────────────────────────────
New event stream architecture powered by Codex design
Type /help for available commands
──────────────────────────────────────────────────────────

[newma] ❯
```

### 2. 基础命令

```bash
# 查看帮助
[newma] ❯ /help

# 查看状态
[newma] ❯ /status

# 查看历史
[newma] ❯ /history

# 清屏
[newma] ❯ /clear

# 退出
[newma] ❯ /exit
```

### 3. 外部编辑器集成（新功能！）

```bash
# 在 vim 中打开文件
[newma] ❯ /vim package.json

# 编辑文件后，REPL 会自动恢复
# stdin 完全释放给 vim，编辑体验无缝！
```

工作流程：
1. 输入 `/vim <filename>`
2. Event stream **自动暂停**（释放 stdin）
3. Vim 打开，正常编辑
4. 退出 vim 后，Event stream **自动恢复**
5. REPL 继续运行

### 4. Pause/Resume 测试

```bash
# 手动暂停事件流
[newma] ❯ /pause

# 此时 stdin 完全释放
# 你可以在终端中运行任何命令
# 例如：运行 vim、nano 等

# 恢复事件流（按 Enter）
# 或者
[newma] ❯ /resume
```

## 🎯 核心特性

### 1. 非阻塞事件轮询

传统 REPL：
```typescript
// 阻塞等待
const line = await rl.prompt();
```

事件流 REPL：
```typescript
// 非阻塞轮询
while (running) {
  const event = await stream.pollNext();
  if (event) {
    handleEvent(event);
  }
  // CPU 可以做其他事情
}
```

### 2. Event Broker 模式

```typescript
// 暂停 - 完全释放 stdin
broker.pause();

// 运行外部程序
await spawn('vim', [file]);

// 恢复 - 重新捕获 stdin
broker.resume();
```

### 3. Round-Robin 事件调度

事件流使用公平调度策略：
- Draw 事件（UI 重绘）
- Key 事件（用户输入）
- Paste 事件（粘贴内容）
- Signal 事件（系统信号）

不会出现任何一种事件"饥饿"的情况。

## 🔧 高级用法

### 测试事件流系统

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
```

### 在代码中使用事件流

```typescript
import { createEventSystem } from './loop/event';

// 创建事件系统
const eventSystem = createEventSystem({
  prompt: '[my-app] ❯ ',
  debug: true,
});

// 主循环
while (running) {
  const event = await eventSystem.stream.pollNext();

  if (event) {
    switch (event.type) {
      case 'key':
        console.log('Key:', event.name);
        break;
      case 'signal':
        console.log('Signal:', event.signal);
        break;
      // ... 处理其他事件
    }
  }
}
```

### 自定义事件映射

```typescript
import { EventMapper } from './loop/event';

const mapper = new EventMapper();

// 添加自定义键绑定
mapper.addKeyMapping('ctrl+shift+a', {
  type: 'custom',
  data: 'my-action',
});
```

## 🆚 与旧 REPL 对比

| 特性 | 旧 REPL | 事件流 REPL |
|------|--------|-------------|
| **输入方式** | 阻塞 readline | 非阻塞轮询 |
| **外部程序** | ❌ 需要手动处理 | ✅ 自动 pause/resume |
| **事件类型** | line, SIGINT | Key, Paste, Draw, Signal |
| **Draw 事件** | ❌ 不支持 | ✅ 支持 UI 重绘 |
| **响应速度** | 即时（阻塞） | < 5ms（非阻塞） |
| **可扩展性** | 有限 | 高（插件化） |

## 🐛 故障排除

### 问题：事件流 REPL 没有响应

**解决方案**：检查是否正确启用

```bash
# 确保使用了 --event-stream 标志
npx newma-cli -i --event-stream
```

### 问题：外部编辑器无法打开

**解决方案**：检查事件流状态

```bash
# 在 REPL 中运行
[newma] ❯ /status

# 检查 "Event stream state"
# 应该是 "running"，如果是 "paused"，运行：
[newma] ❯ /resume
```

### 问题：输入卡住

**解决方案**：这是正常行为！事件流使用轮询，输入响应时间 < 5ms，用户无感知。

## 📚 更多文档

- **完整架构**: `docs/EVENT_STREAM_ARCHITECTURE.md`
- **类型定义**: `src/loop/event/types.ts`
- **测试代码**: `test-event-stream.ts`

## 🎯 下一步

1. **尝试外部编辑器** - 使用 `/vim` 命令打开文件
2. **测试 Pause/Resume** - 使用 `/pause` 和 `/resume`
3. **查看事件状态** - 使用 `/status` 查看事件统计
4. **阅读源码** - 了解 Codex 风格的事件流设计

---

**享受新的事件流架构带来的强大功能！** 🎉
