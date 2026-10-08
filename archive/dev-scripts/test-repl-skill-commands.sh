#!/bin/bash
# Test REPL Skill Commands

echo "🧪 Testing REPL Skill Commands"
echo "================================"
echo ""

# Test 1: skill-list
echo "Test 1: /skill-list command"
echo "Command: /skill-list"
echo ""

echo "/skill-list
/exit" | (cd /Users/mac/kode && npx ts-node src/cli.ts -i) 2>&1 | grep -A 50 "📋 Installed Skills" || {
    echo "❌ Test 1 FAILED: /skill-list command didn't work"
    exit 1
}

echo ""
echo "✅ Test 1 PASSED"
echo ""

# Test 2: skill-info
echo "Test 2: /skill-info command"
echo "Command: /skill-info ai-test-skill"
echo ""

echo "/skill-info ai-test-skill
/exit" | (cd /Users/mac/kode && npx ts-node src/cli.ts -i) 2>&1 | grep -A 20 "📋 ai-test-skill" || {
    echo "❌ Test 2 FAILED: /skill-info command didn't work"
    exit 1
}

echo ""
echo "✅ Test 2 PASSED"
echo ""

# Test 3: skill-search
echo "Test 3: /skill-search command"
echo "Command: /skill-search test"
echo ""

echo "/skill-search test
/exit" | (cd /Users/mac/kode && npx ts-node src/cli.ts -i) 2>&1 | grep -A 20 "🔍 Search Results" || {
    echo "❌ Test 3 FAILED: /skill-search command didn't work"
    exit 1
}

echo ""
echo "✅ Test 3 PASSED"
echo ""

# Test 4: skill-install help
echo "Test 4: /skill-install (no args - should show usage)"
echo ""

echo "/skill-install
/exit" | (cd /Users/mac/kode && npx ts-node src/cli.ts -i) 2>&1 | grep "Usage: /skill-install" || {
    echo "❌ Test 4 FAILED: /skill-install usage didn't show"
    exit 1
}

echo ""
echo "✅ Test 4 PASSED"
echo ""

# Test 5: skill-uninstall help
echo "Test 5: /skill-uninstall (no args - should show usage)"
echo ""

echo "/skill-uninstall
/exit" | (cd /Users/mac/kode && npx ts-node src/cli.ts -i) 2>&1 | grep "Usage: /skill-uninstall" || {
    echo "❌ Test 5 FAILED: /skill-uninstall usage didn't show"
    exit 1
}

echo ""
echo "✅ Test 5 PASSED"
echo ""

echo "================================"
echo "🎉 All tests passed!"
echo ""
