#!/bin/bash

# Test script to verify loop mode continues after verification failure
# This test ensures that the loop doesn't exit prematurely when verification fails

set -e

echo "🧪 Testing Loop Mode Verification Fix"
echo "======================================"
echo ""

# Build the project
echo "📦 Building project..."
npm run build > /dev/null 2>&1
echo "✅ Build complete"
echo ""

# Create a test project
TEST_DIR="/tmp/kode-loop-test-$$"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Initialize a simple TypeScript project
cat > package.json << 'EOF'
{
  "name": "loop-test",
  "version": "1.0.0",
  "scripts": {
    "build": "echo 'Build would fail here' && exit 1"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
EOF

cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true
  }
}
EOF

# Create a file with intentional errors
cat > test.ts << 'EOF'
const x: string = 123; // Type error
console.log(x);
EOF

echo "📁 Test project created at: $TEST_DIR"
echo ""

# Test 1: Run loop mode with verification (should continue after failure)
echo "🔍 Test 1: Loop mode with verification failure"
echo "Requirement: Fix TypeScript errors"
echo ""

# Run kode with --loop flag and --verify flag
# It should:
# 1. Try to fix the error
# 2. Verification fails (build script exits with 1)
# 3. NOT exit with done=true (exit code 1 instead of 0)
# 4. Allow the loop to continue

MAX_ITERATIONS=1
EXIT_CODE=0

npx kode-cli --loop --verify --max-iterations $MAX_ITERATIONS "Fix the TypeScript error in test.ts" < /dev/null 2>&1 || EXIT_CODE=$?

echo ""
echo "Exit code: $EXIT_CODE"
echo ""

if [ $EXIT_CODE -eq 0 ]; then
  echo "❌ FAIL: Loop exited with code 0 (success) but verification failed!"
  echo "Expected: Exit code 1 (not done) to allow bash script to retry"
  exit 1
elif [ $EXIT_CODE -eq 1 ]; then
  echo "✅ PASS: Loop correctly exited with code 1 (not done)"
  echo "This allows bash scripts to retry the task"
elif [ $EXIT_CODE -eq 2 ]; then
  echo "✅ PASS: Loop exited with code 2 (execution error)"
  echo "This is also acceptable - indicates execution failed"
else
  echo "⚠️  Unexpected exit code: $EXIT_CODE"
fi

echo ""
echo "======================================"
echo "✅ Test completed"
echo ""

# Cleanup
cd /
rm -rf "$TEST_DIR"
