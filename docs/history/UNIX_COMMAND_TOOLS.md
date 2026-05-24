# Unix Command Tools

## Overview

Newma (牛码) 现在包含了一组常用的 Unix 命令行操作作为独立的工具。这些工具提供：

- ✅ **更明确的工具语义** - 每个工具专注于特定任务
- ✅ **参数验证** - 内置参数类型和安全检查
- ✅ **更好的 AI 集成** - AI 可以更精确地选择合适的工具
- ✅ **安全性** - 自动路径遍历检查和权限控制

## Available Tools

### 1. `list_files` - List directory contents

Lists files and directories (equivalent to `ls`).

**Parameters:**
- `path` (string, optional): Directory path to list (default: ".")
- `showHidden` (boolean, optional): Include hidden files (default: false)
- `longFormat` (boolean, optional): Use long format with permissions (default: false)
- `recursive` (boolean, optional): List subdirectories recursively (default: false)

**Example usage:**
```json
{
  "tool": "list_files",
  "parameters": {
    "path": "src",
    "showHidden": false,
    "longFormat": true,
    "recursive": false
  }
}
```

**Permissions:** `READ_FILES`

---

### 2. `read_file` - Read file contents

Reads and displays file contents (equivalent to `cat`).

**Parameters:**
- `path` (string, required): File path to read
- `lineCount` (number, optional): Number of lines to read from beginning

**Example usage:**
```json
{
  "tool": "read_file",
  "parameters": {
    "path": "README.md",
    "lineCount": 50
  }
}
```

**Security:** Prevents path traversal attacks (`..` not allowed)

**Permissions:** `READ_FILES`

---

### 3. `search_files` - Search in files

Searches for text patterns in files (equivalent to `grep`).

**Parameters:**
- `pattern` (string, required): Search pattern (supports regex)
- `path` (string, optional): Directory/file to search in (default: ".")
- `ignoreCase` (boolean, optional): Case-insensitive search (default: false)
- `recursive` (boolean, optional): Search recursively (default: true)
- `filePattern` (string, optional): Filter files (e.g., "*.ts")
- `contextLines` (number, optional): Context lines around matches (default: 2)

**Example usage:**
```json
{
  "tool": "search_files",
  "parameters": {
    "pattern": "TODO",
    "path": "src",
    "ignoreCase": true,
    "filePattern": "*.ts",
    "contextLines": 3
  }
}
```

**Permissions:** `READ_FILES`

---

### 4. `find_files` - Find files by name/type

Searches for files by name, type, or properties (equivalent to `find`).

**Parameters:**
- `path` (string, optional): Directory to search in (default: ".")
- `name` (string, optional): File name pattern (e.g., "*.ts", "test-*")
- `type` (enum, optional): File type - "f" (file), "d" (directory), "l" (link)
- `maxDepth` (number, optional): Maximum directory depth

**Example usage:**
```json
{
  "tool": "find_files",
  "parameters": {
    "path": "src",
    "name": "*.test.ts",
    "type": "f",
    "maxDepth": 3
  }
}
```

**Permissions:** `READ_FILES`

---

### 5. `count_lines` - Count lines in files

Counts lines in one or more files (equivalent to `wc -l`).

**Parameters:**
- `paths` (array, required): File paths to count

**Example usage:**
```json
{
  "tool": "count_lines",
  "parameters": {
    "paths": ["README.md", "src/ai.ts", "src/repl.ts"]
  }
}
```

**Permissions:** `READ_FILES`

---

### 6. `disk_usage` - Disk usage analysis

Estimates file and directory space usage (equivalent to `du`).

**Parameters:**
- `path` (string, optional): Path to analyze (default: ".")
- `maxDepth` (number, optional): Directory depth to display (default: 1)
- `humanReadable` (boolean, optional): Show in KB/MB/GB (default: true)

**Example usage:**
```json
{
  "tool": "disk_usage",
  "parameters": {
    "path": "node_modules",
    "maxDepth": 2,
    "humanReadable": true
  }
}
```

