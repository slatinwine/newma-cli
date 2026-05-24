# Markdown Plugin Quick Start Guide

## 5分钟创建你的第一个插件

Newma 现在支持 **Markdown 零代码插件**！只需写一个 `.md` 文件，AI 会自动执行你的工作流程。

### 创建插件（2分钟）

```bash
# 使用模板创建插件
kode-create-plugin markdown my-plugin --template code-review

# 或创建空白插件
kode-create-plugin markdown my-plugin

# 查看所有可用模板
kode-create-plugin list-templates
```

### 编辑插件（1分钟）

打开 `plugins/my-plugin/PLUGIN.md`，编辑工作流程：

```markdown
---
name: my-plugin
description: 我的第一个插件
version: 1.0.0
---

# 我的工作流程

当用户请求相关功能时，按照以下步骤执行：

## 步骤 1: 分析输入
- 理解用户需求
- 识别关键信息

## 步骤 2: 处理任务
- 执行相应操作
- 生成结果

## 输出格式

### 处理结果
[详细描述输出格式]
```

### 使用插件（立即生效）

```bash
# 在 Newma REPL 中直接使用
npx newma-cli -i
> /my-plugin some input

# 或在你的代码中调用
await engine.loadMarkdownPlugin('plugins/my-plugin/PLUGIN.md');
```

---

## 工作原理

```
┌─────────────────┐
│  PLUGIN.md      │  ← 你写的 Markdown 文件
│  (工作流程定义)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Python 执行器   │  ← 解析 Markdown，调用 AI
│  (execute_plugin.py) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  OpenAI API     │  ← AI 按照步骤执行任务
│  (GPT-4o)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  输出结果       │  ← 格式化的结果
└─────────────────┘
```

---

## 可用模板

### 1. code-review - 代码审查工作流

```bash
kode-create-plugin markdown my-review --template code-review
```

**功能**: 自动审查代码，检查规范、复杂度、命名约定
**输出**: 问题列表、改进建议、评分

### 2. project-setup - 项目初始化工作流

```bash
kode-create-plugin markdown my-setup --template project-setup
```

**功能**: 初始化新项目，创建目录结构、配置文件
**输出**: 完整的项目结构和下一步指导

### 3. deployment-check - 部署检查清单

```bash
kode-create-plugin markdown my-deploy --template deployment-check
```

**功能**: 部署前检查环境、代码质量、安全、性能
**输出**: 检查报告、通过率、部署建议

### 4. debugging-guide - 调试指南助手

```bash
kode-create-plugin markdown my-debug --template debugging-guide
```

**功能**: 分析错误信息，诊断根本原因，提供解决方案
**输出**: 错误分析、解决方案、调试工具推荐

---

## 插件格式说明

### Frontmatter (必需)

```yaml
---
name: plugin-name          # 插件名称 (kebab-case)
description: 插件描述       # 简短描述
version: 1.0.0            # 版本号
---
```

### 正文 (工作流程)

使用 Markdown 编写步骤，AI 将按照这些步骤执行：

```markdown
## 步骤 1: [步骤名称]
- [子步骤 1]
- [子步骤 2]

## 步骤 2: [步骤名称]
- [子步骤 1]
- [子步骤 2]
```

### 输出格式（可选但推荐）

定义 AI 应该如何输出结果：

```markdown
## 输出格式

### [输出标题]
[描述输出格式和内容]
```

---

## 高级用法

### 自定义输出格式

你可以在插件中定义任何输出格式：

```markdown
## 输出格式

### 📊 分析报告

**输入**: [用户输入]

**发现**:
- [发现 1]
- [发现 2]

**结论**: [总结]
```

### 多步骤工作流

定义复杂的多步骤流程：

```markdown
## 步骤 1: 准备阶段
- [任务 1]
- [任务 2]

## 步骤 2: 分析阶段
- [任务 1]
- [任务 2]

## 步骤 3: 执行阶段
- [任务 1]
- [任务 2]

## 步骤 4: 验证阶段
- [任务 1]
- [任务 2]
```

