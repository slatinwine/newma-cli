#!/bin/bash

echo "=========================================="
echo "Testing TUI Mode Startup"
echo "=========================================="
echo ""

# Test 1: Help (should work without TUI)
echo "Test 1: Check --tui flag is available"
node dist/cli.js --help | grep -q "tui"
if [ $? -eq 0 ]; then
  echo "✓ --tui flag is available"
else
  echo "✗ --tui flag not found"
fi
echo ""

# Test 2: Compile check
echo "Test 2: Verify TUI files compiled"
if [ -f "dist/loop/frontends/tui-frontend.js" ]; then
  echo "✓ tui-frontend.js compiled"
else
  echo "✗ tui-frontend.js not found"
fi

if [ -f "dist/repl-tui.js" ]; then
  echo "✓ repl-tui.js compiled"
else
  echo "✗ repl-tui.js not found"
fi
echo ""

# Test 3: Import check
echo "Test 3: Check TUI module imports"
node -e "
try {
  const { TuiREPLManager } = require('./dist/repl-tui');
  const { TuiFrontend } = require('./dist/loop/frontends/tui-frontend');
  console.log('✓ TUI modules imported successfully');
  process.exit(0);
} catch (error) {
  console.log('✗ TUI module import failed:', error.message);
  process.exit(1);
}
"
echo ""

echo "=========================================="
echo "All tests completed!"
echo "=========================================="
echo ""
echo "Note: Full TUI testing requires interactive terminal."
echo "To test TUI mode manually, run:"
echo "  node dist/cli.js -i --tui"
echo ""