**Permissions:** `READ_FILES`

---

## Tool Registration

Tools are automatically registered in `src/executor-v2.ts`:

```typescript
import { unixCommandTools } from './tools/builtin/unix-commands';

// Register all Unix command tools
unixCommandTools.forEach(tool => this.registry.register(tool));
```

## Integration with AI

When AI makes decisions, it now has access to these specific tools:

1. **Better tool selection**: AI can choose `list_files` instead of generic `command`
2. **Structured parameters**: AI knows exactly what parameters each tool accepts
3. **Type safety**: Parameter validation happens before execution
4. **API compatibility**: Tool names are included in OpenAI `tools` field

## Example AI Request

When you run `/do list all TypeScript files in src`, the AI can now generate:

```json
{
  "type": "task",
  "todo": ["List TypeScript files"],
  "actions": [
    {
      "type": "tool_call",
      "tool": "list_files",
      "parameters": {
        "path": "src",
        "recursive": true
      }
    }
  ]
}
```

Instead of the old generic:

```json
{
  "type": "task",
  "todo": ["List TypeScript files"],
  "actions": [
    {
      "type": "run",
      "command": "find src -name '*.ts'"
    }
  ]
}
```

## Benefits

| Aspect | Old (generic `command`) | New (specific tools) |
|--------|------------------------|---------------------|
| **Clarity** | Unclear what command does | Self-documenting tool names |
| **Safety** | Manual command validation | Built-in parameter validation |
| **AI Understanding** | AI must construct commands | AI selects pre-defined tools |
| **Error Messages** | Generic command failed | Specific parameter validation errors |
| **Permission Control** | Coarse-grained (all commands) | Fine-grained per tool |

## Future Enhancements

Possible additions:
- `git_status` - Git repository status
- `git_log` - Git commit history
- `npm_install` - Install npm packages
- `docker_ps` - List Docker containers
- `run_tests` - Run project tests
- `lint_code` - Run ESLint/Prettier

## Adding New Tools

To add a new Unix command tool:

1. Create tool in `src/tools/builtin/unix-commands.ts`:

```typescript
export const myTool: Tool = {
  name: 'my_tool',
  description: 'Does something useful',
  category: ToolCategory.COMMAND,
  permissions: [Permission.READ_FILES],
  parameters: [
    {
      name: 'param1',
      type: 'string',
      description: 'First parameter',
      required: true,
    },
  ],
  async handler(params, context) {
    // Implementation
    return { success: true, output: '...' };
  },
};
```

2. Export it in `unixCommandTools` array:

```typescript
export const unixCommandTools = [
  listFilesTool,
  readFileTool,
  // ...
  myTool,  // Add here
];
```

3. Rebuild: `npm run build`

## Migration Notes

### For Users

No changes needed! Tools are automatically available. AI will use them when appropriate.

### For Developers

If you were using generic `command` tool for common operations:

**Before:**
```typescript
await toolExecutor.executeToolCall({
  tool: 'command',
  parameters: { command: 'ls -la src/' }
});
```

**After:**
```typescript
await toolExecutor.executeToolCall({
  tool: 'list_files',
  parameters: {
    path: 'src/',
    longFormat: true,
    showHidden: true
  }
});
```

## Testing

Test the new tools:

```bash
# Start interactive mode
npx newma-cli -i

# Try listing files
[newma] ❯ /do list all TypeScript files

# Try searching
[newma] ❯ /do search for "TODO" comments in src directory

# Try reading
[newma] ❯ /do read first 20 lines of README.md
```

## Related Files

- `src/tools/builtin/unix-commands.ts` - Tool implementations
- `src/tools/registry.ts` - Tool registry
- `src/executor-v2.ts` - Tool registration
- `src/ai.ts` - Integration with OpenAI API

---

**Version**: 3.1.0+
**Status**: ✅ Implemented and tested
