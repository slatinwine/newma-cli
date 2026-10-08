#!/bin/bash

# Simple test for two-phase system
echo "🧪 Testing Two-Phase Agent System"
echo "════════════════════════════════════════════════════════════"
echo ""

# Test: Simple creation task
echo "📝 Test: Create a simple test file"
echo ""

npx kode-cli --two-phase "Create a file called test.txt with content 'Hello, Two-Phase System!' in the project root directory" 2>&1 | tee test-output.log

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Test completed. Check test-output.log for results"
echo ""

# Cleanup
if [ -f "test.txt" ]; then
  echo "🧹 Removing test file..."
  rm test.txt
  echo "✅ Cleanup done"
fi
