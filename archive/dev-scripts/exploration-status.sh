#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          Newma 自主探索 - 实时状态监控                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📅 检查时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 1. 进程状态
echo "📡 进程状态"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DAEMON_PID=$(pgrep -f "ts-node src/daemon.ts" | head -1)
EXPLORATION_PID=$(pgrep -f "trigger-exploration" | head -1)

if [ -n "$DAEMON_PID" ]; then
  echo "守护进程: ✅ 运行中"
  echo "  PID: $DAEMON_PID"
  ps -p "$DAEMON_PID" -o pid,pcpu,pmem,time,command | tail -1 | awk '{printf "  CPU: %s%%  MEM: %s%%  运行时间: %s\n", $2, $3, $4}'
else
  echo "守护进程: ❌ 未运行"
fi

echo ""

if [ -n "$EXPLORATION_PID" ]; then
  echo "探索任务: ✅ 运行中"
  echo "  PID: $EXPLORATION_PID"
  ps -p "$EXPLORATION_PID" -o pid,pcpu,pmem,time,command | tail -1 | awk '{printf "  CPU: %s%%  MEM: %s%%  运行时间: %s\n", $2, $3, $4}'
else
  echo "探索任务: ⏸️  未运行"
fi

echo ""

# 2. 日志状态
echo "📂 日志文件"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

LOG_DIR="$HOME/.kode/exploration-logs"
MONITOR_LOG="/Users/mac/kode/exploration-monitor.log"

if [ -d "$LOG_DIR" ]; then
  TOTAL_LOGS=$(find "$LOG_DIR" -name "*.json" -type f 2>/dev/null | wc -l | tr -d ' ')
  echo "日志目录: $LOG_DIR"
  echo "总文件数: $TOTAL_LOGS"

  if [ "$TOTAL_LOGS" -gt 0 ]; then
    echo ""
    echo "最新日志:"
    find "$LOG_DIR" -name "*.json" -type f -printf '%T@ %p\n' | sort -n | tail -3 | while read -r timestamp filepath; do
      FILENAME=$(basename "$filepath")
      FILETIME=$(date -r "$filepath" '+%Y-%m-%d %H:%M:%S')
      FILESIZE=$(du -h "$filepath" | cut -f1)
      echo "  📄 $FILENAME"
      echo "     时间: $FILETIME"
      echo "     大小: $FILESIZE"
      echo ""
    done
  fi
else
  echo "日志目录: ⏳ 尚未创建（首次探索完成后创建）"
fi

echo ""

# 3. 监控日志
if [ -f "$MONITOR_LOG" ]; then
  echo "📊 监控日志"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "文件: $MONITOR_LOG"
  LAST_CHECK=$(tail -1 "$MONITOR_LOG" 2>/dev/null | grep "检查时间" | head -1)
  if [ -n "$LAST_CHECK" ]; then
    echo "最后检查: $LAST_CHECK"
  else
    echo "最后检查: （无记录）"
  fi

  echo ""
  echo "最近3条记录:"
  tail -3 "$MONITOR_LOG" | grep -E "(检查时间|守护进程|探索任务|日志文件)" | tail -3
else
  echo "📊 监控日志: （尚未创建）"
fi

echo ""

# 4. 计划
echo "⏰ 执行计划"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "定时规则: 每4小时 (0 */4 * * *)"
echo "执行时间: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00"
NEXT_RUN=$(date -v+4H '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -d '+4 hours' '+%Y-%m-%d %H:%M:%S')
echo "下次执行: $NEXT_RUN"

echo ""

# 5. 快捷命令
echo "💡 快捷命令"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "查看监控日志: tail -f /Users/mac/kode/exploration-monitor.log"
echo "查看守护进程: ps aux | grep daemon"
echo "查看探索进程: ps aux | grep exploration"
echo "停止所有进程: pkill -f 'ts-node.*(daemon|exploration)'"
echo "查看日志目录: ls -la ~/.kode/exploration-logs/"
echo "手动触发探索: npx ts-node /Users/mac/kode/trigger-exploration.ts"

echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "📌 下次检查: 10分钟后"
echo "══════════════════════════════════════════════════════════════════"
