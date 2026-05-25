/**
 * IPC Test Bridge — Helpers for interacting with the Electron app under test.
 *
 * Provides methods to:
 * - Inject audio into the STT pipeline via IPC
 * - Read app state (conversation, answers, candidate questions)
 * - Switch STT engines and models
 * - Trigger UI actions programmatically
 */

import { ElectronApplication, Page } from '@playwright/test';

// ─── STT Engine Management ──────────────────────────────────────────

export type STTEngine = 'whisper' | 'moonshine' | 'deepgram';

export interface EngineConfig {
    engine: STTEngine;
    model?: string;
    apiKey?: string;
}

/**
 * Switch the STT engine by updating settings and re-initializing the transcriber.
 * Returns true if the engine was successfully initialized.
 */
export async function switchSTTEngine(
    electronApp: ElectronApplication,
    config: EngineConfig
): Promise<boolean> {
    // Update settings via IPC
    const updateResult = await electronApp.evaluate(
        async ({ ipcMain }, cfg) => {
            // Dynamically import to access settings in main process context
            const req = (global as any).__TEST_REQUIRE__;
            const { getSettings, saveSettings } = req('./settings');
            const current = getSettings();
            const updated = {
                ...current,
                sttEngine: cfg.engine,
            };

            if (cfg.engine === 'whisper' && cfg.model) {
                updated.whisperModel = cfg.model;
            } else if (cfg.engine === 'moonshine' && cfg.model) {
                updated.moonshineModel = cfg.model;
            } else if (cfg.engine === 'deepgram' && cfg.apiKey) {
                updated.deepgramApiKey = cfg.apiKey;
                if (cfg.model) updated.deepgramModel = cfg.model;
            }

            saveSettings(updated);
            return { success: true, settings: updated };
        },
        config
    );

    if (!updateResult.success) return false;

    // Re-initialize the transcriber with the new engine
    const initResult = await electronApp.evaluate(
        async ({ ipcMain }, modelName) => {
            const req = (global as any).__TEST_REQUIRE__;
            const { getTranscriber } = req('./whisper/transcriber');
            try {
                const transcriber = getTranscriber();
                await transcriber.dispose(); // Tear down old engine
                await transcriber.initialize(modelName);
                return { success: true };
            } catch (error) {
                return { success: false, error: String(error) };
            }
        },
        config.model || 'small.en'
    );

    return initResult.success;
}

/**
 * Configure the LLM provider in settings for testing.
 */
export async function switchLLMProvider(
    electronApp: ElectronApplication,
    provider: 'ollama' | 'groq' | 'gemini',
    apiKey?: string
): Promise<boolean> {
    const updateResult = await electronApp.evaluate(
        async ({ ipcMain }, { provider, apiKey }) => {
            const req = (global as any).__TEST_REQUIRE__;
            const { getSettings, saveSettings } = req('./settings');
            const current = getSettings();
            
            const updated = { ...current };
            updated.useOllamaOnly = (provider === 'ollama');
            
            if (provider === 'groq') {
                updated.groqApiKey = apiKey || process.env.GROQ_API_KEY || '';
                updated.geminiApiKey = ''; // Force Groq
            } else if (provider === 'gemini') {
                updated.geminiApiKey = apiKey || process.env.GEMINI_API_KEY || '';
            }
            
            saveSettings(updated);
            return { success: true, settings: updated };
        },
        { provider, apiKey }
    );
    
    return updateResult.success;
}

/**
 * Check if an STT engine binary exists (for Whisper/Moonshine).
 */
export async function checkSTTServerExists(
    electronApp: ElectronApplication,
    engine: 'whisper' | 'moonshine'
): Promise<boolean> {
    const result = await electronApp.evaluate(
        async ({ ipcMain }, eng) => {
            const req = (global as any).__TEST_REQUIRE__;
            const path = req('path');
            const fs = req('fs');
            const { app } = req('electron');

            const exeName = eng === 'whisper' ? 'whisper-server.exe' : 'moonshine-server.exe';
            let basePath = app.getAppPath();
            if (basePath.includes('dist-electron')) {
                basePath = path.join(basePath, '..', '..');
            }
            basePath = app.isPackaged
                ? path.join(process.resourcesPath, 'whisper')
                : path.join(basePath, 'native', 'whisper');
            return fs.existsSync(path.join(basePath, exeName));
        },
        engine
    );
    return result;
}

// ─── Audio Injection ────────────────────────────────────────────────

export interface TranscriptionResult {
    success: boolean;
    text: string;
    words?: any[];
    error?: string;
    latencyMs: number;
}

/**
 * Send raw audio data to the STT transcriber via IPC and return the transcription.
 * This bypasses the renderer's audio capture and directly hits the main process transcriber.
 */
