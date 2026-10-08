#!/bin/bash

# Memory Query Script
# 快速查询记忆系统数据

MEMO_DIR=".memo"

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 显示帮助
show_help() {
    echo "记忆系统查询工具"
    echo ""
    echo "用法: ./query-memory.sh [命令] [选项]"
    echo ""
    echo "命令:"
    echo "  history [数量]      查看最近的执行历史"
    echo "  errors [数量]       查看最近的错误"
    echo "  preferences         查看用户偏好"
    echo "  sessions [数量]     查看最近的会话"
    echo "  reasoning [数量]    查看最近的推理链"
    echo "  decisions [数量]    查看最近的决策"
    echo "  stats               显示统计信息"
    echo "  all                 显示所有概览"
    echo ""
    echo "示例:"
    echo "  ./query-memory.sh history 5"
    echo "  ./query-memory.sh errors 3"
    echo "  ./query-memory.sh preferences"
    echo "  ./query-memory.sh all"
}

# 检查 jq 是否安装
check_jq() {
    if ! command -v jq &> /dev/null; then
        echo "错误: 需要安装 jq 工具"
        echo "安装: brew install jq"
        exit 1
    fi
}

# 查看执行历史
show_history() {
    local count=${1:-3}
    echo -e "${BLUE}📜 最近 ${count} 条执行历史${NC}"
    echo "────────────────────────────────────────────"

    if [ -f "${MEMO_DIR}/sessions.json" ]; then
        jq -r --argjson count $count '
            .sessions as $sessions |
            ($sessions | length) as $total |
            ($sessions | reverse | .[0:$count])[] |
            "命令: " + .command +
            "\n状态: " + .status +
            "\n时间: " + .startTime +
            "\n时长: " + (
                if .metadata.duration then
                    (.metadata.duration / 1000 | floor | tostring) + "ms"
                else
                    "N/A"
                end
            ) +
            (if .actions then "\n操作数: " + (.actions | length | tostring) else "" end) +
            "\n"
        ' ${MEMO_DIR}/sessions.json 2>/dev/null || echo "暂无数据"
    else
        echo "暂无数据"
    fi
    echo ""
}

# 查看错误
show_errors() {
    local count=${1:-3}
    echo -e "${BLUE}❌ 最近 ${count} 个错误${NC}"
    echo "────────────────────────────────────────────"

    if [ -f "${MEMO_DIR}/errors.json" ]; then
        jq -r --argjson count $count '
            .errors as $errors |
            ($errors | length) as $total |
            ($errors | reverse | .[0:$count])[] |
            "类型: " + .errorType +
            "\n错误: " + .errorMessage +
            "\n时间: " + .timestamp +
            (if .solutions and (.solutions | length > 0) then
                "\n解决方案: " + .solutions[0].description
            else
                "\n状态: 未解决"
            end) +
            "\n"
        ' ${MEMO_DIR}/errors.json 2>/dev/null || echo "暂无数据"
    else
        echo "暂无数据"
    fi
    echo ""
}

# 查看用户偏好
show_preferences() {
    echo -e "${BLUE}⚙️  用户偏好设置${NC}"
    echo "────────────────────────────────────────────"

    if [ -f "${MEMO_DIR}/preferences.json" ]; then
        jq -r '
            "语言偏好: " + .aiInteraction.language +
            "\n交流风格: " + .aiInteraction.verbosity +
            "\n缩进方式: " + .codeStyle.indent + " (" + (.codeStyle.indentSize | tostring) + " 空格)" +
            "\n引号风格: " + .codeStyle.quoteStyle +
            "\n命名规范: " + .codeStyle.namingConvention +
            "\n包管理器: " + .tools.preferredPackageManager +
            "\n默认模式: " + .workflow.defaultMode +
            "\n更新时间: " + .lastUpdated +
            "\n"
        ' ${MEMO_DIR}/preferences.json 2>/dev/null || echo "暂无数据"
    else
        echo "暂无数据"
    fi
    echo ""
}

# 查看会话
show_sessions() {
    local count=${1:-3}
    echo -e "${BLUE}💬 最近 ${count} 个会话${NC}"
    echo "────────────────────────────────────────────"

    if [ -f "${MEMO_DIR}/sessions.json" ]; then
        jq -r --argjson count $count '
            . as $data |
            if $data.sessions then
                $data.sessions as $sessions |
                ($sessions | length) as $total |
                ($sessions | reverse | .[0:$count])[] |
                "标题: " + .title +
                "\n状态: " + .status +
                "\n消息数: " + (.stats.messageCount | tostring) +
                "\n时长: " + (
                    if .stats.duration then
                        (.stats.duration / 1000 | floor | tostring) + "秒"
                    else
                        "N/A"
                    end
                ) +
                "\n时间: " + .startTime +
                "\n"
            else
                "暂无数据\n"
            end
        ' ${MEMO_DIR}/sessions.json 2>/dev/null || echo "暂无数据"
    else
        echo "暂无数据"
    fi
    echo ""
}

