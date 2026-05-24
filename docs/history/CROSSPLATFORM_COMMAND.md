# Cross-Platform Command Tool

## Overview

The command tool now supports **Windows (cmd/PowerShell)**, **Linux**, and **macOS** with automatic shell detection and platform-specific safety checks.

## Features

### ✅ Automatic Platform Detection

- **Windows**: Defaults to PowerShell (can switch to cmd)
- **Linux/macOS**: Uses sh/bash

### ✅ Platform-Specific Safety

Dangerous commands are detected for each platform:

**Unix (Linux/macOS):**
- `rm -rf`, `rm -r /`, `sudo`, `mkfs`, `fdisk`, etc.

**Windows CMD:**
- `del /s /q`, `rmdir /s /q`, `format`, `diskpart`, etc.

**Windows PowerShell:**
- `Remove-Item -Recurse -Force`, `Format-Volume`, `Set-ExecutionPolicy`, etc.

### ✅ Safe Commands (Auto-Approvable)

Common development tools are whitelisted:
- npm, yarn, pnpm, git, node
- tsc, eslint, prettier, jest, vitest, pytest

## Usage

### Basic Usage (Auto Shell Detection)

```typescript
// Automatically uses the appropriate shell for your platform
await toolExecutor.executeToolCall({
  tool: 'command',
  parameters: {
    command: 'npm install',
  },
  id: '1',
});
```

### Windows: Explicit Shell Selection

```typescript
// Use CMD explicitly
await toolExecutor.executeToolCall({
  tool: 'command',
  parameters: {
    command: 'dir',
    shell: 'cmd',
  },
  id: '1',
});

// Use PowerShell explicitly
await toolExecutor.executeToolCall({
  tool: 'command',
  parameters: {
    command: 'Get-ChildItem',
    shell: 'powershell',
  },
  id: '1',
});

// Auto (default: PowerShell preferred)
await toolExecutor.executeToolCall({
  tool: 'command',
  parameters: {
    command: 'Get-Process',
    shell: 'auto',
  },
  id: '1',
});
```

### Working Directory

```typescript
await toolExecutor.executeToolCall({
  tool: 'command',
  parameters: {
    command: 'npm test',
    cwd: './subdirectory',  // Relative to project root
  },
  id: '1',
});
```

## API

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `command` | string | ✅ | Shell command to execute |
| `cwd` | string | ❌ | Working directory (default: project root) |
| `shell` | enum | ❌ | Shell type: `auto`, `cmd`, `powershell` (default: `auto`) |

### Response

```typescript
{
  success: boolean,
  output: string,  // Command output
  error?: string,  // Error message if failed
  metadata: {
    command: string,
    duration: number,  // Execution time in ms
    cwd: string,
    shell: string,  // Shell that was used
    platform: string,  // Detected platform
  }
}
```

## Safety Functions

### `isSafeCommand(command, shell?)`

Check if a command is safe (auto-approvable).

```typescript
import { isSafeCommand } from './src/tools/builtin/command';

isSafeCommand('npm install');  // true
isSafeCommand('rm -rf /');     // false
isSafeCommand('Remove-Item -Path C:\\temp', 'powershell');  // false
```

### `getCommandRisk(command, shell?)`

Get the risk level of a command.

```typescript
import { getCommandRisk } from './src/tools/builtin/command';

getCommandRisk('npm test');  // 'low'
getCommandRisk('cat file.txt');  // 'medium'
getCommandRisk('rm -rf /tmp');  // 'high'
```

## Examples

### Example 1: Running Tests (Cross-Platform)

```typescript
await toolExecutor.executeToolCall({
  tool: 'command',
  parameters: {
    command: 'npm test',
  },
  id: '1',
});

// Windows (PowerShell): npm test
// Linux/macOS (sh): npm test
```

### Example 2: Platform-Specific Commands

```typescript
// Unix-style command
await toolExecutor.executeToolCall({
  tool: 'command',
  parameters: {
    command: 'ls -la',
  },
  id: '1',
});

// Windows PowerShell equivalent
await toolExecutor.executeToolCall({
  tool: 'command',
  parameters: {
    command: 'Get-ChildItem -Force',
    shell: 'powershell',
  },
  id: '2',
});
```

### Example 3: Working Directory

```typescript
await toolExecutor.executeToolCall({
  tool: 'command',
  parameters: {
    command: 'npm run build',
    cwd: './frontend',
  },
  id: '1',
});
```

## Testing

Run the cross-platform compatibility tests:

```bash
npx ts-node test-command-crossplatform.ts
```

Expected output:
```
🔍 Testing Command Tool Cross-Platform Compatibility
📍 Current Platform: darwin

📋 Running Tests...

Test: Safe npm command
  Command: npm install
  Validation: ✅
  Safe: Yes (Expected: Yes) ✅
  Risk: low (Expected: low) ✅
  Status: ✅ PASSED

...

📊 Test Summary:
  Total: 5
  Passed: 5 ✅
  Failed: 0 ❌
  Success Rate: 100.0%
```

## Implementation Details

### Platform Detection

```typescript
import { platform } from 'os';

const currentPlatform = platform(); // 'win32', 'darwin', 'linux'
```

### Shell Configuration

Each platform has a shell configuration:

```typescript
interface ShellConfig {
  shell: string;              // e.g., 'sh', 'cmd.exe', 'powershell.exe'
  args: string[];             // Command arguments template
  dangerousCommands: string[]; // Platform-specific dangerous patterns
  safeCommands: string[];      // Platform-specific safe patterns
}
```

### Command Execution

```typescript
// Build arguments
const args = shellConfig.args.map(arg =>
  arg.replace('{command}', command)
);

// Execute
execFileSync(shellConfig.shell, args, {
  cwd: workingDir,
  stdio: 'pipe',
  encoding: 'utf-8',
});
```

## Design Decisions

1. **PowerShell over CMD**: PowerShell is more powerful and is the future of Windows automation
2. **Explicit shell parameter**: Users can override auto-detection if needed
3. **Platform-specific safety**: Same command can be safe on one platform but dangerous on another
4. **No command translation**: We don't translate commands between platforms; users write platform-specific commands

## Future Improvements

- [ ] Add `bash` shell option for Windows (Git Bash, WSL)
- [ ] Command translation layer (e.g., `ls` → `dir`)
- [ ] Environment variable management
- [ ] Shell session persistence
- [ ] Interactive command support

## Related Files

- `src/tools/builtin/command.ts` - Command tool implementation
- `test-command-crossplatform.ts` - Cross-platform tests
- `src/tools/types.ts` - Tool system type definitions
