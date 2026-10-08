#!/bin/bash

# 简单的 loop 模式测试

echo "🧪 Testing Loop Mode - Simple Test"
echo "==================================="
echo ""

cd /Users/mac/kode

# 测试 1: 检查退出码
echo "Test 1: Exit code when creating a file"
node dist/cli.js "Create test.txt with 'Hello'" --max-iterations 1 --loop
EXIT_CODE=$?
echo "Exit code: $EXIT_CODE"
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Exit code correct (0)"
else
  echo "❌ Exit code incorrect (expected 0, got $EXIT_CODE)"
fi
echo ""

# 检查文件是否创建
if [ -f test.txt ]; then
  echo "✅ File created successfully"
  cat test.txt
  rm test.txt
else
  echo "❌ File not created"
fi
echo ""

echo "==================================="
echo "✨ Test completed!"
