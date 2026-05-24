# Newma 记忆命令快速参考

**在 REPL 中直接查询记忆数据**

---

## 📊 记忆查询命令

### 基础查询

```bash
/memory-stats          # 查看所有统计信息
/memory-prefs          # 查看用户偏好设置
```

### 历史查询

```bash
/memory-history [n]    # 查看执行历史（默认 5 条）
/memory-sessions [n]   # 查看会话历史（默认 5 条）
/memory-reasoning [n]  # 查看推理过程（默认 3 条）
```

### 错误查询

```bash
/memory-errors [n]     # 查看错误记录（默认 5 条）
```

---

## 🎯 使用示例

```bash
# 查看统计概览
/memory-stats

# 查看最近 10 条执行历史
/memory-history 10

# 查看最近 5 个错误
/memory-errors 5

# 查看用户偏好
/memory-prefs

# 查看最近 3 个会话
/memory-sessions 3

# 查看最近 5 个推理链
/memory-reasoning 5
```

---

## 🔍 其他记忆命令

```bash
/decisions [关键词]    # 搜索决策记录
/tasks [关键词]        # 搜索任务
/find <关键词>         # 查找相关代码
/stats                 # 查看统计
```

---

## 📝 完整帮助

```bash
/help memory           # 查看所有记忆命令帮助
```

---

**提示**: 所有数据永久保存在 `.memo/` 目录
