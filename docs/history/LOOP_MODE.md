# Loop Mode - Bash Script Integration

Newma (牛码) 现在支持 **Loop 模式**，可以从 bash 脚本中循环调用，直到任务完成。

## 🚀 基本用法

### 方法 1: 简单的 while 循环

```bash
while ! npx newma-cli "Add user authentication" --loop; do
  echo "Not done yet, retrying..."
  sleep 1
done
```

### 方法 2: 限制最大迭代次数

```bash
for i in {1..10}; do
  npx newma-cli "Add user authentication" --loop && break
done
```

### 方法 3: 使用提供的脚本

```bash
chmod +x loop-example.sh
./loop-example.sh "Add user authentication" 10
```

## 📋 退出码

`--loop` 模式返回不同的退出码：

- **0** - 任务完成 ✅
- **1** - 任务未完成 ⚠️
- **2** - 执行出错 ❌
- **130** - 用户按 Ctrl+C 中断 ⛔

## 🛑 中断处理

当用户按 **Ctrl+C** 时：

1. **立即中断** AI API 调用
2. **优雅退出** - 不会留下部分执行的操作
3. **返回退出码 130** - 这是 Unix 标准（128 + SIGINT）
4. **清理资源** - 移除信号监听器

```bash
while ! npx newma-cli "Task" --loop; do
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 130 ]; then
    echo "⚠️  User interrupted"
    exit 130
  fi
  sleep 1
done
```

## 📝 完整示例

### 示例 1: 无限循环直到完成

```bash
#!/bin/bash
while :; do
  npx newma-cli "Fix the login bug" --loop
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Task completed!"
    break
  elif [ $EXIT_CODE -eq 2 ]; then
    echo "❌ Error, exiting"
    exit 2
  fi

  echo "⚠️  Continuing..."
  sleep 2
done
```

### 示例 2: 带超时的循环

```bash
#!/bin/bash
timeout 300 bash << 'EOF'
while ! npx newma-cli "Add API endpoint" --loop; do
  sleep 1
done
EOF

if [ $? -eq 124 ]; then
  echo "⏱️  Timed out after 5 minutes"
  exit 1
fi
```

### 示例 3: 带进度显示

```bash
#!/bin/bash
MAX_ITER=10
TASK="Create unit tests"

for ((i=1; i<=$MAX_ITER; i++)); do
  echo "[$i/$MAX_ITER] Attempting: $TASK"
  npx newma-cli "$TASK" --loop && exit 0
  echo "[$i/$MAX_ITER] Not done, retrying..."
  sleep 2
done

echo "❌ Failed after $MAX_ITER attempts"
exit 1
```

## 🔧 Loop 模式的特点

### 自动确认

Loop 模式下，所有交互式确认都会被跳过：

- ✅ 自动执行操作计划
- ✅ 遇到错误时自动回滚
- ✅ 继续下一次迭代

### 终止条件

循环会在以下情况下终止：

1. **任务完成** - AI 返回 `done: true`
2. **执行出错** - 操作失败，返回错误码 2
3. **达到最大迭代** - 如果你在脚本中设置了限制

## ⚙️ 与 REPL 中的 `/loop` 命令的区别

| 特性 | CLI `--loop` | REPL `/loop` |
|------|-------------|--------------|
| **使用场景** | Bash 脚本 | 交互式会话 |
| **确认** | 跳过所有确认 | 跳过所有确认 |
| **退出码** | 返回 0/1/2 | 不适用 |
| **输出** | 标准输出 | 简化输出 |
| **中断** | Ctrl+C | Ctrl+C |

## 🎯 最佳实践

### 1. 设置超时

```bash
timeout 600 npx newma-cli "Complex task" --loop
# 10分钟后超时
```

### 2. 保存日志

```bash
while ! npx newma-cli "Task" --loop 2>&1 | tee -a loop.log; do
  sleep 1
done
```

### 3. 监控进度

```bash
npx newma-cli "Task" --loop | grep -E "(✅|❌|⚠️)"
```

### 4. 错误处理

```bash
npx newma-cli "Task" --loop || {
  echo "Failed with code: $?"
  # 发送通知
  notify-send "Newma (牛码) failed" "Task did not complete"
}
```

## 💡 提示

- Multi-agent 模式默认禁用（使用简单的 plan-do-verify 流程）
- 使用 `--autonomous` 启用完全自主执行模式（实验性功能）
- 使用 `--max-iterations 1` 来只尝试一次
- 结合 `--verify` 启用自动验证
- 使用 `--no-compress` 禁用压缩（调试时有用）
- 查看完整日志：`npx newma-cli "Task" --loop 2>&1 | less`

**推荐用法**：
```bash
npx newma-cli "Your task" --loop
```

## 🐛 故障排除

### 问题：循环不退出

**原因**：AI 可能一直返回 `done: false`

**解决**：设置最大迭代次数

```bash
for i in {1..5}; do
  npx newma-cli "Task" --loop && break
done
```

### 问题：退出码不正确

**原因**：可能是其他错误

**解决**：检查完整输出

```bash
npx newma-cli "Task" --loop 2>&1 | tee output.log
echo "Exit code: $?"
```

## 📚 更多示例

查看 `loop-example.sh` 文件获取更多使用示例。
