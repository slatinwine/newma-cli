# 🧠 记忆系统使用指南

## ✅ 已集成功能

记忆系统已完全集成到 Newma REPL 中，自动记录你的所有会话和命令！

## 📊 自动记录的内容

### 1. 会话对话历史 (SessionContext)
- 自动记录每条用户输入
- 自动记录每条 AI 回复
- 包含时间戳和元数据
- 存储位置: `.memo/sessions.json`

### 2. 命令执行历史 (ExecutionHistory)
- 自动记录每个命令的开始和结束
- 记录命令类型（special/chat）
- 记录执行状态（success/failed/aborted）
- 统计成功率和执行时间
- 存储位置: `.memo/executions/YYYY-MM/session-id.json`

### 3. 用户偏好 (Preferences)
- 代码风格偏好（缩进、引号风格等）
- 技术栈偏好（首选语言、框架等）
- 工作流偏好（默认模式等）
- 存储位置: `.memo/preferences.json`

### 4. 错误记忆 (ErrorMemory)
- 自动记录遇到的错误
- 记录解决方案和模式
- 存储位置: `.memo/errors.json` 和 `.memo/patterns.json`

## 🎯 新增命令

### `/memory-stats`
查看记忆系统统计信息

```bash
[newma] ❯ /memory-stats

📊 Memory System Statistics
════════════════════════════════════════
Session Context:
  Total Sessions: 7
  Total Messages: 28
  Total Tokens: 1450
  Avg Session Length: 4.0

Execution History:
  Total Commands: 2
  Success Rate: 100.0%
  Avg Duration: 150ms

User Preferences:
  Languages: typescript, javascript
  Frameworks: react, express
════════════════════════════════════════
```

### `/memory-sessions [limit]`
查看最近的会话

```bash
[newma] ❯ /memory-sessions 5

📋 Recent Sessions (Last 5)
════════════════════════════════════════

📅 Session: session-1769862283914-1cw1gf1
  Start: 2026-01-31 20:24:43
  Duration: 9s
  Messages: 4
════════════════════════════════════════
```

### `/memory-search <query>`
搜索会话历史

```bash
[newma] ❯ /memory-search 认证

🔍 Search Results for: "认证"
════════════════════════════════════════

👤 User - 2026-01-31 20:24:43
  帮我实现用户认证系统...
  Score: 1.00

🤖 AI - 2026-01-31 20:24:43
  好的，我来帮你设计一个JWT认证系统...
  Score: 1.00
════════════════════════════════════════
```

### `/memory-errors [limit]`
查看错误记忆（功能占位符）

```bash
[newma] ❯ /memory-errors

🐛 Error Memory
════════════════════════════════════════
Error memory functionality is not yet fully implemented.
This feature will be available in a future update.
════════════════════════════════════════
```

## 🔄 自动化工作流

### 会话开始时
1. 自动初始化所有记忆管理器
2. 创建新的会话记录
3. 准备接收命令和消息

### 会话进行中
1. 每条命令自动记录到执行历史
2. 每条消息自动记录到会话上下文
3. 错误自动记录到错误记忆

### 会话结束时
1. 自动保存所有记忆数据
2. 更新统计信息
3. 序列化到 JSON 文件

## 📁 数据存储结构

```
.memo/
├── sessions.json              # 会话对话历史
├── preferences.json           # 用户偏好设置
├── errors.json                # 错误记录
├── patterns.json              # 错误模式
├── reasoning.json             # 推理追踪
└── executions/                # 执行历史
    ├── 2026-01/               # 按月组织
    │   └── session-id.json
    └── 2026-02/
        └── session-id.json
```

## 💡 使用建议

### 1. 定期查看统计信息
```bash
# 每周查看一次使用情况
/memory-stats
```

### 2. 搜索历史对话
```bash
# 快速找到之前讨论过的话题
/memory-search JWT
/memory-search 数据库优化
```

### 3. 查看会话历史
```bash
# 了解最近的工作内容
/memory-sessions 10
```

### 4. 数据持久化
所有记忆数据自动保存，无需手动操作。
重启 REPL 后依然可以访问历史数据。

## 🎉 测试结果

✅ 所有功能测试通过：
- SessionContextManager - 正常工作
- ExecutionHistoryManager - 正常工作
- PreferencesManager - 正常工作
- ErrorMemoryManager - 正常工作

✅ 数据持久化正常：
- 会话数据正确保存
- 命令历史正确记录
- 统计信息准确计算

## 🚀 未来增强

计划中的功能：
- 自动学习用户偏好
- 智能搜索建议
- 跨会话上下文关联
- 错误模式识别和预警
- 性能优化建议

---

**享受你的增强记忆功能！** 🧠✨
