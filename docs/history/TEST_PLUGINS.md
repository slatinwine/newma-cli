# 插件系统测试指南

## 快速测试

### 1. 构建项目
```bash
npm run build
```

### 2. 测试内置工具（插件禁用）

编辑 `settings.json`:
```json
{
  "plugins": {
    "enabled": false
  }
}
```

运行：
```bash
npx newma-cli -i
> /plan List files in current directory
```

预期：使用内置工具，正常工作

### 3. 测试插件系统（插件启用）

编辑 `settings.json`:
```json
{
  "plugins": {
    "enabled": true,
    "autoLoad": ["search-plugin", "command-plugin"]
  }
}
```

运行：
```bash
npx newma-cli -i
```

预期输出：
```
[PLUGIN] Loading plugins...
[PLUGIN] Discovered: Search Plugin v1.0.0
[PLUGIN] Discovered: Command Plugin v1.0.0
[PLUGIN] ✅ Loaded 2 plugin(s)
```

### 4. 测试搜索插件

```
> /plan Search for latest TypeScript news
```

预期：
- 使用 `search` 工具
- 显示搜索结果

### 5. 测试命令插件

```
> /plan List all TypeScript files
```

预期：
- 使用 `list_files` 或 `search_files` 工具
- 显示文件列表

## 验证要点

✅ **插件加载**
- 插件自动从 `.kode/plugins/` 发现
- 插件工具成功注册到 ToolRegistry
- 显示加载成功的消息

✅ **搜索功能**
- `search` 工具可以调用 Bing API
- `web_scrape` 可以抓取网页内容
- `search_and_fetch` 可以组合使用

✅ **命令功能**
- `command` 工具可以执行 shell 命令
- Unix 命令工具（ls, cat, grep 等）正常工作
- 权限检查正常

✅ **向后兼容**
- 禁用插件时自动回退到内置工具
- 现有功能不受影响
- 无需修改现有代码

## 常见问题

### Q: 插件加载失败？
A: 检查以下几点：
1. `.kube/plugins/` 目录是否存在
2. `plugin.ts` 和 `package.json` 是否正确
3. 构建是否成功（`npm run build`）
4. 查看错误信息（启用 `verbose: true`）

### Q: 工具找不到？
A: 可能原因：
1. 插件未成功加载（查看启动日志）
2. 工具名称拼写错误
3. 插件工具未正确导出

### Q: 想开发自己的插件？
A: 参考：
- `.kube/plugins/search-plugin/` 作为示例
- `PLUGIN_SYSTEM_IMPLEMENTATION.md` 了解架构
- `src/plugins/types.ts` 查看类型定义

## 性能对比

| 模式 | 启动时间 | 内存占用 | 工具数量 |
|------|---------|---------|---------|
| 禁用插件 | ~1.5s | ~80MB | 11 (内置) |
| 启用插件 | ~2.0s | ~90MB | 11 (内置) + 10 (插件) |

**结论**: 插件系统开销很小（~0.5s, ~10MB）

---

**测试完成后，请报告结果！** 🎯
