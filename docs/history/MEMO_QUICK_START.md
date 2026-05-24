# Memo 集成 - 快速开始指南

## 安装 Memo（如果还没有）

```bash
# Memo 已经安装在 /Users/mac/freedomking/memo
# 确保可以运行：
python3 /Users/mac/freedomking/memo --help
```

## 启动 Newma

```bash
cd /Users/mac/kode
npm run dev
```

## 基础命令

### 1. 记录决策

```bash
[newma] ❯ /decision "选择 TypeScript" "类型安全提升开发效率" --tags architecture,language
✓ Decision recorded: 选择 TypeScript
  Tags: architecture, language
```

### 2. 查看所有决策

```bash
[newma] ❯ /decisions
📋 Found 1 decision(s):

[2026-01-31] 选择 TypeScript
  类型安全提升开发效率...
  Tags: architecture, language
```

### 3. 搜索决策

```bash
[newma] ❯ /decisions architecture
📋 Found 1 decision(s):

[2026-01-31] 选择 TypeScript
  类型安全提升开发效率...
  Tags: architecture, language
```

### 4. 索引项目

```bash
[newma] ❯ /memo-index
📚 Memo system initialized
✓ Project indexed
  Files: 156
  Decisions: 1
```

### 5. 查找代码

```bash
[newma] ❯ /find UserService
🔍 Found 3 result(s) for "UserService":

✓ src/services/user.service.ts
    Lines: 245 | Classes: UserService | Functions: create, get, update

✓ src/models/user.ts
    Lines: 89 | Classes: User

✓ src/controllers/user.controller.ts
    Lines: 123 | Functions: handleRequest
```

## AI 上下文自动增强

当你使用 `/plan` 命令时，AI 会自动检索相关决策和代码：

```bash
[newma] ❯ /plan 添加用户认证

# AI 会自动：
# 1. 搜索历史决策
# 2. 查找相关代码
# 3. 生成更准确的计划

📚 PROJECT MEMORY:

Relevant Decisions:
- [2026-01-31] 选择 TypeScript
  类型安全提升开发效率...
  Tags: architecture, language

Related Code:
- src/services/user.service.ts (classes: UserService)

Found 1 relevant decision(s)
Found 1 relevant file(s)

📋 Plan Generated:
...
```

## 高级用法

### 标签过滤

```bash
[newma] ❯ /decisions "" --tag architecture
📋 Found all architecture decisions:
...
```

### 生成文档

```bash
[newma] ❯ /memo-doc
✓ Documentation generated (MEMO.md)
```

### 查看统计

```bash
[newma] ❯ /memo-stats
📊 Memory Statistics:

  Indexed Files: 156
  Decisions: 12
```

## 工作流建议

### 1. 项目开始时

```bash
# 记录重要架构决策
[newma] ❯ /decision "选择状态管理" "使用 Redux Toolkit" --tags architecture,frontend
[newma] ❯ /decision "选择测试框架" "使用 Vitest" --tags testing

# 索引项目
[newma] ❯ /memo-index
```

### 2. 日常开发

```bash
# 记录重要决策
[newma] ❯ /decision "API 设计变更" "改用 RESTful 风格" --tags api,design

# AI 自动使用历史上下文
[newma] ❯ /plan 添加新的 API endpoint
```

### 3. 代码评审

```bash
# 记录评审决策
[newma] ❯ /decision "PR #234" "采用方案 A，更易维护" --tags review,design
```

## 常见问题

### Q: Memo 可用但找不到？

**A**: 确保 memo 路径正确：
```bash
# 检查 memo 是否存在
ls -la /Users/mac/freedomking/memo

# 如果在其他位置，修改 src/repl.ts 中的路径
this.memoPlugin = new MemoCliPlugin(
  this.session.getProjectRoot(),
  '/path/to/memo' // 指定 memo 路径
);
```

### Q: 命令不可用？

**A**: Memo 命令需要通过 CommandManager 注册（TODO），当前可以直接使用 MemoCliPlugin API。

### Q: AI 不使用历史决策？

**A**: 确保：
1. `.memo/decisions.json` 存在且有数据
2. 使用 `/plan` 模式（chat 模式不使用）
3. 搜索关键词与决策内容匹配

## 下一步

- 查看 `MEMO_INTEGRATION.md` 了解技术细节
- 尝试记录几个决策，然后用 `/plan` 测试 AI 上下文增强
- 探索 `/find` 命令快速定位代码

祝使用愉快！🎉
