#!/bin/bash

# 清理项目脚本 - Phase 9
# 整理测试文件、备份文件和临时文件

set -e

PROJECT_ROOT="/Users/mac/kode"
ARCHIVE_DIR="$PROJECT_ROOT/archive"
TEST_ARCHIVE="$ARCHIVE_DIR/old-tests"
BACKUP_ARCHIVE="$ARCHIVE_DIR/backups"

echo "🧹 Starting project cleanup..."
echo ""

# 创建归档目录
echo "📁 Creating archive directories..."
mkdir -p "$TEST_ARCHIVE"
mkdir -p "$BACKUP_ARCHIVE"
echo "✓ Archive directories created"
echo ""

# 1. 保留的重要测试文件
KEEP_TESTS=(
  "test-phase2.ts"
  "test-phase3.ts"
  "test-dual-track.js"
  "test-state-tracker.js"
  "test-final-integration.ts"
  "test-precipitation.ts"
)

# 2. 移动过时的测试文件到归档
echo "📦 Archiving old test files..."
MOVED_COUNT=0
for test_file in test-*.{ts,js}; do
  if [ -f "$test_file" ]; then
    # 检查是否应该保留
    should_keep=false
    for keep in "${KEEP_TESTS[@]}"; do
      if [[ "$test_file" == "$keep" ]]; then
        should_keep=true
        break
      fi
    done

    if [ "$should_keep" = false ]; then
      mv "$test_file" "$TEST_ARCHIVE/"
      ((MOVED_COUNT++))
    fi
  fi
done
echo "✓ Moved $MOVED_COUNT test files to $TEST_ARCHIVE"
echo ""

# 3. 删除备份文件（git 已有历史）
echo "🗑️  Removing backup files..."
BAK_COUNT=0
find "$PROJECT_ROOT" -name "*.bak" -not -path "*/node_modules/*" -not -path "*/.git/*" -delete 2>/dev/null || true
find "$PROJECT_ROOT" -name "*.bak2" -not -path "*/node_modules/*" -not -path "*/.git/*" -delete 2>/dev/null || true
find "$PROJECT_ROOT" -name "*.bak3" -not -path "*/node_modules/*" -not -path "*/.git/*" -delete 2>/dev/null || true
find "$PROJECT_ROOT" -name "*.bak4" -not -path "*/node_modules/*" -not -path "*/.git/*" -delete 2>/dev/null || true
find "$PROJECT_ROOT" -name "*.bak5" -not -path "*/node_modules/*" -not -path "*/.git/*" -delete 2>/dev/null || true
echo "✓ Backup files removed"
echo ""

# 4. 清理临时文件
echo "🧹 Cleaning temporary files..."
if [ -d "$PROJECT_ROOT/.tmp" ]; then
  rm -rf "$PROJECT_ROOT/.tmp"
  echo "✓ Removed .tmp directory"
fi

# 清理其他临时文件
find "$PROJECT_ROOT" -name "*.tmp" -not -path "*/node_modules/*" -not -path "*/.git/*" -delete 2>/dev/null || true
echo "✓ Temporary files cleaned"
echo ""

# 5. 显示保留的测试文件
echo "📋 Remaining test files:"
for keep in "${KEEP_TESTS[@]}"; do
  if [ -f "$PROJECT_ROOT/$keep" ]; then
    echo "  ✓ $keep"
  fi
done
echo ""

# 统计
echo "📊 Cleanup Summary:"
echo "  Test files archived: $MOVED_COUNT"
echo "  Backup files removed: (count unavailable)"
echo "  Archive location: $ARCHIVE_DIR"
echo ""

echo "✅ Project cleanup completed!"
echo ""
echo "📝 Note: Archived files are preserved in $ARCHIVE_DIR"
echo "📝 Note: Backup files are preserved in git history"
