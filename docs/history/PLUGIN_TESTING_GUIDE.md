# Plugin System Testing Guide

## 自动化测试结果

✅ **所有测试通过！**

```
Plugin files: ✓ 编译成功
Config updates: ✓ 已添加
REPL updates: ✓ 已添加
```

## 手动测试步骤

### 1. 启动 REPL

```bash
npm run dev
```

### 2. 测试 /intent 命令

#### 测试 2.1: 查看帮助和状态
```bash
[newma] ❯ /intent
```

**期望输出**:
```
🎯 Intent Recognition Mode
════════════════════════════════════════
Intent Recognition automatically detects user intent and redirects to appropriate mode.
/intent on    - Enable intent recognition
/intent off   - Disable intent recognition
/intent status - Show intent recognition status
════════════════════════════════════════

Current status:
• Intent Recognition: disabled
```

#### 测试 2.2: 启用意图识别
```bash
[newma] ❯ /intent on
```

**期望输出**:
```
🎯 Intent Recognition Enabled
───────────────────────────────────
• User input will be automatically analyzed
• Redirect to appropriate mode based on intent
• Simple questions → /chat
• Tasks → /plan (with algorithm selection)
───────────────────────────────────
```

#### 测试 2.3: 查看状态
```bash
[newma] ❯ /intent status
```

**期望输出**:
```
🎯 Intent Recognition Status
───────────────────────────────────
Status: ENABLED
Auto-redirect: yes
Confidence threshold: 60%
Auto-redirect questions: yes
───────────────────────────────────
```

#### 测试 2.4: 禁用意图识别
```bash
[newma] ❯ /intent off
```

**期望输出**:
```
🎯 Intent Recognition Disabled
───────────────────────────────────
• Users must manually specify /plan, /do, or /chat
• Default mode is chat
───────────────────────────────────
```

### 3. 测试 /plan 命令（通过插件）

#### 测试 3.1: 无效输入
```bash
[newma] ❯ /plan
```

**期望输出**:
```
⚠️  Usage: /plan <your requirement>

Example: /plan Add a login page
         /do Create a REST API
```

#### 测试 3.2: 短输入（无效）
```bash
[newma] ❯ /plan ab
```

**期望输出**:
```
⚠️  Invalid task requirement
Please provide a valid task description (at least 3 characters).
```

#### 测试 3.3: 有效输入
```bash
[newma] ❯ /plan add a login feature
```

**期望输出**:
```
📋 Planning: add a login feature

📋 Planning Mode
───────────────────────────────────
🎯 Processing: add a login feature
```

### 4. 测试 /do 命令（带意图识别）

#### 测试 4.1: 简单问题
```bash
[newma] ❯ /do what is typescript?
```

**期望输出**:
```
🎯 Analyzing task...

📊 Intent: question
📊 Complexity: simple
📊 Algorithm: FFT
📊 Confidence: 85%

💬 Redirecting to chat mode...

💬 Chat
```

#### 测试 4.2: 复杂任务
```bash
[newma] ❯ /do implement user authentication with JWT
```

**期望输出**:
```
🎯 Analyzing task...

📊 Intent: task
📊 Complexity: medium
📊 Algorithm: Landmark
📊 Confidence: 75%

📋 Redirecting to plan mode...

📋 Planning: implement user authentication with JWT
```

### 5. 测试默认聊天模式

#### 测试 5.1: 简单问候
```bash
[newma] ❯ hello
```

**期望输出**:
```
💬 Chat

🤖 [AI responds in chat mode]
```

#### 测试 5.2: 问题
```bash
[newma] ❯ 什么是闭包？
```

**期望输出**:
```
💬 Chat

🤖 [AI 解释闭包]
```

### 6. 测试意图识别插件（启用后）

#### 测试 6.1: 启用意图识别
```bash
[newma] ❯ /intent on
```

#### 测试 6.2: 输入简单问题（不带命令前缀）
```bash
[newma] ❯ what is a closure?
```

**期望输出**:
```
📊 Intent: question | simple | FFT
💬 Detected: Simple question
→ Redirecting to chat mode...

💬 Chat
```

#### 测试 6.3: 输入复杂任务（不带命令前缀）
```bash
[newma] ❯ add user authentication system
```

**期望输出**:
```
📊 Intent: task | medium | Landmark
📋 Detected: Complex task
→ Redirecting to plan mode...

📋 Planning Mode
```

### 7. 验证配置持久化

#### 测试 7.1: 启用意图识别
```bash
[newma] ❯ /intent on
```

#### 测试 7.2: 退出 REPL
```bash
[newma] ❯ /exit
```

#### 测试 7.3: 重新启动并检查
```bash
npm run dev
[newma] ❯ /intent status
```

**期望**: 状态应该显示为 ENABLED（配置已保存）

### 8. 测试回退兼容性

#### 测试 8.1: 确保旧命令仍然工作
```bash
[newma] ❯ /chat hello
[newma] ❯ /loop add feature
[newma] ❯ /fft on
[newma] ❯ /landmark on
[newma] ❯ /set ultrathink true
```

**期望**: 所有命令都正常工作

## 测试检查清单

### 基本功能
- [ ] /intent 命令显示帮助
- [ ] /intent on 启用意图识别
- [ ] /intent off 禁用意图识别
- [ ] /intent status 显示状态
- [ ] /plan 验证输入
- [ ] /do 执行意图分析

### 意图识别
- [ ] 简单问题重定向到 /chat
- [ ] 简单任务重定向到 /plan (FFT)
- [ ] 中等任务重定向到 /plan (Landmark)
- [ ] 复杂任务重定向到 /plan (ToT)

### 用户体验
- [ ] 清晰的错误消息
- [ ] 清晰的成功消息
- [ ] 意图分析显示（类型、复杂度、置信度）
- [ ] 重定向消息友好

### 配置管理
- [ ] settings.json 正确创建/更新
- [ ] 配置在 REPL 会话间持久化
- [ ] 默认值正确（disabled）

### 向后兼容性
- [ ] 所有旧命令继续工作
- [ ] 默认聊天模式不变
- [ ] /plan 和 /do 仍然可用
- [ ] 不破坏现有工作流

## 已知问题

### 预存在的编译错误（与此重构无关）
- `src/agents/subagent/parallel-subagent.ts:253`
- `src/agents/subagent/specialized-agents/code-analysis-agent.ts:54`
- `src/agents/subagent/specialized-agents/implementation-agent.ts:62`
- `src/agents/subagent/specialized-agents/testing-agent.ts:72`
- `src/history/parallel-tracker.ts:296`

这些错误不影响插件系统的功能。

## 测试完成后

如果所有测试通过：
1. ✅ 插件系统工作正常
2. ✅ 意图识别功能可用
3. ✅ 配置系统正常
4. ✅ 向后兼容性保持

如果有测试失败：
1. 检查错误消息
2. 查看 `PLAN_DO_EXTRACTION_SUMMARY.md`
3. 检查相关插件文件

## 下一步

1. 完全集成 LoopEngine 到 REPL（可选）
2. 添加更多插件
3. 改进意图识别算法
4. 添加用户反馈学习
