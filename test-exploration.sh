#!/bin/bash

echo "🚀 Newma 自主探索测试脚本"
echo "================================"
echo ""

# 检查环境变量
if [ -z "$OPENAI_API_KEY" ]; then
  echo "❌ 错误: OPENAI_API_KEY 环境变量未设置"
  echo ""
  echo "请先设置 API Key:"
  echo "  export OPENAI_API_KEY='your-api-key-here'"
  echo ""
  exit 1
fi

echo "✓ API Key 已配置"
echo ""

# 运行测试
npx ts-node test-exploration.ts

echo ""
echo "✅ 测试完成！"
echo ""
echo "📂 日志文件位置:"
echo "   ~/.kode/exploration-logs/"
echo ""
