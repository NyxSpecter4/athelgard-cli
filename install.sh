#!/bin/bash
# ATHELGARD CLI INSTALLER
# Run: bash install.sh

set -e

REPO_URL="https://github.com/NyxSpecter4/athelgard-cli.git"
INSTALL_DIR="$HOME/.athelgard-cli"
BIN_DIR="$HOME/.local/bin"
BASH_RC="$HOME/.bashrc"

echo "🐉 Installing Athelgard CLI..."

# Create bin dir if needed
mkdir -p "$BIN_DIR"

# Clone or update repo
if [ -d "$INSTALL_DIR" ]; then
  echo "   Updating existing install..."
  cd "$INSTALL_DIR"
  git pull origin master
else
  echo "   Cloning from GitHub..."
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# Create symlink
echo "   Creating symlink..."
ln -sf "$INSTALL_DIR/athelgard.js" "$BIN_DIR/athelgard"
chmod +x "$INSTALL_DIR/athelgard.js"

# Add to PATH if needed
if ! echo "$PATH" | grep -q "$BIN_DIR"; then
  echo "   Adding $BIN_DIR to PATH..."
  echo "" >> "$BASH_RC"
  echo "# Athelgard CLI" >> "$BASH_RC"
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$BASH_RC"
  echo "   ✅ Added to ~/.bashrc — run: source ~/.bashrc"
fi

# Check if athelgard is in PATH
if command -v athelgard &> /dev/null; then
  echo ""
  echo "✅ ATHELGARD INSTALLED!"
  echo ""
  echo "Run: athelgard status"
  echo "Run: athelgard ask \"How do I write a React hook?\""
  echo "Run: athelgard help"
  echo ""
  echo "First time? Set up your API keys:"
  echo "   athelgard config"
  echo ""
else
  echo ""
  echo "✅ INSTALLED but PATH not updated yet."
  echo "Run: source ~/.bashrc"
  echo "Then: athelgard status"
  echo ""
fi
