#!/bin/bash

# Script to fix TypeScript imports for ESM compatibility
# This adds .js extensions to local imports

fix_file() {
  local file="$1"
  echo "Processing: $file"

  # Create temp file
  local tmp_file=$(mktemp)

  # Use sed to fix imports
  # Pattern 1: from './file' -> from './file.js'
  # Pattern 2: from './dir' -> from './dir/index.js' (for directories)
  # Pattern 3: from '../file' -> from '../file.js'

  sed -E \
    -e "s/from '\(\.\/[^']*\)'/from '\1.js'/g" \
    -e "s/from '\(\.\.\/[^']*\)'/from '\1.js'/g" \
    "$file" > "$tmp_file"

  # Replace original file
  mv "$tmp_file" "$file"
}

export -f fix_file

# Find and fix all TypeScript files (excluding specified directories)
find src -name "*.ts" | grep -v -E "(src/ui/|src/skills/|src/skills-creator/|src/loop/frontends/tui-frontend.ts|src/repl-tui.ts)" | while read file; do
  fix_file "$file"
done

echo "Done fixing imports!"
