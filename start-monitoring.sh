#!/bin/bash

# 监控脚本 - 每10分钟检查一次

LOG_FILE="/Users/mac/kode/exploration-monitor.log"

monitor() {
  while true; do
    {
      echo "================================"
      echo "检查时间: $(date '+%Y-%m-%d %H:%M:%S')"
      echo ""

      # 检查守护进程
      echo "📡 守护进程:"
      if pgrep -f "ts-node src/daemon.ts" > /dev/null; then
        echo "  ✅ 运行中 (PID: $(pgrep -f 'ts-node src/daemon.ts' | head -1))"
      else
        echo "  ❌ 未运行"
      fi
      echo ""

      # 检查探索任务
      echo "🤖 自主探索任务:"
      if pgrep -f "trigger-exploration" > /dev/null; then
        echo "  ✅ 运行中 (PID: $(pgrep -f 'trigger-exploration' | head -1))"
        ps aux | grep "trigger-exploration" | grep -v grep | awk '{printf "  CPU: %s%%  MEM: %s%%\n", $3, $4}'
      else
        echo "  ⏸️  未运行（可能已完成）"
      fi
      echo ""

      # 检查日志文件
      echo "📂 日志文件:"
      if [ -d "$HOME/.kode/exploration-logs" ]; then
        COUNT=$(find "$HOME/.kode/exploration-logs" -name "*.json" | wc -l)
        echo "  文件数: $COUNT"
        if [ "$COUNT" -gt 0 ]; then
          echo "  最新: $(find "$HOME/.kode/exploration-logs" -name "*.json" -printf '%T@ %p\n' | sort -n | tail -1 | awk '{print $2}')"
        fi
      else
        echo "  ⏳ 尚未创建（首次探索完成后创建）"
      fi
      echo ""

      echo "下次检查: $(date -v+10M '+%H:%M:%S' 2>/dev/null || date -d '+10 minutes' '+%H:%M:%S')"
      echo "================================"
      echo ""
    } | tee -a "$LOG_FILE"

    # 等待10分钟
    sleep 600
  done
}

monitor
