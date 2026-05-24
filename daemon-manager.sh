#!/bin/bash

# Newma 守护进程管理脚本

DAEMON_PID_FILE=".daemon.pid"
DAEMON_LOG_FILE="/tmp/newma-daemon.log"
DAEMON_BINARY="node dist/daemon.js"

case "$1" in
  start)
    if [ -f "$DAEMON_PID_FILE" ]; then
      PID=$(cat "$DAEMON_PID_FILE")
      if ps -p $PID > /dev/null 2>&1; then
        echo "⚠️  守护进程已在运行 (PID: $PID)"
        exit 1
      else
        echo "🧹 清理过期的 PID 文件"
        rm -f "$DAEMON_PID_FILE"
      fi
    fi

    echo "🚀 启动 Newma 守护进程..."
    nohup $DAEMON_BINARY > "$DAEMON_LOG_FILE" 2>&1 &
    DAEMON_PID=$!
    echo $DAEMON_PID > "$DAEMON_PID_FILE"

    sleep 2
    if ps -p $DAEMON_PID > /dev/null 2>&1; then
      echo "✅ 守护进程启动成功 (PID: $DAEMON_PID)"
      echo ""
      echo "📊 进程信息:"
      ps -p $DAEMON_PID -o pid,etime,command
      echo ""
      echo "📝 日志文件: $DAEMON_LOG_FILE"
      echo "   查看日志: tail -f $DAEMON_LOG_FILE"
    else
      echo "❌ 守护进程启动失败"
      rm -f "$DAEMON_PID_FILE"
      exit 1
    fi
    ;;

  stop)
    if [ ! -f "$DAEMON_PID_FILE" ]; then
      echo "❌ 守护进程未运行（PID 文件不存在）"
      exit 1
    fi

    PID=$(cat "$DAEMON_PID_FILE")

    if ! ps -p $PID > /dev/null 2>&1; then
      echo "⚠️  守护进程未运行（PID: $PID）"
      rm -f "$DAEMON_PID_FILE"
      exit 1
    fi

    echo "🛑 停止守护进程 (PID: $PID)..."
    kill $PID

    # 等待进程结束
    for i in {1..10}; do
      if ! ps -p $PID > /dev/null 2>&1; then
        echo "✅ 守护进程已停止"
        rm -f "$DAEMON_PID_FILE"
        exit 0
      fi
      sleep 1
    done

    # 强制结束
    echo "⚠️  强制结束守护进程..."
    kill -9 $PID
    rm -f "$DAEMON_PID_FILE"
    echo "✅ 守护进程已强制停止"
    ;;

  restart)
    echo "🔄 重启守护进程..."
    $0 stop
    sleep 1
    $0 start
    ;;

  status)
    if [ ! -f "$DAEMON_PID_FILE" ]; then
      echo "❌ 守护进程未运行"
      exit 1
    fi

    PID=$(cat "$DAEMON_PID_FILE")

    if ! ps -p $PID > /dev/null 2>&1; then
      echo "⚠️  守护进程未运行（PID 文件存在但进程不存在）"
      rm -f "$DAEMON_PID_FILE"
      exit 1
    fi

    echo "✅ 守护进程正在运行"
    echo ""
    echo "📊 进程信息:"
    ps -p $PID -o pid,etime,command
    echo ""
    echo "📅 下次沉淀:"
    tail -20 "$DAEMON_LOG_FILE" | grep "Next run" | tail -1
    ;;

  logs)
    if [ ! -f "$DAEMON_LOG_FILE" ]; then
      echo "❌ 日志文件不存在"
      exit 1
    fi

    echo "📝 最近日志（最后 50 行）:"
    echo "══════════════════════════════════"
    tail -50 "$DAEMON_LOG_FILE"
    ;;

  follow)
    if [ ! -f "$DAEMON_LOG_FILE" ]; then
      echo "❌ 日志文件不存在"
      exit 1
    fi

    echo "📝 实时日志（Ctrl+C 退出）:"
    echo "══════════════════════════════════"
    tail -f "$DAEMON_LOG_FILE"
    ;;

  *)
    echo "Newma 守护进程管理脚本"
    echo ""
    echo "用法: $0 {start|stop|restart|status|logs|follow}"
    echo ""
    echo "命令:"
    echo "  start    - 启动守护进程"
    echo "  stop     - 停止守护进程"
    echo "  restart  - 重启守护进程"
    echo "  status   - 查看运行状态"
    echo "  logs     - 查看最近日志"
    echo "  follow   - 实时跟踪日志"
    echo ""
    exit 1
    ;;
esac
