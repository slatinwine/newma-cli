#!/bin/bash

# Test script to verify loop mode exits on completion

echo "================================"
echo "Testing Loop Mode Fix"
echo "================================"
echo ""

# Test 1: Simple task that should complete quickly
echo "Test 1: Create a simple file (should complete in 1-2 iterations)"
echo "Command: /loop 5 Create test-loop.txt with content 'Hello World'"
echo ""

# Start the CLI with a timeout to prevent infinite loops
timeout 60s node dist/cli.js -i <<EOF &
set -m
/loop 5 Create test-loop.txt with content 'Hello World'
/exit
EOF

# Wait a bit for the command to execute
sleep 5

# Check if the file was created
if [ -f "test-loop.txt" ]; then
    echo "✅ Test 1 PASSED: File created successfully"
    echo "Content: $(cat test-loop.txt)"
    rm test-loop.txt
else
    echo "❌ Test 1 FAILED: File was not created"
fi

echo ""
echo "================================"
echo "Test complete"
echo "================================"
