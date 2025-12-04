# Kerio VPN GNOME Shell Extension

A feature-rich GNOME Shell extension for managing Kerio Control VPN Client directly from your system panel.

**Kerio Control** is a unified threat management (UTM) firewall solution that provides secure VPN connectivity for remote access.

![GNOME Shell Version](https://img.shields.io/badge/GNOME%20Shell-45%2B-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- 🔌 **Quick Connect/Disconnect** - One-click VPN control from the top panel
- 📊 **Real-time Status** - Live connection monitoring with visual indicators
- 📈 **Connection Info** - Display IP address, server, and connection duration
- 🔄 **Auto-reconnect** - Automatically reconnect if VPN drops (configurable)
- 🚀 **Auto-connect** - Connect automatically on startup (optional)
- 🔔 **Notifications** - Status change notifications
- 📋 **Quick Actions**:
  - Reconnect button for quick connection restart
  - Copy IP address to clipboard
  - View service logs in terminal
- ⚙️ **Settings Panel** - Configure VPN credentials, server, port, and behaviors
- 🔐 **Password-free Operation** - Optional sudo configuration for seamless control

## Screenshots

[Add screenshots here]

## Requirements

- GNOME Shell 45+
- Kerio Control VPN Client (`kerio-kvc` service)
- A Kerio Control server with VPN enabled
- PolicyKit (for authentication)

## Installing Kerio Control VPN Client

Before installing the extension, you need to install the Kerio Control VPN Client on your system.

### Download Kerio VPN Client

Download the DEB package from the official Kerio Control VPN resources page:

**Download Link**: [Kerio Control VPN Client](https://gfi.ai/products-and-solutions/network-security-solutions/keriocontrol/resources/vpn)

**Note**: Kerio officially provides only **.deb** packages for Linux. For other distributions, you'll need to convert the package or extract it manually.

### Installation by Distribution

#### Ubuntu / Debian / Linux Mint / Pop!_OS / Zorin OS

```bash
# Download the DEB package (replace with actual version)
wget https://cdn.kerio.com/dwn/control/control-<version>/kerio-control-vpnclient-<version>-linux-amd64.deb

# Install the package
sudo apt install ./kerio-control-vpnclient-<version>-linux-amd64.deb

# Or using dpkg
sudo dpkg -i kerio-control-vpnclient-<version>-linux-amd64.deb
sudo apt-get install -f  # Fix dependencies if needed
```

#### Fedora / RHEL / CentOS / Rocky Linux / AlmaLinux

Kerio doesn't provide official RPM packages. Convert the DEB package using `alien`:

```bash
# Using alien to convert DEB to RPM
sudo dnf install alien
wget https://cdn.kerio.com/dwn/control/control-<version>/kerio-control-vpnclient-<version>-linux-amd64.deb
sudo alien -r kerio-control-vpnclient-<version>-linux-amd64.deb
sudo dnf install kerio-control-vpnclient-<version>-1.x86_64.rpm
```

**Alternative**: Extract DEB manually (see Generic Linux section below).

#### Arch Linux / Manjaro / EndeavourOS

Convert the DEB package using `debtap` or extract manually:

```bash
# Option 1: Using debtap (recommended for Arch)
yay -S debtap
sudo debtap -u
wget https://cdn.kerio.com/dwn/control/control-<version>/kerio-control-vpnclient-<version>-linux-amd64.deb
debtap kerio-control-vpnclient-<version>-linux-amd64.deb
sudo pacman -U kerio-control-vpnclient-<version>-1-x86_64.pkg.tar.zst

# Option 2: Manual extraction (see Generic Linux section below)
```

Check AUR for community-maintained packages (may be outdated):
```bash
yay -S kerio-control-vpnclient  # If available
```

#### openSUSE / SUSE Linux Enterprise

Convert the DEB package or extract manually:

```bash
# Convert DEB to RPM using alien
sudo zypper install alien
wget https://cdn.kerio.com/dwn/control/control-<version>/kerio-control-vpnclient-<version>-linux-amd64.deb
sudo alien -r kerio-control-vpnclient-<version>-linux-amd64.deb
sudo zypper install kerio-control-vpnclient-<version>-1.x86_64.rpm
```

**Alternative**: Extract DEB manually (see Generic Linux section below).

#### Generic Linux (Manual Extraction - Works on all distributions)

For any distribution, you can manually extract and install the DEB package:

```bash
# Download the DEB package
wget https://cdn.kerio.com/dwn/control/control-<version>/kerio-control-vpnclient-<version>-linux-amd64.deb

# Extract the package
ar x kerio-control-vpnclient-<version>-linux-amd64.deb
tar xf data.tar.xz

# Install files to system
sudo cp -r usr /
sudo cp -r etc /

# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable and start the service (optional)
sudo systemctl enable kerio-kvc.service
sudo systemctl start kerio-kvc.service
```

### Verify Installation

After installation, verify that the Kerio VPN service is available:

```bash
# Check if service is installed
systemctl status kerio-kvc.service

# Check if config file exists
ls -l /etc/kerio-kvc.conf
```

### Initial Configuration (Optional)

You can configure the VPN manually before installing the extension:

```bash
# Edit the config file (requires root)
sudo nano /etc/kerio-kvc.conf
```

**Example configuration** (`/etc/kerio-kvc.conf`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<config>
  <connections>
    <connection type="persistent">
      <server>vpn.example.com</server>
      <port>4090</port>
      <username>your_username</username>
      <password>your_password</password>
      <active>yes</active>
      <description>My VPN Connection</description>
    </connection>
  </connections>
</config>
```

**Note**: Special characters in the password are stored as HTML entities (e.g., `&#33;` for `!`, `&#35;` for `#`). The extension handles this automatically when you use the Settings panel.

Or use the extension's Settings panel after installation to configure it graphically.

## Extension Installation

### Automatic Installation

```bash
git clone https://github.com/vgeroutskis/kerio-vpn-extension.git
cd kerio-vpn-extension
./install.sh
```

### Manual Installation

1. Copy the extension to your local extensions directory:
```bash
cp -r kerio-vpn-extension@vgeroutskis ~/.local/share/gnome-shell/extensions/
```

2. Compile the settings schema:
```bash
glib-compile-schemas ~/.local/share/gnome-shell/extensions/kerio-vpn-extension@vgeroutskis/schemas/
```

3. Restart GNOME Shell:
   - **X11**: Press `Alt+F2`, type `r`, and press Enter
   - **Wayland**: Log out and log back in

4. Enable the extension:
```bash
gnome-extensions enable kerio-vpn-extension@vgeroutskis
```

### Password-free Operation (Optional but Recommended)

To avoid password prompts when controlling the VPN:

```bash
cd kerio-vpn-extension@vgeroutskis
sudo visudo -c -f kerio-vpn-sudoers
sudo cp kerio-vpn-sudoers /etc/sudoers.d/kerio-vpn
sudo chmod 440 /etc/sudoers.d/kerio-vpn
```

This allows your user to start/stop the Kerio VPN service without entering a password.

## Configuration

### VPN Credentials Setup

The extension reads and writes VPN configuration from `/etc/kerio-kvc.conf`.

**To configure your VPN connection:**

1. Click the VPN icon in the top panel
2. Select **Settings**
3. Enter your VPN details:
   - **VPN Server**: Server address (e.g., `vpn.example.com` or IP)
   - **Username**: Your VPN username
   - **Password**: Your VPN password
   - **Port**: VPN port (default: 4090)
4. Click **Save to Kerio Config**

The extension will update `/etc/kerio-kvc.conf` and restart the VPN service automatically.

### Extension Settings

Access additional settings through the Settings menu:

**Connection Behavior:**
- Auto-connect on startup
- Auto-reconnect on disconnect (up to 3 attempts)
- Start minimized (no startup notifications)

**Display Options:**
- Show connection info (IP, server, duration)
- Show notifications on status changes
- Status check interval (3-60 seconds)

## Usage

Click the VPN icon in the top panel to access:

### When Disconnected:
- **Status**: Current connection state
- **Connect**: Establish VPN connection
- **Settings**: Configure VPN and extension

### When Connected:
- **Status**: Connected
- **IP Address**: Your VPN IP (e.g., `10.40.50.5`)
- **Server**: VPN server address
- **Duration**: Live connection timer (HH:MM:SS)
- **Disconnect**: Close VPN connection
- **Reconnect**: Restart VPN connection
- **Copy IP Address**: Copy VPN IP to clipboard
- **View Logs**: Open terminal with service logs
- **Settings**: Configure VPN and extension

### Icon States

- 🔴 **Disconnected**: Not connected to VPN
- 🟢 **Connected**: VPN is active
- 🟡 **Connecting/Disconnecting**: In transition
- ⚠️ **Error**: Connection problem

## Troubleshooting

Access settings through the extension menu or GNOME Extensions:

- **Auto-connect on startup**: Automatically connect when extension loads
- **Show notifications**: Display status change notifications
- **Status check interval**: How often to check VPN status (default: 5 seconds)

## Troubleshooting

### Extension doesn't appear
- Make sure GNOME Shell version is 45 or higher
- Check if extension is enabled: `gnome-extensions list`
- Check logs: `journalctl -f -o cat /usr/bin/gnome-shell`

### Can't connect/disconnect
- Verify Kerio VPN client is installed: `systemctl status kerio-kvc`
- Ensure you have PolicyKit permissions
- Check if service exists: `systemctl list-units | grep kerio`

### Icons not showing
- Restart GNOME Shell
- Check icon theme has VPN icons

### Still asks for password
- Verify sudoers file is installed: `ls -l /etc/sudoers.d/kerio-vpn`
- Check file permissions: `sudo chmod 440 /etc/sudoers.d/kerio-vpn`
- Verify your username is correct in the file
- Test manually: `sudo systemctl restart kerio-kvc.service` (should not ask for password)

### Connection info not showing
- Ensure "Show connection info" is enabled in Settings
- Check VPN interface exists: `ip addr show kvnet`
- Restart the extension

## Development

### File Structure

```
kerio-vpn-extension@vgeroutskis/
├── extension.js           # Main extension code
├── prefs.js              # Settings/preferences UI
├── kerioConfig.js        # Kerio config file manager
├── metadata.json         # Extension metadata
├── schemas/              # GSettings schemas
│   └── org.gnome.shell.extensions.kerio-vpn.gschema.xml
├── install.sh            # Installation script
├── kerio-vpn-sudoers     # Sudoers configuration
└── README.md
```

### Testing
```bash
# Watch logs
journalctl -f -o cat /usr/bin/gnome-shell | grep -i kerio

# Reload extension
gnome-extensions disable kerio-vpn-extension@vgeroutskis
gnome-extensions enable kerio-vpn-extension@vgeroutskis
```

### Debugging
Check logs for errors:
```bash
journalctl -f -o cat | grep -i kerio
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - See [LICENSE](LICENSE) file for details
## Acknowledgments

- Built for GNOME Shell 45+
- Designed for [Kerio Control VPN Client](https://gfi.ai/products-and-solutions/network-security-solutions/keriocontrol/resources/vpn)
- Kerio Control is a UTM firewall solution by GFI Software
- Uses PolicyKit/sudoers for passwordless operation
## Acknowledgments

- Built for GNOME Shell 45+
- Designed for Kerio Control VPN Client
- Uses PolicyKit/sudoers for passwordless operation