### 条件分支

虽然 Markdown 是线性的，但你可以描述条件逻辑：

```markdown
## 步骤 2: 分析结果

如果 [条件 A]:
- 执行操作 A
- 检查结果

否则如果 [条件 B]:
- 执行操作 B
- 记录日志

否则:
- 执行默认操作
```

---

## 与 TypeScript 插件对比

| 特性 | Markdown 插件 | TypeScript 插件 |
|------|-------------|----------------|
| 创建难度 | ⭐ 极简单 | ⭐⭐⭐⭐ 复杂 |
| 代码量 | < 50 行 | 170+ 行 |
| 上手时间 | 2 分钟 | 30 分钟 |
| 技术要求 | 会写 Markdown | TypeScript + 接口 |
| 灵活性 | ⭐⭐⭐ 中等（AI 驱动） | ⭐⭐⭐⭐⭐ 极高 |
| 执行可靠性 | ⭐⭐⭐ 依赖 AI | ⭐⭐⭐⭐⭐ 确定性 |
| 适用场景 | 工作流程、标准操作 | 复杂逻辑、系统集成 |

**选择建议**:
- 工作流程类任务 → **Markdown 插件**
- 简单命令 → **Markdown 插件**
- 复杂逻辑 → **TypeScript 插件**
- 性能关键 → **TypeScript 插件**

---

## 环境要求

### 必需

- **Python 3.7+** - 执行 Markdown 插件
- **OpenAI API Key** - AI 驱动执行

### 验证环境

```bash
# 检查 Python
python3 --version

# 检查 API Key
echo $OPENAI_API_KEY

# 测试 Python 执行器
python3 python/execute_plugin.py --help
```

---

## 故障排查

### 问题: Python 执行器找不到

```bash
# 确认 Python 路径
which python3

# 如果需要，设置环境变量
export PYTHON_PATH=/usr/bin/python3
```

### 问题: API 调用失败

```bash
# 检查 API Key
echo $OPENAI_API_KEY

# 检查 Base URL (如果使用代理)
echo $OPENAI_BASE_URL
```

### 问题: 插件未加载

```bash
# 确认插件文件存在
ls plugins/my-plugin/PLUGIN.md

# 检查 frontmatter 格式
head -n 5 plugins/my-plugin/PLUGIN.md
```

---

## 最佳实践

### 1. 清晰的步骤描述

✅ **好**:
```markdown
## 步骤 1: 识别文件类型
- 检查文件扩展名
- 识别编程语言
- 确定解析器类型
```

❌ **差**:
```markdown
## 步骤 1
分析文件
```

### 2. 定义输出格式

✅ **好**:
```markdown
## 输出格式

### 📊 分析报告
**文件**: [文件路径]
**类型**: [类型]
**问题**: [列表]
```

❌ **差**:
```markdown
输出结果
```

### 3. 提供使用示例

✅ **好**:
```markdown
**使用示例**:
- `/my-review src/app.ts`
- `/my-review lib/utils.js`
```

❌ **差**:
```markdown
(没有示例)
```

### 4. 版本控制

```yaml
---
version: 1.0.0  # 记住更新版本号
---
```

---

## 下一步

1. **创建你的第一个插件**
   ```bash
   kode-create-plugin markdown my-first-plugin --template code-review
   ```

2. **编辑工作流程**
   ```bash
   vim plugins/my-first-plugin/PLUGIN.md
   ```

3. **测试插件**
   ```bash
   npx newma-cli -i
   > /my-first-plugin test input
   ```

4. **分享你的插件**
   - 发布到 GitHub
   - 提交到 Newma 插件市场（即将推出）

---

## 需要帮助?

- 📖 完整文档: [CLAUDE.md](./CLAUDE.md)
- 💬 问题反馈: [GitHub Issues](https://github.com/your-repo/issues)
- 🎨 模板目录: `templates/plugins/markdown/`

---

**Happy Plugin Development! 🚀**
