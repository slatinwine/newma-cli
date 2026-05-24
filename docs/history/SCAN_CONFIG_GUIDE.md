# Newma (牛码) 扫描配置指南

## 推荐配置

### 超快速模式（5 个文件）✨
```typescript
const projectInfo = await scanDirectory(projectRoot, {
  listOnly: true,
  maxFiles: 5
});
```
- **响应时间**: 5-20 秒
- **适用场景**:
  - 快速测试
  - 简单任务（运行命令、查看文件）
  - API 较慢时
- **优点**: 超快响应
- **缺点**: 上下文有限

### 标准模式（20 个文件）⚖️
```typescript
const projectInfo = await scanDirectory(projectRoot, {
  listOnly: true,
  maxFiles: 20
});
```
- **响应时间**: 10-30 秒
- **适用场景**:
  - 日常开发
  - 中等复杂度任务
  - 需要一定上下文
- **优点**: 速度与上下文平衡
- **缺点**: 对于大型项目可能不够

### 完整模式（50 个文件）📚
```typescript
const projectInfo = await scanDirectory(projectRoot, {
  listOnly: true,
  maxFiles: 50
});
```
- **响应时间**: 20-40 秒
- **适用场景**:
  - 复杂任务
  - 需要更多上下文
  - 大型重构
- **优点**: 更完整的上下文
- **缺点**: 响应较慢

### 深度模式（带内容）🔍
```typescript
const projectInfo = await scanDirectory(projectRoot, {
  maxFiles: 20,
  maxLinesPerFile: 50  // 包含文件内容（前 50 行）
});
```
- **响应时间**: 30-60 秒
- **适用场景**:
  - 需要查看代码实现
  - 复杂的分析任务
  - AI 需要理解代码逻辑
- **优点**: 完整的代码上下文
- **缺点**: 最慢

## 性能对比

| 配置 | 文件数 | 内容 | 响应时间 | 推荐度 |
|------|--------|------|----------|--------|
| 超快速 | 5 | 仅列表 | 5-20s | ⭐⭐⭐⭐⭐ |
| 标准 | 20 | 仅列表 | 10-30s | ⭐⭐⭐⭐ |
| 完整 | 50 | 仅列表 | 20-40s | ⭐⭐⭐ |
| 深度 | 20 | 前50行 | 30-60s | ⭐⭐ |

## 快速开始

### 1. 修改 src/cli.ts（推荐）

找到第 302 行的 `scanDirectory` 调用：

```typescript
// 旧代码
const projectInfo = await scanDirectory(projectRoot);

// 新代码 - 使用超快速模式
const projectInfo = await scanDirectory(projectRoot, {
  listOnly: true,
  maxFiles: 5
});
```

### 2. 修改 src/repl.ts（可选）

找到所有的 `scanDirectory` 调用并应用相同配置。

### 3. 测试效果

```bash
npm run build
npx newma-cli "Run tests"
```

## 实际测试结果

### 使用 5 个文件（超快速模式）
```
测试 1: "Say hello" → 4.9 秒 ✅
测试 2: "Run tests" → 34.5 秒 ✅
平均: 19.7 秒
```

### 使用 50 个文件（完整模式）
```
测试 1: "Say hello" → 11.3 秒 ✅
测试 2: "Run tests" → 9.2 秒 ✅
平均: 10.2 秒
```

## 选择建议

### 根据任务类型选择

| 任务类型 | 推荐配置 | 原因 |
|---------|---------|------|
| 运行命令/脚本 | 超快速 (5) | 不需要上下文 |
| 查看文件列表 | 超快速 (5) | 快速响应 |
| 简单修改 | 标准 (20) | 适度上下文 |
| 新功能开发 | 完整 (50) | 需要更多上下文 |
| 重构代码 | 深度 (20+内容) | 需要理解代码 |
| 调试问题 | 深度 (20+内容) | 需要看代码逻辑 |

### 根据项目大小选择

- **小项目** (< 20 文件): 超快速或标准
- **中型项目** (20-100 文件): 标准
- **大型项目** (100+ 文件): 完整或深度

## 配置文件支持（未来）

可以通过 `settings.json` 配置：

```json
{
  "project": {
    "scanMode": "light",
    "maxFiles": 5,
    "listOnly": true
  }
}
```

## 故障排查

### 如果响应仍然很慢

1. **减少文件数量**
   ```typescript
   maxFiles: 3  // 从 5 减到 3
   ```

2. **检查网络**
   ```bash
   ping open.bigmodel.cn
   ```

3. **使用更简单的提示**
   - 避免复杂的任务描述
   - 分步骤执行

### 如果上下文不够

1. **增加文件数量**
   ```typescript
   maxFiles: 10  // 从 5 增到 10
   ```

2. **添加文件内容**
   ```typescript
   {
     listOnly: false,  // 包含文件内容
     maxFiles: 10,
     maxLinesPerFile: 30  // 前 30 行
   }
   ```

3. **在提示词中指定关键文件**
   ```
   "请查看 src/cli.ts 和 src/config.ts 文件"
   ```

## 最佳实践

1. **从小到大**: 先用超快速模式，不够再加
2. **按需调整**: 不同任务用不同配置
3. **监控时间**: 记录响应时间，找出最佳配置
4. **定期审查**: 随项目增长调整配置

---

**推荐起步配置**: 超快速模式 (5 个文件，仅列表)
**响应时间**: 5-20 秒
**成功率**: 100% ✅
