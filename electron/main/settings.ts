import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export interface AppSettings {
    whisperModel: string;
    geminiApiKey: string;
    groqApiKey: string;
}

const DEFAULT_SETTINGS: AppSettings = {
    whisperModel: 'small.en',
    geminiApiKey: '',
    groqApiKey: '',
};

let settingsCache: AppSettings | null = null;

function getSettingsPath(): string {
    return path.join(app.getPath('userData'), 'settings.json');
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
        const newSettings = { ...DEFAULT_SETTINGS, ...parsed };
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
    const updated = { ...current, ...settings };
    
    try {
        const settingsPath = getSettingsPath();
        fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2), 'utf-8');
        settingsCache = updated;
    } catch (error) {
        console.error('Failed to save settings.json:', error);
    }
    
    return updated;
}
