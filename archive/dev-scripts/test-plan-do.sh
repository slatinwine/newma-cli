#!/bin/bash
# Test /plan and /do commands with SubAgent mode

echo "🧪 Testing /plan and /do commands"
echo "=================================="
echo ""

# Build first
echo "📦 Building..."
npm run build > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi
echo "✅ Build successful"
echo ""

# Test 1: Test /plan command with SubAgent mode
echo "🧪 Test 1: /plan command with SubAgent mode"
echo "--------------------------------------------"
echo "/plan list all TypeScript files" | npx ts-node src/cli.ts -i --execution-mode=subagent 2>&1 | head -50
echo ""

echo "✅ Test 1 completed"
echo ""

# Test 2: Test /do command (same as /plan)
echo "🧪 Test 2: /do command with SubAgent mode"
echo "------------------------------------------"
echo "/do list all TypeScript files" | npx ts-node src/cli.ts -i --execution-mode=subagent 2>&1 | head -50
echo ""

echo "✅ Test 2 completed"
echo ""

echo "🎉 All tests completed!"
