import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface SettingsPanelProps {
    onClose: () => void;
    onSettingsChanged: () => void;
}

export function SettingsPanel({ onClose, onSettingsChanged }: SettingsPanelProps) {
    const [activeTab, setActiveTab] = useState<'models' | 'api'>('models');
    const [models, setModels] = useState<string[]>([]);
    const [settings, setSettings] = useState({
        whisperModel: 'small.en',
        geminiApiKey: '',
        groqApiKey: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const modelsRes = await window.electronAPI.getAvailableModels();
            if (modelsRes.success && modelsRes.models) {
                setModels(modelsRes.models);
            }

            const settingsRes = await window.electronAPI.getSettings();
            if (settingsRes.success && settingsRes.settings) {
                setSettings({
                    whisperModel: settingsRes.settings.whisperModel || 'small.en',
                    geminiApiKey: settingsRes.settings.geminiApiKey || '',
                    groqApiKey: settingsRes.settings.groqApiKey || ''
                });
            }
        } catch (error) {
            console.error('Failed to load settings data:', error);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await window.electronAPI.updateSettings(settings);
            onSettingsChanged();
            onClose();
        } catch (error) {
            console.error('Failed to save settings:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col border-t border-[var(--border-subtle)] animate-slide-up bg-zinc-900">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
                <h2 className="text-sm font-semibold text-white">Settings</h2>
                <button 
                    onClick={onClose}
                    className="p-1 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-800 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

                {/* Tabs */}
                <div className="flex border-b border-zinc-800">
                    <button
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                            activeTab === 'models' 
                                ? 'text-indigo-400 border-b-2 border-indigo-500' 
                                : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50'
                        }`}
                        onClick={() => setActiveTab('models')}
                    >
                        Whisper Models
                    </button>
                    <button
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                            activeTab === 'api' 
                                ? 'text-indigo-400 border-b-2 border-indigo-500' 
                                : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50'
                        }`}
                        onClick={() => setActiveTab('api')}
                    >
                        API Keys
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 min-h-[200px]">
                    {activeTab === 'models' ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-1">
                                    Active Whisper Model
                                </label>
                                <select
                                    value={settings.whisperModel}
                                    onChange={(e) => setSettings({ ...settings, whisperModel: e.target.value })}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {models.length === 0 ? (
                                        <option value={settings.whisperModel}>{settings.whisperModel} (Not found)</option>
                                    ) : (
                                        models.map(model => (
                                            <option key={model} value={model}>
                                                {model}
                                            </option>
                                        ))
                                    )}
                                </select>
                                <p className="mt-2 text-xs text-zinc-500">
                                    Select the transcription model to use. You must download models using the setup script first.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-1">
                                    Gemini API Key
                                </label>
                                <input
                                    type="password"
                                    value={settings.geminiApiKey}
                                    onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                                    placeholder="AIza..."
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-1">
                                    Groq API Key (Fallback)
                                </label>
                                <input
                                    type="password"
                                    value={settings.groqApiKey}
                                    onChange={(e) => setSettings({ ...settings, groqApiKey: e.target.value })}
                                    placeholder="gsk_..."
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <p className="mt-2 text-xs text-zinc-500">
                                Gemini is used as the primary LLM for screen analysis. Groq is used as a fast fallback.
                            </p>
                        </div>
                    )}
                </div>

            {/* Footer */}
            <div className="flex items-center justify-end px-4 py-3 border-t border-zinc-800 bg-zinc-900/50">
                <button
                    onClick={onClose}
                    className="px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors mr-2"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {isSaving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>
        </div>
    );
}
