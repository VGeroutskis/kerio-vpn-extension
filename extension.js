import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import {KerioConfigManager} from './kerioConfig.js';

const VPN_STATES = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    DISCONNECTING: 'disconnecting',
    ERROR: 'error'
};

class KerioVPNManager {
    constructor(callback, settings) {
        this._callback = callback;
        this._settings = settings;
        this._currentState = VPN_STATES.DISCONNECTED;
        this._checkInterval = null;
        this._connectionStartTime = null;
        this._lastState = VPN_STATES.DISCONNECTED;
        this._reconnectAttempts = 0;
        this._maxReconnectAttempts = 3;
    }

    async getStatus() {
        try {
            const proc = Gio.Subprocess.new(
                ['systemctl', 'is-active', 'kerio-kvc.service'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );

            const [stdout, stderr] = await new Promise((resolve, reject) => {
                proc.communicate_utf8_async(null, null, (proc, res) => {
                    try {
                        const [, stdout, stderr] = proc.communicate_utf8_finish(res);
                        resolve([stdout, stderr]);
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            
            const status = stdout.trim();

            if (status === 'active') {
                // Check if actually connected by checking network interfaces
                const ifProc = Gio.Subprocess.new(
                    ['sh', '-c', 'ip link show | grep -i kvnet'],
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                );
                
                const [ifStdout] = await new Promise((resolve, reject) => {
                    ifProc.communicate_utf8_async(null, null, (proc, res) => {
                        try {
                            const [, stdout, stderr] = proc.communicate_utf8_finish(res);
                            resolve([stdout, stderr]);
                        } catch (e) {
                            reject(e);
                        }
                    });
                });
                
                if (ifStdout && ifStdout.trim().length > 0) {
                    return VPN_STATES.CONNECTED;
                }
                return VPN_STATES.DISCONNECTED;
            }
            return VPN_STATES.DISCONNECTED;
        } catch (e) {
            console.error('Kerio VPN: Error checking status:', e);
            return VPN_STATES.ERROR;
        }
    }

    async connect() {
        try {
            this._currentState = VPN_STATES.CONNECTING;
            this._callback(this._currentState);

            const proc = Gio.Subprocess.new(
                ['sudo', 'systemctl', 'start', 'kerio-kvc.service'],
                Gio.SubprocessFlags.NONE
            );

            await new Promise((resolve, reject) => {
                proc.wait_async(null, (proc, res) => {
                    try {
                        proc.wait_finish(res);
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            
            // Wait a bit for connection to establish
            await new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
                resolve();
                return GLib.SOURCE_REMOVE;
            }));

            const status = await this.getStatus();
            this._currentState = status;
            if (status === VPN_STATES.CONNECTED) {
                this._connectionStartTime = GLib.get_monotonic_time();
                this._reconnectAttempts = 0;
            }
            this._callback(this._currentState);
            return status === VPN_STATES.CONNECTED;
        } catch (e) {
            console.error('Kerio VPN: Error connecting:', e);
            this._currentState = VPN_STATES.ERROR;
            this._callback(this._currentState);
            return false;
        }
    }

    async disconnect() {
        try {
            this._currentState = VPN_STATES.DISCONNECTING;
            this._callback(this._currentState);

            const proc = Gio.Subprocess.new(
                ['sudo', 'systemctl', 'stop', 'kerio-kvc.service'],
                Gio.SubprocessFlags.NONE
            );

            await new Promise((resolve, reject) => {
                proc.wait_async(null, (proc, res) => {
                    try {
                        proc.wait_finish(res);
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            
            this._currentState = VPN_STATES.DISCONNECTED;
            this._connectionStartTime = null;
            this._callback(this._currentState);
            return true;
        } catch (e) {
            console.error('Kerio VPN: Error disconnecting:', e);
            this._currentState = VPN_STATES.ERROR;
            this._callback(this._currentState);
            return false;
        }
    }

    startMonitoring() {
        const interval = this._settings.get_int('check-interval');
        this._checkInterval = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, interval, () => {
            this.getStatus().then(status => {
                const wasConnected = this._lastState === VPN_STATES.CONNECTED;
                const isDisconnected = status === VPN_STATES.DISCONNECTED;
                
                if (status !== this._currentState) {
                    this._currentState = status;
                    
                    // Handle auto-reconnect
                    if (wasConnected && isDisconnected && 
                        this._settings.get_boolean('auto-reconnect') &&
                        this._reconnectAttempts < this._maxReconnectAttempts) {
                        
                        this._reconnectAttempts++;
                        console.log(`Kerio VPN: Auto-reconnect attempt ${this._reconnectAttempts}/${this._maxReconnectAttempts}`);
                        
                        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                            this.connect();
                            return GLib.SOURCE_REMOVE;
                        });
                    }
                    
                    this._callback(status);
                }
                
                this._lastState = status;
            });
            return GLib.SOURCE_CONTINUE;
        });
    }

    stopMonitoring() {
        if (this._checkInterval) {
            GLib.Source.remove(this._checkInterval);
            this._checkInterval = null;
        }
    }

    get currentState() {
        return this._currentState;
    }

    getConnectionDuration() {
        if (!this._connectionStartTime || this._currentState !== VPN_STATES.CONNECTED) {
            return null;
        }
        const elapsed = (GLib.get_monotonic_time() - this._connectionStartTime) / 1000000;
        return Math.floor(elapsed);
    }

    async getConnectionInfo() {
        if (this._currentState !== VPN_STATES.CONNECTED) {
            return null;
        }

        try {
            // Get IP address from kvnet interface
            const ipProc = Gio.Subprocess.new(
                ['sh', '-c', 'ip addr show kvnet 2>/dev/null | grep "inet " | awk \'{print $2}\' | cut -d/ -f1'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );

            const [ipStdout] = await new Promise((resolve, reject) => {
                ipProc.communicate_utf8_async(null, null, (proc, res) => {
                    try {
                        const [, stdout, stderr] = proc.communicate_utf8_finish(res);
                        resolve([stdout, stderr]);
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            const ip = ipStdout.trim();
            
            // Read server from Kerio config
            let server = 'Unknown';
            try {
                const configManager = new KerioConfigManager();
                const config = await configManager.readConfig();
                if (config && config.server) {
                    server = config.server;
                }
            } catch (e) {
                console.error('Kerio VPN: Failed to read server from config:', e);
            }
            
            const duration = this.getConnectionDuration();

            return { ip, server, duration };
        } catch (e) {
            console.error('Kerio VPN: Error getting connection info:', e);
            return null;
        }
    }
}

const KerioVPNIndicator = GObject.registerClass(
class KerioVPNIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, 'Kerio VPN Indicator', false);

        this._extension = extension;
        this._settings = extension.getSettings();
        this._updateInfoInterval = null;

        // Create icon
        this._icon = new St.Icon({
            icon_name: 'network-vpn-disconnected-symbolic',
            style_class: 'system-status-icon',
        });

        this.add_child(this._icon);

        // Create VPN manager
        this._vpnManager = new KerioVPNManager(this._onStateChanged.bind(this), this._settings);

        // Create menu items
        this._createMenu();

        // Initialize state
        this._updateState(VPN_STATES.DISCONNECTED);
        this._vpnManager.getStatus().then(status => {
            this._updateState(status);
            // Start info updates if already connected
            if (status === VPN_STATES.CONNECTED) {
                this._startInfoUpdates();
            }
        });

        // Start monitoring
        this._vpnManager.startMonitoring();

        // Check for auto-connect
        if (this._settings.get_boolean('auto-connect')) {
            this._vpnManager.connect();
        }
    }

    _createMenu() {
        // Status item
        this._statusItem = new PopupMenu.PopupMenuItem('Status: Disconnected', {
            reactive: false,
        });
        this.menu.addMenuItem(this._statusItem);

        // Connection info items (shown when connected)
        this._infoSection = new PopupMenu.PopupMenuSection();
        
        this._ipItem = new PopupMenu.PopupMenuItem('IP: --', {
            reactive: false,
        });
        this._infoSection.addMenuItem(this._ipItem);
        
        this._serverItem = new PopupMenu.PopupMenuItem('Server: --', {
            reactive: false,
        });
        this._infoSection.addMenuItem(this._serverItem);
        
        this._durationItem = new PopupMenu.PopupMenuItem('Duration: --', {
            reactive: false,
        });
        this._infoSection.addMenuItem(this._durationItem);
        
        this.menu.addMenuItem(this._infoSection);
        this._infoSection.actor.hide();

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Connect button
        this._connectItem = new PopupMenu.PopupMenuItem('Connect');
        this._connectItem.connect('activate', () => {
            this._vpnManager.connect();
        });
        this.menu.addMenuItem(this._connectItem);

        // Disconnect button
        this._disconnectItem = new PopupMenu.PopupMenuItem('Disconnect');
        this._disconnectItem.connect('activate', () => {
            this._vpnManager.disconnect();
        });
        this.menu.addMenuItem(this._disconnectItem);

        // Reconnect button
        this._reconnectItem = new PopupMenu.PopupMenuItem('Reconnect');
        this._reconnectItem.connect('activate', () => {
            this._vpnManager.disconnect().then(() => {
                GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
                    this._vpnManager.connect();
                    return GLib.SOURCE_REMOVE;
                });
            });
        });
        this.menu.addMenuItem(this._reconnectItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Copy IP button
        this._copyIPItem = new PopupMenu.PopupMenuItem('Copy IP Address');
        this._copyIPItem.connect('activate', () => {
            this._copyIPToClipboard();
        });
        this.menu.addMenuItem(this._copyIPItem);

        // View logs button
        const logsItem = new PopupMenu.PopupMenuItem('View Logs');
        logsItem.connect('activate', () => {
            try {
                Gio.Subprocess.new(
                    ['gnome-terminal', '--', 'bash', '-c', 'journalctl -u kerio-kvc.service -f'],
                    Gio.SubprocessFlags.NONE
                );
            } catch (e) {
                console.error('Failed to open logs:', e);
            }
        });
        this.menu.addMenuItem(logsItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Settings button
        const settingsItem = new PopupMenu.PopupMenuItem('Settings');
        settingsItem.connect('activate', () => {
            this._extension.openPreferences().catch(e => {
                console.error('Failed to open preferences:', e);
            });
        });
        this.menu.addMenuItem(settingsItem);
    }

    async _copyIPToClipboard() {
        const info = await this._vpnManager.getConnectionInfo();
        if (info && info.ip) {
            const clipboard = St.Clipboard.get_default();
            clipboard.set_text(St.ClipboardType.CLIPBOARD, info.ip);
            Main.notify('Kerio VPN', `IP address ${info.ip} copied to clipboard`);
        }
    }

    _onStateChanged(state) {
        this._updateState(state);
        this._showNotification(state);
        
        // Update connection info when connected
        if (state === VPN_STATES.CONNECTED) {
            this._startInfoUpdates();
        } else {
            this._stopInfoUpdates();
        }
    }

    _startInfoUpdates() {
        this._updateConnectionInfo();
        this._updateInfoInterval = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._updateConnectionInfo();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopInfoUpdates() {
        if (this._updateInfoInterval) {
            GLib.Source.remove(this._updateInfoInterval);
            this._updateInfoInterval = null;
        }
    }

    async _updateConnectionInfo() {
        if (!this._settings.get_boolean('show-connection-info')) {
            return;
        }

        const info = await this._vpnManager.getConnectionInfo();
        if (info) {
            this._ipItem.label.text = `IP: ${info.ip || '--'}`;
            this._serverItem.label.text = `Server: ${info.server}`;
            
            if (info.duration !== null) {
                const hours = Math.floor(info.duration / 3600);
                const minutes = Math.floor((info.duration % 3600) / 60);
                const seconds = info.duration % 60;
                const durationStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                this._durationItem.label.text = `Duration: ${durationStr}`;
            }
        }
    }

    _updateState(state) {
        let statusText = 'Unknown';
        let iconName = 'network-vpn-disconnected-symbolic';
        let connectSensitive = true;
        let disconnectSensitive = false;
        let reconnectSensitive = false;
        let copyIPSensitive = false;
        let showInfo = false;

        switch (state) {
            case VPN_STATES.CONNECTED:
                statusText = 'Connected';
                iconName = 'network-vpn-symbolic';
                connectSensitive = false;
                disconnectSensitive = true;
                reconnectSensitive = true;
                copyIPSensitive = true;
                showInfo = this._settings.get_boolean('show-connection-info');
                break;
            case VPN_STATES.CONNECTING:
                statusText = 'Connecting...';
                iconName = 'network-vpn-acquiring-symbolic';
                connectSensitive = false;
                disconnectSensitive = false;
                reconnectSensitive = false;
                break;
            case VPN_STATES.DISCONNECTED:
                statusText = 'Disconnected';
                iconName = 'network-vpn-disconnected-symbolic';
                connectSensitive = true;
                disconnectSensitive = false;
                reconnectSensitive = false;
                break;
            case VPN_STATES.DISCONNECTING:
                statusText = 'Disconnecting...';
                iconName = 'network-vpn-acquiring-symbolic';
                connectSensitive = false;
                disconnectSensitive = false;
                reconnectSensitive = false;
                break;
            case VPN_STATES.ERROR:
                statusText = 'Error';
                iconName = 'network-error-symbolic';
                connectSensitive = true;
                disconnectSensitive = true;
                reconnectSensitive = true;
                break;
        }

        this._icon.icon_name = iconName;
        this._statusItem.label.text = `Status: ${statusText}`;
        this._connectItem.setSensitive(connectSensitive);
        this._disconnectItem.setSensitive(disconnectSensitive);
        this._reconnectItem.setSensitive(reconnectSensitive);
        this._copyIPItem.setSensitive(copyIPSensitive);
        
        if (showInfo) {
            this._infoSection.actor.show();
        } else {
            this._infoSection.actor.hide();
        }
    }

    _showNotification(state) {
        if (!this._settings.get_boolean('show-notifications')) {
            return;
        }

        let title = 'Kerio VPN';
        let message = '';

        switch (state) {
            case VPN_STATES.CONNECTED:
                message = 'VPN Connected';
                break;
            case VPN_STATES.DISCONNECTED:
                message = 'VPN Disconnected';
                break;
            case VPN_STATES.ERROR:
                message = 'VPN Connection Error';
                break;
            default:
                return; // Don't notify for connecting/disconnecting states
        }

        Main.notify(title, message);
    }

    destroy() {
        this._stopInfoUpdates();
        this._vpnManager.stopMonitoring();
        super.destroy();
    }
});

export default class KerioVPNExtension extends Extension {
    enable() {
        this._indicator = new KerioVPNIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
