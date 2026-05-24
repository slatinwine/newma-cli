#!/bin/bash

echo "============================================================"
echo "🚀 Testing Skills-Creator Improvements"
echo "============================================================"

# Test 1: Check template files exist
echo ""
echo "🧪 Test 1: Template Files"
echo ""

templates=("basic" "transformer" "analyzer" "integrator" "custom")
all_exist=true

for template in "${templates[@]}"; do
  if [ -f "src/skills-creator/templates/${template}.ts" ]; then
    size=$(wc -c < "src/skills-creator/templates/${template}.ts")
    echo "  ✅ ${template}.ts exists (${size} bytes)"
  else
    echo "  ❌ ${template}.ts missing"
    all_exist=false
  fi
done

if [ "$all_exist" = true ]; then
  echo ""
  echo "✅ All template files exist!"
else
  echo ""
  echo "❌ Some template files missing"
  exit 1
fi

# Test 2: Check TypeScript compilation
echo ""
echo "🧪 Test 2: TypeScript Compilation"
echo ""

if npm run build > /tmp/build.log 2>&1; then
  echo "  ✅ Build successful"
  echo ""
  echo "✅ TypeScript compilation passed!"
else
  echo "  ❌ Build failed"
  cat /tmp/build.log
  echo ""
  echo "❌ TypeScript compilation failed"
  exit 1
fi

# Test 3: Check for resource generation methods
echo ""
echo "🧪 Test 3: Resource Generation Methods"
echo ""

methods=("generateExampleScript" "generateApiReference" "generateAssetPlaceholder")
all_found=true

for method in "${methods[@]}"; do
  if grep -q "$method" src/skills-creator/generator.ts; then
    echo "  ✅ $method found"
  else
    echo "  ❌ $method missing"
    all_found=false
  fi
done

if [ "$all_found" = true ]; then
  echo ""
  echo "✅ All resource generation methods found!"
else
  echo ""
  echo "❌ Some methods missing"
  exit 1
fi

# Test 4: Check CLI command
echo ""
echo "🧪 Test 4: CLI validate-plugin Command"
echo ""

if grep -q "validate-plugin" src/cli.ts; then
  echo "  ✅ validate-plugin command found in CLI"
  echo ""
  echo "✅ CLI command test passed!"
else
  echo "  ❌ validate-plugin command not found"
  echo ""
  echo "❌ CLI command test failed"
  exit 1
fi

# Test 5: Check interactive prompt improvements
echo ""
echo "🧪 Test 5: Interactive Prompt Descriptions"
echo ""

descriptions=(
  "basic - Simple utility plugin"
  "transformer - Data transformation"
  "analyzer - Code analysis"
  "integrator - Third-party API"
)
all_found=true

for desc in "${descriptions[@]}"; do
  if grep -q "$desc" src/skills-creator/index.ts; then
    echo "  ✅ Found: \"$desc\""
  else
    echo "  ❌ Missing: \"$desc\""
    all_found=false
  fi
done

if [ "$all_found" = true ]; then
  echo ""
  echo "✅ All template descriptions found!"
else
  echo ""
  echo "❌ Some descriptions missing"
  exit 1
fi

# Summary
echo ""
echo "============================================================"
echo "📊 Test Results Summary"
echo "============================================================"
echo ""
echo "✅ Test 1: Template Files - PASS"
echo "✅ Test 2: TypeScript Compilation - PASS"
echo "✅ Test 3: Resource Generation Methods - PASS"
echo "✅ Test 4: CLI Command - PASS"
echo "✅ Test 5: Interactive Prompts - PASS"
echo ""
echo "Total: 5/5 tests passed"
echo ""
echo "🎉 All tests passed!"
echo ""
