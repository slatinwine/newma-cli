# Hookify 错误修复

## 问题描述

经常出现错误信息：
```
⎿  PostToolUse:Bash says: Hookify import error: No module named 'hookify'
```

## 根本原因

**Hookify 插件的 Python 导入路径错误**。

插件脚本位置：
`~/.claude/plugins/cache/claude-code-plugins/hookify/0.1.0/hooks/posttooluse.py`

错误的导入（第 22-23 行）：
```python
from hookify.core.config_loader import load_rules
from hookify.core.rule_engine import RuleEngine
```

但插件目录中 `core/__init__.py` 是空的，无法建立 `hookify.core` 包结构。

## 解决方案

### 方案 1：禁用 Hookify 插件（推荐）✅

**已实施** - 在 `~/.claude/settings.json` 中禁用：

```json
"hookify@claude-code-plugins": false
```

**为什么推荐**：
- Hookify 插件功能不是必需的
- 禁用后不影响核心功能
- 立即消除错误消息
- 可以随时重新启用

### 方案 2：修复插件（如果需要）

如果需要使用 Hookify 插件，需要修复 Python 导入路径：

**选项 A**：修改 `core/__init__.py`
```python
# core/__init__.py
from .config_loader import load_rules
from .rule_engine import RuleEngine
```

**选项 B**：修改 `hooks/posttooluse.py`
```python
# 修改导入语句
from core import config_loader
from core import rule_engine

# 使用时
rules = config_loader.load_rules(event=event)
engine = rule_engine.RuleEngine()
```

## Hookify 插件的作用

Hookify 插件允许在 `.claude/*.local.md` 文件中配置自定义规则：

```markdown
---
rules:
  - when:
      tool: Bash
      command: "rm -rf"
    then:
      deny: true
      message: "Dangerous command blocked"
---
```

**大多数用户不需要这个功能**，因为：
- 内置的权限系统已经足够
- 可以用 `permissions.allow/deny` 配置
- Hookify 增加了复杂度但收益不大

## 验证修复

禁用插件后，重新启动 Claude Code，错误消息应该消失。

如果想测试 hookify 是否仍然工作：
```bash
# 重新启用
# 在 ~/.claude/settings.json 中改为 true
"hookify@claude-code-plugins": true
```

## 其他相关错误

如果看到其他 hook 相关错误，可能是：
- **ralph-loop** - 同样可以禁用
- **其他插件的 hooks** - 禁用相应插件

## 推荐配置

**禁用的插件**（有 bug 或不需要）：
- hookify ❌
- ralph-wiggum ❌

**保留的插件**（有用）：
- commit-commands ✅
- context7 ✅
- code-simplifier ✅
- feature-dev ✅
- code-review ✅
- playwright ✅
