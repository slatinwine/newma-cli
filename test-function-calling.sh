#!/bin/bash

# Test Function Calling Mode with Performance Monitoring
echo "Testing Function Calling Mode..."
echo ""

# Create input commands
cat <<EOF | node dist/cli.js -i --use-tools
/do 写一个简单的测试文件test.txt，内容是"Hello World"
/exit
EOF

echo ""
echo "Test completed!"
