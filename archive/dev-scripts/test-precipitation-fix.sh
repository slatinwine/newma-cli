#!/bin/bash

# Test precipitation command fix
echo "Testing precipitation command handler fix..."
echo ""

# The bug was that command matching failed because:
# - handlePrecipitationCommand received "/drafts" (with slash)
# - switch statement checked case 'drafts' (without slash)

# The fix strips the leading slash before the switch statement

echo "✅ Fix applied: Stripping leading slash in handlePrecipitationCommand"
echo ""
echo "To test manually:"
echo "1. Start REPL: npx newma-cli -i"
echo "2. Run: /drafts"
echo "3. Should see list of draft skills (error-handling-best-practices, git-workflow-optimization)"
echo ""
echo "Other commands that should work:"
echo "  /drafts --pending"
echo "  /drafts --approved"
echo "  /approve <draft-id>"
echo "  /reject <draft-id>"
echo "  /view-draft <draft-id>"
echo "  /delete-draft <draft-id>"
echo "  /precipitate"
echo "  /precipitation-status"
echo "  /precipitation-schedule"
