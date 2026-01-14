// Kerio VPN Configuration Manager
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const CONFIG_PATH = '/etc/kerio-kvc.conf';

export class KerioConfigManager {
    constructor() {
        this._config = null;
    }

    // Decode XOR encoded password
    _decodeXOR(hexString) {
        const XOR_KEY = 85;
        
        // Remove XOR: prefix if present
        const hex = hexString.replace(/^XOR:/, '');
        
        // Convert hex string to bytes and XOR decode
        let decoded = '';
        for (let i = 0; i < hex.length; i += 2) {
            const byte = parseInt(hex.substr(i, 2), 16);
            decoded += String.fromCharCode(byte ^ XOR_KEY);
        }
        
        return decoded;
    }

    // Encode password with XOR
    _encodeXOR(text) {
        const XOR_KEY = 85;
        
        // XOR encode each byte
        let encoded = '';
        for (let i = 0; i < text.length; i++) {
            const byte = text.charCodeAt(i) ^ XOR_KEY;
            encoded += byte.toString(16).padStart(2, '0');
        }
        
        // Add XOR: prefix
        return 'XOR:' + encoded;
    }

    // Read configuration
    async readConfig() {
        try {
            const file = Gio.File.new_for_path(CONFIG_PATH);
            const [success, contents] = file.load_contents(null);
            
            if (!success) {
                console.error('Failed to read Kerio config');
                return null;
            }

            const decoder = new TextDecoder('utf-8');
            const xml = decoder.decode(contents);

            // Parse XML manually (simple parser for this specific format)
            const config = {
                server: '',
                port: 4090,
                username: '',
                password: '',
                fingerprint: '',
                active: false
            };

            // Extract server and port
            const serverMatch = xml.match(/<server>(.*?)<\/server>/);
            if (serverMatch) {
                const serverPort = serverMatch[1].split(':');
                config.server = serverPort[0];
                if (serverPort[1]) {
                    config.port = parseInt(serverPort[1]);
                }
            }

            // Extract username
            const usernameMatch = xml.match(/<username>(.*?)<\/username>/);
            if (usernameMatch) {
                config.username = usernameMatch[1];
            }

            // Extract password
            const passwordMatch = xml.match(/<password>(.*?)<\/password>/);
            if (passwordMatch) {
                config.password = this._decodeXOR(passwordMatch[1]);
            }

            // Extract fingerprint
            const fingerprintMatch = xml.match(/<fingerprint>(.*?)<\/fingerprint>/);
            if (fingerprintMatch) {
                config.fingerprint = fingerprintMatch[1];
            }

            // Extract active status
            const activeMatch = xml.match(/<active>(.*?)<\/active>/);
            if (activeMatch) {
                config.active = activeMatch[1] === '1';
            }

            this._config = config;
            return config;
        } catch (e) {
            console.error('Error reading Kerio config:', e);
            return null;
        }
    }

    // Write configuration
    async writeConfig(config) {
        try {
            const server = config.server || '';
            const port = config.port || 4090;
            const username = config.username || '';
            const password = this._encodeXOR(config.password || '');
            const fingerprint = config.fingerprint || '';
            const active = config.active ? '1' : '0';

            const xml = `
<config>
  <connections>
    <connection type="persistent">
      <server>${server}:${port}</server>
      <username>${username}</username>
      <password>${password}</password>
      <fingerprint>${fingerprint}</fingerprint>
      <active>${active}</active>
    </connection>
  </connections>
</config>`;

            // Write to temporary file first
            const tmpFile = '/tmp/kerio-kvc.conf.tmp';
            const file = Gio.File.new_for_path(tmpFile);
            
            file.replace_contents(
                xml,
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );

            // Use sudo to move file to /etc (requires root)
            const proc = Gio.Subprocess.new(
                ['sudo', 'mv', tmpFile, CONFIG_PATH],
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

            // Restart service to apply changes
            const restartProc = Gio.Subprocess.new(
                ['sudo', 'systemctl', 'restart', 'kerio-kvc.service'],
                Gio.SubprocessFlags.NONE
            );

            await new Promise((resolve, reject) => {
                restartProc.wait_async(null, (proc, res) => {
                    try {
                        proc.wait_finish(res);
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            return true;
        } catch (e) {
            console.error('Error writing Kerio config:', e);
            return false;
        }
    }

    // Get current configuration
    getConfig() {
        return this._config;
    }
}