export async function transcribeAudio(
    electronApp: ElectronApplication,
    audioData: Float32Array,
    prompt?: string
): Promise<TranscriptionResult> {
    const audioArray = Array.from(audioData);

    const result = await electronApp.evaluate(
        async ({ ipcMain }, { audioArray, prompt }) => {
            const req = (global as any).__TEST_REQUIRE__;
            const { getTranscriber } = req('./whisper/transcriber');
            const transcriber = getTranscriber();

            const startTime = Date.now();
            try {
                const float32Audio = new Float32Array(audioArray);
                const result = await transcriber.transcribe(float32Audio, prompt);
                const latencyMs = Date.now() - startTime;
                return {
                    success: true,
                    text: result.text.trim(),
                    words: result.words,
                    latencyMs,
                };
            } catch (error) {
                return {
                    success: false,
                    text: '',
                    error: String(error),
                    latencyMs: Date.now() - startTime,
                };
            }
        },
        { audioArray, prompt }
    );

    return result;
}

// ─── Renderer State Reading ─────────────────────────────────────────

export interface ConversationBlock {
    id: string;
    speaker: 'user' | 'interviewer';
    text: string;
    timestamp: string;
}

/**
 * Read the current conversation from the renderer's Zustand store.
 */
export async function getConversation(window: Page): Promise<ConversationBlock[]> {
    return await window.evaluate(() => {
        const store = (window as any).__TEST_SESSION_STORE__;
        if (!store) {
            throw new Error('Zustand session store is not exposed on window.__TEST_SESSION_STORE__');
        }
        const storeState = store.getState();
        return storeState.conversation.map((block: any) => ({
            id: block.id,
            speaker: block.speaker,
            text: block.text,
            timestamp: block.timestamp?.toISOString?.() || String(block.timestamp),
        }));
    });
}

/**
 * Read candidate questions from the renderer's Zustand store.
 */
export async function getCandidateQuestions(window: Page): Promise<any[]> {
    return await window.evaluate(() => {
        const storeState = (window as any).__TEST_ANSWER_STORE__?.getState?.();
        if (storeState) {
            return storeState.candidateQuestions;
        }
        return [];
    });
}

/**
 * Read AI answers from the renderer's Zustand store.
 */
export async function getAnswers(window: Page): Promise<any[]> {
    return await window.evaluate(() => {
        const storeState = (window as any).__TEST_ANSWER_STORE__?.getState?.();
        if (storeState) {
            return storeState.answers;
        }
        return [];
    });
}

// ─── Renderer State Injection ───────────────────────────────────────

/**
 * Inject a chat block directly into the conversation state.
 * Simulates what happens when audio is transcribed and added to the conversation.
 */
export async function injectChatBlock(
    window: Page,
    speaker: 'user' | 'interviewer',
    text: string
): Promise<void> {
    await window.evaluate(
        ({ speaker, text }) => {
            const store = (window as any).__TEST_SESSION_STORE__;
            if (!store) {
                throw new Error('Zustand session store is not exposed on window.__TEST_SESSION_STORE__');
            }
            const state = store.getState();
            state.setConversation((prev: any[]) => [
                ...prev,
                {
                    id: Date.now().toString() + Math.random().toString(),
                    speaker,
                    text,
                    timestamp: new Date(),
                },
            ]);
        },
        { speaker, text }
    );
}

// ─── UI Interaction Helpers ─────────────────────────────────────────

/**
 * Wait for a transcription with specific text to appear in the UI.
 * Uses polling on the DOM to check for text content.
 */
export async function waitForTranscriptionInUI(
    window: Page,
    expectedText: string,
    speaker: 'user' | 'interviewer',
    timeoutMs: number = 30000
): Promise<boolean> {
    try {
        await window.waitForFunction(
            ({ text, speaker }) => {
                // Look for chat blocks in the UI
                const blocks = document.querySelectorAll('[data-speaker]');
                for (const block of blocks) {
                    const blockSpeaker = block.getAttribute('data-speaker');
                    const blockText = block.textContent || '';
                    if (blockSpeaker === speaker && blockText.includes(text)) {
                        return true;
                    }
                }
                return false;
            },
            { text: expectedText, speaker },
            { timeout: timeoutMs }
        );
        return true;
    } catch {
        return false;
    }
}

/**
 * Wait for an AI answer to appear in the candidate questions list.
 */
export async function waitForAIAnswer(
    window: Page,
    timeoutMs: number = 60000
): Promise<boolean> {
    try {
        await window.waitForFunction(
            () => {
                const store = (window as any).__TEST_ANSWER_STORE__;
                if (!store) return false;
                const state = store.getState();
                return state.candidateQuestions.some(
                    (q: any) => q.answer && q.answer.length > 0 && !q.isStreaming
                );
            },
            {},
            { timeout: timeoutMs }
        );
        return true;
    } catch {
        return false;
    }
}

