#!/bin/bash
echo "=== Newma 完整测试 ==="
echo "任务: 生成 BST 实现（Java）"
echo ""

# 使用 yes 命令自动回答所有 y/n 确认
yes | npm run dev "生成一个简单的二叉搜索树 BST 实现，使用 Java" 2>&1 | tee /tmp/newma-test-output.txt

echo ""
echo "=== 测试完成 ==="
echo "输出已保存到: /tmp/newma-test-output.txt"
