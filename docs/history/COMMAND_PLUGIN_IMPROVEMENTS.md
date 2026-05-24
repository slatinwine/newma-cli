# Command Plugin - Cross-Platform Improvements

## 改进概述

为 `src/tools/builtin/command.ts` 添加了完整的 **Windows CMD/PowerShell** 和 **Unix (Linux/macOS)** 跨平台兼容支持。

## 主要变更

### 1. 平台检测
- 自动检测运行平台：`win32`、`darwin`、`linux`
- 根据平台选择合适的 shell

### 2. Shell 配置系统

为不同平台定义了专门的 shell 配置：

**Unix/Linux/macOS:**
```typescript
{
  shell: 'sh',
  args: ['-c', '{command}']
}
```

**Windows CMD:**
```typescript
{
  shell: 'cmd.exe',
  args: ['/c', '{command}']
}
```

**Windows PowerShell:**
```typescript
{
  shell: 'powershell.exe',
  args: ['-Command', '{command}']
}
```

### 3. 平台特定的安全检查

**危险命令列表：**

- **Unix**: `rm -rf`, `sudo`, `mkfs`, `fdisk`, `dd if=/dev/`, `> /dev/`, `curl`, `wget`
- **Windows CMD**: `del /s /q`, `rmdir /s /q`, `format`, `diskpart`, `icacls`, `> NUL`, `curl`, `wget`
- **Windows PowerShell**: `Remove-Item -Recurse -Force`, `Format-Volume`, `Set-ExecutionPolicy`, `Invoke-Expression`, `curl`, `wget`

**安全命令列表（自动批准）：**
- npm, yarn, pnpm, git, node, tsc, eslint, prettier, jest, vitest, pytest

### 4. 新增参数

```typescript
{
  name: 'shell',
  type: 'enum',
  description: 'Shell type (Windows only: cmd, powershell, or auto)',
  required: false,
  default: 'auto',
  values: ['auto', 'cmd', 'powershell'],
}
```

## 使用示例

### 自动模式（推荐）
```typescript
// 自动检测平台并使用合适的 shell
await toolExecutor.executeToolCall({
  tool: 'command',
  parameters: {
    command: 'npm install',
  },
  id: '1',
});
```

### Windows 手动选择
```typescript
// 使用 CMD
await toolExecutor.executeToolCall({
  tool: 'command',
  parameters: {
    command: 'dir',
    shell: 'cmd',
  },
  id: '1',
});

// 使用 PowerShell
await toolExecutor.executeToolCall({
  tool: 'command',
  parameters: {
    command: 'Get-ChildItem',
    shell: 'powershell',
  },
  id: '1',
});
```

## 测试

### 运行测试
```bash
npx ts-node test-command-crossplatform.ts
```

### 测试结果
```
📊 Test Summary:
  Total: 5
  Passed: 5 ✅
  Failed: 0 ❌
  Success Rate: 100.0%
```

### 运行示例
```bash
npx ts-node examples/command-crossplatform-usage.ts
```

## 文件变更

### 修改的文件
- `src/tools/builtin/command.ts` - 添加跨平台支持

### 新增的文件
- `test-command-crossplatform.ts` - 跨平台兼容性测试
- `examples/command-crossplatform-usage.ts` - 使用示例
- `CROSSPLATFORM_COMMAND.md` - 完整文档

## API 变更

### `isSafeCommand(command, shell?)`
```typescript
// 之前
isSafeCommand('npm install')

// 现在（可选 shell 参数）
isSafeCommand('npm install', 'auto')
isSafeCommand('Remove-Item -Path', 'powershell')
```

### `getCommandRisk(command, shell?)`
```typescript
// 之前
getCommandRisk('npm test')

// 现在（可选 shell 参数）
getCommandRisk('npm test', 'auto')
getCommandRisk('Remove-Item -Recurse', 'powershell')
```

## 兼容性

✅ **向后兼容** - 所有现有代码无需修改即可继续工作
- 默认 `shell: 'auto'` 自动选择合适的 shell
- 现有调用会自动使用平台适当的 shell

## 设计决策

1. **PowerShell 优先于 CMD** - PowerShell 更强大，是 Windows 自动化的未来
2. **显式 shell 参数** - 用户可以覆盖自动检测（如果需要）
3. **平台特定安全** - 同一命令在不同平台可能有不同的风险等级
4. **不做命令翻译** - 不将命令在不同平台间转换；用户编写特定平台的命令

## 未来改进

- [ ] 添加 `bash` 选项（Git Bash, WSL）
- [ ] 命令转换层（例如：`ls` → `dir`）
- [ ] 环境变量管理
- [ ] Shell 会话持久化
- [ ] 交互式命令支持

## 相关文档

- `CROSSPLATFORM_COMMAND.md` - 详细使用文档
- `test-command-crossplatform.ts` - 测试用例
- `examples/command-crossplatform-usage.ts` - 使用示例

## 总结

✅ 添加了完整的跨平台支持
✅ 所有测试通过（100% 成功率）
✅ 向后兼容，无需修改现有代码
✅ 提供了详细的文档和示例
