# MCP 集成指南

**版本**: 1.0.0
**日期**: 2026-01-25
**状态**: ✅ 生产就绪

## 📋 概述

Newma (牛码) 现在完全支持 MCP (Model Context Protocol) 协议，允许你：

1. **作为 MCP 客户端** - 调用外部 MCP 服务器提供的工具
2. **作为 MCP 服务器** - 暴露 Newma (牛码) 的能力给其他应用

MCP 是 AI 代理的行业标准协议，由 Anthropic 开发，支持工具、资源和提示的标准化交互。

## 🎯 核心功能

### ✅ 已实现

- ✅ MCP 客户端 (stdio 传输)
- ✅ MCP 服务器 (stdio 传输)
- ✅ 工具发现和自动注册
- ✅ 工具调用适配器
- ✅ 配置文件支持 (settings.json)
- ✅ CLI 命令 (`mcp:list`, `mcp:test`, `mcp-server`)
- ✅ 与 Newma (牛码) 执行器集成

### 🚧 未来扩展

- 🚧 WebSocket 传输支持
- 🚧 资源 (Resources) 支持
- 🚧 提示 (Prompts) 支持
- 🚧 Codex 沙箱状态能力 (`codex/sandbox-state`)

## 📦 安装依赖

MCP 功能已集成到 Newma (牛码) 中，只需安装 `@modelcontextprotocol/sdk`：

```bash
npm install
```

依赖已在 `package.json` 中配置：

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4"
  }
}
```

## 🔧 配置

### 1. 启用 MCP

在项目根目录的 `settings.json` 中添加 MCP 配置：

```json
{
  "mcp": {
    "enabled": true,
    "servers": {
      "filesystem": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"]
      },
      "git": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-git", "--repository", "."]
      }
    }
  }
}
```

### 2. 配置选项

#### 服务器配置 (MCPServerConfig)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `command` | string | ✅ | 启动服务器的命令 |
| `args` | string[] | ✅ | 命令参数 |
| `env` | Record<string, string> | ❌ | 环境变量 |
| `disabled` | boolean | ❌ | 是否禁用此服务器 |
| `transport` | 'stdio' \| 'websocket' | ❌ | 传输方式 (默认: stdio) |
| `url` | string | ❌ | WebSocket URL (transport=websocket 时必填) |

## 💻 使用指南

### 作为 MCP 客户端

#### 方法 1: 在 REPL 中自动使用

启动交互式 REPL，MCP 工具会自动加载：

```bash
npx newma-cli -i
```

你会看到：

```
[MCP] Initializing MCP clients...
[MCP] ✅ Loaded 15 tool(s) from 2 server(s)
[MCP]    filesystem: 8 tool(s)
[MCP]    git: 7 tool(s)
```

现在你可以直接使用 MCP 工具：

```
[newma] ❯ /plan 使用 filesystem 服务器读取 package.json

# AI 会自动发现并使用 mcp.filesystem.read_file 工具
```

#### 方法 2: 列出可用的 MCP 服务器

```bash
npx newma-cli mcp:list
```

输出：

```
📋 MCP Servers (2)

filesystem [enabled]
  Command: npx
  Args: -y @modelcontextprotocol/server-filesystem /allowed/path

git [enabled]
  Command: npx
  Args: -y @modelcontextprotocol/server-git --repository .
```

#### 方法 3: 测试 MCP 服务器连接

```bash
npx newma-cli mcp:test filesystem
```

输出：

```
🔍 Testing MCP server: filesystem

Fetching tools...
✓ Connected! Found 8 tool(s)

Available tools:
  - read_file: Read a file from the filesystem
  - write_file: Write to a file
  - create_directory: Create a directory
  - list_directory: List directory contents
  - move_file: Move a file
  - search_files: Search for files
  - get_file_info: Get file metadata
  - list_allowed_directories: List allowed directories

✓ Test successful
```

### 作为 MCP 服务器

运行 Newma (牛码) 作为 MCP 服务器，暴露其工具给其他应用：

```bash
npx newma-cli mcp-server
```

输出：

```
🔌 Starting Newma (牛码) MCP Server...

Server running in stdio mode
Waiting for JSON-RPC requests on stdin/stdout...
```

现在其他应用可以通过 stdio 与 Newma (牛码) 通信：

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"my-app","version":"1.0.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
```

## 🛠️ 常用 MCP 服务器

### 官方 MCP 服务器

#### 1. Filesystem Server

文件系统操作服务器：

```json
{
  "mcp": {
    "servers": {
      "filesystem": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/mac/projects"]
      }
    }
  }
}
```

**提供工具**: `read_file`, `write_file`, `create_directory`, `list_directory`, `move_file`, `search_files`, `get_file_info`, `list_allowed_directories`

#### 2. Git Server

Git 仓库操作服务器：

```json
{
  "mcp": {
    "servers": {
      "git": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-git", "--repository", "."]
      }
    }
  }
}
```

**提供工具**: `git_clone`, `git_commit`, `git_diff`, `git_log`, `git_status`, `git_branch`, `git_show_file`

### 社区 MCP 服务器

更多服务器: https://github.com/modelcontextprotocol/servers

## 🔌 集成到代码

### 在执行器中初始化 MCP

