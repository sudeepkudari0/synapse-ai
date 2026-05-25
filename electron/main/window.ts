import { BrowserWindow, app, screen } from 'electron';
import path from 'path';

// Full-screen transparent overlay — widget sizing is CSS-driven in the renderer.
// This allows dynamic content height and proper full-screen region capture.

// In CommonJS, __dirname is available natively
declare const __dirname: string;

export function createMainWindow(): BrowserWindow {
    // Cover the entire work area so the widget can grow dynamically
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // Resolve icon – in dev it's at project root; in production electron-builder
    // copies buildResources into the app directory.
    const possibleIconPaths = [
        path.join(app.getAppPath(), 'build', 'icon.ico'),
        path.join(process.resourcesPath, 'icon.ico'),
        path.join(__dirname, '../../build/icon.ico'),
    ];
    const iconPath = possibleIconPaths.find(p => {
        try { return require('fs').existsSync(p); } catch { return false; }
    });

    const mainWindow = new BrowserWindow({
        width: screenWidth,
        height: screenHeight,
        x: 0,
        y: 0,
        frame: false,
        transparent: process.env.NODE_ENV !== 'test',
        alwaysOnTop: true,
        skipTaskbar: process.env.NODE_ENV !== 'test',
        resizable: false,
        backgroundColor: process.env.NODE_ENV === 'test' ? '#1a1a1a' : '#00000000',
        show: false,
        focusable: true,
        hasShadow: false,
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });


    // Use app.isPackaged for more reliable production detection
    const isPackaged = app.isPackaged;
    const isDev = !isPackaged && process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';

    // Grant media permissions for audio capture
    mainWindow.webContents.session.setPermissionRequestHandler(
        (webContents, permission, callback) => {
            if (permission === 'media') {
                callback(true);
            } else {
                callback(false);
            }
        }
    );

    // Show window when ready to prevent blank/invisible window
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        // Enable click-through by default — transparent areas pass clicks to underlying apps.
        // The renderer toggles this off when cursor enters interactive UI elements.
        mainWindow.setIgnoreMouseEvents(true, { forward: true });

        // Apply content protection after the window is shown.
        // On Windows, calling this before the window is fully visible often fails
        // to register the WDA_EXCLUDEFROMCAPTURE flag correctly.
        setTimeout(() => {
            if (!mainWindow.isDestroyed()) {
                // Toggle to ensure the OS registers the change
                mainWindow.setContentProtection(false);
                mainWindow.setContentProtection(true);
            }
        }, 100);
    });

    // Load the app
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        // Open DevTools in development for debugging
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        // In production, the path is relative to the app.asar or app folder
        const indexPath = path.join(__dirname, '../../dist/index.html');
        mainWindow.loadFile(indexPath);
    }

    // Log any load failures
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Failed to load:', errorCode, errorDescription);
    });

    mainWindow.on('closed', () => {
        // Dereference handled by caller
    });

    return mainWindow;
}
