#!/bin/bash

# Test newma /plan command with Mario game scenario

echo "Testing newma /plan command..."
echo "================================"
echo ""

# Create a temporary file with the command
cat > /tmp/newma_test_input.txt << 'EOF'
/plan 搜索一下马里奥游戏，再生成一个马里奥游戏 单html应用
/status
/exit
EOF

# Run newma with the input
npx ts-node src/cli.ts -i < /tmp/newma_test_input.txt

echo ""
echo "================================"
echo "Test completed"
