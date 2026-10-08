#!/bin/bash

echo "=== 测试 1: 默认模式（单次执行）==="
node dist/cli.js "创建一个名为 test-loop.txt 的文件，内容是 hello world" 2>&1 | head -50

echo ""
echo "=== 测试完成 ==="
