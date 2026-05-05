import { BrowserWindow, app, screen } from 'electron';
import path from 'path';

// Fixed widget dimensions — window never resizes.
// Content visibility is controlled by CSS, not Electron setBounds().
const WIDGET_WIDTH = 420;
const WIDGET_HEIGHT = 600;

// In CommonJS, __dirname is available natively
declare const __dirname: string;

export function createMainWindow(): BrowserWindow {
    // Get primary display dimensions — position top-right
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth } = primaryDisplay.workAreaSize;

    // Position: top-right corner with some margin
    const posX = screenWidth - WIDGET_WIDTH - 24;
    const posY = 24;

    const mainWindow = new BrowserWindow({
        width: WIDGET_WIDTH,
        height: WIDGET_HEIGHT,
        x: posX,
        y: posY,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        backgroundColor: '#00000000',
        show: false,
        focusable: true,
        hasShadow: false,
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });


    // Use app.isPackaged for more reliable production detection
    const isPackaged = app.isPackaged;
    const isDev = !isPackaged && process.env.NODE_ENV !== 'production';

    // Enable content protection (excludes from screen capture on Windows)
    mainWindow.setContentProtection(true);

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
