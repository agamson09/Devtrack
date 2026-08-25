/**
 * VDD Control - Virtual Display Driver Management
 * 
 * This module provides programmatic control over the Virtual Display Driver
 * for headless remote desktop scenarios.
 * 
 * Usage:
 *   const { VDDControl } = require('./vdd-control');
 *   const vdd = new VDDControl();
 *   
 *   // Check status
 *   const status = await vdd.getStatus();
 *   console.log(status);
 *   
 *   // Set resolution
 *   await vdd.setResolution(1920, 1080, 60);
 *   
 *   // Ensure display is active (for agent startup)
 *   await vdd.ensureDisplay();
 */

const { execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class VDDControl {
    constructor(options = {}) {
        this.width = options.width || 1920;
        this.height = options.height || 1080;
        this.frequency = options.frequency || 60;
        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelay = options.retryDelay || 2000;
    }

    /**
     * Execute a command and return output
     */
    execCommand(command, options = {}) {
        return new Promise((resolve, reject) => {
            exec(command, { 
                encoding: 'utf8',
                timeout: options.timeout || 30000,
                windowsHide: true
            }, (error, stdout, stderr) => {
                if (error && !options.ignoreError) {
                    reject(error);
                } else {
                    resolve({ stdout, stderr, exitCode: error ? error.code : 0 });
                }
            });
        });
    }

    /**
     * Execute a command synchronously
     */
    execCommandSync(command) {
        try {
            return execSync(command, { 
                encoding: 'utf8',
                windowsHide: true 
            }).trim();
        } catch (error) {
            return null;
        }
    }

    /**
     * Check if running as administrator
     */
    async isAdmin() {
        try {
            const result = await this.execCommand('net session >nul 2>&1');
            return result.exitCode === 0;
        } catch {
            return false;
        }
    }

    /**
     * Check if VDD driver is installed
     */
    async isDriverInstalled() {
        const output = this.execCommandSync('pnputil /enum-drivers');
        return output && output.toLowerCase().includes('iddsampledriver');
    }

    /**
     * Get list of active displays
     */
    async getDisplays() {
        const ps = `
            Get-CimInstance Win32_VideoController | 
            Select-Object Name, CurrentHorizontalResolution, CurrentVerticalResolution, Status, AdapterRAM |
            ConvertTo-Json
        `;
        
        try {
            const result = await this.execCommand(`powershell -Command "${ps}"`);
            const displays = JSON.parse(result.stdout);
            return Array.isArray(displays) ? displays : [displays];
        } catch {
            return [];
        }
    }

    /**
     * Find virtual display in the list
     */
    async findVirtualDisplay() {
        const displays = await this.getDisplays();
        return displays.find(d => 
            d.Name && (
                d.Name.toLowerCase().includes('iddsample') ||
                d.Name.toLowerCase().includes('virtual')
            )
        );
    }

    /**
     * Get current VDD status
     */
    async getStatus() {
        const installed = await this.isDriverInstalled();
        const virtualDisplay = await this.findVirtualDisplay();
        const isAdmin = await this.isAdmin();
        
        return {
            installed,
            active: !!virtualDisplay,
            display: virtualDisplay || null,
            resolution: virtualDisplay ? {
                width: virtualDisplay.CurrentHorizontalResolution,
                height: virtualDisplay.CurrentVerticalResolution
            } : null,
            isAdmin,
            currentConfig: {
                width: this.width,
                height: this.height,
                frequency: this.frequency
            }
        };
    }

    /**
     * Install VDD driver
     */
    async installDriver() {
        if (!await this.isAdmin()) {
            throw new Error('Administrator privileges required');
        }

        if (await this.isDriverInstalled()) {
            console.log('[VDD] Driver already installed');
            return true;
        }

        console.log('[VDD] Installing driver...');

        // Check for local driver files
        const agentDir = path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'DevTrack Agent');
        const vddPaths = [
            path.join(agentDir, 'driver', 'IddSampleDriver.inf'),
            path.join(__dirname, '..', 'driver', 'IddSampleDriver.inf'),
            'C:\\IddSampleDriver\\IddSampleDriver.inf'
        ];

        let infPath = null;
        for (const p of vddPaths) {
            if (fs.existsSync(p)) {
                infPath = p;
                break;
            }
        }

        if (!infPath) {
            throw new Error('VDD driver files not found. Please download from: https://github.com/roshkins/IddSampleDriver');
        }

        const result = await this.execCommand(`pnputil /add-driver "${infPath}" /install`, {
            ignoreError: true
        });

        if (result.exitCode !== 0) {
            // Try alternative method
            await this.execCommand(`rundll32.exe setupapi.dll,InstallHinfSection DefaultInstall 132 "${infPath}"`);
        }

        console.log('[VDD] Driver installed successfully');
        return true;
    }

    /**
     * Remove VDD driver
     */
    async removeDriver() {
        if (!await this.isAdmin()) {
            throw new Error('Administrator privileges required');
        }

        console.log('[VDD] Removing driver...');

        const output = this.execCommandSync('pnputil /enum-drivers');
        if (!output) return true;

        const lines = output.split('\n');
        let currentOem = null;

        for (const line of lines) {
            if (line.includes('IddSampleDriver')) {
                // Found driver, get OEM name from context
                const match = line.match(/(oem\d+\.inf)/i);
                if (match) {
                    currentOem = match[1];
                }
            }
        }

        if (currentOem) {
            await this.execCommand(`pnputil /delete-driver ${currentOem} /force`, {
                ignoreError: true
            });
            console.log(`[VDD] Removed driver: ${currentOem}`);
        }

        return true;
    }

    /**
     * Set virtual display resolution using PowerShell
     */
    async setResolution(width, height, frequency = 60) {
        this.width = width;
        this.height = height;
        this.frequency = frequency;

        if (!await this.isAdmin()) {
            throw new Error('Administrator privileges required');
        }

        console.log(`[VDD] Setting resolution to ${width}x${height}@${frequency}Hz`);

        // Method 1: Use QRes if available
        try {
            await this.execCommand(`qres -x ${width} -y ${height} -r ${frequency}`);
            console.log('[VDD] Resolution set via QRes');
            return true;
        } catch {
            // QRes not available, continue
        }

        // Method 2: Use PowerShell with display settings
        const psScript = `
            Add-Type -TypeDefinition @"
                using System;
                using System.Runtime.InteropServices;
                
                public class DisplaySettings {
                    [DllImport("user32.dll")]
                    public static extern int EnumDisplaySettings(string deviceName, int modeNum, ref DEVMODE devMode);
                    
                    [DllImport("user32.dll")]
                    public static extern int ChangeDisplaySettings(ref DEVMODE devMode, int flags);
                    
                    [StructLayout(LayoutKind.Sequential)]
                    public struct DEVMODE {
                        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
                        public string dmDeviceName;
                        public short dmSpecVersion;
                        public short dmDriverVersion;
                        public short dmSize;
                        public short dmDriverExtra;
                        public int dmFields;
                        public int dmPositionX;
                        public int dmPositionY;
                        public int dmDisplayOrientation;
                        public int dmDisplayFixedOutput;
                        public short dmColor;
                        public short dmDuplex;
                        public short dmYResolution;
                        public short dmTTOption;
                        public short dmCollate;
                        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
                        public string dmFormName;
                        public short dmLogPixels;
                        public int dmBitsPerPel;
                        public int dmPelsWidth;
                        public int dmPelsHeight;
                        public int dmDisplayFlags;
                        public int dmDisplayFrequency;
                    }
                }
"@

            $dm = New-Object DisplaySettings+DEVMODE
            $dm.dmSize = [System.Runtime.InteropServices.Marshal]::SizeOf($dm)
            $dm.dmPelsWidth = ${width}
            $dm.dmPelsHeight = ${height}
            $dm.dmDisplayFrequency = ${frequency}
            $dm.dmFields = 0x1 -bor 0x4 -bor 0x20000
            
            $result = [DisplaySettings]::ChangeDisplaySettings([ref]$dm, 0)
            if ($result -eq 0) { "OK" } else { "Failed: $result" }
        `;

        try {
            const result = await this.execCommand(`powershell -Command "${psScript}"`);
            if (result.stdout.includes('OK')) {
                console.log('[VDD] Resolution set via Windows API');
                return true;
            }
        } catch {
            // Continue to fallback
        }

        console.log('[VDD] Resolution will be applied on next restart');
        return false;
    }

    /**
     * Ensure virtual display is active (for agent startup)
     * Returns true if display is ready, false if intervention needed
     */
    async ensureDisplay() {
        console.log('[VDD] Checking display status...');

        // Check if driver is installed
        if (!await this.isDriverInstalled()) {
            console.log('[VDD] Driver not installed, attempting installation...');
            try {
                await this.installDriver();
            } catch (error) {
                console.error(`[VDD] Installation failed: ${error.message}`);
                return false;
            }
        }

        // Check if virtual display is active
        const virtualDisplay = await this.findVirtualDisplay();
        if (virtualDisplay) {
            console.log(`[VDD] Virtual display active: ${virtualDisplay.Name}`);
            console.log(`[VDD] Resolution: ${virtualDisplay.CurrentHorizontalResolution}x${virtualDisplay.CurrentVerticalResolution}`);
            return true;
        }

        // Virtual display not found, may need restart
        console.log('[VDD] Virtual display not detected. May need restart.');
        return false;
    }

    /**
     * Auto-configure for agent use
     * Call this on agent startup to ensure headless RDP works
     */
    async autoConfigure() {
        console.log('[VDD] Auto-configuring for headless RDP...');

        const status = await this.getStatus();
        
        if (!status.installed) {
            console.log('[VDD] Installing driver...');
            await this.installDriver();
        }

        if (!status.active) {
            console.log('[VDD] Virtual display not active');
            
            // Try to set resolution (may need restart)
            await this.setResolution(this.width, this.height, this.frequency);
            
            return {
                success: false,
                message: 'Virtual display driver installed but restart required',
                needsRestart: true
            };
        }

        // Display is active, ensure correct resolution
        if (status.resolution) {
            const currentPixels = status.resolution.width * status.resolution.height;
            const targetPixels = this.width * this.height;
            
            if (Math.abs(currentPixels - targetPixels) > 100000) {
                console.log('[VDD] Adjusting resolution...');
                await this.setResolution(this.width, this.height, this.frequency);
            }
        }

        return {
            success: true,
            message: 'Virtual display ready',
            display: status.display
        };
    }
}

