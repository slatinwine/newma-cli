#!/bin/bash
# Quick verification script for tab completion fix

echo "🔧 Rebuilding with tab completion fix..."
npm run build > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ Build successful"
  echo ""
  echo "📋 Testing tab completion in REPL..."
  echo "   Run this command and test tab completion manually:"
  echo ""
  echo "   $ node dist/cli.js -i"
  echo ""
  echo "   Then type '/h' and press Tab"
  echo "   You should see: /help  /history  /hooks"
  echo ""
  echo "   Press Ctrl+C to exit"
  echo ""
else
  echo "❌ Build failed"
  exit 1
fi
