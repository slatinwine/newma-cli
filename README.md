# Newma (牛码) - AI-Driven Multi-Agent Code Assistant

<div align="center">

**Version 3.4.0** | Enterprise-Grade AI Development Assistant with Advanced Reasoning & Auto-Learning

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-22%2B-green)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/tests-91%25%20passing-brightgreen)](https://github.com)

</div>

## 🌟 Overview

Newma (牛码) is an advanced AI-driven command-line assistant that follows a `plan → search → execute → verify` loop with **multi-agent orchestration**, **tool-based architecture**, **permission control**, **automatic verification**, and now **advanced AI reasoning** with Tree of Thoughts and ReAct.

**Default AI Provider**: Zhipu AI GLM-5 (OpenAI-compatible format)

### 🎉 NEW: Event-Driven Architecture (v3.0)

Newma now features a **complete event-driven runtime architecture** inspired by π-mono, providing:

- 🚀 **Event-Driven Runtime** - Modern event loop architecture with priority queues
- 📊 **State Machine** - Complete execution state tracking and visualization
- 🔌 **Executor System** - Pluggable executor architecture with adapters
- 🔄 **Dual-Track Execution** - Run legacy and new systems in parallel
- 📝 **Review Mode** - File change approval system with diff display

**Enable with**: `npx newma-cli --use-runtime -i`

### Key Features

- 🚀 **Event-Driven Architecture** - Modern runtime with event loop and state machine (NEW!)
- 🤖 **Multi-Agent System** - Specialized agents for frontend, backend, testing, and more
- 🔧 **Tool-Based Architecture** - Extensible plugin system for custom operations
- 🔒 **Permission Control** - Four-level security system for safe operations
- ✅ **Automatic Verification** - Multi-stage quality checks with auto-fix
- ↩️ **Git-Based Rollback** - Automatic checkpoints and instant recovery
- 📊 **Execution Tracking** - Complete audit trail of all operations
- 🔄 **Smart Retry Logic** - Exponential backoff for transient failures
- 💬 **Interactive Mode** - REPL-style continuous interaction session
- 🌳 **Tree of Thoughts** - Multi-path reasoning for intelligent planning
- 🔄 **ReAct Verification** - Self-correcting verification with auto-fix
- ⏰ **Precipitation System** - Auto-learn from coding patterns and generate reusable skills
- 📝 **Review Mode** - File change approval with diff visualization (NEW!)
- 🎯 **State Tracking** - Complete execution state visualization (NEW!)

## 🚀 Quick Start

### Prerequisites

- Node.js 22 or higher
- Bun (optional, for faster plugin development) - [Install Bun](https://bun.sh)
- Git (for rollback functionality)
- OpenAI-compatible API key (default: Zhipu AI)

### Installation

```bash
# Install globally
npm install -g newma-cli

# Or use with npx (no installation needed)
npx newma-cli <requirement>
```

### Basic Usage

```bash
# Simple task
npx newma-cli "add a login page"

# With multi-agent system
npx newma-cli --multi-agent "create a REST API for user management"

# With ultrathink (advanced AI reasoning)
npx newma-cli --ultrathink "build a user authentication system with OAuth"

# With ultrathink + ReAct verification
npx newma-cli --ultrathink --verify "create a comprehensive testing suite"

# With all features
npx newma-cli --multi-agent --use-tools --permission-level standard --verify \
  "build a full-stack todo app with React and Express"
```

### Interactive Mode (NEW!)

Start an interactive REPL session for continuous development:

```bash
# Start interactive mode (legacy readline REPL)
npx newma-cli -i

# Or
npx newma-cli --interactive

# With new Event Stream REPL (Codex-style architecture)
npx newma-cli -i --event-stream

# With options
npx newma-cli -i --use-tools --verify
```

**Interactive Mode Features:**
- 💬 **Default Chat Mode** - Natural conversation with AI (type anything)
- 👤 **User Profiling** - AI learns your preferences (language, style, tech stack)
- ⚡ **Tab Completion** - Press Tab to autocomplete commands, options, and file paths
- 🎯 **Task Execution** - Use `/plan` or `/do` for complex tasks
- ⚡ **Instant Feedback** - See results immediately
- 🛑 **Interruptible** - Press Ctrl+C to cancel AI requests
- 📊 **Session Management** - Track history and statistics
- 🎯 **Context Preservation** - Maintain state across commands
- ⏰ **Precipitation System** - Auto-learn from coding patterns (NEW!)

**Event Stream REPL (Experimental, --event-stream):**
- 🔄 **Non-blocking Polling** - Advanced event loop architecture
- ⏸️ **Pause/Resume** - Full stdin release for external programs
- 🔌 **External Editor Integration** - `/vim` command to open files
- 🎨 **Rich Event Handling** - Support for Key, Paste, Draw, Signal events
- 📊 **Event Broker** - Codex-style event management

**Special Commands:**
- `/plan <requirement>` or `/do <requirement>` - Execute task with AI planning
- `/status` - Show session status and statistics
- `/history` - Show command history
- `/clear` - Clear the screen
- `/preset <fast|standard|thorough|expert>` - Quick configuration presets
- `/mode` - Show or change execution mode
- `/ultrathink` - Toggle AI reasoning features
- `/help` - Show help information
- `/exit` - Exit the session

**Precipitation Commands (Skill Management):**
- `/drafts [--pending|--approved|--rejected]` - List skill drafts
- `/approve <draft-id> [note]` - Approve a draft as a skill
- `/reject <draft-id> [note]` - Reject a draft
- `/view-draft <draft-id>` - View draft details
- `/delete-draft <draft-id>` - Delete a draft
- `/precipitate` - Manually trigger skill generation
- `/precipitation-status` - Show system status
- `/precipitation-schedule` - Show next scheduled run

**Example Session:**
```bash
$ npx newma-cli -i

╔══════════════════════════════════════════════════════════════╗
║           Newma (牛码) AI Assistant - Interactive Mode        ║
╚══════════════════════════════════════════════════════════════╝

Session: abc123
Project: my-app

💬 Default: Chat with AI
🎯 Task: Use /plan or /do to execute tasks

Special commands:
  /plan or /do - Execute task with planning
  /status       - Show session status
  /clear        - Clear screen
  /history      - Show command history
  /help         - Show all commands
  /exit         - Exit session

# Default: Chat with AI
[my-app] ❯ What's the best way to structure a React project?

💬 Chat

📤 Sending message to AI...
--- Request ---
What's the best way to structure a React project?

📥 Received response in 2341ms
--- Response ---
There are several ways to structure a React project...
[AI response continues...]

✅ Done

# Execute a task with planning
[my-app] ❯ /plan add a login form

🎯 Planning Mode
─────────────────────────────────────────────────────

🤖 Thinking...

📋 TODO List:
─────────────────────────────────────────────────────
  1. Create login component
  2. Add form validation
  3. Connect to API
─────────────────────────────────────────────────────

⚡ Action Plan:
─────────────────────────────────────────────────────
  1. Create src/components/LoginForm.tsx
  2. Modify src/App.tsx
─────────────────────────────────────────────────────

✅ All actions completed successfully!

# Use /do as shorthand for /plan
[my-app] ❯ /do add OAuth authentication

🎯 Planning Mode
─────────────────────────────────────────────────────

🌳 Tree of Thoughts Planning:
─────────────────────────────────────────────────────
Exploring 5 alternative approaches...
Evaluating thoughts with AI...
Selected best plan (confidence: 0.92)
─────────────────────────────────────────────────────

[my-app] ❯ /set verify true
✓ ReAct verification enabled

[my-app] ❯ /status
Session: abc123
Commands: 4
Ultrathink: enabled
Verification: enabled
```

## 👤 User Profiling (NEW!)

Newma (牛码) now automatically learns your preferences and adapts to your style! After every 5 conversations, the AI analyzes your interactions to build a user profile.

### How It Works

1. **Track Conversations** - Every chat message is recorded
2. **Auto-Generate Profile** - After 5 conversations, AI analyzes your inputs
3. **Extract Preferences** - Language, style, tech stack, communication patterns
4. **Save Profile** - Stored in `用户侧写.md` in your project root
5. **Adapt Responses** - All future AI responses use your profile

### What Gets Captured

- **Language Preference** - Chinese, English, or other languages
- **Communication Style** - Concise, detailed, formal, casual
- **Technical Preferences** - Programming languages, frameworks, tools
- **Other Traits** - Any patterns detected in your interactions

### Example Profile

```markdown
- **语言偏好**：中文
- **交流风格**：简洁直接，注重代码质量
- **技术偏好**：TypeScript, React, Node.js
- **其他特征**：喜欢函数式编程，注重测试覆盖率
```

### Benefits

✨ **Consistent Language** - AI always responds in your preferred language
✨ **Matching Style** - Responses match your communication preferences
✨ **Tech Stack Alignment** - Code comments and variable names follow your preferences
✨ **Cross-Mode Application** - Profile applies to chat, planning, and verification modes

### Example Session

```bash
$ npx newma-cli -i

# Start chatting
[newma] ❯ 你好
💬 Chat
📤 Sending message to AI...
📥 Received response in 1234ms
你好！有什么我可以帮您的吗？

[newma] ❯ 帮我写个登录组件
💬 Chat
[AI responds in Chinese with TypeScript code]

# ... after 5 conversations ...

📊 Updating user profile...
✅ User profile updated!

# All future interactions use your profile
[newma] ❯ help me add unit tests
💬 Chat
[AI responds in Chinese, uses your preferred testing framework]
```

### Profile Location

Profiles are saved as `用户侧写.md` in your project root:

```bash
./用户侧写.md  # Auto-generated profile
./KODE.md      # Session summaries
./CLAUDE.md    # Project documentation
```

### Customize Your Profile

You can manually edit `用户侧写.md` to add or modify preferences:

```markdown
# 用户侧写.md

- **语言偏好**：中文
- **交流风格**：简洁，不要太啰嗦
- **技术偏好**：TypeScript, React, Node.js, PostgreSQL
- **其他特征**：
  - 喜欢函数式编程
  - 注重代码可读性
  - 使用 ESLint 和 Prettier
  - 优先使用 async/await 而不是 callbacks
```

The AI reads this file before every response and adapts accordingly!

## 📋 Table of Contents

- [User Profiling](#user-profiling-new)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Architecture](#architecture)
- [Features](#features)
- [CLI Reference](#cli-reference)
- [Examples](#examples)
- [Development](#development)
- [Documentation](#documentation)

## 📦 Installation

```bash
# From NPM
npm install -g newma-cli

# From source
git clone https://github.com/your-org/kode.git
cd kode
npm install
npm run build
npm link
```

## ⚙️ Configuration

Newma (牛码) 支持两种配置方式：**settings.json**（推荐）和 **.env** 文件。

### 快速配置（推荐）

运行初始化向导自动生成配置文件：

```bash
npm run init-settings
```

向导会引导你完成所有配置，包括 API Key、Base URL 和项目偏好设置。

### 手动配置

**方式一：settings.json（推荐）**

项目配置（仅当前项目）:
```bash
cp settings.example.json settings.json
# 编辑 settings.json 填入你的配置
```

全局配置（所有项目）:
```bash
mkdir -p ~/.kode
cp settings.example.json ~/.kode/settings.json
# 编辑 ~/.kode/settings.json 填入你的配置
```

**方式二：.env 文件**

创建 `.env` 文件：
```bash
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4  # Optional, defaults to Zhipu AI
OPENAI_ENDPOINT=                                        # Optional: 完整 API 端点（优先级高于 BASE_URL）
OPENAI_MODEL=glm-5                                      # Optional
```

**使用其他 OpenAI 兼容服务：**

对于使用 OpenAI 兼容格式的 AI 服务，可以设置完整的 API endpoint：

```bash
# 示例：使用 OpenAI 官方 API
OPENAI_API_KEY=sk-your-openai-key
OPENAI_ENDPOINT=https://api.openai.com/v1/chat/completions
OPENAI_MODEL=gpt-4o-mini
```

或者在 `settings.json` 中：
```json
{
  "openai": {
    "apiKey": "your-api-key",
    "baseUrl": "https://api.openai.com",
    "endpoint": "https://api.openai.com/v1/chat/completions",
    "model": "gpt-4o-mini"
  }
}
```

**API 兼容性设置（重要）:**

如果你使用的是**第三方 OpenAI 兼容 API**（非官方 OpenAI），可能需要调整兼容性设置：

```bash
# 方法一：环境变量
OPENAI_SUPPORTS_RESPONSE_FORMAT=true  # 如果你的 API 支持 response_format 参数

# 方法二：settings.json
{
  "openai": {
    "apiKey": "your-api-key",
    "baseUrl": "https://your-api-endpoint.com",
    "model": "your-model",
    "supportsResponseFormat": false  # 设为 false 避免使用不兼容的参数
  }
}
```

**常见 API 提供商的推荐设置:**

| API 提供商 | supportsResponseFormat | 说明 |
|-----------|----------------------|------|
| OpenAI 官方 | true (自动) | 完全支持所有功能 |
| Zhipu AI (智谱) | false (自动) | 不完全支持 response_format |
| 第三方兼容 API | false (默认) | 大多数不支持，保持默认即可 |

**遇到问题？**

如果 `/plan` 或 `/do` 命令返回乱码或空计划，尝试：

1. **方法一（推荐）**：设置 `OPENAI_SUPPORTS_RESPONSE_FORMAT=false`
2. **方法二**：使用 Function Calling 模式（`--use-tools`）

📖 **详细配置说明**: 查看 [SETTINGS.md](./SETTINGS.md) 了解更多配置选项和示例

📘 **智谱 AI 迁移指南**: 查看 [ZHIPU_AI_MIGRATION.md](./ZHIPU_AI_MIGRATION.md) 了解从 OpenAI 迁移到智谱 AI 的经验和最佳实践

## ⚡ Performance Optimization

**Version 3.1.1** - Significant performance improvements:

### 📊 Optimization Results

| Optimization | Before | After | Improvement |
|-------------|--------|-------|-------------|
| **Token Usage** | ~2800 tokens | ~400 tokens | **85% reduction** |
| **Function Calling Speed** | 50-60s | 35-45s | **25% faster** |
| **Ultrathink Speed** | 90-225s | 30-90s | **2.5-3x faster** |
| **API Compatibility** | Partial | Full | **100% compatible** |

### 🎯 Mode Selection Guide

**For Daily Development (85% of tasks)**:
```bash
npx newma-cli -i --use-tools
> /do your task here
```
- ⚡ Fastest: 30-50 seconds
- 🎯 Efficient: 2-3 iterations
- 💬 Interactive AI-Tool loop

**For Medium Tasks**:
```bash
npx newma-cli -i
> /plan create a login page
```
- ⏱️ Medium speed: 30-60 seconds
- 📋 Generates TODO list
- 👤 User confirmation before execution

**For Complex Systems**:
```bash
npx newma-cli -i
> /set ultrathink true
> /plan design a blog system
```
- 🧠 Deep reasoning: 60-90 seconds (optimized from 150-225s)
- 📊 3 alternative plans compared
- 🎯 Best solution selected

### 🔧 Performance Monitoring

Newma (牛码) now includes built-in performance monitoring:

```
⏱️  [API] Single call duration: 35714ms
⏱️  [Ultrathink] ToT search: 23456ms
⏱️  [Function Calling] Iteration 1: 35755ms
⏱️  [Function Calling] Iteration 2: 3662ms
⏱️  [Function Calling] Total iterations: 2
```

This helps you identify bottlenecks and optimize accordingly.

### 📚 Documentation

- 📖 **Complete Summary**: [PERFORMANCE_OPTIMIZATION_SUMMARY.md](./PERFORMANCE_OPTIMIZATION_SUMMARY.md) - Full optimization journey
- 🌳 **Ultrathink Tuning**: [ULTRATHINK_OPTIMIZATION.md](./ULTRATHINK_OPTIMIZATION.md) - Parameter optimization guide
- 🐛 **Bug Fixes**: [BUGFIX_PLAN_MODE.md](./BUGFIX_PLAN_MODE.md), [BUGFIX_EMPTY_PLAN.md](./BUGFIX_EMPTY_PLAN.md)

## 💻 Usage

### Basic Commands

```bash
# Single agent mode (default)
npx newma-cli "add input validation to the form"

# Multi-agent mode
npx newma-cli --multi-agent "refactor the authentication system"

# With automatic verification
npx newma-cli --verify "add unit tests for the user service"

# With custom permission level
npx newma-cli --permission-level dangerous "delete all test files"
```

### Real-World Examples

#### Frontend Development
```bash
npx newma-cli --multi-agent --verify \
  "add a user profile page with avatar upload and bio editing"
```

#### Backend Development
```bash
npx newma-cli --multi-agent --verify \
  "create REST API endpoints for CRUD operations on products"
```

#### Full-Stack Development
```bash
npx newma-cli --multi-agent --use-tools --permission-level standard --verify \
  "build a real-time chat application with WebSocket support"
```

## 🏗️ Architecture

### Five-Phase Implementation

**Phase 1 - Infrastructure** ✅
- Execution history tracking
- Git-based rollback mechanism
- Retry logic with exponential backoff
- Structured error handling

**Phase 2 - Tools & Verification** ✅
- Extensible tool system
- Four-level permission control
- Multi-stage verification system
- Automatic fix on verification failure

**Phase 3 - Multi-Agent** ✅
- Agent coordination and orchestration
- Task decomposition and planning
- Specialized agents (Frontend, Backend, etc.)
- Parallel execution with dependency resolution

**Phase 4 - Interactive REPL** ✅
- Continuous REPL session
- Session state management
- Interruptible AI operations (Ctrl+C)
- Special commands (/status, /history, /clear, /help, /exit)

**Phase 5 - Ultrathink AI Reasoning** ✅ **NEW!**
- Tree of Thoughts (ToT) for intelligent planning
- ReAct (Reasoning + Acting) for verification
- Multi-plan generation and evaluation
- Self-correcting verification with auto-fix
- ASCII thought tree visualization

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    KODE CLI v3.1                            │
├─────────────────────────────────────────────────────────────┤
│  Phase 5: Ultrathink AI Reasoning (NEW!)                   │
│  ┌─────────────┐  ┌─────────────┐                          │
│  │ Tree of     │  │  ReAct      │                          │
│  │ Thoughts    │  │  Loop       │                          │
│  │ (Planning)  │  │(Verification)│                         │
│  └─────────────┘  └─────────────┘                          │
│         │                 │                                 │
│         └─────────────────┴─────────────────┘               │
│                       │                                     │
├───────────────────────┼────────────────────────────────────┤
│  Phase 4: Interactive REPL                                  │
│  ┌─────────────┐  ┌─────────────┐                          │
│  │   REPL      │  │  Session    │                          │
│  │  Manager    │  │  Manager    │                          │
│  └─────────────┘  └─────────────┘                          │
├───────────────────────┼────────────────────────────────────┤
│  Phase 3: Multi-Agent System                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Frontend    │  │ Backend     │  │ More Agents │         │
│  │ Agent       │  │ Agent       │  │ (Testing)   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                 │                 │               │
│         └─────────────────┴─────────────────┘               │
│                       │                                     │
│              ┌────────▼────────┐                            │
│              │   Coordinator   │                            │
│              └────────┬────────┘                            │
├───────────────────────┼────────────────────────────────────┤
│  Phase 2: Tool & Permission System                         │
│  ┌─────────────┐  ┌─────────────┐                          │
│  │ File Tool   │  │Command Tool │                          │
│  └─────────────┘  └─────────────┘                          │
│         │                 │                                 │
│  ┌──────▼──────┐                                            │
│  │ Permissions │                                            │
│  │ Manager     │                                            │
│  └─────────────┘                                            │
├───────────────────────┼────────────────────────────────────┤
│  Phase 1: Core Infrastructure                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Execution   │  │  Rollback   │  │    Retry    │         │
│  │  Tracker    │  │  Manager    │  │    Logic    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                       │                                     │
│              ┌────────▼────────┐                            │
│              │   Verifier      │                            │
│              └─────────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

## ✨ Features

### 🤖 Multi-Agent System

**Available Agents:**
- **Frontend Agent** - UI components, styling, state management
- **Backend Agent** - APIs, business logic, database design
- **More Coming** - Testing, Documentation, DevOps agents

**Agent Coordination:**
```
Requirement → Coordinator → Task Decomposition
                          ↓
            ┌─────────────┴─────────────┐
            ↓                           ↓
      Frontend Agent              Backend Agent
            ↓                           ↓
            └─────────────┬─────────────┘
                          ↓
                   Result Aggregation
```

### 🔧 Tool System

**Built-in Tools:**
- `file` - Create, modify, delete files
- `command` - Execute shell commands safely

**Custom Tools:**
```typescript
const customTool: Tool = {
  name: 'my-tool',
  description: 'Does something cool',
  category: ToolCategory.ANALYSIS,
  permissions: [Permission.READ_FILES],
  handler: async (params, context) => {
    return { success: true, output: 'Done!' };
  },
};
```

### 🔒 Permission System

**Four Levels:**
1. `read_only` - Can only read files
2. `safe` (default) - Read/write files, run safe commands
3. `standard` - All safe + run commands
4. `dangerous` - All operations including destructive

**Permission Types:**
- `READ_FILES`, `WRITE_FILES`, `DELETE_FILES`
- `RUN_COMMANDS`, `MODIFY_GIT`, `NETWORK_ACCESS`

### ✅ Verification System

**Stages:**
1. Syntax Check (required) - TypeScript compilation
2. Linting (optional) - ESLint
3. Test Suite (optional) - Run tests
4. Build Check (required) - Build project

**Auto-Fix:**
- Detects failures
- Asks AI to fix
- Applies fixes
- Re-verifies

### ↩️ Rollback System

**Git-Based Checkpoints:**
- Automatic checkpoints before dangerous operations
- Instant recovery with `git reset`
- Commit-based restoration points
- Full history tracking

## 📚 CLI Reference

### Options

```
-V, --version                       output version number
-d, --dir <path>                    Project root directory (default: cwd)
-i, --interactive                   Start interactive REPL mode
--model <name>                      OpenAI model name
--base-url <url>                    OpenAI base URL
--max-iterations <n>                Maximum planning-verify cycles (default: 3)
--use-tools                         Enable tool-based architecture (experimental)
--permission-level <level>          Permission level: read_only|safe/standard/dangerous
--verify                            Run automatic verification after each iteration
--multi-agent                       Enable multi-agent system (experimental)
-h, --help                          Display help
```

### Examples

```bash
# Basic usage
npx newma-cli "add a login form"

# Interactive mode (NEW!)
npx newma-cli -i

# Interactive mode with tools and verification
npx newma-cli -i --use-tools --verify

# With multi-agent system
npx newma-cli --multi-agent "create a user authentication system"

# Full feature set
npx newma-cli --multi-agent --use-tools --permission-level standard --verify \
  "build a blog with comments and user authentication"

# Quick bug fix
npx newma-cli "fix the memory leak in the useEffect hook"

# Refactoring
npx newma-cli --multi-agent "convert class components to functional components"

# Testing
npx newma-cli --permission-level standard --verify \
  "add unit tests for the user service"
```

## 🔨 Development

### Build Commands

```bash
# Compile TypeScript
npm run build

# Run tests
npm test

# Run CLI directly
npm run dev -- "your requirement"

# Lint
npm run lint
```

### Project Structure

```
src/
├── agents/              # Multi-agent system (Phase 3)
├── tools/               # Tool system (Phase 2)
├── session.ts           # Session management (NEW!)
├── repl.ts              # Interactive REPL (NEW!)
├── executor-v2.ts       # Tool executor
├── permissions.ts       # Permission system
├── verifier.ts          # Verification system
├── history.ts           # Execution tracking (Phase 1)
├── rollback.ts          # Git rollback (Phase 1)
├── retry.ts             # Retry logic (Phase 1)
├── errors.ts            # Error handling (Phase 1)
├── cli.ts               # Main entry point
└── ...
```

### Adding New Agents

See [PHASE3_SUMMARY.md](./PHASE3_SUMMARY.md) for detailed guide.

## 📖 Documentation

- **[Phase 1 Summary](./PHASE1_SUMMARY.md)** - Infrastructure features
- **[Phase 2 Summary](./PHASE2_SUMMARY.md)** - Tool & verification system
- **[Phase 3 Summary](./PHASE3_SUMMARY.md)** - Multi-agent system
- **[CLAUDE.md](./CLAUDE.md)** - Developer instructions

## ❓ FAQ

<details>
<summary><b>Is Newma (牛码) safe to use?</b></summary>

Yes! Newma (牛码) includes multiple safety features:
- Permission control system
- Dangerous operation detection
- Git-based rollback (instant recovery)
- Execution tracking (full audit trail)
- Confirmation prompts before execution
</details>

<details>
<summary><b>What AI models does Newma (牛码) support?</b></summary>

Any OpenAI-compatible API:
- Zhipu AI (GLM-5, GLM-4.7, GLM-4-Plus) - **Default**
- OpenAI (GPT-4, GPT-4o, GPT-4o-mini)
- Azure OpenAI
- Local LLMs (via OpenAI-compatible APIs)
- Any service with OpenAI-compatible endpoints
</details>

<details>
<summary><b>How does the multi-agent system work?</b></summary>

1. Decomposes requirement into tasks
2. Assigns to specialized agents
3. Executes in parallel when possible
4. Aggregates results and verifies
5. Handles dependencies automatically
</details>

## 📄 License

MIT License - see LICENSE file for details

## 📚 Additional Documentation

- [SETTINGS.md](./SETTINGS.md) - 详细配置说明
- [ZHIPU_AI_MIGRATION.md](./ZHIPU_AI_MIGRATION.md) - 智谱 AI 迁移经验和最佳实践
- [CLAUDE.md](./CLAUDE.md) - 开发者文档

## 🙏 Acknowledgments

- Inspired by Claude Code, GitHub Copilot, and Cursor
- Built with love for the developer community
- Powered by Zhipu AI's GLM-5 (default) and OpenAI-compatible APIs

---

<div align="center">

**Built with ❤️ by the Newma (牛码) team**

Version 3.0.0 | Multi-Agent AI Development Assistant

</div>
