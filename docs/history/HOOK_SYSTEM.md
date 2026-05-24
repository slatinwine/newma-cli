# Newma (牛码) Hook System

## 概述

Newma (牛码) Hook 系统是一个插件生态系统，允许在 Newma (牛码) 的关键执行点插入自定义逻辑。

## 支持的 Hook 类型

### 1. 工具执行 Hooks
- `beforeToolExecution` - 工具执行前触发
- `afterToolExecution` - 工具执行后触发

### 2. AI 调用 Hooks
- `beforeAIRequest` - AI 请求发送前触发
- `afterAIResponse` - AI 响应接收后触发

### 3. 验证 Hooks
- `beforeVerification` - 验证阶段开始前触发
- `afterVerification` - 验证阶段结束后触发

### 4. 用户输入 Hooks
- `beforeInputProcessing` - 用户输入处理前触发
- `afterInputProcessing` - 用户输入处理后触发

## 配置

在 `settings.json` 中添加 hooks 配置：

```json
{
  "hooks": {
    "enabled": true,
    "directory": ".kode/hooks",
    "timeout": 5000,
    "verbose": true
  }
}
```

## 创建 Hook

1. 在 `.kode/hooks/<hookType>/` 目录下创建 TypeScript 或 JavaScript 文件
2. 导出默认函数作为 hook handler

示例：

```typescript
// .kode/hooks/beforeToolExecution/logger.ts
export default async function(context: any) {
  const { toolName, params } = context.data;
  console.log(`[HOOK] Executing: ${toolName}`);
}
```

## Hook Context

每个 hook 接收一个 context 对象：

```typescript
interface HookContext {
  type: HookType;
  data: any;  // Hook-specific data
  session: SessionManager;
  config: Config;
  timestamp: Date;
}
```

## 安全特性

- **超时保护**: Hook 执行超时自动终止
- **错误隔离**: Hook 失败不影响主流程
- **权限检查**: 可选的权限验证
- **类型安全**: TypeScript 全面支持

## 示例 Hooks

查看 `.kode/hooks/` 目录获取更多示例：
- `beforeToolExecution/logger.ts` - 工具执行日志
- `afterToolExecution/stats.ts` - 执行统计
- `beforeAIRequest/request-logger.ts` - AI 请求日志

## 性能影响

- 禁用时: 零性能开销
- 启用时: 每个hook增加约1-5ms延迟

## 最佳实践

1. **保持简单**: Hook 应该快速执行
2. **错误处理**: 使用 try-catch 包裹不稳定操作
3. **日志记录**: 使用 verbose 模式调试
4. **避免副作用**: 不要修改传入的数据（除非有明确需求）

## 故障排除

### Hooks 未执行
1. 检查 `settings.json` 中 `hooks.enabled` 是否为 `true`
2. 确认 hook 文件在正确的目录
3. 查看 hook 输出的错误信息

### Hook 执行超时
1. 增加 `hooks.timeout` 配置值
2. 优化 hook 代码性能
3. 使用异步操作避免阻塞

## 更多信息

参考 `CLAUDE.md` 中的 Hook 系统实现细节。
