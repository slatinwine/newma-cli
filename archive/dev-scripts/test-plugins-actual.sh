#!/bin/bash

# 实际测试插件系统
# 这个脚本会编译并验证插件功能

echo "=================================="
echo "🧪 Plugin System Actual Test"
echo "=================================="
echo ""

# 1. 清理并重新编译
echo "1️⃣  Cleaning and rebuilding..."
rm -rf dist/
npm run build 2>&1 | grep -E "(error|✓|success)" || echo "Build completed"
echo ""

# 2. 检查插件文件
echo "2️⃣  Checking plugin files..."
PLUGINS=(
  "dist/loop/plugins/plan-mode-plugin.js"
  "dist/loop/plugins/do-mode-plugin.js"
  "dist/loop/plugins/intent-integration-plugin.js"
  "dist/loop/plugins/mode-commands-plugin.js"
)

ALL_EXIST=true
for plugin in "${PLUGINS[@]}"; do
  if [ -f "$plugin" ]; then
    SIZE=$(du -h "$plugin" | cut -f1)
    echo "  ✓ $plugin ($SIZE)"
  else
    echo "  ✗ $plugin MISSING"
    ALL_EXIST=false
  fi
done
echo ""

# 3. 验证插件代码
echo "3️⃣  Verifying plugin code structure..."

# 检查 Plan Mode Plugin
if grep -q "class PlanModePlugin" dist/loop/plugins/plan-mode-plugin.js; then
  echo "  ✓ PlanModePlugin class found"
else
  echo "  ✗ PlanModePlugin class NOT FOUND"
fi

if grep -q "isValidTaskRequirement" dist/loop/plugins/plan-mode-plugin.js; then
  echo "  ✓ Validation method found"
else
  echo "  ✗ Validation method NOT FOUND"
fi

# 检查 Do Mode Plugin
if grep -q "class DoModePlugin" dist/loop/plugins/do-mode-plugin.js; then
  echo "  ✓ DoModePlugin class found"
else
  echo "  ✗ DoModePlugin class NOT FOUND"
fi

if grep -q "IntentRecognizer" dist/loop/plugins/do-mode-plugin.js; then
  echo "  ✓ Intent recognition integration found"
else
  echo "  ✗ Intent recognition NOT FOUND"
fi

# 检查 Intent Recognition Plugin
if grep -q "class IntentRecognitionPlugin" dist/loop/plugins/intent-integration-plugin.js; then
  echo "  ✓ IntentRecognitionPlugin class found"
else
  echo "  ✗ IntentRecognitionPlugin class NOT FOUND"
fi

if grep -q "onBeforeInput" dist/loop/plugins/intent-integration-plugin.js; then
  echo "  ✓ Hook method found"
else
  echo "  ✗ Hook method NOT FOUND"
fi
echo ""

# 4. 检查配置集成
echo "4️⃣  Checking config integration..."
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

# 5. 检查 REPL 集成
echo "5️⃣  Checking REPL integration..."
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

if grep -q "are now handled by Loop Plugin System" dist/repl.js; then
  echo "  ✓ Deprecation notice found"
else
  echo "  ✗ Deprecation notice NOT FOUND"
fi
echo ""

# 6. 导出检查
echo "6️⃣  Checking exports..."
if grep -q "exports.PlanModePlugin" dist/loop/plugins/plan-mode-plugin.js; then
  echo "  ✓ PlanModePlugin exported"
else
  echo "  ✗ PlanModePlugin NOT EXPORTED"
fi

if grep -q "exports.DoModePlugin" dist/loop/plugins/do-mode-plugin.js; then
  echo "  ✓ DoModePlugin exported"
else
  echo "  ✗ DoModePlugin NOT EXPORTED"
fi

if grep -q "exports.IntentRecognitionPlugin" dist/loop/plugins/intent-integration-plugin.js; then
  echo "  ✓ IntentRecognitionPlugin exported"
else
  echo "  ✗ IntentRecognitionPlugin NOT EXPORTED"
fi
echo ""

# 7. 统计代码行数
echo "7️⃣  Code statistics..."
echo "  Source files:"
wc -l src/loop/plugins/plan-mode-plugin.ts 2>/dev/null | awk '{print "    plan-mode-plugin.ts: " $1 " lines"}'
wc -l src/loop/plugins/do-mode-plugin.ts 2>/dev/null | awk '{print "    do-mode-plugin.ts: " $1 " lines"}'
wc -l src/loop/plugins/intent-integration-plugin.ts 2>/dev/null | awk '{print "    intent-integration-plugin.ts: " $1 " lines"}'
echo ""

echo "  Compiled files:"
wc -l dist/loop/plugins/plan-mode-plugin.js 2>/dev/null | awk '{print "    plan-mode-plugin.js: " $1 " lines"}'
wc -l dist/loop/plugins/do-mode-plugin.js 2>/dev/null | awk '{print "    do-mode-plugin.js: " $1 " lines"}'
wc -l dist/loop/plugins/intent-integration-plugin.js 2>/dev/null | awk '{print "    intent-integration-plugin.js: " $1 " lines"}'
echo ""

# 8. 总结
echo "=================================="
echo "📊 Test Summary"
echo "=================================="

if [ "$ALL_EXIST" = true ]; then
  echo "✅ All plugin files compiled successfully"
else
  echo "❌ Some plugin files are missing"
fi

echo ""
echo "📁 Created files:"
echo "  • dist/loop/plugins/plan-mode-plugin.js"
echo "  • dist/loop/plugins/do-mode-plugin.js"
echo "  • dist/loop/plugins/intent-integration-plugin.js"
echo "  • dist/loop/plugins/mode-commands-plugin.js (updated)"
echo ""
echo "📝 Documentation:"
echo "  • TESTING_COMPLETE.md"
echo "  • PLAN_DO_EXTRACTION_SUMMARY.md"
echo "  • PLUGIN_TESTING_GUIDE.md"
echo "  • PLUGIN_TEST_RESULTS.md"
echo "  • settings.intent-example.json"
echo ""

echo "🚀 Ready for manual testing!"
echo ""
echo "To start the REPL:"
echo "  npm run dev"
echo ""
echo "Then try:"
echo "  /intent          # Show intent recognition status"
echo "  /intent on       # Enable intent recognition"
echo "  /plan test       # Test plan mode"
echo "  /do test         # Test do mode with intent analysis"
echo ""
