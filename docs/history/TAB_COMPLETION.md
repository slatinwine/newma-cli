# Tab 自动补全功能

Newma (牛码) CLI 现在支持智能 tab 自动补全，帮助您更快地输入命令和选项。

## 功能特性

### ✅ REPL 模式自动补全

在交互式 REPL 模式下 (`npx newma-cli -i`)，按 `Tab` 键可以自动补全：

#### 1. 命令名补全
```
[newma] ❯ /h<Tab>          # 显示: /help, /history, /hooks
[newma] ❯ /pl<Tab>         # 显示: /plan, /plugins
[newma] ❯ ?<Tab>           # 显示: ? (别名)
```

#### 2. /set 命令选项补全
```
[newma] ❯ /set <Tab>               # 显示所有可用选项
[newma] ❯ /set u<Tab>              # 显示: ultrathink, useTools
[newma] ❯ /set ultrathink <Tab>    # 显示: true, false
[newma] ❯ /set executionMode <Tab> # 显示所有执行模式
```

#### 3. /help 命令分类补全
```
[newma] ❯ /help <Tab>      # 显示: general, planning, execution, verification, advanced
[newma] ❯ /help g<Tab>     # 显示: general
```

#### 4. 文件路径补全
```
[newma] ❯ ./sr<Tab>        # 显示: src/
[newma] ❯ README<Tab>      # 显示: README.md
```

### ✅ Shell 自动补全

为 Bash 和 Zsh 提供了 shell 级别的补全脚本：

#### Bash 安装
```bash
# 方法 1: 复制到系统目录
sudo cp completion.bash /etc/bash_completion.d/kode
source /etc/bash_completion.d/kode

# 方法 2: 添加到 .bashrc
cat completion.bash >> ~/.bashrc
source ~/.bashrc
```

#### Zsh 安装
```bash
# 复制到 Zsh 补全目录
mkdir -p ~/.zsh/completion
cp completion.zsh ~/.zsh/completion/_kode

# 添加到 .zshrc
echo "fpath=(~/.zsh/completion \$fpath)" >> ~/.zshrc
echo "autoload -U compinit && compinit" >> ~/.zshrc
source ~/.zshrc
```

## 支持的命令

所有命令都支持 tab 补全：

| 命令 | 别名 | 描述 |
|------|------|------|
| `/help` | `?`, `h` | 显示帮助信息 |
| `/status` | - | 显示会话状态 |
| `/history` | - | 显示命令历史 |
| `/clear` | `cls` | 清屏 |
| `/exit` | `quit` | 退出 REPL |
| `/time` | - | 显示当前时间 |
| `/chat` | - | 聊天模式 |
| `/plan` | - | 规划模式 |
| `/do` | - | 执行模式 |
| `/loop` | - | 循环模式 |
| `/set` | - | 设置配置选项 |
| `/fft` | - | FFT 规划模式 |
| `/landmark` | - | Landmark 规划模式 |
| `/ultrathink` | - | 超级思考模式 |
| `/profile` | - | 用户侧写 |
| `/plugins` | - | 插件管理 |
| `/hooks` | - | Hook 管理 |

## /set 命令选项

| 选项 | 类型 | 可选值 |
|------|------|--------|
| `ultrathink` | Boolean | `true`, `false` |
| `fft` | Boolean | `true`, `false` |
| `landmark` | Boolean | `true`, `false` |
| `verify` | Boolean | `true`, `false` |
| `useTools` | Boolean | `true`, `false` |
| `debug` | Boolean | `true`, `false` |
| `compress` | Boolean | `true`, `false` |
| `autoFix` | Boolean | `true`, `false` |
| `autoOptimize` | Boolean | `true`, `false` |
| `executionMode` | Enum | `standard`, `function-calling`, `two-phase`, `multi-agent`, `subagent` |
| `permissionLevel` | Enum | `read_only`, `safe`, `standard`, `dangerous` |

## 使用示例

### 示例 1: 快速设置选项
```bash
[newma] ❯ /set ul<Tab>         # 自动补全为 ultrathink
[newma] ❯ /set ultrathink <Tab> # 显示 true/false
[newma] ❯ /set ultrathink tru<Tab> # 自动补全为 true
```

### 示例 2: 查看命令帮助
```bash
[newma] ❯ /help <Tab>     # 显示所有分类
[newma] ❯ /help gen<Tab>  # 自动补全为 general
```

### 示例 3: 文件路径补全
```bash
[newma] ❯ /plan ./sr<Tab>  # 自动补全为 ./src/
[newma] ❯ /plan README.<Tab>  # 显示 README.md
```

## 技术实现

### 核心文件

- **`src/completion.ts`** - 补全系统核心实现
  - `AutoCompleter` 类：智能补全引擎
  - 支持命令、选项、文件路径、历史记录等多种补全类型
  - 自动识别输入上下文，提供相关补全建议

- **`src/repl.ts`** - REPL 集成
  - 在 `REPLManager` 中集成补全器
  - 与命令历史同步
  - 支持动态更新补全候选项

### 补全算法

```typescript
// 核心补全逻辑
complete(line: string): CompletionResult {
  const trimmed = line.trim();

  // 1. 空行：显示所有命令
  if (!trimmed) return allCommands();

  // 2. 命令补全：以 / 开头或别名
  if (isCommand(trimmed)) return completeCommand(line);

  // 3. 文件路径补全：包含 / 或 .
  if (looksLikePath(trimmed)) return completePath(line);

  // 4. 默认：无补全
  return empty();
}
```

### 智能上下文识别

系统能够识别不同的输入上下文：

1. **命令名补全**：`/h<Tab>` → `/help`, `/history`, `/hooks`
2. **选项补全**：`/set <Tab>` → `ultrathink`, `fft`, `verify`...
3. **值补全**：`/set ultrathink <Tab>` → `true`, `false`
4. **路径补全**：`./sr<Tab>` → `./src/`

## 故障排除

### Tab 补全不工作

**问题**: 按 Tab 键没有反应

**解决方案**:
1. 确认在 REPL 模式下（`npx newma-cli -i`）
2. 检查是否安装了最新版本：`npm run build`
3. 某些终端可能需要设置：`set bell-style visible`

### Shell 补全不工作

**问题**: 在命令行中 `kode <Tab>` 没有补全

**解决方案**:
1. **Bash**: 确认脚本已 source：`source ~/.bashrc`
2. **Zsh**: 确认补全系统已初始化：`autoload -U compinit && compinit`
3. 重启终端或重新加载配置

### 补全候选项不完整

**问题**: Tab 补全显示的选项不完整或过时

**解决方案**:
1. 重新构建项目：`npm run build`
2. 重启 REPL 会话
3. 检查是否有插件覆盖了默认命令

## 性能考虑

- **缓存机制**: 命令列表和文件系统扫描结果被缓存
- **延迟加载**: 文件路径补全按需加载，不扫描整个项目
- **增量更新**: 补全候选项根据输入动态过滤，不影响性能

## 未来改进

计划中的功能增强：

1. **模糊匹配**: 支持拼音、缩写等模糊匹配
2. **智能建议**: 根据历史使用频率排序补全建议
3. **自定义补全**: 允许插件注册自定义补全逻辑
4. **跨会话学习**: 记住用户最常用的命令和选项

## 贡献

欢迎贡献改进！您可以：

1. 报告 bug 或提出功能建议
2. 提交 PR 改进补全算法
3. 添加更多命令和选项的补全支持
4. 优化性能和用户体验

---

**版本**: 3.3.0+
**最后更新**: 2026-01-27