```typescript
import { ToolExecutor } from './executor-v2';
import { getMCPConfig } from './config';

// 创建执行器
const executor = new ToolExecutor(tracker, rollbackManager, config);

// 初始化 MCP 客户端
const { enabled, servers } = getMCPConfig();
if (enabled) {
  await executor.initializeMCP(servers);
}

// MCP 工具现在可以使用了
const registry = executor.getRegistry();
const allTools = registry.list();
console.log(`Available tools: ${allTools.length}`);
```

### 访问 MCP 客户端管理器

```typescript
const mcpManager = executor.getMCPManager();

// 获取特定客户端
const client = mcpManager.getClient('filesystem');
if (client) {
  const tools = await client.listTools();
  console.log(`Tools: ${tools.map(t => t.name).join(', ')}`);
}
```

## 🎨 实现细节

### 架构

```
┌─────────────────────────────────────────────────────┐
│                    Newma (牛码) CLI                         │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐        ┌──────────────┐         │
│  │   MCP        │        │   MCP        │         │
│  │  Client      │        │  Server      │         │
│  │              │        │              │         │
│  └──────┬───────┘        └──────┬───────┘         │
│         │                       │                  │
│         │                ┌──────▼───────┐          │
│         │                │  Tool        │          │
│         │                │  Adapter     │          │
│         │                └──────┬───────┘          │
│         │                       │                  │
│         └───────────┬───────────┘                  │
│                     │                              │
│            ┌────────▼────────┐                    │
│            │ Tool Executor   │                    │
│            └─────────────────┘                    │
│                     │                              │
└─────────────────────┼──────────────────────────────┘
                      │
                ┌─────▼─────┐
                │  MCP      │
                │ Servers   │
                └───────────┘
```

### 核心组件

| 文件 | 职责 |
|------|------|
| `src/mcp/types.ts` | MCP 协议类型定义 |
| `src/mcp/transport.ts` | 传输层实现 (stdio/WebSocket) |
| `src/mcp/client.ts` | MCP 客户端实现 |
| `src/mcp/server.ts` | MCP 服务器实现 |
| `src/mcp/tools/mcp-tool-adapter.ts` | MCP 工具到 Newma (牛码) 工具的适配器 |
| `src/config.ts` | MCP 配置加载 |
| `src/cli.ts` | MCP 命令行接口 |
| `src/executor-v2.ts` | MCP 集成到执行器 |

### 工具命名规范

MCP 工具在 Newma (牛码) 中使用以下命名规范：

```
mcp.<server-name>.<tool-name>
```

例如：

- `mcp.filesystem.read_file`
- `mcp.git.git_status`

## 🐛 调试

### 启用详细日志

设置环境变量：

```bash
DEBUG=mcp:* npx newma-cli -i
```

### 常见问题

#### 1. MCP 服务器未连接

**错误**:
```
[MCP] ❌ Failed to connect to filesystem: spawn npx ENOENT
```

**解决**: 确保 `npx` 在 PATH 中，或使用绝对路径：

```json
{
  "command": "/usr/local/bin/node",
  "args": ["/usr/local/lib/node_modules/npm/bin/npx-cli.js", "-y", "..."]
}
```

#### 2. 工具未显示

**原因**: MCP 未在 settings.json 中启用

**解决**: 添加 `"mcp": { "enabled": true }`

#### 3. 权限错误

**错误**:
```
Error: Permission denied: read_files
```

**解决**: 检查权限级别设置，使用 `--permission-level standard`

## 📊 性能考虑

### 启动时间

启用 MCP 会增加启动时间：

- 无 MCP: ~0.5s
- 1 个服务器: ~1s
- 3 个服务器: ~2-3s

### 优化建议

1. **只启用需要的服务器** - 禁用不需要的 MCP 服务器
2. **使用本地服务器** - 避免网络延迟
3. **缓存工具列表** - 工具列表在启动时加载并缓存

## 🔒 安全性

### 权限控制

MCP 工具使用默认权限级别：`[Permission.READ_FILES]`

你可以在适配器配置中自定义：

```typescript
const adaptedTools = adaptAllMCPTools(
  allTools,
  clients,
  {
    permissionLevel: [
      Permission.READ_FILES,
      Permission.WRITE_FILES,
      Permission.RUN_COMMANDS
    ]
  }
);
```

### 沙箱隔离

**注意**: 当前实现不包含沙箱隔离。MCP 服务器可以访问：

- 文件系统（根据服务器配置）
- 网络（如果服务器需要）
- 系统命令

**建议**: 只运行可信的 MCP 服务器

## 📚 参考资料

### MCP 规范

- [MCP 官方文档](https://modelcontextprotocol.io/)
- [MCP GitHub](https://github.com/modelcontextprotocol)
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)

### 示例配置

完整示例配置文件: `examples/settings.json`

### 相关文档

- `src/mcp/types.ts` - 类型定义和内联文档
- `CLAUDE.md` - 项目架构和设计决策

## 🚀 未来计划

1. **WebSocket 传输** - 支持远程 MCP 服务器
2. **资源支持** - 实现完整的资源协议
3. **提示支持** - 实现完整的提示协议
4. **Codex 兼容** - 实现 `codex/sandbox-state` 能力
5. **MCP 市场** - 自动发现和安装社区服务器
6. **沙箱隔离** - 使用 macOS Seatbelt 或 Linux Landlock

## 🤝 贡献

欢迎贡献！查看：

- 源代码: `src/mcp/`
- 测试: `test-mcp-integration.ts` (TODO)
- 问题反馈: GitHub Issues

---

**文档版本**: 1.0.0
**最后更新**: 2026-01-25
**维护者**: Newma (牛码) Development Team
