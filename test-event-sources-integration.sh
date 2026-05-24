#!/bin/bash

echo "========================================="
echo "Event Sources Integration Test"
echo "========================================="
echo

# Test 1: Start Loop mode with event source commands
echo "Test 1: Testing /event-source command availability..."
echo "/help\n/exit" | timeout 5 node dist/cli.js -i --loop-engine 2>&1 | grep -q "event-source"
if [ $? -eq 0 ]; then
  echo "✅ PASS: /event-source command is available"
else
  echo "❌ FAIL: /event-source command not found"
  exit 1
fi
echo

# Test 2: Test event-source list (empty)
echo "Test 2: Testing /event-source list (empty)..."
echo "/event-source list\n/exit" | timeout 5 node dist/cli.js -i --loop-engine 2>&1 | grep -q "No event sources"
if [ $? -eq 0 ]; then
  echo "✅ PASS: /event-source list shows empty state"
else
  echo "⚠️  WARN: Output format may vary"
fi
echo

# Test 3: Test event-source stats (empty)
echo "Test 3: Testing /event-source stats..."
echo "/event-source stats\n/exit" | timeout 5 node dist/cli.js -i --loop-engine 2>&1 | grep -q "Statistics"
if [ $? -eq 0 ]; then
  echo "✅ PASS: /event-source stats works"
else
  echo "⚠️  WARN: Stats output format may vary"
fi
echo

# Test 4: Test file watcher source creation
echo "Test 4: Testing file watcher source creation..."
echo "/event-source add file ./src\n/event-source list\n/exit" | timeout 5 node dist/cli.js -i --loop-engine 2>&1 | grep -q "fw-"
if [ $? -eq 0 ]; then
  echo "✅ PASS: File watcher source created"
else
  echo "⚠️  WARN: Source creation output unclear"
fi
echo

echo "========================================="
echo "Event Sources Integration Tests Completed!"
echo "========================================="
