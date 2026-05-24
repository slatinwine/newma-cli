# Newma 记忆查询命令使用指南

**版本**: v3.3.0
**更新日期**: 2026-01-31

---

## 📋 概述

Newma 现在支持**在 REPL 中直接查询记忆数据**！无需退出或使用外部工具，所有记忆系统都可以通过交互式命令访问。

---

## 🎯 可用命令列表

### 记忆查询命令（新增）

| 命令 | 说明 | 用法 |
|------|------|------|
| `/memory-history` | 查看执行历史 | `/memory-history [数量]` |
| `/memory-errors` | 查看错误记录 | `/memory-errors [数量]` |
| `/memory-prefs` | 查看用户偏好 | `/memory-prefs` |
| `/memory-sessions` | 查看会话历史 | `/memory-sessions [数量]` |
| `/memory-reasoning` | 查看推理过程 | `/memory-reasoning [数量]` |
| `/memory-stats` | 查看统计信息 | `/memory-stats` |

### 现有记忆命令

| 命令 | 说明 | 用法 |
|------|------|------|
| `/decision` | 记录决策 | `/decision <标题> <内容> [--tags 标签]` |
| `/decisions` | 搜索决策 | `/decisions [关键词]` |
| `/index` | 建立代码索引 | `/index` |
| `/find` | 查找相关代码 | `/find <关键词>` |
| `/tasks` | 搜索任务 | `/tasks <关键词>` |
| `/stats` | 查看统计 | `/stats` |

---

## 🚀 使用示例

### 查看执行历史

```bash
[newma] ❯ /memory-history
```

**输出**:
```
📜 Execution History (Last 5)

Total Commands: 6
Success Rate: 100.0%
Total Duration: 500ms

1. 实现用户认证功能
   Status: completed
   Messages: 4
   Duration: 15s

2. 添加数据库支持
   Status: completed
   Messages: 3
   Duration: 8s
...
```

**指定数量**:
```bash
[newma] ❯ /memory-history 10
```

---

### 查看错误记录

```bash
[newma] ❯ /memory-errors
```

**输出**:
```
❌ Error Solutions (Last 5)

Total Errors: 2
Resolved: 2
Resolution Rate: 100.0%

1. ValidationError
   Error: Missing required field: email
   Status: 1 occurrence(s)
   Solution: Add email field to User schema...

2. TypeError
   Error: Cannot read property 'map' of undefined
   Status: 1 occurrence(s)
   Solution: Add null check before mapping...
```

---

### 查看用户偏好

```bash
[newma] ❯ /memory-prefs
```

**输出**:
```
⚙️  User Preferences

Language: zh
Verbosity: concise
Algorithm: fft

Code Style:
  Indent: spaces (2 spaces)
  Quotes: single
  Naming: camelCase

Tools:
  Package Manager: npm
  Test Framework: jest
  Linter: eslint, prettier

Tech Stack:
  Languages: TypeScript, Python
  Frameworks: React, Express

Updated: 1/31/2026
```

---

### 查看会话历史

```bash
[newma] ❯ /memory-sessions
```

**输出**:
```
💬 Session History (Last 5)

1. 我想了解Rust语言
   Status: completed
   Messages: 4
   Duration: 0s
   Topics: rust, programming

2. 如何优化数据库查询性能？
   Status: completed
   Messages: 4
   Duration: 0s
   Topics: database, optimization, performance
...
```

---

### 查看推理过程

```bash
[newma] ❯ /memory-reasoning
```

**输出**:
```
🧠 Reasoning Process (Last 3)

Total Chains: 8
Total Steps: 24
Success Rate: 87.5%

1. 优化数据库性能
   Type: execute
   Status: completed
   Steps: 5
   Algorithm: landmark

2. 实现微服务架构
   Type: plan
   Status: failed
   Steps: 3
...
```

---

### 查看统计信息

```bash
[newma] ❯ /memory-stats
```

**输出**:
```
📊 Memory System Statistics

Execution History:
  Commands: 6
  Success Rate: 100.0%
  Duration: 500ms

Error Solutions:
  Total: 2
  Resolved: 2
  Resolution Rate: 100.0%

Reasoning Process:
  Chains: 8
  Steps: 24
  Success Rate: 87.5%

User Preferences:
  Language: zh
  Verbosity: concise
  Last Updated: 1/31/2026

All data stored in .memo/ directory
No data deletion - permanent retention!
```

---

## 💡 实际使用场景

### 场景 1: 开始新功能前

```bash
# 1. 查看相关任务
[newma] ❯ /tasks authentication

# 2. 查看执行历史
[newma] ❯ /memory-history 10

# 3. 查找相关代码
[newma] ❯ /find User model

# 4. 查看相关决策
[newma] ❯ /decisions authentication

# 5. 开始开发
[newma] ❯ /plan 添加双因素认证
```

