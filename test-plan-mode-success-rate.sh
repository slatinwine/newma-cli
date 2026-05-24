#!/bin/bash

# Plan Mode Success Rate Test
# Tests plan mode 10 times and calculates success rate

echo "======================================"
echo "  Plan Mode Success Rate Test"
echo "======================================"
echo ""

# Check if OPENAI_API_KEY is set
if [ -z "$OPENAI_API_KEY" ]; then
  echo "❌ Error: OPENAI_API_KEY environment variable not set"
  echo "Please set it with: export OPENAI_API_KEY='your-key'"
  exit 1
fi

# Test requirements
REQUIREMENTS=(
  "create a simple test file"
  "add TypeScript type checking"
  "implement a user login function"
  "setup ESLint configuration"
  "create a REST API endpoint"
  "add unit tests for utils"
  "setup project documentation"
  "implement error handling"
  "add logging to the application"
  "create a data validation module"
)

# Counters
TOTAL_TESTS=10
SUCCESS_COUNT=0
VALIDATION_FAIL=0
JSON_PARSE_FAIL=0
EMPTY_PLAN_FAIL=0
OTHER_FAIL=0

# Results array
declare -a RESULTS

echo "Testing $TOTAL_TESTS requirements..."
echo ""

for i in $(seq 1 $TOTAL_TESTS); do
  REQ="${REQUIREMENTS[$((i-1))]}"
  echo "Test $i/$TOTAL_TESTS: $REQ"
  echo "----------------------------------------"

  # Run plan mode and capture output
  OUTPUT=$(npx newma-cli --dir /tmp/test-plan-mode-$i "/plan $REQ" 2>&1)
  EXIT_CODE=$?

  # Analyze output
  if echo "$OUTPUT" | grep -q "⚡.*Plan generated\|✅.*generated\|Executing.*actions"; then
    echo "✅ SUCCESS: Plan generated"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    RESULTS[$((i-1))]="✅ PASS"
  elif echo "$OUTPUT" | grep -q "Schema Validation Failed\|Validation Failed"; then
    echo "⚠️  FAIL: Schema validation failed"
    VALIDATION_FAIL=$((VALIDATION_FAIL + 1))
    RESULTS[$((i-1))]="❌ VALIDATION"
  elif echo "$OUTPUT" | grep -q "JSON Parse Error\|Failed to parse JSON"; then
    echo "❌ FAIL: JSON parsing failed"
    JSON_PARSE_FAIL=$((JSON_PARSE_FAIL + 1))
    RESULTS[$((i-1))]="❌ JSON"
  elif echo "$OUTPUT" | grep -q "empty plan\|no actions\|todo.*0.*actions.*0"; then
    echo "❌ FAIL: Empty plan generated"
    EMPTY_PLAN_FAIL=$((EMPTY_PLAN_FAIL + 1))
    RESULTS[$((i-1))]="❌ EMPTY"
  else
    echo "❓ FAIL: Other error"
    OTHER_FAIL=$((OTHER_FAIL + 1))
    RESULTS[$((i-1))]="❌ OTHER"
  fi

  echo ""
  sleep 1
done

# Calculate success rate
SUCCESS_RATE=$(awk "BEGIN {printf \"%.1f\", ($SUCCESS_COUNT / $TOTAL_TESTS) * 100}")

# Print summary
echo "======================================"
echo "  Test Results Summary"
echo "======================================"
echo ""
echo "Total Tests: $TOTAL_TESTS"
echo ""
echo "Results Breakdown:"
echo "  ✅ Successful Plans: $SUCCESS_COUNT"
echo "  ❌ Validation Failures: $VALIDATION_FAIL"
echo "  ❌ JSON Parse Failures: $JSON_PARSE_FAIL"
echo "  ❌ Empty Plans: $EMPTY_PLAN_FAIL"
echo "  ❌ Other Failures: $OTHER_FAIL"
echo ""
echo "Success Rate: $SUCCESS_RATE%"
echo ""

# Performance analysis
if [ $SUCCESS_COUNT -ge 9 ]; then
  echo "🎉 EXCELLENT: Success rate ≥ 90%"
elif [ $SUCCESS_COUNT -ge 7 ]; then
  echo "✅ GOOD: Success rate ≥ 70%"
elif [ $SUCCESS_COUNT -ge 5 ]; then
  echo "⚠️  FAIR: Success rate ≥ 50%"
else
  echo "❌ POOR: Success rate < 50% - Needs improvement"
fi

echo ""
echo "Detailed Results:"
for i in $(seq 1 $TOTAL_TESTS); do
  echo "  Test $i: ${RESULTS[$((i-1))]} - ${REQUIREMENTS[$((i-1))]}"
done

echo ""
echo "======================================"
echo "  Test Complete"
echo "======================================"

# Return exit code based on success rate
if [ $SUCCESS_COUNT -ge 7 ]; then
  exit 0
else
  exit 1
fi
