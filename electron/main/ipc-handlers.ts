import { ipcMain, app, globalShortcut } from 'electron';
import { getTranscriber } from './whisper/transcriber';
import { IPC_CHANNELS } from '../types/ipc';
import { BrowserWindow } from 'electron';

export function registerIPCHandlers(): void {

    // Load Whisper model
    ipcMain.handle(IPC_CHANNELS.WHISPER_LOAD_MODEL, async (event, modelName: string) => {
        try {
            const transcriber = getTranscriber();
            await transcriber.initialize(modelName);
            return { success: true };
        } catch (error) {
            console.error('IPC: Failed to load model:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });

    // Transcribe audio
    ipcMain.handle(IPC_CHANNELS.WHISPER_TRANSCRIBE, async (event, audioData: number[]) => {
        try {
            const transcriber = getTranscriber();

            // Convert number array back to Float32Array
            const float32Audio = new Float32Array(audioData);

            const text = await transcriber.transcribe(float32Audio);

            return {
                success: true,
                text: text.trim(),
            };
        } catch (error) {
            console.error('IPC: Transcription failed:', error);
            return {
                success: false,
                text: '',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });

    // Get model status
    ipcMain.handle(IPC_CHANNELS.WHISPER_STATUS, async () => {
        try {
            const transcriber = getTranscriber();
            const status = transcriber.getStatus();
            return {
                success: true,
                ...status,
            };
        } catch (error) {
            return {
                success: false,
                isLoaded: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });

    // Get desktop audio sources
    ipcMain.handle(IPC_CHANNELS.GET_DESKTOP_SOURCES, async () => {
        try {
            const { desktopCapturer } = await import('electron');
            const sources = await desktopCapturer.getSources({
                types: ['screen', 'window'],
                fetchWindowIcons: false,
            });

            // Return audio-capable sources
            return sources.map(source => ({
                id: source.id,
                name: source.name,
                type: source.id.startsWith('screen') ? 'screen' : 'window',
            }));
        } catch (error) {
            console.error('Failed to get desktop sources:', error);
            return [];
        }
    });

    // LLM: Generate response
    ipcMain.handle('llm:generate', async (event, options: {
        systemPrompt: string;
        prompt: string;
        temperature?: number;
        maxTokens?: number;
        stream?: boolean;
    }) => {
        try {
            const { getLLMService } = await import('./llm/llm-service');
            const llmService = getLLMService();

            const result = await llmService.generate(options);
            return {
                success: true,
                ...result,
            };
        } catch (error) {
            console.error('IPC: LLM generation failed:', error);
            return {
                success: false,
                text: '',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });

    // Window: Set ignore mouse events (for click-through behavior)
    ipcMain.handle(IPC_CHANNELS.SET_IGNORE_MOUSE_EVENTS, async (event, ignore: boolean) => {
        try {
            const window = BrowserWindow.fromWebContents(event.sender);
            if (window) {
                if (ignore) {
                    // When ignoring, forward mouse events so renderer can detect mouseenter
                    window.setIgnoreMouseEvents(true, { forward: true });
                } else {
                    // When NOT ignoring, accept all mouse events normally
                    window.setIgnoreMouseEvents(false);
                }
                return { success: true };
            }
            return { success: false, error: 'No window found' };
        } catch (error) {
            console.error('IPC: Failed to set ignore mouse events:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });

    // Window: Move window by delta (for custom drag implementation)
    ipcMain.handle(IPC_CHANNELS.MOVE_WINDOW, async (event, deltaX: number, deltaY: number) => {
        try {
            const window = BrowserWindow.fromWebContents(event.sender);
            if (window) {
                const [currentX, currentY] = window.getPosition();
                window.setPosition(currentX + deltaX, currentY + deltaY);
                return { success: true };
            }
            return { success: false, error: 'No window found' };
        } catch (error) {
            console.error('IPC: Failed to move window:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });

    // Screen: Capture screenshot
    ipcMain.handle(IPC_CHANNELS.CAPTURE_SCREEN, async (event, sourceId?: string) => {
        try {
            const { captureScreen } = await import('./screen-capture');
            const imageData = await captureScreen(sourceId);

            return {
                success: true,
                imageData,
            };
        } catch (error) {
            console.error('IPC: Screen capture failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });

    // Screen: Analyze screenshot with LLM vision
    ipcMain.handle(IPC_CHANNELS.ANALYZE_SCREEN, async (event, params: {
        imageData: string;
        prompt?: string;
        context?: string;
    }) => {
        try {
            const { getLLMService } = await import('./llm/llm-service');
            const llmService = getLLMService();

            // Build vision prompt
            const systemPrompt = `You are an expert interview assistant analyzing a screenshot. 
Extract relevant information from the image and provide a professional, concise answer.
Focus on:
- Text content (questions, code, problems)
- Visual elements (diagrams, charts, UI)
- Context and meaning

Be clear, structured, and helpful.`;

            const userPrompt = params.prompt ||
                `Analyze this screenshot from an interview. Extract any questions, problems, or important information, and provide a professional answer or explanation.`;

            const fullPrompt = params.context
                ? `${userPrompt}\n\nAdditional Context:\n${params.context}`
                : userPrompt;

            // Generate answer with vision
            const result = await llmService.generate({
                systemPrompt,
                prompt: fullPrompt,
                imageData: params.imageData,
                temperature: 0.7,
                maxTokens: 1024,
                stream: false,
            });

            return {
                success: true,
                answer: result.text,
            };
        } catch (error) {
            console.error('IPC: Screen analysis failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });

    // Screen: One-shot capture + analyze (no UI interaction needed)
    ipcMain.handle(IPC_CHANNELS.CAPTURE_AND_ANALYZE, async (event, prompt?: string) => {
        try {
            const { captureScreen } = await import('./screen-capture');
            const { getLLMService } = await import('./llm/llm-service');

            // Step 1: Capture primary screen
            const imageData = await captureScreen();

            // Step 2: Analyze with LLM vision
            const llmService = getLLMService();
            const systemPrompt = `You are an expert coding and interview assistant. Analyze the screenshot and provide a clear, structured response.
If you see code: explain it, identify bugs, suggest fixes, and provide the corrected version.
If you see a question: provide a professional, comprehensive answer.
If you see a DSA problem: explain the approach, provide the solution with time/space complexity.
Be concise but thorough. Use bullet points and code blocks where appropriate.`;

            const userPrompt = prompt ||
                'Analyze this screenshot. If it contains code, explain and debug it. If it contains a question or problem, provide a clear answer or solution.';

            const result = await llmService.generate({
                systemPrompt,
                prompt: userPrompt,
                imageData,
                temperature: 0.5,
                maxTokens: 2048,
                stream: false,
            });

            return {
                success: true,
                answer: result.text,
            };
        } catch (error) {
            console.error('IPC: Capture-and-analyze failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });

    // App: Quit application
    ipcMain.handle(IPC_CHANNELS.QUIT_APP, async () => {
        try {
            app.quit();
            return { success: true };
        } catch (error) {
            console.error('IPC: Failed to quit app:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
}

/**
 * Register global keyboard shortcuts.
 * Called after the main window is created.
 */
export function registerGlobalShortcuts(mainWindow: BrowserWindow): void {
    // Ctrl+Shift+S → Capture screen + analyze
    globalShortcut.register('CommandOrControl+Shift+S', () => {
        mainWindow.webContents.send('shortcut:capture-screen');
    });

    // Ctrl+Shift+G → Generate answer from transcript
    globalShortcut.register('CommandOrControl+Shift+G', () => {
        mainWindow.webContents.send('shortcut:generate-answer');
    });

    // Ctrl+Shift+H → Toggle collapsed/expanded
    globalShortcut.register('CommandOrControl+Shift+H', () => {
        mainWindow.webContents.send('shortcut:toggle-widget');
    });

    // Ctrl+Shift+R → Toggle recording
    globalShortcut.register('CommandOrControl+Shift+R', () => {
        mainWindow.webContents.send('shortcut:toggle-recording');
    });
}
