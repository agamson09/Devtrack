# Virtual Display Driver (VDD) Setup Guide

## Problem
When a Windows server has no physical monitor connected (headless), the remote desktop agent shows a **black screen**. This is because Windows doesn't create a display output without a monitor.

## Solution
Install a **Virtual Display Driver (VDD)** that creates a fake monitor, allowing Windows to generate display output.

## Quick Setup

### Option 1: One-Click Install (Recommended)

1. Copy `install-vdd.bat` to the target PC
2. Right-click → **Run as Administrator**
3. Wait for installation to complete
4. **Restart the PC** (important!)
5. Start DevTrack Agent

### Option 2: PowerShell Install (Advanced)

```powershell
# Run PowerShell as Administrator
.\install-vdd.ps1

# Custom resolution
.\install-vdd.ps1 -Width 2560 -Height 1440

# Uninstall
.\install-vdd.ps1 -Uninstall
```

### Option 3: Programmatic (For Agent Integration)

```javascript
const { VDDControl } = require('./vdd-control');

// Auto-configure on agent startup
const vdd = new VDDControl({ width: 1920, height: 1080 });
const result = await vdd.autoConfigure();

if (result.needsRestart) {
    console.log('Please restart the PC to activate virtual display');
}
```

## Files

| File | Description |
|------|-------------|
| `install-vdd.bat` | Simple batch installer |
| `install-vdd.ps1` | Advanced PowerShell installer |
| `vdd-control.js` | Node.js module for agent integration |

## Troubleshooting

### Virtual display not showing after install
1. Make sure to **restart the PC**
2. Check Device Manager → Display adapters
3. Look for "IddSampleDriver" or "Virtual Display"

### Resolution not changing
1. Open Display Settings
2. Select the virtual display
3. Manually set resolution

### Agent still shows black screen
1. Verify VDD is installed: `vdd-control.js status`
2. Check if display is active
3. Restart the agent after VDD is active

## Technical Details

- Uses [IddSampleDriver](https://github.com/roshkins/IddSampleDriver) framework
- Creates virtual display via Windows Display Driver Model (WDDM)
- Compatible with Windows 10/11 and Server 2016+
- Does not affect existing physical displays (if any)

## Uninstall

```powershell
# PowerShell
.\install-vdd.ps1 -Uninstall

# Batch
# Edit install-vdd.bat, add: pnputil /delete-driver oemXX.inf /force
```
