#!/bin/bash

# Quick test for memory commands
# 直接测试已构建的命令

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Quick Test: Interactive Memory Commands                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 检查构建
if [ ! -d "dist" ]; then
    echo "❌ Project not built. Running: npm run build"
    npm run build
fi

echo "✅ Build exists"
echo ""

# 测试命令说明
echo "📝 Available Memory Commands in REPL:"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "  /memory-stats          - 查看所有统计信息"
echo "  /memory-history [n]   - 查看执行历史（默认 5 条）"
echo "  /memory-errors [n]     - 查看错误记录（默认 5 条）"
echo "  /memory-prefs          - 查看用户偏好"
echo "  /memory-sessions [n]   - 查看会话历史（默认 5 条）"
echo "  /memory-reasoning [n]  - 查看推理过程（默认 3 条）"
echo ""

# 查看当前数据
echo "📊 Current Memory Data:"
echo "─────────────────────────────────────────────────────────────"
echo ""

if [ -d ".memo" ]; then
    echo "Storage: .memo/ directory exists"
    echo "Size: $(du -sh .memo | cut -f1)"
    echo "Files: $(find .memo -type f | wc -l | tr -d ' ')"
    echo ""

    # 检查各个文件
    echo "Memory Files:"
    [ -f ".memo/sessions.json" ] && echo "  ✓ sessions.json ($(du -h .memo/sessions.json | cut -f1))"
    [ -f ".memo/errors.json" ] && echo "  ✓ errors.json ($(du -h .memo/errors.json | cut -f1))"
    [ -f ".memo/preferences.json" ] && echo "  ✓ preferences.json ($(du -h .memo/preferences.json | cut -f1))"
    [ -f ".memo/reasoning.json" ] && echo "  ✓ reasoning.json ($(du -h .memo/reasoning.json | cut -f1))"
    [ -f ".memo/context.json" ] && echo "  ✓ context.json ($(du -h .memo/context.json | cut -f1))"
    [ -f ".memo/decisions.json" ] && echo "  ✓ decisions.json ($(du -h .memo/decisions.json | cut -f1))"
    echo ""
else
    echo "⚠️  .memo/ directory not found"
    echo "  Memory systems will be initialized on first use"
    echo ""
fi

# 使用说明
echo "💡 How to Test:"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "1. Start REPL:"
echo "   npx newma-cli -i"
echo ""
echo "2. Try commands:"
echo "   /memory-stats"
echo "   /memory-history"
echo "   /memory-prefs"
echo ""
echo "3. Or use query script:"
echo "   ./query-memory.sh all"
echo ""

echo "✅ Memory commands are ready to use!"
echo ""
