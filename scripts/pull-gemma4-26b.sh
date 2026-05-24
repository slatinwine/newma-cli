#!/bin/bash
# Download gemma4:26b and add to codex config
set -e

echo "Pulling gemma4:26b..."
ollama pull gemma4:26b

echo "Done! Checking..."
ollama list

# Add to codex config if not exists
if ! grep -q "gemma4:26b" ~/.codex/config.toml 2>/dev/null; then
cat >> ~/.codex/config.toml << 'EOF'

[profiles.gemma4-moe]
model_provider = "ollama-local"
model = "gemma4:26b"
EOF
  echo "Added gemma4:26b profile to ~/.codex/config.toml"
fi

echo "Use: codex --profile gemma4-moe"