/**
 * Trigger question picking (generate answer) via the renderer.
 */
export async function pickQuestion(
    window: Page,
    candidateId: string
): Promise<void> {
    await window.evaluate(
        (id) => {
            // Find and click the answer button for this candidate
            const button = document.querySelector(`[data-candidate-id="${id}"] button[data-action="answer"]`);
            if (button) {
                (button as HTMLButtonElement).click();
            }
        },
        candidateId
    );
}

// ─── LLM Testing ────────────────────────────────────────────────────

export interface LLMResult {
    success: boolean;
    text: string;
    error?: string;
    firstTokenLatencyMs: number;
    totalLatencyMs: number;
}

/**
 * Directly call the LLM service from the main process.
 * Measures first-token and total latency.
 */
export async function generateLLMAnswer(
    electronApp: ElectronApplication,
    question: string,
    systemPrompt?: string
): Promise<LLMResult> {
    return await electronApp.evaluate(
        async ({ ipcMain }, { question, systemPrompt }) => {
            const req = (global as any).__TEST_REQUIRE__;
            const { getLLMService } = req('./llm/llm-service');
            const llmService = getLLMService();

            const startTime = Date.now();
            let firstTokenTime = 0;

            try {
                const result = await llmService.generate({
                    systemPrompt: systemPrompt || 'You are an interview coach. Give a concise answer.',
                    prompt: question,
                    temperature: 0.7,
                    maxTokens: 512,
                    stream: false,
                });

                const totalLatencyMs = Date.now() - startTime;
                return {
                    success: true,
                    text: result.text,
                    firstTokenLatencyMs: totalLatencyMs, // For non-streaming, first token = total
                    totalLatencyMs,
                };
            } catch (error) {
                return {
                    success: false,
                    text: '',
                    error: String(error),
                    firstTokenLatencyMs: 0,
                    totalLatencyMs: Date.now() - startTime,
                };
            }
        },
        { question, systemPrompt }
    );
}

/**
 * Generate an LLM answer with streaming, measuring first-token latency.
 */
export async function generateLLMAnswerStreaming(
    electronApp: ElectronApplication,
    question: string,
    systemPrompt?: string
): Promise<LLMResult> {
    return await electronApp.evaluate(
        async ({ ipcMain }, { question, systemPrompt }) => {
            const req = (global as any).__TEST_REQUIRE__;
            const { getLLMService } = req('./llm/llm-service');
            const llmService = getLLMService();

            const startTime = Date.now();
            let firstTokenTime = 0;
            let fullText = '';

            try {
                const result = await llmService.generate({
                    systemPrompt: systemPrompt || 'You are an interview coach. Give a concise answer.',
                    prompt: question,
                    temperature: 0.7,
                    maxTokens: 512,
                    stream: true,
                });

                if (result.stream) {
                    for await (const chunk of result.stream) {
                        if (firstTokenTime === 0) {
                            firstTokenTime = Date.now() - startTime;
                        }
                        fullText += chunk;
                    }
                }

                return {
                    success: true,
                    text: fullText,
                    firstTokenLatencyMs: firstTokenTime || Date.now() - startTime,
                    totalLatencyMs: Date.now() - startTime,
                };
            } catch (error) {
                return {
                    success: false,
                    text: '',
                    error: String(error),
                    firstTokenLatencyMs: firstTokenTime || 0,
                    totalLatencyMs: Date.now() - startTime,
                };
            }
        },
        { question, systemPrompt }
    );
}

// ─── Test Store Exposure ────────────────────────────────────────────

/**
 * Expose Zustand stores on the window object for test access.
 * This must be called once after the app loads.
 */
export async function exposeStoresForTesting(window: Page): Promise<void> {
    await window.evaluate(() => {
        // The stores are Zustand module-level singletons.
        // We need to import them and attach to window.
        // Since we're in the renderer context, we can access the bundled modules.
        // This relies on the stores being importable at runtime.

        // Try to find stores via React DevTools or module cache
        const findStore = (storeName: string) => {
            // Zustand stores attach their API to the hook function itself
            // We look for them in the module system
            try {
                // Vite's module system exposes modules
                const modules = (import.meta as any).hot?.data || {};
                for (const [key, mod] of Object.entries(modules)) {
                    if (key.includes(storeName)) {
                        return mod;
                    }
                }
            } catch {}
            return null;
        };

        // Alternative: stores expose themselves when NODE_ENV is 'test'
        // This is set up in the app initialization
    });
}
