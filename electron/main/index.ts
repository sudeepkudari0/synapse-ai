import { app, BrowserWindow, globalShortcut } from 'electron';
import { createMainWindow } from './window';
import { registerIPCHandlers, registerGlobalShortcuts } from './ipc-handlers';
import path from 'path';
import fs from 'fs';

function loadEnvFile() {
    const candidates = [
        path.join(app.getAppPath(), '.env'),
        path.join(__dirname, '..', '..', '.env'),
        path.join(process.resourcesPath, '.env'),
    ];

    for (const envPath of candidates) {
        try {
            if (!fs.existsSync(envPath)) continue;
            const content = fs.readFileSync(envPath, 'utf-8');
            const lines = content.split(/\r?\n/);
            let loaded = 0;
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                const match = trimmed.match(/^([^=]+?)\s*=\s*(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    let value = match[2].trim();
                    // Strip surrounding quotes
                    if ((value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }
                    process.env[key] = value;
                    loaded++;
                }
            }
            console.log(`[env] Loaded ${loaded} variables from: ${envPath}`);
            return;
        } catch (err) {
            console.warn(`[env] Failed to read ${envPath}:`, err);
        }
    }
    console.warn('[env] No .env file found in any candidate path');
}
loadEnvFile();

// Enable Web Speech API in Electron (even though we're not using it, good for compatibility)
app.commandLine.appendSwitch('enable-speech-dispatcher');

let mainWindow: BrowserWindow | null = null;

// Initialize app
app.whenReady().then(() => {
    // Register IPC handlers before creating window
    registerIPCHandlers();

    // Create main window
    mainWindow = createMainWindow();

    // Register global keyboard shortcuts
    registerGlobalShortcuts(mainWindow);

    app.on('activate', () => {
        // On macOS, recreate window when dock icon is clicked
        if (BrowserWindow.getAllWindows().length === 0) {
            mainWindow = createMainWindow();
            registerGlobalShortcuts(mainWindow);
        }
    });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
    mainWindow = null;
});

// Unregister shortcuts on quit
app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

// Handle app closing — kill the whisper-server background process
app.on('before-quit', async () => {
    try {
        const { getTranscriber } = await import('./whisper/transcriber');
        const transcriber = getTranscriber();
        await transcriber.dispose();
    } catch {
        // Ignore cleanup errors during shutdown
    }
});
