# 记忆系统使用指南

**版本**: v3.3.0
**更新日期**: 2026-01-31

---

## 📚 概述

Newma 包含 **7 个记忆系统**，全部永久保存在 `.memo/` 目录：

1. **项目上下文记忆** - 缓存项目结构、依赖、框架
2. **执行历史记忆** - 记录所有命令和执行结果
3. **错误解决方案记忆** - 记录错误和解决方法
4. **用户偏好记忆** - 学习你的代码风格和习惯
5. **会话上下文记忆** - 维护跨会话的对话历史
6. **推理过程记忆** - 记录 AI 的思维过程
7. **Memo CLI 集成** - 项目决策和代码索引

---

## ✅ 当前集成状态

### 已自动集成（无需手动操作）

- ✅ **项目上下文** - 自动注入到 AI 上下文中
- ✅ **决策记录** - 通过 `/decision` 命令记录
- ✅ **代码索引** - 通过 `/index` 命令建立
- ✅ **任务搜索** - 通过 `/tasks` 命令查询

### 部分集成（可以查询）

- ⚠️  **执行历史** - 数据已记录，但需要手动查询
- ⚠️  **错误记忆** - 数据已记录，但需要手动查询
- ⚠️  **用户偏好** - 需要手动查询当前设置
- ⚠️  **会话上下文** - 需要手动查询历史会话
- ⚠️  **推理过程** - 需要手动查询推理链

---

## 🔍 查询记忆数据

### 方法 1: REPL 交互式命令（推荐）✨

**在 newma REPL 中直接查询**，无需退出：

```bash
# 启动 REPL
npx newma-cli -i

# 查看统计信息
/memory-stats

# 查看执行历史（最近 10 条）
/memory-history 10

# 查看错误记录
/memory-errors

# 查看用户偏好
/memory-prefs

# 查看会话历史
/memory-sessions

# 查看推理过程
/memory-reasoning
```

**优点**:
- ✅ 无需退出 REPL
- ✅ 格式化彩色输出
- ✅ 支持参数自定义
- ✅ 实时查询

**详细文档**: [MEMORY_COMMANDS_GUIDE.md](./MEMORY_COMMANDS_GUIDE.md)

### 方法 2: 快速查询脚本

使用提供的 shell 脚本快速查询：

```bash
# 查看所有概览
./query-memory.sh all

# 查看执行历史（最近 5 条）
./query-memory.sh history 5

# 查看错误记录（最近 3 个）
./query-memory.sh errors 3

# 查看用户偏好
./query-memory.sh preferences

# 查看会话历史（最近 5 个）
./query-memory.sh sessions 5

# 查看推理过程（最近 3 个）
./query-memory.sh reasoning 3

# 查看统计信息
./query-memory.sh stats
```

### 方法 3: 直接查看 JSON 文件

直接查看原始 JSON 数据（用于高级查询）：

```bash
# 查看执行历史
cat .memo/sessions.json | jq '.sessions[0]'

# 查看错误记录
cat .memo/errors.json | jq '.errors[0]'

# 查看用户偏好
cat .memo/preferences.json

# 查看推理过程
cat .memo/reasoning.json | jq '.chains[0]'
```

---

## 📖 使用场景

### 场景 1: 查看最近的命令历史

**使用 REPL 命令**（推荐）:
```bash
/memory-history
```

**或使用脚本**:
```bash
./query-memory.sh history 5
```

**或直接查看 JSON**:
```bash
cat .memo/sessions.json | jq '.sessions | reverse | .[0:3] | .[] | {
  command: .command,
  status: .status,
  duration: .metadata.duration
}'
```

### 场景 2: 查找某个错误的解决方案

**使用 REPL 命令**（推荐）:
```bash
/memory-errors
```

**或搜索包含特定关键词的错误**:
```bash
cat .memo/errors.json | jq '.errors[] |
  select(.errorMessage | contains("ValidationError")) |
  {error: .errorMessage, solution: .solutions[0].description}'
```

### 场景 3: 查看当前用户偏好

**使用 REPL 命令**（推荐）:
```bash
/memory-prefs
```

**或查看所有偏好**:
```bash
cat .memo/preferences.json | jq '.'
```

**或查看特定偏好**:
```bash
cat .memo/preferences.json | jq '.codeStyle'
cat .memo/preferences.json | jq '.aiInteraction.language'
```

### 场景 4: 查看会话历史

**使用 REPL 命令**（推荐）:
```bash
/memory-sessions 10
```

**或查看最近的会话**:
```bash
cat .memo/sessions.json | jq '.sessions | reverse | .[0:3] | .[] | {
  title: .title,
  messages: .stats.messageCount,
  duration: (.stats.duration / 1000 | floor)
}'
```

### 场景 5: 查看推理过程

**使用 REPL 命令**（推荐）:
```bash
/memory-reasoning 5
```

**或查看最近的推理链**:
```bash
cat .memo/reasoning.json | jq '.chains | reverse | .[0] | {
  task: .task,
  status: .status,
  steps: .stats.totalSteps,
  algorithm: .learnedPatterns.preferredAlgorithm
}'
```

---

## 🎯 最佳实践

```bash
# 搜索包含 "ValidationError" 的错误
cat .memo/errors.json | jq '.errors[] |
  select(.errorMessage | contains("ValidationError")) |
  {error: .errorMessage, solution: .solutions[0].description}'
```

