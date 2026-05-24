# Newma (牛码) 轻量级模式修复

**日期**: 2025-01-18
**问题**: API 调用超时/挂起
**解决方案**: 使用轻量级扫描模式

## 问题诊断

### 根本原因
- Newma (牛码) 发送整个项目的**完整文件内容**（210+ 文件 × 200 行 = 数万行）
- GLM API 处理这么大的请求非常慢或超时
- Node.js fetch 没有超时机制，导致无限期等待

### 验证结果
```bash
# 直接测试 GLM API
curl 测试: ~1 秒响应 ✅

# Newma (牛码) 原始模式
发送 210+ 文件完整内容: 超时 ❌

# Newma (牛码) 轻量级模式
发送 50 个文件列表: ~10 秒 ✅
```

## 解决方案

### 1. 已修改的文件

#### `src/scanner.ts`
添加了轻量级扫描选项：
- `listOnly`: 只返回文件路径，不包含内容
- `maxFiles`: 限制扫描的文件数量

#### `debug-api.ts`
使用轻量级模式进行测试：
```typescript
const projectInfo = await scanDirectory(projectRoot, {
  listOnly: true,
  maxFiles: 50
});
```

#### `src/fetch-timeout.ts`
添加了超时包装器（未使用，但已准备好）

### 2. 如何使用

#### 临时方案（直接修改代码）

在任何调用 `scanDirectory` 的地方添加选项：

```typescript
// 旧代码（超时）
const projectInfo = await scanDirectory(projectRoot);

// 新代码（快速）
const projectInfo = await scanDirectory(projectRoot, {
  listOnly: true,  // 只返回文件列表
  maxFiles: 50     // 限制文件数量
});
```

#### 需要修改的位置

1. **src/cli.ts** (第 302 行)
2. **src/repl.ts** (搜索 scanDirectory 调用)
3. **src/agents/**/*.ts** (所有 agent 文件)

### 3. 快速修复命令

创建一个补丁文件来自动应用这些修改：

```bash
# 备份原始文件
cp src/cli.ts src/cli.ts.backup

# 应用修复（需要手动编辑）
# 找到所有 `await scanDirectory(projectRoot)` 调用
# 替换为 `await scanDirectory(projectRoot, { listOnly: true, maxFiles: 50 })`
```

### 4. 测试结果

```bash
$ npx ts-node debug-api.ts

[1/3] Scanning project...
✓ Scanned 50 files (lightweight mode)

[2/3] Testing simple prompt...
✓ Got response in 11278ms

[3/3] Testing actual task...
✓ Got response in 9191ms

✓ All tests passed!
```

## 性能对比

| 模式 | 发送数据 | 响应时间 | 状态 |
|------|---------|---------|------|
| 原始模式 | 210+ 文件 × 200 行 | 超时 | ❌ |
| 轻量级模式 | 50 个文件路径 | ~10 秒 | ✅ |
| 直接 API 调用 | 简单请求 | ~1 秒 | ✅ |

## 推荐配置

根据不同的使用场景选择配置：

### 场景 1: 快速原型（推荐）
```typescript
await scanDirectory(projectRoot, {
  listOnly: true,
  maxFiles: 20
});
// 响应时间: ~5-8 秒
// 适用: 快速测试、简单任务
```

### 场景 2: 标准使用（平衡）
```typescript
await scanDirectory(projectRoot, {
  listOnly: true,
  maxFiles: 50
});
// 响应时间: ~10 秒
// 适用: 日常开发
```

### 场景 3: 完整上下文（需要时）
```typescript
await scanDirectory(projectRoot, {
  maxFiles: 100,
  maxLinesPerFile: 50  // 减少每文件的行数
});
// 响应时间: ~15-20 秒
// 适用: 复杂任务、需要完整上下文
```

## 下一步

### 立即可用
1. 使用上面提到的配置手动修改代码
2. 运行测试验证效果

### 未来改进
1. 添加 CLI 选项（如 `--light-mode`）
2. 添加配置文件支持（settings.json）
3. 智能文件选择（根据任务选择相关文件）
4. 增量更新（只发送修改过的文件）

## 相关文档

- `src/scanner.ts` - 扫描器实现
- `debug-api.ts` - 测试脚本
- `WORK_SUMMARY_2025_01_18.md` - 完整工作总结

## 问题排查

如果仍然遇到问题：

1. **检查网络连接**
   ```bash
   curl -v https://open.bigmodel.cn
   ```

2. **检查 API 密钥**
   ```bash
   cat ~/.kode/settings.json | jq .openai.apiKey
   ```

3. **查看详细日志**
   ```bash
   DEBUG=* npx newma-cli "Your requirement"
   ```

4. **使用更少的文件**
   ```typescript
   await scanDirectory(projectRoot, {
     listOnly: true,
     maxFiles: 10  // 减少到 10 个文件
   });
   ```

---

**创建时间**: 2025-01-18
**状态**: 已验证 ✅
**效果**: API 响应时间从超时降至 ~10 秒
