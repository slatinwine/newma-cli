#!/bin/bash

echo "🧪 HTTP Event Source Manual Test"
echo "═".repeat(50)
echo ""
echo "Starting HTTP server on port 3456..."
echo "Server will run for 30 seconds."
echo ""
echo "Open another terminal and run:"
echo ""
echo "  curl -X POST http://localhost:3456/test \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"message\": \"Hello!\"}'"
echo ""
echo "Or test with:"
echo "  curl http://localhost:3456/api/status"
echo ""
echo "Press Ctrl+C to stop early"
echo ""
echo "═".repeat(50)
echo ""

npx ts-node test-event-sources-simple.ts 2
