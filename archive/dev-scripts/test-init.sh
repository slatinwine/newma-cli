#!/bin/bash

# Test script for /init command

echo "Testing /init command..."
echo ""

# Backup existing KODE.md if it exists
if [ -f "KODE.md" ]; then
  mv KODE.md KODE.md.backup
  echo "✓ Backed up existing KODE.md"
fi

# Run /init command with timeout
echo "Starting REPL and running /init..."
echo ""

# Create a script that runs /init and exits
cat > /tmp/init_test.txt << 'EOF'
/init
/exit
EOF

# Run the CLI with input from the script
timeout 60 node dist/cli.js -i < /tmp/init_test.txt > /tmp/init_output.txt 2>&1

# Check if KODE.md was created
if [ -f "KODE.md" ]; then
  echo "✅ KODE.md created!"

  # Check file size
  SIZE=$(wc -c < KODE.md)
  echo "   File size: $SIZE bytes"

  # Check if it has more content than the fallback
  if grep -q "This project was analyzed but no detailed summary was generated" KODE.md; then
    echo "⚠️  Warning: AI didn't generate summary (using fallback)"
    echo ""
    echo "KODE.md content:"
    cat KODE.md
  else
    echo "✅ Summary generated successfully!"
    echo ""
    echo "First 50 lines of KODE.md:"
    head -50 KODE.md
  fi
else
  echo "❌ KODE.md was not created"
  echo ""
  echo "Output from CLI:"
  cat /tmp/init_output.txt
fi

echo ""
echo "=========="
echo ""

# Restore backup if it existed
if [ -f "KODE.md.backup" ]; then
  echo "Restoring backup..."
  mv KODE.md.backup KODE.md
fi

echo "Test complete!"
