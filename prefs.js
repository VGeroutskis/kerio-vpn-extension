import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class KerioVPNPreferences extends ExtensionPreferences {
    async fillPreferencesWindow(window) {
        const settings = this.getSettings();
        
        // Dynamically import KerioConfigManager
        const module = await import('./kerioConfig.js');
        const KerioConfigManager = module.KerioConfigManager;
        const configManager = new KerioConfigManager();

        // Create a preferences page
        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        // Connection Settings Group
        const connectionGroup = new Adw.PreferencesGroup({
            title: _('Connection Settings'),
            description: _('Configure VPN connection details (reads/writes /etc/kerio-kvc.conf)'),
        });
        page.add(connectionGroup);

        // VPN Server
        const serverRow = new Adw.EntryRow({
            title: _('VPN Server'),
            text: '',
        });
        connectionGroup.add(serverRow);

        // VPN Username
        const usernameRow = new Adw.EntryRow({
            title: _('Username'),
            text: '',
        });
        connectionGroup.add(usernameRow);

        // VPN Password
        const passwordRow = new Adw.PasswordEntryRow({
            title: _('Password'),
        });
        connectionGroup.add(passwordRow);

        // VPN Port
        const portRow = new Adw.SpinRow({
            title: _('VPN Port'),
            subtitle: _('Port for VPN connection'),
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 65535,
                step_increment: 1,
            }),
        });
        portRow.set_value(4090);
        connectionGroup.add(portRow);

        // VPN Fingerprint with Auto-detect
        const fingerprintRow = new Adw.EntryRow({
            title: _('Server Fingerprint'),
            text: '',
        });
        connectionGroup.add(fingerprintRow);

        // Auto-detect fingerprint button
        const autoDetectButton = new Gtk.Button({
            label: _('Auto-detect Fingerprint'),
            css_classes: ['flat'],
            margin_top: 6,
        });
        connectionGroup.add(autoDetectButton);

        autoDetectButton.connect('clicked', async () => {
            const server = serverRow.get_text();
            const port = portRow.get_value();
            
            if (!server) {
                autoDetectButton.set_label(_('✗ Enter server address first'));
                GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                    autoDetectButton.set_label(_('Auto-detect Fingerprint'));
                    return GLib.SOURCE_REMOVE;
                });
                return;
            }

            autoDetectButton.set_sensitive(false);
            autoDetectButton.set_label(_('Detecting...'));

            try {
                // Run openssl command to get fingerprint
                const proc = Gio.Subprocess.new(
                    ['bash', '-c', `echo | openssl s_client -connect ${server}:${port} 2>/dev/null | openssl x509 -fingerprint -md5 -noout | sed 's/.*=//'`],
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

                const fingerprint = stdout.trim();
                
                if (fingerprint && fingerprint.match(/^[A-F0-9:]+$/i)) {
                    fingerprintRow.set_text(fingerprint);
                    autoDetectButton.set_label(_('✓ Detected!'));
                } else {
                    autoDetectButton.set_label(_('✗ Detection failed'));
                }
            } catch (e) {
                console.error('Failed to detect fingerprint:', e);
                autoDetectButton.set_label(_('✗ Error'));
            }

            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                autoDetectButton.set_label(_('Auto-detect Fingerprint'));
                autoDetectButton.set_sensitive(true);
                return GLib.SOURCE_REMOVE;
            });
        });

        // Save button
        const saveButton = new Gtk.Button({
            label: _('Save to Kerio Config'),
            css_classes: ['suggested-action'],
            margin_top: 12,
        });
        connectionGroup.add(saveButton);

        saveButton.connect('clicked', async () => {
            const newConfig = {
                server: serverRow.get_text(),
                username: usernameRow.get_text(),
                password: passwordRow.get_text(),
                port: portRow.get_value(),
                fingerprint: fingerprintRow.get_text(),
                active: true
            };

            saveButton.set_sensitive(false);
            saveButton.set_label(_('Saving...'));

            const success = await configManager.writeConfig(newConfig);
            
            if (success) {
                saveButton.set_label(_('✓ Saved!'));
                GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                    saveButton.set_label(_('Save to Kerio Config'));
                    saveButton.set_sensitive(true);
                    return GLib.SOURCE_REMOVE;
                });
            } else {
                saveButton.set_label(_('✗ Failed'));
                GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                    saveButton.set_label(_('Save to Kerio Config'));
                    saveButton.set_sensitive(true);
                    return GLib.SOURCE_REMOVE;
                });
            }
        });

        // Load Kerio config
        let kerioConfig = null;
        configManager.readConfig().then(config => {
            kerioConfig = config;
            if (config) {
                // Update UI with loaded values
                serverRow.set_text(config.server);
                usernameRow.set_text(config.username);
                passwordRow.set_text(config.password);
                portRow.set_value(config.port);
                fingerprintRow.set_text(config.fingerprint || '');
            }
        }).catch(e => {
            console.error('Failed to load Kerio config:', e);
        });

        // Behavior Settings Group
        const behaviorGroup = new Adw.PreferencesGroup({
            title: _('Behavior'),
            description: _('Configure extension behavior'),
        });
        page.add(behaviorGroup);

        // Auto-connect switch
        const autoConnectRow = new Adw.SwitchRow({
            title: _('Auto-connect on startup'),
            subtitle: _('Automatically connect to VPN when extension loads'),
        });
        behaviorGroup.add(autoConnectRow);

        settings.bind(
            'auto-connect',
            autoConnectRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Auto-reconnect switch
        const autoReconnectRow = new Adw.SwitchRow({
            title: _('Auto-reconnect on disconnect'),
            subtitle: _('Automatically reconnect if VPN connection drops (up to 3 attempts)'),
        });
        behaviorGroup.add(autoReconnectRow);

        settings.bind(
            'auto-reconnect',
            autoReconnectRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Start minimized switch
        const startMinimizedRow = new Adw.SwitchRow({
            title: _('Start minimized'),
            subtitle: _('Don\'t show notifications on startup connection'),
        });
        behaviorGroup.add(startMinimizedRow);

        settings.bind(
            'start-minimized',
            startMinimizedRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Display Settings Group
        const displayGroup = new Adw.PreferencesGroup({
            title: _('Display'),
            description: _('Configure what information to display'),
        });
        page.add(displayGroup);

        // Show connection info switch
        const connectionInfoRow = new Adw.SwitchRow({
            title: _('Show connection info'),
            subtitle: _('Display IP address, server, and connection duration in menu'),
        });
        displayGroup.add(connectionInfoRow);

        settings.bind(
            'show-connection-info',
            connectionInfoRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Show notifications switch
        const notificationsRow = new Adw.SwitchRow({
            title: _('Show notifications'),
            subtitle: _('Display notifications on connection status changes'),
        });
        displayGroup.add(notificationsRow);

        settings.bind(
            'show-notifications',
            notificationsRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Monitoring interval
        const intervalRow = new Adw.SpinRow({
            title: _('Status check interval'),
            subtitle: _('How often to check VPN status (in seconds)'),
            adjustment: new Gtk.Adjustment({
                lower: 3,
                upper: 60,
                step_increment: 1,
            }),
        });
        intervalRow.set_value(settings.get_int('check-interval'));
        displayGroup.add(intervalRow);

        intervalRow.connect('changed', () => {
            settings.set_int('check-interval', intervalRow.get_value());
        });

        // Info group
        const infoGroup = new Adw.PreferencesGroup({
            title: _('Information'),
        });
        page.add(infoGroup);

        const infoRow = new Adw.ActionRow({
            title: _('Kerio VPN Extension'),
            subtitle: _('Control Kerio Connect VPN from GNOME Shell\nRequires kerio-kvc service installed'),
        });
        infoGroup.add(infoRow);

        // Instructions group
        const instructionsGroup = new Adw.PreferencesGroup({
            title: _('Usage'),
        });
        page.add(instructionsGroup);

        const instructionsRow = new Adw.ActionRow({
            title: _('Quick Actions'),
            subtitle: _('• Connect/Disconnect: Toggle VPN connection\n• Reconnect: Restart VPN connection\n• Copy IP: Copy VPN IP to clipboard\n• View Logs: Open service logs in terminal'),
        });
        instructionsGroup.add(instructionsRow);
    }
}
