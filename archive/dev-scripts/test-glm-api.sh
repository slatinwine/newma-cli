#!/bin/bash

# Test GLM API directly

echo "=========================================="
echo "Testing GLM API Connection"
echo "=========================================="

# Load settings
API_KEY=$(jq -r '.openai.apiKey' ~/.kode/settings.json)
ENDPOINT=$(jq -r '.openai.endpoint' ~/.kode/settings.json)
MODEL=$(jq -r '.openai.model' ~/.kode/settings.json)

echo "API Key: ${API_KEY:0:10}..."
echo "Endpoint: $ENDPOINT"
echo "Model: $MODEL"
echo ""

# Test with simple request
echo "Sending test request..."
echo ""

RESPONSE=$(curl -s -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$MODEL\",
    \"messages\": [
      {
        \"role\": \"user\",
        \"content\": \"Say hello in JSON format: {\\\"message\\\": \\\"hello\\\"}\"
      }
    ]
  }" \
  --max-time 30)

echo "Response:"
echo "$RESPONSE"
echo ""

# Check if response is valid JSON
if echo "$RESPONSE" | jq empty 2>/dev/null; then
  echo "✓ Valid JSON response"
  echo ""
  echo "Parsed response:"
  echo "$RESPONSE" | jq .
else
  echo "✗ Invalid JSON response"
  echo ""
  echo "Raw response:"
  echo "$RESPONSE"
fi

echo ""
echo "=========================================="
echo "Test complete"
echo "=========================================="
