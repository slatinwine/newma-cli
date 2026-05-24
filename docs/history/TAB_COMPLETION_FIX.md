# Tab 自动补全故障排除指南

## 问题诊断

Newma (牛码) CLI 的 tab 补全功能已经正确实现，但可能由于以下原因无法正常工作：

### 1. 终端兼容性问题

某些终端（特别是 iTerm2、Terminal.app 的某些配置）可能不会正确处理 tab 键。

### 2. Shell 配置问题

如果你在 shell 中运行 `npx newma-cli -i`，你的 shell 配置可能会干扰 tab 键的处理。

### 3. 输入法冲突

如果你正在使用中文输入法，tab 键可能被输入法拦截。

## 解决方案

### 方案 1: 使用 REPL 历史浏览（推荐）

Tab 补全的替代方案是使用 **上下箭头键** 浏览命令历史：

```bash
$ npx newma-cli -i

[newma] ❯  # 按 ↑ 键显示上一条命令
[newma] ❯  # 按 ↓ 键显示下一条命令
```

### 方案 2: 确保终端支持

1. **检查终端设置**：
   - 确保终端启用了 "Application Keypad" 模式
   - iTerm2: Preferences → Profiles → Keys → Key Mappings
   - Terminal.app: Preferences → Profiles → Keyboard

2. **使用推荐的终端**：
   - **iTerm2** (macOS 推荐)
   - **Terminal.app** (macOS 内置)
   - **Alacritty** (跨平台)
   - **VS Code 集成终端**

### 方案 3: 临时解决方法

如果 tab 补全仍然不工作，你可以：

1. **输入命令的前几个字符**，然后按 **↑ 键** 查找历史命令
2. **使用 `/help` 命令** 查看所有可用命令
3. **使用 shell 补全**（如果你安装了 completion scripts）：

```bash
# 安装 shell 补全脚本
source completion.bash  # Bash
source completion.zsh   # Zsh

# 然后使用
$ npx newma-cli <Tab>  # 在 shell 级别补全命令
```

### 方案 4: 手动测试 Tab 补全

运行测试脚本验证补全功能是否正常：

```bash
# 运行自动化测试
npx ts-node test-tab-completion.ts

# 交互式测试
npx ts-node test-completer-direct.ts
```

如果测试显示补全逻辑正确，但实际使用时不工作，那就是终端配置问题。

## 技术细节

### 补全实现位置

- **核心实现**: `src/completion.ts`
- **REPL 集成**: `src/repl.ts:68` - `completer: this.completer.createCompleter()`
- **Shell 脚本**: `completion.bash`, `completion.zsh`

### 补全工作原理

```typescript
// 1. 用户按 Tab 键
// 2. readline 调用 completer(line)
// 3. completer 返回 [candidates, type]
// 4. readline 显示候选项或自动补全
```

### 已知问题

1. **iTerm2 + 某些 shell 配置**: Tab 键被 shell 拦截
2. **VS Code 集成终端**: 有时需要手动配置 "terminal.integrated.allowChords"
3. **tmux 会话**: 需要在 `.tmux.conf` 中设置 `set -g terminal-overrides`

## 测试清单

使用以下清单检查问题：

- [ ] 在新的终端窗口中测试
- [ ] 禁用输入法后测试
- [ ] 使用不同的终端应用测试
- [ ] 运行 `npx ts-node test-completer-direct.ts` 测试
- [ ] 检查是否有 shell 配置干扰（.bashrc, .zshrc）
- [ ] 尝试直接运行 `node dist/cli.js -i`

## 替代方案：使用别名

如果 tab 补全不方便，可以创建常用命令的别名：

```bash
# 在 ~/.bashrc 或 ~/.zshrc 中添加
alias k='npx newma-cli -i'
alias kp='npx newma-cli -i -c "/plan "'
alias kd='npx newma-cli -i -c "/do "'
alias kh='npx newma-cli -i -c "/help "'
```

## 报告问题

如果以上方案都无法解决问题，请提供以下信息：

1. 终端应用名称和版本
2. Shell 类型（`echo $SHELL`）
3. Node.js 版本（`node --version`）
4. 操作系统版本（`uname -a`）
5. 测试脚本的输出（`npx ts-node test-tab-completion.ts`）

---

**更新时间**: 2026-01-27
**版本**: 3.3.0