// ============================================================
// CLI Interface
// ============================================================

if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0] || 'status';

    const vdd = new VDDControl({
        width: parseInt(args[1]) || 1920,
        height: parseInt(args[2]) || 1080,
        frequency: parseInt(args[3]) || 60
    });

    async function main() {
        switch (command.toLowerCase()) {
            case 'status':
                const status = await vdd.getStatus();
                console.log('\n=== VDD Status ===');
                console.log(`Installed: ${status.installed ? '✓' : '✗'}`);
                console.log(`Active: ${status.active ? '✓' : '✗'}`);
                console.log(`Admin: ${status.isAdmin ? '✓' : '✗'}`);
                if (status.display) {
                    console.log(`Display: ${status.display.Name}`);
                    console.log(`Resolution: ${status.resolution.width}x${status.resolution.height}`);
                }
                break;

            case 'install':
                await vdd.installDriver();
                break;

            case 'remove':
            case 'uninstall':
                await vdd.removeDriver();
                break;

            case 'resolution':
            case 'res':
                const w = parseInt(args[1]) || 1920;
                const h = parseInt(args[2]) || 1080;
                const r = parseInt(args[3]) || 60;
                await vdd.setResolution(w, h, r);
                break;

            case 'configure':
            case 'auto':
                const result = await vdd.autoConfigure();
                console.log('\nResult:', result);
                break;

            case 'ensure':
                const ready = await vdd.ensureDisplay();
                process.exit(ready ? 0 : 1);
                break;

            default:
                console.log('Usage: vdd-control.js <command> [options]');
                console.log('');
                console.log('Commands:');
                console.log('  status              Show VDD status');
                console.log('  install             Install VDD driver');
                console.log('  remove              Remove VDD driver');
                console.log('  resolution [W] [H] [R]  Set resolution');
                console.log('  configure           Auto-configure for headless');
                console.log('  ensure              Ensure display is active');
        }
    }

    main().catch(console.error);
}

module.exports = { VDDControl };
