#!/bin/bash

echo "🔍 Newma 自主探索实时监控"
echo "================================"
echo ""

# 检查日志目录
LOG_DIR="$HOME/.kode/exploration-logs"

if [ -d "$LOG_DIR" ]; then
  echo "📂 日志目录: $LOG_DIR"
  echo ""

  # 查找最新的探索任务
  LATEST_LOG=$(find "$LOG_DIR" -name "*.json" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2)

  if [ -n "$LATEST_LOG" ]; then
    echo "📝 最新探索日志:"
    echo "   文件: $LATEST_LOG"
    echo ""

    # 显示日志内容摘要
    if command -v jq &> /dev/null; then
      echo "📊 任务摘要:"
      jq -r '"任务ID: " + .taskId + "\n状态: " + .summary.completed + "/" + .summary.total + " 完成\n时长: " + (.duration/1000 | tostring) + "秒"' "$LATEST_LOG" 2>/dev/null || echo "   (正在执行中...)"
    else
      echo "   (需要安装jq来解析JSON)"
    fi
  else
    echo "   (暂无日志文件)"
  fi
else
  echo "⚠️  日志目录尚不存在"
  echo "   首次探索将在完成后创建日志"
fi

echo ""
echo "⏰ 下次执行:"
echo "   按照 Cron 0 */4 * * *"
echo "   下次: $(date -v+4H '+%Y-%m-%d %H:%M:%S')"
echo ""

echo "💡 提示:"
echo "   - 查看完整日志: ls -la $LOG_DIR"
echo "   - 查看数据库: sqlite3 ~/mobilenewma/gateway/database/gateway.db"
echo "   - 停止守护进程: pkill -f 'npm run daemon'"
echo ""
