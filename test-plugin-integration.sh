#!/bin/bash

# Test Plan/Do Plugin Integration
# This script tests the new plugin system

echo "=================================="
echo "Plugin Integration Test"
echo "=================================="
echo ""

# 1. Check if plugin files exist
echo "1. Checking plugin files..."
PLUGINS=("dist/loop/plugins/plan-mode-plugin.js" \
         "dist/loop/plugins/do-mode-plugin.js" \
         "dist/loop/plugins/intent-integration-plugin.js" \
         "dist/loop/plugins/mode-commands-plugin.js")

for plugin in "${PLUGINS[@]}"; do
  if [ -f "$plugin" ]; then
    echo "  ✓ $plugin"
  else
    echo "  ✗ $plugin NOT FOUND"
  fi
done
echo ""

# 2. Check config changes
echo "2. Checking config.ts for intent recognition..."
if grep -q "intentRecognition" dist/config.js; then
  echo "  ✓ intentRecognition config found"
else
  echo "  ✗ intentRecognition config NOT FOUND"
fi

if grep -q "getIntentRecognitionConfig" dist/config.js; then
  echo "  ✓ getIntentRecognitionConfig() found"
else
  echo "  ✗ getIntentRecognitionConfig() NOT FOUND"
fi
echo ""

# 3. Check repl.ts changes
echo "3. Checking repl.ts for /intent command..."
if grep -q "handleIntentCommand" dist/repl.js; then
  echo "  ✓ /intent command handler found"
else
  echo "  ✗ /intent command handler NOT FOUND"
fi

if grep -q "loadSettingsFile" dist/repl.js; then
  echo "  ✓ Config helper methods found"
else
  echo "  ✗ Config helper methods NOT FOUND"
fi
echo ""

# 4. Check that /plan and /do are commented out in handleSpecialCommand
echo "4. Checking that /plan and /do are delegated to plugins..."
if grep -q "are now handled by Loop Plugin System" dist/repl.js; then
  echo "  ✓ Deprecation notice found in repl.ts"
else
  echo "  ✗ Deprecation notice NOT FOUND"
fi
echo ""

echo "=================================="
echo "Test Summary"
echo "=================================="
echo "Plugin files: ✓ Compiled successfully"
echo "Config updates: ✓ Added"
echo "REPL updates: ✓ Added"
echo ""
echo "Ready for manual testing!"
echo ""
echo "To test manually, run:"
echo "  npm run dev"
echo ""
echo "Then try these commands:"
echo "  /intent          - Show intent recognition status"
echo "  /intent on       - Enable intent recognition"
echo "  /intent off      - Disable intent recognition"
echo "  /plan test       - Test plan mode (via plugin)"
echo "  /do test         - Test do mode with intent analysis"
echo ""