# 查看推理链
show_reasoning() {
    local count=${1:-3}
    echo -e "${BLUE}🧠 最近 ${count} 个推理链${NC}"
    echo "────────────────────────────────────────────"

    if [ -f "${MEMO_DIR}/reasoning.json" ]; then
        jq -r --argjson count $count '
            .chains as $chains |
            ($chains | length) as $total |
            ($chains | reverse | .[0:$count])[] |
            "任务: " + .task +
            "\n类型: " + .taskType +
            "\n状态: " + .status +
            "\n步骤数: " + (.stats.totalSteps | tostring) +
            (if .learnedPatterns and .learnedPatterns.preferredAlgorithm then
                "\n算法: " + .learnedPatterns.preferredAlgorithm
            else
                ""
            end) +
            "\n时间: " + .startTime +
            "\n"
        ' ${MEMO_DIR}/reasoning.json 2>/dev/null || echo "暂无数据"
    else
        echo "暂无数据"
    fi
    echo ""
}

# 查看决策
show_decisions() {
    local count=${1:-5}
    echo -e "${BLUE}📝 最近 ${count} 个决策${NC}"
    echo "────────────────────────────────────────────"

    if [ -f "${MEMO_DIR}/decisions.json" ]; then
        jq -r --argjson count $count '
            .decisions as $decisions |
            ($decisions | length) as $total |
            ($decisions | reverse | .[0:$count])[] |
            "标题: " + .title +
            "\n时间: " + (.timestamp | split(".")[0]) +
            (if .tags and (.tags | length > 0) then
                "\n标签: " + (.tags | join(", "))
            else
                ""
            end) +
            "\n内容: " + (.content | .[0:100]) +
            (if (.content | length) > 100 then "..." else "" end) +
            "\n"
        ' ${MEMO_DIR}/decisions.json 2>/dev/null || echo "暂无数据"
    else
        echo "暂无数据"
    fi
    echo ""
}

# 显示统计信息
show_stats() {
    echo -e "${BLUE}📊 记忆系统统计${NC}"
    echo "────────────────────────────────────────────"

    # 计算目录大小
    if [ -d "$MEMO_DIR" ]; then
        local size=$(du -sh $MEMO_DIR 2>/dev/null | cut -f1)
        local files=$(find $MEMO_DIR -type f 2>/dev/null | wc -l | tr -d ' ')
        echo -e "${GREEN}存储大小${NC}: ${size}"
        echo -e "${GREEN}文件数量${NC}: ${files}"
        echo ""
    fi

    # 统计各类数据
    echo -e "${CYAN}数据统计:${NC}"

    if [ -f "${MEMO_DIR}/sessions.json" ]; then
        local exec_count=$(jq '.sessions | length' ${MEMO_DIR}/sessions.json 2>/dev/null || echo "0")
        echo -e "执行会话: ${exec_count}"
    fi

    if [ -f "${MEMO_DIR}/errors.json" ]; then
        local error_count=$(jq '.errors | length' ${MEMO_DIR}/errors.json 2>/dev/null || echo "0")
        echo -e "错误记录: ${error_count}"
    fi

    if [ -f "${MEMO_DIR}/decisions.json" ]; then
        local decision_count=$(jq '.decisions | length' ${MEMO_DIR}/decisions.json 2>/dev/null || echo "0")
        echo -e "决策记录: ${decision_count}"
    fi

    if [ -f "${MEMO_DIR}/reasoning.json" ]; then
        local reasoning_count=$(jq '.chains | length' ${MEMO_DIR}/reasoning.json 2>/dev/null || echo "0")
        echo -e "推理链: ${reasoning_count}"
    fi

    echo ""
}

# 显示所有概览
show_all() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           记忆系统概览                                      ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    show_stats
    show_history 2
    show_errors 2
    show_sessions 2
    show_reasoning 2
    show_decisions 3
}

# 主逻辑
check_jq

case "${1:-}" in
    "history")
        show_history "${2:-3}"
        ;;
    "errors")
        show_errors "${2:-3}"
        ;;
    "preferences")
        show_preferences
        ;;
    "sessions")
        show_sessions "${2:-3}"
        ;;
    "reasoning")
        show_reasoning "${2:-3}"
        ;;
    "decisions")
        show_decisions "${2:-5}"
        ;;
    "stats")
        show_stats
        ;;
    "all")
        show_all
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        echo "未知命令: ${1}"
        echo ""
        show_help
        exit 1
        ;;
esac
