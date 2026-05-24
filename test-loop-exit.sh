#!/bin/bash

# Test script to verify loop mode can exit via validation
# This creates a simple task that should complete in 1-2 iterations

echo "=== Testing Loop Mode Auto-Exit ==="
echo ""
echo "Test: Create a simple README.md file"
echo "Expected: Loop should exit after 2 iterations (plan + verify)"
echo ""

# Create a temporary test directory
TEST_DIR="/tmp/kode-loop-test-$$"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "Test directory: $TEST_DIR"
echo ""

# Initialize a minimal project
echo "# Test Project" > README.md
echo "console.log('hello');" > test.js

echo "Running: npx kode-cli loop 5 'add a hello world function to test.js'"
echo ""

# Run the loop command with max 5 iterations
npx kode-cli -c "/loop 5 'add a hello world function named greet that returns a greeting message to test.js'" 2>&1 | tee /tmp/kode-test-output.txt

# Check if the loop exited successfully
if grep -q "Requirement satisfied" /tmp/kode-test-output.txt || grep -q "✅ Task completed" /tmp/kode-test-output.txt; then
    echo ""
    echo "✅ TEST PASSED: Loop exited successfully via validation"
    exit 0
else
    echo ""
    echo "❌ TEST FAILED: Loop did not exit via validation"
    echo "Output saved to: /tmp/kode-test-output.txt"
    exit 1
fi
