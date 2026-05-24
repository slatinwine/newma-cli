#!/bin/bash

echo "=========================================="
echo "  REPL Functionality Test"
echo "=========================================="
echo ""

# Test 1: REPL can start
echo "Test 1: REPL startup"
echo "────────────────────────────────────"
echo "" | timeout 3 node dist/cli.js -i 2>&1 | head -20

echo ""
echo ""
echo "Test 2: /set executionMode two-phase (should show deprecation)"
echo "────────────────────────────────────"
echo "/set executionMode two-phase
/exit
" | timeout 5 node dist/cli.js -i 2>&1 | grep -A 5 "executionMode"

echo ""
echo ""
echo "Test 3: /set executionMode multi-agent (should show deprecation)"
echo "────────────────────────────────────"
echo "/set executionMode multi-agent
/exit
" | timeout 5 node dist/cli.js -i 2>&1 | grep -A 5 "executionMode"

echo ""
echo ""
echo "Test 4: /help command"
echo "────────────────────────────────────"
echo "/help
/exit
" | timeout 5 node dist/cli.js -i 2>&1 | head -30

echo ""
echo "=========================================="
echo "  REPL Test Complete"
echo "=========================================="
