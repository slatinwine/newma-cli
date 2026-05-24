# Loop 系统集成方案

**日期**: 2026-01-25
**状态**: 设计阶段
**目标**: 将 Loop 引擎集成到 REPL，保持向后兼容

## 📋 架构分析

### 当前 REPL 架构

```
src/cli.ts
  └─ startInteractiveMode()
      ├─ --event-stream: REPLManagerV2 (Codex-style)
      └─ default: REPLManager (传统 readline)
```

### Loop 系统架构

```
LoopEngine
  ├─ CliFrontend (readline 封装)
  ├─ AIFlowController (AI 处理逻辑)
  ├─ LoopSessionManagerAdapter (会话适配)
  └─ CommandManager (命令系统)
```

## 🎯 集成方案

### 方案：渐进式集成

**原则**:
1. ✅ 向后兼容 - 默认使用旧 REPL
2. ✅ 可选启用 - 通过 `--loop` 标志
3. ✅ 代码复用 - 复用现有 SessionManager
4. ✅ 测试友好 - 易于测试和调试

---

**最后更新**: 2026-01-25
**状态**: 准备实施 ✅
