const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');

// Ignore certificate errors for self-signed DevTrack SSL
app.commandLine.appendSwitch('ignore-certificate-errors');

// Suppress Chromium WebRTC stderr spam (Unable to get cursor info. Error = 5)
app.commandLine.appendSwitch('log-level', '3');

// FIX HEADLESS BLACK SCREEN: Disable HW acceleration forces GDI instead of DXGI
app.disableHardwareAcceleration();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: true, // Show window for debugging
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Allow renderer to use require()
      backgroundThrottling: false, // Keep high performance in background
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.webContents.openDevTools();

  // Request desktop capturer source from main process
  ipcMain.handle('GET_SOURCES', async (event, opts) => {
    return await desktopCapturer.getSources(opts);
  });

  // AUTO RDP UNLOCKER
  // Checks if the RDP session is disconnected and restores it to the console
  // so that WebRTC capture doesn't turn black.
  const { exec } = require('child_process');
  setInterval(() => {
    // Run the native batch loop to find the disconnected session and restore it
    // This is language-agnostic and more robust than parsing 'Disc'
    const cmd = `for /f "skip=1 tokens=1,2,3,4,5" %a in ('query user') do ( if "%b"=="Disc" ( tscon %c /dest:console ) else if "%c"=="Disc" ( tscon %d /dest:console ) else if "%d"=="Disc" ( tscon %e /dest:console ) )`;
    exec(cmd, (err) => {
      // Ignore errors, it runs silently in the background
    });
  }, 3000);
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
