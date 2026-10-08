#!/bin/bash

# Example: Loop until task is complete
# Usage: ./loop-example.sh "Add user authentication"

REQUIREMENT="$1"
MAX_ITERATIONS=${2:-10}  # Default 10 iterations

echo "🔁 Starting loop mode for: $REQUIREMENT"
echo "📊 Max iterations: $MAX_ITERATIONS"
echo "💡 Press Ctrl+C to stop at any time"
echo ""

for ((i=1; i<=$MAX_ITERATIONS; i++)); do
  echo "════════════════════════════════════════"
  echo "Iteration $i/$MAX_ITERATIONS"
  echo "════════════════════════════════════════"
  echo ""

  # Call kode with --loop flag
  # Exit codes: 0 = done, 1 = not done, 2 = error, 130 = Ctrl+C
  npx kode-cli "$REQUIREMENT" --loop

  EXIT_CODE=$?

  echo ""

  if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Task completed successfully!"
    exit 0
  elif [ $EXIT_CODE -eq 2 ]; then
    echo "❌ Error occurred, stopping loop"
    exit 2
  elif [ $EXIT_CODE -eq 130 ]; then
    echo "⛔ User interrupted (Ctrl+C)"
    exit 130
  else
    echo "⚠️  Task not done yet, continuing..."
    echo ""
    sleep 1
  fi
done

echo "⚠️  Reached maximum iterations ($MAX_ITERATIONS) without completion"
exit 1