### 场景 3: 查看当前用户偏好

```bash
# 查看所有偏好
cat .memo/preferences.json | jq '.'

# 查看代码风格偏好
cat .memo/preferences.json | jq '.codeStyle'

# 查看语言偏好
cat .memo/preferences.json | jq '.aiInteraction.language'
```

### 场景 4: 查看会话历史

```bash
# 查看最近的会话
cat .memo/sessions.json | jq '.sessions | reverse | .[0:3] | .[] | {
  title: .title,
  messages: .stats.messageCount,
  duration: (.stats.duration / 1000 | floor)
}'
```

### 场景 5: 查看推理过程

```bash
# 查看最近的推理链
cat .memo/reasoning.json | jq '.chains | reverse | .[0] | {
  task: .task,
  status: .status,
  steps: .stats.totalSteps,
  algorithm: .learnedPatterns.preferredAlgorithm
}'
```

---

## 🎯 最佳实践

### 1. 定期查看统计信息

```bash
# 每周查看一次
/stats
```

### 2. 记录重要决策

```bash
/decision "使用 TypeScript" "提供类型安全，减少运行时错误" --tags language,architecture
```

### 3. 建立代码索引

```bash
# 项目初期或代码变更后
/index
```

### 4. 查找相关代码

```bash
# 在添加新功能前
/find User authentication
```

### 5. 查看任务历史

```bash
# 接手新功能时
/tasks user authentication
```

---

## 🔧 高级用法

### 导出所有记忆数据

```bash
# 创建备份
mkdir -p .memo-backup
cp -r .memo/* .memo-backup/

# 导出为可读格式
cat .memo/decisions.json | jq '.decisions[] | "[\(.timestamp)] \(.title)\n  \(.content)"' > decisions.txt
cat .memo/errors.json | jq '.errors[] | "[\(.timestamp)] \(.errorType)\n  \(.errorMessage)\n  Solution: \(.solutions[0].description)"' > errors.txt
```

### 清理测试数据（可选）

```bash
# 注意：这会删除所有记忆数据！
# rm -rf .memo/

# 或仅清理测试数据
# jq '.decisions |= map(select(.timestamp | fromdateiso8601 > (now - 7*24*3600)))' .memo/decisions.json > .memo/decisions.json.tmp
# mv .memo/decisions.json.tmp .memo/decisions.json
```

### 分析记忆数据

```bash
# 统计命令类型
cat .memo/sessions.json | jq '.sessions[].command' | sort | uniq -c | sort -rn

# 统计错误类型
cat .memo/errors.json | jq '.errors[].errorType' | sort | uniq -c | sort -rn

# 统计决策标签
cat .memo/decisions.json | jq '.decisions[].tags[]' | sort | uniq -c | sort -rn
```

---

## 📊 数据文件说明

### .memo/ 目录结构

```
.memo/
├── decisions.json          # 项目决策记录
├── index.json              # 代码索引
├── sessions.json           # 执行历史记忆
├── errors.json             # 错误解决方案记忆
├── preferences.json        # 用户偏好设置
├── context.json            # 项目上下文缓存
└── reasoning.json          # 推理过程记忆
```

### JSON 格式示例

**执行历史 (sessions.json)**:
```json
{
  "sessions": [{
    "id": "session-123",
    "startTime": "2026-01-31T12:00:00.000Z",
    "commands": [{
      "command": "/plan add authentication",
      "status": "success",
      "duration": 1500
    }]
  }]
}
```

**错误记忆 (errors.json)**:
```json
{
  "errors": [{
    "id": "error-123",
    "errorType": "ValidationError",
    "errorMessage": "Missing required field",
    "solutions": [{
      "description": "Add missing field",
      "steps": ["Step 1", "Step 2"]
    }]
  }]
}
```

---

## ❓ 常见问题

### Q: 记忆数据会自动删除吗？

**A**: 不会！所有数据永久保留，不会自动删除。

### Q: 记忆数据会占用多少空间？

**A**: 通常在 100K-500K 之间，取决于使用频率。7天以上数据会自动压缩。

### Q: 如何备份记忆数据？

**A**: 直接复制 `.memo/` 目录即可：
```bash
cp -r .memo .memo-backup-$(date +%Y%m%d)
```

### Q: 记忆数据会影响性能吗？

**A**: 不会。所有数据都是懒加载，并使用缓存机制。项目上下文缓存命中时速度提升 50x+。

### Q: 可以删除某些记忆数据吗？

**A**: 可以直接编辑 JSON 文件，但建议使用专用命令（待实现）。

### Q: 记忆数据会被 AI 自动使用吗？

**A**: 目前只有项目上下文和决策会自动注入到 AI 中。其他记忆系统需要手动查询。

---

## 🚀 未来计划

- [ ] 添加 `/memory` 命令查询所有记忆
- [ ] 自动记录执行历史
- [ ] 自动捕获和解决错误
- [ ] 自动学习用户偏好
- [ ] AI 自动注入所有记忆上下文
- [ ] 可视化记忆数据面板

---

## 📝 相关文档

- [测试报告](./MEMORY_SYSTEMS_TEST_REPORT.md)
- [技术实现](./MEMORY_SYSTEMS_COMPLETE.md)
- [集成指南](./MEMORY_INTEGRATION.md)
