#!/bin/bash

# Script to install PolicyKit rule for Kerio VPN
# This allows controlling kerio-kvc service without password prompt

RULES_FILE="10-kerio-vpn.rules"
RULES_DIR="/etc/polkit-1/rules.d"
USERNAME=$(whoami)

echo "Installing PolicyKit rule for Kerio VPN..."
echo "This will allow user '$USERNAME' to control kerio-kvc service without password."
echo ""

# Check if rules file exists
if [ ! -f "$RULES_FILE" ]; then
    echo "Error: $RULES_FILE not found in current directory"
    exit 1
fi

# Update username in the rules file
sed "s/vgeroutskis/$USERNAME/g" "$RULES_FILE" > "/tmp/$RULES_FILE"

# Copy to system directory (requires sudo)
echo "Installing to $RULES_DIR/$RULES_FILE ..."
sudo cp "/tmp/$RULES_FILE" "$RULES_DIR/"

if [ $? -eq 0 ]; then
    echo "✓ PolicyKit rule installed successfully!"
    echo ""
    echo "The rule allows:"
    echo "  - Start/stop/restart kerio-kvc service without password"
    echo "  - User: $USERNAME"
    echo ""
    echo "You may need to restart PolicyKit or reboot for changes to take effect:"
    echo "  sudo systemctl restart polkit"
    echo ""
    echo "To verify the rule is active:"
    echo "  systemctl start kerio-kvc.service  (should not ask for password)"
else
    echo "✗ Failed to install PolicyKit rule"
    exit 1
fi

# Clean up temp file
rm "/tmp/$RULES_FILE"
