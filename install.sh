#!/bin/bash

# Installation script for Kerio VPN GNOME Shell Extension

EXTENSION_UUID="kerio-vpn-extension@vgeroutskis"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"

echo "Installing Kerio VPN GNOME Shell Extension..."

# Create extension directory
mkdir -p "$EXTENSION_DIR"

# Copy extension files
cp -r ./* "$EXTENSION_DIR/"

# Compile schemas
echo "Compiling schemas..."
glib-compile-schemas "$EXTENSION_DIR/schemas/"

# Check GNOME Shell version
GNOME_VERSION=$(gnome-shell --version | cut -d' ' -f3 | cut -d'.' -f1)
echo "Detected GNOME Shell version: $GNOME_VERSION"

if [ "$GNOME_VERSION" -lt 45 ]; then
    echo "Warning: This extension requires GNOME Shell 45 or higher"
    echo "Your version: $GNOME_VERSION"
fi

# Check if Kerio VPN service exists
if systemctl list-unit-files | grep -q "kerio-kvc.service"; then
    echo "✓ Kerio VPN service found"
else
    echo "⚠ Warning: kerio-kvc.service not found"
    echo "Please install Kerio Control VPN Client first"
fi

echo ""
echo "Configuring passwordless sudo..."
USERNAME=$(whoami)
SUDOERS_SOURCE="kerio-vpn-sudoers"
TEMP_SUDOERS="/tmp/kerio-vpn-sudoers"

if [ -f "$SUDOERS_SOURCE" ]; then
    # Update username in sudoers file
    sed "s/vgeroutskis/$USERNAME/g" "$SUDOERS_SOURCE" > "$TEMP_SUDOERS"
    
    echo "Installing sudoers configuration (requires sudo)..."
    if sudo cp "$TEMP_SUDOERS" "/etc/sudoers.d/kerio-vpn"; then
        sudo chmod 440 "/etc/sudoers.d/kerio-vpn"
        echo "✓ Passwordless sudo configured successfully"
    else
        echo "⚠ Warning: Failed to install sudoers configuration"
        echo "You can try installing it manually: sudo cp kerio-vpn-sudoers /etc/sudoers.d/kerio-vpn"
    fi
    rm -f "$TEMP_SUDOERS"
else
    echo "⚠ Warning: $SUDOERS_SOURCE not found"
fi

echo ""
echo "Installation complete!"
echo ""
echo "To enable the extension:"
echo "1. Restart GNOME Shell:"
echo "   - On X11: Press Alt+F2, type 'r', press Enter"
echo "   - On Wayland: Log out and log back in"
echo "2. Enable the extension:"
echo "   gnome-extensions enable $EXTENSION_UUID"
echo ""
echo "Or use GNOME Extensions app to enable it."
