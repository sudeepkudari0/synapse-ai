import { ElectronApplication, Page } from '@playwright/test';

/**
 * Helper to wait for IPC communication
 */
export async function waitForIPC(
    electronApp: ElectronApplication,
    channel: string,
    timeout = 5000
): Promise<any> {
    return electronApp.evaluate(
        async ({ ipcMain }, { channel, timeout }) => {
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    reject(new Error(`IPC timeout waiting for ${channel}`));
                }, timeout);

                ipcMain.once(channel, (event, ...args) => {
                    clearTimeout(timer);
                    resolve(args);
                });
            });
        },
        { channel, timeout }
    );
}

/**
 * Helper to simulate microphone permission grant
 */
export async function grantMicrophonePermission(window: Page): Promise<void> {
    await window.context().grantPermissions(['microphone']);
}

/**
 * Helper to wait for model to load
 */
export async function waitForModelLoad(
    window: Page,
    timeout = 120000 // 2 minutes for first-time model download
): Promise<void> {
    // Wait for either loading indicator to disappear or error to appear
    await window.waitForFunction(
        () => {
            const loadingButton = document.querySelector('button:has-text("Loading Model")');
            const errorMessage = document.querySelector('.bg-destructive\\/10');
            const recordingIndicator = document.querySelector('text=Recording');

            return !loadingButton || errorMessage || recordingIndicator;
        },
        { timeout }
    );
}

/**
 * Helper to get console logs from Electron app
 */
export function setupConsoleCapture(window: Page): string[] {
    const logs: string[] = [];

    window.on('console', (msg) => {
        logs.push(`[${msg.type()}] ${msg.text()}`);
    });

    return logs;
}

/**
 * Helper to check if app is in recording state
 */
export async function isRecording(window: Page): Promise<boolean> {
    const stopButton = window.locator('button:has-text("Stop")');
    return await stopButton.isVisible();
}

/**
 * Helper to start recording with error handling
 */
export async function startRecording(
    window: Page,
    options: { waitForModel?: boolean; timeout?: number } = {}
): Promise<void> {
    const { waitForModel = true, timeout = 60000 } = options;

    const startButton = window.locator('button:has-text("Start Listening")');
    await startButton.click();

    if (waitForModel) {
        await waitForModelLoad(window, timeout);
    }

    // Verify recording started
    const recordingIndicator = window.locator('text=Recording');
    await recordingIndicator.waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Helper to stop recording
 */
export async function stopRecording(window: Page): Promise<void> {
    const stopButton = window.locator('button:has-text("Stop")');

    if (await stopButton.isVisible()) {
        await stopButton.click();

        // Wait for recording to stop
        await stopButton.waitFor({ state: 'hidden', timeout: 5000 });
    }
}

/**
 * Helper to clear transcript
 */
export async function clearTranscript(window: Page): Promise<void> {
    await stopRecording(window);
    const startButton = window.locator('button:has-text("Start Listening")');
    await startButton.waitFor({ state: 'visible' });
}

/**
 * Helper to get app metrics from main process
 */
export async function getAppMetrics(electronApp: ElectronApplication) {
    return electronApp.evaluate(async ({ app }) => {
        return {
            version: app.getVersion(),
            name: app.getName(),
            path: app.getPath('userData'),
        };
    });
}

// ─── New Helpers for Mock Interview Testing ─────────────────────────

/**
 * Wait for the conversation to have at least N blocks.
 */
export async function waitForConversationLength(
    window: Page,
    minLength: number,
    timeout = 10000
): Promise<void> {
    await window.waitForFunction(
        (min) => {
            const store = (window as any).__TEST_SESSION_STORE__;
            if (!store) return false;
            return store.getState().conversation.length >= min;
        },
        minLength,
        { timeout }
    );
}

/**
 * Wait for a specific speaker to have a new block.
 */
export async function waitForSpeakerBlock(
    window: Page,
    speaker: 'user' | 'interviewer',
    timeout = 10000
): Promise<void> {
    const currentCount = await window.evaluate((sp: string) => {
        const store = (window as any).__TEST_SESSION_STORE__;
        if (!store) return 0;
        return store.getState().conversation.filter((b: any) => b.speaker === sp).length;
    }, speaker);

    await window.waitForFunction(
        ({ speaker, count }) => {
            const store = (window as any).__TEST_SESSION_STORE__;
            if (!store) return false;
            return store.getState().conversation.filter((b: any) => b.speaker === speaker).length > count;
        },
        { speaker, count: currentCount },
        { timeout }
    );
}

/**
 * Measure the execution time of an async function.
 */
export async function measureLatency<T>(
    fn: () => Promise<T>
): Promise<{ result: T; latencyMs: number }> {
    const start = performance.now();
    const result = await fn();
    return { result, latencyMs: performance.now() - start };
}

/**
 * Read the Zustand session store state from the renderer.
 */
export async function getRendererSessionState(window: Page) {
    return await window.evaluate(() => {
        const store = (window as any).__TEST_SESSION_STORE__;
        if (!store) return null;
        const state = store.getState();
        return {
            conversationLength: state.conversation.length,
            isRecording: state.isRecording,
            sessionTime: state.sessionTime,
            conversation: state.conversation.map((b: any) => ({
                id: b.id,
                speaker: b.speaker,
                text: b.text,
            })),
        };
    });
}

/**
 * Read the Zustand answer store state from the renderer.
 */
export async function getRendererAnswerState(window: Page) {
    return await window.evaluate(() => {
        const store = (window as any).__TEST_ANSWER_STORE__;
        if (!store) return null;
        const state = store.getState();
        return {
            answersCount: state.answers.length,
            isGenerating: state.isGenerating,
            candidateQuestionsCount: state.candidateQuestions.length,
            candidateQuestions: state.candidateQuestions.map((q: any) => ({
                id: q.id,
                text: q.text?.slice(0, 100),
                confidence: q.confidence,
                status: q.status,
                hasAnswer: !!(q.answer && q.answer.length > 0),
            })),
        };
    });
}

/**
 * Take a timestamped screenshot for debugging.
 */
export async function takeDebugScreenshot(window: Page, label: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = `e2e/screenshots/${label}-${timestamp}.png`;
    await window.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
}
