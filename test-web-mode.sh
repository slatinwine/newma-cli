#!/bin/bash

# Test Web Mode
# This script tests the --web mode functionality

echo "🧪 Testing Web Mode"
echo "===================="
echo ""

# Build the project
echo "📦 Building project..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi

echo "✅ Build successful"
echo ""

# Start web server in background
echo "🚀 Starting web server on port 3000..."
node dist/cli.js --web --web-port 3000 &
WEB_PID=$!

# Wait for server to start
sleep 3

echo "✅ Web server started (PID: $WEB_PID)"
echo ""

# Test health endpoint
echo "🔍 Testing health endpoint..."
curl -s http://localhost:3000/health | jq .

echo ""

# Test execute endpoint
echo "🔧 Testing execute endpoint..."
curl -X POST http://localhost:3000/api/execute \
  -H "Content-Type: application/json" \
  -d '{"requirement":"Say hello","mode":"chat"}' | jq .

echo ""

# Test status endpoint
echo "📊 Testing status endpoint..."
curl -s http://localhost:3000/api/status | jq .

echo ""

# Stop server
echo "🛑 Stopping web server..."
kill $WEB_PID

echo "✅ Test completed"
