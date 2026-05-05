import { contextBridge, ipcRenderer } from 'electron';

// Inline IPC channel names to avoid import issues
const IPC_CHANNELS = {
    WHISPER_LOAD_MODEL: 'whisper:load-model',
    WHISPER_TRANSCRIBE: 'whisper:transcribe',
    WHISPER_STATUS: 'whisper:status',
    GET_DESKTOP_SOURCES: 'get-desktop-sources',
    SET_IGNORE_MOUSE_EVENTS: 'window:set-ignore-mouse-events',
    MOVE_WINDOW: 'window:move',
    CAPTURE_SCREEN: 'screen:capture',
    ANALYZE_SCREEN: 'screen:analyze',
    CAPTURE_AND_ANALYZE: 'screen:capture-and-analyze',
    QUIT_APP: 'app:quit',
} as const;

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Platform info
    platform: process.platform,

    // Desktop capturer API
    getDesktopSources: async () => {
        return await ipcRenderer.invoke(IPC_CHANNELS.GET_DESKTOP_SOURCES);
    },

    // Window control API
    setIgnoreMouseEvents: async (ignore: boolean) => {
        return await ipcRenderer.invoke(IPC_CHANNELS.SET_IGNORE_MOUSE_EVENTS, ignore);
    },

    moveWindow: async (deltaX: number, deltaY: number) => {
        return await ipcRenderer.invoke(IPC_CHANNELS.MOVE_WINDOW, deltaX, deltaY);
    },

    // Whisper API
    whisper: {
        loadModel: async (modelName: string = 'small.en') => {
            return await ipcRenderer.invoke(IPC_CHANNELS.WHISPER_LOAD_MODEL, modelName);
        },

        transcribe: async (audioData: Float32Array) => {
            // Convert Float32Array to regular array for IPC transfer
            const dataArray = Array.from(audioData);
            return await ipcRenderer.invoke(IPC_CHANNELS.WHISPER_TRANSCRIBE, dataArray);
        },

        getStatus: async () => {
            return await ipcRenderer.invoke(IPC_CHANNELS.WHISPER_STATUS);
        },
    },

    // Screen API
    captureScreen: async (sourceId?: string) => {
        return await ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_SCREEN, sourceId);
    },

    analyzeScreen: async (imageData: string, prompt?: string, context?: string) => {
        return await ipcRenderer.invoke(IPC_CHANNELS.ANALYZE_SCREEN, {
            imageData,
            prompt,
            context,
        });
    },

    // One-shot capture + analyze (no UI needed)
    captureAndAnalyze: async (prompt?: string) => {
        return await ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_AND_ANALYZE, prompt);
    },

    // LLM API
    llmGenerate: async (options: any) => {
        return await ipcRenderer.invoke('llm:generate', options);
    },

    // App control API
    quitApp: async () => {
        return await ipcRenderer.invoke(IPC_CHANNELS.QUIT_APP);
    },

    // Shortcut listeners — renderer subscribes to global shortcut events
    onShortcut: (channel: string, callback: () => void) => {
        const validChannels = [
            'shortcut:capture-screen',
            'shortcut:generate-answer',
            'shortcut:toggle-widget',
            'shortcut:toggle-recording',
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, callback);
            return () => ipcRenderer.removeListener(channel, callback);
        }
        return () => {};
    },
});
