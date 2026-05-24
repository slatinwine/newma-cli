#!/bin/bash

# Test FFT planner fix for JSON parsing issue

echo "🧪 Testing FFT Planner Fix"
echo "========================================"
echo ""

# Run the CLI with the problematic requirement
# Using timeout to prevent hanging
timeout 30 node dist/cli.js -i <<EOF 2>&1 | head -100
/plan 写一个网站，实现 html 上传下载功能。前端 vue，后端 java
/exit
EOF

echo ""
echo "========================================"
echo "✅ Test completed"
