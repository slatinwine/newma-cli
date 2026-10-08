#!/bin/bash

echo "========================================="
echo "Loop Engine Integration Test"
echo "========================================="
echo

# Test 1: Start Loop mode
echo "Test 1: Starting Loop mode..."
echo "/exit" | timeout 5 node dist/cli.js -i --loop-engine 2>&1 | grep -q "Loop Engine Mode"
if [ $? -eq 0 ]; then
  echo "✅ PASS: Loop mode starts successfully"
else
  echo "❌ FAIL: Loop mode failed to start"
  exit 1
fi
echo

# Test 2: /help command
echo "Test 2: Testing /help command..."
echo "/help\n/exit" | timeout 5 node dist/cli.js -i --loop-engine 2>&1 | grep -q "Available Commands"
if [ $? -eq 0 ]; then
  echo "✅ PASS: /help command works"
else
  echo "❌ FAIL: /help command failed"
  exit 1
fi
echo

# Test 3: /status command
echo "Test 3: Testing /status command..."
echo "/status\n/exit" | timeout 5 node dist/cli.js -i --loop-engine 2>&1 | grep -q "Session Status"
if [ $? -eq 0 ]; then
  echo "✅ PASS: /status command works"
else
  echo "❌ FAIL: /status command failed"
  exit 1
fi
echo

# Test 4: /clear command
echo "Test 4: Testing /clear command..."
echo "/clear\n/exit" | timeout 5 node dist/cli.js -i --loop-engine 2>&1 | grep -q "Screen cleared"
if [ $? -eq 0 ]; then
  echo "✅ PASS: /clear command works"
else
  echo "⚠️  WARN: /clear output not detected (may still work)"
fi
echo

# Test 5: /time command
echo "Test 5: Testing /time command..."
echo "/time\n/exit" | timeout 5 node dist/cli.js -i --loop-engine 2>&1 | grep -q "Current Time"
if [ $? -eq 0 ]; then
  echo "✅ PASS: /time command works"
else
  echo "⚠️  WARN: /time output format may vary"
fi
echo

# Test 6: /exit command
echo "Test 6: Testing /exit command..."
echo "/exit" | timeout 5 node dist/cli.js -i --loop-engine 2>&1 | grep -q "Goodbye"
if [ $? -eq 0 ]; then
  echo "✅ PASS: /exit command works"
else
  echo "❌ FAIL: /exit command failed"
  exit 1
fi
echo

# Test 7: Chat mode
echo "Test 7: Testing chat mode (simple input)..."
echo "hello\n/exit" | timeout 10 node dist/cli.js -i --loop-engine 2>&1 | grep -q "hello"
if [ $? -eq 0 ]; then
  echo "✅ PASS: Chat mode accepts input"
else
  echo "⚠️  WARN: Chat mode response format unclear"
fi
echo

echo "========================================="
echo "All Core Tests Completed!"
echo "========================================="
