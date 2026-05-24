# 🎉 沉淀系统后台运行 - 设置完成

## ✅ 当前状态

**守护进程**: ✅ **正在运行**
- **PID**: 94751
- **已运行**: ~45 秒
- **下次沉淀**: 今天凌晨 2:00 (2026-02-03 02:00:00)

---

## 🚀 快速命令

### 使用管理脚本（推荐）

```bash
# 查看状态
./daemon-manager.sh status

# 查看日志
./daemon-manager.sh logs

# 实时日志
./daemon-manager.sh follow

# 重启守护进程
./daemon-manager.sh restart

# 停止守护进程
./daemon-manager.sh stop
```

### 直接管理

```bash
# 查看进程
ps aux | grep "node dist/daemon.js"

# 停止进程
kill $(cat .daemon.pid)

# 查看日志
tail -f /tmp/newma-daemon.log
```

---

## 📅 调度信息

- **Cron 表达式**: `0 2 * * *`
- **执行时间**: 每天凌晨 2:00
- **下次运行**: 今晚 2:00 AM（约 4-5 小时后）

---

## 📊 验证方法

### 1. 检查进程运行

```bash
ps -p 94751
```

应该显示：
```
  PID TTY           TIME CMD
94751 ??         0:45 node dist/daemon.js
```

### 2. 查看系统日志

```bash
tail -20 /tmp/newma-daemon.log
```

应该看到：
```
✅ Newma Daemon started successfully!
⚙️  System Status:
   Status: 🟢 Running
   Next run: Tue Feb 03 2026 02:00:00 GMT+0800
```

### 3. 明天检查生成的技能

```bash
# 启动 REPL
npx newma-cli -i

# 查看新生成的草稿
> /drafts

# 查看统计
> /precipitation-status
```

---

## 🔧 配置修改

### 修改执行时间

编辑 `settings.json`:

```json
{
  "precipitation": {
    "schedule": "0 2 * * *"  // 改为你需要的时间
  }
}
```

然后重启守护进程：
```bash
./daemon-manager.sh restart
```

### 常用 Cron 表达式

```
0 2 * * *     # 每天凌晨 2 点
0 */6 * * *   # 每 6 小时
0 0 * * 0     # 每周日凌晨
0 0 * * 1     # 每周一凌晨
*/30 * * * *  # 每 30 分钟
```

---

## 🧪 测试手动触发

如果你想立即测试沉淀功能（不等今晚）：

```bash
# 方法 1: 在 REPL 中
npx newma-cli -i
> /precipitate

# 方法 2: 直接运行
npx newma-cli --precipitate
```

---

## ⚠️ 注意事项

1. **API Key 必需**: 确保 `OPENAI_API_KEY` 环境变量已设置
   ```bash
   echo $OPENAI_API_KEY
   ```

2. **日志位置**: `/tmp/newma-daemon.log`
   - 定期检查日志确认系统正常运行
   - 如果日志中有错误，检查 API key 和网络连接

3. **资源占用**: 守护进程占用约 50-100MB 内存
   - 如果系统资源有限，可以使用 cron job 方式

4. **自动重启**: 当前实现不包含自动重启
   - 如果进程意外退出，需要手动重启
   - 或使用 PM2 获得自动重启功能

---

## 📝 文件清单

| 文件 | 说明 |
|------|------|
| `src/daemon.ts` | 守护进程源代码 |
| `dist/daemon.js` | 编译后的守护进程 |
| `daemon-manager.sh` | 管理脚本 |
| `.daemon.pid` | 进程 PID 文件 |
| `/tmp/newma-daemon.log` | 运行日志 |
| `DAEMON_GUIDE.md` | 完整使用指南 |

---

## 🎯 下一步

1. **明天早上** 检查生成的技能：
   ```bash
   npx newma-cli -i
   > /drafts
   ```

2. **审批高质量技能**：
   ```bash
   > /view-draft error-handling-best-practices
   > /approve error-handling-best-practices "很好的技能！"
   ```

3. **查看系统统计**：
   ```bash
   > /precipitation-status
   ```

---

## 🆘 故障排查

### 守护进程意外停止

```bash
# 检查日志
cat /tmp/newma-daemon.log | tail -50

# 重新启动
./daemon-manager.sh start
```

### 没有生成技能

```bash
# 检查配置
cat settings.json | grep -A 10 precipitation

# 手动触发测试
npx newma-cli -i
> /precipitate
```

### API 错误

```bash
# 检查 API key
echo $OPENAI_API_KEY

# 测试 API 连接
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

---

**🎊 今晚就会自动运行沉淀系统！明天早上查看新生成的技能吧！**
