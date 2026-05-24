#!/bin/bash
# Tab Completion Diagnostic Script

echo "🔍 Tab Completion Diagnostic"
echo "=============================="
echo ""

echo "1. Environment Variables:"
echo "   SHELL: $SHELL"
echo "   TERM: $TERM"
echo ""

echo "2. Node.js Version:"
node --version
echo ""

echo "3. Terminal Type:"
if [ -n "$TMUX" ]; then
  echo "   Running inside tmux: YES"
else
  echo "   Running inside tmux: NO"
fi
echo ""

echo "4. Testing Tab Completion in CLI..."
echo "   Starting Kode CLI with interactive mode..."
echo "   Try pressing Tab after typing '/h'"
echo "   Press Ctrl+D to exit"
echo ""

# Start the CLI
node dist/cli.js -i
