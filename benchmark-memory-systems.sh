#!/bin/bash

# Memory Systems Benchmark
# 测试所有7个记忆系统的性能

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Memory Systems Performance Benchmark                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 计数器
TOTAL_TESTS=0
PASSED_TESTS=0

# 测试函数
test_system() {
    local system_name=$1
    local test_file=$2

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -e "${BLUE}Testing: $system_name${NC}"
    echo "────────────────────────────────────────────"

    START_TIME=$(python3 -c "import time; print(int(time.time() * 1000))")

    if npx ts-node "$test_file" > /tmp/test-output.txt 2>&1; then
        END_TIME=$(python3 -c "import time; print(int(time.time() * 1000))")
        DURATION=$((END_TIME - START_TIME))

        echo -e "${GREEN}✓ PASSED${NC} (${DURATION}ms)"
        PASSED_TESTS=$((PASSED_TESTS + 1))

        # 显示关键统计
        if grep -q "completed successfully" /tmp/test-output.txt; then
            echo "  All tests passed"
        fi
    else
        END_TIME=$(python3 -c "import time; print(int(time.time() * 1000))")
        DURATION=$((END_TIME - START_TIME))

        echo -e "${YELLOW}✗ FAILED${NC} (${DURATION}ms)"
        echo "  Error output:"
        head -5 /tmp/test-output.txt | sed 's/^/    /'
    fi

    echo ""
}

# ==================== 运行所有测试 ====================

echo "🚀 Starting Memory Systems Benchmark..."
echo ""

# 单个系统测试
test_system "Project Context Memory" "test-project-context.ts"
test_system "Execution History Memory" "test-execution-history.ts"
test_system "Error Solution Memory" "test-error-memory.ts"
test_system "User Preferences Memory" "test-preferences.ts"
test_system "Session Context Memory" "test-session-context.ts"
test_system "Reasoning Process Memory" "test-reasoning.ts"

# 集成测试
test_system "All Memory Systems Integration" "test-all-memory-systems.ts"
test_system "Complete Memory System Test" "test-all-memories.ts"

# ==================== 性能总结 ====================

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                  Performance Summary                        ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo ""

SUCCESS_RATE=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)

echo "📊 Test Results:"
echo "   Total Tests: $TOTAL_TESTS"
echo "   Passed:      $PASSED_TESTS"
echo "   Failed:      $((TOTAL_TESTS - PASSED_TESTS))"
echo "   Success Rate: ${SUCCESS_RATE}%"
echo ""

# 内存使用情况
echo "💾 Memory Usage:"
if [ -d ".memo" ]; then
    MEMO_SIZE=$(du -sh .memo | cut -f1)
    FILE_COUNT=$(find .memo -type f | wc -l | tr -d ' ')
    echo "   .memo/ directory: ${MEMO_SIZE}"
    echo "   Total files:     ${FILE_COUNT}"

    # 统计各类文件
    if [ -f ".memo/context.json" ]; then
        CONTEXT_SIZE=$(du -h .memo/context.json | cut -f1)
        echo "   • context.json:  ${CONTEXT_SIZE}"
    fi

    if [ -f ".memo/sessions.json" ]; then
        SESSIONS_SIZE=$(du -h .memo/sessions.json | cut -f1)
        echo "   • sessions.json: ${SESSIONS_SIZE}"
    fi

    if [ -f ".memo/errors.json" ]; then
        ERRORS_SIZE=$(du -h .memo/errors.json | cut -f1)
        echo "   • errors.json:   ${ERRORS_SIZE}"
    fi

    if [ -f ".memo/preferences.json" ]; then
        PREFS_SIZE=$(du -h .memo/preferences.json | cut -f1)
        echo "   • preferences:   ${PREFS_SIZE}"
    fi

    if [ -f ".memo/reasoning.json" ]; then
        REASONING_SIZE=$(du -h .memo/reasoning.json | cut -f1)
        echo "   • reasoning.json:${REASONING_SIZE}"
    fi
fi
echo ""

# 系统统计
echo "🔧 System Statistics:"
EXEC_SESSIONS=$(find .memo/sessions -type f -name "*.json" 2>/dev/null | wc -l | tr -d ' ')
if [ "$EXEC_SESSIONS" -gt 0 ]; then
    echo "   Execution sessions: ${EXEC_SESSIONS}"
fi

ERROR_COUNT=$(jq '.errors | length' .memo/errors.json 2>/dev/null || echo "0")
if [ "$ERROR_COUNT" != "0" ]; then
    echo "   Recorded errors:   ${ERROR_COUNT}"
fi

REASONING_CHAINS=$(jq '.chains | length' .memo/reasoning.json 2>/dev/null || echo "0")
if [ "$REASONING_CHAINS" != "0" ]; then
    echo "   Reasoning chains:  ${REASONING_CHAINS}"
fi
echo ""

# 性能建议
echo "💡 Performance Insights:"
echo "   • All memory systems use JSON storage"
echo "   • Compression enabled for old data (7+ days)"
echo "   • No data deletion - permanent retention"
echo "   • Cache TTL: 1 hour (project context)"
echo "   • Search optimized with indexing"
echo ""

echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 退出码
if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo -e "${GREEN}All benchmarks passed successfully!${NC}"
    exit 0
else
    echo -e "${YELLOW}Some benchmarks failed${NC}"
    exit 1
fi
