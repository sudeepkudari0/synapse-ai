import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export interface AppSettings {
    version: number;
    sttEngine: 'whisper' | 'moonshine' | 'deepgram';
    whisperModel: string;
    moonshineModel: string;
    downloadedMoonshineModels: string[];
    deepgramApiKey: string;
    deepgramModel: string;
    geminiApiKey: string;
    groqApiKey: string;
    useOllamaOnly: boolean;
    ollamaModel: string;
    ollamaBaseUrl: string;
    interviewType: string;
    questionDetectionMode: 'regex' | 'llm' | 'hybrid';
    autoCaptureCodingMode: boolean;
    showDeliveryMetrics: boolean;
    interviewLanguage: string;
    isESLMode: boolean;
}

const CURRENT_VERSION = 9;

const DEFAULT_SETTINGS: AppSettings = {
    version: CURRENT_VERSION,
    sttEngine: 'moonshine',
    whisperModel: 'small.en',
    moonshineModel: 'MEDIUM_STREAMING',
    downloadedMoonshineModels: [],
    deepgramApiKey: '',
    deepgramModel: 'nova-3',
    geminiApiKey: '',
    groqApiKey: '',
    useOllamaOnly: false,
    ollamaModel: 'qwen3-vl:2b',
    ollamaBaseUrl: 'http://localhost:11434/v1',
    interviewType: 'general',
    questionDetectionMode: 'hybrid',
    autoCaptureCodingMode: false,
    showDeliveryMetrics: true,
    interviewLanguage: 'en',
    isESLMode: false,
};

// Migration map: version number -> transform function
const MIGRATIONS: Record<number, (settings: any) => any> = {
    1: (settings: any) => {
        // v1 -> v2: Add profile preferences
        return {
            ...settings,
            interviewType: 'general',
            questionDetectionMode: 'hybrid',
            version: 2,
        };
    },
    2: (settings: any) => {
        // v2 -> v3: Add coding mode and delivery metrics settings
        return {
            ...settings,
            autoCaptureCodingMode: false,
            showDeliveryMetrics: true,
            version: 3,
        };
    },
    3: (settings: any) => {
        // v3 -> v4: Add language and ESL mode
        return {
            ...settings,
            interviewLanguage: 'en',
            isESLMode: false,
            version: 4,
        };
    },
    4: (settings: any) => {
        // v4 -> v5: Add sttEngine
        return {
            ...settings,
            sttEngine: 'moonshine',
            version: 5,
        };
    },
    5: (settings: any) => {
        // v5 -> v6: Add moonshineModel
        return {
            ...settings,
            moonshineModel: 'MEDIUM_STREAMING',
            version: 6,
        };
    },
    6: (settings: any) => {
        // v6 -> v7: Add downloadedMoonshineModels
        return {
            ...settings,
            downloadedMoonshineModels: [],
            version: 7,
        };
    },
    7: (settings: any) => {
        // v7 -> v8: Add Deepgram STT support
        return {
            ...settings,
            deepgramApiKey: '',
            version: 8,
        };
    },
    8: (settings: any) => {
        // v8 -> v9: Add Deepgram Model support
        return {
            ...settings,
            deepgramModel: 'nova-3',
            version: 9,
        };
    },
};

let settingsCache: AppSettings | null = null;

function getSettingsPath(): string {
    return path.join(app.getPath('userData'), 'settings.json');
}

function runMigrations(settings: any): AppSettings {
    let currentVersion = settings.version || 1;
    let migratedSettings = { ...settings };

    while (currentVersion < CURRENT_VERSION) {
        const migrationFn = MIGRATIONS[currentVersion];
        if (migrationFn) {
            migratedSettings = migrationFn(migratedSettings);
            currentVersion = migratedSettings.version;
        } else {
            // Missing migration path, just force to current version and merge defaults
            console.warn(`Missing migration for version ${currentVersion}`);
            migratedSettings.version = CURRENT_VERSION;
            currentVersion = CURRENT_VERSION;
        }
    }

    return { ...DEFAULT_SETTINGS, ...migratedSettings };
}

export function getSettings(): AppSettings {
    if (settingsCache) return settingsCache;

    const settingsPath = getSettingsPath();
    if (!fs.existsSync(settingsPath)) {
        settingsCache = { ...DEFAULT_SETTINGS };
        saveSettings(settingsCache);
        return settingsCache;
    }

    try {
        const data = fs.readFileSync(settingsPath, 'utf-8');
        const parsed = JSON.parse(data);
        
        // Run migrations if needed
        const newSettings = runMigrations(parsed);
        
        // Save if migrations occurred
        if (!parsed.version || parsed.version < CURRENT_VERSION) {
            fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2), 'utf-8');
        }

        settingsCache = newSettings;
        return newSettings;
    } catch (error) {
        console.error('Failed to parse settings.json:', error);
        const newSettings = { ...DEFAULT_SETTINGS };
        settingsCache = newSettings;
        return newSettings;
    }
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
    const current = getSettings();
    const updated = { ...current, ...settings, version: CURRENT_VERSION };
    
    try {
        const settingsPath = getSettingsPath();
        fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2), 'utf-8');
        settingsCache = updated;
    } catch (error) {
        console.error('Failed to save settings.json:', error);
    }
    
    return updated;
}
