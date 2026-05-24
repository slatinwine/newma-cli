#!/bin/bash
# Simple test for SubAgent system

echo "🧪 Testing SubAgent System Directly"
echo "===================================="
echo ""

# Build
echo "📦 Building..."
npm run build > /dev/null 2>&1

# Create a simple test file
cat > /tmp/test-subagent-input.txt << 'EOF'
/plan create a test file named hello.txt with content "Hello World"
/exit
EOF

# Run the test
echo "🧪 Running SubAgent test..."
echo ""
timeout 120 npx ts-node src/cli.ts -i --execution-mode=subagent < /tmp/test-subagent-input.txt 2>&1 | tee /tmp/test-output.txt | head -200

echo ""
echo "✅ Test completed"
echo ""

# Check for SubAgent markers
echo "🔍 Checking for SubAgent execution..."
if grep -q "🤖 SubAgent" /tmp/test-output.txt; then
  echo "✅ SubAgent mode detected"
else
  echo "❌ SubAgent mode NOT detected"
fi

if grep -q "Phase 1: Planning" /tmp/test-output.txt; then
  echo "✅ Phase 1 (Planning) executed"
else
  echo "❌ Phase 1 (Planning) NOT executed"
fi

if grep -q "Phase 2: Executing" /tmp/test-output.txt; then
  echo "✅ Phase 2 (Execution) executed"
else
  echo "❌ Phase 2 (Execution) NOT executed"
fi

# Cleanup
rm -f /tmp/test-subagent-input.txt /tmp/test-output.txt
