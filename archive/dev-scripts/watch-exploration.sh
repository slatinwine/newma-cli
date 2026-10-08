#!/bin/bash

echo "⏰ Newma 自主探索实时监控"
echo "开始时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================"
echo ""

while true; do
  clear
  echo "⏰ Newma 自主探索实时监控"
  echo "检查时间: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "================================"
  echo ""

  # 1. 检查守护进程
  echo "📡 守护进程状态:"
  if pgrep -f "ts-node.*daemon" > /dev/null; then
    echo "   ✅ 守护进程运行中"
    echo "   PID: $(pgrep -f 'ts-node.*daemon' | head -1)"
  else
    echo "   ❌ 守护进程未运行"
  fi
  echo ""

  # 2. 检查探索任务
  echo "🤖 自主探索任务:"
  if pgrep -f "ts-node.*exploration" > /dev/null; then
    echo "   ✅ 探索任务运行中"
    echo "   PID: $(pgrep -f 'ts-node.*exploration' | head -1)"
    
    # 检查CPU和内存使用
    ps aux | grep -E "ts-node.*exploration" | grep -v grep | awk '{print "   CPU: "$3"% | 内存: "$4"%"}'
  else
    echo "   ⏸️  探索任务未运行（可能已完成或失败）"
  fi
  echo ""

  # 3. 检查日志目录
  echo "📂 日志文件:"
  LOG_DIR="$HOME/.kode/exploration-logs"
  if [ -d "$LOG_DIR" ]; then
    LOG_COUNT=$(find "$LOG_DIR" -name "*.json" -type f 2>/dev/null | wc -l)
    echo "   目录: $LOG_DIR"
    echo "   文件数: $LOG_COUNT"
    
    if [ "$LOG_COUNT" -gt 0 ]; then
      echo ""
      echo "   最新日志:"
      find "$LOG_DIR" -name "*.json" -type f -printf '%T@ %p\n' | sort -n | tail -1 | while read -r timestamp filepath; do
        echo "   📄 $(basename $filepath)"
        echo "      时间: $(date -r "$filepath" '+%Y-%m-%d %H:%M:%S')"
        echo "      路径: $filepath"
        
        # 尝试解析JSON并显示摘要
        if command -v jq &> /dev/null; then
          TASK_ID=$(jq -r '.taskId // "N/A"' "$filepath" 2>/dev/null)
          STATUS=$(jq -r '.summary.completed // "/" // .summary.total // "N/A"' "$filepath" 2>/dev/null)
          DURATION=$(jq -r '(.duration // 0 / 1000 | tostring) + " 秒"' "$filepath" 2>/dev/null)
          echo "      任务ID: $TASK_ID"
          echo "      状态: $STATUS"
          echo "      时长: $DURATION"
        fi
      done
    fi
  else
    echo "   ⏳ 日志目录尚未创建"
  fi
  echo ""

  # 4. 下次执行时间
  echo "⏰ 下次计划执行:"
  echo "   按照每4小时: 0 */4 * * *"
  echo "   下次: $(date -v+4H '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -d '+4 hours' '+%Y-%m-%d %H:%M:%S')"
  echo ""

  echo "💡 按 Ctrl+C 停止监控"
  echo "================================"
  echo ""

  # 等待10分钟
  sleep 600
done
