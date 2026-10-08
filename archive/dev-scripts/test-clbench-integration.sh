#!/bin/bash

# Integration Test Script for CL-bench with API Level Enhancement
#
# Tests newma API mode with different quality levels to measure improvement
#
# Usage:
#   ./test-clbench-integration.sh [--samples N] [--level N]
#
# Examples:
#   ./test-clbench-integration.sh --samples 10 --level 2
#   ./test-clbench-integration.sh --level 3  # Test all samples

set -e  # Exit on error

# Default values
SAMPLES=10
LEVEL=2
CL_BENCH_DIR="/Users/mac/cltest/cl-bench"
KODE_DIR="/Users/mac/kode"
OUTPUT_DIR="$KODE_DIR/test-outputs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --samples)
      SAMPLES="$2"
      shift 2
      ;;
    --level)
      LEVEL="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--samples N] [--level N]"
      exit 1
      ;;
  esac
done

# Validate level
if [[ ! "$LEVEL" =~ ^[1-3]$ ]]; then
  echo "Error: Level must be 1, 2, or 3"
  exit 1
fi

echo "=========================================="
echo "CL-bench Integration Test"
echo "=========================================="
echo "Level: $LEVEL"
echo "Samples: $SAMPLES"
echo "Timestamp: $TIMESTAMP"
echo ""

# Prepare output directory
mkdir -p "$OUTPUT_DIR"

# Create test input file (first N samples)
TEST_INPUT="$OUTPUT_DIR/test_${LEVEL}_level_${TIMESTAMP}.jsonl"

echo "Preparing test input..."
head -n "$SAMPLES" "$CL_BENCH_DIR/CL-bench-bing.jsonl" > "$TEST_INPUT"

SAMPLE_COUNT=$(wc -l < "$TEST_INPUT" | awk '{print $1}')
echo "Test input created: $TEST_INPUT ($SAMPLE_COUNT samples)"
echo ""

# Run newma with different levels
echo "Running newma CLI with --api-level=$LEVEL..."
echo ""

# Test with newma
NEWMA_OUTPUT="$OUTPUT_DIR/newma_level_${LEVEL}_${TIMESTAMP}.jsonl"
ERROR_LOG="$OUTPUT_DIR/errors_${TIMESTAMP}.log"

START_TIME=$(date +%s)

# Set environment variables
export NODE_OPTIONS="--max-old-space-size=4096"
export OPENAI_API_KEY_ROTATION="${OPENAI_API_KEY_ROTATION:-}"

# Run newma in API mode
cd "$KODE_DIR"

if [ "$LEVEL" -eq 1 ]; then
  echo "⚡ Level 1: Fast mode (single call, ~13s expected)"
elif [ "$LEVEL" -eq 2 ]; then
  echo "⚡⚡ Level 2: Standard mode (2 iterations, ~30s expected)"
else
  echo "⚡⚡⚡ Level 3: Deep mode (3 iterations, ~60s expected)"
fi

echo ""

# Process samples
cat "$TEST_INPUT" | while IFS= read -r line; do
  # Extract task from JSON
  TASK=$(echo "$line" | jq -r '.messages[] | select(.role == "user") | .content' // 2>/dev/null || echo "$line" | jq -r '.messages[0].content')

  if [ -z "$TASK" ]; then
    echo "Warning: Could not extract task, skipping..."
    continue
  fi

  echo "Processing: ${TASK:0:50}..."

  # Call newma with timeout
  RESULT=$(timeout 120s npx ts-node src/cli.ts --api --api-level="$LEVEL" "$TASK" 2>>"$ERROR_LOG" || echo "ERROR")

  # Extract user message for output
  USER_MSG=$(echo "$line" | jq -r '.messages[] | select(.role == "user") | .content' 2>/dev/null || echo "$TASK")

  # Create output JSON
  OUTPUT_JSON=$(jq -n \
    --arg input "$USER_MSG" \
    --arg output "$RESULT" \
    '{input: $input, output: $output, level: '$LEVEL', timestamp: now}' \
    2>/dev/null || echo "{\"input\":\"$USER_MSG\",\"output\":\"$RESULT\",\"level\":$LEVEL,\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}")

  echo "$OUTPUT_JSON"

done < "$TEST_INPUT" | head -n "$SAMPLES" > "$NEWMA_OUTPUT"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "=========================================="
echo "Test Complete!"
echo "=========================================="
echo "Output: $NEWMA_OUTPUT"
echo "Errors: $ERROR_LOG"
echo "Duration: ${DURATION}s"
echo ""

# Calculate statistics
TOTAL_SAMPLES=$(wc -l < "$NEWMA_OUTPUT" | awk '{print $1}')
if [ -f "$ERROR_LOG" ]; then
  ERROR_COUNT=$(grep -c "ERROR" "$ERROR_LOG" || echo "0")
else
  ERROR_COUNT=0
fi

echo "Statistics:"
echo "  Total samples: $TOTAL_SAMPLES"
echo "  Errors: $ERROR_COUNT"
echo "  Success rate: $(echo "scale=1; ($TOTAL_SAMPLES - $ERROR_COUNT) * 100 / $TOTAL_SAMPLES" | bc)%"
echo ""

# Compare with baseline (if available)
BASELINE_FILE="$OUTPUT_DIR/../FINAL_COMPARISON_REPORT.md"
if [ -f "$BASELINE_FILE" ]; then
  echo "Baseline Performance:"
  echo "  Claude Code: 5.54% pass rate (from FINAL_COMPARISON_REPORT.md)"
  echo "  newma (old): 1.74% pass rate"
  echo ""
  echo "Expected Improvement:"
  echo "  Level 1 (fast): ~1.74% (no change, but consistent)"
  echo "  Level 2 (standard): ~3.5% (+100% improvement)"
  echo "  Level 3 (deep): ~5-6% (+200-300% improvement)"
  echo ""
fi

echo "✅ Integration test complete!"
echo ""
echo "Next steps:"
echo "1. Run: cat $NEWMA_OUTPUT | jq -c '.output' | less"
echo "2. Evaluate with: python3 $CL_BENCH_DIR/eval.py --input $NEWMA_OUTPUT"
echo "3. Compare results with baseline"