### 场景 2: 遇到错误时

```bash
# 1. 查看类似错误
[newma] ❯ /memory-errors

# 2. 找到相关错误，查看解决方案
# 输出会显示解决方案的描述

# 3. 应用解决方案继续开发
[newma] ❯ 添加缺失字段...
```

### 场景 3: 查看个人偏好

```bash
# 查看当前设置
[newma] ❯ /memory-prefs

# 如果需要修改
[newma] ❯ 手动编辑 .memo/preferences.json
```

### 场景 4: 复盘会话

```bash
# 查看最近的会话
[newma] ❯ /memory-sessions 10

# 查看推理过程
[newma] ❯ /memory-reasoning 5

# 了解 AI 的思维方式
```

---

## 🔄 与其他查询方法对比

### 方法 1: REPL 命令（推荐）✅

**优点**:
- 无需退出 REPL
- 格式化输出
- 彩色显示
- 支持参数

**示例**:
```bash
[newma] ❯ /memory-history 10
```

### 方法 2: 外部脚本

**优点**:
- 可以在脚本中使用
- 支持管道输出

**示例**:
```bash
./query-memory.sh history 10
```

### 方法 3: 直接查看 JSON

**优点**:
- 查看完整数据
- 可以用 jq 过滤

**示例**:
```bash
cat .memo/sessions.json | jq '.sessions[0]'
```

---

## 🎨 输出格式说明

### 颜色标记

- 🟢 **绿色**: 序号、成功状态
- 🔵 **蓝色**: 标签、统计信息
- 🔴 **红色**: 错误信息
- 🟡 **黄色**: 警告、空数据
- ⚪ **灰色**: 元信息、时间戳

### 统计信息

每个命令都会显示相关的统计信息：
- 总数
- 成功率
- 持续时间
- 更新时间

---

## 📝 命令帮助

在 REPL 中输入 `/help` 可以查看所有可用命令：

```bash
[newma] ❯ /help memory
```

会显示所有 memory 类别的命令及用法。

---

## 🔧 高级用法

### 组合查询

```bash
# 1. 查看统计
[newma] ❯ /memory-stats

# 2. 查看历史
[newma] ❯ /memory-history

# 3. 查看错误
[newma] ❯ /memory-errors

# 4. 查看偏好
[newma] ❯ /memory-prefs
```

### 定期检查

建议每周运行一次：

```bash
[newma] ❯ /memory-stats
```

查看整体使用情况和数据增长。

### 调试时使用

```bash
# 查看最近的执行
[newma] ❯ /memory-history

# 查看遇到的错误
[newma] ❯ /memory-errors 10

# 查看推理过程
[newma] ❯ /memory-reasoning 5
```

---

## ⚙️  配置选项

### 修改默认显示数量

目前默认显示数量：
- `/memory-history`: 5 条
- `/memory-errors`: 5 条
- `/memory-sessions`: 5 条
- `/memory-reasoning`: 3 条

可以通过参数修改：

```bash
[newma] ❯ /memory-history 20  # 显示 20 条
```

### 修改输出格式

目前输出格式是固定的。如果需要自定义，可以：

1. 使用 JSON 文件直接查询
2. 修改源代码（`src/loop/commands/memo-commands.ts`）
3. 创建自定义脚本

---

## 🐛 故障排除

### 命令找不到

确保：
1. 使用的是最新版本（`npm run build`）
2. 在 REPL 模式中运行（`npx newma-cli -i`）
3. 命令拼写正确

### 没有数据

如果是第一次使用：
1. 运行一些命令生成数据
2. 检查 `.memo/` 目录是否存在
3. 查看 JSON 文件是否有内容

### 输出格式错乱

可能原因：
1. 终端不支持颜色（使用 `--no-color` 选项）
2. 终端宽度不够（调整终端窗口大小）

---

## 📚 相关文档

- [记忆系统使用指南](./MEMO_USAGE_GUIDE.md)
- [记忆系统测试报告](./MEMORY_SYSTEMS_TEST_REPORT.md)
- [项目 README](./README.md)

---

## 🚀 未来计划

- [ ] 添加过滤选项（按日期、状态、类型）
- [ ] 支持导出为文件
- [ ] 添加搜索功能
- [ ] 支持自动刷新
- [ ] 可视化图表展示

---

**快速开始**:

```bash
# 启动 REPL
npx newma-cli -i

# 查看统计
/memory-stats

# 查看历史
/memory-history 10

# 查看错误
/memory-errors

# 查看偏好
/memory-prefs
```
