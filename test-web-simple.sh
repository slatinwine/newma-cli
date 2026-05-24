#!/bin/bash

# Simple test for Web mode
echo "🧪 Testing Web Mode - Simple Test"
echo "=================================="
echo ""

# Start web server in background
echo "1️⃣ Starting web server..."
node dist/cli.js --web --web-port 3000 > /tmp/web-server.log 2>&1 &
WEB_PID=$!

echo "   PID: $WEB_PID"
echo ""

# Wait for server to start
echo "2️⃣ Waiting for server to initialize..."
sleep 3

echo "   ✅ Server should be ready"
echo ""

# Test health endpoint
echo "3️⃣ Testing /health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:3000/health)
echo "   Response: $HEALTH_RESPONSE"

if echo "$HEALTH_RESPONSE" | grep -q '"status".*"ok"'; then
  echo "   ✅ Health check passed"
else
  echo "   ❌ Health check failed"
fi
echo ""

# Test status endpoint
echo "4️⃣ Testing /api/status endpoint..."
STATUS_RESPONSE=$(curl -s http://localhost:3000/api/status)
echo "   Response received (length: ${#STATUS_RESPONSE} bytes)"

if echo "$STATUS_RESPONSE" | grep -q '"status".*"running"'; then
  echo "   ✅ Status check passed"
else
  echo "   ❌ Status check failed"
fi
echo ""

# Cleanup
echo "5️⃣ Cleaning up..."
kill $WEB_PID 2>/dev/null
echo "   ✅ Server stopped"
echo ""

echo "✅ All tests completed!"
echo ""
echo "📝 Server log (if any errors):"
cat /tmp/web-server.log 2>/dev/null | head -20
